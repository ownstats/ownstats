const util = require('./util');
const bunyan = require('bunyan');

const logger = bunyan.createLogger({
    name: 'ownstatsLogger',
    level: process.env.LOG_LEVEL || 'debug'
});

// AWS Glue Data Catalog database and table
const table = process.env.TABLE;
const database = process.env.DATABASE;

// Creates partitions for the current hour
exports.handler = async (event, context, callback) => {
  const requestLogger = logger.child({ requestId: context.awsRequestId });

  const nextHourDate = new Date(Date.now() + 60 * 60 * 1000);
  const year = nextHourDate.getUTCFullYear();
  const month = (nextHourDate.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = nextHourDate.getUTCDate().toString().padStart(2, '0');
  const hour = nextHourDate.getUTCHours().toString().padStart(2, '0');

  const createPartitionStatement = `
  ALTER TABLE ${database}.${table}
  ADD IF NOT EXISTS 
  PARTITION (
      year = '${year}',
      month = '${month}',
      day = '${day}',
      hour = '${hour}' );`;

  requestLogger.debug('Creating Partition', { year, month, day, hour });
  
  // Run create partition query
  await util.runQuery(createPartitionStatement);

}
