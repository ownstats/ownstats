import DuckDB from 'duckdb';
import { metricScope, Unit } from 'aws-embedded-metrics';
import dayjs from 'dayjs';
import { ScheduledEvent, Context } from 'aws-lambda';
import Logger from '../utils/logger';
import { createSessionAggregation, createTodaysStatsAggregation } from '../utils/queryRenderer';

(BigInt.prototype as any).toJSON = function () {
  return parseInt(this.toString());
};

// Instantiate logger
const logger = new Logger().getInstance();

// Instantiate DuckDB
const duckDB = new DuckDB.Database(':memory:', { allow_unsigned_extensions: 'true' });

// Store initialization
let isInitialized = false;

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
  metrics.putDimensions({ Service: 'AggregateHourlyStatsService' });
  metrics.setProperty('RequestId', context.awsRequestId);

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
      // Enable loading of Lambda extensions from https://extensions.quacking.cloud (see website for list of extensions)
      // await query(`SET custom_extension_repository = 'http://extensions.quacking.cloud';`);
      
      // Install and load local extensions
      await query(`INSTALL '/opt/nodejs/node_modules/duckdb/extensions/aws.duckdb_extension';`);
      await query(`LOAD '/opt/nodejs/node_modules/duckdb/extensions/aws.duckdb_extension';`);
      requestLogger.debug({ message: 'Loaded aws extension!' });
      await query(`INSTALL '/opt/nodejs/node_modules/duckdb/extensions/httpfs.duckdb_extension';`);
      await query(`LOAD '/opt/nodejs/node_modules/duckdb/extensions/httpfs.duckdb_extension';`);
      requestLogger.debug({ message: 'Loaded httpfs extension!' });

      // Set AWS region, see https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html#configuration-envvars-runtime
      await query(`SET s3_region='${AWS_REGION}';`);

      requestLogger.debug({ message: 'Initial setup done!' });
      metrics.putMetric('InitialSetupDuration', (new Date().getTime() - initialSetupStartTimestamp), Unit.Milliseconds);

      // Store initialization
      isInitialized = true;
    }

    // Get yesterday's date
    const todayDate = dayjs().format('YYYY-MM-DD');

    // Track query start timestamp
    const queryStartTimestamp = new Date().getTime();

    // Run session aggregation query
    const sessionAggregationQuery = createSessionAggregation(S3_INPUT_BUCKET_NAME!, S3_INPUT_PREFIX!, todayDate);
    requestLogger.debug({ sessionAggregationQuery });

    const sessionAggregationQueryResult = await query(sessionAggregationQuery);
    requestLogger.debug({ sessionAggregationQueryResult });

    // Run stats aggregation query
    const statsAggregationQuery = createTodaysStatsAggregation(S3_INPUT_BUCKET_NAME!, S3_OUTPUT_BUCKET_NAME!, S3_INPUT_PREFIX!, `${S3_OUTPUT_PREFIX}/daily-stats`, todayDate);
    requestLogger.debug({ statsAggregationQuery });

    const statsAggregationQueryResult = await query(statsAggregationQuery);
    requestLogger.debug({ statsAggregationQueryResult });

    // Run event aggregation query
    // const eventAggregationQuery = createEventAggregation(S3_INPUT_BUCKET_NAME!, S3_OUTPUT_BUCKET_NAME!, S3_INPUT_PREFIX!, `${S3_OUTPUT_PREFIX}/events`, todayDate);
    // requestLogger.debug({ statsAggregationQuery });

    // const eventAggregationQueryResult = await query(eventAggregationQuery);
    // requestLogger.debug({ eventAggregationQueryResult });

    metrics.putMetric('QueryDuration', (new Date().getTime() - queryStartTimestamp), Unit.Milliseconds);

    // Close connection and database -> IMPORTANT, because otherwise the data doesn't get persisted before the upload to S3
    await close(duckDB);

    return;
  } catch (err) {
    requestLogger.error(err);
    return err;
  }
})
