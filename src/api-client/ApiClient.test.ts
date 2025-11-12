import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient } from './ApiClient';
import { NetworkError, TimeoutError, HttpError } from './types';

interface User {
  id: number;
  name: string;
  email: string;
}

interface CreateUserDto {
  name: string;
  email: string;
}

describe('API Client Tests', () => {
  let client: ApiClient;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  describe('Successful HTTP Methods with Type Inference', () => {
    it('should perform successful GET request with type inference', async () => {
      const mockUser: User = { id: 1, name: 'John Doe', email: 'john@example.com' };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockUser,
      });
      global.fetch = mockFetch;

      client = new ApiClient({ baseURL: 'https://api.example.com' });
      const response = await client.get<User>('/users/1');

      expect(response.status).toBe('success');
      if (response.status === 'success') {
        expect(response.data).toEqual(mockUser);
        expect(response.data.id).toBe(1);
        expect(response.data.name).toBe('John Doe');
      }
    });

    it('should perform successful POST request with type inference', async () => {
      const createDto: CreateUserDto = { name: 'Jane Doe', email: 'jane@example.com' };
      const mockUser: User = { id: 2, ...createDto };
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockUser,
      });
      global.fetch = mockFetch;

      client = new ApiClient({ baseURL: 'https://api.example.com' });
      const response = await client.post<User, CreateUserDto>('/users', createDto);

      expect(response.status).toBe('success');
      if (response.status === 'success') {
        expect(response.data).toEqual(mockUser);
      }
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(createDto),
        })
      );
    });

    it('should perform successful PUT request with type inference', async () => {
      const updateDto: CreateUserDto = { name: 'John Updated', email: 'john.updated@example.com' };
      const mockUser: User = { id: 1, ...updateDto };
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockUser,
      });
      global.fetch = mockFetch;

      client = new ApiClient({ baseURL: 'https://api.example.com' });
      const response = await client.put<User, CreateUserDto>('/users/1', updateDto);

      expect(response.status).toBe('success');
      if (response.status === 'success') {
        expect(response.data.name).toBe('John Updated');
      }
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    it('should perform successful DELETE request with type inference', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
      });
      global.fetch = mockFetch;

      client = new ApiClient({ baseURL: 'https://api.example.com' });
      const response = await client.delete<void>('/users/1');

      expect(response.status).toBe('success');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('Query Parameter Serialization', () => {
    it('should serialize query parameters correctly', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ([]),
      });
      global.fetch = mockFetch;

      client = new ApiClient({ baseURL: 'https://api.example.com' });
      await client.get('/users', { page: 1, limit: 10, active: true });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users?page=1&limit=10&active=true',
        expect.any(Object)
      );
    });

    it('should handle special characters in query parameters', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ([]),
      });
      global.fetch = mockFetch;

      client = new ApiClient({ baseURL: 'https://api.example.com' });
      await client.get('/search', { query: 'hello world', filter: 'name=John' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/search?query=hello%20world&filter=name%3DJohn',
        expect.any(Object)
      );
    });
  });

  describe('Request and Response Interceptors', () => {
    it('should execute request interceptors in order', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({}),
      });
      global.fetch = mockFetch;

      client = new ApiClient({ baseURL: 'https://api.example.com' });

      const executionOrder: number[] = [];
      client.addRequestInterceptor((config) => {
        executionOrder.push(1);
        return { ...config, headers: { ...config.headers, 'X-First': 'first' } };
      });
      client.addRequestInterceptor((config) => {
        executionOrder.push(2);
        return { ...config, headers: { ...config.headers, 'X-Second': 'second' } };
      });

      await client.get('/test');

      expect(executionOrder).toEqual([1, 2]);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-First': 'first',
            'X-Second': 'second',
          }),
        })
      );
    });

    it('should execute response interceptors in order', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ data: 'test' }),
      };
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      global.fetch = mockFetch;

      client = new ApiClient({ baseURL: 'https://api.example.com' });

      const executionOrder: number[] = [];
      client.addResponseInterceptor((response) => {
        executionOrder.push(1);
        return response;
      });
      client.addResponseInterceptor((response) => {
        executionOrder.push(2);
        return response;
      });

      await client.get('/test');

      expect(executionOrder).toEqual([1, 2]);
    });

    it('should allow interceptors to modify request config', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({}),
      });
      global.fetch = mockFetch;

      client = new ApiClient({ baseURL: 'https://api.example.com' });
      client.addRequestInterceptor((config) => ({
        ...config,
        headers: { ...config.headers, 'X-Custom-Header': 'custom-value' },
      }));

      await client.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'custom-value',
          }),
        })
      );
    });
  });

  describe('Authentication Token Injection', () => {
    it('should inject auth token into request headers when configured', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true }),
      });
      global.fetch = mockFetch;

      client = new ApiClient({
        baseURL: 'https://api.example.com',
        authToken: 'test-token-123',
      });

      await client.get('/users');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should not inject auth token when not configured', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true }),
      });
      global.fetch = mockFetch;

      client = new ApiClient({ baseURL: 'https://api.example.com' });
      await client.get('/users');

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.headers).not.toHaveProperty('Authorization');
    });

    it('should update auth token after client initialization', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true }),
      });
      global.fetch = mockFetch;

      client = new ApiClient({
        baseURL: 'https://api.example.com',
        authToken: 'initial-token',
      });

      client.setAuthToken('updated-token-456');
      await client.get('/users');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer updated-token-456',
          }),
        })
      );
    });
  });

  describe('Retry Logic with Exponential Backoff', () => {
    it('should retry on network errors with exponential backoff', async () => {
      const mockFetch = vi.fn()
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => ({ success: true }),
        });
      global.fetch = mockFetch;

      client = new ApiClient({
        baseURL: 'https://api.example.com',
        retryConfig: {
          maxRetries: 3,
          initialDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2,
        },
      });

      const response = await client.get('/users');

      expect(response.status).toBe('success');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should retry on 5xx server errors', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => ({ error: 'Service temporarily unavailable' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => ({ success: true }),
        });
      global.fetch = mockFetch;

      client = new ApiClient({
        baseURL: 'https://api.example.com',
        retryConfig: {
          maxRetries: 2,
          initialDelay: 50,
          maxDelay: 500,
          backoffMultiplier: 2,
        },
      });

      const response = await client.get('/users');

      expect(response.status).toBe('success');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx client errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ error: 'Resource not found' }),
      });
      global.fetch = mockFetch;

      client = new ApiClient({
        baseURL: 'https://api.example.com',
        retryConfig: {
          maxRetries: 3,
          initialDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2,
        },
      });

      const response = await client.get('/users/999');

      expect(response.status).toBe('error');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should return error after exhausting all retries', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));
      global.fetch = mockFetch;

      client = new ApiClient({
        baseURL: 'https://api.example.com',
        retryConfig: {
          maxRetries: 2,
          initialDelay: 50,
          maxDelay: 500,
          backoffMultiplier: 2,
        },
      });

      const response = await client.get('/users');

      expect(response.status).toBe('error');
      if (response.status === 'error') {
        expect(response.error).toBeInstanceOf(NetworkError);
      }
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should apply exponential backoff with increasing delays', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));
      global.fetch = mockFetch;

      client = new ApiClient({
        baseURL: 'https://api.example.com',
        retryConfig: {
          maxRetries: 2,
          initialDelay: 50,
          maxDelay: 10000,
          backoffMultiplier: 2,
        },
      });

      const startTime = Date.now();
      await client.get('/users');
      const endTime = Date.now();

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Network Error Handling', () => {
    it('should handle network connection errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
      global.fetch = mockFetch;

      client = new ApiClient({
        baseURL: 'https://api.example.com',
        retryConfig: { maxRetries: 0, initialDelay: 100, maxDelay: 1000, backoffMultiplier: 2 },
      });

      const response = await client.get('/users');

      expect(response.status).toBe('error');
      if (response.status === 'error') {
        expect(response.error).toBeInstanceOf(NetworkError);
        expect(response.error.type).toBe('network');
        expect(response.error.message).toContain('Network request failed');
      }
    });

    it('should preserve original error in NetworkError', async () => {
      const originalError = new Error('DNS resolution failed');
      const mockFetch = vi.fn().mockRejectedValue(originalError);
      global.fetch = mockFetch;

      client = new ApiClient({
        baseURL: 'https://api.example.com',
        retryConfig: { maxRetries: 0, initialDelay: 100, maxDelay: 1000, backoffMultiplier: 2 },
      });

      const response = await client.get('/users');

      expect(response.status).toBe('error');
      if (response.status === 'error' && response.error instanceof NetworkError) {
        expect(response.error.originalError).toBe(originalError);
      }
    });
  });

  describe('Timeout Error Handling', () => {
    it('should timeout requests that exceed configured timeout', async () => {
      const mockFetch = vi.fn().mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          const signal = options?.signal as AbortSignal;
          if (signal) {
            signal.addEventListener('abort', () => {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            });
          }
        });
      });
      global.fetch = mockFetch;

      client = new ApiClient({
        baseURL: 'https://api.example.com',
        timeout: 50,
        retryConfig: { maxRetries: 0, initialDelay: 100, maxDelay: 1000, backoffMultiplier: 2 },
      });

      const response = await client.get('/users');

      expect(response.status).toBe('error');
      if (response.status === 'error') {
        expect(response.error).toBeInstanceOf(TimeoutError);
        expect(response.error.type).toBe('timeout');
        if (response.error instanceof TimeoutError) {
          expect(response.error.timeoutMs).toBe(50);
        }
      }
    });
  });

  describe('HTTP 4xx Error Handling', () => {
    it('should handle 400 Bad Request errors', async () => {
      const errorBody = { error: 'Invalid request data', field: 'email' };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => errorBody,
      });
      global.fetch = mockFetch;

      client = new ApiClient({
        baseURL: 'https://api.example.com',
        retryConfig: { maxRetries: 0, initialDelay: 100, maxDelay: 1000, backoffMultiplier: 2 },
      });

      const response = await client.post('/users', { email: 'invalid' });

      expect(response.status).toBe('error');
      if (response.status === 'error') {
        expect(response.error).toBeInstanceOf(HttpError);
        expect(response.error.type).toBe('http');
        if (response.error instanceof HttpError) {
          expect(response.error.statusCode).toBe(400);
          expect(response.error.responseBody).toEqual(errorBody);
          expect(response.error.isClientError()).toBe(true);
          expect(response.error.isServerError()).toBe(false);
        }
      }
    });

    it('should handle 401 Unauthorized errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ error: 'Invalid credentials' }),
      });
      global.fetch = mockFetch;

      client = new ApiClient({
        baseURL: 'https://api.example.com',
        retryConfig: { maxRetries: 0, initialDelay: 100, maxDelay: 1000, backoffMultiplier: 2 },
      });

      const response = await client.get('/protected');

      expect(response.status).toBe('error');
      if (response.status === 'error' && response.error instanceof HttpError) {
        expect(response.error.statusCode).toBe(401);
      }
    });

    it('should handle 404 Not Found errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ error: 'Resource not found' }),
      });
      global.fetch = mockFetch;

      client = new ApiClient({
        baseURL: 'https://api.example.com',
        retryConfig: { maxRetries: 0, initialDelay: 100, maxDelay: 1000, backoffMultiplier: 2 },
      });

      const response = await client.get('/users/999');

      expect(response.status).toBe('error');
      if (response.status === 'error' && response.error instanceof HttpError) {
        expect(response.error.statusCode).toBe(404);
        expect(response.error.isClientError()).toBe(true);
      }
    });
  });

  describe('HTTP 5xx Error Handling', () => {
    it('should handle 500 Internal Server Error', async () => {
      const errorBody = { error: 'Internal server error', trace: 'stack-trace' };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => errorBody,
      });
      global.fetch = mockFetch;

      client = new ApiClient({
        baseURL: 'https://api.example.com',
        retryConfig: { maxRetries: 0, initialDelay: 100, maxDelay: 1000, backoffMultiplier: 2 },
      });

      const response = await client.get('/users');

      expect(response.status).toBe('error');
      if (response.status === 'error') {
        expect(response.error).toBeInstanceOf(HttpError);
        if (response.error instanceof HttpError) {
          expect(response.error.statusCode).toBe(500);
          expect(response.error.responseBody).toEqual(errorBody);
          expect(response.error.isServerError()).toBe(true);
          expect(response.error.isClientError()).toBe(false);
        }
      }
    });

    it('should handle 503 Service Unavailable errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ error: 'Service temporarily unavailable' }),
      });
      global.fetch = mockFetch;

      client = new ApiClient({
        baseURL: 'https://api.example.com',
        retryConfig: { maxRetries: 0, initialDelay: 100, maxDelay: 1000, backoffMultiplier: 2 },
      });

      const response = await client.get('/users');

      expect(response.status).toBe('error');
      if (response.status === 'error' && response.error instanceof HttpError) {
        expect(response.error.statusCode).toBe(503);
        expect(response.error.isServerError()).toBe(true);
      }
    });
  });
});
