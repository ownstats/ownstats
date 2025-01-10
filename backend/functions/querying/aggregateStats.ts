import DuckDB from 'duckdb';
import { metricScope, Unit } from 'aws-embedded-metrics';
import dayjs from 'dayjs';
import { ScheduledEvent, Context } from 'aws-lambda';
import Logger from '../utils/logger';
import { createSessionAggregation, createStatsAggregation, createEventAggregation, getAggregatedStatsData, dropSessionAggregation, addAggregatedStatsData } from '../utils/queryRenderer';
import { databaseFilePath, databaseFileS3Key, databaseName, downloadFromS3, temporaryDatabaseFilePath, temporaryDatabaseName, uploadToS3 } from '../utils/s3';

(BigInt.prototype as any).toJSON = function () {
  return parseInt(this.toString());
};

// Instantiate logger
const logger = new Logger().getInstance();

// Instantiate DuckDB
const duckDB = new DuckDB.Database(':memory:', { allow_unsigned_extensions: 'true' });

// Store initialization
let isInitialized = false;

// Store if existing data exists
let hasExistingData = false;  

// Promisify query method
const query = (query: string) => {
  return new Promise((resolve, reject) => {
    duckDB.all(query, (err, res) => {
      if (err) reject(err);
      resolve(res);
    })
  })
}

// Promisify database closing
const close = (duckDb: DuckDB.Database): Promise<void> => {
  return new Promise((resolve, reject) => {
    duckDb.close((err, res) => {
      if (err) reject(err);
      duckDB.wait((err1, res1) => {
        if (err1) reject(err1);
        resolve();
      });
    })
  })
}

// Waiter
const wait = async (ms: number): Promise<void> => {
  return new Promise((resolve, _reject) => {
    setTimeout(() => {
      logger.debug(`Waited for ${ms}ms!`);
      resolve();
    }, ms);
  })
}

// Get relevant environment variables for configuring DuckDB's httpfs extension
const {
  AWS_REGION,
  AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
  S3_INPUT_BUCKET_NAME,
  S3_OUTPUT_BUCKET_NAME,
  S3_INPUT_PREFIX,
  S3_OUTPUT_PREFIX,
} = process.env;

export const handler = metricScope(metrics => async (event: ScheduledEvent, context: Context) => {
  // Setup logger
  const requestLogger = logger.child({ requestId: context.awsRequestId });
  requestLogger.debug({ event, context });

  // Setup metrics
  metrics.putDimensions({ Service: 'QueryService' });
  metrics.setProperty('RequestId', context.awsRequestId);

  // Store latest event date
  let latestEventDate: string | null = null;

  try {
    // Check if DuckDB has been initalized
    if (!isInitialized) {
      const initialSetupStartTimestamp = new Date().getTime();
      
      // Set home directory
      await query(`SET home_directory='/tmp';`);
      // Whether or not the global http metadata is used to cache HTTP metadata, see https://github.com/duckdb/duckdb/pull/5405
      await query(`SET enable_http_metadata_cache=true;`);
      // Whether or not object cache is used to cache e.g. Parquet metadata
      await query(`SET enable_object_cache=true;`);
      // Set memory limit
      await query(`SET memory_limit='${AWS_LAMBDA_FUNCTION_MEMORY_SIZE}MB';`);

      // Install and load local extensions
      await query(`INSTALL '/opt/nodejs/node_modules/duckdb/extensions/aws.duckdb_extension';`);
      await query(`LOAD '/opt/nodejs/node_modules/duckdb/extensions/aws.duckdb_extension';`);
      requestLogger.debug({ message: 'Loaded aws extension!' });
      await query(`INSTALL '/opt/nodejs/node_modules/duckdb/extensions/httpfs.duckdb_extension';`);
      await query(`LOAD '/opt/nodejs/node_modules/duckdb/extensions/httpfs.duckdb_extension';`);
      requestLogger.debug({ message: 'Loaded httpfs extension!' });
      
      // Set AWS region, see https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html#configuration-envvars-runtime
      await query(`SET s3_region='${AWS_REGION}';`);

      // Try to download pre-computed DuckDB database file from S3 if it exists
      // and store it as the temporary database
      try {
        // Download pre-computed DuckDB database file from S3
        await downloadFromS3(databaseFileS3Key, temporaryDatabaseFilePath);
        // Attach as temporary database
        await query(`ATTACH '${temporaryDatabaseFilePath}' AS ${temporaryDatabaseName}`);
        // Check if existing data exists
        const existingDataQuery = `SELECT max(event_date)::varchar AS max_event_date FROM ${temporaryDatabaseName}.aggregated_stats;`;
        const existingDataQueryResult = await query(existingDataQuery);
        requestLogger.debug({ existingDataQueryResult });
        // Check if there's existing data in the temporary database 
        if (Array.isArray(existingDataQueryResult) && existingDataQueryResult.length === 1 && existingDataQueryResult[0].max_event_date) {
          // Set flag to true
          hasExistingData = true;
          // Store latest event date
          latestEventDate = existingDataQueryResult[0].max_event_date;
        }
        
      } catch (e: any) {
        requestLogger.error(`Download from S3 unsuccessful! Error: ${e}`);
      }

      // Use target database (will be created if it doesn't exist)
      await query(`ATTACH '${databaseFilePath}' AS ${databaseName}`);
      await query(`USE ${databaseName}`);

      requestLogger.debug({ message: 'Initial setup done!' });
      metrics.putMetric('InitialSetupDuration', (new Date().getTime() - initialSetupStartTimestamp), Unit.Milliseconds);

      // Store initialization
      isInitialized = true;
    }

    // Get yesterday's date
    const yesterdayDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const dayBeforeYesterdayDate = dayjs().subtract(2, 'day').format('YYYY-MM-DD');

    // Track query start timestamp
    const queryStartTimestamp = new Date().getTime();

    // Run session aggregation query: Create a table with all sessions for the given date
    const sessionAggregationQuery = createSessionAggregation(S3_INPUT_BUCKET_NAME!, S3_INPUT_PREFIX!, yesterdayDate);
    requestLogger.debug({ sessionAggregationQuery });

    const sessionAggregationQueryResult = await query(sessionAggregationQuery);
    requestLogger.debug({ sessionAggregationQueryResult });

    // Run stats aggregation query: Writes a Parquet file with all stats for the given date to the S3 output bucket
    const statsAggregationQuery = createStatsAggregation(S3_INPUT_BUCKET_NAME!, S3_OUTPUT_BUCKET_NAME!, S3_INPUT_PREFIX!, `${S3_OUTPUT_PREFIX}/stats`, yesterdayDate);
    requestLogger.debug({ statsAggregationQuery });

    const statsAggregationQueryResult = await query(statsAggregationQuery);
    requestLogger.debug({ statsAggregationQueryResult });

    // Run event aggregation query
    const eventAggregationQuery = createEventAggregation(S3_INPUT_BUCKET_NAME!, S3_OUTPUT_BUCKET_NAME!, S3_INPUT_PREFIX!, `${S3_OUTPUT_PREFIX}/events`, yesterdayDate);
    requestLogger.debug({ statsAggregationQuery });

    const eventAggregationQueryResult = await query(eventAggregationQuery);
    requestLogger.debug({ eventAggregationQueryResult });

    // Determine whether there needs to be a full load of the stats data
    if (!hasExistingData || latestEventDate !== dayBeforeYesterdayDate) {
      // Load complete stats data
      const loadStatsQuery = getAggregatedStatsData(S3_OUTPUT_BUCKET_NAME!, S3_OUTPUT_PREFIX!);
      requestLogger.debug({ loadStatsQuery });

      const loadStatsQueryResult = await query(loadStatsQuery);
      requestLogger.debug({ loadStatsQueryResult });
    } else {
      // Insert the existing stats data from the temporary database
      const insertExistingDataQuery = `CREATE TABLE ${databaseName}.aggregated_stats AS SELECT * FROM ${temporaryDatabaseName}.aggregated_stats;`;
      requestLogger.debug({ insertExistingDataQuery });

      const insertExistingDataQueryResult = await query(insertExistingDataQuery);
      requestLogger.debug({ insertExistingDataQueryResult });

      await query(addAggregatedStatsData(S3_OUTPUT_BUCKET_NAME!, S3_OUTPUT_PREFIX!, yesterdayDate, yesterdayDate));
      requestLogger.debug({ message: 'Adding aggregated stats data done!' });

      await query(`DETACH "${temporaryDatabaseName}"`); // IMPORTANT: Must use double quotes due to DuckDB "bug"
    }

    // Drop temporary daily session table before uploading the DuckDB database file to S3
    const dropSessionTableQueryResult = await query(dropSessionAggregation(yesterdayDate));
    requestLogger.debug({ dropSessionTableQueryResult });
    
    // Detach external database
    await query(`USE memory`);
    await query(`DETACH "${databaseName}"`); // IMPORTANT: Must use double quotes due to DuckDB "bug"

    metrics.putMetric('QueryDuration', (new Date().getTime() - queryStartTimestamp), Unit.Milliseconds);

    // Close connection and database -> IMPORTANT, because otherwise the data doesn't get persisted before the upload to S3
    await close(duckDB);

    // Wait for 2 secs
    await wait(2000);

    // Upload the DuckDB database file to S3
    const uploadResult = await uploadToS3();
    requestLogger.debug({ uploadResult });

    return;
  } catch (err) {
    requestLogger.error(err);
    return err;
  }
})
