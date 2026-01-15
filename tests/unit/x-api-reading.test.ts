import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { XClient, resetXClient, type XClientConfig } from '@/api/x/client.js';
import { XAPIError } from '@/utils/errors.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('XClient Reading Operations', () => {
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

  describe('getTimeline()', () => {
    it('should fetch user timeline (reverse chronological)', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [
            { id: '1', text: 'Tweet 1' },
            { id: '2', text: 'Tweet 2' },
          ],
          meta: { result_count: 2 },
        },
        headers: {},
      });

      const result = await client.getTimeline('user123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/user123/tweets',
        expect.objectContaining({
          params: expect.objectContaining({
            max_results: '10',
          }),
        })
      );
      expect(result.tweets).toHaveLength(2);
      expect(result.tweets[0].id).toBe('1');
    });

    it('should support custom max_results', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: '1', text: 'Tweet 1' }],
          meta: { result_count: 1 },
        },
        headers: {},
      });

      await client.getTimeline('user123', { maxResults: 50 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/user123/tweets',
        expect.objectContaining({
          params: expect.objectContaining({
            max_results: '50',
          }),
        })
      );
    });

    it('should support pagination token', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: '3', text: 'Tweet 3' }],
          meta: { result_count: 1 },
        },
        headers: {},
      });

      await client.getTimeline('user123', { paginationToken: 'next_token_123' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/user123/tweets',
        expect.objectContaining({
          params: expect.objectContaining({
            pagination_token: 'next_token_123',
          }),
        })
      );
    });

    it('should return next pagination token if available', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: '1', text: 'Tweet 1' }],
          meta: { result_count: 1, next_token: 'next_page' },
        },
        headers: {},
      });

      const result = await client.getTimeline('user123');

      expect(result.nextToken).toBe('next_page');
    });

    it('should throw error for missing user ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.getTimeline('')).rejects.toThrow('User ID is required');
    });

    it('should handle empty timeline', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          meta: { result_count: 0 },
        },
        headers: {},
      });

      const result = await client.getTimeline('user123');

      expect(result.tweets).toHaveLength(0);
    });

    it('should increment read count', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: '1', text: 'Tweet' }],
          meta: { result_count: 1 },
        },
        headers: {},
      });

      await client.getTimeline('user123');
      const usage = client.getUsageStats();

      expect(usage.readsThisMonth).toBe(1);
    });

    it('should include tweet fields when specified', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: '1', text: 'Tweet', created_at: '2024-01-01T00:00:00Z' }],
          meta: { result_count: 1 },
        },
        headers: {},
      });

      await client.getTimeline('user123', {
        tweetFields: ['created_at', 'public_metrics'],
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/user123/tweets',
        expect.objectContaining({
          params: expect.objectContaining({
            'tweet.fields': 'created_at,public_metrics',
          }),
        })
      );
    });
  });

  describe('getMentions()', () => {
    it('should fetch mentions for user', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [
            { id: '100', text: '@user hello!' },
            { id: '101', text: '@user great post' },
          ],
          meta: { result_count: 2 },
        },
        headers: {},
      });

      const result = await client.getMentions('user123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/user123/mentions',
        expect.any(Object)
      );
      expect(result.tweets).toHaveLength(2);
    });

    it('should support since_id parameter', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: '102', text: 'New mention' }],
          meta: { result_count: 1 },
        },
        headers: {},
      });

      await client.getMentions('user123', { sinceId: '100' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/users/user123/mentions',
        expect.objectContaining({
          params: expect.objectContaining({
            since_id: '100',
          }),
        })
      );
    });

    it('should throw error for missing user ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.getMentions('')).rejects.toThrow('User ID is required');
    });

    it('should handle no mentions', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          meta: { result_count: 0 },
        },
        headers: {},
      });

      const result = await client.getMentions('user123');

      expect(result.tweets).toHaveLength(0);
    });

    it('should support pagination', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: '1', text: 'mention' }],
          meta: { result_count: 1, next_token: 'more_mentions' },
        },
        headers: {},
      });

      const result = await client.getMentions('user123');

      expect(result.nextToken).toBe('more_mentions');
    });
  });

  describe('getTweet()', () => {
    it('should fetch a single tweet by ID', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            id: '12345',
            text: 'This is a tweet',
          },
        },
        headers: {},
      });

      const result = await client.getTweet('12345');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/tweets/12345',
        expect.any(Object)
      );
      expect(result.id).toBe('12345');
      expect(result.text).toBe('This is a tweet');
    });

    it('should throw error for missing tweet ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.getTweet('')).rejects.toThrow('Tweet ID is required');
    });

    it('should handle 404 for non-existent tweet', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 404,
          data: { errors: [{ message: 'Tweet not found' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);

      await expect(client.getTweet('nonexistent')).rejects.toThrow(XAPIError);
    });

    it('should include tweet fields when specified', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            id: '12345',
            text: 'Tweet',
            public_metrics: { like_count: 10 },
          },
        },
        headers: {},
      });

      await client.getTweet('12345', {
        tweetFields: ['public_metrics', 'author_id'],
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/tweets/12345',
        expect.objectContaining({
          params: expect.objectContaining({
            'tweet.fields': 'public_metrics,author_id',
          }),
        })
      );
    });

    it('should include expansions when specified', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: { id: '12345', text: 'Tweet', author_id: 'user1' },
          includes: { users: [{ id: 'user1', name: 'Test' }] },
        },
        headers: {},
      });

      await client.getTweet('12345', {
        expansions: ['author_id'],
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/tweets/12345',
        expect.objectContaining({
          params: expect.objectContaining({
            expansions: 'author_id',
          }),
        })
      );
    });
  });

  describe('searchTweets()', () => {
    it('should search recent tweets', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [
            { id: '1', text: 'Found tweet 1' },
            { id: '2', text: 'Found tweet 2' },
          ],
          meta: { result_count: 2 },
        },
        headers: {},
      });

      const result = await client.searchTweets('typescript');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/tweets/search/recent',
        expect.objectContaining({
          params: expect.objectContaining({
            query: 'typescript',
          }),
        })
      );
      expect(result.tweets).toHaveLength(2);
    });

    it('should throw error for empty query', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.searchTweets('')).rejects.toThrow('Search query is required');
    });

    it('should support max_results', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: '1', text: 'Result' }],
          meta: { result_count: 1 },
        },
        headers: {},
      });

      await client.searchTweets('nodejs', { maxResults: 100 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/tweets/search/recent',
        expect.objectContaining({
          params: expect.objectContaining({
            query: 'nodejs',
            max_results: '100',
          }),
        })
      );
    });

    it('should support pagination', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: '1', text: 'Result' }],
          meta: { result_count: 1, next_token: 'search_next' },
        },
        headers: {},
      });

      const result = await client.searchTweets('react');

      expect(result.nextToken).toBe('search_next');
    });

    it('should support next_token parameter', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: '2', text: 'Page 2 result' }],
          meta: { result_count: 1 },
        },
        headers: {},
      });

      await client.searchTweets('react', { paginationToken: 'search_next' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/tweets/search/recent',
        expect.objectContaining({
          params: expect.objectContaining({
            next_token: 'search_next',
          }),
        })
      );
    });

    it('should handle no results', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          meta: { result_count: 0 },
        },
        headers: {},
      });

      const result = await client.searchTweets('very_rare_query_xyz');

      expect(result.tweets).toHaveLength(0);
    });

    it('should support tweet fields', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: '1', text: 'Result', created_at: '2024-01-01' }],
          meta: { result_count: 1 },
        },
        headers: {},
      });

      await client.searchTweets('query', {
        tweetFields: ['created_at', 'author_id'],
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/tweets/search/recent',
        expect.objectContaining({
          params: expect.objectContaining({
            'tweet.fields': 'created_at,author_id',
          }),
        })
      );
    });

    it('should support sort_order parameter', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: '1', text: 'Result' }],
          meta: { result_count: 1 },
        },
        headers: {},
      });

      await client.searchTweets('query', { sortOrder: 'relevancy' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/tweets/search/recent',
        expect.objectContaining({
          params: expect.objectContaining({
            sort_order: 'relevancy',
          }),
        })
      );
    });
  });

  describe('getTrending()', () => {
    it('should fetch trending topics for a WOEID', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: [
          {
            trends: [
              { name: '#Topic1', tweet_volume: 10000, url: 'http://...' },
              { name: 'Topic2', tweet_volume: 5000, url: 'http://...' },
            ],
            locations: [{ name: 'Worldwide', woeid: 1 }],
          },
        ],
        headers: {},
      });

      const result = await client.getTrending(1);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/1.1/trends/place.json',
        expect.objectContaining({
          params: expect.objectContaining({
            id: '1',
          }),
        })
      );
      expect(result.trends).toHaveLength(2);
      expect(result.trends[0].name).toBe('#Topic1');
    });

    it('should default to worldwide (WOEID 1)', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: [
          {
            trends: [{ name: 'Trending', tweet_volume: 1000, url: 'http://...' }],
            locations: [{ name: 'Worldwide', woeid: 1 }],
          },
        ],
        headers: {},
      });

      await client.getTrending();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/1.1/trends/place.json',
        expect.objectContaining({
          params: expect.objectContaining({
            id: '1',
          }),
        })
      );
    });

    it('should handle API errors', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 404,
          data: { errors: [{ message: 'Location not found' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);

      await expect(client.getTrending(99999)).rejects.toThrow(XAPIError);
    });

    it('should return location info with trends', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: [
          {
            trends: [{ name: 'Local', tweet_volume: 500, url: 'http://...' }],
            locations: [{ name: 'New York', woeid: 2459115 }],
          },
        ],
        headers: {},
      });

      const result = await client.getTrending(2459115);

      expect(result.location).toBe('New York');
      expect(result.woeid).toBe(2459115);
    });
  });

  describe('Response caching', () => {
    it('should cache getTweet responses', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          data: { id: '12345', text: 'Cached tweet' },
        },
        headers: {},
      });

      // First call
      const result1 = await client.getTweet('12345');
      // Second call should use cache
      const result2 = await client.getTweet('12345');

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should bypass cache when specified', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          data: { id: '12345', text: 'Fresh tweet' },
        },
        headers: {},
      });

      await client.getTweet('12345');
      await client.getTweet('12345', { skipCache: true });

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('should clear cache with clearCache method', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          data: { id: '12345', text: 'Tweet' },
        },
        headers: {},
      });

      await client.getTweet('12345');
      client.clearCache();
      await client.getTweet('12345');

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Pagination helpers', () => {
    it('should return hasMore based on next_token presence', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: '1', text: 'Tweet' }],
          meta: { result_count: 1, next_token: 'more' },
        },
        headers: {},
      });

      const result = await client.getTimeline('user123');

      expect(result.hasMore).toBe(true);
    });

    it('should return hasMore false when no next_token', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: '1', text: 'Tweet' }],
          meta: { result_count: 1 },
        },
        headers: {},
      });

      const result = await client.getTimeline('user123');

      expect(result.hasMore).toBe(false);
    });
  });
});
