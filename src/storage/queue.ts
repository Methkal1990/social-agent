/**
 * Queue data storage for content queue.
 *
 * Provides CRUD operations for queue items with Zod validation,
 * UUID generation, and persistence to queue.json.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';

import { Storage, getStorage } from '@/storage/index.js';

/**
 * Queue item status values.
 */
export const queueItemStatusSchema = z.enum([
  'pending',
  'pending_review',
  'approved',
  'rejected',
  'posted',
  'failed',
]);
export type QueueItemStatus = z.infer<typeof queueItemStatusSchema>;

/**
 * Queue item type values.
 */
export const queueItemTypeSchema = z.enum(['single', 'thread']);
export type QueueItemType = z.infer<typeof queueItemTypeSchema>;

/**
 * Queue item source values.
 */
export const queueItemSourceSchema = z.enum(['generated', 'manual', 'trend_based', 'repurposed']);
export type QueueItemSource = z.infer<typeof queueItemSourceSchema>;

/**
 * Queue item metadata schema.
 */
export const queueItemMetadataSchema = z
  .object({
    topic: z.string().optional(),
    content_type: z.string().optional(),
    generation_prompt: z.string().optional(),
    trend_reference: z.string().optional(),
  })
  .passthrough();

/**
 * Queue item schema.
 */
export const queueItemSchema = z.object({
  id: z.string().uuid(),
  type: queueItemTypeSchema,
  status: queueItemStatusSchema,
  content: z.union([z.string(), z.array(z.string())]),
  media: z.union([z.array(z.string()), z.null()]),
  scheduled_at: z.union([z.string(), z.null()]),
  created_at: z.string(),
  confidence_score: z.number().min(0).max(1),
  source: queueItemSourceSchema,
  metadata: queueItemMetadataSchema,
});
export type QueueItem = z.infer<typeof queueItemSchema>;

/**
 * Queue data file schema.
 */
export const queueDataSchema = z.object({
  version: z.number().default(1),
  updated_at: z.string(),
  items: z.array(queueItemSchema),
});
export type QueueData = z.infer<typeof queueDataSchema>;

/**
 * Input for adding a new queue item (id and created_at are auto-generated).
 */
export type QueueItemInput = Omit<QueueItem, 'id' | 'created_at'>;

/**
 * Default empty queue data.
 */
function getDefaultQueueData(): QueueData {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    items: [],
  };
}

/**
 * Queue storage class for managing content queue.
 */
export class QueueStorage {
  private readonly storage: Storage;
  private readonly filePath: string;
  private cache: QueueData | null = null;

  constructor(dataDir?: string) {
    this.storage = dataDir ? new Storage(dataDir) : getStorage();
    this.filePath = this.storage.getFilePath('queue.json');
  }

  /**
   * Load queue data from file.
   */
  private async load(): Promise<QueueData> {
    if (this.cache) {
      return this.cache;
    }

    const data = await this.storage.loadWithRecovery<QueueData>(
      this.filePath,
      getDefaultQueueData()
    );

    // Validate and normalize
    const parsed = queueDataSchema.safeParse(data);
    if (parsed.success) {
      this.cache = parsed.data;
      return parsed.data;
    }

    // Invalid data - return default
    const defaultData = getDefaultQueueData();
    this.cache = defaultData;
    return defaultData;
  }

  /**
   * Save queue data to file.
   */
  private async save(data: QueueData): Promise<void> {
    data.updated_at = new Date().toISOString();
    await this.storage.safeWrite(this.filePath, data);
    this.cache = data;
  }

  /**
   * Get all queue data.
   */
  async getQueue(): Promise<QueueData> {
    return this.load();
  }

  /**
   * Add a new item to the queue.
   */
  async addToQueue(input: QueueItemInput): Promise<QueueItem> {
    const data = await this.load();

    const item: QueueItem = {
      ...input,
      id: randomUUID(),
      created_at: new Date().toISOString(),
    };

    data.items.push(item);
    await this.save(data);

    return item;
  }

  /**
   * Remove an item from the queue by ID.
   */
  async removeFromQueue(id: string): Promise<void> {
    const data = await this.load();
    data.items = data.items.filter((item) => item.id !== id);
    await this.save(data);
  }

  /**
   * Update an existing queue item.
   */
  async updateQueueItem(
    id: string,
    updates: Partial<Omit<QueueItem, 'id' | 'created_at'>>
  ): Promise<QueueItem | null> {
    const data = await this.load();
    const index = data.items.findIndex((item) => item.id === id);

    if (index === -1) {
      return null;
    }

    data.items[index] = {
      ...data.items[index],
      ...updates,
    };

    await this.save(data);
    return data.items[index];
  }

  /**
   * Get queue items filtered by status.
   */
  async getQueueByStatus(status: QueueItemStatus): Promise<QueueItem[]> {
    const data = await this.load();
    return data.items.filter((item) => item.status === status);
  }

  /**
   * Get a single queue item by ID.
   */
  async getQueueItem(id: string): Promise<QueueItem | null> {
    const data = await this.load();
    return data.items.find((item) => item.id === id) ?? null;
  }
}

// Module-level singleton
let defaultQueueStorage: QueueStorage | null = null;

/**
 * Get the default queue storage singleton.
 */
export function getQueueStorage(dataDir?: string): QueueStorage {
  if (!defaultQueueStorage) {
    defaultQueueStorage = new QueueStorage(dataDir);
  }
  return defaultQueueStorage;
}

/**
 * Reset the queue storage singleton (for testing).
 */
export function resetQueueStorage(): void {
  defaultQueueStorage = null;
}
