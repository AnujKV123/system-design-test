/**
 * API Client Implementation
 * 
 * A type-safe HTTP client with support for interceptors, retry logic,
 * authentication, and comprehensive error handling.
 */

import {
  ApiClientConfig,
  ApiResponse,
  RequestConfig,
  RequestInterceptor,
  ResponseInterceptor,
  NetworkError,
  TimeoutError,
  HttpError,
} from './types';

/**
 * Type-safe HTTP client for making API requests.
 * Provides full type inference for requests and responses.
 */
export class ApiClient {
  private readonly config: Required<ApiClientConfig>;
  private readonly requestInterceptors: RequestInterceptor[] = [];
  private readonly responseInterceptors: ResponseInterceptor[] = [];

  constructor(config: ApiClientConfig) {
    // Set default values for optional configuration
    this.config = {
      baseURL: config.baseURL,
      timeout: config.timeout ?? 30000, // Default 30 second timeout
      headers: config.headers ?? {},
      retryConfig: config.retryConfig ?? {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
      },
      authToken: config.authToken ?? '',
    };
  }

  /**
   * Updates the authentication token used for requests.
   * The new token will be used for all subsequent requests.
   * 
   * @param token - The new authentication token (or empty string to remove)
   * @returns The ApiClient instance for method chaining
   */
  setAuthToken(token: string): this {
    this.config.authToken = token;
    return this;
  }

  /**
   * Gets the current authentication token.
   * 
   * @returns The current authentication token or empty string if not set
   */
  getAuthToken(): string {
    return this.config.authToken;
  }

  /**
   * Registers a request interceptor that will be executed before each request.
   * Interceptors are executed in the order they are registered.
   * 
   * @param interceptor - Function that receives and can modify the request config
   * @returns The ApiClient instance for method chaining
   */
  addRequestInterceptor(interceptor: RequestInterceptor): this {
    this.requestInterceptors.push(interceptor);
    return this;
  }

  /**
   * Registers a response interceptor that will be executed after each response.
   * Interceptors are executed in the order they are registered.
   * 
   * @param interceptor - Function that receives and can modify the response
   * @returns The ApiClient instance for method chaining
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): this {
    this.responseInterceptors.push(interceptor);
    return this;
  }

  /**
   * Performs a GET request with type inference.
   * 
   * @template T - The expected response data type
   * @param url - The endpoint URL (relative to baseURL)
   * @param params - Optional query parameters
   * @returns Promise resolving to ApiResponse with typed data
   */
  async get<T>(
    url: string,
    params?: Record<string, string | number | boolean>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'GET',
      url,
      params,
    });
  }

  /**
   * Performs a POST request with typed request body and response.
   * 
   * @template T - The expected response data type
   * @template B - The request body type
   * @param url - The endpoint URL (relative to baseURL)
   * @param body - The request body
   * @returns Promise resolving to ApiResponse with typed data
   */
  async post<T, B = unknown>(url: string, body?: B): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'POST',
      url,
      body,
    });
  }

  /**
   * Performs a PUT request with typed request body and response.
   * 
   * @template T - The expected response data type
   * @template B - The request body type
   * @param url - The endpoint URL (relative to baseURL)
   * @param body - The request body
   * @returns Promise resolving to ApiResponse with typed data
   */
  async put<T, B = unknown>(url: string, body?: B): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      url,
      body,
    });
  }

  /**
   * Performs a DELETE request with type inference.
   * 
   * @template T - The expected response data type
   * @param url - The endpoint URL (relative to baseURL)
   * @returns Promise resolving to ApiResponse with typed data
   */
  async delete<T>(url: string): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      url,
    });
  }

  /**
   * Core request method that handles the HTTP request lifecycle.
   * Includes timeout handling, error transformation, and response parsing.
   * Wraps the request in retry logic with exponential backoff.
   * 
   * @template T - The expected response data type
   * @param requestConfig - Configuration for the request
   * @returns Promise resolving to ApiResponse with typed data
   */
  private async request<T>(requestConfig: RequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.retryWithBackoff(() => this.fetchWithTimeout(requestConfig));
      const data = await this.parseResponse<T>(response);
      
      return {
        status: 'success',
        data,
      };
    } catch (error) {
      return {
        status: 'error',
        error: this.transformError(error),
      };
    }
  }

  /**
   * Wraps a request execution with retry logic and exponential backoff.
   * Retries are only attempted for retryable errors (network errors, 5xx status codes).
   * 
   * @template T - The return type of the request function
   * @param requestFn - The function to execute with retry logic
   * @returns Promise resolving to the result of the request function
   * @throws The last error encountered if all retries are exhausted
   */
  private async retryWithBackoff<T>(requestFn: () => Promise<T>): Promise<T> {
    const { maxRetries, initialDelay, maxDelay, backoffMultiplier } = this.config.retryConfig;
    let lastError: Error;

    // Attempt the request (initial attempt + retries)
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Execute the request
        return await requestFn();
      } catch (error) {
        lastError = error as Error;

        // Check if this error is retryable
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // If we've exhausted all retries, throw the error
        if (attempt === maxRetries) {
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateBackoffDelay(
          attempt,
          initialDelay,
          maxDelay,
          backoffMultiplier
        );

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError!;
  }

  /**
   * Determines if an error is retryable.
   * Network errors and 5xx server errors are retryable.
   * Client errors (4xx) and timeout errors are not retryable.
   * 
   * @param error - The error to check
   * @returns True if the error is retryable, false otherwise
   */
  private isRetryableError(error: unknown): boolean {
    // Network errors are retryable (connection issues, DNS failures, etc.)
    if (error instanceof NetworkError) {
      return true;
    }

    // Server errors (5xx) are retryable
    if (error instanceof HttpError && error.isServerError()) {
      return true;
    }

    // Client errors (4xx) and timeout errors are not retryable
    return false;
  }

  /**
   * Calculates the delay for the next retry attempt using exponential backoff with jitter.
   * Jitter helps prevent thundering herd problem when multiple clients retry simultaneously.
   * 
   * @param attempt - The current attempt number (0-indexed)
   * @param initialDelay - The initial delay in milliseconds
   * @param maxDelay - The maximum delay in milliseconds
   * @param backoffMultiplier - The multiplier for exponential backoff
   * @returns The calculated delay in milliseconds
   */
  private calculateBackoffDelay(
    attempt: number,
    initialDelay: number,
    maxDelay: number,
    backoffMultiplier: number
  ): number {
    // Calculate exponential backoff: initialDelay * (backoffMultiplier ^ attempt)
    const exponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt);

    // Cap at maxDelay
    const cappedDelay = Math.min(exponentialDelay, maxDelay);

    // Add jitter: random value between 0 and cappedDelay
    // This prevents all clients from retrying at exactly the same time
    const jitter = Math.random() * cappedDelay;

    return jitter;
  }

  /**
   * Utility function to sleep for a specified duration.
   * 
   * @param ms - The duration to sleep in milliseconds
   * @returns Promise that resolves after the specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wrapper around fetch that implements timeout handling using AbortController.
   * 
   * @param requestConfig - Configuration for the request
   * @returns Promise resolving to the Response object
   * @throws NetworkError for network failures
   * @throws TimeoutError when request exceeds timeout
   * @throws HttpError for HTTP error status codes
   */
  private async fetchWithTimeout(requestConfig: RequestConfig): Promise<Response> {
    // Inject authentication token into request config before interceptors
    let modifiedConfig = this.injectAuthToken(requestConfig);

    // Execute request interceptors in order
    for (const interceptor of this.requestInterceptors) {
      modifiedConfig = await interceptor(modifiedConfig);
    }

    const { method, url, headers, body, params } = modifiedConfig;
    const timeout = modifiedConfig.timeout ?? this.config.timeout;

    // Build full URL with query parameters
    const fullUrl = this.buildUrl(url, params);

    // Create AbortController for timeout handling
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeout);

    try {
      // Merge default headers with request-specific headers
      const mergedHeaders: Record<string, string> = {
        ...this.config.headers,
        ...headers,
      };

      // Add Content-Type for requests with body
      if (body && !mergedHeaders['Content-Type']) {
        mergedHeaders['Content-Type'] = 'application/json';
      }

      // Perform the fetch request
      let response = await fetch(fullUrl, {
        method,
        headers: mergedHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      // Execute response interceptors in order
      for (const interceptor of this.responseInterceptors) {
        response = await interceptor(response);
      }

      // Check for HTTP error status codes
      if (!response.ok) {
        const responseBody = await this.safeParseResponseBody(response);
        throw new HttpError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          responseBody
        );
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout errors
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(
          `Request timeout after ${timeout}ms`,
          timeout
        );
      }

      // Re-throw if already an ApiError
      if (error instanceof HttpError) {
        throw error;
      }

      // Transform network errors
      throw new NetworkError(
        `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Injects the authentication token into the request headers.
   * This happens before request interceptors are executed, allowing
   * interceptors to override or modify the token if needed.
   * 
   * @param requestConfig - The request configuration
   * @returns Modified request configuration with auth token injected
   */
  private injectAuthToken(requestConfig: RequestConfig): RequestConfig {
    // If no auth token is configured, return config unchanged
    if (!this.config.authToken) {
      return requestConfig;
    }

    // Create a copy of the config to avoid mutation
    const modifiedConfig = { ...requestConfig };

    // Inject Authorization header with Bearer token
    modifiedConfig.headers = {
      ...modifiedConfig.headers,
      Authorization: `Bearer ${this.config.authToken}`,
    };

    return modifiedConfig;
  }

  /**
   * Builds the full URL with query parameters.
   * 
   * @param url - The endpoint URL (relative or absolute)
   * @param params - Optional query parameters
   * @returns The full URL with serialized query parameters
   */
  private buildUrl(
    url: string,
    params?: Record<string, string | number | boolean>
  ): string {
    // Use absolute URL if provided, otherwise prepend baseURL
    const baseUrl = url.startsWith('http') ? url : `${this.config.baseURL}${url}`;

    // Return base URL if no params
    if (!params || Object.keys(params).length === 0) {
      return baseUrl;
    }

    // Serialize query parameters
    const queryString = this.serializeQueryParams(params);
    const separator = baseUrl.includes('?') ? '&' : '?';
    
    return `${baseUrl}${separator}${queryString}`;
  }

  /**
   * Serializes query parameters into URL-encoded string.
   * 
   * @param params - Query parameters to serialize
   * @returns URL-encoded query string
   */
  private serializeQueryParams(
    params: Record<string, string | number | boolean>
  ): string {
    return Object.entries(params)
      .map(([key, value]) => {
        const encodedKey = encodeURIComponent(key);
        const encodedValue = encodeURIComponent(String(value));
        return `${encodedKey}=${encodedValue}`;
      })
      .join('&');
  }

  /**
   * Parses the response body as JSON with type inference.
   * 
   * @template T - The expected response data type
   * @param response - The Response object
   * @returns Promise resolving to the parsed data
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('Content-Type');
    
    // Handle empty responses
    if (response.status === 204 || !contentType) {
      return undefined as T;
    }

    // Parse JSON responses
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }

    // Return text for non-JSON responses
    return (await response.text()) as T;
  }

  /**
   * Safely parses response body, returning undefined if parsing fails.
   * Used for error responses where body might not be valid JSON.
   * 
   * @param response - The Response object
   * @returns Promise resolving to the parsed body or undefined
   */
  private async safeParseResponseBody(response: Response): Promise<unknown> {
    try {
      const contentType = response.headers.get('Content-Type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch {
      return undefined;
    }
  }

  /**
   * Transforms unknown errors into typed ApiError instances.
   * 
   * @param error - The error to transform
   * @returns A typed ApiError instance
   */
  private transformError(error: unknown): NetworkError | TimeoutError | HttpError {
    // Already a typed error
    if (error instanceof NetworkError || 
        error instanceof TimeoutError || 
        error instanceof HttpError) {
      return error;
    }

    // Fallback to NetworkError for unknown errors
    return new NetworkError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      error instanceof Error ? error : undefined
    );
  }
}
