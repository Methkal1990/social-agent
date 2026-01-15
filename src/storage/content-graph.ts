/**
 * Content graph storage for deduplication.
 *
 * Provides operations for tracking content hashes, semantic vectors,
 * and similarity checking with Zod validation and persistence to content-graph.json.
 */

import { z } from 'zod';
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';

import { Storage, getStorage } from '@/storage/index.js';

/**
 * Content node schema.
 */
export const contentNodeSchema = z.object({
  id: z.string(),
  content_hash: z.string(),
  content: z.string().optional(),
  semantic_vector: z.array(z.number()),
  topics: z.array(z.string()),
  posted_at: z.string(),
});
export type ContentNode = z.infer<typeof contentNodeSchema>;

/**
 * Content graph data file schema.
 */
export const contentGraphDataSchema = z.object({
  version: z.number().default(1),
  updated_at: z.string(),
  posts: z.array(contentNodeSchema),
  similarity_threshold: z.number().min(0).max(1).default(0.75),
});
export type ContentGraphData = z.infer<typeof contentGraphDataSchema>;

/**
 * Input for adding a new content node.
 */
export interface AddContentNodeInput {
  content: string;
  topics: string[];
  semantic_vector?: number[];
}

/**
 * Result from similarity search.
 */
export interface SimilarityResult {
  node: ContentNode;
  similarity: number;
}

/**
 * Result from duplicate check.
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: 'exact_match' | 'similar_content';
  matchedNode?: ContentNode;
  similarity?: number;
}

/**
 * Default empty content graph data.
 */
function getDefaultContentGraphData(): ContentGraphData {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    posts: [],
    similarity_threshold: 0.75,
  };
}

/**
 * Calculate cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  // Pad shorter vector with zeros
  const maxLen = Math.max(a.length, b.length);
  const vecA = [...a, ...Array(maxLen - a.length).fill(0)];
  const vecB = [...b, ...Array(maxLen - b.length).fill(0)];

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < maxLen; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}

/**
 * Content graph storage class for managing deduplication data.
 */
export class ContentGraphStorage {
  private readonly storage: Storage;
  private readonly filePath: string;
  private cache: ContentGraphData | null = null;

  constructor(dataDir?: string) {
    this.storage = dataDir ? new Storage(dataDir) : getStorage();
    this.filePath = this.storage.getFilePath('content-graph.json');
  }

  /**
   * Load content graph data from file.
   */
  private async load(): Promise<ContentGraphData> {
    if (this.cache) {
      return this.cache;
    }

    const data = await this.storage.loadWithRecovery<ContentGraphData>(
      this.filePath,
      getDefaultContentGraphData()
    );

    // Validate and normalize
    const parsed = contentGraphDataSchema.safeParse(data);
    if (parsed.success) {
      this.cache = parsed.data;
      return parsed.data;
    }

    // Invalid data - return default
    const defaultData = getDefaultContentGraphData();
    this.cache = defaultData;
    return defaultData;
  }

  /**
   * Save content graph data to file.
   */
  private async save(data: ContentGraphData): Promise<void> {
    data.updated_at = new Date().toISOString();
    await this.storage.safeWrite(this.filePath, data);
    this.cache = data;
  }

  /**
   * Generate a content hash from text.
   * Normalizes whitespace and trims before hashing.
   */
  generateContentHash(content: string): string {
    const normalized = content.trim().replace(/\s+/g, ' ');
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Generate a basic semantic vector from text.
   * This is a simple implementation - in production, use an embedding model.
   */
  generateSemanticVector(content: string): number[] {
    // Simple character-frequency based vector for demonstration
    // In production, this would call an embedding API
    const normalized = content.toLowerCase().trim();
    const vector: number[] = [];

    // Create a basic 26-dimension vector based on letter frequency
    for (let i = 0; i < 26; i++) {
      const char = String.fromCharCode(97 + i); // 'a' to 'z'
      const count = (normalized.match(new RegExp(char, 'g')) || []).length;
      vector.push(count / Math.max(normalized.length, 1));
    }

    return vector;
  }

  /**
   * Add a new content node.
   */
  async addContentNode(input: AddContentNodeInput): Promise<ContentNode> {
    const data = await this.load();

    const node: ContentNode = {
      id: randomUUID(),
      content_hash: this.generateContentHash(input.content),
      content: input.content,
      semantic_vector: input.semantic_vector ?? this.generateSemanticVector(input.content),
      topics: input.topics,
      posted_at: new Date().toISOString(),
    };

    data.posts.push(node);
    await this.save(data);

    return node;
  }

  /**
   * Get a content node by ID.
   */
  async getContentNode(id: string): Promise<ContentNode | null> {
    const data = await this.load();
    return data.posts.find((node) => node.id === id) ?? null;
  }

  /**
   * Find a content node by content hash.
   */
  async findByContentHash(contentHash: string): Promise<ContentNode | null> {
    const data = await this.load();
    return data.posts.find((node) => node.content_hash === contentHash) ?? null;
  }

  /**
   * Find similar content based on semantic vector.
   */
  async findSimilarContent(
    vector: number[],
    threshold?: number
  ): Promise<SimilarityResult[]> {
    const data = await this.load();
    const effectiveThreshold = threshold ?? data.similarity_threshold;

    const results: SimilarityResult[] = [];

    for (const node of data.posts) {
      const similarity = cosineSimilarity(vector, node.semantic_vector);
      if (similarity >= effectiveThreshold) {
        results.push({ node, similarity });
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results;
  }

  /**
   * Check if content is a duplicate.
   */
  async checkDuplicate(content: string): Promise<DuplicateCheckResult> {
    const contentHash = this.generateContentHash(content);

    // Check for exact match
    const exactMatch = await this.findByContentHash(contentHash);
    if (exactMatch) {
      return {
        isDuplicate: true,
        reason: 'exact_match',
        matchedNode: exactMatch,
      };
    }

    // Check for semantic similarity
    const vector = this.generateSemanticVector(content);
    const similar = await this.findSimilarContent(vector);

    if (similar.length > 0) {
      return {
        isDuplicate: true,
        reason: 'similar_content',
        matchedNode: similar[0].node,
        similarity: similar[0].similarity,
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Set the similarity threshold.
   */
  async setSimilarityThreshold(threshold: number): Promise<void> {
    const data = await this.load();
    data.similarity_threshold = threshold;
    await this.save(data);
  }

  /**
   * Remove a content node by ID.
   */
  async removeContentNode(id: string): Promise<boolean> {
    const data = await this.load();
    const index = data.posts.findIndex((node) => node.id === id);

    if (index === -1) {
      return false;
    }

    data.posts.splice(index, 1);
    await this.save(data);

    return true;
  }

  /**
   * Get all content graph data.
   */
  async getContentGraphData(): Promise<ContentGraphData> {
    return this.load();
  }

  /**
   * Get all content nodes.
   */
  async getAllNodes(): Promise<ContentNode[]> {
    const data = await this.load();
    return data.posts;
  }

  /**
   * Get content nodes by topic.
   */
  async getNodesByTopic(topic: string): Promise<ContentNode[]> {
    const data = await this.load();
    return data.posts.filter((node) => node.topics.includes(topic));
  }
}

// Module-level singleton
let defaultContentGraphStorage: ContentGraphStorage | null = null;

/**
 * Get the default content graph storage singleton.
 */
export function getContentGraphStorage(dataDir?: string): ContentGraphStorage {
  if (!defaultContentGraphStorage) {
    defaultContentGraphStorage = new ContentGraphStorage(dataDir);
  }
  return defaultContentGraphStorage;
}

/**
 * Reset the content graph storage singleton (for testing).
 */
export function resetContentGraphStorage(): void {
  defaultContentGraphStorage = null;
}
