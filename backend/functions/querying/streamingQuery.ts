import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { Writable, pipeline } from 'stream';
import { promisify } from 'util';
import DuckDB from 'duckdb';
import Logger from '../utils/logger';
import { getAggregatedStatsData, createAggregatedTodaysStatsTable } from '../utils/queryRenderer';
import { Metadata } from '../@types/awslambda';
import { databaseFilePath, downloadFromS3 } from '../utils/s3';
import { listFiles } from '../utils/files';

// Create pipeline stream
const Pipeline = promisify(pipeline);

// Instantiate logger
const logger = new Logger().getInstance();

// Store initialization flag
let isInitialized = false;

// Store use pre-populated database flag
let usePrePopulatedDatabase = false;

// Store if today's data exists
let foundTodaysData = false;

// Store today's file count
let foundTodaysFiles = 0;

// Create database connection string
let databaseConnectionString: string = ':memory:';

try {
  // Download DuckDB database from S3
  await downloadFromS3();
  // Use local database file once successfully downloaded
  databaseConnectionString = databaseFilePath;
  // Use pre-populated database
  usePrePopulatedDatabase = true;

  logger.debug(`Download from S3 successful! Database file located in ${databaseConnectionString}`);
} catch (e: any) {
  logger.debug(`Download from S3 unsuccessful! Error: ${e?.message}`);
}

// Instantiate DuckDB
let duckDB: DuckDB.Database = new DuckDB.Database(databaseConnectionString, { allow_unsigned_extensions: 'true' });;

// Create connection
let connection: DuckDB.Connection = duckDB.connect();;

// Get relevant environment variables for configuring DuckDB's httpfs extension
const {
  AWS_REGION,
  AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
  S3_OUTPUT_BUCKET_NAME,
  S3_OUTPUT_PREFIX,
  S3_INPUT_BUCKET_NAME,
} = process.env;

// Promisify query method
const query = (query: string) => {
  return new Promise((resolve, reject) => {
    if (connection) {
      console.log(`Query: ${query}`);
      connection.all(query, (err, res) => {
        if (err) reject(err);
        resolve(res);
      })
    } else {
      reject(`No connection!`);
    }
  })
}

// SIGTERM Handler 
process.on('SIGTERM', async () => {
  logger.debug('[runtime] SIGTERM received');
  logger.debug('[runtime] cleaning up');

  // Add your cleanup code here!
  
  logger.debug('[runtime] exiting');
  process.exit(0)
});

export const handler = awslambda.streamifyResponse(async (
  event: APIGatewayProxyEventV2,
  responseStream: Writable, 
  context: Context
): Promise<void> => {
  // Setup logger
  const requestLogger = logger.child({ requestId: context!.awsRequestId });
  requestLogger.debug({ event, context });

  // Create default metadata for HTTP status code and headers
  const metadata: Metadata = {
    statusCode: 200,
    headers: {},
  };

  try {
    // Check if it's an OPTIONS request -> CORS
    if (event.requestContext.http.method === 'OPTIONS') {
      // Set content type header
      metadata.headers['Content-Type'] = 'text/plain';
      // Use global helper to pass metadata and status code
      responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);
      // Need to write something, otherwiese metadata is not shown -> CORS error!
      responseStream.write('OK');
      responseStream.end();
    } else if (event.requestContext.http.method === 'POST') { // Normal request for data
      // Check if DuckDB has been initalized
      if (!isInitialized) {
        // Set home directory
        await query(`SET home_directory='/tmp';`);
        // Set memory limit
        await query(`SET memory_limit='${AWS_LAMBDA_FUNCTION_MEMORY_SIZE}MB';`);

        // Install and load local extensions
        await query(`INSTALL '/opt/nodejs/node_modules/duckdb/extensions/aws.duckdb_extension';`);
        await query(`LOAD '/opt/nodejs/node_modules/duckdb/extensions/aws.duckdb_extension';`);
        requestLogger.debug({ message: 'Loaded aws extension!' });

        await query(`INSTALL '/opt/nodejs/node_modules/duckdb/extensions/httpfs.duckdb_extension';`);
        await query(`LOAD '/opt/nodejs/node_modules/duckdb/extensions/httpfs.duckdb_extension';`);
        requestLogger.debug({ message: 'Loaded httpfs extension!' });
        
        await query(`INSTALL '/opt/nodejs/node_modules/duckdb/extensions/arrow.duckdb_extension';`);
        await query(`LOAD '/opt/nodejs/node_modules/duckdb/extensions/arrow.duckdb_extension';`);
        requestLogger.debug({ message: 'Loaded arrow extension!' });

        // Set AWS region, see https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html#configuration-envvars-runtime
        await query(`SET s3_region='${AWS_REGION}';`);
        requestLogger.debug({ message: 'Applied DuckDB settings!' });

        // If pre-populated database isn't used or available, load all stats to in-memory database
        if (!usePrePopulatedDatabase) {
          // Load stats data once
          await query(getAggregatedStatsData(S3_OUTPUT_BUCKET_NAME!, S3_OUTPUT_PREFIX!));
          requestLogger.debug({ message: 'Loading stats done!' });

          // Load events data once
          // await query(getAggregatedEventsData(S3_OUTPUT_BUCKET_NAME!, S3_OUTPUT_PREFIX!));
          // logger.debug({ message: 'Loading events done!' });
        }

        // Store initialization
        isInitialized = true;
      }

      // Read data for today
      let readQuery = `select * from stats_today`;

      // Run check query
      requestLogger.debug({ message: 'Checking for todays data!' });

      // Query DDB to get the number of today's files
      const files = await listFiles();
      requestLogger.debug(`Found ${files} files for today, vs. ${foundTodaysFiles} from the last load`);

      // Check if we already checked for todays data, and omit check if yes
      if (!foundTodaysData || foundTodaysFiles !== files.length) {
        try {
          // Drop table if exists
          await query(`DROP TABLE IF EXISTS stats_today;`);
          
          // Create table for today's data
          await query(createAggregatedTodaysStatsTable(S3_OUTPUT_BUCKET_NAME!, S3_OUTPUT_PREFIX!));
          requestLogger.debug({ message: 'Creating stats_today done!' });

          // Set foundTodaysData
          foundTodaysData = true;

          // Set today's file count
          foundTodaysFiles = files.length;
        } catch (err: any) {
          requestLogger.error(err);
          requestLogger.debug({ message: `Data for today doesn't exists!` });
        }
      } else {
        requestLogger.debug({ message: 'Data for today exists, no changes detected!' });
      }
      
      // Set Content-Type header
      metadata.headers['Content-Type'] = 'application/octet-stream';

      // Use global helper to pass metadata and status code
      responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

      requestLogger.debug({ message: `Running read query: ${readQuery}` });

      // Pipeline the Arrow IPC stream to the response stream
      await Pipeline(await connection!.arrowIPCStream(readQuery), responseStream);

      // Close response stream
      responseStream.end();
    } else { // Invalid request method
      metadata.statusCode = 400;
      metadata.headers['Content-Type'] = 'text/plain';
      responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);
      responseStream.write('ERROR');
      responseStream.end();
    }
  } catch (e: any) {
    requestLogger.error(e.message);
    metadata.statusCode = 500;
    metadata.headers['Content-Type'] = 'text/plain';
    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);
    responseStream.write(e.message);
    responseStream.end();
  }
});