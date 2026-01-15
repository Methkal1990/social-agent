/**
 * X (Twitter) API client module.
 *
 * @module api/x
 */

export {
  XClient,
  getXClient,
  resetXClient,
  createConfigFromEnv,
  type XClientConfig,
  type RateLimitInfo,
  type RequestLogInfo,
  type ResponseLogInfo,
  type UsageStats,
  type ApiTierLimits,
  type PostOptions,
  type Tweet,
  type ThreadResult,
  type DeleteResult,
  type TweetData,
  type TimelineResponse,
  type TimelineOptions,
  type GetTweetOptions,
  type SearchOptions,
  type TrendingTopic,
  type TrendingResponse,
} from './client.js';
