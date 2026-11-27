/**
 * Why a request of the web server to the API failed
 */
export enum APIErrorCodeEnum {
  API_UNAVAILABLE = 'API_UNAVAILABLE',
  API_TIMEOUT = 'API_TIMEOUT',
  API_ERROR = 'API_ERROR',
  API_NOT_FOUND = 'API_NOT_FOUND',
  API_INVALID_ANSWER = 'API_INVALID_ANSWER'
}
