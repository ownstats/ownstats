type CorsHeaders = {
  [header: string]: string;
}

export default {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'DELETE, POST, GET, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, X-Amz-User-Agent',
} as CorsHeaders
