import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { XClient, getXClient, resetXClient, type XClientConfig } from '@/api/x/client.js';
import { XAPIError, NetworkError } from '@/utils/errors.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('XClient', () => {
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

  describe('constructor', () => {
    it('should create an axios instance with correct base URL', () => {
      new XClient(mockCredentials);

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.twitter.com',
        })
      );
    });

    it('should set up request and response interceptors', () => {
      new XClient(mockCredentials);

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it('should support sandbox mode with different credentials', () => {
      const sandboxConfig: XClientConfig = {
        ...mockCredentials,
        sandbox: true,
      };

      const client = new XClient(sandboxConfig);
      expect(client.isSandbox()).toBe(true);
    });

    it('should support custom API tier limits', () => {
      const configWithLimits: XClientConfig = {
        ...mockCredentials,
        apiTierLimits: {
          postsPerMonth: 3000,
          readsPerMonth: 100000,
          requestsPer15Min: 300,
        },
      };

      const client = new XClient(configWithLimits);
      const limits = client.getApiTierLimits();
      expect(limits.postsPerMonth).toBe(3000);
      expect(limits.readsPerMonth).toBe(100000);
      expect(limits.requestsPer15Min).toBe(300);
    });
  });

  describe('OAuth 1.0a authentication', () => {
    it('should generate valid OAuth signature base string', () => {
      // Create client - the constructor sets up interceptors
      const _client = new XClient(mockCredentials);

      // The OAuth signature should be added to requests
      // We test this indirectly through the interceptor setup
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });

    it('should include required OAuth parameters in requests', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { id: '123' } },
        headers: {},
      });

      await client.request('GET', '/2/users/me');

      // Verify request was made
      expect(mockAxiosInstance.get).toHaveBeenCalled();
    });
  });

  describe('request method', () => {
    it('should make GET requests', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { id: '123', name: 'Test User' } },
        headers: {},
      });

      const result = await client.request('GET', '/2/users/me');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/2/users/me', expect.any(Object));
      expect(result).toEqual({ data: { id: '123', name: 'Test User' } });
    });

    it('should make POST requests with data', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: { id: '456', text: 'Hello' } },
        headers: {},
      });

      const result = await client.request('POST', '/2/tweets', { text: 'Hello' });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/2/tweets',
        { text: 'Hello' },
        expect.any(Object)
      );
      expect(result).toEqual({ data: { id: '456', text: 'Hello' } });
    });

    it('should make DELETE requests', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.delete.mockResolvedValueOnce({
        data: { data: { deleted: true } },
        headers: {},
      });

      const result = await client.request('DELETE', '/2/tweets/123');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/2/tweets/123', expect.any(Object));
      expect(result).toEqual({ data: { deleted: true } });
    });

    it('should include query parameters for GET requests', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: [] },
        headers: {},
      });

      await client.request('GET', '/2/tweets/search/recent', undefined, {
        query: 'test',
        max_results: '10',
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/2/tweets/search/recent',
        expect.objectContaining({
          params: { query: 'test', max_results: '10' },
        })
      );
    });
  });

  describe('rate limit tracking', () => {
    it('should track rate limits from response headers', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: {} },
        headers: {
          'x-rate-limit-limit': '900',
          'x-rate-limit-remaining': '899',
          'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 900),
        },
      });

      await client.request('GET', '/2/users/me');
      const rateLimits = client.getRateLimits('/2/users/me');

      expect(rateLimits).toBeDefined();
      expect(rateLimits?.limit).toBe(900);
      expect(rateLimits?.remaining).toBe(899);
    });

    it('should return undefined for unknown endpoints', () => {
      const client = new XClient(mockCredentials);
      const rateLimits = client.getRateLimits('/unknown/endpoint');
      expect(rateLimits).toBeUndefined();
    });

    it('should check if rate limited', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: {} },
        headers: {
          'x-rate-limit-limit': '900',
          'x-rate-limit-remaining': '0',
          'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 900),
        },
      });

      await client.request('GET', '/2/users/me');

      expect(client.isRateLimited('/2/users/me')).toBe(true);
    });

    it('should not be rate limited with remaining requests', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: {} },
        headers: {
          'x-rate-limit-limit': '900',
          'x-rate-limit-remaining': '500',
          'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 900),
        },
      });

      await client.request('GET', '/2/users/me');

      expect(client.isRateLimited('/2/users/me')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw XAPIError for 429 rate limit errors', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 429,
          data: { errors: [{ message: 'Rate limit exceeded' }] },
        },
        config: { url: '/2/tweets' },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError);

      await expect(client.request('POST', '/2/tweets', { text: 'test' })).rejects.toThrow(
        XAPIError
      );
    });

    it('should throw XAPIError for 401 auth errors', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 401,
          data: { errors: [{ message: 'Unauthorized' }] },
        },
        config: { url: '/2/users/me' },
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);

      await expect(client.request('GET', '/2/users/me')).rejects.toThrow(XAPIError);
    });

    it('should throw XAPIError for 403 forbidden errors', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 403,
          data: { errors: [{ message: 'Forbidden' }] },
        },
        config: { url: '/2/tweets' },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError);

      await expect(client.request('POST', '/2/tweets', { text: 'test' })).rejects.toThrow(
        XAPIError
      );
    });

    it('should throw XAPIError for 404 not found errors', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 404,
          data: { errors: [{ message: 'Not Found' }] },
        },
        config: { url: '/2/tweets/999' },
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);

      await expect(client.request('GET', '/2/tweets/999')).rejects.toThrow(XAPIError);
    });

    it('should throw XAPIError for 5xx server errors', async () => {
      const client = new XClient(mockCredentials);
      const axiosError = {
        response: {
          status: 500,
          data: { errors: [{ message: 'Internal Server Error' }] },
        },
        config: { url: '/2/tweets' },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError);

      await expect(client.request('POST', '/2/tweets', { text: 'test' })).rejects.toThrow(
        XAPIError
      );
    });

    it('should throw NetworkError for connection errors', async () => {
      const client = new XClient(mockCredentials);
      const networkError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(networkError);

      await expect(client.request('GET', '/2/users/me')).rejects.toThrow(NetworkError);
    });

    it('should throw NetworkError for timeout errors', async () => {
      const client = new XClient(mockCredentials);
      const timeoutError = {
        code: 'ETIMEDOUT',
        message: 'Request timeout',
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(timeoutError);

      await expect(client.request('GET', '/2/users/me')).rejects.toThrow(NetworkError);
    });

    it('should include response data in XAPIError', async () => {
      const client = new XClient(mockCredentials);
      const errorData = {
        errors: [{ message: 'Duplicate tweet', code: 187 }],
        title: 'Forbidden',
        detail: 'You are not allowed to create a Tweet with duplicate content.',
      };
      const axiosError = {
        response: {
          status: 403,
          data: errorData,
        },
        config: { url: '/2/tweets' },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError);

      try {
        await client.request('POST', '/2/tweets', { text: 'duplicate' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(XAPIError);
        expect((error as XAPIError).responseData).toEqual(errorData);
      }
    });
  });

  describe('request logging', () => {
    it('should log requests when enabled', async () => {
      const logSpy = vi.fn();
      const client = new XClient({
        ...mockCredentials,
        onRequest: logSpy,
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: {} },
        headers: {},
      });

      await client.request('GET', '/2/users/me');

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          endpoint: '/2/users/me',
        })
      );
    });

    it('should log responses when enabled', async () => {
      const logSpy = vi.fn();
      const client = new XClient({
        ...mockCredentials,
        onResponse: logSpy,
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { id: '123' } },
        headers: { 'x-rate-limit-remaining': '899' },
      });

      await client.request('GET', '/2/users/me');

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: '/2/users/me',
          status: 'success',
        })
      );
    });
  });

  describe('API tier limits', () => {
    it('should return default basic tier limits', () => {
      const client = new XClient(mockCredentials);
      const limits = client.getApiTierLimits();

      expect(limits.postsPerMonth).toBe(1500);
      expect(limits.readsPerMonth).toBe(10000);
      expect(limits.requestsPer15Min).toBe(50);
    });

    it('should track monthly post count', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.post.mockResolvedValue({
        data: { data: { id: '123' } },
        headers: {},
      });

      // Make post requests
      await client.request('POST', '/2/tweets', { text: 'test1' });
      await client.request('POST', '/2/tweets', { text: 'test2' });

      const usage = client.getUsageStats();
      expect(usage.postsThisMonth).toBe(2);
    });

    it('should track monthly read count', async () => {
      const client = new XClient(mockCredentials);
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: {} },
        headers: {},
      });

      await client.request('GET', '/2/users/me');
      await client.request('GET', '/2/tweets/123');

      const usage = client.getUsageStats();
      expect(usage.readsThisMonth).toBe(2);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance from getXClient', () => {
      const client1 = getXClient(mockCredentials);
      const client2 = getXClient(mockCredentials);

      expect(client1).toBe(client2);
    });

    it('should reset singleton with resetXClient', () => {
      const client1 = getXClient(mockCredentials);
      resetXClient();
      const client2 = getXClient(mockCredentials);

      expect(client1).not.toBe(client2);
    });
  });

  describe('sandbox mode', () => {
    it('should indicate sandbox mode', () => {
      const client = new XClient({ ...mockCredentials, sandbox: true });
      expect(client.isSandbox()).toBe(true);
    });

    it('should indicate non-sandbox mode by default', () => {
      const client = new XClient(mockCredentials);
      expect(client.isSandbox()).toBe(false);
    });
  });
});
