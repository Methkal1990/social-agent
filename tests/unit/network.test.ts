import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  suggestedFollowSchema,
  engagementTargetSchema,
  communitySchema,
  networkDataSchema,
  NetworkStorage,
  getNetworkStorage,
  resetNetworkStorage,
} from '@/storage/network.js';
import { resetStorage } from '@/storage/index.js';

describe('Network Schemas', () => {
  describe('suggestedFollowSchema', () => {
    it('should validate valid suggested follow', () => {
      const follow = {
        id: 'uuid-123',
        user_id: 'user-456',
        username: 'testuser',
        display_name: 'Test User',
        reason: 'Influential in AI space',
        relevance_score: 0.85,
        discovered_at: '2024-01-14T14:00:00Z',
        status: 'pending',
      };

      const result = suggestedFollowSchema.safeParse(follow);
      expect(result.success).toBe(true);
    });

    it('should require user_id', () => {
      const follow = {
        id: 'uuid-123',
        username: 'testuser',
        display_name: 'Test User',
        reason: 'Influential',
        relevance_score: 0.85,
        discovered_at: '2024-01-14T14:00:00Z',
        status: 'pending',
      };

      const result = suggestedFollowSchema.safeParse(follow);
      expect(result.success).toBe(false);
    });

    it('should require username', () => {
      const follow = {
        id: 'uuid-123',
        user_id: 'user-456',
        display_name: 'Test User',
        reason: 'Influential',
        relevance_score: 0.85,
        discovered_at: '2024-01-14T14:00:00Z',
        status: 'pending',
      };

      const result = suggestedFollowSchema.safeParse(follow);
      expect(result.success).toBe(false);
    });

    it('should validate relevance_score between 0 and 1', () => {
      const follow = {
        id: 'uuid-123',
        user_id: 'user-456',
        username: 'testuser',
        display_name: 'Test User',
        reason: 'Influential',
        relevance_score: 1.5,
        discovered_at: '2024-01-14T14:00:00Z',
        status: 'pending',
      };

      const result = suggestedFollowSchema.safeParse(follow);
      expect(result.success).toBe(false);
    });

    it('should validate status enum values', () => {
      const validStatuses = ['pending', 'followed', 'ignored', 'unfollowed'];

      for (const status of validStatuses) {
        const follow = {
          id: 'uuid-123',
          user_id: 'user-456',
          username: 'testuser',
          display_name: 'Test User',
          reason: 'Influential',
          relevance_score: 0.5,
          discovered_at: '2024-01-14T14:00:00Z',
          status,
        };

        const result = suggestedFollowSchema.safeParse(follow);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const follow = {
        id: 'uuid-123',
        user_id: 'user-456',
        username: 'testuser',
        display_name: 'Test User',
        reason: 'Influential',
        relevance_score: 0.5,
        discovered_at: '2024-01-14T14:00:00Z',
        status: 'invalid_status',
      };

      const result = suggestedFollowSchema.safeParse(follow);
      expect(result.success).toBe(false);
    });

    it('should allow optional followed_at field', () => {
      const follow = {
        id: 'uuid-123',
        user_id: 'user-456',
        username: 'testuser',
        display_name: 'Test User',
        reason: 'Influential',
        relevance_score: 0.85,
        discovered_at: '2024-01-14T14:00:00Z',
        status: 'followed',
        followed_at: '2024-01-15T10:00:00Z',
      };

      const result = suggestedFollowSchema.safeParse(follow);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.followed_at).toBe('2024-01-15T10:00:00Z');
      }
    });

    it('should allow optional follow_back field', () => {
      const follow = {
        id: 'uuid-123',
        user_id: 'user-456',
        username: 'testuser',
        display_name: 'Test User',
        reason: 'Influential',
        relevance_score: 0.85,
        discovered_at: '2024-01-14T14:00:00Z',
        status: 'followed',
        follow_back: true,
      };

      const result = suggestedFollowSchema.safeParse(follow);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.follow_back).toBe(true);
      }
    });
  });

  describe('engagementTargetSchema', () => {
    it('should validate valid engagement target', () => {
      const target = {
        id: 'uuid-123',
        user_id: 'user-456',
        username: 'targetuser',
        display_name: 'Target User',
        priority: 'high',
        value_score: 0.9,
        accessibility_score: 0.7,
        interaction_count: 5,
        last_interaction: '2024-01-14T14:00:00Z',
        relationship_stage: 'engaged',
        notes: 'Key influencer in space',
      };

      const result = engagementTargetSchema.safeParse(target);
      expect(result.success).toBe(true);
    });

    it('should validate priority enum values', () => {
      const validPriorities = ['low', 'medium', 'high'];

      for (const priority of validPriorities) {
        const target = {
          id: 'uuid-123',
          user_id: 'user-456',
          username: 'targetuser',
          display_name: 'Target User',
          priority,
          value_score: 0.5,
          accessibility_score: 0.5,
          interaction_count: 0,
          relationship_stage: 'new',
        };

        const result = engagementTargetSchema.safeParse(target);
        expect(result.success).toBe(true);
      }
    });

    it('should validate relationship_stage enum values', () => {
      const validStages = ['new', 'aware', 'engaged', 'connected'];

      for (const stage of validStages) {
        const target = {
          id: 'uuid-123',
          user_id: 'user-456',
          username: 'targetuser',
          display_name: 'Target User',
          priority: 'medium',
          value_score: 0.5,
          accessibility_score: 0.5,
          interaction_count: 0,
          relationship_stage: stage,
        };

        const result = engagementTargetSchema.safeParse(target);
        expect(result.success).toBe(true);
      }
    });

    it('should reject value_score > 1', () => {
      const target = {
        id: 'uuid-123',
        user_id: 'user-456',
        username: 'targetuser',
        display_name: 'Target User',
        priority: 'high',
        value_score: 1.5,
        accessibility_score: 0.5,
        interaction_count: 0,
        relationship_stage: 'new',
      };

      const result = engagementTargetSchema.safeParse(target);
      expect(result.success).toBe(false);
    });

    it('should reject negative interaction_count', () => {
      const target = {
        id: 'uuid-123',
        user_id: 'user-456',
        username: 'targetuser',
        display_name: 'Target User',
        priority: 'high',
        value_score: 0.5,
        accessibility_score: 0.5,
        interaction_count: -1,
        relationship_stage: 'new',
      };

      const result = engagementTargetSchema.safeParse(target);
      expect(result.success).toBe(false);
    });

    it('should allow optional notes and last_interaction', () => {
      const target = {
        id: 'uuid-123',
        user_id: 'user-456',
        username: 'targetuser',
        display_name: 'Target User',
        priority: 'medium',
        value_score: 0.5,
        accessibility_score: 0.5,
        interaction_count: 0,
        relationship_stage: 'new',
      };

      const result = engagementTargetSchema.safeParse(target);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.notes).toBeUndefined();
        expect(result.data.last_interaction).toBeUndefined();
      }
    });
  });

  describe('communitySchema', () => {
    it('should validate valid community', () => {
      const community = {
        id: 'uuid-123',
        name: 'AI Enthusiasts',
        description: 'Community of AI practitioners',
        topics: ['AI', 'ML', 'deep-learning'],
        members: ['user-1', 'user-2', 'user-3'],
        leaders: ['user-1'],
        discovered_at: '2024-01-14T14:00:00Z',
        engagement_strategy: 'Share insights and participate in discussions',
      };

      const result = communitySchema.safeParse(community);
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const community = {
        id: 'uuid-123',
        description: 'Community description',
        topics: ['AI'],
        members: ['user-1'],
        leaders: [],
        discovered_at: '2024-01-14T14:00:00Z',
      };

      const result = communitySchema.safeParse(community);
      expect(result.success).toBe(false);
    });

    it('should require at least one topic', () => {
      const community = {
        id: 'uuid-123',
        name: 'Community Name',
        description: 'Description',
        topics: [],
        members: ['user-1'],
        leaders: [],
        discovered_at: '2024-01-14T14:00:00Z',
      };

      const result = communitySchema.safeParse(community);
      expect(result.success).toBe(false);
    });

    it('should require at least one member', () => {
      const community = {
        id: 'uuid-123',
        name: 'Community Name',
        description: 'Description',
        topics: ['AI'],
        members: [],
        leaders: [],
        discovered_at: '2024-01-14T14:00:00Z',
      };

      const result = communitySchema.safeParse(community);
      expect(result.success).toBe(false);
    });

    it('should allow optional engagement_strategy', () => {
      const community = {
        id: 'uuid-123',
        name: 'Community Name',
        description: 'Description',
        topics: ['AI'],
        members: ['user-1'],
        leaders: [],
        discovered_at: '2024-01-14T14:00:00Z',
      };

      const result = communitySchema.safeParse(community);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.engagement_strategy).toBeUndefined();
      }
    });
  });

  describe('networkDataSchema', () => {
    it('should validate valid network data', () => {
      const data = {
        version: 1,
        updated_at: '2024-01-15T10:30:00Z',
        suggested_follows: [],
        engagement_targets: [],
        communities: [],
      };

      const result = networkDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should use default version of 1', () => {
      const data = {
        updated_at: '2024-01-15T10:30:00Z',
        suggested_follows: [],
        engagement_targets: [],
        communities: [],
      };

      const result = networkDataSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe(1);
      }
    });

    it('should validate nested suggested_follows', () => {
      const data = {
        version: 1,
        updated_at: '2024-01-15T10:30:00Z',
        suggested_follows: [
          {
            id: 'uuid-123',
            user_id: 'user-456',
            username: 'testuser',
            display_name: 'Test User',
            reason: 'Influential',
            relevance_score: 0.85,
            discovered_at: '2024-01-14T14:00:00Z',
            status: 'pending',
          },
        ],
        engagement_targets: [],
        communities: [],
      };

      const result = networkDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});

describe('NetworkStorage', () => {
  let tempDir: string;
  let storage: NetworkStorage;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'network-test-'));
    storage = new NetworkStorage(tempDir);
  });

  afterEach(() => {
    resetNetworkStorage();
    resetStorage();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('addSuggestedFollow', () => {
    it('should add a new suggested follow', async () => {
      const follow = await storage.addSuggestedFollow({
        user_id: 'user-123',
        username: 'aiexpert',
        display_name: 'AI Expert',
        reason: 'Leading voice in AI',
        relevance_score: 0.9,
      });

      expect(follow.id).toBeDefined();
      expect(follow.user_id).toBe('user-123');
      expect(follow.username).toBe('aiexpert');
      expect(follow.status).toBe('pending');
      expect(follow.discovered_at).toBeDefined();
    });

    it('should generate unique IDs for each follow', async () => {
      const follow1 = await storage.addSuggestedFollow({
        user_id: 'user-1',
        username: 'user1',
        display_name: 'User 1',
        reason: 'Reason 1',
        relevance_score: 0.5,
      });

      const follow2 = await storage.addSuggestedFollow({
        user_id: 'user-2',
        username: 'user2',
        display_name: 'User 2',
        reason: 'Reason 2',
        relevance_score: 0.6,
      });

      expect(follow1.id).not.toBe(follow2.id);
    });

    it('should persist follows to storage', async () => {
      await storage.addSuggestedFollow({
        user_id: 'user-123',
        username: 'persisted',
        display_name: 'Persisted User',
        reason: 'Testing persistence',
        relevance_score: 0.7,
      });

      const newStorage = new NetworkStorage(tempDir);
      const data = await newStorage.getNetworkData();

      expect(data.suggested_follows).toHaveLength(1);
      expect(data.suggested_follows[0].username).toBe('persisted');
    });

    it('should not add duplicate user_id', async () => {
      await storage.addSuggestedFollow({
        user_id: 'user-123',
        username: 'user1',
        display_name: 'User 1',
        reason: 'First add',
        relevance_score: 0.5,
      });

      await storage.addSuggestedFollow({
        user_id: 'user-123',
        username: 'user1updated',
        display_name: 'User 1 Updated',
        reason: 'Second add',
        relevance_score: 0.6,
      });

      const data = await storage.getNetworkData();
      expect(data.suggested_follows).toHaveLength(1);
    });
  });

  describe('getSuggestedFollow', () => {
    it('should retrieve a follow by ID', async () => {
      const added = await storage.addSuggestedFollow({
        user_id: 'user-123',
        username: 'findable',
        display_name: 'Findable User',
        reason: 'Testing retrieval',
        relevance_score: 0.8,
      });

      const found = await storage.getSuggestedFollow(added.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(added.id);
      expect(found?.username).toBe('findable');
    });

    it('should return null for non-existent ID', async () => {
      const found = await storage.getSuggestedFollow('non-existent');

      expect(found).toBeNull();
    });
  });

  describe('getSuggestedFollowByUserId', () => {
    it('should retrieve a follow by user_id', async () => {
      await storage.addSuggestedFollow({
        user_id: 'twitter-user-456',
        username: 'twitteruser',
        display_name: 'Twitter User',
        reason: 'Testing user_id lookup',
        relevance_score: 0.75,
      });

      const found = await storage.getSuggestedFollowByUserId('twitter-user-456');

      expect(found).not.toBeNull();
      expect(found?.user_id).toBe('twitter-user-456');
    });

    it('should return null for non-existent user_id', async () => {
      const found = await storage.getSuggestedFollowByUserId('non-existent');

      expect(found).toBeNull();
    });
  });

  describe('updateSuggestedFollow', () => {
    it('should update follow status', async () => {
      const follow = await storage.addSuggestedFollow({
        user_id: 'user-123',
        username: 'tofollow',
        display_name: 'To Follow',
        reason: 'Testing update',
        relevance_score: 0.8,
      });

      const updated = await storage.updateSuggestedFollow(follow.id, {
        status: 'followed',
        followed_at: new Date().toISOString(),
      });

      expect(updated).not.toBeNull();
      expect(updated?.status).toBe('followed');
      expect(updated?.followed_at).toBeDefined();
    });

    it('should update follow_back status', async () => {
      const follow = await storage.addSuggestedFollow({
        user_id: 'user-123',
        username: 'followback',
        display_name: 'Follow Back',
        reason: 'Testing follow back',
        relevance_score: 0.9,
      });

      const updated = await storage.updateSuggestedFollow(follow.id, {
        status: 'followed',
        follow_back: true,
      });

      expect(updated?.follow_back).toBe(true);
    });

    it('should return null for non-existent ID', async () => {
      const updated = await storage.updateSuggestedFollow('non-existent', {
        status: 'ignored',
      });

      expect(updated).toBeNull();
    });

    it('should persist updates', async () => {
      const follow = await storage.addSuggestedFollow({
        user_id: 'user-123',
        username: 'persistent',
        display_name: 'Persistent',
        reason: 'Testing persistence',
        relevance_score: 0.7,
      });

      await storage.updateSuggestedFollow(follow.id, { status: 'ignored' });

      const newStorage = new NetworkStorage(tempDir);
      const found = await newStorage.getSuggestedFollow(follow.id);

      expect(found?.status).toBe('ignored');
    });
  });

  describe('getSuggestedFollowsByStatus', () => {
    beforeEach(async () => {
      await storage.addSuggestedFollow({
        user_id: 'user-1',
        username: 'pending1',
        display_name: 'Pending 1',
        reason: 'Test',
        relevance_score: 0.5,
      });

      const follow2 = await storage.addSuggestedFollow({
        user_id: 'user-2',
        username: 'followed1',
        display_name: 'Followed 1',
        reason: 'Test',
        relevance_score: 0.6,
      });
      await storage.updateSuggestedFollow(follow2.id, { status: 'followed' });

      await storage.addSuggestedFollow({
        user_id: 'user-3',
        username: 'pending2',
        display_name: 'Pending 2',
        reason: 'Test',
        relevance_score: 0.7,
      });
    });

    it('should filter by pending status', async () => {
      const pending = await storage.getSuggestedFollowsByStatus('pending');

      expect(pending).toHaveLength(2);
      expect(pending.every((f) => f.status === 'pending')).toBe(true);
    });

    it('should filter by followed status', async () => {
      const followed = await storage.getSuggestedFollowsByStatus('followed');

      expect(followed).toHaveLength(1);
      expect(followed[0].username).toBe('followed1');
    });
  });

  describe('removeSuggestedFollow', () => {
    it('should remove a follow by ID', async () => {
      const follow = await storage.addSuggestedFollow({
        user_id: 'user-123',
        username: 'toremove',
        display_name: 'To Remove',
        reason: 'Testing removal',
        relevance_score: 0.5,
      });

      const removed = await storage.removeSuggestedFollow(follow.id);

      expect(removed).toBe(true);

      const found = await storage.getSuggestedFollow(follow.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent ID', async () => {
      const removed = await storage.removeSuggestedFollow('non-existent');

      expect(removed).toBe(false);
    });
  });

  describe('addEngagementTarget', () => {
    it('should add a new engagement target', async () => {
      const target = await storage.addEngagementTarget({
        user_id: 'user-123',
        username: 'influencer',
        display_name: 'Top Influencer',
        priority: 'high',
        value_score: 0.95,
        accessibility_score: 0.6,
      });

      expect(target.id).toBeDefined();
      expect(target.user_id).toBe('user-123');
      expect(target.priority).toBe('high');
      expect(target.interaction_count).toBe(0);
      expect(target.relationship_stage).toBe('new');
    });

    it('should persist targets to storage', async () => {
      await storage.addEngagementTarget({
        user_id: 'user-123',
        username: 'persisted',
        display_name: 'Persisted Target',
        priority: 'medium',
        value_score: 0.7,
        accessibility_score: 0.8,
      });

      const newStorage = new NetworkStorage(tempDir);
      const data = await newStorage.getNetworkData();

      expect(data.engagement_targets).toHaveLength(1);
    });

    it('should not add duplicate user_id', async () => {
      await storage.addEngagementTarget({
        user_id: 'user-123',
        username: 'user1',
        display_name: 'User 1',
        priority: 'low',
        value_score: 0.5,
        accessibility_score: 0.5,
      });

      await storage.addEngagementTarget({
        user_id: 'user-123',
        username: 'user1updated',
        display_name: 'User 1 Updated',
        priority: 'high',
        value_score: 0.9,
        accessibility_score: 0.9,
      });

      const data = await storage.getNetworkData();
      expect(data.engagement_targets).toHaveLength(1);
    });
  });

  describe('getEngagementTarget', () => {
    it('should retrieve a target by ID', async () => {
      const added = await storage.addEngagementTarget({
        user_id: 'user-123',
        username: 'findable',
        display_name: 'Findable Target',
        priority: 'medium',
        value_score: 0.7,
        accessibility_score: 0.6,
      });

      const found = await storage.getEngagementTarget(added.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(added.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await storage.getEngagementTarget('non-existent');

      expect(found).toBeNull();
    });
  });

  describe('updateEngagementTarget', () => {
    it('should update target fields', async () => {
      const target = await storage.addEngagementTarget({
        user_id: 'user-123',
        username: 'updateme',
        display_name: 'Update Me',
        priority: 'low',
        value_score: 0.5,
        accessibility_score: 0.5,
      });

      const updated = await storage.updateEngagementTarget(target.id, {
        priority: 'high',
        relationship_stage: 'engaged',
        interaction_count: 10,
        last_interaction: new Date().toISOString(),
        notes: 'Had great conversation',
      });

      expect(updated).not.toBeNull();
      expect(updated?.priority).toBe('high');
      expect(updated?.relationship_stage).toBe('engaged');
      expect(updated?.interaction_count).toBe(10);
      expect(updated?.notes).toBe('Had great conversation');
    });

    it('should return null for non-existent ID', async () => {
      const updated = await storage.updateEngagementTarget('non-existent', {
        priority: 'high',
      });

      expect(updated).toBeNull();
    });
  });

  describe('getEngagementTargetsByPriority', () => {
    beforeEach(async () => {
      await storage.addEngagementTarget({
        user_id: 'user-1',
        username: 'high1',
        display_name: 'High 1',
        priority: 'high',
        value_score: 0.9,
        accessibility_score: 0.8,
      });

      await storage.addEngagementTarget({
        user_id: 'user-2',
        username: 'low1',
        display_name: 'Low 1',
        priority: 'low',
        value_score: 0.3,
        accessibility_score: 0.9,
      });

      await storage.addEngagementTarget({
        user_id: 'user-3',
        username: 'high2',
        display_name: 'High 2',
        priority: 'high',
        value_score: 0.95,
        accessibility_score: 0.7,
      });
    });

    it('should filter by high priority', async () => {
      const high = await storage.getEngagementTargetsByPriority('high');

      expect(high).toHaveLength(2);
      expect(high.every((t) => t.priority === 'high')).toBe(true);
    });

    it('should filter by low priority', async () => {
      const low = await storage.getEngagementTargetsByPriority('low');

      expect(low).toHaveLength(1);
      expect(low[0].username).toBe('low1');
    });
  });

  describe('recordInteraction', () => {
    it('should increment interaction count', async () => {
      const target = await storage.addEngagementTarget({
        user_id: 'user-123',
        username: 'interact',
        display_name: 'Interact With',
        priority: 'medium',
        value_score: 0.7,
        accessibility_score: 0.7,
      });

      const updated = await storage.recordInteraction(target.id);

      expect(updated).not.toBeNull();
      expect(updated?.interaction_count).toBe(1);
      expect(updated?.last_interaction).toBeDefined();
    });

    it('should increment from existing count', async () => {
      const target = await storage.addEngagementTarget({
        user_id: 'user-123',
        username: 'multiinteract',
        display_name: 'Multi Interact',
        priority: 'medium',
        value_score: 0.7,
        accessibility_score: 0.7,
      });

      await storage.recordInteraction(target.id);
      await storage.recordInteraction(target.id);
      const updated = await storage.recordInteraction(target.id);

      expect(updated?.interaction_count).toBe(3);
    });
  });

  describe('addCommunity', () => {
    it('should add a new community', async () => {
      const community = await storage.addCommunity({
        name: 'AI Builders',
        description: 'Community of AI application developers',
        topics: ['AI', 'development', 'startups'],
        members: ['user-1', 'user-2'],
        leaders: ['user-1'],
      });

      expect(community.id).toBeDefined();
      expect(community.name).toBe('AI Builders');
      expect(community.topics).toContain('AI');
      expect(community.members).toHaveLength(2);
      expect(community.discovered_at).toBeDefined();
    });

    it('should persist communities to storage', async () => {
      await storage.addCommunity({
        name: 'Persisted Community',
        description: 'Testing persistence',
        topics: ['testing'],
        members: ['user-1'],
        leaders: [],
      });

      const newStorage = new NetworkStorage(tempDir);
      const data = await newStorage.getNetworkData();

      expect(data.communities).toHaveLength(1);
      expect(data.communities[0].name).toBe('Persisted Community');
    });

    it('should allow optional engagement_strategy', async () => {
      const community = await storage.addCommunity({
        name: 'Strategy Community',
        description: 'Has engagement strategy',
        topics: ['strategy'],
        members: ['user-1'],
        leaders: [],
        engagement_strategy: 'Be helpful and share insights',
      });

      expect(community.engagement_strategy).toBe('Be helpful and share insights');
    });
  });

  describe('getCommunity', () => {
    it('should retrieve a community by ID', async () => {
      const added = await storage.addCommunity({
        name: 'Findable Community',
        description: 'Can be found',
        topics: ['find'],
        members: ['user-1'],
        leaders: [],
      });

      const found = await storage.getCommunity(added.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(added.id);
      expect(found?.name).toBe('Findable Community');
    });

    it('should return null for non-existent ID', async () => {
      const found = await storage.getCommunity('non-existent');

      expect(found).toBeNull();
    });
  });

  describe('updateCommunity', () => {
    it('should update community fields', async () => {
      const community = await storage.addCommunity({
        name: 'Update Community',
        description: 'Original description',
        topics: ['original'],
        members: ['user-1'],
        leaders: [],
      });

      const updated = await storage.updateCommunity(community.id, {
        description: 'Updated description',
        members: ['user-1', 'user-2', 'user-3'],
        engagement_strategy: 'New strategy',
      });

      expect(updated).not.toBeNull();
      expect(updated?.description).toBe('Updated description');
      expect(updated?.members).toHaveLength(3);
      expect(updated?.engagement_strategy).toBe('New strategy');
    });

    it('should return null for non-existent ID', async () => {
      const updated = await storage.updateCommunity('non-existent', {
        description: 'Updated',
      });

      expect(updated).toBeNull();
    });
  });

  describe('getCommunityByTopic', () => {
    beforeEach(async () => {
      await storage.addCommunity({
        name: 'AI Community',
        description: 'All about AI',
        topics: ['AI', 'ML'],
        members: ['user-1'],
        leaders: [],
      });

      await storage.addCommunity({
        name: 'Web Dev Community',
        description: 'Web development',
        topics: ['web', 'javascript'],
        members: ['user-2'],
        leaders: [],
      });

      await storage.addCommunity({
        name: 'AI Web Community',
        description: 'AI for web',
        topics: ['AI', 'web'],
        members: ['user-3'],
        leaders: [],
      });
    });

    it('should find communities by topic', async () => {
      const aiCommunities = await storage.getCommunitiesByTopic('AI');

      expect(aiCommunities).toHaveLength(2);
    });

    it('should return empty for non-existent topic', async () => {
      const communities = await storage.getCommunitiesByTopic('nonexistent');

      expect(communities).toHaveLength(0);
    });
  });

  describe('removeCommunity', () => {
    it('should remove a community by ID', async () => {
      const community = await storage.addCommunity({
        name: 'To Remove',
        description: 'Will be removed',
        topics: ['remove'],
        members: ['user-1'],
        leaders: [],
      });

      const removed = await storage.removeCommunity(community.id);

      expect(removed).toBe(true);

      const found = await storage.getCommunity(community.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent ID', async () => {
      const removed = await storage.removeCommunity('non-existent');

      expect(removed).toBe(false);
    });
  });

  describe('getNetworkData', () => {
    it('should return all network data', async () => {
      await storage.addSuggestedFollow({
        user_id: 'user-1',
        username: 'follow1',
        display_name: 'Follow 1',
        reason: 'Test',
        relevance_score: 0.5,
      });

      await storage.addEngagementTarget({
        user_id: 'user-2',
        username: 'target1',
        display_name: 'Target 1',
        priority: 'medium',
        value_score: 0.7,
        accessibility_score: 0.7,
      });

      await storage.addCommunity({
        name: 'Community 1',
        description: 'Test',
        topics: ['test'],
        members: ['user-3'],
        leaders: [],
      });

      const data = await storage.getNetworkData();

      expect(data.version).toBe(1);
      expect(data.suggested_follows).toHaveLength(1);
      expect(data.engagement_targets).toHaveLength(1);
      expect(data.communities).toHaveLength(1);
    });

    it('should return default data when empty', async () => {
      const data = await storage.getNetworkData();

      expect(data.version).toBe(1);
      expect(data.suggested_follows).toHaveLength(0);
      expect(data.engagement_targets).toHaveLength(0);
      expect(data.communities).toHaveLength(0);
    });
  });

  describe('getFollowBackRate', () => {
    it('should calculate follow back rate', async () => {
      const follow1 = await storage.addSuggestedFollow({
        user_id: 'user-1',
        username: 'user1',
        display_name: 'User 1',
        reason: 'Test',
        relevance_score: 0.5,
      });
      await storage.updateSuggestedFollow(follow1.id, {
        status: 'followed',
        follow_back: true,
      });

      const follow2 = await storage.addSuggestedFollow({
        user_id: 'user-2',
        username: 'user2',
        display_name: 'User 2',
        reason: 'Test',
        relevance_score: 0.6,
      });
      await storage.updateSuggestedFollow(follow2.id, {
        status: 'followed',
        follow_back: false,
      });

      const follow3 = await storage.addSuggestedFollow({
        user_id: 'user-3',
        username: 'user3',
        display_name: 'User 3',
        reason: 'Test',
        relevance_score: 0.7,
      });
      await storage.updateSuggestedFollow(follow3.id, {
        status: 'followed',
        follow_back: true,
      });

      const rate = await storage.getFollowBackRate();

      expect(rate).toBeCloseTo(0.667, 2);
    });

    it('should return 0 when no follows', async () => {
      const rate = await storage.getFollowBackRate();

      expect(rate).toBe(0);
    });
  });
});

describe('Singleton functions', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'network-singleton-test-'));
    resetNetworkStorage();
    resetStorage();
  });

  afterEach(() => {
    resetNetworkStorage();
    resetStorage();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('getNetworkStorage should return same instance', () => {
    const instance1 = getNetworkStorage(tempDir);
    const instance2 = getNetworkStorage(tempDir);

    expect(instance1).toBe(instance2);
  });

  it('resetNetworkStorage should clear singleton', () => {
    const instance1 = getNetworkStorage(tempDir);
    resetNetworkStorage();
    const instance2 = getNetworkStorage(tempDir);

    expect(instance1).not.toBe(instance2);
  });
});
