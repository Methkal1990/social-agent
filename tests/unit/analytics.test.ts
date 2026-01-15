import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  postMetricsSchema,
  postAnalyticsSchema,
  dailyAggregateSchema,
  analyticsDataSchema,
  AnalyticsStorage,
  getAnalyticsStorage,
  resetAnalyticsStorage,
} from '@/storage/analytics.js';
import { resetStorage } from '@/storage/index.js';

describe('Analytics Schemas', () => {
  describe('postMetricsSchema', () => {
    it('should validate valid metrics', () => {
      const metrics = {
        likes: 245,
        retweets: 32,
        replies: 12,
        impressions: 5200,
        collected_at: '2024-01-15T10:00:00Z',
      };

      const result = postMetricsSchema.safeParse(metrics);
      expect(result.success).toBe(true);
    });

    it('should reject negative metrics', () => {
      const metrics = {
        likes: -5,
        retweets: 32,
        replies: 12,
        impressions: 5200,
        collected_at: '2024-01-15T10:00:00Z',
      };

      const result = postMetricsSchema.safeParse(metrics);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const metrics = {
        likes: 245,
        // missing other fields
      };

      const result = postMetricsSchema.safeParse(metrics);
      expect(result.success).toBe(false);
    });
  });

  describe('postAnalyticsSchema', () => {
    it('should validate valid post analytics', () => {
      const post = {
        id: 'tweet-123456',
        queue_id: '550e8400-e29b-41d4-a716-446655440000',
        content: 'AI productivity tip...',
        posted_at: '2024-01-14T14:00:00Z',
        metrics: {
          likes: 245,
          retweets: 32,
          replies: 12,
          impressions: 5200,
          collected_at: '2024-01-15T10:00:00Z',
        },
        performance_score: 0.85,
        metadata: {
          topic: 'AI productivity',
          content_type: 'educational',
          length: 142,
          posted_hour: 14,
          posted_day: 'sunday',
        },
      };

      const result = postAnalyticsSchema.safeParse(post);
      expect(result.success).toBe(true);
    });

    it('should reject performance_score > 1', () => {
      const post = {
        id: 'tweet-123456',
        queue_id: '550e8400-e29b-41d4-a716-446655440000',
        content: 'Test content',
        posted_at: '2024-01-14T14:00:00Z',
        metrics: {
          likes: 10,
          retweets: 5,
          replies: 2,
          impressions: 100,
          collected_at: '2024-01-15T10:00:00Z',
        },
        performance_score: 1.5,
        metadata: {},
      };

      const result = postAnalyticsSchema.safeParse(post);
      expect(result.success).toBe(false);
    });

    it('should reject performance_score < 0', () => {
      const post = {
        id: 'tweet-123456',
        queue_id: '550e8400-e29b-41d4-a716-446655440000',
        content: 'Test content',
        posted_at: '2024-01-14T14:00:00Z',
        metrics: {
          likes: 10,
          retweets: 5,
          replies: 2,
          impressions: 100,
          collected_at: '2024-01-15T10:00:00Z',
        },
        performance_score: -0.1,
        metadata: {},
      };

      const result = postAnalyticsSchema.safeParse(post);
      expect(result.success).toBe(false);
    });

    it('should allow additional metadata fields', () => {
      const post = {
        id: 'tweet-123456',
        queue_id: '550e8400-e29b-41d4-a716-446655440000',
        content: 'Test content',
        posted_at: '2024-01-14T14:00:00Z',
        metrics: {
          likes: 10,
          retweets: 5,
          replies: 2,
          impressions: 100,
          collected_at: '2024-01-15T10:00:00Z',
        },
        performance_score: 0.5,
        metadata: {
          topic: 'AI',
          custom_field: 'custom value',
          another_field: 123,
        },
      };

      const result = postAnalyticsSchema.safeParse(post);
      expect(result.success).toBe(true);
    });

    it('should allow null queue_id', () => {
      const post = {
        id: 'tweet-123456',
        queue_id: null,
        content: 'Test content',
        posted_at: '2024-01-14T14:00:00Z',
        metrics: {
          likes: 10,
          retweets: 5,
          replies: 2,
          impressions: 100,
          collected_at: '2024-01-15T10:00:00Z',
        },
        performance_score: 0.5,
        metadata: {},
      };

      const result = postAnalyticsSchema.safeParse(post);
      expect(result.success).toBe(true);
    });
  });

  describe('dailyAggregateSchema', () => {
    it('should validate valid daily aggregate', () => {
      const aggregate = {
        posts: 4,
        total_likes: 523,
        total_retweets: 45,
        total_replies: 28,
        total_impressions: 12400,
        engagement_rate: 0.034,
      };

      const result = dailyAggregateSchema.safeParse(aggregate);
      expect(result.success).toBe(true);
    });

    it('should reject negative values', () => {
      const aggregate = {
        posts: -1,
        total_likes: 523,
        total_retweets: 45,
        total_replies: 28,
        total_impressions: 12400,
        engagement_rate: 0.034,
      };

      const result = dailyAggregateSchema.safeParse(aggregate);
      expect(result.success).toBe(false);
    });
  });

  describe('analyticsDataSchema', () => {
    it('should validate analytics data structure', () => {
      const data = {
        version: 1,
        updated_at: '2024-01-15T10:30:00Z',
        posts: [],
        aggregates: {
          daily: {},
          weekly: {},
          monthly: {},
        },
      };

      const result = analyticsDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate analytics with posts and aggregates', () => {
      const data = {
        version: 1,
        updated_at: '2024-01-15T10:30:00Z',
        posts: [
          {
            id: 'tweet-123456',
            queue_id: '550e8400-e29b-41d4-a716-446655440000',
            content: 'AI productivity tip...',
            posted_at: '2024-01-14T14:00:00Z',
            metrics: {
              likes: 245,
              retweets: 32,
              replies: 12,
              impressions: 5200,
              collected_at: '2024-01-15T10:00:00Z',
            },
            performance_score: 0.85,
            metadata: {},
          },
        ],
        aggregates: {
          daily: {
            '2024-01-14': {
              posts: 4,
              total_likes: 523,
              total_retweets: 45,
              total_replies: 28,
              total_impressions: 12400,
              engagement_rate: 0.034,
            },
          },
          weekly: {},
          monthly: {},
        },
      };

      const result = analyticsDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});

describe('AnalyticsStorage', () => {
  let testDataDir: string;
  let analyticsStorage: AnalyticsStorage;

  beforeEach(() => {
    resetStorage();
    resetAnalyticsStorage();
    testDataDir = path.join(
      os.tmpdir(),
      `analytics-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    fs.mkdirSync(testDataDir, { recursive: true });
    analyticsStorage = new AnalyticsStorage(testDataDir);
  });

  afterEach(() => {
    resetStorage();
    resetAnalyticsStorage();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should create analytics storage with custom directory', () => {
      expect(analyticsStorage).toBeDefined();
    });

    it('should return empty analytics for new storage', async () => {
      const analytics = await analyticsStorage.getAnalytics();
      expect(analytics.version).toBe(1);
      expect(analytics.posts).toEqual([]);
      expect(analytics.aggregates.daily).toEqual({});
    });
  });

  describe('recordPostMetrics', () => {
    it('should record new post metrics', async () => {
      const input = {
        id: 'tweet-123456',
        queue_id: '550e8400-e29b-41d4-a716-446655440000',
        content: 'Test post content',
        posted_at: '2024-01-14T14:00:00Z',
        metrics: {
          likes: 10,
          retweets: 5,
          replies: 2,
          impressions: 500,
          collected_at: '2024-01-15T10:00:00Z',
        },
        performance_score: 0.75,
        metadata: { topic: 'testing' },
      };

      const recorded = await analyticsStorage.recordPostMetrics(input);

      expect(recorded.id).toBe('tweet-123456');
      expect(recorded.metrics.likes).toBe(10);
      expect(recorded.performance_score).toBe(0.75);
    });

    it('should persist post to file', async () => {
      await analyticsStorage.recordPostMetrics({
        id: 'tweet-789',
        queue_id: null,
        content: 'Persisted content',
        posted_at: '2024-01-14T14:00:00Z',
        metrics: {
          likes: 20,
          retweets: 10,
          replies: 5,
          impressions: 1000,
          collected_at: '2024-01-15T10:00:00Z',
        },
        performance_score: 0.8,
        metadata: {},
      });

      const filePath = path.join(testDataDir, 'analytics.json');
      expect(fs.existsSync(filePath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(data.posts).toHaveLength(1);
      expect(data.posts[0].content).toBe('Persisted content');
    });
  });

  describe('updatePostMetrics', () => {
    it('should update existing post metrics', async () => {
      await analyticsStorage.recordPostMetrics({
        id: 'tweet-update-test',
        queue_id: null,
        content: 'Test content',
        posted_at: '2024-01-14T14:00:00Z',
        metrics: {
          likes: 10,
          retweets: 5,
          replies: 2,
          impressions: 500,
          collected_at: '2024-01-15T10:00:00Z',
        },
        performance_score: 0.5,
        metadata: {},
      });

      const updated = await analyticsStorage.updatePostMetrics('tweet-update-test', {
        likes: 50,
        retweets: 20,
        replies: 10,
        impressions: 2000,
        collected_at: '2024-01-16T10:00:00Z',
      });

      expect(updated).not.toBeNull();
      expect(updated?.metrics.likes).toBe(50);
      expect(updated?.metrics.impressions).toBe(2000);
    });

    it('should return null for non-existent post', async () => {
      const updated = await analyticsStorage.updatePostMetrics('non-existent', {
        likes: 100,
        retweets: 50,
        replies: 25,
        impressions: 5000,
        collected_at: '2024-01-16T10:00:00Z',
      });

      expect(updated).toBeNull();
    });

    it('should update performance_score when provided', async () => {
      await analyticsStorage.recordPostMetrics({
        id: 'tweet-score-test',
        queue_id: null,
        content: 'Test content',
        posted_at: '2024-01-14T14:00:00Z',
        metrics: {
          likes: 10,
          retweets: 5,
          replies: 2,
          impressions: 500,
          collected_at: '2024-01-15T10:00:00Z',
        },
        performance_score: 0.5,
        metadata: {},
      });

      const updated = await analyticsStorage.updatePostMetrics(
        'tweet-score-test',
        {
          likes: 100,
          retweets: 50,
          replies: 25,
          impressions: 5000,
          collected_at: '2024-01-16T10:00:00Z',
        },
        0.9
      );

      expect(updated?.performance_score).toBe(0.9);
    });
  });

  describe('getPost', () => {
    it('should return post by ID', async () => {
      await analyticsStorage.recordPostMetrics({
        id: 'tweet-get-test',
        queue_id: null,
        content: 'Get test content',
        posted_at: '2024-01-14T14:00:00Z',
        metrics: {
          likes: 15,
          retweets: 8,
          replies: 3,
          impressions: 600,
          collected_at: '2024-01-15T10:00:00Z',
        },
        performance_score: 0.6,
        metadata: {},
      });

      const post = await analyticsStorage.getPost('tweet-get-test');
      expect(post).toBeDefined();
      expect(post?.content).toBe('Get test content');
    });

    it('should return null for non-existent ID', async () => {
      const post = await analyticsStorage.getPost('non-existent-id');
      expect(post).toBeNull();
    });
  });

  describe('getPostsByDateRange', () => {
    beforeEach(async () => {
      // Add posts on different dates
      await analyticsStorage.recordPostMetrics({
        id: 'tweet-jan-13',
        queue_id: null,
        content: 'Jan 13 content',
        posted_at: '2024-01-13T10:00:00Z',
        metrics: { likes: 10, retweets: 5, replies: 2, impressions: 500, collected_at: '2024-01-14T10:00:00Z' },
        performance_score: 0.5,
        metadata: {},
      });

      await analyticsStorage.recordPostMetrics({
        id: 'tweet-jan-14',
        queue_id: null,
        content: 'Jan 14 content',
        posted_at: '2024-01-14T10:00:00Z',
        metrics: { likes: 20, retweets: 10, replies: 5, impressions: 1000, collected_at: '2024-01-15T10:00:00Z' },
        performance_score: 0.6,
        metadata: {},
      });

      await analyticsStorage.recordPostMetrics({
        id: 'tweet-jan-15',
        queue_id: null,
        content: 'Jan 15 content',
        posted_at: '2024-01-15T10:00:00Z',
        metrics: { likes: 30, retweets: 15, replies: 8, impressions: 1500, collected_at: '2024-01-16T10:00:00Z' },
        performance_score: 0.7,
        metadata: {},
      });

      await analyticsStorage.recordPostMetrics({
        id: 'tweet-jan-16',
        queue_id: null,
        content: 'Jan 16 content',
        posted_at: '2024-01-16T10:00:00Z',
        metrics: { likes: 40, retweets: 20, replies: 10, impressions: 2000, collected_at: '2024-01-17T10:00:00Z' },
        performance_score: 0.8,
        metadata: {},
      });
    });

    it('should return posts within date range', async () => {
      const posts = await analyticsStorage.getPostsByDateRange(
        '2024-01-14T00:00:00Z',
        '2024-01-15T23:59:59Z'
      );

      expect(posts).toHaveLength(2);
      expect(posts.map(p => p.id)).toContain('tweet-jan-14');
      expect(posts.map(p => p.id)).toContain('tweet-jan-15');
    });

    it('should return empty array for range with no posts', async () => {
      const posts = await analyticsStorage.getPostsByDateRange(
        '2024-01-01T00:00:00Z',
        '2024-01-05T23:59:59Z'
      );

      expect(posts).toHaveLength(0);
    });

    it('should include posts on boundary dates', async () => {
      const posts = await analyticsStorage.getPostsByDateRange(
        '2024-01-13T10:00:00Z',
        '2024-01-13T10:00:00Z'
      );

      expect(posts).toHaveLength(1);
      expect(posts[0].id).toBe('tweet-jan-13');
    });
  });

  describe('calculateDailyAggregate', () => {
    beforeEach(async () => {
      // Add multiple posts on the same day
      await analyticsStorage.recordPostMetrics({
        id: 'tweet-day-1',
        queue_id: null,
        content: 'Post 1',
        posted_at: '2024-01-14T10:00:00Z',
        metrics: { likes: 100, retweets: 20, replies: 10, impressions: 2000, collected_at: '2024-01-15T10:00:00Z' },
        performance_score: 0.7,
        metadata: {},
      });

      await analyticsStorage.recordPostMetrics({
        id: 'tweet-day-2',
        queue_id: null,
        content: 'Post 2',
        posted_at: '2024-01-14T14:00:00Z',
        metrics: { likes: 150, retweets: 30, replies: 15, impressions: 3000, collected_at: '2024-01-15T10:00:00Z' },
        performance_score: 0.8,
        metadata: {},
      });

      await analyticsStorage.recordPostMetrics({
        id: 'tweet-day-3',
        queue_id: null,
        content: 'Post 3',
        posted_at: '2024-01-14T18:00:00Z',
        metrics: { likes: 50, retweets: 10, replies: 5, impressions: 1000, collected_at: '2024-01-15T10:00:00Z' },
        performance_score: 0.5,
        metadata: {},
      });
    });

    it('should calculate daily aggregate', async () => {
      const aggregate = await analyticsStorage.calculateDailyAggregate('2024-01-14');

      expect(aggregate).toBeDefined();
      expect(aggregate?.posts).toBe(3);
      expect(aggregate?.total_likes).toBe(300);
      expect(aggregate?.total_retweets).toBe(60);
      expect(aggregate?.total_replies).toBe(30);
      expect(aggregate?.total_impressions).toBe(6000);
      // engagement_rate = (likes + retweets + replies) / impressions
      // = (300 + 60 + 30) / 6000 = 0.065
      expect(aggregate?.engagement_rate).toBeCloseTo(0.065, 3);
    });

    it('should return null for date with no posts', async () => {
      const aggregate = await analyticsStorage.calculateDailyAggregate('2024-01-01');
      expect(aggregate).toBeNull();
    });

    it('should store aggregate in data', async () => {
      await analyticsStorage.calculateDailyAggregate('2024-01-14');

      const analytics = await analyticsStorage.getAnalytics();
      expect(analytics.aggregates.daily['2024-01-14']).toBeDefined();
      expect(analytics.aggregates.daily['2024-01-14'].posts).toBe(3);
    });
  });

  describe('persistence and reload', () => {
    it('should persist and reload analytics data', async () => {
      await analyticsStorage.recordPostMetrics({
        id: 'tweet-persist-test',
        queue_id: null,
        content: 'Persistent content',
        posted_at: '2024-01-14T14:00:00Z',
        metrics: {
          likes: 25,
          retweets: 12,
          replies: 6,
          impressions: 800,
          collected_at: '2024-01-15T10:00:00Z',
        },
        performance_score: 0.65,
        metadata: { topic: 'persistence' },
      });

      // Create new instance to force reload from file
      const newAnalyticsStorage = new AnalyticsStorage(testDataDir);
      const analytics = await newAnalyticsStorage.getAnalytics();

      expect(analytics.posts).toHaveLength(1);
      expect(analytics.posts[0].content).toBe('Persistent content');
      expect(analytics.posts[0].metadata.topic).toBe('persistence');
    });
  });

  describe('updated_at tracking', () => {
    it('should update updated_at on recordPostMetrics', async () => {
      const before = new Date().toISOString();

      await analyticsStorage.recordPostMetrics({
        id: 'tweet-timestamp-test',
        queue_id: null,
        content: 'Test',
        posted_at: '2024-01-14T14:00:00Z',
        metrics: { likes: 10, retweets: 5, replies: 2, impressions: 500, collected_at: '2024-01-15T10:00:00Z' },
        performance_score: 0.5,
        metadata: {},
      });

      const analytics = await analyticsStorage.getAnalytics();
      expect(analytics.updated_at >= before).toBe(true);
    });

    it('should update updated_at on updatePostMetrics', async () => {
      await analyticsStorage.recordPostMetrics({
        id: 'tweet-update-timestamp',
        queue_id: null,
        content: 'Test',
        posted_at: '2024-01-14T14:00:00Z',
        metrics: { likes: 10, retweets: 5, replies: 2, impressions: 500, collected_at: '2024-01-15T10:00:00Z' },
        performance_score: 0.5,
        metadata: {},
      });

      const before = new Date().toISOString();
      await new Promise((r) => setTimeout(r, 10));

      await analyticsStorage.updatePostMetrics('tweet-update-timestamp', {
        likes: 50,
        retweets: 25,
        replies: 10,
        impressions: 2000,
        collected_at: '2024-01-16T10:00:00Z',
      });

      const analytics = await analyticsStorage.getAnalytics();
      expect(analytics.updated_at >= before).toBe(true);
    });
  });
});

describe('getAnalyticsStorage singleton', () => {
  let testDataDir: string;

  beforeEach(() => {
    resetStorage();
    resetAnalyticsStorage();
    testDataDir = path.join(
      os.tmpdir(),
      `analytics-singleton-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    fs.mkdirSync(testDataDir, { recursive: true });
  });

  afterEach(() => {
    resetStorage();
    resetAnalyticsStorage();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  it('should return singleton instance', () => {
    const as1 = getAnalyticsStorage(testDataDir);
    const as2 = getAnalyticsStorage();

    expect(as1).toBe(as2);
  });

  it('should reset singleton correctly', () => {
    const as1 = getAnalyticsStorage(testDataDir);
    resetAnalyticsStorage();
    const as2 = getAnalyticsStorage(testDataDir);

    expect(as1).not.toBe(as2);
  });
});
