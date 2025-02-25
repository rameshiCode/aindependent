// lib/auth/useAuth.ts
import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { AuthService, UserService, OpenAPI } from '../api';

// Storage key
const TOKEN_KEY = 'auth_token';

// Storage API with web fallback
const Storage = {
  async getItem(key: string): Promise<string | null> {
    if (typeof window !== 'undefined' && !window.localStorage) {
      // We're on native platform
      try {
        return await SecureStore.getItemAsync(key);
      } catch (error) {
        console.error('SecureStore error:', error);
        return null;
      }
    } else {
      // We're on web
      return localStorage.getItem(key);
    }
  },
  
  async setItem(key: string, value: string): Promise<void> {
    if (typeof window !== 'undefined' && !window.localStorage) {
      // We're on native platform
      try {
        await SecureStore.setItemAsync(key, value);
      } catch (error) {
        console.error('SecureStore error:', error);
      }
    } else {
      // We're on web
      localStorage.setItem(key, value);
    }
  },
  
  async removeItem(key: string): Promise<void> {
    if (typeof window !== 'undefined' && !window.localStorage) {
      // We're on native platform
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (error) {
        console.error('SecureStore error:', error);
      }
    } else {
      // We're on web
      localStorage.removeItem(key);
    }
  }
};

// Check if the user is logged in
export const isLoggedIn = async (): Promise<boolean> => {
  const token = await Storage.getItem(TOKEN_KEY);
  return token !== null;
};

// Hook for auth operations
export const useAuth = () => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Configure API and check for user session
  const initAuth = async () => {
    try {
      const token = await Storage.getItem(TOKEN_KEY);
      if (token) {
        OpenAPI.setAccessToken(token);
        try {
          const userData = await UserService.getCurrentUser();
          setUser(userData);
        } catch (err) {
          // If token is invalid, clear it
          await Storage.removeItem(TOKEN_KEY);
          OpenAPI.setAccessToken('');
        }
      }
    } catch (err) {
      console.error('Auth initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initialize auth on mount
  useEffect(() => {
    initAuth();
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await AuthService.login({ username: email, password });
      await Storage.setItem(TOKEN_KEY, result.access_token);
      OpenAPI.setAccessToken(result.access_token);
      const userData = await UserService.getCurrentUser();
      setUser(userData);
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (email: string, password: string, fullName?: string) => {
    setLoading(true);
    setError(null);
    try {
      await AuthService.register({ email, password, full_name: fullName });
      // Automatically login after successful registration
      await login(email, password);
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to register');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    setLoading(true);
    try {
      await Storage.removeItem(TOKEN_KEY);
      OpenAPI.setAccessToken('');
      setUser(null);
      router.replace('/login');
    } catch (err: any) {
      console.error('Logout error:', err);
      setError(err.message || 'Failed to logout');
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    error,
    login,
    register,
    logout,
    resetError: () => setError(null),
  };
};