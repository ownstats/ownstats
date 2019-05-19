const util = require('./util');
const bunyan = require('bunyan');

const logger = bunyan.createLogger({
    name: 'ownstatsLogger',
    level: process.env.LOG_LEVEL || 'debug'
});

// AWS Glue Data Catalog database and table
const table = process.env.TABLE;
const database = process.env.DATABASE;

// creates partitions for the hour after the current hour
exports.handler = async (event, context, callback) => {
  const requestLogger = logger.child({ requestId: context.awsRequestId });
  const nextHour = new Date(Date.now() + 60 * 60 * 1000);
  const year = nextHour.getUTCFullYear();
  const month = (nextHour.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = nextHour.getUTCDate().toString().padStart(2, '0');
  const hour = nextHour.getUTCHours().toString().padStart(2, '0');
  
  requestLogger.debug('Creating Partition', { year, month, day, hour });

  const createPartitionStatement = `
    ALTER TABLE ${database}.${table}
    ADD IF NOT EXISTS 
    PARTITION (
        year = '${year}',
        month = '${month}',
        day = '${day}',
        hour = '${hour}' );`;

  await util.runQuery(createPartitionStatement);
}