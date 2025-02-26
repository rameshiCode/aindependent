import React, { createContext, useState, useContext, useEffect } from 'react';
import { router } from 'expo-router';

import { api, getToken, setToken, removeToken, User } from '@/services/api';

// Constants and base URL are now in the API service

// Define the shape of our auth context
interface AuthContextProps {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextProps>({
  user: null,
  token: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check if we have a token stored
  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await getToken();
        if (storedToken) {
          setToken(storedToken);
          await fetchUserData();
        }
      } catch (error) {
        console.error('Failed to load auth token:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadToken();
  }, []);

  // Fetch user data from the API
  const fetchUserData = async () => {
    try {
      const userData = await api.auth.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      await signOut();
    }
  };

  // Sign in function
  const signIn = async (newToken: string) => {
    try {
      await setToken(newToken);
      setToken(newToken);
      await fetchUserData();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Failed to sign in:', error);
      throw error;
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      await api.auth.logout();
      setToken(null);
      setUser(null);
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Failed to sign out:', error);
      throw error;
    }
  };

  // Refresh user data
  const refreshUser = async () => {
    await fetchUserData();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        signIn,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);