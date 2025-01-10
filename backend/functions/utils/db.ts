import { DynamoDB } from 'aws-sdk';

const {
  AWS_REGION,
} = process.env;

let dynamoDbClient: DynamoDB.DocumentClient | null = null;

export function getClient (): DynamoDB.DocumentClient {
  if (!dynamoDbClient || dynamoDbClient === null) {
    dynamoDbClient = new DynamoDB.DocumentClient({
      apiVersion: '2012-08-10',
      region: AWS_REGION,
      convertEmptyValues: true,
    });
  }
  return dynamoDbClient;
}
