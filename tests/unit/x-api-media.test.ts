import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { XClient, resetXClient, type XClientConfig } from '@/api/x/client.js';
import { XAPIError } from '@/utils/errors.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('XClient Media Operations', () => {
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

  describe('uploadMedia()', () => {
    it('should upload media with INIT, APPEND, FINALIZE flow for images', async () => {
      const client = new XClient(mockCredentials);
      const imageBuffer = Buffer.from('fake-image-data');

      // INIT response
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { media_id_string: '1234567890' },
        headers: {},
      });

      // APPEND response (no body)
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: null,
        headers: {},
      });

      // FINALIZE response
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          media_id_string: '1234567890',
          size: imageBuffer.length,
          expires_after_secs: 86400,
          image: { image_type: 'image/png', w: 100, h: 100 },
        },
        headers: {},
      });

      const result = await client.uploadMedia(imageBuffer, 'image/png');

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
      expect(result.mediaId).toBe('1234567890');
      expect(result.expiresAfterSecs).toBe(86400);
    });

    it('should upload small media in single chunk', async () => {
      const client = new XClient(mockCredentials);
      const smallBuffer = Buffer.from('small-image');

      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { media_id_string: '123' },
          headers: {},
        })
        .mockResolvedValueOnce({
          data: null,
          headers: {},
        })
        .mockResolvedValueOnce({
          data: { media_id_string: '123', expires_after_secs: 3600 },
          headers: {},
        });

      const result = await client.uploadMedia(smallBuffer, 'image/jpeg');

      // INIT + 1 APPEND + FINALIZE = 3 calls
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
      expect(result.mediaId).toBe('123');
    });

    it('should handle chunked upload for large files', async () => {
      const client = new XClient(mockCredentials);
      // Create a buffer larger than chunk size (1MB chunks)
      const chunkSize = 1024 * 1024; // 1MB
      const largeBuffer = Buffer.alloc(chunkSize * 2 + 1000); // ~2MB + extra

      mockAxiosInstance.post
        // INIT
        .mockResolvedValueOnce({
          data: { media_id_string: '456' },
          headers: {},
        })
        // APPEND chunk 0
        .mockResolvedValueOnce({
          data: null,
          headers: {},
        })
        // APPEND chunk 1
        .mockResolvedValueOnce({
          data: null,
          headers: {},
        })
        // APPEND chunk 2
        .mockResolvedValueOnce({
          data: null,
          headers: {},
        })
        // FINALIZE
        .mockResolvedValueOnce({
          data: { media_id_string: '456', expires_after_secs: 86400 },
          headers: {},
        });

      const result = await client.uploadMedia(largeBuffer, 'video/mp4', 'tweet_video');

      // INIT + 3 APPEND + FINALIZE = 5 calls
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(5);
      expect(result.mediaId).toBe('456');
    });

    it('should support different media categories', async () => {
      const client = new XClient(mockCredentials);
      const buffer = Buffer.from('test');

      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { media_id_string: '789' },
          headers: {},
        })
        .mockResolvedValueOnce({ data: null, headers: {} })
        .mockResolvedValueOnce({
          data: { media_id_string: '789', expires_after_secs: 3600 },
          headers: {},
        });

      await client.uploadMedia(buffer, 'image/gif', 'tweet_gif');

      // Check INIT was called with correct media_category
      const initCall = mockAxiosInstance.post.mock.calls[0];
      expect(initCall[1]).toContain('media_category=tweet_gif');
    });

    it('should throw error for unsupported media type', async () => {
      const client = new XClient(mockCredentials);
      const buffer = Buffer.from('test');

      await expect(client.uploadMedia(buffer, 'text/plain')).rejects.toThrow('Unsupported media type');
    });

    it('should throw error for empty buffer', async () => {
      const client = new XClient(mockCredentials);
      const emptyBuffer = Buffer.alloc(0);

      await expect(client.uploadMedia(emptyBuffer, 'image/png')).rejects.toThrow('Media data is required');
    });

    it('should handle INIT failure', async () => {
      const client = new XClient(mockCredentials);
      const buffer = Buffer.from('test');

      mockAxiosInstance.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { errors: [{ message: 'Invalid media type' }] },
        },
        isAxiosError: true,
      });

      await expect(client.uploadMedia(buffer, 'image/png')).rejects.toThrow(XAPIError);
    });

    it('should handle APPEND failure', async () => {
      const client = new XClient(mockCredentials);
      const buffer = Buffer.from('test-data');

      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { media_id_string: '123' },
          headers: {},
        })
        .mockRejectedValueOnce({
          response: {
            status: 500,
            data: { errors: [{ message: 'Upload failed' }] },
          },
          isAxiosError: true,
        });

      await expect(client.uploadMedia(buffer, 'image/png')).rejects.toThrow(XAPIError);
    });

    it('should handle FINALIZE failure', async () => {
      const client = new XClient(mockCredentials);
      const buffer = Buffer.from('test-data');

      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { media_id_string: '123' },
          headers: {},
        })
        .mockResolvedValueOnce({ data: null, headers: {} })
        .mockRejectedValueOnce({
          response: {
            status: 400,
            data: { errors: [{ message: 'Finalization failed' }] },
          },
          isAxiosError: true,
        });

      await expect(client.uploadMedia(buffer, 'image/png')).rejects.toThrow(XAPIError);
    });
  });

  describe('checkMediaStatus()', () => {
    it('should check status of processing media', async () => {
      const client = new XClient(mockCredentials);

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          media_id_string: '123',
          processing_info: {
            state: 'succeeded',
            progress_percent: 100,
          },
        },
        headers: {},
      });

      const result = await client.checkMediaStatus('123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/1.1/media/upload.json',
        expect.objectContaining({
          params: { command: 'STATUS', media_id: '123' },
        })
      );
      expect(result.state).toBe('succeeded');
      expect(result.progressPercent).toBe(100);
    });

    it('should return pending state with check_after_secs', async () => {
      const client = new XClient(mockCredentials);

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          media_id_string: '123',
          processing_info: {
            state: 'pending',
            check_after_secs: 5,
          },
        },
        headers: {},
      });

      const result = await client.checkMediaStatus('123');

      expect(result.state).toBe('pending');
      expect(result.checkAfterSecs).toBe(5);
    });

    it('should return in_progress state with progress_percent', async () => {
      const client = new XClient(mockCredentials);

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          media_id_string: '123',
          processing_info: {
            state: 'in_progress',
            progress_percent: 50,
            check_after_secs: 3,
          },
        },
        headers: {},
      });

      const result = await client.checkMediaStatus('123');

      expect(result.state).toBe('in_progress');
      expect(result.progressPercent).toBe(50);
      expect(result.checkAfterSecs).toBe(3);
    });

    it('should return failed state with error info', async () => {
      const client = new XClient(mockCredentials);

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          media_id_string: '123',
          processing_info: {
            state: 'failed',
            error: {
              code: 1,
              name: 'InvalidMedia',
              message: 'The media is not valid',
            },
          },
        },
        headers: {},
      });

      const result = await client.checkMediaStatus('123');

      expect(result.state).toBe('failed');
      expect(result.error).toEqual({
        code: 1,
        name: 'InvalidMedia',
        message: 'The media is not valid',
      });
    });

    it('should throw error for missing media ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.checkMediaStatus('')).rejects.toThrow('Media ID is required');
    });

    it('should handle API error when checking status', async () => {
      const client = new XClient(mockCredentials);

      mockAxiosInstance.get.mockRejectedValueOnce({
        response: {
          status: 404,
          data: { errors: [{ message: 'Media not found' }] },
        },
        isAxiosError: true,
      });

      await expect(client.checkMediaStatus('nonexistent')).rejects.toThrow(XAPIError);
    });
  });

  describe('waitForMediaProcessing()', () => {
    it('should wait until media processing succeeds', async () => {
      const client = new XClient(mockCredentials);

      // First check: pending
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          media_id_string: '123',
          processing_info: { state: 'pending', check_after_secs: 0 },
        },
        headers: {},
      });

      // Second check: in_progress
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          media_id_string: '123',
          processing_info: { state: 'in_progress', progress_percent: 50, check_after_secs: 0 },
        },
        headers: {},
      });

      // Third check: succeeded
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          media_id_string: '123',
          processing_info: { state: 'succeeded', progress_percent: 100 },
        },
        headers: {},
      });

      const result = await client.waitForMediaProcessing('123', { maxWaitMs: 1000, pollIntervalMs: 10 });

      expect(result.state).toBe('succeeded');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });

    it('should throw error when media processing fails', async () => {
      const client = new XClient(mockCredentials);

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          media_id_string: '123',
          processing_info: {
            state: 'failed',
            error: { code: 1, name: 'InvalidMedia', message: 'Invalid' },
          },
        },
        headers: {},
      });

      await expect(
        client.waitForMediaProcessing('123', { maxWaitMs: 1000, pollIntervalMs: 10 })
      ).rejects.toThrow('Media processing failed');
    });

    it('should timeout if processing takes too long', async () => {
      const client = new XClient(mockCredentials);

      // Always return in_progress
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          media_id_string: '123',
          processing_info: { state: 'in_progress', progress_percent: 50, check_after_secs: 0 },
        },
        headers: {},
      });

      await expect(
        client.waitForMediaProcessing('123', { maxWaitMs: 100, pollIntervalMs: 20 })
      ).rejects.toThrow('Media processing timeout');
    });

    it('should throw error for missing media ID', async () => {
      const client = new XClient(mockCredentials);

      await expect(client.waitForMediaProcessing('')).rejects.toThrow('Media ID is required');
    });
  });

  describe('validateMediaFile()', () => {
    it('should validate PNG images', () => {
      const client = new XClient(mockCredentials);
      const result = client.validateMediaFile('image/png', 1024 * 1024); // 1MB

      expect(result.valid).toBe(true);
      expect(result.category).toBe('tweet_image');
    });

    it('should validate JPEG images', () => {
      const client = new XClient(mockCredentials);
      const result = client.validateMediaFile('image/jpeg', 1024 * 1024);

      expect(result.valid).toBe(true);
      expect(result.category).toBe('tweet_image');
    });

    it('should validate GIF images', () => {
      const client = new XClient(mockCredentials);
      const result = client.validateMediaFile('image/gif', 5 * 1024 * 1024); // 5MB

      expect(result.valid).toBe(true);
      expect(result.category).toBe('tweet_gif');
    });

    it('should validate MP4 videos', () => {
      const client = new XClient(mockCredentials);
      const result = client.validateMediaFile('video/mp4', 50 * 1024 * 1024); // 50MB

      expect(result.valid).toBe(true);
      expect(result.category).toBe('tweet_video');
    });

    it('should reject files that are too large for images', () => {
      const client = new XClient(mockCredentials);
      const result = client.validateMediaFile('image/png', 10 * 1024 * 1024); // 10MB

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('should reject files that are too large for videos', () => {
      const client = new XClient(mockCredentials);
      const result = client.validateMediaFile('video/mp4', 600 * 1024 * 1024); // 600MB

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('should reject unsupported media types', () => {
      const client = new XClient(mockCredentials);
      const result = client.validateMediaFile('application/pdf', 1024);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported media type');
    });

    it('should reject zero-size files', () => {
      const client = new XClient(mockCredentials);
      const result = client.validateMediaFile('image/png', 0);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should validate WEBP images', () => {
      const client = new XClient(mockCredentials);
      const result = client.validateMediaFile('image/webp', 1024 * 1024);

      expect(result.valid).toBe(true);
      expect(result.category).toBe('tweet_image');
    });
  });

  describe('Media upload with different formats', () => {
    it('should upload PNG image successfully', async () => {
      const client = new XClient(mockCredentials);
      const buffer = Buffer.from('PNG-data');

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { media_id_string: '111' }, headers: {} })
        .mockResolvedValueOnce({ data: null, headers: {} })
        .mockResolvedValueOnce({
          data: { media_id_string: '111', expires_after_secs: 86400 },
          headers: {},
        });

      const result = await client.uploadMedia(buffer, 'image/png');
      expect(result.mediaId).toBe('111');
    });

    it('should upload JPEG image successfully', async () => {
      const client = new XClient(mockCredentials);
      const buffer = Buffer.from('JPEG-data');

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { media_id_string: '222' }, headers: {} })
        .mockResolvedValueOnce({ data: null, headers: {} })
        .mockResolvedValueOnce({
          data: { media_id_string: '222', expires_after_secs: 86400 },
          headers: {},
        });

      const result = await client.uploadMedia(buffer, 'image/jpeg');
      expect(result.mediaId).toBe('222');
    });

    it('should upload GIF successfully', async () => {
      const client = new XClient(mockCredentials);
      const buffer = Buffer.from('GIF-data');

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { media_id_string: '333' }, headers: {} })
        .mockResolvedValueOnce({ data: null, headers: {} })
        .mockResolvedValueOnce({
          data: { media_id_string: '333', expires_after_secs: 86400 },
          headers: {},
        });

      const result = await client.uploadMedia(buffer, 'image/gif');
      expect(result.mediaId).toBe('333');
    });

    it('should upload MP4 video successfully', async () => {
      const client = new XClient(mockCredentials);
      const buffer = Buffer.from('MP4-data');

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { media_id_string: '444' }, headers: {} })
        .mockResolvedValueOnce({ data: null, headers: {} })
        .mockResolvedValueOnce({
          data: { media_id_string: '444', expires_after_secs: 86400, processing_info: { state: 'pending' } },
          headers: {},
        });

      const result = await client.uploadMedia(buffer, 'video/mp4');
      expect(result.mediaId).toBe('444');
    });
  });

  describe('MediaUploadResult type', () => {
    it('should return complete MediaUploadResult', async () => {
      const client = new XClient(mockCredentials);
      const buffer = Buffer.from('test-data');

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { media_id_string: '555' }, headers: {} })
        .mockResolvedValueOnce({ data: null, headers: {} })
        .mockResolvedValueOnce({
          data: {
            media_id_string: '555',
            expires_after_secs: 86400,
            size: 100,
            image: { image_type: 'image/png', w: 800, h: 600 },
          },
          headers: {},
        });

      const result = await client.uploadMedia(buffer, 'image/png');

      expect(result.mediaId).toBe('555');
      expect(result.expiresAfterSecs).toBe(86400);
      expect(result.size).toBe(100);
      expect(result.imageInfo?.width).toBe(800);
      expect(result.imageInfo?.height).toBe(600);
      expect(result.imageInfo?.imageType).toBe('image/png');
    });

    it('should return video info for video uploads', async () => {
      const client = new XClient(mockCredentials);
      const buffer = Buffer.from('video-data');

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { media_id_string: '666' }, headers: {} })
        .mockResolvedValueOnce({ data: null, headers: {} })
        .mockResolvedValueOnce({
          data: {
            media_id_string: '666',
            expires_after_secs: 86400,
            video: { video_type: 'video/mp4' },
            processing_info: { state: 'pending', check_after_secs: 5 },
          },
          headers: {},
        });

      const result = await client.uploadMedia(buffer, 'video/mp4');

      expect(result.mediaId).toBe('666');
      expect(result.videoInfo?.videoType).toBe('video/mp4');
      expect(result.processingInfo?.state).toBe('pending');
      expect(result.processingInfo?.checkAfterSecs).toBe(5);
    });
  });
});
