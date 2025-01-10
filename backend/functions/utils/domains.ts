import { getClient } from './db';
import Logger from './logger';

export type DomainResult = {
  domainName: string;
  domainKey: string;
  createdTimestamp: string;
}

const {
  TABLE_NAME,
} = process.env;

// Instantiate logger
const logger = new Logger().getInstance();

export async function createDomain (domainName: string) {
  const timestamp = new Date().toISOString();

  let params = {
    TableName: TABLE_NAME!,
    Item: {
      partitionKey: `domains`,
      sortKey: `domain#${domainName}`,
      domainName,
      domainKey: Math.random().toString(36).substr(2, 16),
      createdTimestamp: timestamp,
    },
  };

  logger.debug({ params });
  
  const createResponse = await getClient().put(params).promise();
  return createResponse;
}

export async function getDomain (domainName: string): Promise<DomainResult | null> {
  const getResponse = await getClient().get({
    TableName: TABLE_NAME!,
    Key: {
      partitionKey: `domains`,
      sortKey: `domain#${domainName}`,
    }
  }).promise();

  // Check result
  let response: DomainResult | null = null;
  if (getResponse.Item && Object.keys(getResponse.Item).length > 0) {
    delete getResponse.Item.partitionKey;
    delete getResponse.Item.sortKey;
    response = getResponse.Item as DomainResult;
  }
  return response;
}

export async function deleteDomain (domainName: string): Promise<void> {
  const ddbParams = {
    TableName: TABLE_NAME!,
    Key:{
      partitionKey: `domains`,
      sortKey: `domain#${domainName}`,
    },
  };

  await getClient().delete(ddbParams).promise();
  return;
}

export async function listDomains (): Promise<DomainResult[]> {
  const params = {
    TableName: TABLE_NAME!,
    KeyConditionExpression: 'partitionKey = :defaultPk and begins_with(sortKey, :defaultDomain)',
    ExpressionAttributeValues: {
      ':defaultPk': 'domains',
      ':defaultDomain': 'domain#',
    }
  };

  const ddbResult = await getClient().query(params).promise();

  if (ddbResult && ddbResult.Items && ddbResult.Items.length) {
    return ddbResult.Items.map((item) => {
      return {
        domainName: item.domainName,
        domainKey: item.domainKey,
        createdTimestamp: item.createdTimestamp,
      } as DomainResult
    }).sort((a: DomainResult, b: DomainResult) => a.domainName > b.domainName ? -1 : 0)
  } else {
    return []
  }
}
