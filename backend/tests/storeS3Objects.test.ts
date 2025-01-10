import { join } from 'path';
import { readFileSync } from 'fs';
import { deriveEventDetails } from '../functions/eventing/storeS3Objects'; 

const incomingData = JSON.parse(readFileSync(join(__dirname, './data', 'snsS3Event.incoming.json'), { encoding: 'utf-8' }));
const aggregatedData = JSON.parse(readFileSync(join(__dirname, './data', 'snsS3Event.aggregated.json'), { encoding: 'utf-8' }));

test('parse incoming S3 event data correctly', () => {
  const parsedResult = deriveEventDetails(JSON.parse(incomingData.Records[0].Sns.Message));
  const expectedResult = {
    eventName: 'ObjectCreated',
    fileType: 'cleaned',
    fileSubType: 'pageview',
    fileName: 'ownstats-delivery-stream-prd-1-2022-11-29-22-26-24-427d939e-74e3-3621-b77c-372853e0751c.parquet',
    fileDomainName: 'mydomain.com',
    fileEventDate: '2022-11-29',
    fileCreatedTimestamp: '2023-04-18T01:24:48.724Z',
    fileSize: 9999,
    s3Bucket: 'mybucket-prd',
    s3Key: 'incoming/domain_name=mydomain.com/event_type=pageview/event_date=2022-11-29/ownstats-delivery-stream-prd-1-2022-11-29-22-26-24-427d939e-74e3-3621-b77c-372853e0751c.parquet'
  };
  expect(parsedResult).toStrictEqual(expectedResult);
});

test('parse aggregated S3 event data correctly', () => {
  const parsedResult = deriveEventDetails(JSON.parse(aggregatedData.Records[0].Sns.Message));
  const expectedResult = {
    eventName: 'ObjectCreated',
    fileType: 'curated',
    fileSubType: 'stats',
    fileName: 'data_0.parquet',
    fileDomainName: 'mydomain.com',
    fileEventDate: '2022-11-29',
    fileCreatedTimestamp: '2023-04-18T01:24:48.724Z',
    fileSize: 9999,
    s3Bucket: 'mybucket-prd',
    s3Key: 'aggregated/stats/domain_name=mydomain.com/event_date=2022-11-29/data_0.parquet'
  }

  expect(parsedResult).toStrictEqual(expectedResult);
});
