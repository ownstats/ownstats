import dayjs from 'dayjs';
import { getClient } from './db';

type Files = string[];

const {
  TABLE_NAME,
} = process.env;

export async function listFiles (): Promise<Files> {
  const todayDate = dayjs().format('YYYY-MM-DD');
  const params = {
    TableName: TABLE_NAME!,
    IndexName: 'event-date-index',
    KeyConditionExpression: 'fileEventDate = :currentDate and begins_with(s3Key, :s3KeyPrefix)',
    ExpressionAttributeValues: {
      ':currentDate': `${todayDate}`,
      ':s3KeyPrefix': `aggregated/daily-stats/event_date=${todayDate}`,
    }
  };

  const ddbResult = await getClient().query(params).promise();

  if (ddbResult && ddbResult.Items && ddbResult.Items.length) {
    const files: Files = ddbResult.Items.map((item) => {
      return item.s3Key as string;
    });
    return files;
  } else {
    return []
  }
}
