import corsHeaders from '../utils/cors';
import Logger from '../utils/logger';
import { listDomains } from '../utils/domains';
import { APIGatewayProxyEventV2, Context } from 'aws-lambda';

// Instantiate logger
const logger = new Logger().getInstance();

// eslint-disable-next-line import/prefer-default-export
export const handler = async (event: APIGatewayProxyEventV2, context: Context) => {
  const requestLogger = logger.child({ requestId: context.awsRequestId });
  requestLogger.debug({ event, context });

  try {
    // Get organization domains from database
    const domains = await listDomains();
    requestLogger.debug({ domains });

    if (domains.length > 0) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(domains),
      }
    } else {
      return {
        statusCode: 404,
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
