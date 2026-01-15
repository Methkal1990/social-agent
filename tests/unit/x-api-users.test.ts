import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { XClient, resetXClient, type XClientConfig } from '@/api/x/client.js';
import { XAPIError } from '@/utils/errors.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('XClient User Operations', () => {
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

  describe('getMe()', () => {
    it('should get authenticated user info', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            id: '12345',
            name: 'Test User',
            username: 'testuser',
          },
        },
        headers: {},
      });

      const result = await client.getMe();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/me',
        expect.any(Object)
      );
      expect(result.id).toBe('12345');
      expect(result.name).toBe('Test User');
      expect(result.username).toBe('testuser');
    });

    it('should request user fields when specified', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            id: '12345',
            name: 'Test User',
            username: 'testuser',
            public_metrics: {
              followers_count: 1000,
              following_count: 500,
              tweet_count: 200,
              listed_count: 10,
            },
            description: 'Test bio',
          },
        },
        headers: {},
      });

      const result = await client.getMe({
        userFields: ['public_metrics', 'description'],
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/me',
        expect.objectContaining({
          params: expect.objectContaining({
            'user.fields': 'public_metrics,description',
          }),
        })
      );
      expect(result.public_metrics?.followers_count).toBe(1000);
      expect(result.description).toBe('Test bio');
    });

    it('should use cache on subsequent calls', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            id: '12345',
            name: 'Test User',
            username: 'testuser',
          },
        },
        headers: {},
      });

      await client.getMe();
      const secondResult = await client.getMe();

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(secondResult.id).toBe('12345');
    });

    it('should bypass cache when skipCache is true', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          data: {
            id: '12345',
            name: 'Test User',
            username: 'testuser',
          },
        },
        headers: {},
      });

      await client.getMe();
      await client.getMe({ skipCache: true });

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('should handle unauthorized error (401)', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 401,
          data: { errors: [{ message: 'Unauthorized' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);

      await expect(client.getMe()).rejects.toThrow(XAPIError);
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
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);

      await expect(client.getMe()).rejects.toThrow(XAPIError);
    });
  });

  describe('getUser()', () => {
    it('should get user by ID', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            id: 'user456',
            name: 'Another User',
            username: 'anotheruser',
          },
        },
        headers: {},
      });

      const result = await client.getUser('user456');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/user456',
        expect.any(Object)
      );
      expect(result.id).toBe('user456');
      expect(result.username).toBe('anotheruser');
    });

    it('should throw error for missing user ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.getUser('')).rejects.toThrow('User ID is required');
    });

    it('should request user fields when specified', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            id: 'user456',
            name: 'Another User',
            username: 'anotheruser',
            verified: true,
            profile_image_url: 'https://example.com/img.jpg',
          },
        },
        headers: {},
      });

      const result = await client.getUser('user456', {
        userFields: ['verified', 'profile_image_url'],
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/user456',
        expect.objectContaining({
          params: expect.objectContaining({
            'user.fields': 'verified,profile_image_url',
          }),
        })
      );
      expect(result.verified).toBe(true);
      expect(result.profile_image_url).toBe('https://example.com/img.jpg');
    });

    it('should use cache on subsequent calls', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            id: 'user456',
            name: 'Another User',
            username: 'anotheruser',
          },
        },
        headers: {},
      });

      await client.getUser('user456');
      const secondResult = await client.getUser('user456');

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(secondResult.id).toBe('user456');
    });

    it('should bypass cache when skipCache is true', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          data: {
            id: 'user456',
            name: 'Another User',
            username: 'anotheruser',
          },
        },
        headers: {},
      });

      await client.getUser('user456');
      await client.getUser('user456', { skipCache: true });

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('should handle user not found (404)', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 404,
          data: { errors: [{ message: 'User not found' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);

      await expect(client.getUser('nonexistent')).rejects.toThrow(XAPIError);
    });

    it('should handle suspended user (403)', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 403,
          data: { errors: [{ message: 'User has been suspended' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);

      await expect(client.getUser('suspended123')).rejects.toThrow(XAPIError);
    });
  });

  describe('getUserByUsername()', () => {
    it('should get user by username', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            id: 'user789',
            name: 'Username User',
            username: 'usernameuser',
          },
        },
        headers: {},
      });

      const result = await client.getUserByUsername('usernameuser');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/by/username/usernameuser',
        expect.any(Object)
      );
      expect(result.id).toBe('user789');
      expect(result.username).toBe('usernameuser');
    });

    it('should throw error for missing username', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.getUserByUsername('')).rejects.toThrow('Username is required');
    });

    it('should request user fields when specified', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            id: 'user789',
            name: 'Username User',
            username: 'usernameuser',
            created_at: '2020-01-01T00:00:00.000Z',
            protected: false,
          },
        },
        headers: {},
      });

      const result = await client.getUserByUsername('usernameuser', {
        userFields: ['created_at', 'protected'],
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/by/username/usernameuser',
        expect.objectContaining({
          params: expect.objectContaining({
            'user.fields': 'created_at,protected',
          }),
        })
      );
      expect(result.created_at).toBe('2020-01-01T00:00:00.000Z');
      expect(result.protected).toBe(false);
    });

    it('should use cache on subsequent calls', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            id: 'user789',
            name: 'Username User',
            username: 'usernameuser',
          },
        },
        headers: {},
      });

      await client.getUserByUsername('usernameuser');
      const secondResult = await client.getUserByUsername('usernameuser');

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(secondResult.id).toBe('user789');
    });

    it('should bypass cache when skipCache is true', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          data: {
            id: 'user789',
            name: 'Username User',
            username: 'usernameuser',
          },
        },
        headers: {},
      });

      await client.getUserByUsername('usernameuser');
      await client.getUserByUsername('usernameuser', { skipCache: true });

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('should handle username not found', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 404,
          data: { errors: [{ message: 'User not found' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);

      await expect(client.getUserByUsername('nonexistent')).rejects.toThrow(XAPIError);
    });
  });

  describe('getUsers()', () => {
    it('should get multiple users by IDs', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [
            { id: 'user1', name: 'User One', username: 'userone' },
            { id: 'user2', name: 'User Two', username: 'usertwo' },
            { id: 'user3', name: 'User Three', username: 'userthree' },
          ],
        },
        headers: {},
      });

      const result = await client.getUsers(['user1', 'user2', 'user3']);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users',
        expect.objectContaining({
          params: expect.objectContaining({
            ids: 'user1,user2,user3',
          }),
        })
      );
      expect(result).toHaveLength(3);
      expect(result[0].username).toBe('userone');
    });

    it('should throw error for empty user IDs array', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.getUsers([])).rejects.toThrow('At least one user ID is required');
    });

    it('should throw error for too many user IDs (>100)', async () => {
      const client = new XClient(mockCredentials);
      const tooManyIds = Array.from({ length: 101 }, (_, i) => `user${i}`);

      await expect(client.getUsers(tooManyIds)).rejects.toThrow('Maximum 100 user IDs allowed per request');
    });

    it('should request user fields when specified', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'user1',
              name: 'User One',
              username: 'userone',
              public_metrics: {
                followers_count: 100,
                following_count: 50,
                tweet_count: 25,
                listed_count: 5,
              },
            },
          ],
        },
        headers: {},
      });

      const result = await client.getUsers(['user1'], {
        userFields: ['public_metrics'],
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users',
        expect.objectContaining({
          params: expect.objectContaining({
            'user.fields': 'public_metrics',
          }),
        })
      );
      expect(result[0].public_metrics?.followers_count).toBe(100);
    });

    it('should handle partial success (some users not found)', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [
            { id: 'user1', name: 'User One', username: 'userone' },
          ],
          errors: [
            { resource_id: 'user2', detail: 'User not found' },
          ],
        },
        headers: {},
      });

      const result = await client.getUsers(['user1', 'user2']);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user1');
    });

    it('should return empty array when no users found', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          errors: [
            { resource_id: 'user1', detail: 'User not found' },
          ],
        },
        headers: {},
      });

      const result = await client.getUsers(['user1']);

      expect(result).toHaveLength(0);
    });

    it('should handle API error', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 400,
          data: { errors: [{ message: 'Invalid request' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);

      await expect(client.getUsers(['user1'])).rejects.toThrow(XAPIError);
    });

    it('should cache individual users from batch response', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [
            { id: 'user1', name: 'User One', username: 'userone' },
            { id: 'user2', name: 'User Two', username: 'usertwo' },
          ],
        },
        headers: {},
      });

      await client.getUsers(['user1', 'user2']);

      // Individual getUser should use cache
      const cachedUser = await client.getUser('user1');

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(cachedUser.username).toBe('userone');
    });
  });

  describe('rate limit tracking for user operations', () => {
    it('should track rate limits from getMe response headers', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            id: '12345',
            name: 'Test User',
            username: 'testuser',
          },
        },
        headers: {
          'x-rate-limit-limit': '75',
          'x-rate-limit-remaining': '74',
          'x-rate-limit-reset': '1234567890',
        },
      });

      await client.getMe();
      const limits = client.getRateLimits('/2/users/me');

      expect(limits).toEqual({
        limit: 75,
        remaining: 74,
        reset: 1234567890,
      });
    });

    it('should track rate limits from getUser response headers', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            id: 'user456',
            name: 'Another User',
            username: 'anotheruser',
          },
        },
        headers: {
          'x-rate-limit-limit': '300',
          'x-rate-limit-remaining': '299',
          'x-rate-limit-reset': '1234567890',
        },
      });

      await client.getUser('user456');
      const limits = client.getRateLimits('/2/users/user456');

      expect(limits).toEqual({
        limit: 300,
        remaining: 299,
        reset: 1234567890,
      });
    });
  });

  describe('logging callbacks for user operations', () => {
    it('should call onRequest and onResponse for getMe', async () => {
      const onRequest = vi.fn();
      const onResponse = vi.fn();
      const client = new XClient({
        ...mockCredentials,
        onRequest,
        onResponse,
      });

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            id: '12345',
            name: 'Test User',
            username: 'testuser',
          },
        },
        headers: {},
      });

      await client.getMe();

      expect(onRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          endpoint: '/2/users/me',
        })
      );

      expect(onResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: '/2/users/me',
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
          status: 401,
          data: { errors: [{ message: 'Unauthorized' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);

      await expect(client.getMe()).rejects.toThrow();

      expect(onResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: '/2/users/me',
          status: 'error',
          statusCode: 401,
        })
      );
    });
  });

  describe('user data caching', () => {
    it('should share cache between getUser and getUserByUsername', async () => {
      const client = new XClient(mockCredentials);

      // First call via getUserByUsername
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            id: 'user123',
            name: 'Test User',
            username: 'testuser',
          },
        },
        headers: {},
      });

      await client.getUserByUsername('testuser');

      // Second call via getUser should use cache
      const userById = await client.getUser('user123');

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(userById.username).toBe('testuser');
    });

    it('should clear user cache when clearCache is called', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          data: {
            id: '12345',
            name: 'Test User',
            username: 'testuser',
          },
        },
        headers: {},
      });

      await client.getMe();
      client.clearCache();
      await client.getMe();

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('extract user metrics', () => {
    it('should extract public_metrics from user data', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            id: '12345',
            name: 'Test User',
            username: 'testuser',
            public_metrics: {
              followers_count: 5000,
              following_count: 200,
              tweet_count: 1500,
              listed_count: 50,
            },
          },
        },
        headers: {},
      });

      const result = await client.getMe({
        userFields: ['public_metrics'],
      });

      expect(result.public_metrics).toBeDefined();
      expect(result.public_metrics?.followers_count).toBe(5000);
      expect(result.public_metrics?.following_count).toBe(200);
      expect(result.public_metrics?.tweet_count).toBe(1500);
      expect(result.public_metrics?.listed_count).toBe(50);
    });
  });
});
