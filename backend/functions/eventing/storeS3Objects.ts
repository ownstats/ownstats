import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { SNSEvent, Context, S3Event } from 'aws-lambda';
import { getClient } from '../utils/db';
import Logger from '../utils/logger';

const {
  TABLE_NAME,
} = process.env;

// Instantiate logger
const logger = new Logger().getInstance();

const createObjectEntry = async ({ fileType, fileSubType, fileName, fileDomainName, fileEventDate, fileCreatedTimestamp, fileSize, s3Bucket, s3Key }) => {
  const createResponse = await getClient().put({
    TableName: TABLE_NAME!,
    Item: {
      partitionKey: `domain#${fileDomainName}#type#${fileType}`,
      sortKey: `files#${fileEventDate}#${fileName}`,
      createdTimestamp: new Date().toISOString(),
      fileType,
      fileSubType,
      fileName,
      fileDomainName,
      fileEventDate,
      fileCreatedTimestamp,
      fileSize,
      s3Bucket,
      s3Key,
    },
  }).promise();
  return createResponse;
}

const deleteObjectEntry = async ({ fileType, fileName, fileDomainName, fileEventDate }) => {
  const ddbParams: DocumentClient.DeleteItemInput = {
    TableName: TABLE_NAME!,
    Key:{
      partitionKey: `domain#${fileDomainName}#type#${fileType}`,
      sortKey: `files#${fileEventDate}#${fileName}`,
    },
  };

  const deleteResponse = await getClient().delete(ddbParams).promise();
  return deleteResponse;
}

export const deriveEventDetails = (s3Event: S3Event) => {
  // See https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-content-structure.html
  const eventName: string = s3Event.Records[0].eventName.split(':')[0];
  const s3Key: string = decodeURIComponent(s3Event.Records[0].s3.object.key);
  const s3Bucket: string = s3Event.Records[0].s3.bucket.name;
  const fileCreatedTimestamp: string = s3Event.Records[0].eventTime;
  const fileSize: number = s3Event.Records[0].s3.object.size;

  // Sample for incoming:               incoming/domain_name=mydomain.com/event_type=pageview/event_date=2022-11-29/ownstats-delivery-stream-prd-1-2022-11-29-22-26-24-427d939e-74e3-3621-b77c-372853e0751c.parquet
  // Samples for aggregated (stats):    aggregated/stats/domain_name=mydomain.com/event_date=2022-11-29/data_0.parquet
  // Samples for aggregated (events):   aggregated/events/domain_name=mydomain.com/event_date=2022-11-29/event_name=testevent/data_0.parquet
  const keyParts = decodeURIComponent(s3Key).split('/');

  let fileType;
  let fileSubType;
  let fileDomainName;
  let fileEventDate;
  let fileName;

  if (keyParts.length === 5 && keyParts[0] === 'incoming') {
    fileType = 'cleaned';
    fileSubType = keyParts[2].split('=')[1];
    fileDomainName = keyParts[1].split('=')[1];
    fileName = keyParts[4];
    fileEventDate = keyParts[3].split('=')[1]
  } else if (keyParts.length === 5 && keyParts[0] === 'aggregated') {
    fileType = 'curated';
    fileSubType = keyParts[1];
    fileDomainName = keyParts[2].split('=')[1];
    fileName = keyParts[4];
    fileEventDate = keyParts[3].split('=')[1]
  } else {
    throw Error(`S3 Key Parts mismatch: Found ${keyParts.length} parts instead of 5`);
  }

  return {
    eventName,
    fileType,
    fileSubType,
    fileName,
    fileDomainName,
    fileEventDate,
    fileCreatedTimestamp,
    fileSize,
    s3Bucket,
    s3Key,
  }
}
// See https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/aws-lambda/trigger
export const handler = async (event: SNSEvent, context: Context) => {
  const requestLogger = logger.child({ requestId: context.awsRequestId });
  requestLogger.debug({ event, context });

  // For event structure, see https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-content-structure.html
  const s3Event: S3Event = JSON.parse(event.Records[0]!.Sns.Message);
  
  // Derive details
  const {
    eventName,
    fileType,
    fileSubType,
    fileName,
    fileDomainName,
    fileEventDate,
    fileCreatedTimestamp,
    fileSize,
    s3Bucket,
    s3Key,
  } = deriveEventDetails(s3Event);
  requestLogger.debug({ eventName, fileType, fileSubType, fileName, fileDomainName, fileEventDate, fileCreatedTimestamp, fileSize, s3Bucket, s3Key });

  try {
    if (eventName === 'ObjectCreated') {
      const createResult = await createObjectEntry({
        fileType,
        fileSubType,
        fileName,
        fileDomainName,
        fileEventDate,
        fileCreatedTimestamp,
        fileSize,
        s3Bucket,
        s3Key,
      });
      requestLogger.debug({ createResult });
    } else if (eventName === 'ObjectRemoved') {
      const deleteResult = await deleteObjectEntry({
        fileType,
        fileEventDate,
        fileName,
        fileDomainName,
      });
      requestLogger.debug({ deleteResult });
    } else {
      throw Error(`S3 Event Name mismatch: Got ${eventName}`);
    }
  } catch (err) {
    requestLogger.error(err);
    throw Error(err);
  }
}
