import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  type QueueItem,
  queueItemSchema,
  queueDataSchema,
  QueueStorage,
  getQueueStorage,
  resetQueueStorage,
} from '@/storage/queue.js';
import { resetStorage } from '@/storage/index.js';

describe('Queue Schemas', () => {
  describe('queueItemSchema', () => {
    it('should validate a single post queue item', () => {
      const item = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'single',
        status: 'pending',
        content: 'Test post content',
        media: null,
        scheduled_at: '2024-01-15T14:00:00Z',
        created_at: '2024-01-15T08:00:00Z',
        confidence_score: 0.92,
        source: 'generated',
        metadata: {
          topic: 'AI productivity',
          content_type: 'educational',
        },
      };

      const result = queueItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('should validate a thread queue item', () => {
      const item = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        type: 'thread',
        status: 'pending_review',
        content: ['Tweet 1', 'Tweet 2', 'Tweet 3'],
        media: ['image-uuid-1'],
        scheduled_at: null,
        created_at: '2024-01-15T09:00:00Z',
        confidence_score: 0.68,
        source: 'trend_based',
        metadata: {
          topic: 'AI for developers',
          content_type: 'thread',
          trend_reference: 'AI productivity trending',
        },
      };

      const result = queueItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const item = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'single',
        status: 'invalid_status',
        content: 'Test content',
        media: null,
        scheduled_at: null,
        created_at: '2024-01-15T08:00:00Z',
        confidence_score: 0.5,
        source: 'generated',
        metadata: {},
      };

      const result = queueItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('should reject confidence score outside 0-1 range', () => {
      const item = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'single',
        status: 'pending',
        content: 'Test content',
        media: null,
        scheduled_at: null,
        created_at: '2024-01-15T08:00:00Z',
        confidence_score: 1.5,
        source: 'generated',
        metadata: {},
      };

      const result = queueItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const item = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'single',
        // missing status, content, etc.
      };

      const result = queueItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });
  });

  describe('queueDataSchema', () => {
    it('should validate queue data structure', () => {
      const data = {
        version: 1,
        updated_at: '2024-01-15T10:30:00Z',
        items: [],
      };

      const result = queueDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate queue with items', () => {
      const data = {
        version: 1,
        updated_at: '2024-01-15T10:30:00Z',
        items: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            type: 'single',
            status: 'approved',
            content: 'Test content',
            media: null,
            scheduled_at: '2024-01-15T14:00:00Z',
            created_at: '2024-01-15T08:00:00Z',
            confidence_score: 0.92,
            source: 'generated',
            metadata: {},
          },
        ],
      };

      const result = queueDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});

describe('QueueStorage', () => {
  let testDataDir: string;
  let queueStorage: QueueStorage;

  beforeEach(() => {
    resetStorage();
    resetQueueStorage();
    testDataDir = path.join(
      os.tmpdir(),
      `queue-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    fs.mkdirSync(testDataDir, { recursive: true });
    queueStorage = new QueueStorage(testDataDir);
  });

  afterEach(() => {
    resetStorage();
    resetQueueStorage();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should create queue storage with custom directory', () => {
      expect(queueStorage).toBeDefined();
    });

    it('should return empty queue for new storage', async () => {
      const queue = await queueStorage.getQueue();
      expect(queue.version).toBe(1);
      expect(queue.items).toEqual([]);
    });
  });

  describe('addToQueue', () => {
    it('should add a single post item to queue', async () => {
      const item: Omit<QueueItem, 'id' | 'created_at'> = {
        type: 'single',
        status: 'pending',
        content: 'Test post content',
        media: null,
        scheduled_at: null,
        confidence_score: 0.85,
        source: 'generated',
        metadata: { topic: 'testing' },
      };

      const added = await queueStorage.addToQueue(item);

      expect(added.id).toBeDefined();
      expect(added.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(added.created_at).toBeDefined();
      expect(added.content).toBe('Test post content');
    });

    it('should add a thread item to queue', async () => {
      const item: Omit<QueueItem, 'id' | 'created_at'> = {
        type: 'thread',
        status: 'pending',
        content: ['Tweet 1', 'Tweet 2', 'Tweet 3'],
        media: null,
        scheduled_at: null,
        confidence_score: 0.75,
        source: 'manual',
        metadata: {},
      };

      const added = await queueStorage.addToQueue(item);

      expect(added.type).toBe('thread');
      expect(added.content).toEqual(['Tweet 1', 'Tweet 2', 'Tweet 3']);
    });

    it('should persist item to file', async () => {
      await queueStorage.addToQueue({
        type: 'single',
        status: 'pending',
        content: 'Persisted content',
        media: null,
        scheduled_at: null,
        confidence_score: 0.9,
        source: 'generated',
        metadata: {},
      });

      const filePath = path.join(testDataDir, 'queue.json');
      expect(fs.existsSync(filePath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(data.items).toHaveLength(1);
      expect(data.items[0].content).toBe('Persisted content');
    });
  });

  describe('removeFromQueue', () => {
    it('should remove item by ID', async () => {
      const added = await queueStorage.addToQueue({
        type: 'single',
        status: 'pending',
        content: 'To be removed',
        media: null,
        scheduled_at: null,
        confidence_score: 0.5,
        source: 'generated',
        metadata: {},
      });

      await queueStorage.removeFromQueue(added.id);

      const queue = await queueStorage.getQueue();
      expect(queue.items).toHaveLength(0);
    });

    it('should not throw for non-existent ID', async () => {
      await expect(queueStorage.removeFromQueue('non-existent-id')).resolves.not.toThrow();
    });

    it('should only remove specified item', async () => {
      await queueStorage.addToQueue({
        type: 'single',
        status: 'pending',
        content: 'Item 1',
        media: null,
        scheduled_at: null,
        confidence_score: 0.5,
        source: 'generated',
        metadata: {},
      });

      const item2 = await queueStorage.addToQueue({
        type: 'single',
        status: 'pending',
        content: 'Item 2',
        media: null,
        scheduled_at: null,
        confidence_score: 0.5,
        source: 'generated',
        metadata: {},
      });

      await queueStorage.removeFromQueue(item2.id);

      const queue = await queueStorage.getQueue();
      expect(queue.items).toHaveLength(1);
      expect(queue.items[0].content).toBe('Item 1');
    });
  });

  describe('updateQueueItem', () => {
    it('should update item status', async () => {
      const added = await queueStorage.addToQueue({
        type: 'single',
        status: 'pending',
        content: 'To be updated',
        media: null,
        scheduled_at: null,
        confidence_score: 0.5,
        source: 'generated',
        metadata: {},
      });

      const updated = await queueStorage.updateQueueItem(added.id, { status: 'approved' });

      expect(updated?.status).toBe('approved');
    });

    it('should update item content', async () => {
      const added = await queueStorage.addToQueue({
        type: 'single',
        status: 'pending',
        content: 'Original content',
        media: null,
        scheduled_at: null,
        confidence_score: 0.5,
        source: 'generated',
        metadata: {},
      });

      const updated = await queueStorage.updateQueueItem(added.id, { content: 'Updated content' });

      expect(updated?.content).toBe('Updated content');
    });

    it('should update scheduled_at', async () => {
      const added = await queueStorage.addToQueue({
        type: 'single',
        status: 'pending',
        content: 'To be scheduled',
        media: null,
        scheduled_at: null,
        confidence_score: 0.5,
        source: 'generated',
        metadata: {},
      });

      const scheduledTime = '2024-01-20T10:00:00Z';
      const updated = await queueStorage.updateQueueItem(added.id, {
        scheduled_at: scheduledTime,
      });

      expect(updated?.scheduled_at).toBe(scheduledTime);
    });

    it('should return null for non-existent ID', async () => {
      const updated = await queueStorage.updateQueueItem('non-existent-id', { status: 'approved' });
      expect(updated).toBeNull();
    });

    it('should persist updates to file', async () => {
      const added = await queueStorage.addToQueue({
        type: 'single',
        status: 'pending',
        content: 'To be updated',
        media: null,
        scheduled_at: null,
        confidence_score: 0.5,
        source: 'generated',
        metadata: {},
      });

      await queueStorage.updateQueueItem(added.id, { status: 'approved' });

      const filePath = path.join(testDataDir, 'queue.json');
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(data.items[0].status).toBe('approved');
    });
  });

  describe('getQueueByStatus', () => {
    beforeEach(async () => {
      await queueStorage.addToQueue({
        type: 'single',
        status: 'pending',
        content: 'Pending item 1',
        media: null,
        scheduled_at: null,
        confidence_score: 0.5,
        source: 'generated',
        metadata: {},
      });

      await queueStorage.addToQueue({
        type: 'single',
        status: 'approved',
        content: 'Approved item',
        media: null,
        scheduled_at: '2024-01-15T14:00:00Z',
        confidence_score: 0.8,
        source: 'generated',
        metadata: {},
      });

      await queueStorage.addToQueue({
        type: 'single',
        status: 'pending_review',
        content: 'Pending review item',
        media: null,
        scheduled_at: null,
        confidence_score: 0.6,
        source: 'generated',
        metadata: {},
      });
    });

    it('should return items with pending status', async () => {
      const items = await queueStorage.getQueueByStatus('pending');
      expect(items).toHaveLength(1);
      expect(items[0].content).toBe('Pending item 1');
    });

    it('should return items with approved status', async () => {
      const items = await queueStorage.getQueueByStatus('approved');
      expect(items).toHaveLength(1);
      expect(items[0].content).toBe('Approved item');
    });

    it('should return items with pending_review status', async () => {
      const items = await queueStorage.getQueueByStatus('pending_review');
      expect(items).toHaveLength(1);
      expect(items[0].content).toBe('Pending review item');
    });

    it('should return empty array for status with no items', async () => {
      const items = await queueStorage.getQueueByStatus('rejected');
      expect(items).toHaveLength(0);
    });
  });

  describe('getQueueItem', () => {
    it('should return item by ID', async () => {
      const added = await queueStorage.addToQueue({
        type: 'single',
        status: 'pending',
        content: 'Test item',
        media: null,
        scheduled_at: null,
        confidence_score: 0.5,
        source: 'generated',
        metadata: {},
      });

      const item = await queueStorage.getQueueItem(added.id);
      expect(item).toBeDefined();
      expect(item?.content).toBe('Test item');
    });

    it('should return null for non-existent ID', async () => {
      const item = await queueStorage.getQueueItem('non-existent-id');
      expect(item).toBeNull();
    });
  });

  describe('queue persistence and reload', () => {
    it('should persist and reload queue data', async () => {
      await queueStorage.addToQueue({
        type: 'single',
        status: 'approved',
        content: 'Persisted item',
        media: null,
        scheduled_at: '2024-01-15T14:00:00Z',
        confidence_score: 0.9,
        source: 'generated',
        metadata: { topic: 'testing' },
      });

      // Create new instance to force reload from file
      const newQueueStorage = new QueueStorage(testDataDir);
      const queue = await newQueueStorage.getQueue();

      expect(queue.items).toHaveLength(1);
      expect(queue.items[0].content).toBe('Persisted item');
      expect(queue.items[0].metadata.topic).toBe('testing');
    });
  });

  describe('queue updated_at tracking', () => {
    it('should update updated_at on add', async () => {
      const before = new Date().toISOString();

      await queueStorage.addToQueue({
        type: 'single',
        status: 'pending',
        content: 'Test',
        media: null,
        scheduled_at: null,
        confidence_score: 0.5,
        source: 'generated',
        metadata: {},
      });

      const queue = await queueStorage.getQueue();
      expect(queue.updated_at >= before).toBe(true);
    });

    it('should update updated_at on remove', async () => {
      const added = await queueStorage.addToQueue({
        type: 'single',
        status: 'pending',
        content: 'Test',
        media: null,
        scheduled_at: null,
        confidence_score: 0.5,
        source: 'generated',
        metadata: {},
      });

      const before = new Date().toISOString();
      await new Promise((r) => setTimeout(r, 10)); // Small delay

      await queueStorage.removeFromQueue(added.id);

      const queue = await queueStorage.getQueue();
      expect(queue.updated_at >= before).toBe(true);
    });

    it('should update updated_at on update', async () => {
      const added = await queueStorage.addToQueue({
        type: 'single',
        status: 'pending',
        content: 'Test',
        media: null,
        scheduled_at: null,
        confidence_score: 0.5,
        source: 'generated',
        metadata: {},
      });

      const before = new Date().toISOString();
      await new Promise((r) => setTimeout(r, 10)); // Small delay

      await queueStorage.updateQueueItem(added.id, { status: 'approved' });

      const queue = await queueStorage.getQueue();
      expect(queue.updated_at >= before).toBe(true);
    });
  });
});

describe('getQueueStorage singleton', () => {
  let testDataDir: string;

  beforeEach(() => {
    resetStorage();
    resetQueueStorage();
    testDataDir = path.join(
      os.tmpdir(),
      `queue-singleton-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    fs.mkdirSync(testDataDir, { recursive: true });
  });

  afterEach(() => {
    resetStorage();
    resetQueueStorage();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  it('should return singleton instance', () => {
    const qs1 = getQueueStorage(testDataDir);
    const qs2 = getQueueStorage();

    expect(qs1).toBe(qs2);
  });

  it('should reset singleton correctly', () => {
    const qs1 = getQueueStorage(testDataDir);
    resetQueueStorage();
    const qs2 = getQueueStorage(testDataDir);

    expect(qs1).not.toBe(qs2);
  });
});
