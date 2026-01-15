import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { XClient, resetXClient, type XClientConfig } from '@/api/x/client.js';
import { XAPIError } from '@/utils/errors.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('XClient Engagement Operations', () => {
  const mockCredentials: XClientConfig = {
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    accessToken: 'test-access-token',
    accessTokenSecret: 'test-access-token-secret',
  };

  let mockAxiosInstance: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    interceptors: {
      request: { use: ReturnType<typeof vi.fn> };
      response: { use: ReturnType<typeof vi.fn> };
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetXClient();

    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance as unknown as ReturnType<typeof axios.create>);
  });

  afterEach(() => {
    resetXClient();
  });

  describe('like()', () => {
    it('should like a tweet', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: { liked: true } },
        headers: {},
      });

      const result = await client.like('user123', '456789');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/2/users/user123/likes',
        { tweet_id: '456789' },
        expect.any(Object)
      );
      expect(result.liked).toBe(true);
    });

    it('should throw error for missing user ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.like('', '456789')).rejects.toThrow('User ID is required');
    });

    it('should throw error for missing tweet ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.like('user123', '')).rejects.toThrow('Tweet ID is required');
    });

    it('should handle already liked tweet (API returns liked: false)', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: { liked: false } },
        headers: {},
      });

      const result = await client.like('user123', '456789');

      expect(result.liked).toBe(false);
    });

    it('should handle rate limit error (429)', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 429,
          data: { errors: [{ message: 'Too Many Requests' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError);

      await expect(client.like('user123', '456789')).rejects.toThrow(XAPIError);
    });

    it('should handle tweet not found error (404)', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 404,
          data: { errors: [{ message: 'Tweet not found' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError);

      await expect(client.like('user123', 'nonexistent')).rejects.toThrow(XAPIError);
    });
  });

  describe('unlike()', () => {
    it('should unlike a tweet', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.delete.mockResolvedValueOnce({
        data: { data: { liked: false } },
        headers: {},
      });

      const result = await client.unlike('user123', '456789');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/2/users/user123/likes/456789',
        expect.any(Object)
      );
      expect(result.liked).toBe(false);
    });

    it('should throw error for missing user ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.unlike('', '456789')).rejects.toThrow('User ID is required');
    });

    it('should throw error for missing tweet ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.unlike('user123', '')).rejects.toThrow('Tweet ID is required');
    });

    it('should handle unlike on non-liked tweet gracefully', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.delete.mockResolvedValueOnce({
        data: { data: { liked: false } },
        headers: {},
      });

      const result = await client.unlike('user123', '456789');

      expect(result.liked).toBe(false);
    });
  });

  describe('retweet()', () => {
    it('should retweet a tweet', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: { retweeted: true } },
        headers: {},
      });

      const result = await client.retweet('user123', '456789');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/2/users/user123/retweets',
        { tweet_id: '456789' },
        expect.any(Object)
      );
      expect(result.retweeted).toBe(true);
    });

    it('should throw error for missing user ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.retweet('', '456789')).rejects.toThrow('User ID is required');
    });

    it('should throw error for missing tweet ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.retweet('user123', '')).rejects.toThrow('Tweet ID is required');
    });

    it('should handle already retweeted (returns retweeted: false)', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: { retweeted: false } },
        headers: {},
      });

      const result = await client.retweet('user123', '456789');

      expect(result.retweeted).toBe(false);
    });

    it('should handle rate limit error', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 429,
          data: { errors: [{ message: 'Rate limit exceeded' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError);

      await expect(client.retweet('user123', '456789')).rejects.toThrow(XAPIError);
    });
  });

  describe('unretweet()', () => {
    it('should unretweet a tweet', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.delete.mockResolvedValueOnce({
        data: { data: { retweeted: false } },
        headers: {},
      });

      const result = await client.unretweet('user123', '456789');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/2/users/user123/retweets/456789',
        expect.any(Object)
      );
      expect(result.retweeted).toBe(false);
    });

    it('should throw error for missing user ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.unretweet('', '456789')).rejects.toThrow('User ID is required');
    });

    it('should throw error for missing tweet ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.unretweet('user123', '')).rejects.toThrow('Tweet ID is required');
    });
  });

  describe('follow()', () => {
    it('should follow a user', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: { following: true, pending_follow: false } },
        headers: {},
      });

      const result = await client.follow('user123', 'target456');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/2/users/user123/following',
        { target_user_id: 'target456' },
        expect.any(Object)
      );
      expect(result.following).toBe(true);
      expect(result.pending_follow).toBe(false);
    });

    it('should throw error for missing source user ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.follow('', 'target456')).rejects.toThrow('Source user ID is required');
    });

    it('should throw error for missing target user ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.follow('user123', '')).rejects.toThrow('Target user ID is required');
    });

    it('should handle pending follow request for protected accounts', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: { following: false, pending_follow: true } },
        headers: {},
      });

      const result = await client.follow('user123', 'protected_user');

      expect(result.following).toBe(false);
      expect(result.pending_follow).toBe(true);
    });

    it('should handle already following (returns following: true)', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: { following: true, pending_follow: false } },
        headers: {},
      });

      const result = await client.follow('user123', 'already_following');

      expect(result.following).toBe(true);
    });

    it('should handle cannot follow blocked user', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 403,
          data: { errors: [{ message: 'You have been blocked' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError);

      await expect(client.follow('user123', 'blocking_user')).rejects.toThrow(XAPIError);
    });

    it('should handle user not found', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 404,
          data: { errors: [{ message: 'User not found' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError);

      await expect(client.follow('user123', 'nonexistent')).rejects.toThrow(XAPIError);
    });
  });

  describe('unfollow()', () => {
    it('should unfollow a user', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.delete.mockResolvedValueOnce({
        data: { data: { following: false } },
        headers: {},
      });

      const result = await client.unfollow('user123', 'target456');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/2/users/user123/following/target456',
        expect.any(Object)
      );
      expect(result.following).toBe(false);
    });

    it('should throw error for missing source user ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.unfollow('', 'target456')).rejects.toThrow('Source user ID is required');
    });

    it('should throw error for missing target user ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.unfollow('user123', '')).rejects.toThrow('Target user ID is required');
    });

    it('should handle unfollowing user not followed', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.delete.mockResolvedValueOnce({
        data: { data: { following: false } },
        headers: {},
      });

      const result = await client.unfollow('user123', 'not_following');

      expect(result.following).toBe(false);
    });
  });

  describe('getFollowers()', () => {
    it('should get followers list', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [
            { id: 'f1', name: 'Follower 1', username: 'follower1' },
            { id: 'f2', name: 'Follower 2', username: 'follower2' },
          ],
          meta: { result_count: 2 },
        },
        headers: {},
      });

      const result = await client.getFollowers('user123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/user123/followers',
        expect.objectContaining({
          params: expect.objectContaining({ max_results: '100' }),
        })
      );
      expect(result.users).toHaveLength(2);
      expect(result.users[0].username).toBe('follower1');
      expect(result.hasMore).toBe(false);
    });

    it('should throw error for missing user ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.getFollowers('')).rejects.toThrow('User ID is required');
    });

    it('should handle pagination', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: 'f1', name: 'Follower 1', username: 'follower1' }],
          meta: { result_count: 1, next_token: 'next_page_token' },
        },
        headers: {},
      });

      const result = await client.getFollowers('user123');

      expect(result.nextToken).toBe('next_page_token');
      expect(result.hasMore).toBe(true);
    });

    it('should accept pagination token', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: 'f3', name: 'Follower 3', username: 'follower3' }],
          meta: { result_count: 1 },
        },
        headers: {},
      });

      await client.getFollowers('user123', { paginationToken: 'page_token' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/user123/followers',
        expect.objectContaining({
          params: expect.objectContaining({ pagination_token: 'page_token' }),
        })
      );
    });

    it('should accept custom max results', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: 'f1', name: 'Follower 1', username: 'follower1' }],
          meta: { result_count: 1 },
        },
        headers: {},
      });

      await client.getFollowers('user123', { maxResults: 50 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/user123/followers',
        expect.objectContaining({
          params: expect.objectContaining({ max_results: '50' }),
        })
      );
    });

    it('should accept user fields', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'f1',
              name: 'Follower 1',
              username: 'follower1',
              public_metrics: { followers_count: 100 },
            },
          ],
          meta: { result_count: 1 },
        },
        headers: {},
      });

      await client.getFollowers('user123', {
        userFields: ['public_metrics', 'description'],
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/user123/followers',
        expect.objectContaining({
          params: expect.objectContaining({
            'user.fields': 'public_metrics,description',
          }),
        })
      );
    });

    it('should handle empty followers list', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          meta: { result_count: 0 },
        },
        headers: {},
      });

      const result = await client.getFollowers('user123');

      expect(result.users).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('should handle unauthorized access', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 401,
          data: { errors: [{ message: 'Unauthorized' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);

      await expect(client.getFollowers('user123')).rejects.toThrow(XAPIError);
    });
  });

  describe('getFollowing()', () => {
    it('should get following list', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [
            { id: 'u1', name: 'User 1', username: 'user1' },
            { id: 'u2', name: 'User 2', username: 'user2' },
          ],
          meta: { result_count: 2 },
        },
        headers: {},
      });

      const result = await client.getFollowing('user123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/user123/following',
        expect.objectContaining({
          params: expect.objectContaining({ max_results: '100' }),
        })
      );
      expect(result.users).toHaveLength(2);
      expect(result.users[0].username).toBe('user1');
      expect(result.hasMore).toBe(false);
    });

    it('should throw error for missing user ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.getFollowing('')).rejects.toThrow('User ID is required');
    });

    it('should handle pagination', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: 'u1', name: 'User 1', username: 'user1' }],
          meta: { result_count: 1, next_token: 'next_page' },
        },
        headers: {},
      });

      const result = await client.getFollowing('user123');

      expect(result.nextToken).toBe('next_page');
      expect(result.hasMore).toBe(true);
    });

    it('should accept pagination token', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: 'u3', name: 'User 3', username: 'user3' }],
          meta: { result_count: 1 },
        },
        headers: {},
      });

      await client.getFollowing('user123', { paginationToken: 'token123' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/user123/following',
        expect.objectContaining({
          params: expect.objectContaining({ pagination_token: 'token123' }),
        })
      );
    });

    it('should accept custom max results', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [],
          meta: { result_count: 0 },
        },
        headers: {},
      });

      await client.getFollowing('user123', { maxResults: 25 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/user123/following',
        expect.objectContaining({
          params: expect.objectContaining({ max_results: '25' }),
        })
      );
    });

    it('should accept user fields', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'u1',
              name: 'User 1',
              username: 'user1',
              verified: true,
            },
          ],
          meta: { result_count: 1 },
        },
        headers: {},
      });

      await client.getFollowing('user123', {
        userFields: ['verified', 'created_at'],
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/user123/following',
        expect.objectContaining({
          params: expect.objectContaining({
            'user.fields': 'verified,created_at',
          }),
        })
      );
    });

    it('should handle empty following list', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          meta: { result_count: 0 },
        },
        headers: {},
      });

      const result = await client.getFollowing('user123');

      expect(result.users).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('rate limit tracking for engagement operations', () => {
    it('should track rate limits from like response headers', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: { liked: true } },
        headers: {
          'x-rate-limit-limit': '50',
          'x-rate-limit-remaining': '49',
          'x-rate-limit-reset': '1234567890',
        },
      });

      await client.like('user123', '456789');
      const limits = client.getRateLimits('/2/users/user123/likes');

      expect(limits).toEqual({
        limit: 50,
        remaining: 49,
        reset: 1234567890,
      });
    });

    it('should track rate limits from follow response headers', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: { following: true, pending_follow: false } },
        headers: {
          'x-rate-limit-limit': '15',
          'x-rate-limit-remaining': '14',
          'x-rate-limit-reset': '1234567890',
        },
      });

      await client.follow('user123', 'target456');
      const limits = client.getRateLimits('/2/users/user123/following');

      expect(limits).toEqual({
        limit: 15,
        remaining: 14,
        reset: 1234567890,
      });
    });
  });

  describe('logging callbacks for engagement operations', () => {
    it('should call onRequest and onResponse for like operation', async () => {
      const onRequest = vi.fn();
      const onResponse = vi.fn();
      const client = new XClient({
        ...mockCredentials,
        onRequest,
        onResponse,
      });

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: { liked: true } },
        headers: {},
      });

      await client.like('user123', '456789');

      expect(onRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          endpoint: '/2/users/user123/likes',
          hasBody: true,
        })
      );

      expect(onResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: '/2/users/user123/likes',
          status: 'success',
        })
      );
    });

    it('should call onResponse with error status on failure', async () => {
      const onResponse = vi.fn();
      const client = new XClient({
        ...mockCredentials,
        onResponse,
      });

      const axiosError = {
        response: {
          status: 429,
          data: { errors: [{ message: 'Rate limit' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError);

      await expect(client.like('user123', '456789')).rejects.toThrow();

      expect(onResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: '/2/users/user123/likes',
          status: 'error',
          statusCode: 429,
        })
      );
    });
  });
});
