import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { XClient, resetXClient, type XClientConfig } from '@/api/x/client.js';
import { XAPIError } from '@/utils/errors.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('XClient Posting Operations', () => {
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

  describe('post()', () => {
    it('should create a single tweet', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          data: {
            id: '123456789',
            text: 'Hello, world!',
          },
        },
        headers: {},
      });

      const result = await client.post('Hello, world!');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/2/tweets',
        { text: 'Hello, world!' },
        expect.any(Object)
      );
      expect(result).toEqual({
        id: '123456789',
        text: 'Hello, world!',
      });
    });

    it('should create a tweet with media attachments', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          data: {
            id: '123456789',
            text: 'Hello with image!',
          },
        },
        headers: {},
      });

      const result = await client.post('Hello with image!', {
        mediaIds: ['media_123', 'media_456'],
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/2/tweets',
        {
          text: 'Hello with image!',
          media: { media_ids: ['media_123', 'media_456'] },
        },
        expect.any(Object)
      );
      expect(result.id).toBe('123456789');
    });

    it('should create a tweet as a reply', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          data: {
            id: '999',
            text: 'This is a reply',
          },
        },
        headers: {},
      });

      const result = await client.post('This is a reply', {
        replyTo: '888',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/2/tweets',
        {
          text: 'This is a reply',
          reply: { in_reply_to_tweet_id: '888' },
        },
        expect.any(Object)
      );
      expect(result.id).toBe('999');
    });

    it('should create a quote tweet', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          data: {
            id: '777',
            text: 'This is a quote tweet',
          },
        },
        headers: {},
      });

      const result = await client.post('This is a quote tweet', {
        quoteTweetId: '666',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/2/tweets',
        {
          text: 'This is a quote tweet',
          quote_tweet_id: '666',
        },
        expect.any(Object)
      );
      expect(result.id).toBe('777');
    });

    it('should handle API errors when posting', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 403,
          data: { errors: [{ message: 'Duplicate tweet' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError);

      await expect(client.post('duplicate content')).rejects.toThrow(XAPIError);
    });

    it('should increment post count for tweets', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: { id: '123', text: 'test' } },
        headers: {},
      });

      await client.post('test');
      const usage = client.getUsageStats();

      expect(usage.postsThisMonth).toBe(1);
    });
  });

  describe('postThread()', () => {
    it('should create a thread with multiple tweets', async () => {
      const client = new XClient(mockCredentials);

      // First tweet
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { data: { id: '100', text: 'Tweet 1' } },
          headers: {},
        })
        // Second tweet (reply to first)
        .mockResolvedValueOnce({
          data: { data: { id: '101', text: 'Tweet 2' } },
          headers: {},
        })
        // Third tweet (reply to second)
        .mockResolvedValueOnce({
          data: { data: { id: '102', text: 'Tweet 3' } },
          headers: {},
        });

      const result = await client.postThread(['Tweet 1', 'Tweet 2', 'Tweet 3']);

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);

      // First tweet has no reply reference
      expect(mockAxiosInstance.post).toHaveBeenNthCalledWith(
        1,
        '/2/tweets',
        { text: 'Tweet 1' },
        expect.any(Object)
      );

      // Second tweet is a reply to first
      expect(mockAxiosInstance.post).toHaveBeenNthCalledWith(
        2,
        '/2/tweets',
        { text: 'Tweet 2', reply: { in_reply_to_tweet_id: '100' } },
        expect.any(Object)
      );

      // Third tweet is a reply to second
      expect(mockAxiosInstance.post).toHaveBeenNthCalledWith(
        3,
        '/2/tweets',
        { text: 'Tweet 3', reply: { in_reply_to_tweet_id: '101' } },
        expect.any(Object)
      );

      expect(result.tweets).toHaveLength(3);
      expect(result.tweets[0].id).toBe('100');
      expect(result.tweets[1].id).toBe('101');
      expect(result.tweets[2].id).toBe('102');
    });

    it('should return thread with first tweet ID as root', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { data: { id: 'root-123', text: 'First' } },
          headers: {},
        })
        .mockResolvedValueOnce({
          data: { data: { id: 'reply-456', text: 'Second' } },
          headers: {},
        });

      const result = await client.postThread(['First', 'Second']);

      expect(result.rootId).toBe('root-123');
    });

    it('should throw error for empty thread', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.postThread([])).rejects.toThrow('Thread must contain at least one tweet');
    });

    it('should handle partial thread failure', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { data: { id: '100', text: 'First' } },
          headers: {},
        })
        .mockRejectedValueOnce({
          response: { status: 403, data: { errors: [{ message: 'Rate limit' }] } },
          isAxiosError: true,
        });

      await expect(client.postThread(['First', 'Second', 'Third'])).rejects.toThrow(XAPIError);
    });

    it('should increment post count for each thread tweet', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { data: { id: '100', text: 'First' } },
          headers: {},
        })
        .mockResolvedValueOnce({
          data: { data: { id: '101', text: 'Second' } },
          headers: {},
        });

      await client.postThread(['First', 'Second']);
      const usage = client.getUsageStats();

      expect(usage.postsThisMonth).toBe(2);
    });
  });

  describe('reply()', () => {
    it('should reply to a tweet', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          data: {
            id: '999',
            text: 'Great tweet!',
          },
        },
        headers: {},
      });

      const result = await client.reply('888', 'Great tweet!');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/2/tweets',
        {
          text: 'Great tweet!',
          reply: { in_reply_to_tweet_id: '888' },
        },
        expect.any(Object)
      );
      expect(result.id).toBe('999');
    });

    it('should reply with media attachments', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          data: { id: '999', text: 'Reply with image' },
        },
        headers: {},
      });

      const result = await client.reply('888', 'Reply with image', {
        mediaIds: ['media_123'],
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/2/tweets',
        {
          text: 'Reply with image',
          reply: { in_reply_to_tweet_id: '888' },
          media: { media_ids: ['media_123'] },
        },
        expect.any(Object)
      );
      expect(result.id).toBe('999');
    });

    it('should throw error for missing tweet ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.reply('', 'content')).rejects.toThrow('Tweet ID is required');
    });

    it('should throw error for empty reply content', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.reply('123', '')).rejects.toThrow('Reply content is required');
    });
  });

  describe('quoteTweet()', () => {
    it('should create a quote tweet', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          data: {
            id: '555',
            text: 'This is so insightful!',
          },
        },
        headers: {},
      });

      const result = await client.quoteTweet('444', 'This is so insightful!');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/2/tweets',
        {
          text: 'This is so insightful!',
          quote_tweet_id: '444',
        },
        expect.any(Object)
      );
      expect(result.id).toBe('555');
    });

    it('should create a quote tweet with media', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          data: { id: '555', text: 'Quote with image' },
        },
        headers: {},
      });

      const result = await client.quoteTweet('444', 'Quote with image', {
        mediaIds: ['media_789'],
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/2/tweets',
        {
          text: 'Quote with image',
          quote_tweet_id: '444',
          media: { media_ids: ['media_789'] },
        },
        expect.any(Object)
      );
      expect(result.id).toBe('555');
    });

    it('should throw error for missing quoted tweet ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.quoteTweet('', 'content')).rejects.toThrow('Tweet ID to quote is required');
    });

    it('should throw error for empty quote content', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.quoteTweet('123', '')).rejects.toThrow('Quote content is required');
    });
  });

  describe('deleteTweet()', () => {
    it('should delete a tweet', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.delete.mockResolvedValueOnce({
        data: {
          data: { deleted: true },
        },
        headers: {},
      });

      const result = await client.deleteTweet('123456');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/2/tweets/123456',
        expect.any(Object)
      );
      expect(result.deleted).toBe(true);
    });

    it('should throw error for missing tweet ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.deleteTweet('')).rejects.toThrow('Tweet ID is required');
    });

    it('should handle 404 when tweet not found', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 404,
          data: { errors: [{ message: 'Tweet not found' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.delete.mockRejectedValueOnce(axiosError);

      await expect(client.deleteTweet('nonexistent')).rejects.toThrow(XAPIError);
    });

    it('should handle 403 when unauthorized to delete', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 403,
          data: { errors: [{ message: 'Not authorized to delete' }] },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.delete.mockRejectedValueOnce(axiosError);

      await expect(client.deleteTweet('other-user-tweet')).rejects.toThrow(XAPIError);
    });
  });

  describe('PostOptions validation', () => {
    it('should handle post with all options combined', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: { id: '123', text: 'test' } },
        headers: {},
      });

      // Note: in reality you can't have both replyTo and quoteTweetId,
      // but we test that options are passed through correctly
      await client.post('test', {
        mediaIds: ['m1'],
        replyTo: '999',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/2/tweets',
        {
          text: 'test',
          media: { media_ids: ['m1'] },
          reply: { in_reply_to_tweet_id: '999' },
        },
        expect.any(Object)
      );
    });

    it('should not include empty media array', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: { id: '123', text: 'test' } },
        headers: {},
      });

      await client.post('test', { mediaIds: [] });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/2/tweets',
        { text: 'test' },
        expect.any(Object)
      );
    });
  });
});
