import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  postingTimePatternSchema,
  topicPatternSchema,
  contentInsightsSchema,
  patternsSchema,
  abTestVariantSchema,
  abTestSchema,
  modelWeightsSchema,
  learningDataSchema,
  LearningStorage,
  getLearningStorage,
  resetLearningStorage,
} from '@/storage/learning.js';
import { resetStorage } from '@/storage/index.js';

describe('Learning Schemas', () => {
  describe('postingTimePatternSchema', () => {
    it('should validate valid posting time pattern', () => {
      const pattern = {
        day: 'tuesday',
        hour: 9,
        score: 0.92,
      };

      const result = postingTimePatternSchema.safeParse(pattern);
      expect(result.success).toBe(true);
    });

    it('should reject invalid hour (> 23)', () => {
      const pattern = {
        day: 'tuesday',
        hour: 24,
        score: 0.92,
      };

      const result = postingTimePatternSchema.safeParse(pattern);
      expect(result.success).toBe(false);
    });

    it('should reject invalid hour (< 0)', () => {
      const pattern = {
        day: 'tuesday',
        hour: -1,
        score: 0.92,
      };

      const result = postingTimePatternSchema.safeParse(pattern);
      expect(result.success).toBe(false);
    });

    it('should reject score > 1', () => {
      const pattern = {
        day: 'tuesday',
        hour: 9,
        score: 1.5,
      };

      const result = postingTimePatternSchema.safeParse(pattern);
      expect(result.success).toBe(false);
    });

    it('should reject score < 0', () => {
      const pattern = {
        day: 'tuesday',
        hour: 9,
        score: -0.1,
      };

      const result = postingTimePatternSchema.safeParse(pattern);
      expect(result.success).toBe(false);
    });
  });

  describe('topicPatternSchema', () => {
    it('should validate valid topic pattern', () => {
      const pattern = {
        topic: 'AI tools',
        avg_engagement: 0.041,
      };

      const result = topicPatternSchema.safeParse(pattern);
      expect(result.success).toBe(true);
    });

    it('should reject negative engagement', () => {
      const pattern = {
        topic: 'AI tools',
        avg_engagement: -0.01,
      };

      const result = topicPatternSchema.safeParse(pattern);
      expect(result.success).toBe(false);
    });
  });

  describe('contentInsightsSchema', () => {
    it('should validate valid content insights', () => {
      const insights = {
        threads_vs_single: {
          threads_avg_engagement: 0.042,
          single_avg_engagement: 0.028,
        },
        optimal_length: {
          range: [120, 200],
          avg_engagement: 0.038,
        },
      };

      const result = contentInsightsSchema.safeParse(insights);
      expect(result.success).toBe(true);
    });

    it('should allow partial content insights', () => {
      const insights = {
        threads_vs_single: {
          threads_avg_engagement: 0.042,
          single_avg_engagement: 0.028,
        },
      };

      const result = contentInsightsSchema.safeParse(insights);
      expect(result.success).toBe(true);
    });

    it('should allow empty content insights', () => {
      const insights = {};

      const result = contentInsightsSchema.safeParse(insights);
      expect(result.success).toBe(true);
    });
  });

  describe('patternsSchema', () => {
    it('should validate valid patterns', () => {
      const patterns = {
        best_posting_times: [
          { day: 'tuesday', hour: 9, score: 0.92 },
          { day: 'thursday', hour: 18, score: 0.88 },
        ],
        top_topics: [
          { topic: 'AI tools', avg_engagement: 0.041 },
          { topic: 'productivity', avg_engagement: 0.035 },
        ],
        content_insights: {
          threads_vs_single: {
            threads_avg_engagement: 0.042,
            single_avg_engagement: 0.028,
          },
        },
      };

      const result = patternsSchema.safeParse(patterns);
      expect(result.success).toBe(true);
    });

    it('should allow empty patterns', () => {
      const patterns = {
        best_posting_times: [],
        top_topics: [],
        content_insights: {},
      };

      const result = patternsSchema.safeParse(patterns);
      expect(result.success).toBe(true);
    });
  });

  describe('abTestVariantSchema', () => {
    it('should validate valid A/B test variant', () => {
      const variant = {
        pattern: "Here's what I learned...",
        engagement: 0.028,
      };

      const result = abTestVariantSchema.safeParse(variant);
      expect(result.success).toBe(true);
    });

    it('should reject negative engagement', () => {
      const variant = {
        pattern: "Here's what I learned...",
        engagement: -0.01,
      };

      const result = abTestVariantSchema.safeParse(variant);
      expect(result.success).toBe(false);
    });
  });

  describe('abTestSchema', () => {
    it('should validate valid A/B test', () => {
      const test = {
        id: 'test-123',
        name: 'Hook style test',
        status: 'completed',
        winner: 'variant_b',
        confidence: 0.94,
        variants: {
          variant_a: { pattern: "Here's what I learned...", engagement: 0.028 },
          variant_b: { pattern: "Most people don't know...", engagement: 0.041 },
        },
        created_at: '2024-01-10T10:00:00Z',
        completed_at: '2024-01-15T10:00:00Z',
      };

      const result = abTestSchema.safeParse(test);
      expect(result.success).toBe(true);
    });

    it('should validate running test without winner', () => {
      const test = {
        id: 'test-456',
        name: 'CTA test',
        status: 'running',
        confidence: 0.5,
        variants: {
          variant_a: { pattern: 'Click here', engagement: 0.02 },
          variant_b: { pattern: 'Learn more', engagement: 0.025 },
        },
        created_at: '2024-01-14T10:00:00Z',
      };

      const result = abTestSchema.safeParse(test);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const test = {
        id: 'test-789',
        name: 'Invalid test',
        status: 'invalid_status',
        confidence: 0.5,
        variants: {},
        created_at: '2024-01-14T10:00:00Z',
      };

      const result = abTestSchema.safeParse(test);
      expect(result.success).toBe(false);
    });

    it('should reject confidence > 1', () => {
      const test = {
        id: 'test-789',
        name: 'Invalid confidence',
        status: 'running',
        confidence: 1.5,
        variants: {},
        created_at: '2024-01-14T10:00:00Z',
      };

      const result = abTestSchema.safeParse(test);
      expect(result.success).toBe(false);
    });
  });

  describe('modelWeightsSchema', () => {
    it('should validate valid model weights', () => {
      const weights = {
        voice_alignment: 0.32,
        topic_relevance: 0.25,
        timing_factor: 0.18,
        length_factor: 0.15,
        hook_style: 0.1,
      };

      const result = modelWeightsSchema.safeParse(weights);
      expect(result.success).toBe(true);
    });

    it('should allow additional custom weights', () => {
      const weights = {
        voice_alignment: 0.32,
        topic_relevance: 0.25,
        custom_factor: 0.1,
      };

      const result = modelWeightsSchema.safeParse(weights);
      expect(result.success).toBe(true);
    });

    it('should reject weights > 1', () => {
      const weights = {
        voice_alignment: 1.5,
      };

      const result = modelWeightsSchema.safeParse(weights);
      expect(result.success).toBe(false);
    });

    it('should reject weights < 0', () => {
      const weights = {
        voice_alignment: -0.1,
      };

      const result = modelWeightsSchema.safeParse(weights);
      expect(result.success).toBe(false);
    });
  });

  describe('learningDataSchema', () => {
    it('should validate full learning data structure', () => {
      const data = {
        version: 1,
        updated_at: '2024-01-15T10:30:00Z',
        patterns: {
          best_posting_times: [{ day: 'tuesday', hour: 9, score: 0.92 }],
          top_topics: [{ topic: 'AI tools', avg_engagement: 0.041 }],
          content_insights: {},
        },
        ab_tests: [
          {
            id: 'test-123',
            name: 'Hook style test',
            status: 'completed',
            winner: 'variant_b',
            confidence: 0.94,
            variants: {
              variant_a: { pattern: "Here's what I learned...", engagement: 0.028 },
              variant_b: { pattern: "Most people don't know...", engagement: 0.041 },
            },
            created_at: '2024-01-10T10:00:00Z',
          },
        ],
        model_weights: {
          voice_alignment: 0.32,
          topic_relevance: 0.25,
        },
      };

      const result = learningDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate empty learning data', () => {
      const data = {
        version: 1,
        updated_at: '2024-01-15T10:30:00Z',
        patterns: {
          best_posting_times: [],
          top_topics: [],
          content_insights: {},
        },
        ab_tests: [],
        model_weights: {},
      };

      const result = learningDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});

describe('LearningStorage', () => {
  let testDataDir: string;
  let learningStorage: LearningStorage;

  beforeEach(() => {
    resetStorage();
    resetLearningStorage();
    testDataDir = path.join(
      os.tmpdir(),
      `learning-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    fs.mkdirSync(testDataDir, { recursive: true });
    learningStorage = new LearningStorage(testDataDir);
  });

  afterEach(() => {
    resetStorage();
    resetLearningStorage();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should create learning storage with custom directory', () => {
      expect(learningStorage).toBeDefined();
    });

    it('should return empty learning data for new storage', async () => {
      const data = await learningStorage.getLearningData();
      expect(data.version).toBe(1);
      expect(data.patterns.best_posting_times).toEqual([]);
      expect(data.patterns.top_topics).toEqual([]);
      expect(data.ab_tests).toEqual([]);
      expect(data.model_weights).toEqual({});
    });
  });

  describe('updatePatterns', () => {
    it('should update posting time patterns', async () => {
      const postingTimes = [
        { day: 'tuesday', hour: 9, score: 0.92 },
        { day: 'thursday', hour: 18, score: 0.88 },
      ];

      await learningStorage.updatePatterns({ best_posting_times: postingTimes });

      const data = await learningStorage.getLearningData();
      expect(data.patterns.best_posting_times).toHaveLength(2);
      expect(data.patterns.best_posting_times[0].day).toBe('tuesday');
    });

    it('should update topic patterns', async () => {
      const topics = [
        { topic: 'AI tools', avg_engagement: 0.041 },
        { topic: 'productivity', avg_engagement: 0.035 },
      ];

      await learningStorage.updatePatterns({ top_topics: topics });

      const data = await learningStorage.getLearningData();
      expect(data.patterns.top_topics).toHaveLength(2);
      expect(data.patterns.top_topics[0].topic).toBe('AI tools');
    });

    it('should update content insights', async () => {
      const insights = {
        threads_vs_single: {
          threads_avg_engagement: 0.042,
          single_avg_engagement: 0.028,
        },
      };

      await learningStorage.updatePatterns({ content_insights: insights });

      const data = await learningStorage.getLearningData();
      expect(data.patterns.content_insights.threads_vs_single?.threads_avg_engagement).toBe(0.042);
    });

    it('should merge patterns without overwriting unrelated fields', async () => {
      await learningStorage.updatePatterns({
        best_posting_times: [{ day: 'monday', hour: 10, score: 0.8 }],
      });

      await learningStorage.updatePatterns({
        top_topics: [{ topic: 'AI', avg_engagement: 0.05 }],
      });

      const data = await learningStorage.getLearningData();
      expect(data.patterns.best_posting_times).toHaveLength(1);
      expect(data.patterns.top_topics).toHaveLength(1);
    });

    it('should persist patterns to file', async () => {
      await learningStorage.updatePatterns({
        best_posting_times: [{ day: 'friday', hour: 14, score: 0.9 }],
      });

      const filePath = path.join(testDataDir, 'learning.json');
      expect(fs.existsSync(filePath)).toBe(true);

      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(fileData.patterns.best_posting_times[0].day).toBe('friday');
    });
  });

  describe('A/B test management', () => {
    it('should create a new A/B test', async () => {
      const test = await learningStorage.createABTest({
        name: 'Hook style test',
        variants: {
          variant_a: { pattern: "Here's what I learned...", engagement: 0 },
          variant_b: { pattern: "Most people don't know...", engagement: 0 },
        },
      });

      expect(test.id).toBeDefined();
      expect(test.name).toBe('Hook style test');
      expect(test.status).toBe('running');
      expect(test.confidence).toBe(0);
    });

    it('should record A/B test result', async () => {
      const test = await learningStorage.createABTest({
        name: 'CTA test',
        variants: {
          variant_a: { pattern: 'Click here', engagement: 0 },
          variant_b: { pattern: 'Learn more', engagement: 0 },
        },
      });

      const updated = await learningStorage.recordABTestResult(test.id, 'variant_a', 0.035);

      expect(updated).not.toBeNull();
      expect(updated?.variants.variant_a.engagement).toBe(0.035);
    });

    it('should accumulate engagement for variant', async () => {
      const test = await learningStorage.createABTest({
        name: 'Engagement test',
        variants: {
          variant_a: { pattern: 'Pattern A', engagement: 0.02 },
          variant_b: { pattern: 'Pattern B', engagement: 0.03 },
        },
      });

      await learningStorage.recordABTestResult(test.id, 'variant_a', 0.04);

      const data = await learningStorage.getLearningData();
      const updatedTest = data.ab_tests.find((t) => t.id === test.id);
      // Should average: (0.02 + 0.04) / 2 = 0.03
      expect(updatedTest?.variants.variant_a.engagement).toBeCloseTo(0.03, 4);
    });

    it('should get winning variants', async () => {
      await learningStorage.createABTest({
        name: 'Completed test',
        variants: {
          variant_a: { pattern: 'Pattern A', engagement: 0.02 },
          variant_b: { pattern: 'Pattern B', engagement: 0.04 },
        },
      });

      // Manually update to completed status with winner
      const data = await learningStorage.getLearningData();
      data.ab_tests[0].status = 'completed';
      data.ab_tests[0].winner = 'variant_b';
      data.ab_tests[0].confidence = 0.95;
      await learningStorage.updatePatterns({}); // Force save

      const winners = await learningStorage.getWinningVariants();
      expect(winners).toHaveLength(1);
      expect(winners[0].winner).toBe('variant_b');
    });

    it('should return null when recording result for non-existent test', async () => {
      const result = await learningStorage.recordABTestResult('non-existent', 'variant_a', 0.05);
      expect(result).toBeNull();
    });

    it('should get A/B test by ID', async () => {
      const created = await learningStorage.createABTest({
        name: 'Test to find',
        variants: {
          variant_a: { pattern: 'A', engagement: 0 },
          variant_b: { pattern: 'B', engagement: 0 },
        },
      });

      const found = await learningStorage.getABTest(created.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Test to find');
    });

    it('should return null for non-existent A/B test', async () => {
      const found = await learningStorage.getABTest('non-existent');
      expect(found).toBeNull();
    });

    it('should complete A/B test with winner', async () => {
      const test = await learningStorage.createABTest({
        name: 'Test to complete',
        variants: {
          variant_a: { pattern: 'A', engagement: 0.02 },
          variant_b: { pattern: 'B', engagement: 0.05 },
        },
      });

      const completed = await learningStorage.completeABTest(test.id, 'variant_b', 0.95);

      expect(completed).not.toBeNull();
      expect(completed?.status).toBe('completed');
      expect(completed?.winner).toBe('variant_b');
      expect(completed?.confidence).toBe(0.95);
      expect(completed?.completed_at).toBeDefined();
    });
  });

  describe('model weights', () => {
    it('should update model weights', async () => {
      const weights = {
        voice_alignment: 0.32,
        topic_relevance: 0.25,
        timing_factor: 0.18,
      };

      await learningStorage.updateModelWeights(weights);

      const data = await learningStorage.getLearningData();
      expect(data.model_weights.voice_alignment).toBe(0.32);
      expect(data.model_weights.topic_relevance).toBe(0.25);
    });

    it('should merge model weights', async () => {
      await learningStorage.updateModelWeights({ voice_alignment: 0.3 });
      await learningStorage.updateModelWeights({ topic_relevance: 0.25 });

      const data = await learningStorage.getLearningData();
      expect(data.model_weights.voice_alignment).toBe(0.3);
      expect(data.model_weights.topic_relevance).toBe(0.25);
    });

    it('should get current model weights', async () => {
      await learningStorage.updateModelWeights({
        voice_alignment: 0.4,
        timing_factor: 0.2,
      });

      const weights = await learningStorage.getModelWeights();
      expect(weights.voice_alignment).toBe(0.4);
      expect(weights.timing_factor).toBe(0.2);
    });
  });

  describe('persistence and reload', () => {
    it('should persist and reload learning data', async () => {
      await learningStorage.updatePatterns({
        best_posting_times: [{ day: 'wednesday', hour: 12, score: 0.85 }],
        top_topics: [{ topic: 'testing', avg_engagement: 0.03 }],
      });

      await learningStorage.createABTest({
        name: 'Persistent test',
        variants: {
          variant_a: { pattern: 'A', engagement: 0.01 },
        },
      });

      await learningStorage.updateModelWeights({ custom_weight: 0.5 });

      // Create new instance to force reload from file
      const newLearningStorage = new LearningStorage(testDataDir);
      const data = await newLearningStorage.getLearningData();

      expect(data.patterns.best_posting_times[0].day).toBe('wednesday');
      expect(data.patterns.top_topics[0].topic).toBe('testing');
      expect(data.ab_tests[0].name).toBe('Persistent test');
      expect(data.model_weights.custom_weight).toBe(0.5);
    });
  });

  describe('updated_at tracking', () => {
    it('should update updated_at on updatePatterns', async () => {
      const before = new Date().toISOString();

      await learningStorage.updatePatterns({
        best_posting_times: [{ day: 'monday', hour: 8, score: 0.7 }],
      });

      const data = await learningStorage.getLearningData();
      expect(data.updated_at >= before).toBe(true);
    });

    it('should update updated_at on createABTest', async () => {
      const before = new Date().toISOString();

      await learningStorage.createABTest({
        name: 'Timestamp test',
        variants: { variant_a: { pattern: 'A', engagement: 0 } },
      });

      const data = await learningStorage.getLearningData();
      expect(data.updated_at >= before).toBe(true);
    });

    it('should update updated_at on updateModelWeights', async () => {
      const before = new Date().toISOString();

      await learningStorage.updateModelWeights({ test_weight: 0.1 });

      const data = await learningStorage.getLearningData();
      expect(data.updated_at >= before).toBe(true);
    });
  });
});

describe('getLearningStorage singleton', () => {
  let testDataDir: string;

  beforeEach(() => {
    resetStorage();
    resetLearningStorage();
    testDataDir = path.join(
      os.tmpdir(),
      `learning-singleton-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    fs.mkdirSync(testDataDir, { recursive: true });
  });

  afterEach(() => {
    resetStorage();
    resetLearningStorage();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  it('should return singleton instance', () => {
    const ls1 = getLearningStorage(testDataDir);
    const ls2 = getLearningStorage();

    expect(ls1).toBe(ls2);
  });

  it('should reset singleton correctly', () => {
    const ls1 = getLearningStorage(testDataDir);
    resetLearningStorage();
    const ls2 = getLearningStorage(testDataDir);

    expect(ls1).not.toBe(ls2);
  });
});
