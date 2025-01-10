import corsHeaders from '../utils/cors';
import Logger from '../utils/logger';
import { createDomain } from '../utils/domains';
import { APIGatewayProxyEventV2, Context } from 'aws-lambda';

// Instantiate logger
const logger = new Logger().getInstance();

// eslint-disable-next-line import/prefer-default-export
export const handler = async (event: APIGatewayProxyEventV2, context: Context) => {
  const requestLogger = logger.child({ requestId: context.awsRequestId });
  requestLogger.debug({ event, context });

  try {
    if (event.body) {
      // Get body
      const body = JSON.parse(event.body);

      // Create domain for organization in DynamoDB
      const domainCreateResult = await createDomain(body.domainName);
      requestLogger.debug({ domainCreateResult });

      return {
        statusCode: 200,
        headers: corsHeaders,
      }
    } else {
      return {
        statusCode: 400,
        headers: corsHeaders,
      }
    }
  } catch (err) {
    requestLogger.error(err);
    return {
      statusCode: 500,
      headers: corsHeaders,
    }
  }
}
