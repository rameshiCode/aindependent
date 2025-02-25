// lib/api/core/request.tsx
import { OpenAPI } from './OpenAPI';

/**
 * API request options
 */
export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  body?: any;
  headers?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean | null | undefined>;
}

/**
 * API Response error
 */
export class ApiError extends Error {
  public status: number;
  public statusText: string;
  public data: any;

  constructor(response: Response, data: any) {
    super(response.statusText);
    this.name = 'ApiError';
    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
  }
}

/**
 * Handle request parameters and build the final URL
 */
const buildUrl = (options: RequestOptions): string => {
  const url = new URL(options.url);
  
  if (options.queryParams) {
    Object.keys(options.queryParams).forEach(key => {
      const value = options.queryParams![key];
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  return url.toString();
};

/**
 * Generic request function for API calls
 */
export async function request<T = any>(options: RequestOptions): Promise<T> {
  const { method, body, headers = {} } = options;
  
  // Build the final URL
  const url = buildUrl(options);
  
  // Default headers
  const defaultHeaders: Record<string, string> = {
    'Accept': 'application/json',
  };
  
  // If we have a token, add it to headers
  if (OpenAPI.TOKEN) {
    defaultHeaders['Authorization'] = `Bearer ${OpenAPI.TOKEN}`;
  }
  
  // Merge default headers with provided headers
  const requestHeaders = { ...defaultHeaders, ...headers };
  
  // Make the request
  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body,
    credentials: OpenAPI.withCredentials ? 'include' : undefined,
  });
  
  // Parse the response
  let responseData: any;
  
  const contentType = response.headers.get('Content-Type');
  if (contentType?.includes('application/json')) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }
  
  // Handle error responses
  if (!response.ok) {
    throw new ApiError(response, responseData);
  }
  
  return responseData;
}