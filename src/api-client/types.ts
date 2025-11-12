/**
 * API Client Types and Error Classes
 * 
 * This module defines the core types and error classes for the type-safe API client.
 */

// ============================================================================
// Response Types (Discriminated Union)
// ============================================================================

/**
 * Discriminated union type representing the state of an API response.
 * Uses 'status' as the discriminator for type narrowing.
 */
export type ApiResponse<T> =
  | { status: 'success'; data: T }
  | { status: 'error'; error: ApiError }
  | { status: 'loading' };

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base class for all API-related errors.
 * Provides a common interface for error handling with type discrimination.
 */
export abstract class ApiError extends Error {
  abstract readonly type: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when a network-level failure occurs.
 * Examples: connection refused, DNS resolution failure, no internet connection.
 */
export class NetworkError extends ApiError {
  readonly type = 'network' as const;

  constructor(message: string, public readonly originalError?: Error) {
    super(message);
  }
}

/**
 * Error thrown when a request exceeds the configured timeout duration.
 */
export class TimeoutError extends ApiError {
  readonly type = 'timeout' as const;

  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
  }
}

/**
 * Error thrown when the server returns an HTTP error status code (4xx or 5xx).
 * Includes the status code and response body for detailed error handling.
 */
export class HttpError extends ApiError {
  readonly type = 'http' as const;

  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: unknown
  ) {
    super(message);
  }

  /**
   * Checks if this is a client error (4xx status code).
   */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Checks if this is a server error (5xx status code).
   */
  isServerError(): boolean {
    return this.statusCode >= 500 && this.statusCode < 600;
  }
}

// ============================================================================
// Configuration Interfaces
// ============================================================================

/**
 * Configuration for retry behavior with exponential backoff.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds before first retry */
  initialDelay: number;
  /** Maximum delay in milliseconds between retries */
  maxDelay: number;
  /** Multiplier for exponential backoff (e.g., 2 for doubling) */
  backoffMultiplier: number;
}

/**
 * Configuration options for the API client.
 */
export interface ApiClientConfig {
  /** Base URL for all API requests */
  baseURL: string;
  /** Request timeout in milliseconds (optional) */
  timeout?: number;
  /** Default headers to include in all requests (optional) */
  headers?: Record<string, string>;
  /** Retry configuration for failed requests (optional) */
  retryConfig?: RetryConfig;
  /** Authentication token to inject into requests (optional) */
  authToken?: string;
}

// ============================================================================
// Request Configuration
// ============================================================================

/**
 * Configuration for an individual HTTP request.
 */
export interface RequestConfig {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Request URL (relative to baseURL or absolute) */
  url: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body (for POST, PUT, PATCH) */
  body?: unknown;
  /** Query parameters */
  params?: Record<string, string | number | boolean>;
  /** Request timeout override */
  timeout?: number;
}

// ============================================================================
// Interceptor Types
// ============================================================================

/**
 * Function that intercepts and potentially modifies a request before it's sent.
 * Can be synchronous or asynchronous.
 */
export type RequestInterceptor = (
  config: RequestConfig
) => RequestConfig | Promise<RequestConfig>;

/**
 * Function that intercepts and potentially modifies a response after it's received.
 * Can be synchronous or asynchronous.
 */
export type ResponseInterceptor = (
  response: Response
) => Response | Promise<Response>;
