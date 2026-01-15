/**
 * Analytics data storage for performance metrics.
 *
 * Provides operations for tracking post metrics, calculating aggregates,
 * and querying analytics data with Zod validation and persistence to analytics.json.
 */

import { z } from 'zod';

import { Storage, getStorage } from '@/storage/index.js';

/**
 * Post metrics schema (likes, retweets, replies, impressions).
 */
export const postMetricsSchema = z.object({
  likes: z.number().int().nonnegative(),
  retweets: z.number().int().nonnegative(),
  replies: z.number().int().nonnegative(),
  impressions: z.number().int().nonnegative(),
  collected_at: z.string(),
});
export type PostMetrics = z.infer<typeof postMetricsSchema>;

/**
 * Post analytics metadata schema.
 */
export const postAnalyticsMetadataSchema = z
  .object({
    topic: z.string().optional(),
    content_type: z.string().optional(),
    length: z.number().int().nonnegative().optional(),
    posted_hour: z.number().int().min(0).max(23).optional(),
    posted_day: z.string().optional(),
  })
  .passthrough();

/**
 * Post analytics schema.
 */
export const postAnalyticsSchema = z.object({
  id: z.string(),
  queue_id: z.union([z.string().uuid(), z.null()]),
  content: z.union([z.string(), z.array(z.string())]),
  posted_at: z.string(),
  metrics: postMetricsSchema,
  performance_score: z.number().min(0).max(1),
  metadata: postAnalyticsMetadataSchema,
});
export type PostAnalytics = z.infer<typeof postAnalyticsSchema>;

/**
 * Daily aggregate schema.
 */
export const dailyAggregateSchema = z.object({
  posts: z.number().int().nonnegative(),
  total_likes: z.number().int().nonnegative(),
  total_retweets: z.number().int().nonnegative(),
  total_replies: z.number().int().nonnegative(),
  total_impressions: z.number().int().nonnegative(),
  engagement_rate: z.number().nonnegative(),
});
export type DailyAggregate = z.infer<typeof dailyAggregateSchema>;

/**
 * Aggregates container schema.
 */
export const aggregatesSchema = z.object({
  daily: z.record(z.string(), dailyAggregateSchema),
  weekly: z.record(z.string(), dailyAggregateSchema),
  monthly: z.record(z.string(), dailyAggregateSchema),
});
export type Aggregates = z.infer<typeof aggregatesSchema>;

/**
 * Analytics data file schema.
 */
export const analyticsDataSchema = z.object({
  version: z.number().default(1),
  updated_at: z.string(),
  posts: z.array(postAnalyticsSchema),
  aggregates: aggregatesSchema,
});
export type AnalyticsData = z.infer<typeof analyticsDataSchema>;

/**
 * Input for recording new post metrics.
 */
export type PostAnalyticsInput = PostAnalytics;

/**
 * Default empty analytics data.
 */
function getDefaultAnalyticsData(): AnalyticsData {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    posts: [],
    aggregates: {
      daily: {},
      weekly: {},
      monthly: {},
    },
  };
}

/**
 * Analytics storage class for managing performance metrics.
 */
export class AnalyticsStorage {
  private readonly storage: Storage;
  private readonly filePath: string;
  private cache: AnalyticsData | null = null;

  constructor(dataDir?: string) {
    this.storage = dataDir ? new Storage(dataDir) : getStorage();
    this.filePath = this.storage.getFilePath('analytics.json');
  }

  /**
   * Load analytics data from file.
   */
  private async load(): Promise<AnalyticsData> {
    if (this.cache) {
      return this.cache;
    }

    const data = await this.storage.loadWithRecovery<AnalyticsData>(
      this.filePath,
      getDefaultAnalyticsData()
    );

    // Validate and normalize
    const parsed = analyticsDataSchema.safeParse(data);
    if (parsed.success) {
      this.cache = parsed.data;
      return parsed.data;
    }

    // Invalid data - return default
    const defaultData = getDefaultAnalyticsData();
    this.cache = defaultData;
    return defaultData;
  }

  /**
   * Save analytics data to file.
   */
  private async save(data: AnalyticsData): Promise<void> {
    data.updated_at = new Date().toISOString();
    await this.storage.safeWrite(this.filePath, data);
    this.cache = data;
  }

  /**
   * Get all analytics data.
   */
  async getAnalytics(): Promise<AnalyticsData> {
    return this.load();
  }

  /**
   * Record metrics for a posted item.
   */
  async recordPostMetrics(input: PostAnalyticsInput): Promise<PostAnalytics> {
    const data = await this.load();

    const post: PostAnalytics = { ...input };
    data.posts.push(post);
    await this.save(data);

    return post;
  }

  /**
   * Update metrics for an existing post.
   */
  async updatePostMetrics(
    id: string,
    metrics: PostMetrics,
    performanceScore?: number
  ): Promise<PostAnalytics | null> {
    const data = await this.load();
    const index = data.posts.findIndex((post) => post.id === id);

    if (index === -1) {
      return null;
    }

    data.posts[index].metrics = metrics;
    if (performanceScore !== undefined) {
      data.posts[index].performance_score = performanceScore;
    }

    await this.save(data);
    return data.posts[index];
  }

  /**
   * Get a single post by ID.
   */
  async getPost(id: string): Promise<PostAnalytics | null> {
    const data = await this.load();
    return data.posts.find((post) => post.id === id) ?? null;
  }

  /**
   * Get posts within a date range.
   */
  async getPostsByDateRange(startDate: string, endDate: string): Promise<PostAnalytics[]> {
    const data = await this.load();
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    return data.posts.filter((post) => {
      const postedAt = new Date(post.posted_at).getTime();
      return postedAt >= start && postedAt <= end;
    });
  }

  /**
   * Calculate daily aggregate for a specific date.
   * Date should be in YYYY-MM-DD format.
   */
  async calculateDailyAggregate(date: string): Promise<DailyAggregate | null> {
    const data = await this.load();

    // Filter posts for the given date
    const postsOnDate = data.posts.filter((post) => {
      const postDate = post.posted_at.slice(0, 10); // Extract YYYY-MM-DD
      return postDate === date;
    });

    if (postsOnDate.length === 0) {
      return null;
    }

    // Calculate totals
    const totalLikes = postsOnDate.reduce((sum, p) => sum + p.metrics.likes, 0);
    const totalRetweets = postsOnDate.reduce((sum, p) => sum + p.metrics.retweets, 0);
    const totalReplies = postsOnDate.reduce((sum, p) => sum + p.metrics.replies, 0);
    const totalImpressions = postsOnDate.reduce((sum, p) => sum + p.metrics.impressions, 0);

    // Calculate engagement rate
    const engagementRate =
      totalImpressions > 0
        ? (totalLikes + totalRetweets + totalReplies) / totalImpressions
        : 0;

    const aggregate: DailyAggregate = {
      posts: postsOnDate.length,
      total_likes: totalLikes,
      total_retweets: totalRetweets,
      total_replies: totalReplies,
      total_impressions: totalImpressions,
      engagement_rate: engagementRate,
    };

    // Store the aggregate
    data.aggregates.daily[date] = aggregate;
    await this.save(data);

    return aggregate;
  }
}

// Module-level singleton
let defaultAnalyticsStorage: AnalyticsStorage | null = null;

/**
 * Get the default analytics storage singleton.
 */
export function getAnalyticsStorage(dataDir?: string): AnalyticsStorage {
  if (!defaultAnalyticsStorage) {
    defaultAnalyticsStorage = new AnalyticsStorage(dataDir);
  }
  return defaultAnalyticsStorage;
}

/**
 * Reset the analytics storage singleton (for testing).
 */
export function resetAnalyticsStorage(): void {
  defaultAnalyticsStorage = null;
}
