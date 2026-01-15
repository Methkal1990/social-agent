/**
 * Network data storage for social networking features.
 *
 * Provides operations for managing suggested follows, engagement targets,
 * and community data with Zod validation and persistence to network.json.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';

import { Storage, getStorage } from '@/storage/index.js';

/**
 * Status for suggested follows.
 */
export const suggestedFollowStatusSchema = z.enum([
  'pending',
  'followed',
  'ignored',
  'unfollowed',
]);
export type SuggestedFollowStatus = z.infer<typeof suggestedFollowStatusSchema>;

/**
 * Suggested follow schema.
 */
export const suggestedFollowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  username: z.string(),
  display_name: z.string(),
  reason: z.string(),
  relevance_score: z.number().min(0).max(1),
  discovered_at: z.string(),
  status: suggestedFollowStatusSchema,
  followed_at: z.string().optional(),
  follow_back: z.boolean().optional(),
});
export type SuggestedFollow = z.infer<typeof suggestedFollowSchema>;

/**
 * Priority levels for engagement targets.
 */
export const engagementPrioritySchema = z.enum(['low', 'medium', 'high']);
export type EngagementPriority = z.infer<typeof engagementPrioritySchema>;

/**
 * Relationship stages for engagement targets.
 */
export const relationshipStageSchema = z.enum([
  'new',
  'aware',
  'engaged',
  'connected',
]);
export type RelationshipStage = z.infer<typeof relationshipStageSchema>;

/**
 * Engagement target schema.
 */
export const engagementTargetSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  username: z.string(),
  display_name: z.string(),
  priority: engagementPrioritySchema,
  value_score: z.number().min(0).max(1),
  accessibility_score: z.number().min(0).max(1),
  interaction_count: z.number().int().min(0),
  last_interaction: z.string().optional(),
  relationship_stage: relationshipStageSchema,
  notes: z.string().optional(),
});
export type EngagementTarget = z.infer<typeof engagementTargetSchema>;

/**
 * Community schema.
 */
export const communitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  topics: z.array(z.string()).min(1),
  members: z.array(z.string()).min(1),
  leaders: z.array(z.string()),
  discovered_at: z.string(),
  engagement_strategy: z.string().optional(),
});
export type Community = z.infer<typeof communitySchema>;

/**
 * Network data file schema.
 */
export const networkDataSchema = z.object({
  version: z.number().default(1),
  updated_at: z.string(),
  suggested_follows: z.array(suggestedFollowSchema),
  engagement_targets: z.array(engagementTargetSchema),
  communities: z.array(communitySchema),
});
export type NetworkData = z.infer<typeof networkDataSchema>;

/**
 * Input for adding a new suggested follow.
 */
export interface AddSuggestedFollowInput {
  user_id: string;
  username: string;
  display_name: string;
  reason: string;
  relevance_score: number;
}

/**
 * Input for updating a suggested follow.
 */
export interface UpdateSuggestedFollowInput {
  status?: SuggestedFollowStatus;
  followed_at?: string;
  follow_back?: boolean;
}

/**
 * Input for adding a new engagement target.
 */
export interface AddEngagementTargetInput {
  user_id: string;
  username: string;
  display_name: string;
  priority: EngagementPriority;
  value_score: number;
  accessibility_score: number;
  notes?: string;
}

/**
 * Input for updating an engagement target.
 */
export interface UpdateEngagementTargetInput {
  priority?: EngagementPriority;
  value_score?: number;
  accessibility_score?: number;
  interaction_count?: number;
  last_interaction?: string;
  relationship_stage?: RelationshipStage;
  notes?: string;
}

/**
 * Input for adding a new community.
 */
export interface AddCommunityInput {
  name: string;
  description: string;
  topics: string[];
  members: string[];
  leaders: string[];
  engagement_strategy?: string;
}

/**
 * Input for updating a community.
 */
export interface UpdateCommunityInput {
  name?: string;
  description?: string;
  topics?: string[];
  members?: string[];
  leaders?: string[];
  engagement_strategy?: string;
}

/**
 * Default empty network data.
 */
function getDefaultNetworkData(): NetworkData {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    suggested_follows: [],
    engagement_targets: [],
    communities: [],
  };
}

/**
 * Network storage class for managing network data.
 */
export class NetworkStorage {
  private readonly storage: Storage;
  private readonly filePath: string;
  private cache: NetworkData | null = null;

  constructor(dataDir?: string) {
    this.storage = dataDir ? new Storage(dataDir) : getStorage();
    this.filePath = this.storage.getFilePath('network.json');
  }

  /**
   * Load network data from file.
   */
  private async load(): Promise<NetworkData> {
    if (this.cache) {
      return this.cache;
    }

    const data = await this.storage.loadWithRecovery<NetworkData>(
      this.filePath,
      getDefaultNetworkData()
    );

    // Validate and normalize
    const parsed = networkDataSchema.safeParse(data);
    if (parsed.success) {
      this.cache = parsed.data;
      return parsed.data;
    }

    // Invalid data - return default
    const defaultData = getDefaultNetworkData();
    this.cache = defaultData;
    return defaultData;
  }

  /**
   * Save network data to file.
   */
  private async save(data: NetworkData): Promise<void> {
    data.updated_at = new Date().toISOString();
    await this.storage.safeWrite(this.filePath, data);
    this.cache = data;
  }

  // =====================
  // Suggested Follows
  // =====================

  /**
   * Add a new suggested follow.
   * Skips if user_id already exists.
   */
  async addSuggestedFollow(
    input: AddSuggestedFollowInput
  ): Promise<SuggestedFollow> {
    const data = await this.load();

    // Check for existing user_id
    const existing = data.suggested_follows.find(
      (f) => f.user_id === input.user_id
    );
    if (existing) {
      return existing;
    }

    const follow: SuggestedFollow = {
      id: randomUUID(),
      user_id: input.user_id,
      username: input.username,
      display_name: input.display_name,
      reason: input.reason,
      relevance_score: input.relevance_score,
      discovered_at: new Date().toISOString(),
      status: 'pending',
    };

    data.suggested_follows.push(follow);
    await this.save(data);

    return follow;
  }

  /**
   * Get a suggested follow by ID.
   */
  async getSuggestedFollow(id: string): Promise<SuggestedFollow | null> {
    const data = await this.load();
    return data.suggested_follows.find((f) => f.id === id) ?? null;
  }

  /**
   * Get a suggested follow by user_id.
   */
  async getSuggestedFollowByUserId(
    userId: string
  ): Promise<SuggestedFollow | null> {
    const data = await this.load();
    return data.suggested_follows.find((f) => f.user_id === userId) ?? null;
  }

  /**
   * Update a suggested follow.
   */
  async updateSuggestedFollow(
    id: string,
    update: UpdateSuggestedFollowInput
  ): Promise<SuggestedFollow | null> {
    const data = await this.load();
    const index = data.suggested_follows.findIndex((f) => f.id === id);

    if (index === -1) {
      return null;
    }

    data.suggested_follows[index] = {
      ...data.suggested_follows[index],
      ...update,
    };

    await this.save(data);
    return data.suggested_follows[index];
  }

  /**
   * Get suggested follows by status.
   */
  async getSuggestedFollowsByStatus(
    status: SuggestedFollowStatus
  ): Promise<SuggestedFollow[]> {
    const data = await this.load();
    return data.suggested_follows.filter((f) => f.status === status);
  }

  /**
   * Remove a suggested follow by ID.
   */
  async removeSuggestedFollow(id: string): Promise<boolean> {
    const data = await this.load();
    const index = data.suggested_follows.findIndex((f) => f.id === id);

    if (index === -1) {
      return false;
    }

    data.suggested_follows.splice(index, 1);
    await this.save(data);

    return true;
  }

  // =====================
  // Engagement Targets
  // =====================

  /**
   * Add a new engagement target.
   * Skips if user_id already exists.
   */
  async addEngagementTarget(
    input: AddEngagementTargetInput
  ): Promise<EngagementTarget> {
    const data = await this.load();

    // Check for existing user_id
    const existing = data.engagement_targets.find(
      (t) => t.user_id === input.user_id
    );
    if (existing) {
      return existing;
    }

    const target: EngagementTarget = {
      id: randomUUID(),
      user_id: input.user_id,
      username: input.username,
      display_name: input.display_name,
      priority: input.priority,
      value_score: input.value_score,
      accessibility_score: input.accessibility_score,
      interaction_count: 0,
      relationship_stage: 'new',
      notes: input.notes,
    };

    data.engagement_targets.push(target);
    await this.save(data);

    return target;
  }

  /**
   * Get an engagement target by ID.
   */
  async getEngagementTarget(id: string): Promise<EngagementTarget | null> {
    const data = await this.load();
    return data.engagement_targets.find((t) => t.id === id) ?? null;
  }

  /**
   * Update an engagement target.
   */
  async updateEngagementTarget(
    id: string,
    update: UpdateEngagementTargetInput
  ): Promise<EngagementTarget | null> {
    const data = await this.load();
    const index = data.engagement_targets.findIndex((t) => t.id === id);

    if (index === -1) {
      return null;
    }

    data.engagement_targets[index] = {
      ...data.engagement_targets[index],
      ...update,
    };

    await this.save(data);
    return data.engagement_targets[index];
  }

  /**
   * Get engagement targets by priority.
   */
  async getEngagementTargetsByPriority(
    priority: EngagementPriority
  ): Promise<EngagementTarget[]> {
    const data = await this.load();
    return data.engagement_targets.filter((t) => t.priority === priority);
  }

  /**
   * Record an interaction with a target.
   * Increments interaction_count and updates last_interaction.
   */
  async recordInteraction(id: string): Promise<EngagementTarget | null> {
    const data = await this.load();
    const index = data.engagement_targets.findIndex((t) => t.id === id);

    if (index === -1) {
      return null;
    }

    data.engagement_targets[index] = {
      ...data.engagement_targets[index],
      interaction_count: data.engagement_targets[index].interaction_count + 1,
      last_interaction: new Date().toISOString(),
    };

    await this.save(data);
    return data.engagement_targets[index];
  }

  // =====================
  // Communities
  // =====================

  /**
   * Add a new community.
   */
  async addCommunity(input: AddCommunityInput): Promise<Community> {
    const data = await this.load();

    const community: Community = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      topics: input.topics,
      members: input.members,
      leaders: input.leaders,
      discovered_at: new Date().toISOString(),
      engagement_strategy: input.engagement_strategy,
    };

    data.communities.push(community);
    await this.save(data);

    return community;
  }

  /**
   * Get a community by ID.
   */
  async getCommunity(id: string): Promise<Community | null> {
    const data = await this.load();
    return data.communities.find((c) => c.id === id) ?? null;
  }

  /**
   * Update a community.
   */
  async updateCommunity(
    id: string,
    update: UpdateCommunityInput
  ): Promise<Community | null> {
    const data = await this.load();
    const index = data.communities.findIndex((c) => c.id === id);

    if (index === -1) {
      return null;
    }

    data.communities[index] = {
      ...data.communities[index],
      ...update,
    };

    await this.save(data);
    return data.communities[index];
  }

  /**
   * Get communities by topic.
   */
  async getCommunitiesByTopic(topic: string): Promise<Community[]> {
    const data = await this.load();
    return data.communities.filter((c) => c.topics.includes(topic));
  }

  /**
   * Remove a community by ID.
   */
  async removeCommunity(id: string): Promise<boolean> {
    const data = await this.load();
    const index = data.communities.findIndex((c) => c.id === id);

    if (index === -1) {
      return false;
    }

    data.communities.splice(index, 1);
    await this.save(data);

    return true;
  }

  // =====================
  // Analytics
  // =====================

  /**
   * Get follow back rate for followed accounts.
   */
  async getFollowBackRate(): Promise<number> {
    const data = await this.load();
    const followed = data.suggested_follows.filter(
      (f) => f.status === 'followed'
    );

    if (followed.length === 0) {
      return 0;
    }

    const followedBack = followed.filter((f) => f.follow_back === true);
    return followedBack.length / followed.length;
  }

  // =====================
  // Data Access
  // =====================

  /**
   * Get all network data.
   */
  async getNetworkData(): Promise<NetworkData> {
    return this.load();
  }
}

// Module-level singleton
let defaultNetworkStorage: NetworkStorage | null = null;

/**
 * Get the default network storage singleton.
 */
export function getNetworkStorage(dataDir?: string): NetworkStorage {
  if (!defaultNetworkStorage) {
    defaultNetworkStorage = new NetworkStorage(dataDir);
  }
  return defaultNetworkStorage;
}

/**
 * Reset the network storage singleton (for testing).
 */
export function resetNetworkStorage(): void {
  defaultNetworkStorage = null;
}
