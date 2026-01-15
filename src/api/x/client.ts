/**
 * X (Twitter) API v2 client with OAuth 1.0a authentication.
 *
 * Provides a foundation for all X API operations including:
 * - OAuth 1.0a signature generation
 * - Rate limit tracking from response headers
 * - Request/response logging for debugging
 * - Sandbox mode support for testing
 * - API tier limit awareness
 */

import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import { XAPIError, NetworkError } from '@/utils/errors.js';

// ============================================================================
// Types
// ============================================================================

/**
 * X API client configuration.
 */
export interface XClientConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  sandbox?: boolean;
  apiTierLimits?: {
    postsPerMonth: number;
    readsPerMonth: number;
    requestsPer15Min: number;
  };
  onRequest?: (info: RequestLogInfo) => void;
  onResponse?: (info: ResponseLogInfo) => void;
}

/**
 * Rate limit information for an endpoint.
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Request log information.
 */
export interface RequestLogInfo {
  method: string;
  endpoint: string;
  timestamp: string;
  params?: Record<string, string>;
  hasBody: boolean;
}

/**
 * Response log information.
 */
export interface ResponseLogInfo {
  endpoint: string;
  status: 'success' | 'error';
  statusCode?: number;
  rateLimitRemaining?: number;
  timestamp: string;
  durationMs: number;
}

/**
 * API usage statistics.
 */
export interface UsageStats {
  postsThisMonth: number;
  readsThisMonth: number;
  monthStart: string;
}

/**
 * API tier limits.
 */
export interface ApiTierLimits {
  postsPerMonth: number;
  readsPerMonth: number;
  requestsPer15Min: number;
}

/**
 * Options for posting a tweet.
 */
export interface PostOptions {
  mediaIds?: string[];
  replyTo?: string;
  quoteTweetId?: string;
}

/**
 * Tweet data returned from API.
 */
export interface Tweet {
  id: string;
  text: string;
}

/**
 * Thread result containing multiple tweets.
 */
export interface ThreadResult {
  rootId: string;
  tweets: Tweet[];
}

/**
 * Delete result.
 */
export interface DeleteResult {
  deleted: boolean;
}

/**
 * Extended tweet data with optional fields.
 */
export interface TweetData {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    impression_count?: number;
  };
  conversation_id?: string;
  in_reply_to_user_id?: string;
  referenced_tweets?: Array<{ type: string; id: string }>;
}

/**
 * Timeline/list response with pagination.
 */
export interface TimelineResponse {
  tweets: TweetData[];
  nextToken?: string;
  hasMore: boolean;
}

/**
 * Options for timeline requests.
 */
export interface TimelineOptions {
  maxResults?: number;
  paginationToken?: string;
  sinceId?: string;
  tweetFields?: string[];
  expansions?: string[];
}

/**
 * Options for getting a single tweet.
 */
export interface GetTweetOptions {
  tweetFields?: string[];
  expansions?: string[];
  skipCache?: boolean;
}

/**
 * Options for searching tweets.
 */
export interface SearchOptions {
  maxResults?: number;
  paginationToken?: string;
  tweetFields?: string[];
  sortOrder?: 'recency' | 'relevancy';
}

/**
 * Trending topic data.
 */
export interface TrendingTopic {
  name: string;
  tweet_volume: number | null;
  url: string;
}

/**
 * Trending topics response.
 */
export interface TrendingResponse {
  trends: TrendingTopic[];
  location: string;
  woeid: number;
}

/**
 * Like operation result.
 */
export interface LikeResult {
  liked: boolean;
}

/**
 * Retweet operation result.
 */
export interface RetweetResult {
  retweeted: boolean;
}

/**
 * Follow operation result.
 */
export interface FollowResult {
  following: boolean;
  pending_follow: boolean;
}

/**
 * Unfollow operation result.
 */
export interface UnfollowResult {
  following: boolean;
}

/**
 * User data from API.
 */
export interface UserData {
  id: string;
  name: string;
  username: string;
  description?: string;
  created_at?: string;
  verified?: boolean;
  protected?: boolean;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  profile_image_url?: string;
}

/**
 * Users list response with pagination.
 */
export interface UsersListResponse {
  users: UserData[];
  nextToken?: string;
  hasMore: boolean;
}

/**
 * Options for followers/following requests.
 */
export interface UsersListOptions {
  maxResults?: number;
  paginationToken?: string;
  userFields?: string[];
}

/**
 * Options for getting a single user.
 */
export interface GetUserOptions {
  userFields?: string[];
  skipCache?: boolean;
}

/**
 * Media category for upload.
 */
export type MediaCategory = 'tweet_image' | 'tweet_gif' | 'tweet_video';

/**
 * Media upload result.
 */
export interface MediaUploadResult {
  mediaId: string;
  expiresAfterSecs?: number;
  size?: number;
  imageInfo?: {
    imageType: string;
    width: number;
    height: number;
  };
  videoInfo?: {
    videoType: string;
  };
  processingInfo?: {
    state: 'pending' | 'in_progress' | 'failed' | 'succeeded';
    checkAfterSecs?: number;
    progressPercent?: number;
  };
}

/**
 * Media processing status.
 */
export interface MediaProcessingStatus {
  state: 'pending' | 'in_progress' | 'failed' | 'succeeded';
  checkAfterSecs?: number;
  progressPercent?: number;
  error?: {
    code: number;
    name: string;
    message: string;
  };
}

/**
 * Options for waiting on media processing.
 */
export interface MediaProcessingOptions {
  maxWaitMs?: number;
  pollIntervalMs?: number;
}

/**
 * Media validation result.
 */
export interface MediaValidationResult {
  valid: boolean;
  category?: MediaCategory;
  error?: string;
}

// Supported media types and their limits
const MEDIA_TYPE_CONFIG: Record<string, { category: MediaCategory; maxSizeBytes: number }> = {
  'image/png': { category: 'tweet_image', maxSizeBytes: 5 * 1024 * 1024 }, // 5MB
  'image/jpeg': { category: 'tweet_image', maxSizeBytes: 5 * 1024 * 1024 },
  'image/jpg': { category: 'tweet_image', maxSizeBytes: 5 * 1024 * 1024 },
  'image/webp': { category: 'tweet_image', maxSizeBytes: 5 * 1024 * 1024 },
  'image/gif': { category: 'tweet_gif', maxSizeBytes: 15 * 1024 * 1024 }, // 15MB for GIF
  'video/mp4': { category: 'tweet_video', maxSizeBytes: 512 * 1024 * 1024 }, // 512MB for video
};

// Default API tier limits (basic tier)
const DEFAULT_API_TIER_LIMITS: ApiTierLimits = {
  postsPerMonth: 1500,
  readsPerMonth: 10000,
  requestsPer15Min: 50,
};

// ============================================================================
// XClient Class
// ============================================================================

export class XClient {
  private readonly axios: AxiosInstance;
  private readonly config: XClientConfig;
  private readonly rateLimits: Map<string, RateLimitInfo> = new Map();
  private readonly apiTierLimits: ApiTierLimits;
  private usageStats: UsageStats;
  private readonly cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private readonly cacheTTL: number = 60000; // 1 minute cache TTL

  constructor(config: XClientConfig) {
    this.config = config;
    this.apiTierLimits = config.apiTierLimits ?? { ...DEFAULT_API_TIER_LIMITS };

    // Initialize usage stats for current month
    const now = new Date();
    this.usageStats = {
      postsThisMonth: 0,
      readsThisMonth: 0,
      monthStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    };

    // Create axios instance
    this.axios = axios.create({
      baseURL: 'https://api.twitter.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Set up interceptors
    this.setupInterceptors();
  }

  /**
   * Set up request and response interceptors.
   */
  private setupInterceptors(): void {
    // Request interceptor for OAuth signing
    this.axios.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // OAuth signing is done in the request method
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for rate limit tracking
    this.axios.interceptors.response.use(
      (response) => {
        // Rate limits are tracked in the request method
        return response;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * Check if running in sandbox mode.
   */
  isSandbox(): boolean {
    return this.config.sandbox ?? false;
  }

  /**
   * Get API tier limits.
   */
  getApiTierLimits(): ApiTierLimits {
    return { ...this.apiTierLimits };
  }

  /**
   * Get current usage statistics.
   */
  getUsageStats(): UsageStats {
    // Check if we've rolled into a new month
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    if (this.usageStats.monthStart !== currentMonthStart) {
      // Reset stats for new month
      this.usageStats = {
        postsThisMonth: 0,
        readsThisMonth: 0,
        monthStart: currentMonthStart,
      };
    }

    return { ...this.usageStats };
  }

  /**
   * Get rate limit info for an endpoint.
   */
  getRateLimits(endpoint: string): RateLimitInfo | undefined {
    return this.rateLimits.get(endpoint);
  }

  /**
   * Check if an endpoint is rate limited.
   */
  isRateLimited(endpoint: string): boolean {
    const limits = this.rateLimits.get(endpoint);
    if (!limits) return false;

    // Check if remaining is 0 and reset time hasn't passed
    if (limits.remaining <= 0) {
      const now = Math.floor(Date.now() / 1000);
      return limits.reset > now;
    }

    return false;
  }

  /**
   * Generate OAuth 1.0a signature.
   */
  private generateOAuthSignature(
    method: string,
    url: string,
    params: Record<string, string>,
    oauthParams: Record<string, string>
  ): string {
    // Combine all parameters
    const allParams = { ...params, ...oauthParams };

    // Sort parameters
    const sortedKeys = Object.keys(allParams).sort();
    const paramString = sortedKeys.map((k) => `${this.percentEncode(k)}=${this.percentEncode(allParams[k])}`).join('&');

    // Create signature base string
    const signatureBaseString = [
      method.toUpperCase(),
      this.percentEncode(url),
      this.percentEncode(paramString),
    ].join('&');

    // Create signing key
    const signingKey = `${this.percentEncode(this.config.apiSecret)}&${this.percentEncode(this.config.accessTokenSecret)}`;

    // Generate HMAC-SHA1 signature
    const signature = crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');

    return signature;
  }

  /**
   * Percent encode a string per OAuth spec.
   */
  private percentEncode(str: string): string {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  }

  /**
   * Generate OAuth authorization header.
   */
  private generateOAuthHeader(method: string, fullUrl: string, params: Record<string, string> = {}): string {
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.config.apiKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: this.config.accessToken,
      oauth_version: '1.0',
    };

    // Generate signature
    const signature = this.generateOAuthSignature(method, fullUrl, params, oauthParams);
    oauthParams.oauth_signature = signature;

    // Build Authorization header
    const headerParams = Object.keys(oauthParams)
      .sort()
      .map((k) => `${this.percentEncode(k)}="${this.percentEncode(oauthParams[k])}"`)
      .join(', ');

    return `OAuth ${headerParams}`;
  }

  /**
   * Update rate limits from response headers.
   */
  private updateRateLimits(endpoint: string, headers: Record<string, string>): void {
    const limit = headers['x-rate-limit-limit'];
    const remaining = headers['x-rate-limit-remaining'];
    const reset = headers['x-rate-limit-reset'];

    if (limit && remaining && reset) {
      this.rateLimits.set(endpoint, {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
      });
    }
  }

  /**
   * Make an API request.
   */
  async request<T = unknown>(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    data?: Record<string, unknown>,
    params?: Record<string, string>
  ): Promise<T> {
    const startTime = Date.now();
    const fullUrl = `https://api.twitter.com${endpoint}`;

    // Log request if callback provided
    if (this.config.onRequest) {
      this.config.onRequest({
        method,
        endpoint,
        timestamp: new Date().toISOString(),
        params,
        hasBody: !!data,
      });
    }

    // Generate OAuth header
    const oauthHeader = this.generateOAuthHeader(method, fullUrl, params);

    try {
      let response;

      const requestConfig = {
        headers: {
          Authorization: oauthHeader,
        },
        params,
      };

      switch (method) {
        case 'GET':
          response = await this.axios.get(endpoint, requestConfig);
          this.usageStats.readsThisMonth++;
          break;
        case 'POST':
          response = await this.axios.post(endpoint, data, requestConfig);
          // Track post count for /2/tweets endpoint
          if (endpoint.includes('/2/tweets')) {
            this.usageStats.postsThisMonth++;
          }
          break;
        case 'DELETE':
          response = await this.axios.delete(endpoint, requestConfig);
          break;
      }

      // Update rate limits from headers
      if (response.headers) {
        this.updateRateLimits(endpoint, response.headers as Record<string, string>);
      }

      // Log response if callback provided
      if (this.config.onResponse) {
        this.config.onResponse({
          endpoint,
          status: 'success',
          rateLimitRemaining: this.rateLimits.get(endpoint)?.remaining,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        });
      }

      return response.data as T;
    } catch (error) {
      // Log error response if callback provided
      if (this.config.onResponse) {
        this.config.onResponse({
          endpoint,
          status: 'error',
          statusCode: (error as AxiosError).response?.status,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        });
      }

      throw this.handleError(error as AxiosError, endpoint);
    }
  }

  /**
   * Handle and transform errors.
   */
  private handleError(error: AxiosError, endpoint: string): Error {
    // Check for network errors (no response)
    if (!error.response) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code) {
        return new NetworkError(error.message, `X API ${endpoint}`, code);
      }
      return new NetworkError(error.message, `X API ${endpoint}`);
    }

    // API error with response
    const status = error.response.status;
    const data = error.response.data as Record<string, unknown>;
    const message = this.extractErrorMessage(data) || error.message;

    return new XAPIError(message, status, endpoint, data);
  }

  /**
   * Extract error message from response data.
   */
  private extractErrorMessage(data: Record<string, unknown>): string | undefined {
    // X API v2 error format
    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      const firstError = data.errors[0] as Record<string, unknown>;
      return firstError.message as string;
    }

    // Alternative format
    if (data.detail) {
      return data.detail as string;
    }

    if (data.title) {
      return data.title as string;
    }

    return undefined;
  }

  // ============================================================================
  // Posting Operations
  // ============================================================================

  /**
   * Create a single tweet.
   */
  async post(content: string, options?: PostOptions): Promise<Tweet> {
    const body: Record<string, unknown> = { text: content };

    // Add media attachments if provided
    if (options?.mediaIds && options.mediaIds.length > 0) {
      body.media = { media_ids: options.mediaIds };
    }

    // Add reply reference if provided
    if (options?.replyTo) {
      body.reply = { in_reply_to_tweet_id: options.replyTo };
    }

    // Add quote tweet reference if provided
    if (options?.quoteTweetId) {
      body.quote_tweet_id = options.quoteTweetId;
    }

    const response = await this.request<{ data: Tweet }>('POST', '/2/tweets', body);
    return response.data;
  }

  /**
   * Create a thread (multiple tweets chained as replies).
   */
  async postThread(tweets: string[]): Promise<ThreadResult> {
    if (tweets.length === 0) {
      throw new Error('Thread must contain at least one tweet');
    }

    const postedTweets: Tweet[] = [];
    let previousId: string | undefined;

    for (const tweetText of tweets) {
      const options: PostOptions = {};
      if (previousId) {
        options.replyTo = previousId;
      }

      const tweet = await this.post(tweetText, options);
      postedTweets.push(tweet);
      previousId = tweet.id;
    }

    return {
      rootId: postedTweets[0].id,
      tweets: postedTweets,
    };
  }

  /**
   * Reply to a tweet.
   */
  async reply(tweetId: string, content: string, options?: Omit<PostOptions, 'replyTo'>): Promise<Tweet> {
    if (!tweetId) {
      throw new Error('Tweet ID is required');
    }
    if (!content) {
      throw new Error('Reply content is required');
    }

    return this.post(content, {
      ...options,
      replyTo: tweetId,
    });
  }

  /**
   * Create a quote tweet.
   */
  async quoteTweet(tweetId: string, content: string, options?: Omit<PostOptions, 'quoteTweetId'>): Promise<Tweet> {
    if (!tweetId) {
      throw new Error('Tweet ID to quote is required');
    }
    if (!content) {
      throw new Error('Quote content is required');
    }

    return this.post(content, {
      ...options,
      quoteTweetId: tweetId,
    });
  }

  /**
   * Delete a tweet.
   */
  async deleteTweet(tweetId: string): Promise<DeleteResult> {
    if (!tweetId) {
      throw new Error('Tweet ID is required');
    }

    const response = await this.request<{ data: { deleted: boolean } }>('DELETE', `/2/tweets/${tweetId}`);
    return response.data;
  }

  // ============================================================================
  // Reading Operations
  // ============================================================================

  /**
   * Get user timeline (reverse chronological).
   */
  async getTimeline(userId: string, options?: TimelineOptions): Promise<TimelineResponse> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const params: Record<string, string> = {
      max_results: String(options?.maxResults ?? 10),
    };

    if (options?.paginationToken) {
      params.pagination_token = options.paginationToken;
    }

    if (options?.sinceId) {
      params.since_id = options.sinceId;
    }

    if (options?.tweetFields && options.tweetFields.length > 0) {
      params['tweet.fields'] = options.tweetFields.join(',');
    }

    if (options?.expansions && options.expansions.length > 0) {
      params.expansions = options.expansions.join(',');
    }

    interface TimelineApiResponse {
      data?: TweetData[];
      meta: {
        result_count: number;
        next_token?: string;
      };
    }

    const response = await this.request<TimelineApiResponse>('GET', `/2/users/${userId}/tweets`, undefined, params);

    return {
      tweets: response.data ?? [],
      nextToken: response.meta.next_token,
      hasMore: !!response.meta.next_token,
    };
  }

  /**
   * Get mentions for a user.
   */
  async getMentions(userId: string, options?: TimelineOptions): Promise<TimelineResponse> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const params: Record<string, string> = {
      max_results: String(options?.maxResults ?? 10),
    };

    if (options?.paginationToken) {
      params.pagination_token = options.paginationToken;
    }

    if (options?.sinceId) {
      params.since_id = options.sinceId;
    }

    if (options?.tweetFields && options.tweetFields.length > 0) {
      params['tweet.fields'] = options.tweetFields.join(',');
    }

    if (options?.expansions && options.expansions.length > 0) {
      params.expansions = options.expansions.join(',');
    }

    interface MentionsApiResponse {
      data?: TweetData[];
      meta: {
        result_count: number;
        next_token?: string;
      };
    }

    const response = await this.request<MentionsApiResponse>('GET', `/2/users/${userId}/mentions`, undefined, params);

    return {
      tweets: response.data ?? [],
      nextToken: response.meta.next_token,
      hasMore: !!response.meta.next_token,
    };
  }

  /**
   * Get a single tweet by ID.
   */
  async getTweet(tweetId: string, options?: GetTweetOptions): Promise<TweetData> {
    if (!tweetId) {
      throw new Error('Tweet ID is required');
    }

    // Check cache unless skipCache is specified
    const cacheKey = `tweet:${tweetId}`;
    if (!options?.skipCache) {
      const cached = this.getFromCache<TweetData>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const params: Record<string, string> = {};

    if (options?.tweetFields && options.tweetFields.length > 0) {
      params['tweet.fields'] = options.tweetFields.join(',');
    }

    if (options?.expansions && options.expansions.length > 0) {
      params.expansions = options.expansions.join(',');
    }

    interface TweetApiResponse {
      data: TweetData;
      includes?: {
        users?: Array<{ id: string; name: string; username: string }>;
      };
    }

    const response = await this.request<TweetApiResponse>(
      'GET',
      `/2/tweets/${tweetId}`,
      undefined,
      Object.keys(params).length > 0 ? params : undefined
    );

    // Cache the result
    this.setCache(cacheKey, response.data);

    return response.data;
  }

  /**
   * Search recent tweets.
   */
  async searchTweets(query: string, options?: SearchOptions): Promise<TimelineResponse> {
    if (!query) {
      throw new Error('Search query is required');
    }

    const params: Record<string, string> = {
      query,
    };

    if (options?.maxResults) {
      params.max_results = String(options.maxResults);
    }

    if (options?.paginationToken) {
      params.next_token = options.paginationToken;
    }

    if (options?.tweetFields && options.tweetFields.length > 0) {
      params['tweet.fields'] = options.tweetFields.join(',');
    }

    if (options?.sortOrder) {
      params.sort_order = options.sortOrder;
    }

    interface SearchApiResponse {
      data?: TweetData[];
      meta: {
        result_count: number;
        next_token?: string;
      };
    }

    const response = await this.request<SearchApiResponse>('GET', '/2/tweets/search/recent', undefined, params);

    return {
      tweets: response.data ?? [],
      nextToken: response.meta.next_token,
      hasMore: !!response.meta.next_token,
    };
  }

  /**
   * Get trending topics for a location.
   * Uses v1.1 API as v2 doesn't have trends endpoint.
   * @param woeid - Where On Earth ID (default: 1 for worldwide)
   */
  async getTrending(woeid = 1): Promise<TrendingResponse> {
    const params: Record<string, string> = {
      id: String(woeid),
    };

    interface TrendsApiResponse {
      trends: TrendingTopic[];
      locations: Array<{ name: string; woeid: number }>;
    }

    const response = await this.request<TrendsApiResponse[]>('GET', '/1.1/trends/place.json', undefined, params);

    const data = response[0];
    return {
      trends: data.trends,
      location: data.locations[0].name,
      woeid: data.locations[0].woeid,
    };
  }

  // ============================================================================
  // Engagement Operations
  // ============================================================================

  /**
   * Like a tweet.
   */
  async like(userId: string, tweetId: string): Promise<LikeResult> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!tweetId) {
      throw new Error('Tweet ID is required');
    }

    const response = await this.request<{ data: LikeResult }>(
      'POST',
      `/2/users/${userId}/likes`,
      { tweet_id: tweetId }
    );

    return response.data;
  }

  /**
   * Unlike a tweet.
   */
  async unlike(userId: string, tweetId: string): Promise<LikeResult> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!tweetId) {
      throw new Error('Tweet ID is required');
    }

    const response = await this.request<{ data: LikeResult }>(
      'DELETE',
      `/2/users/${userId}/likes/${tweetId}`
    );

    return response.data;
  }

  /**
   * Retweet a tweet.
   */
  async retweet(userId: string, tweetId: string): Promise<RetweetResult> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!tweetId) {
      throw new Error('Tweet ID is required');
    }

    const response = await this.request<{ data: RetweetResult }>(
      'POST',
      `/2/users/${userId}/retweets`,
      { tweet_id: tweetId }
    );

    return response.data;
  }

  /**
   * Unretweet a tweet.
   */
  async unretweet(userId: string, tweetId: string): Promise<RetweetResult> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!tweetId) {
      throw new Error('Tweet ID is required');
    }

    const response = await this.request<{ data: RetweetResult }>(
      'DELETE',
      `/2/users/${userId}/retweets/${tweetId}`
    );

    return response.data;
  }

  /**
   * Follow a user.
   */
  async follow(sourceUserId: string, targetUserId: string): Promise<FollowResult> {
    if (!sourceUserId) {
      throw new Error('Source user ID is required');
    }
    if (!targetUserId) {
      throw new Error('Target user ID is required');
    }

    const response = await this.request<{ data: FollowResult }>(
      'POST',
      `/2/users/${sourceUserId}/following`,
      { target_user_id: targetUserId }
    );

    return response.data;
  }

  /**
   * Unfollow a user.
   */
  async unfollow(sourceUserId: string, targetUserId: string): Promise<UnfollowResult> {
    if (!sourceUserId) {
      throw new Error('Source user ID is required');
    }
    if (!targetUserId) {
      throw new Error('Target user ID is required');
    }

    const response = await this.request<{ data: UnfollowResult }>(
      'DELETE',
      `/2/users/${sourceUserId}/following/${targetUserId}`
    );

    return response.data;
  }

  /**
   * Get a user's followers.
   */
  async getFollowers(userId: string, options?: UsersListOptions): Promise<UsersListResponse> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const params: Record<string, string> = {
      max_results: String(options?.maxResults ?? 100),
    };

    if (options?.paginationToken) {
      params.pagination_token = options.paginationToken;
    }

    if (options?.userFields && options.userFields.length > 0) {
      params['user.fields'] = options.userFields.join(',');
    }

    interface FollowersApiResponse {
      data?: UserData[];
      meta: {
        result_count: number;
        next_token?: string;
      };
    }

    const response = await this.request<FollowersApiResponse>(
      'GET',
      `/2/users/${userId}/followers`,
      undefined,
      params
    );

    return {
      users: response.data ?? [],
      nextToken: response.meta.next_token,
      hasMore: !!response.meta.next_token,
    };
  }

  /**
   * Get users that a user is following.
   */
  async getFollowing(userId: string, options?: UsersListOptions): Promise<UsersListResponse> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const params: Record<string, string> = {
      max_results: String(options?.maxResults ?? 100),
    };

    if (options?.paginationToken) {
      params.pagination_token = options.paginationToken;
    }

    if (options?.userFields && options.userFields.length > 0) {
      params['user.fields'] = options.userFields.join(',');
    }

    interface FollowingApiResponse {
      data?: UserData[];
      meta: {
        result_count: number;
        next_token?: string;
      };
    }

    const response = await this.request<FollowingApiResponse>(
      'GET',
      `/2/users/${userId}/following`,
      undefined,
      params
    );

    return {
      users: response.data ?? [],
      nextToken: response.meta.next_token,
      hasMore: !!response.meta.next_token,
    };
  }

  // ============================================================================
  // User Operations
  // ============================================================================

  /**
   * Get the authenticated user's information.
   */
  async getMe(options?: GetUserOptions): Promise<UserData> {
    // Check cache unless skipCache is specified
    const cacheKey = 'user:me';
    if (!options?.skipCache) {
      const cached = this.getFromCache<UserData>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const params: Record<string, string> = {};

    if (options?.userFields && options.userFields.length > 0) {
      params['user.fields'] = options.userFields.join(',');
    }

    interface UserApiResponse {
      data: UserData;
    }

    const response = await this.request<UserApiResponse>(
      'GET',
      '/2/users/me',
      undefined,
      Object.keys(params).length > 0 ? params : undefined
    );

    // Cache the result (both as 'me' and by ID)
    this.setCache(cacheKey, response.data);
    this.setCache(`user:${response.data.id}`, response.data);
    this.setCache(`user:username:${response.data.username}`, response.data);

    return response.data;
  }

  /**
   * Get a user by their ID.
   */
  async getUser(userId: string, options?: GetUserOptions): Promise<UserData> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Check cache unless skipCache is specified
    const cacheKey = `user:${userId}`;
    if (!options?.skipCache) {
      const cached = this.getFromCache<UserData>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const params: Record<string, string> = {};

    if (options?.userFields && options.userFields.length > 0) {
      params['user.fields'] = options.userFields.join(',');
    }

    interface UserApiResponse {
      data: UserData;
    }

    const response = await this.request<UserApiResponse>(
      'GET',
      `/2/users/${userId}`,
      undefined,
      Object.keys(params).length > 0 ? params : undefined
    );

    // Cache the result (by ID and username)
    this.setCache(cacheKey, response.data);
    this.setCache(`user:username:${response.data.username}`, response.data);

    return response.data;
  }

  /**
   * Get a user by their username.
   */
  async getUserByUsername(username: string, options?: GetUserOptions): Promise<UserData> {
    if (!username) {
      throw new Error('Username is required');
    }

    // Check cache unless skipCache is specified
    const cacheKey = `user:username:${username}`;
    if (!options?.skipCache) {
      const cached = this.getFromCache<UserData>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const params: Record<string, string> = {};

    if (options?.userFields && options.userFields.length > 0) {
      params['user.fields'] = options.userFields.join(',');
    }

    interface UserApiResponse {
      data: UserData;
    }

    const response = await this.request<UserApiResponse>(
      'GET',
      `/2/users/by/username/${username}`,
      undefined,
      Object.keys(params).length > 0 ? params : undefined
    );

    // Cache the result (by ID and username)
    this.setCache(`user:${response.data.id}`, response.data);
    this.setCache(cacheKey, response.data);

    return response.data;
  }

  /**
   * Get multiple users by their IDs (batch lookup).
   * Maximum 100 user IDs per request.
   */
  async getUsers(userIds: string[], options?: Omit<GetUserOptions, 'skipCache'>): Promise<UserData[]> {
    if (!userIds || userIds.length === 0) {
      throw new Error('At least one user ID is required');
    }

    if (userIds.length > 100) {
      throw new Error('Maximum 100 user IDs allowed per request');
    }

    const params: Record<string, string> = {
      ids: userIds.join(','),
    };

    if (options?.userFields && options.userFields.length > 0) {
      params['user.fields'] = options.userFields.join(',');
    }

    interface UsersApiResponse {
      data?: UserData[];
      errors?: Array<{ resource_id: string; detail: string }>;
    }

    const response = await this.request<UsersApiResponse>(
      'GET',
      '/2/users',
      undefined,
      params
    );

    const users = response.data ?? [];

    // Cache each user individually
    for (const user of users) {
      this.setCache(`user:${user.id}`, user);
      this.setCache(`user:username:${user.username}`, user);
    }

    return users;
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Get item from cache if still valid.
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Set item in cache.
   */
  private setCache(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cached data.
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ============================================================================
  // Media Operations
  // ============================================================================

  /**
   * Validate a media file before upload.
   */
  validateMediaFile(mimeType: string, sizeBytes: number): MediaValidationResult {
    if (sizeBytes === 0) {
      return { valid: false, error: 'Media file is empty' };
    }

    const config = MEDIA_TYPE_CONFIG[mimeType];
    if (!config) {
      return { valid: false, error: `Unsupported media type: ${mimeType}` };
    }

    if (sizeBytes > config.maxSizeBytes) {
      const maxSizeMB = Math.round(config.maxSizeBytes / (1024 * 1024));
      return { valid: false, error: `File size exceeds maximum of ${maxSizeMB}MB for ${mimeType}` };
    }

    return { valid: true, category: config.category };
  }

  /**
   * Upload media using the v1.1 chunked upload endpoint.
   * Follows INIT -> APPEND (chunked) -> FINALIZE flow.
   */
  async uploadMedia(
    data: Buffer,
    mimeType: string,
    category?: MediaCategory
  ): Promise<MediaUploadResult> {
    // Validate input
    if (!data || data.length === 0) {
      throw new Error('Media data is required');
    }

    const validation = this.validateMediaFile(mimeType, data.length);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const mediaCategory = category ?? validation.category!;
    const chunkSize = 1024 * 1024; // 1MB chunks

    // INIT: Initialize the upload
    const mediaId = await this.mediaUploadInit(data.length, mimeType, mediaCategory);

    // APPEND: Upload chunks
    let segmentIndex = 0;
    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const chunk = data.subarray(offset, Math.min(offset + chunkSize, data.length));
      await this.mediaUploadAppend(mediaId, chunk, segmentIndex);
      segmentIndex++;
    }

    // FINALIZE: Complete the upload
    const finalResult = await this.mediaUploadFinalize(mediaId);

    return finalResult;
  }

  /**
   * INIT command for chunked media upload.
   */
  private async mediaUploadInit(
    totalBytes: number,
    mimeType: string,
    category: MediaCategory
  ): Promise<string> {
    const body = `command=INIT&total_bytes=${totalBytes}&media_type=${encodeURIComponent(mimeType)}&media_category=${category}`;

    const response = await this.mediaRequest<{ media_id_string: string }>('POST', body);

    return response.media_id_string;
  }

  /**
   * APPEND command for chunked media upload.
   */
  private async mediaUploadAppend(
    mediaId: string,
    chunk: Buffer,
    segmentIndex: number
  ): Promise<void> {
    const base64Chunk = chunk.toString('base64');
    const body = `command=APPEND&media_id=${mediaId}&segment_index=${segmentIndex}&media_data=${encodeURIComponent(base64Chunk)}`;

    await this.mediaRequest<null>('POST', body);
  }

  /**
   * FINALIZE command for chunked media upload.
   */
  private async mediaUploadFinalize(mediaId: string): Promise<MediaUploadResult> {
    const body = `command=FINALIZE&media_id=${mediaId}`;

    interface FinalizeResponse {
      media_id_string: string;
      size?: number;
      expires_after_secs?: number;
      image?: { image_type: string; w: number; h: number };
      video?: { video_type: string };
      processing_info?: {
        state: 'pending' | 'in_progress' | 'failed' | 'succeeded';
        check_after_secs?: number;
        progress_percent?: number;
      };
    }

    const response = await this.mediaRequest<FinalizeResponse>('POST', body);

    const result: MediaUploadResult = {
      mediaId: response.media_id_string,
      expiresAfterSecs: response.expires_after_secs,
      size: response.size,
    };

    if (response.image) {
      result.imageInfo = {
        imageType: response.image.image_type,
        width: response.image.w,
        height: response.image.h,
      };
    }

    if (response.video) {
      result.videoInfo = {
        videoType: response.video.video_type,
      };
    }

    if (response.processing_info) {
      result.processingInfo = {
        state: response.processing_info.state,
        checkAfterSecs: response.processing_info.check_after_secs,
        progressPercent: response.processing_info.progress_percent,
      };
    }

    return result;
  }

  /**
   * Make a request to the media upload endpoint.
   * Uses application/x-www-form-urlencoded content type.
   */
  private async mediaRequest<T>(method: 'POST' | 'GET', body?: string, params?: Record<string, string>): Promise<T> {
    const startTime = Date.now();
    const endpoint = '/1.1/media/upload.json';
    const fullUrl = `https://upload.twitter.com${endpoint}`;

    // Log request if callback provided
    if (this.config.onRequest) {
      this.config.onRequest({
        method,
        endpoint,
        timestamp: new Date().toISOString(),
        params,
        hasBody: !!body,
      });
    }

    // Generate OAuth header
    const oauthHeader = this.generateOAuthHeader(method, fullUrl, params);

    try {
      let response;

      const requestConfig = {
        baseURL: 'https://upload.twitter.com',
        headers: {
          Authorization: oauthHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        params,
      };

      if (method === 'POST') {
        response = await this.axios.post(endpoint, body, requestConfig);
      } else {
        response = await this.axios.get(endpoint, requestConfig);
      }

      // Update rate limits from headers
      if (response.headers) {
        this.updateRateLimits(endpoint, response.headers as Record<string, string>);
      }

      // Log response if callback provided
      if (this.config.onResponse) {
        this.config.onResponse({
          endpoint,
          status: 'success',
          rateLimitRemaining: this.rateLimits.get(endpoint)?.remaining,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        });
      }

      return response.data as T;
    } catch (error) {
      // Log error response if callback provided
      if (this.config.onResponse) {
        this.config.onResponse({
          endpoint,
          status: 'error',
          statusCode: (error as import('axios').AxiosError).response?.status,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        });
      }

      throw this.handleError(error as import('axios').AxiosError, endpoint);
    }
  }

  /**
   * Check the processing status of uploaded media.
   */
  async checkMediaStatus(mediaId: string): Promise<MediaProcessingStatus> {
    if (!mediaId) {
      throw new Error('Media ID is required');
    }

    interface StatusResponse {
      media_id_string: string;
      processing_info: {
        state: 'pending' | 'in_progress' | 'failed' | 'succeeded';
        check_after_secs?: number;
        progress_percent?: number;
        error?: {
          code: number;
          name: string;
          message: string;
        };
      };
    }

    const params = { command: 'STATUS', media_id: mediaId };
    const response = await this.mediaRequest<StatusResponse>('GET', undefined, params);

    return {
      state: response.processing_info.state,
      checkAfterSecs: response.processing_info.check_after_secs,
      progressPercent: response.processing_info.progress_percent,
      error: response.processing_info.error,
    };
  }

  /**
   * Wait for media processing to complete.
   * Polls the status endpoint until processing succeeds, fails, or times out.
   */
  async waitForMediaProcessing(
    mediaId: string,
    options?: MediaProcessingOptions
  ): Promise<MediaProcessingStatus> {
    if (!mediaId) {
      throw new Error('Media ID is required');
    }

    const maxWaitMs = options?.maxWaitMs ?? 60000; // Default 60 seconds
    const pollIntervalMs = options?.pollIntervalMs ?? 1000; // Default 1 second

    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkMediaStatus(mediaId);

      if (status.state === 'succeeded') {
        return status;
      }

      if (status.state === 'failed') {
        const errorMsg = status.error?.message ?? 'Unknown error';
        throw new Error(`Media processing failed: ${errorMsg}`);
      }

      // Wait before polling again
      const waitTime = status.checkAfterSecs
        ? Math.min(status.checkAfterSecs * 1000, pollIntervalMs)
        : pollIntervalMs;

      await this.sleep(waitTime);
    }

    throw new Error('Media processing timeout');
  }

  /**
   * Sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton and Factory
// ============================================================================

let defaultClient: XClient | null = null;

/**
 * Get the default X API client instance.
 */
export function getXClient(config: XClientConfig): XClient {
  if (!defaultClient) {
    defaultClient = new XClient(config);
  }
  return defaultClient;
}

/**
 * Reset the X API client singleton.
 */
export function resetXClient(): void {
  defaultClient = null;
}

/**
 * Create X client config from environment variables.
 */
export function createConfigFromEnv(sandbox = false): XClientConfig {
  if (sandbox) {
    return {
      apiKey: process.env.X_SANDBOX_API_KEY ?? '',
      apiSecret: process.env.X_SANDBOX_API_SECRET ?? '',
      accessToken: process.env.X_SANDBOX_ACCESS_TOKEN ?? '',
      accessTokenSecret: process.env.X_SANDBOX_ACCESS_TOKEN_SECRET ?? '',
      sandbox: true,
    };
  }

  return {
    apiKey: process.env.X_API_KEY ?? '',
    apiSecret: process.env.X_API_SECRET ?? '',
    accessToken: process.env.X_ACCESS_TOKEN ?? '',
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET ?? '',
    sandbox: false,
  };
}
