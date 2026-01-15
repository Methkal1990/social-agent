import { describe, it, expect, vi } from 'vitest';
import {
  AppError,
  XAPIError,
  OpenRouterError,
  ConfigError,
  NetworkError,
  withRetry,
  isRetryable,
  collectErrorContext,
  type RetryConfig,
} from '@/utils/errors.js';

describe('AppError', () => {
  it('should create error with user-friendly message', () => {
    const error = new AppError('Something went wrong', 'A user-friendly message');
    expect(error.message).toBe('Something went wrong');
    expect(error.userMessage).toBe('A user-friendly message');
    expect(error.name).toBe('AppError');
  });

  it('should use message as userMessage if not provided', () => {
    const error = new AppError('Something went wrong');
    expect(error.userMessage).toBe('Something went wrong');
  });

  it('should capture stack trace', () => {
    const error = new AppError('test');
    expect(error.stack).toBeDefined();
  });

  it('should be instanceof Error', () => {
    const error = new AppError('test');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('XAPIError', () => {
  it('should create X API error with status code', () => {
    const error = new XAPIError('Rate limit exceeded', 429, '/2/tweets');
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.statusCode).toBe(429);
    expect(error.endpoint).toBe('/2/tweets');
    expect(error.name).toBe('XAPIError');
  });

  it('should include response data if provided', () => {
    const responseData = { errors: [{ message: 'Too many requests' }] };
    const error = new XAPIError('Rate limit', 429, '/2/tweets', responseData);
    expect(error.responseData).toEqual(responseData);
  });

  it('should generate user-friendly message for rate limit', () => {
    const error = new XAPIError('Rate limit exceeded', 429, '/2/tweets');
    expect(error.userMessage).toContain('rate limit');
  });

  it('should generate user-friendly message for auth errors', () => {
    const error = new XAPIError('Unauthorized', 401, '/2/users/me');
    expect(error.userMessage).toContain('authentication');
  });

  it('should generate user-friendly message for server errors', () => {
    const error = new XAPIError('Internal Server Error', 500, '/2/tweets');
    expect(error.userMessage).toContain('temporarily unavailable');
  });

  it('should be instanceof AppError', () => {
    const error = new XAPIError('test', 500, '/test');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(XAPIError);
  });
});

describe('OpenRouterError', () => {
  it('should create OpenRouter error with model info', () => {
    const error = new OpenRouterError('Model overloaded', 'anthropic/claude-3-opus', 529);
    expect(error.message).toBe('Model overloaded');
    expect(error.model).toBe('anthropic/claude-3-opus');
    expect(error.statusCode).toBe(529);
    expect(error.name).toBe('OpenRouterError');
  });

  it('should handle errors without status code', () => {
    const error = new OpenRouterError('Network error', 'gpt-4');
    expect(error.statusCode).toBeUndefined();
  });

  it('should generate user-friendly message for model errors', () => {
    const error = new OpenRouterError('Model not available', 'gpt-4', 404);
    expect(error.userMessage).toContain('AI');
  });

  it('should generate user-friendly message for rate limits', () => {
    const error = new OpenRouterError('Rate limited', 'claude-3', 429);
    expect(error.userMessage).toContain('rate limit');
  });

  it('should be instanceof AppError', () => {
    const error = new OpenRouterError('test', 'model');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(OpenRouterError);
  });
});

describe('ConfigError', () => {
  it('should create config error with file path', () => {
    const error = new ConfigError('Invalid YAML syntax', 'main.yaml');
    expect(error.message).toBe('Invalid YAML syntax');
    expect(error.configFile).toBe('main.yaml');
    expect(error.name).toBe('ConfigError');
  });

  it('should include field name if provided', () => {
    const error = new ConfigError('Invalid value', 'main.yaml', 'settings.log_level');
    expect(error.fieldName).toBe('settings.log_level');
  });

  it('should generate user-friendly message', () => {
    const error = new ConfigError('Parse error', 'persona.yaml');
    expect(error.userMessage.toLowerCase()).toContain('configuration');
    expect(error.userMessage).toContain('persona.yaml');
  });

  it('should be instanceof AppError', () => {
    const error = new ConfigError('test', 'test.yaml');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(ConfigError);
  });
});

describe('NetworkError', () => {
  it('should create network error with operation', () => {
    const error = new NetworkError('Connection refused', 'POST /2/tweets');
    expect(error.message).toBe('Connection refused');
    expect(error.operation).toBe('POST /2/tweets');
    expect(error.name).toBe('NetworkError');
  });

  it('should include error code if provided', () => {
    const error = new NetworkError('Timeout', 'fetch', 'ETIMEDOUT');
    expect(error.code).toBe('ETIMEDOUT');
  });

  it('should generate user-friendly message for timeout', () => {
    const error = new NetworkError('Timeout', 'api call', 'ETIMEDOUT');
    expect(error.userMessage).toContain('timed out');
  });

  it('should generate user-friendly message for connection reset', () => {
    const error = new NetworkError('Connection reset', 'api call', 'ECONNRESET');
    expect(error.userMessage).toContain('connection');
  });

  it('should generate user-friendly message for no connection', () => {
    const error = new NetworkError('No connection', 'api call', 'ENOTFOUND');
    expect(error.userMessage).toContain('connect');
  });

  it('should be instanceof AppError', () => {
    const error = new NetworkError('test', 'test');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(NetworkError);
  });
});

describe('isRetryable', () => {
  it('should return true for network timeout', () => {
    const error = new NetworkError('Timeout', 'api', 'ETIMEDOUT');
    expect(isRetryable(error)).toBe(true);
  });

  it('should return true for connection reset', () => {
    const error = new NetworkError('Reset', 'api', 'ECONNRESET');
    expect(isRetryable(error)).toBe(true);
  });

  it('should return true for X API rate limit (429)', () => {
    const error = new XAPIError('Rate limit', 429, '/2/tweets');
    expect(isRetryable(error)).toBe(true);
  });

  it('should return true for X API server error (5xx)', () => {
    const error = new XAPIError('Server error', 500, '/2/tweets');
    expect(isRetryable(error)).toBe(true);

    const error502 = new XAPIError('Bad gateway', 502, '/2/tweets');
    expect(isRetryable(error502)).toBe(true);

    const error503 = new XAPIError('Service unavailable', 503, '/2/tweets');
    expect(isRetryable(error503)).toBe(true);
  });

  it('should return true for OpenRouter rate limit (429)', () => {
    const error = new OpenRouterError('Rate limit', 'gpt-4', 429);
    expect(isRetryable(error)).toBe(true);
  });

  it('should return true for OpenRouter overload (529)', () => {
    const error = new OpenRouterError('Overloaded', 'claude-3', 529);
    expect(isRetryable(error)).toBe(true);
  });

  it('should return false for X API auth error (401)', () => {
    const error = new XAPIError('Unauthorized', 401, '/2/users/me');
    expect(isRetryable(error)).toBe(false);
  });

  it('should return false for X API forbidden (403)', () => {
    const error = new XAPIError('Forbidden', 403, '/2/tweets');
    expect(isRetryable(error)).toBe(false);
  });

  it('should return false for X API not found (404)', () => {
    const error = new XAPIError('Not found', 404, '/2/tweets/123');
    expect(isRetryable(error)).toBe(false);
  });

  it('should return false for config errors', () => {
    const error = new ConfigError('Invalid config', 'main.yaml');
    expect(isRetryable(error)).toBe(false);
  });

  it('should return false for generic errors', () => {
    const error = new Error('Something went wrong');
    expect(isRetryable(error)).toBe(false);
  });

  it('should return false for app errors without specific handling', () => {
    const error = new AppError('Generic app error');
    expect(isRetryable(error)).toBe(false);
  });
});

describe('withRetry', () => {
  // Use very short delays for testing to avoid slow tests
  const fastConfig: RetryConfig = { maxAttempts: 3, initialDelay: 1, maxDelay: 5, factor: 2 };

  it('should return result on first successful attempt', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    const result = await withRetry(operation, fastConfig);
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable error and succeed', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new XAPIError('Rate limit', 429, '/test'))
      .mockResolvedValueOnce('success');

    const result = await withRetry(operation, fastConfig);
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should throw after max attempts', async () => {
    const error = new XAPIError('Rate limit', 429, '/test');
    const operation = vi.fn().mockRejectedValue(error);

    await expect(withRetry(operation, fastConfig)).rejects.toThrow(error);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should not retry non-retryable errors', async () => {
    const error = new XAPIError('Unauthorized', 401, '/test');
    const operation = vi.fn().mockRejectedValue(error);

    await expect(withRetry(operation, fastConfig)).rejects.toThrow(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should use custom retry config with max attempts', async () => {
    const error = new XAPIError('Error', 500, '/test');
    const operation = vi.fn().mockRejectedValue(error);
    const config: RetryConfig = { maxAttempts: 5, initialDelay: 1, maxDelay: 10, factor: 2 };

    await expect(withRetry(operation, config)).rejects.toThrow();
    expect(operation).toHaveBeenCalledTimes(5);
  });

  it('should call onRetry callback when retrying', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new XAPIError('Error', 500, '/test'))
      .mockResolvedValueOnce('success');

    const onRetry = vi.fn();
    const config: RetryConfig = {
      maxAttempts: 3,
      initialDelay: 1,
      maxDelay: 10,
      factor: 2,
      onRetry,
    };

    await withRetry(operation, config);

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(XAPIError), 1, 1);
  });

  it('should calculate exponential backoff delay correctly', async () => {
    const delays: number[] = [];
    const operation = vi.fn().mockRejectedValue(new XAPIError('Error', 500, '/test'));
    const config: RetryConfig = {
      maxAttempts: 4,
      initialDelay: 10,
      maxDelay: 100,
      factor: 2,
      onRetry: (_err, _attempt, delay) => delays.push(delay),
    };

    await expect(withRetry(operation, config)).rejects.toThrow();

    // Delays: 10, 20, 40 (for attempts 1, 2, 3 before attempt 4)
    expect(delays).toEqual([10, 20, 40]);
  });

  it('should cap delay at maxDelay', async () => {
    const delays: number[] = [];
    const operation = vi.fn().mockRejectedValue(new XAPIError('Error', 500, '/test'));
    const config: RetryConfig = {
      maxAttempts: 5,
      initialDelay: 10,
      maxDelay: 25,
      factor: 3,
      onRetry: (_err, _attempt, delay) => delays.push(delay),
    };

    await expect(withRetry(operation, config)).rejects.toThrow();

    // Delays: 10, 25 (capped from 30), 25 (capped from 90), 25 (capped from 270)
    expect(delays).toEqual([10, 25, 25, 25]);
  });
});

describe('collectErrorContext', () => {
  it('should collect error context with timestamp', () => {
    const error = new AppError('Test error');
    const context = collectErrorContext(error, 'test_operation');

    expect(context.timestamp).toBeDefined();
    expect(new Date(context.timestamp)).toBeInstanceOf(Date);
  });

  it('should include operation name', () => {
    const error = new AppError('Test error');
    const context = collectErrorContext(error, 'post_tweet');

    expect(context.operation).toBe('post_tweet');
  });

  it('should include component from error constructor name', () => {
    const error = new XAPIError('Test', 500, '/test');
    const context = collectErrorContext(error, 'test');

    expect(context.component).toBe('XAPIError');
  });

  it('should include environment info', () => {
    const error = new AppError('Test');
    const context = collectErrorContext(error, 'test');

    expect(context.environment).toBeDefined();
    expect(context.environment.nodeVersion).toBe(process.version);
    expect(context.environment.platform).toBe(process.platform);
    expect(context.environment.agentVersion).toBeDefined();
  });

  it('should include input if provided', () => {
    const error = new AppError('Test');
    const input = { text: 'Hello world' };
    const context = collectErrorContext(error, 'test', input);

    expect(context.input).toEqual(input);
  });

  it('should include state if provided', () => {
    const error = new AppError('Test');
    const state = { queueLength: 5 };
    const context = collectErrorContext(error, 'test', undefined, state);

    expect(context.state).toEqual(state);
  });

  it('should handle error details for XAPIError', () => {
    const error = new XAPIError('Rate limit', 429, '/2/tweets', {
      errors: [{ message: 'Too many requests' }],
    });
    const context = collectErrorContext(error, 'post');

    expect(context.errorDetails).toBeDefined();
    expect(context.errorDetails?.statusCode).toBe(429);
    expect(context.errorDetails?.endpoint).toBe('/2/tweets');
  });

  it('should handle error details for NetworkError', () => {
    const error = new NetworkError('Timeout', 'fetch', 'ETIMEDOUT');
    const context = collectErrorContext(error, 'api_call');

    expect(context.errorDetails).toBeDefined();
    expect(context.errorDetails?.code).toBe('ETIMEDOUT');
  });
});
