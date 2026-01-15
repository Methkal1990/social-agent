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
