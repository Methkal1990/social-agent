/**
 * Learning data storage for AI patterns and A/B testing.
 *
 * Provides operations for tracking learning patterns, managing A/B tests,
 * and storing model weights with Zod validation and persistence to learning.json.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';

import { Storage, getStorage } from '@/storage/index.js';

/**
 * Posting time pattern schema.
 */
export const postingTimePatternSchema = z.object({
  day: z.string(),
  hour: z.number().int().min(0).max(23),
  score: z.number().min(0).max(1),
});
export type PostingTimePattern = z.infer<typeof postingTimePatternSchema>;

/**
 * Topic pattern schema.
 */
export const topicPatternSchema = z.object({
  topic: z.string(),
  avg_engagement: z.number().nonnegative(),
});
export type TopicPattern = z.infer<typeof topicPatternSchema>;

/**
 * Threads vs single comparison schema.
 */
export const threadsVsSingleSchema = z.object({
  threads_avg_engagement: z.number().nonnegative(),
  single_avg_engagement: z.number().nonnegative(),
});

/**
 * Optimal length schema.
 */
export const optimalLengthSchema = z.object({
  range: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
  avg_engagement: z.number().nonnegative(),
});

/**
 * Content insights schema.
 */
export const contentInsightsSchema = z
  .object({
    threads_vs_single: threadsVsSingleSchema.optional(),
    optimal_length: optimalLengthSchema.optional(),
  })
  .passthrough();
export type ContentInsights = z.infer<typeof contentInsightsSchema>;

/**
 * Patterns schema.
 */
export const patternsSchema = z.object({
  best_posting_times: z.array(postingTimePatternSchema),
  top_topics: z.array(topicPatternSchema),
  content_insights: contentInsightsSchema,
});
export type Patterns = z.infer<typeof patternsSchema>;

/**
 * A/B test variant schema.
 */
export const abTestVariantSchema = z.object({
  pattern: z.string(),
  engagement: z.number().nonnegative(),
});
export type ABTestVariant = z.infer<typeof abTestVariantSchema>;

/**
 * A/B test status enum.
 */
export const abTestStatusSchema = z.enum(['running', 'paused', 'completed']);
export type ABTestStatus = z.infer<typeof abTestStatusSchema>;

/**
 * A/B test schema.
 */
export const abTestSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: abTestStatusSchema,
  winner: z.string().optional(),
  confidence: z.number().min(0).max(1),
  variants: z.record(z.string(), abTestVariantSchema),
  created_at: z.string(),
  completed_at: z.string().optional(),
});
export type ABTest = z.infer<typeof abTestSchema>;

/**
 * Model weights schema (flexible key-value store for weights).
 */
export const modelWeightsSchema = z.record(z.string(), z.number().min(0).max(1));
export type ModelWeights = z.infer<typeof modelWeightsSchema>;

/**
 * Learning data file schema.
 */
export const learningDataSchema = z.object({
  version: z.number().default(1),
  updated_at: z.string(),
  patterns: patternsSchema,
  ab_tests: z.array(abTestSchema),
  model_weights: modelWeightsSchema,
});
export type LearningData = z.infer<typeof learningDataSchema>;

/**
 * Input for creating a new A/B test.
 */
export interface CreateABTestInput {
  name: string;
  variants: Record<string, ABTestVariant>;
}

/**
 * Partial patterns update.
 */
export interface PatternsUpdate {
  best_posting_times?: PostingTimePattern[];
  top_topics?: TopicPattern[];
  content_insights?: ContentInsights;
}

/**
 * Default empty learning data.
 */
function getDefaultLearningData(): LearningData {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    patterns: {
      best_posting_times: [],
      top_topics: [],
      content_insights: {},
    },
    ab_tests: [],
    model_weights: {},
  };
}

/**
 * Learning storage class for managing AI learning data.
 */
export class LearningStorage {
  private readonly storage: Storage;
  private readonly filePath: string;
  private cache: LearningData | null = null;
  private variantSampleCounts: Map<string, Map<string, number>> = new Map();

  constructor(dataDir?: string) {
    this.storage = dataDir ? new Storage(dataDir) : getStorage();
    this.filePath = this.storage.getFilePath('learning.json');
  }

  /**
   * Load learning data from file.
   */
  private async load(): Promise<LearningData> {
    if (this.cache) {
      return this.cache;
    }

    const data = await this.storage.loadWithRecovery<LearningData>(
      this.filePath,
      getDefaultLearningData()
    );

    // Validate and normalize
    const parsed = learningDataSchema.safeParse(data);
    if (parsed.success) {
      this.cache = parsed.data;
      // Initialize sample counts from existing data
      this.initializeSampleCounts(parsed.data);
      return parsed.data;
    }

    // Invalid data - return default
    const defaultData = getDefaultLearningData();
    this.cache = defaultData;
    return defaultData;
  }

  /**
   * Initialize sample counts from existing A/B tests.
   */
  private initializeSampleCounts(data: LearningData): void {
    for (const test of data.ab_tests) {
      const testCounts = new Map<string, number>();
      for (const variantKey of Object.keys(test.variants)) {
        // Assume at least 1 sample if engagement > 0
        testCounts.set(variantKey, test.variants[variantKey].engagement > 0 ? 1 : 0);
      }
      this.variantSampleCounts.set(test.id, testCounts);
    }
  }

  /**
   * Save learning data to file.
   */
  private async save(data: LearningData): Promise<void> {
    data.updated_at = new Date().toISOString();
    await this.storage.safeWrite(this.filePath, data);
    this.cache = data;
  }

  /**
   * Get all learning data.
   */
  async getLearningData(): Promise<LearningData> {
    return this.load();
  }

  /**
   * Update patterns (partial update - only provided fields are updated).
   */
  async updatePatterns(update: PatternsUpdate): Promise<Patterns> {
    const data = await this.load();

    if (update.best_posting_times !== undefined) {
      data.patterns.best_posting_times = update.best_posting_times;
    }
    if (update.top_topics !== undefined) {
      data.patterns.top_topics = update.top_topics;
    }
    if (update.content_insights !== undefined) {
      data.patterns.content_insights = {
        ...data.patterns.content_insights,
        ...update.content_insights,
      };
    }

    await this.save(data);
    return data.patterns;
  }

  /**
   * Create a new A/B test.
   */
  async createABTest(input: CreateABTestInput): Promise<ABTest> {
    const data = await this.load();

    const test: ABTest = {
      id: randomUUID(),
      name: input.name,
      status: 'running',
      confidence: 0,
      variants: input.variants,
      created_at: new Date().toISOString(),
    };

    data.ab_tests.push(test);

    // Initialize sample counts for this test
    const testCounts = new Map<string, number>();
    for (const variantKey of Object.keys(input.variants)) {
      testCounts.set(variantKey, input.variants[variantKey].engagement > 0 ? 1 : 0);
    }
    this.variantSampleCounts.set(test.id, testCounts);

    await this.save(data);
    return test;
  }

  /**
   * Get an A/B test by ID.
   */
  async getABTest(id: string): Promise<ABTest | null> {
    const data = await this.load();
    return data.ab_tests.find((test) => test.id === id) ?? null;
  }

  /**
   * Record a result for an A/B test variant.
   * Engagement is averaged with existing value.
   */
  async recordABTestResult(
    testId: string,
    variantKey: string,
    engagement: number
  ): Promise<ABTest | null> {
    const data = await this.load();
    const testIndex = data.ab_tests.findIndex((test) => test.id === testId);

    if (testIndex === -1) {
      return null;
    }

    const test = data.ab_tests[testIndex];
    if (!test.variants[variantKey]) {
      return null;
    }

    // Get or initialize sample counts
    let testCounts = this.variantSampleCounts.get(testId);
    if (!testCounts) {
      testCounts = new Map();
      this.variantSampleCounts.set(testId, testCounts);
    }

    const currentCount = testCounts.get(variantKey) ?? 0;
    const currentEngagement = test.variants[variantKey].engagement;

    // Calculate new average
    const newCount = currentCount + 1;
    const newEngagement = (currentEngagement * currentCount + engagement) / newCount;

    test.variants[variantKey].engagement = newEngagement;
    testCounts.set(variantKey, newCount);

    await this.save(data);
    return test;
  }

  /**
   * Complete an A/B test with a winner.
   */
  async completeABTest(testId: string, winner: string, confidence: number): Promise<ABTest | null> {
    const data = await this.load();
    const testIndex = data.ab_tests.findIndex((test) => test.id === testId);

    if (testIndex === -1) {
      return null;
    }

    data.ab_tests[testIndex].status = 'completed';
    data.ab_tests[testIndex].winner = winner;
    data.ab_tests[testIndex].confidence = confidence;
    data.ab_tests[testIndex].completed_at = new Date().toISOString();

    await this.save(data);
    return data.ab_tests[testIndex];
  }

  /**
   * Get all completed A/B tests with winners.
   */
  async getWinningVariants(): Promise<ABTest[]> {
    const data = await this.load();
    return data.ab_tests.filter((test) => test.status === 'completed' && test.winner !== undefined);
  }

  /**
   * Update model weights (merge with existing).
   */
  async updateModelWeights(weights: ModelWeights): Promise<ModelWeights> {
    const data = await this.load();

    data.model_weights = {
      ...data.model_weights,
      ...weights,
    };

    await this.save(data);
    return data.model_weights;
  }

  /**
   * Get current model weights.
   */
  async getModelWeights(): Promise<ModelWeights> {
    const data = await this.load();
    return data.model_weights;
  }
}

// Module-level singleton
let defaultLearningStorage: LearningStorage | null = null;

/**
 * Get the default learning storage singleton.
 */
export function getLearningStorage(dataDir?: string): LearningStorage {
  if (!defaultLearningStorage) {
    defaultLearningStorage = new LearningStorage(dataDir);
  }
  return defaultLearningStorage;
}

/**
 * Reset the learning storage singleton (for testing).
 */
export function resetLearningStorage(): void {
  defaultLearningStorage = null;
}
