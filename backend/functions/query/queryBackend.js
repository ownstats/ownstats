import DuckDB from 'duckdb';
import { metricScope, Unit } from 'aws-embedded-metrics';
import Logger from '../../lib/logger';
import { 
  listOrganizationDomainFiles,
  getLatestOrganizationDomainFileTimestamp,
  registerQueryBackend,
  createQueryBackendMapping,
  deleteQueryBackendMapping
} from '../../lib/organization';

// Instantiate logger
const logger = new Logger();

// Instantiate DuckDB
const duckDB = new DuckDB.Database(':memory:');

// Create connection
const connection = duckDB.connect();

// Store function name
const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;

// Promisify query method
const query = (query) => {
  return new Promise((resolve, reject) => {
    connection.all(query, (err, res) => {
      if (err) reject(err);
      resolve(res);
    })
  })
}

// Store latest file timestamp by organization in a map in the context
const latestFiles = {};

// Store organization / domain mapping
const currentOrganizationDomains = {};

// Generate intitial load SQL
const generateInitialLoadSQL = (tableName, files) => {
  return `CREATE TABLE ${tableName} AS SELECT * FROM parquet_scan(${JSON.stringify(files)}, HIVE_PARTITIONING = 1);`.replace(/"/g, "'");
}

// Generate append SQL
const generateAppendSQL = (tableName, files) => {
  return `INSERT INTO ${tableName} FROM (SELECT * FROM read_parquet(${JSON.stringify(files)}, HIVE_PARTITIONING = 1));`.replace(/"/g, "'");
}

const generateCleanupQueries = () => {
  return Object.keys(currentOrganizationDomains).map((key) => {
    const splittedKey = key.split('|');
    return deleteQueryBackendMapping(splittedKey[0], splittedKey[1]);
  });
}

const queryMapping = {
  'Pageviews': {
    render: (tableName, queryParameters, ) => {
      return `select event_date, referrer_domain_name, browser_name, device_type, edge_country, request_path, utm_source, utm_campaign, utm_medium, count(distinct page_view_id) as pageview_cnt, count(distinct daily_visitor_id) as visitor_cnt from ${tableName} where event_type = 'pageview' and event_date between '${queryParameters.startDate}' and '${queryParameters.endDate}' group by event_date, referrer_domain_name, browser_name, device_type, edge_country, request_path, utm_source, utm_campaign, utm_medium;`;
    },
    mandatoryParameters: ['startDate', 'endDate'],
  },
  'Visitors': {
    render: (tableName, queryParameters, ) => {
      return `select event_date, count(distinct daily_visitor_id) as visitor_cnt from ${tableName} where event_type = 'pageview' and event_date between '${queryParameters.startDate}' and '${queryParameters.endDate}' group by event_date;`;
    },
    mandatoryParameters: ['startDate', 'endDate'],
  }
  ,
  'Referers': {
    render: (tableName, queryParameters, ) => {
      return `select referrer, count(distinct page_view_id) as pageview_cnt from ${tableName} where event_type = 'pageview' and event_date between '${queryParameters.startDate}' and '${queryParameters.endDate}' group by event_date;`;
    },
    mandatoryParameters: ['startDate', 'endDate'],
  }
}

const generateQuery = (queryName, queryParameters, tableName) => {
  // Check if query with requested name exists
  if (!queryMapping.hasOwnProperty(queryName)) {
    throw Error(`The query '${queryName}' doesn't exist`);
  }

  // Get provided query parameter names
  const queryParameterNames = Object.keys(queryParameters);
  // Retrieve mandatory parameters for the respective query
  const mandatoryParameters = queryMapping[queryName].mandatoryParameters;
  // Check if all query parameters are present
  const hasMandatoryParameters = mandatoryParameters.every(r => queryParameterNames.includes(r));

  logger.debug({ queryParameterNames, mandatoryParameters, hasMandatoryParameters });

  if (!hasMandatoryParameters) {
    throw Error(`The query '${queryName}' needs the following queryParameters: '${mandatoryParameters.join(', ')}', but got '${queryParameterNames.join(', ')}'`);
  } else {
    return queryMapping[queryName].render(tableName, queryParameters);
  }
}

// SIGTERM Handler 
process.on('SIGTERM', async () => {
  logger.debug('[runtime] SIGTERM received');
  logger.debug('[runtime] cleaning up');

  // perform actual clean up work here. 
  const cleanupQueries = generateCleanupQueries();
  logger.debug({ cleanupQueriesCount: cleanupQueries.length });

  // Run cleanup
  await Promise.all(cleanupQueries);
  
  logger.debug('[runtime] exiting');
  process.exit(0)
});

// eslint-disable-next-line import/prefer-default-export
export const handler = metricScope(metrics => async (event, context) => {
  // Setup logger
  const requestLogger = logger.child({ requestId: context.awsRequestId });
  requestLogger.debug({ event, context });

  // Setup metrics
  metrics.putDimensions({ Service: 'QueryService' });
  metrics.setProperty('RequestId', context.awsRequestId);

  // Get Organization id
  const organizationId = event.organizationId;
  const sanitizedOrganizationId = organizationId.replace(/-/g, '_');

  // Get domain name
  const domainName = event.domainName;
  const sanitizedDomainName = domainName.replace(/\./g, '_');

  // Get query name
  const queryName = event.queryName;

  // Get query parameters
  const queryParameters = event.queryParameters;

  // Get table name
  const tableName = `${sanitizedOrganizationId}_${sanitizedDomainName}`;

  // Get organization domain identifier
  const organizationDomain = `${organizationId}|${domainName}`;

  try {
    // Check if DuckDB has been initalized
    if (Object.keys(latestFiles).length === 0) {
      // Load httpsfs
      const initialSetupStartTimestamp = new Date().getTime();
      await query("SET home_directory='/tmp';");
      await query("INSTALL httpfs;");
      await query("LOAD httpfs;");
      // New speedup option, see https://github.com/duckdb/duckdb/pull/5405
      await query("SET enable_http_metadata_cache=true;");

      requestLogger.debug({ message: 'Initial setup done!' });
      metrics.putMetric('InitialSetupDuration', (new Date().getTime() - initialSetupStartTimestamp), Unit.Milliseconds);

      // Set AWS credentials
      // See https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html#configuration-envvars-runtime
      const awsSetupStartTimestamp = new Date().getTime();
      await query(`SET s3_region='${process.env.AWS_REGION}';`);
      await query(`SET s3_access_key_id='${process.env.AWS_ACCESS_KEY_ID}';`);
      await query(`SET s3_secret_access_key='${process.env.AWS_SECRET_ACCESS_KEY}';`);
      await query(`SET s3_session_token='${process.env.AWS_SESSION_TOKEN}';`);

      requestLogger.debug({ message: 'AWS setup done!' });
      metrics.putMetric('AWSSetupDuration', (new Date().getTime() - awsSetupStartTimestamp), Unit.Milliseconds);

      // Register query backend
      await registerQueryBackend(functionName);
    }

    // Get the lastest file timestamp from the DB
    const latestFileTimestampFromDB = await getLatestOrganizationDomainFileTimestamp(organizationId, domainName);

    // Store query type
    let queryType = '';

    // Check if any files are present, i.e. there is data
    if (!latestFileTimestampFromDB) {
      // Return early, there's no data
      return JSON.stringify([]);
    } else if (!latestFiles.hasOwnProperty(tableName)) { // Intial load, there is some data
      requestLogger.debug({ message: 'Loading data initially' });
      const initialLoadStartTimestamp = new Date().getTime();

      // Get all files from database
      const initialFiles = await listOrganizationDomainFiles(organizationId, domainName, '2022-12-01T00:00:00.000Z', undefined);
      requestLogger.debug({ initialFiles });

      // Get intial load query
      const initialLoadQuery = generateInitialLoadSQL(tableName, initialFiles);
      requestLogger.debug({ initialLoadQuery });

      // Initially load the data in a temporary table
      const initialLoadResult = await query(initialLoadQuery);
      requestLogger.debug({ initialLoadResult });

      // Set metric
      metrics.putMetric('InitialLoadDuration', (new Date().getTime() - initialLoadStartTimestamp), Unit.Milliseconds);

      // Update latest timestamp
      latestFiles[tableName] = latestFileTimestampFromDB;
      requestLogger.debug({ latestFiles });

      // Store organization / domain in map (for later cleanup)
      currentOrganizationDomains[organizationDomain] = new Date().toISOString();

      // Store orgnaization / domain in DynamoDB for query routing
      const createQueryBackendMappingResult = await createQueryBackendMapping(organizationId, domainName, functionName);
      requestLogger.debug({ createQueryBackendMappingResult });

      // Set query type
      queryType = 'INIIAL';
    } else if (latestFiles.hasOwnProperty(tableName) && new Date(latestFileTimestampFromDB) > new Date(latestFiles[tableName])) { // There are new files, appending local table
      requestLogger.debug({ message: 'Loading newer data', latestFileTimestampFromDB, previousLatestFileTimestamp: latestFiles[tableName] });
      const appendLoadStartTimestamp = new Date().getTime();

      // Get files from database starting with the latest timestamp already loaded
      const appendFiles = await listOrganizationDomainFiles(organizationId, domainName, latestFiles[tableName], undefined);
      requestLogger.debug({ appendFiles });

      //Get append query
      const appendQuery = generateAppendSQL(tableName, appendFiles);
      requestLogger.debug({ appendQuery });

      // Load newer data
      const appendResult = await query(appendQuery);
      requestLogger.debug({ appendResult });

      // Set metric
      metrics.putMetric('InitialLoadDuration', (new Date().getTime() - appendLoadStartTimestamp), Unit.Milliseconds);

      //Update latest timestamp
      latestFiles[tableName] = latestFileTimestampFromDB;
      requestLogger.debug({ latestFiles });

      // Set query type
      queryType = 'APPEND';
    } else {
      // Do nothing, just use the existing data

      // Set query type
      queryType = 'EXISTING';
    }

    // Track query start timestamp
    const queryStartTimestamp = new Date().getTime();

    // Run query
    //const queryResult = await query(`select event_date, count(distinct page_view_id) as pageview_cnt from ${tableName} where event_type = 'pageview' group by event_date;`);
    const generatedQuery = generateQuery(queryName, queryParameters, tableName);
    const queryResult = await query(generatedQuery);
    requestLogger.debug({ generatedQuery, queryResult });

    // Set metric & query type
    metrics.setProperty('QueryType', queryType);
    metrics.putMetric('QueryDuration', (new Date().getTime() - queryStartTimestamp), Unit.Milliseconds);

    return JSON.stringify(queryResult);
  } catch (err) {
    requestLogger.error(err);
    return err;
  }
})
