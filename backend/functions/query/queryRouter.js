import { Lambda } from 'aws-sdk';
import { metricScope, Unit } from 'aws-embedded-metrics';
import corsHeaders from '../../lib/cors';
import Logger from '../../lib/logger';
import { getQueryBackendMapping, getQueryBackends } from '../../lib/organization';

// Instantiate logger
const logger = new Logger();

// Instantiate Lambda
const lambda = new Lambda({ region: process.env.AWS_REGION });

// eslint-disable-next-line import/prefer-default-export
export const handler = metricScope(metrics => async (event, context) => {
  // Setup logger
  const requestLogger = logger.child({ requestId: context.awsrequestId });
  requestLogger.debug({ event, context });

  // Setup metrics
  metrics.putDimensions({ Service: 'QueryRouterService' });
  metrics.setProperty('RequestId', context.awsRequestId);

  // Get user credentials from authorizer passed in the event's request context
  const userCredentials = JSON.parse(event.requestContext.authorizer.userData);

  // Get Organization id
  const organizationId = userCredentials.organizationId;

  // Get domain name
  const domainName = event.pathParameters.domainName;

  // Get body
  const body = JSON.parse(event.body);

  // Store function name to execute the query in
  let functionName = '';

  try {
    const backendFindingStartTimestamp = new Date().getTime();

    // Get query backend
    const queryBackendFunction = await getQueryBackendMapping(organizationId, domainName);
    requestLogger.debug({ queryBackendFunction });

    // If no query backend mapping exists, choose a random query backend function
    if (!queryBackendFunction) {
      // Get query backend functions
      const queryBackendFunctions = await getQueryBackends();
      requestLogger.debug({ queryBackendFunctions });

      const chosenQueryBackendFunction = queryBackendFunctions[Math.floor(Math.random() * queryBackendFunctions.length)]
      requestLogger.debug({ chosenQueryBackendFunction });

      // Assign function
      functionName = chosenQueryBackendFunction;
    } else {
      // Assign function
      functionName = queryBackendFunction;
    }

    metrics.putMetric('BackendFindingDuration', (new Date().getTime() - backendFindingStartTimestamp), Unit.Milliseconds);

    const invokeParams = {
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        organizationId,
        domainName,
        ...body,
        // queryName: 'Pageviews',
        // queryParameters: {
        //   startDate: '2022-12-01',
        //   endDate: '2022-12-31',
        // }
      }),
    };
    requestLogger.debug({ invokeParams });

    const backendQueryStartTimestamp = new Date().getTime();

    // Run query
    const queryResult = await lambda.invoke(invokeParams).promise();
    requestLogger.debug({ queryResult });

    metrics.putMetric('BackendQueryExecutionDuration', (new Date().getTime() - backendQueryStartTimestamp), Unit.Milliseconds);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: queryResult.Payload, // Payload is already stringified!
    }
  } catch (err) {
    requestLogger.error(err);
    return {
      statusCode: 500,
      headers: corsHeaders,
    }
  }
})
