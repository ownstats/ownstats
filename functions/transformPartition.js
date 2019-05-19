const util = require('./util');
const bunyan = require('bunyan');

const logger = bunyan.createLogger({
    name: 'ownstatsLogger',
    level: process.env.LOG_LEVEL || 'debug'
});

// AWS Glue Data Catalog database and tables
const sourceTable = process.env.SOURCE_TABLE;
const targetTable = process.env.TARGET_TABLE;
const database = process.env.DATABASE;

// s3 URL to write CTAS results to (including trailing slash)
const athenaCtasResultsLocation = process.env.ATHENA_CTAS_RESULTS_LOCATION;

// get the partition of 2hours ago
exports.handler = async (event, context, callback) => {
  const requestLogger = logger.child({ requestId: context.awsRequestId });
  const partitionHour = new Date(Date.now() - 120 * 60 * 1000);
  const year = partitionHour.getUTCFullYear();
  const month = (partitionHour.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = partitionHour.getUTCDate().toString().padStart(2, '0');
  const hour = partitionHour.getUTCHours().toString().padStart(2, '0');

  requestLogger.debug('Transforming Partition', { year, month, day, hour });

  const intermediateTable = `ctas_${year}_${month}_${day}_${hour}`;

  const ctasStatement = `
    CREATE TABLE ${database}.${intermediateTable}
    WITH ( format='PARQUET',
        external_location='${athenaCtasResultsLocation}year=${year}/month=${month}/day=${day}/hour=${hour}',
        parquet_compression = 'SNAPPY')
    AS SELECT *
    FROM ${database}.${sourceTable}
    WHERE year = '${year}'
        AND month = '${month}'
        AND day = '${day}'
        AND hour = '${hour}';`;

  const dropTableStatement = `DROP TABLE ${database}.${intermediateTable};`;

  const createNewPartitionStatement = `
    ALTER TABLE ${database}.${targetTable}
    ADD IF NOT EXISTS 
    PARTITION (
        year = '${year}',
        month = '${month}',
        day = '${day}',
        hour = '${hour}' );`;

  await util.runQuery(ctasStatement).then(
    () => Promise.all([
      util.runQuery(dropTableStatement),
      util.runQuery(createNewPartitionStatement)
    ])
  );
}