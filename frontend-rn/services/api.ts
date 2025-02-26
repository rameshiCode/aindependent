import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Constants
const TOKEN_KEY = 'auth_token';
const API_URL = 'http://127.0.0.1:8000/api/v1';

// For Android emulator, you need to use 10.0.2.2 instead of localhost/127.0.0.1
const getBaseUrl = () => {
  if (Platform.OS === 'android' && __DEV__) {
    return 'http://10.0.2.2:8000/api/v1';
  }
  return API_URL;
};

// Types
export interface User {
  id: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_superuser: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

/**
 * Helper function to get the stored auth token
 */
export const getToken = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(TOKEN_KEY);
};

/**
 * Helper function to set the auth token in secure storage
 */
export const setToken = async (token: string): Promise<void> => {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
};

/**
 * Helper function to remove the auth token from secure storage
 */
export const removeToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
};

/**
 * Base API request function with automatic auth token inclusion
 */
export const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = await getToken();
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    // Handle different error statuses appropriately
    if (response.status === 401) {
      // Unauthorized, token might be expired
      await removeToken();
      // You might want to redirect to login page here
    }

    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  // Special case for 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return await response.json();
};

/**
 * API Service object with methods for interacting with the backend
 */
export const api = {
  auth: {
    /**
     * Get the URL for initiating Google login
     */
    getGoogleLoginUrl: () => {
      const baseUrl = getBaseUrl();
      return `${baseUrl}/login/google/mobile`;
    },

    /**
     * Fetch the current user's information
     */
    getCurrentUser: async (): Promise<User> => {
      return apiRequest<User>('/users/me');
    },

    /**
     * Logout the current user 
     * (Note: this only removes the token locally, as JWT tokens can't be invalidated server-side)
     */
    logout: async (): Promise<void> => {
      await removeToken();
    },
  },

  users: {
    /**
     * Update the current user's profile
     */
    updateProfile: async (data: { full_name?: string; email?: string }): Promise<User> => {
      return apiRequest<User>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    /**
     * Update the current user's password
     */
    updatePassword: async (data: { current_password: string; new_password: string }): Promise<void> => {
      return apiRequest<void>('/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
  },

  // Add more API endpoints as needed
};