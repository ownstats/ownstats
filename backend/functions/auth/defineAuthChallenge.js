import { MAX_ATTEMPTS } from '../../utils/constants';
import Logger from '../../utils/logger';

// Instantiate logger
const logger = new Logger();

export const handler = async (event, context) => {
  // Setup logger
  const requestLogger = logger.child({ requestId: context.awsRequestId });
  requestLogger.debug({ event, context });

  const attempts = event.request.session.length
  const lastAttempt = event.request.session[event.request.session.length-1]

  if (event.request.session &&
      event.request.session.find(attempt => attempt.challengeName !== 'CUSTOM_CHALLENGE')) {
      // Should never happen, but in case we get anything other
      // than a custom challenge, then something's wrong and we
      // should abort
      event.response.issueTokens = false
      event.response.failAuthentication = true
  } else if (attempts >= MAX_ATTEMPTS && lastAttempt.challengeResult === false) {
      // The user given too many wrong answers in a row
      event.response.issueTokens = false
      event.response.failAuthentication = true
  } else if (attempts >= 1 &&
      lastAttempt.challengeName === 'CUSTOM_CHALLENGE' &&
      lastAttempt.challengeResult === true) {
      // Right answer
      event.response.issueTokens = true
      event.response.failAuthentication = false
  } else {
      // Wrong answer, try again
      event.response.issueTokens = false
      event.response.failAuthentication = false
      event.response.challengeName = 'CUSTOM_CHALLENGE'
  }

  return event
}
