import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  type DraftItem,
  draftItemSchema,
  draftsDataSchema,
  DraftsStorage,
  getDraftsStorage,
  resetDraftsStorage,
} from '@/storage/drafts.js';
import { resetStorage } from '@/storage/index.js';
import { resetQueueStorage, QueueStorage } from '@/storage/queue.js';

describe('Draft Schemas', () => {
  describe('draftItemSchema', () => {
    it('should validate a single post draft', () => {
      const draft = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'single',
        content: 'Test draft content',
        media: null,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z',
        metadata: {
          topic: 'AI productivity',
          notes: 'Need to add more examples',
        },
      };

      const result = draftItemSchema.safeParse(draft);
      expect(result.success).toBe(true);
    });

    it('should validate a thread draft', () => {
      const draft = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        type: 'thread',
        content: ['Tweet 1', 'Tweet 2', 'Tweet 3'],
        media: ['image-uuid-1'],
        created_at: '2024-01-15T09:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        metadata: {
          topic: 'AI for developers',
        },
      };

      const result = draftItemSchema.safeParse(draft);
      expect(result.success).toBe(true);
    });

    it('should reject invalid type', () => {
      const draft = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'invalid_type',
        content: 'Test content',
        media: null,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z',
        metadata: {},
      };

      const result = draftItemSchema.safeParse(draft);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const draft = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'single',
        // missing content, created_at, etc.
      };

      const result = draftItemSchema.safeParse(draft);
      expect(result.success).toBe(false);
    });

    it('should allow additional metadata fields', () => {
      const draft = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'single',
        content: 'Test content',
        media: null,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z',
        metadata: {
          topic: 'AI',
          custom_field: 'custom value',
          another_field: 123,
        },
      };

      const result = draftItemSchema.safeParse(draft);
      expect(result.success).toBe(true);
    });
  });

  describe('draftsDataSchema', () => {
    it('should validate drafts data structure', () => {
      const data = {
        version: 1,
        updated_at: '2024-01-15T10:30:00Z',
        items: [],
      };

      const result = draftsDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate drafts with items', () => {
      const data = {
        version: 1,
        updated_at: '2024-01-15T10:30:00Z',
        items: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            type: 'single',
            content: 'Test content',
            media: null,
            created_at: '2024-01-15T08:00:00Z',
            updated_at: '2024-01-15T08:00:00Z',
            metadata: {},
          },
        ],
      };

      const result = draftsDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});

describe('DraftsStorage', () => {
  let testDataDir: string;
  let draftsStorage: DraftsStorage;

  beforeEach(() => {
    resetStorage();
    resetDraftsStorage();
    resetQueueStorage();
    testDataDir = path.join(
      os.tmpdir(),
      `drafts-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    fs.mkdirSync(testDataDir, { recursive: true });
    draftsStorage = new DraftsStorage(testDataDir);
  });

  afterEach(() => {
    resetStorage();
    resetDraftsStorage();
    resetQueueStorage();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should create drafts storage with custom directory', () => {
      expect(draftsStorage).toBeDefined();
    });

    it('should return empty drafts for new storage', async () => {
      const drafts = await draftsStorage.getDrafts();
      expect(drafts.version).toBe(1);
      expect(drafts.items).toEqual([]);
    });
  });

  describe('saveDraft', () => {
    it('should save a single post draft', async () => {
      const draft: Omit<DraftItem, 'id' | 'created_at' | 'updated_at'> = {
        type: 'single',
        content: 'Test draft content',
        media: null,
        metadata: { topic: 'testing' },
      };

      const saved = await draftsStorage.saveDraft(draft);

      expect(saved.id).toBeDefined();
      expect(saved.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(saved.created_at).toBeDefined();
      expect(saved.updated_at).toBeDefined();
      expect(saved.content).toBe('Test draft content');
    });

    it('should save a thread draft', async () => {
      const draft: Omit<DraftItem, 'id' | 'created_at' | 'updated_at'> = {
        type: 'thread',
        content: ['Tweet 1', 'Tweet 2', 'Tweet 3'],
        media: null,
        metadata: {},
      };

      const saved = await draftsStorage.saveDraft(draft);

      expect(saved.type).toBe('thread');
      expect(saved.content).toEqual(['Tweet 1', 'Tweet 2', 'Tweet 3']);
    });

    it('should persist draft to file', async () => {
      await draftsStorage.saveDraft({
        type: 'single',
        content: 'Persisted draft content',
        media: null,
        metadata: {},
      });

      const filePath = path.join(testDataDir, 'drafts.json');
      expect(fs.existsSync(filePath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(data.items).toHaveLength(1);
      expect(data.items[0].content).toBe('Persisted draft content');
    });
  });

  describe('updateDraft', () => {
    it('should update draft content', async () => {
      const saved = await draftsStorage.saveDraft({
        type: 'single',
        content: 'Original content',
        media: null,
        metadata: {},
      });

      const updated = await draftsStorage.updateDraft(saved.id, {
        content: 'Updated content',
      });

      expect(updated?.content).toBe('Updated content');
    });

    it('should update draft metadata', async () => {
      const saved = await draftsStorage.saveDraft({
        type: 'single',
        content: 'Test content',
        media: null,
        metadata: { topic: 'original' },
      });

      const updated = await draftsStorage.updateDraft(saved.id, {
        metadata: { topic: 'updated', notes: 'new notes' },
      });

      expect(updated?.metadata.topic).toBe('updated');
      expect(updated?.metadata.notes).toBe('new notes');
    });

    it('should update updated_at timestamp', async () => {
      const saved = await draftsStorage.saveDraft({
        type: 'single',
        content: 'Test content',
        media: null,
        metadata: {},
      });

      const originalUpdatedAt = saved.updated_at;
      await new Promise((r) => setTimeout(r, 10)); // Small delay

      const updated = await draftsStorage.updateDraft(saved.id, {
        content: 'New content',
      });

      expect(updated?.updated_at).not.toBe(originalUpdatedAt);
      expect(new Date(updated!.updated_at) > new Date(originalUpdatedAt)).toBe(true);
    });

    it('should return null for non-existent ID', async () => {
      const updated = await draftsStorage.updateDraft('non-existent-id', {
        content: 'New content',
      });
      expect(updated).toBeNull();
    });

    it('should persist updates to file', async () => {
      const saved = await draftsStorage.saveDraft({
        type: 'single',
        content: 'To be updated',
        media: null,
        metadata: {},
      });

      await draftsStorage.updateDraft(saved.id, { content: 'Updated content' });

      const filePath = path.join(testDataDir, 'drafts.json');
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(data.items[0].content).toBe('Updated content');
    });
  });

  describe('deleteDraft', () => {
    it('should delete draft by ID', async () => {
      const saved = await draftsStorage.saveDraft({
        type: 'single',
        content: 'To be deleted',
        media: null,
        metadata: {},
      });

      await draftsStorage.deleteDraft(saved.id);

      const drafts = await draftsStorage.getDrafts();
      expect(drafts.items).toHaveLength(0);
    });

    it('should not throw for non-existent ID', async () => {
      await expect(draftsStorage.deleteDraft('non-existent-id')).resolves.not.toThrow();
    });

    it('should only delete specified draft', async () => {
      await draftsStorage.saveDraft({
        type: 'single',
        content: 'Draft 1',
        media: null,
        metadata: {},
      });

      const draft2 = await draftsStorage.saveDraft({
        type: 'single',
        content: 'Draft 2',
        media: null,
        metadata: {},
      });

      await draftsStorage.deleteDraft(draft2.id);

      const drafts = await draftsStorage.getDrafts();
      expect(drafts.items).toHaveLength(1);
      expect(drafts.items[0].content).toBe('Draft 1');
    });
  });

  describe('listDrafts', () => {
    beforeEach(async () => {
      await draftsStorage.saveDraft({
        type: 'single',
        content: 'Draft 1',
        media: null,
        metadata: { topic: 'AI' },
      });

      await draftsStorage.saveDraft({
        type: 'thread',
        content: ['Tweet 1', 'Tweet 2'],
        media: null,
        metadata: { topic: 'ML' },
      });

      await draftsStorage.saveDraft({
        type: 'single',
        content: 'Draft 3',
        media: ['image-1'],
        metadata: { topic: 'AI' },
      });
    });

    it('should return all drafts', async () => {
      const drafts = await draftsStorage.listDrafts();
      expect(drafts).toHaveLength(3);
    });

    it('should return drafts in order of creation', async () => {
      const drafts = await draftsStorage.listDrafts();
      expect(drafts[0].content).toBe('Draft 1');
      expect(drafts[2].content).toBe('Draft 3');
    });
  });

  describe('getDraft', () => {
    it('should return draft by ID', async () => {
      const saved = await draftsStorage.saveDraft({
        type: 'single',
        content: 'Test draft',
        media: null,
        metadata: {},
      });

      const draft = await draftsStorage.getDraft(saved.id);
      expect(draft).toBeDefined();
      expect(draft?.content).toBe('Test draft');
    });

    it('should return null for non-existent ID', async () => {
      const draft = await draftsStorage.getDraft('non-existent-id');
      expect(draft).toBeNull();
    });
  });

  describe('moveDraftToQueue', () => {
    it('should move draft to queue with pending status', async () => {
      const queueStorage = new QueueStorage(testDataDir);

      const saved = await draftsStorage.saveDraft({
        type: 'single',
        content: 'Draft to queue',
        media: null,
        metadata: { topic: 'testing' },
      });

      const queueItem = await draftsStorage.moveDraftToQueue(saved.id, {
        confidence_score: 0.85,
        source: 'manual',
        scheduled_at: '2024-01-20T10:00:00Z',
      });

      expect(queueItem).toBeDefined();
      expect(queueItem?.content).toBe('Draft to queue');
      expect(queueItem?.status).toBe('pending');
      expect(queueItem?.confidence_score).toBe(0.85);
      expect(queueItem?.source).toBe('manual');
      expect(queueItem?.scheduled_at).toBe('2024-01-20T10:00:00Z');

      // Draft should be deleted
      const draft = await draftsStorage.getDraft(saved.id);
      expect(draft).toBeNull();

      // Queue should have the item
      const queue = await queueStorage.getQueue();
      expect(queue.items).toHaveLength(1);
      expect(queue.items[0].content).toBe('Draft to queue');
    });

    it('should move thread draft to queue', async () => {
      const queueStorage = new QueueStorage(testDataDir);

      const saved = await draftsStorage.saveDraft({
        type: 'thread',
        content: ['Tweet 1', 'Tweet 2', 'Tweet 3'],
        media: null,
        metadata: {},
      });

      const queueItem = await draftsStorage.moveDraftToQueue(saved.id, {
        confidence_score: 0.75,
        source: 'manual',
      });

      expect(queueItem?.type).toBe('thread');
      expect(queueItem?.content).toEqual(['Tweet 1', 'Tweet 2', 'Tweet 3']);

      const queue = await queueStorage.getQueue();
      expect(queue.items[0].type).toBe('thread');
    });

    it('should preserve media when moving to queue', async () => {
      const queueStorage = new QueueStorage(testDataDir);

      const saved = await draftsStorage.saveDraft({
        type: 'single',
        content: 'Draft with media',
        media: ['image-1', 'image-2'],
        metadata: {},
      });

      const queueItem = await draftsStorage.moveDraftToQueue(saved.id, {
        confidence_score: 0.9,
        source: 'manual',
      });

      expect(queueItem?.media).toEqual(['image-1', 'image-2']);

      const queue = await queueStorage.getQueue();
      expect(queue.items[0].media).toEqual(['image-1', 'image-2']);
    });

    it('should preserve metadata when moving to queue', async () => {
      const saved = await draftsStorage.saveDraft({
        type: 'single',
        content: 'Draft with metadata',
        media: null,
        metadata: { topic: 'AI', notes: 'Important' },
      });

      const queueItem = await draftsStorage.moveDraftToQueue(saved.id, {
        confidence_score: 0.8,
        source: 'manual',
      });

      expect(queueItem?.metadata.topic).toBe('AI');
      expect(queueItem?.metadata.notes).toBe('Important');
    });

    it('should return null for non-existent draft ID', async () => {
      const queueItem = await draftsStorage.moveDraftToQueue('non-existent-id', {
        confidence_score: 0.5,
        source: 'manual',
      });

      expect(queueItem).toBeNull();
    });

    it('should use pending_review status when confidence is low', async () => {
      const queueStorage = new QueueStorage(testDataDir);

      const saved = await draftsStorage.saveDraft({
        type: 'single',
        content: 'Low confidence draft',
        media: null,
        metadata: {},
      });

      const queueItem = await draftsStorage.moveDraftToQueue(saved.id, {
        confidence_score: 0.5,
        source: 'manual',
        status: 'pending_review',
      });

      expect(queueItem?.status).toBe('pending_review');

      const queue = await queueStorage.getQueue();
      expect(queue.items[0].status).toBe('pending_review');
    });
  });

  describe('drafts persistence and reload', () => {
    it('should persist and reload drafts data', async () => {
      await draftsStorage.saveDraft({
        type: 'single',
        content: 'Persisted draft',
        media: null,
        metadata: { topic: 'testing' },
      });

      // Create new instance to force reload from file
      const newDraftsStorage = new DraftsStorage(testDataDir);
      const drafts = await newDraftsStorage.getDrafts();

      expect(drafts.items).toHaveLength(1);
      expect(drafts.items[0].content).toBe('Persisted draft');
      expect(drafts.items[0].metadata.topic).toBe('testing');
    });
  });

  describe('drafts updated_at tracking', () => {
    it('should update updated_at on save', async () => {
      const before = new Date().toISOString();

      await draftsStorage.saveDraft({
        type: 'single',
        content: 'Test',
        media: null,
        metadata: {},
      });

      const drafts = await draftsStorage.getDrafts();
      expect(drafts.updated_at >= before).toBe(true);
    });

    it('should update updated_at on delete', async () => {
      const saved = await draftsStorage.saveDraft({
        type: 'single',
        content: 'Test',
        media: null,
        metadata: {},
      });

      const before = new Date().toISOString();
      await new Promise((r) => setTimeout(r, 10)); // Small delay

      await draftsStorage.deleteDraft(saved.id);

      const drafts = await draftsStorage.getDrafts();
      expect(drafts.updated_at >= before).toBe(true);
    });

    it('should update updated_at on update', async () => {
      const saved = await draftsStorage.saveDraft({
        type: 'single',
        content: 'Test',
        media: null,
        metadata: {},
      });

      const before = new Date().toISOString();
      await new Promise((r) => setTimeout(r, 10)); // Small delay

      await draftsStorage.updateDraft(saved.id, { content: 'Updated' });

      const drafts = await draftsStorage.getDrafts();
      expect(drafts.updated_at >= before).toBe(true);
    });
  });
});

describe('getDraftsStorage singleton', () => {
  let testDataDir: string;

  beforeEach(() => {
    resetStorage();
    resetDraftsStorage();
    testDataDir = path.join(
      os.tmpdir(),
      `drafts-singleton-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    fs.mkdirSync(testDataDir, { recursive: true });
  });

  afterEach(() => {
    resetStorage();
    resetDraftsStorage();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  it('should return singleton instance', () => {
    const ds1 = getDraftsStorage(testDataDir);
    const ds2 = getDraftsStorage();

    expect(ds1).toBe(ds2);
  });

  it('should reset singleton correctly', () => {
    const ds1 = getDraftsStorage(testDataDir);
    resetDraftsStorage();
    const ds2 = getDraftsStorage(testDataDir);

    expect(ds1).not.toBe(ds2);
  });
});
