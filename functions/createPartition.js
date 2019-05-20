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

  const currentDate = new Date(Date.now());
  const year = currentDate.getUTCFullYear();
  const month = (currentDate.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = currentDate.getUTCDate().toString().padStart(2, '0');
  const hour = currentDate.getUTCHours().toString().padStart(2, '0');

  const s3Bucket = process.env.S3_BUCKET;
  const prefix = `${process.env.S3_PREFIX}year=${year}/month=${month}/day=${day}/hour=${hour}/`;

  try {
    // Check if there are any key present in current partition
    const partitionExistsResult = await util.checkKeysExist(process.env.S3_BUCKET, prefix);

    // See https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listObjectsV2-property
    if (partitionExistsResult.hasOwnProperty('Contents') && partitionExistsResult.Contents.length > 0) {

      requestLogger.debug(`Found keys in '${s3Bucket}/${prefix}', creating partition!`);

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

    } else {
      requestLogger.debug(`Found no key in '${s3Bucket}/${prefix}', skipping!`);
    }
  } catch (err) {
    requestLogger.error(err);
    throw Error(err);
  }
}