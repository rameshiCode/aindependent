import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Constants
const TOKEN_KEY = 'auth_token';
const API_URL = 'http://127.0.0.1:8000/api/v1';

// Token clearing code removed - we want to persist the token between app restarts
// console.log("🧹 STARTUP: Clearing any existing auth tokens");
// clearAuthToken();

// Custom storage implementation that works across platforms
const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      // Web platform
      if (Platform.OS === 'web') {
        const item = localStorage.getItem(key);
        console.log(`🔍 Storage - getItem(${key}):`, item ? 'Found value' : 'No value found');
        return item;
      }
      // Native platforms
      const item = await SecureStore.getItemAsync(key);
      console.log(`🔍 Storage - getItem(${key}):`, item ? 'Found value' : 'No value found');
      return item;
    } catch (e) {
      console.error(`❌ Storage getItem(${key}) error:`, e);
      return null;
    }
  },
  
  async setItem(key: string, value: string): Promise<void> {
    try {
      // Web platform
      if (Platform.OS === 'web') {
        console.log(`💾 Storage - setItem(${key}):`, value ? `Value length: ${value.length}` : 'Empty value');
        localStorage.setItem(key, value);
        // Verify it was set correctly
        const stored = localStorage.getItem(key);
        console.log(`✅ Storage - setItem(${key}) verification:`, stored === value ? 'Success' : 'Failed');
        return;
      }
      // Native platforms
      console.log(`💾 Storage - setItem(${key}):`, value ? `Value length: ${value.length}` : 'Empty value');
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.error(`❌ Storage setItem(${key}) error:`, e);
    }
  },
  
  async removeItem(key: string): Promise<void> {
    try {
      // Web platform
      if (Platform.OS === 'web') {
        console.log(`🧹 Storage - removeItem(${key})`);
        localStorage.removeItem(key);
        return;
      }
      // Native platforms
      console.log(`🧹 Storage - removeItem(${key})`);
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.error(`❌ Storage removeItem(${key}) error:`, e);
    }
  }
};

// Constants
// const TOKEN_KEY = 'auth_token';
// const API_URL = 'http://127.0.0.1:8000/api/v1';

// Base URL handling for different environments
const getBaseUrl = () => {
  if (Platform.OS === 'web') {
    // For web, use the local URL
    // Using localhost instead of 127.0.0.1 to avoid CORS issues
    return 'http://localhost:8000/api/v1';
  } else if (Platform.OS === 'android' && __DEV__) {
    // For Android emulator or physical device
    // Use your computer's actual local IP address on your network 
    // This must match what your Android device can reach
    return 'http://192.168.1.6:8000/api/v1';
    
    // For standard Android emulator only
    // return 'http://10.0.2.2:8000/api/v1';
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
  return storage.getItem(TOKEN_KEY);
};

/**
 * Helper function to set the auth token in secure storage
 */
export const setToken = async (token: string): Promise<void> => {
  return storage.setItem(TOKEN_KEY, token);
};

/**
 * Helper function to remove the auth token from secure storage
 */
export const removeToken = async (): Promise<void> => {
  return storage.removeItem(TOKEN_KEY);
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
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
    // Enable CORS mode explicitly on web
    ...(Platform.OS === 'web' ? { mode: 'cors' } : {})
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
  // Make getBaseUrl accessible to components
  getBaseUrl,
  
  auth: {
    /**
     * Get the URL for initiating Google login
     */
    getGoogleLoginUrl: () => {
      const baseUrl = getBaseUrl();
      
      // Use the appropriate endpoint based on platform
      if (Platform.OS === 'web') {
        // For web, use the standard Google login endpoint that supports redirect flow
        return `${baseUrl}/login/google`;
      } else {
        // For mobile, use the mobile-specific endpoint
        return `${baseUrl}/login/google/mobile`;
      }
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