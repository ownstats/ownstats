import DuckDB from 'duckdb';
import { metricScope, Unit } from 'aws-embedded-metrics';
import dayjs from 'dayjs';
import Logger from './utils/logger';
import { getSessionAggregation, getStatsAggregation, getEventAggregation } from './utils/queryRenderer';

// Instantiate logger
const logger = new Logger();

// Instantiate DuckDB
const duckDB = new DuckDB.Database(':memory:');

// Create connection
const connection = duckDB.connect();

// Store initialization
let isInitialized = false;

// Promisify query method
const query = (query) => {
  return new Promise((resolve, reject) => {
    connection.all(query, (err, res) => {
      if (err) reject(err);
      resolve(res);
    })
  })
}

// Get relevant environment variables for configuring DuckDB's httpfs extension
const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_SESSION_TOKEN,
  AWS_REGION,
  AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
  S3_INPUT_BUCKET_NAME,
  S3_OUTPUT_BUCKET_NAME,
  S3_INPUT_PREFIX,
  S3_OUTPUT_PREFIX,
} = process.env;

// eslint-disable-next-line import/prefer-default-export
export const handler = metricScope(metrics => async (event, context) => {
  // Setup logger
  const requestLogger = logger.child({ requestId: context.awsRequestId });
  requestLogger.debug({ event, context });

  // Setup metrics
  metrics.putDimensions({ Service: 'QueryService' });
  metrics.setProperty('RequestId', context.awsRequestId);

  try {
    // Check if DuckDB has been initalized
    if (!isInitialized) {
      const initialSetupStartTimestamp = new Date().getTime();
      
      // Set home directory
      await query(`SET home_directory='/tmp';`);
      // Load httpsfs
      await query(`LOAD httpfs;`);
      // Whether or not the global http metadata is used to cache HTTP metadata, see https://github.com/duckdb/duckdb/pull/5405
      await query(`SET enable_http_metadata_cache=true;`);
      // Whether or not object cache is used to cache e.g. Parquet metadata
      await query(`SET enable_object_cache=true;`);
      // Set memory limit
      await query(`SET memory_limit='${AWS_LAMBDA_FUNCTION_MEMORY_SIZE}MB';`);

      requestLogger.debug({ message: 'Initial setup done!' });
      metrics.putMetric('InitialSetupDuration', (new Date().getTime() - initialSetupStartTimestamp), Unit.Milliseconds);

      const awsSetupStartTimestamp = new Date().getTime();
      
      // Set AWS credentials
      // See https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html#configuration-envvars-runtime
      await query(`SET s3_region='${AWS_REGION}';`);
      await query(`SET s3_access_key_id='${AWS_ACCESS_KEY_ID}';`);
      await query(`SET s3_secret_access_key='${AWS_SECRET_ACCESS_KEY}';`);
      await query(`SET s3_session_token='${AWS_SESSION_TOKEN}';`);

      requestLogger.debug({ message: 'AWS setup done!' });
      metrics.putMetric('AWSSetupDuration', (new Date().getTime() - awsSetupStartTimestamp), Unit.Milliseconds);

      // Store initialization
      isInitialized = true;
    }

    // Get yesterday's date
    const yesterdayDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

    // Track query start timestamp
    const queryStartTimestamp = new Date().getTime();

    // Run session aggregation query
    const sessionAggregationQuery = getSessionAggregation(S3_INPUT_BUCKET_NAME, S3_INPUT_PREFIX, yesterdayDate);
    requestLogger.debug({ sessionAggregationQuery });

    const sessionAggregationQueryResult = await query(sessionAggregationQuery);
    requestLogger.debug({ sessionAggregationQueryResult });

    // Run stats aggregation query
    const statsAggregationQuery = getStatsAggregation(S3_INPUT_BUCKET_NAME, S3_OUTPUT_BUCKET_NAME, S3_INPUT_PREFIX, `${S3_OUTPUT_PREFIX}/stats`, yesterdayDate);
    requestLogger.debug({ statsAggregationQuery });

    const statsAggregationQueryResult = await query(statsAggregationQuery);
    requestLogger.debug({ statsAggregationQueryResult });

    // Run event aggregation query
    const eventAggregationQuery = getEventAggregation(S3_INPUT_BUCKET_NAME, S3_OUTPUT_BUCKET_NAME, S3_INPUT_PREFIX, `${S3_OUTPUT_PREFIX}/events`, yesterdayDate);
    requestLogger.debug({ statsAggregationQuery });

    const eventAggregationQueryResult = await query(eventAggregationQuery);
    requestLogger.debug({ eventAggregationQueryResult });

    metrics.putMetric('QueryDuration', (new Date().getTime() - queryStartTimestamp), Unit.Milliseconds);

    return;
  } catch (err) {
    requestLogger.error(err);
    return err;
  }
})