/**
 * Drafts data storage for content drafts.
 *
 * Provides CRUD operations for draft items with Zod validation,
 * UUID generation, and persistence to drafts.json.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';

import { Storage, getStorage } from '@/storage/index.js';
import {
  QueueStorage,
  getQueueStorage,
  type QueueItemStatus,
  type QueueItemSource,
} from '@/storage/queue.js';

/**
 * Draft item type values.
 */
export const draftItemTypeSchema = z.enum(['single', 'thread']);
export type DraftItemType = z.infer<typeof draftItemTypeSchema>;

/**
 * Draft item metadata schema.
 */
export const draftItemMetadataSchema = z
  .object({
    topic: z.string().optional(),
    notes: z.string().optional(),
    content_type: z.string().optional(),
  })
  .passthrough();

/**
 * Draft item schema.
 */
export const draftItemSchema = z.object({
  id: z.string().uuid(),
  type: draftItemTypeSchema,
  content: z.union([z.string(), z.array(z.string())]),
  media: z.union([z.array(z.string()), z.null()]),
  created_at: z.string(),
  updated_at: z.string(),
  metadata: draftItemMetadataSchema,
});
export type DraftItem = z.infer<typeof draftItemSchema>;

/**
 * Drafts data file schema.
 */
export const draftsDataSchema = z.object({
  version: z.number().default(1),
  updated_at: z.string(),
  items: z.array(draftItemSchema),
});
export type DraftsData = z.infer<typeof draftsDataSchema>;

/**
 * Input for saving a new draft (id, created_at, updated_at are auto-generated).
 */
export type DraftItemInput = Omit<DraftItem, 'id' | 'created_at' | 'updated_at'>;

/**
 * Options for moving draft to queue.
 */
export interface MoveDraftToQueueOptions {
  confidence_score: number;
  source: QueueItemSource;
  scheduled_at?: string | null;
  status?: QueueItemStatus;
}

/**
 * Default empty drafts data.
 */
function getDefaultDraftsData(): DraftsData {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    items: [],
  };
}

/**
 * Drafts storage class for managing content drafts.
 */
export class DraftsStorage {
  private readonly storage: Storage;
  private readonly filePath: string;
  private readonly dataDir: string;
  private cache: DraftsData | null = null;

  constructor(dataDir?: string) {
    this.storage = dataDir ? new Storage(dataDir) : getStorage();
    this.dataDir = dataDir ?? '';
    this.filePath = this.storage.getFilePath('drafts.json');
  }

  /**
   * Load drafts data from file.
   */
  private async load(): Promise<DraftsData> {
    if (this.cache) {
      return this.cache;
    }

    const data = await this.storage.loadWithRecovery<DraftsData>(
      this.filePath,
      getDefaultDraftsData()
    );

    // Validate and normalize
    const parsed = draftsDataSchema.safeParse(data);
    if (parsed.success) {
      this.cache = parsed.data;
      return parsed.data;
    }

    // Invalid data - return default
    const defaultData = getDefaultDraftsData();
    this.cache = defaultData;
    return defaultData;
  }

  /**
   * Save drafts data to file.
   */
  private async save(data: DraftsData): Promise<void> {
    data.updated_at = new Date().toISOString();
    await this.storage.safeWrite(this.filePath, data);
    this.cache = data;
  }

  /**
   * Get all drafts data.
   */
  async getDrafts(): Promise<DraftsData> {
    return this.load();
  }

  /**
   * Save a new draft.
   */
  async saveDraft(input: DraftItemInput): Promise<DraftItem> {
    const data = await this.load();
    const now = new Date().toISOString();

    const item: DraftItem = {
      ...input,
      id: randomUUID(),
      created_at: now,
      updated_at: now,
    };

    data.items.push(item);
    await this.save(data);

    return item;
  }

  /**
   * Update an existing draft.
   */
  async updateDraft(
    id: string,
    updates: Partial<Omit<DraftItem, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<DraftItem | null> {
    const data = await this.load();
    const index = data.items.findIndex((item) => item.id === id);

    if (index === -1) {
      return null;
    }

    data.items[index] = {
      ...data.items[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await this.save(data);
    return data.items[index];
  }

  /**
   * Delete a draft by ID.
   */
  async deleteDraft(id: string): Promise<void> {
    const data = await this.load();
    data.items = data.items.filter((item) => item.id !== id);
    await this.save(data);
  }

  /**
   * List all drafts.
   */
  async listDrafts(): Promise<DraftItem[]> {
    const data = await this.load();
    return data.items;
  }

  /**
   * Get a single draft by ID.
   */
  async getDraft(id: string): Promise<DraftItem | null> {
    const data = await this.load();
    return data.items.find((item) => item.id === id) ?? null;
  }

  /**
   * Move a draft to the queue.
   * Removes the draft and creates a new queue item.
   */
  async moveDraftToQueue(
    id: string,
    options: MoveDraftToQueueOptions
  ): Promise<import('@/storage/queue.js').QueueItem | null> {
    const draft = await this.getDraft(id);
    if (!draft) {
      return null;
    }

    // Get queue storage (use same dataDir if specified)
    const queueStorage = this.dataDir ? new QueueStorage(this.dataDir) : getQueueStorage();

    // Create queue item from draft
    const queueItem = await queueStorage.addToQueue({
      type: draft.type,
      status: options.status ?? 'pending',
      content: draft.content,
      media: draft.media,
      scheduled_at: options.scheduled_at ?? null,
      confidence_score: options.confidence_score,
      source: options.source,
      metadata: draft.metadata,
    });

    // Delete the draft
    await this.deleteDraft(id);

    return queueItem;
  }
}

// Module-level singleton
let defaultDraftsStorage: DraftsStorage | null = null;

/**
 * Get the default drafts storage singleton.
 */
export function getDraftsStorage(dataDir?: string): DraftsStorage {
  if (!defaultDraftsStorage) {
    defaultDraftsStorage = new DraftsStorage(dataDir);
  }
  return defaultDraftsStorage;
}

/**
 * Reset the drafts storage singleton (for testing).
 */
export function resetDraftsStorage(): void {
  defaultDraftsStorage = null;
}
