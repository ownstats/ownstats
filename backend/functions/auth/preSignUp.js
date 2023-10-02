import Logger from '../../utils/logger';

// Instantiate logger
const logger = new Logger();

export const handler = async (event, context) => {
  // Setup logger
  const requestLogger = logger.child({ requestId: context.awsRequestId });
  requestLogger.debug({ event, context });

  event.response.autoConfirmUser = true
  return event
}
