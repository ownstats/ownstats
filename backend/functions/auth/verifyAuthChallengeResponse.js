import Logger from '../../utils/logger';

// Instantiate logger
const logger = new Logger();

export const handler = async (event, context) => {
  // Setup logger
  const requestLogger = logger.child({ requestId: context.awsRequestId });
  requestLogger.debug({ event, context });
  
  const expectedAnswer = event?.request?.privateChallengeParameters?.secretLoginCode
  if (event.request.challengeAnswer === expectedAnswer) {
    event.response.answerCorrect = true
  } else {
    event.response.answerCorrect = false
  }
  
  return event
}
