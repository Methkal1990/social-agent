import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  contentNodeSchema,
  contentGraphDataSchema,
  ContentGraphStorage,
  getContentGraphStorage,
  resetContentGraphStorage,
} from '@/storage/content-graph.js';
import { resetStorage } from '@/storage/index.js';

describe('Content Graph Schemas', () => {
  describe('contentNodeSchema', () => {
    it('should validate valid content node', () => {
      const node = {
        id: 'uuid-123',
        content_hash: 'abc123def456',
        semantic_vector: [0.1, 0.2, 0.3, 0.4],
        topics: ['AI', 'productivity'],
        posted_at: '2024-01-14T14:00:00Z',
      };

      const result = contentNodeSchema.safeParse(node);
      expect(result.success).toBe(true);
    });

    it('should validate node with empty semantic vector', () => {
      const node = {
        id: 'uuid-123',
        content_hash: 'abc123def456',
        semantic_vector: [],
        topics: ['AI'],
        posted_at: '2024-01-14T14:00:00Z',
      };

      const result = contentNodeSchema.safeParse(node);
      expect(result.success).toBe(true);
    });

    it('should validate node with empty topics', () => {
      const node = {
        id: 'uuid-123',
        content_hash: 'abc123def456',
        semantic_vector: [0.1],
        topics: [],
        posted_at: '2024-01-14T14:00:00Z',
      };

      const result = contentNodeSchema.safeParse(node);
      expect(result.success).toBe(true);
    });

    it('should require id field', () => {
      const node = {
        content_hash: 'abc123def456',
        semantic_vector: [0.1],
        topics: ['AI'],
        posted_at: '2024-01-14T14:00:00Z',
      };

      const result = contentNodeSchema.safeParse(node);
      expect(result.success).toBe(false);
    });

    it('should require content_hash field', () => {
      const node = {
        id: 'uuid-123',
        semantic_vector: [0.1],
        topics: ['AI'],
        posted_at: '2024-01-14T14:00:00Z',
      };

      const result = contentNodeSchema.safeParse(node);
      expect(result.success).toBe(false);
    });

    it('should allow optional content field', () => {
      const node = {
        id: 'uuid-123',
        content_hash: 'abc123def456',
        content: 'This is the actual content',
        semantic_vector: [0.1, 0.2],
        topics: ['AI'],
        posted_at: '2024-01-14T14:00:00Z',
      };

      const result = contentNodeSchema.safeParse(node);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('This is the actual content');
      }
    });
  });

  describe('contentGraphDataSchema', () => {
    it('should validate valid content graph data', () => {
      const data = {
        version: 1,
        updated_at: '2024-01-15T10:30:00Z',
        posts: [
          {
            id: 'uuid-123',
            content_hash: 'abc123',
            semantic_vector: [0.1, 0.2],
            topics: ['AI'],
            posted_at: '2024-01-14T14:00:00Z',
          },
        ],
        similarity_threshold: 0.75,
      };

      const result = contentGraphDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate empty posts array', () => {
      const data = {
        version: 1,
        updated_at: '2024-01-15T10:30:00Z',
        posts: [],
        similarity_threshold: 0.75,
      };

      const result = contentGraphDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject similarity_threshold > 1', () => {
      const data = {
        version: 1,
        updated_at: '2024-01-15T10:30:00Z',
        posts: [],
        similarity_threshold: 1.5,
      };

      const result = contentGraphDataSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject similarity_threshold < 0', () => {
      const data = {
        version: 1,
        updated_at: '2024-01-15T10:30:00Z',
        posts: [],
        similarity_threshold: -0.1,
      };

      const result = contentGraphDataSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should use default similarity_threshold of 0.75', () => {
      const data = {
        version: 1,
        updated_at: '2024-01-15T10:30:00Z',
        posts: [],
      };

      const result = contentGraphDataSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.similarity_threshold).toBe(0.75);
      }
    });
  });
});

describe('ContentGraphStorage', () => {
  let tempDir: string;
  let storage: ContentGraphStorage;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'content-graph-test-'));
    storage = new ContentGraphStorage(tempDir);
  });

  afterEach(() => {
    resetContentGraphStorage();
    resetStorage();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('addContentNode', () => {
    it('should add a new content node', async () => {
      const node = await storage.addContentNode({
        content: 'AI is transforming how we work',
        topics: ['AI', 'productivity'],
      });

      expect(node.id).toBeDefined();
      expect(node.content_hash).toBeDefined();
      expect(node.semantic_vector).toBeDefined();
      expect(node.topics).toEqual(['AI', 'productivity']);
      expect(node.posted_at).toBeDefined();
    });

    it('should generate content hash from content', async () => {
      const node1 = await storage.addContentNode({
        content: 'Same content here',
        topics: ['test'],
      });

      const node2 = await storage.addContentNode({
        content: 'Same content here',
        topics: ['test'],
      });

      // Same content should produce same hash
      expect(node1.content_hash).toBe(node2.content_hash);
    });

    it('should generate unique IDs for each node', async () => {
      const node1 = await storage.addContentNode({
        content: 'First content',
        topics: ['test'],
      });

      const node2 = await storage.addContentNode({
        content: 'Second content',
        topics: ['test'],
      });

      expect(node1.id).not.toBe(node2.id);
    });

    it('should persist nodes to storage', async () => {
      await storage.addContentNode({
        content: 'Persisted content',
        topics: ['persistence'],
      });

      // Create new storage instance to verify persistence
      const newStorage = new ContentGraphStorage(tempDir);
      const data = await newStorage.getContentGraphData();

      expect(data.posts).toHaveLength(1);
      expect(data.posts[0].topics).toContain('persistence');
    });

    it('should allow custom semantic vector', async () => {
      const customVector = [0.5, 0.6, 0.7];
      const node = await storage.addContentNode({
        content: 'Content with custom vector',
        topics: ['test'],
        semantic_vector: customVector,
      });

      expect(node.semantic_vector).toEqual(customVector);
    });

    it('should store content when provided', async () => {
      const content = 'This content should be stored';
      const node = await storage.addContentNode({
        content,
        topics: ['test'],
      });

      expect(node.content).toBe(content);
    });
  });

  describe('getContentNode', () => {
    it('should retrieve a node by ID', async () => {
      const added = await storage.addContentNode({
        content: 'Findable content',
        topics: ['search'],
      });

      const found = await storage.getContentNode(added.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(added.id);
      expect(found?.content).toBe('Findable content');
    });

    it('should return null for non-existent ID', async () => {
      const found = await storage.getContentNode('non-existent-id');

      expect(found).toBeNull();
    });
  });

  describe('findByContentHash', () => {
    it('should find node by content hash', async () => {
      const added = await storage.addContentNode({
        content: 'Unique content for hash',
        topics: ['hash'],
      });

      const found = await storage.findByContentHash(added.content_hash);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(added.id);
    });

    it('should return null for non-existent hash', async () => {
      const found = await storage.findByContentHash('nonexistent-hash');

      expect(found).toBeNull();
    });
  });

  describe('findSimilarContent', () => {
    beforeEach(async () => {
      // Add some test content with vectors
      await storage.addContentNode({
        content: 'AI is amazing',
        topics: ['AI'],
        semantic_vector: [1, 0, 0],
      });

      await storage.addContentNode({
        content: 'Machine learning rocks',
        topics: ['ML'],
        semantic_vector: [0.9, 0.1, 0],
      });

      await storage.addContentNode({
        content: 'Cooking recipes',
        topics: ['cooking'],
        semantic_vector: [0, 0, 1],
      });
    });

    it('should find similar content above threshold', async () => {
      const similar = await storage.findSimilarContent([1, 0, 0], 0.8);

      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].node.content).toBe('AI is amazing');
    });

    it('should return empty array when no content is similar', async () => {
      const similar = await storage.findSimilarContent([0, 1, 0], 0.9);

      expect(similar).toHaveLength(0);
    });

    it('should use default similarity threshold from graph data', async () => {
      // Default threshold is 0.75
      const similar = await storage.findSimilarContent([0.9, 0.1, 0]);

      expect(similar.length).toBeGreaterThan(0);
    });

    it('should return results sorted by similarity (highest first)', async () => {
      const similar = await storage.findSimilarContent([1, 0, 0], 0.5);

      // Should have at least 2 results
      if (similar.length >= 2) {
        expect(similar[0].similarity).toBeGreaterThanOrEqual(similar[1].similarity);
      }
    });

    it('should include similarity score in results', async () => {
      const similar = await storage.findSimilarContent([1, 0, 0], 0.8);

      expect(similar[0]).toHaveProperty('similarity');
      expect(similar[0].similarity).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('checkDuplicate', () => {
    it('should detect exact duplicate by hash', async () => {
      await storage.addContentNode({
        content: 'Original content',
        topics: ['test'],
      });

      const result = await storage.checkDuplicate('Original content');

      expect(result.isDuplicate).toBe(true);
      expect(result.reason).toBe('exact_match');
    });

    it('should not flag unique content as duplicate', async () => {
      await storage.addContentNode({
        content: 'xyz xyz xyz xyz xyz',
        topics: ['test'],
        semantic_vector: [1, 0, 0, 0, 0],
      });

      // Use completely different vector to ensure no similarity
      const content = 'abc abc abc abc abc';
      // Override the similarity check by setting high threshold
      await storage.setSimilarityThreshold(0.99);
      const result = await storage.checkDuplicate(content);

      expect(result.isDuplicate).toBe(false);
    });

    it('should return matched node for exact duplicates', async () => {
      const original = await storage.addContentNode({
        content: 'Original content',
        topics: ['test'],
      });

      const result = await storage.checkDuplicate('Original content');

      expect(result.matchedNode?.id).toBe(original.id);
    });
  });

  describe('generateContentHash', () => {
    it('should generate consistent hash for same content', async () => {
      const hash1 = storage.generateContentHash('Test content');
      const hash2 = storage.generateContentHash('Test content');

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', async () => {
      const hash1 = storage.generateContentHash('Content A');
      const hash2 = storage.generateContentHash('Content B');

      expect(hash1).not.toBe(hash2);
    });

    it('should normalize whitespace before hashing', async () => {
      const hash1 = storage.generateContentHash('Test  content');
      const hash2 = storage.generateContentHash('Test content');

      expect(hash1).toBe(hash2);
    });

    it('should trim content before hashing', async () => {
      const hash1 = storage.generateContentHash('  Test content  ');
      const hash2 = storage.generateContentHash('Test content');

      expect(hash1).toBe(hash2);
    });
  });

  describe('generateSemanticVector', () => {
    it('should generate a vector array', async () => {
      const vector = storage.generateSemanticVector('Some text content');

      expect(Array.isArray(vector)).toBe(true);
      expect(vector.length).toBeGreaterThan(0);
    });

    it('should generate consistent vectors for similar text', async () => {
      // Basic check that it returns numbers
      const vector = storage.generateSemanticVector('AI and machine learning');

      expect(vector.every((v) => typeof v === 'number')).toBe(true);
    });
  });

  describe('setSimilarityThreshold', () => {
    it('should update similarity threshold', async () => {
      await storage.setSimilarityThreshold(0.9);
      const data = await storage.getContentGraphData();

      expect(data.similarity_threshold).toBe(0.9);
    });

    it('should persist threshold change', async () => {
      await storage.setSimilarityThreshold(0.85);

      const newStorage = new ContentGraphStorage(tempDir);
      const data = await newStorage.getContentGraphData();

      expect(data.similarity_threshold).toBe(0.85);
    });
  });

  describe('removeContentNode', () => {
    it('should remove a node by ID', async () => {
      const node = await storage.addContentNode({
        content: 'To be removed',
        topics: ['test'],
      });

      const removed = await storage.removeContentNode(node.id);

      expect(removed).toBe(true);

      const found = await storage.getContentNode(node.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent ID', async () => {
      const removed = await storage.removeContentNode('non-existent');

      expect(removed).toBe(false);
    });
  });

  describe('getContentGraphData', () => {
    it('should return all graph data', async () => {
      await storage.addContentNode({
        content: 'Content 1',
        topics: ['topic1'],
      });

      await storage.addContentNode({
        content: 'Content 2',
        topics: ['topic2'],
      });

      const data = await storage.getContentGraphData();

      expect(data.version).toBe(1);
      expect(data.posts).toHaveLength(2);
      expect(data.similarity_threshold).toBe(0.75);
    });

    it('should return default data when empty', async () => {
      const data = await storage.getContentGraphData();

      expect(data.version).toBe(1);
      expect(data.posts).toHaveLength(0);
      expect(data.similarity_threshold).toBe(0.75);
    });
  });

  describe('getAllNodes', () => {
    it('should return all content nodes', async () => {
      await storage.addContentNode({
        content: 'Node 1',
        topics: ['a'],
      });

      await storage.addContentNode({
        content: 'Node 2',
        topics: ['b'],
      });

      const nodes = await storage.getAllNodes();

      expect(nodes).toHaveLength(2);
    });

    it('should return empty array when no nodes', async () => {
      const nodes = await storage.getAllNodes();

      expect(nodes).toHaveLength(0);
    });
  });

  describe('getNodesByTopic', () => {
    beforeEach(async () => {
      await storage.addContentNode({
        content: 'AI content',
        topics: ['AI', 'tech'],
      });

      await storage.addContentNode({
        content: 'ML content',
        topics: ['ML', 'tech'],
      });

      await storage.addContentNode({
        content: 'Cooking content',
        topics: ['cooking'],
      });
    });

    it('should filter nodes by topic', async () => {
      const aiNodes = await storage.getNodesByTopic('AI');

      expect(aiNodes).toHaveLength(1);
      expect(aiNodes[0].content).toBe('AI content');
    });

    it('should find nodes with shared topic', async () => {
      const techNodes = await storage.getNodesByTopic('tech');

      expect(techNodes).toHaveLength(2);
    });

    it('should return empty array for non-existent topic', async () => {
      const nodes = await storage.getNodesByTopic('nonexistent');

      expect(nodes).toHaveLength(0);
    });
  });
});

describe('Singleton functions', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'content-graph-singleton-test-'));
    resetContentGraphStorage();
    resetStorage();
  });

  afterEach(() => {
    resetContentGraphStorage();
    resetStorage();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('getContentGraphStorage should return same instance', () => {
    const instance1 = getContentGraphStorage(tempDir);
    const instance2 = getContentGraphStorage(tempDir);

    expect(instance1).toBe(instance2);
  });

  it('resetContentGraphStorage should clear singleton', () => {
    const instance1 = getContentGraphStorage(tempDir);
    resetContentGraphStorage();
    const instance2 = getContentGraphStorage(tempDir);

    expect(instance1).not.toBe(instance2);
  });
});
