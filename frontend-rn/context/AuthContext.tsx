import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api, getToken, setToken, removeToken, User } from '@/services/api';

// Define query keys for React Query
const QUERY_KEYS = {
  user: 'user',
  authToken: 'authToken',
};

// Define the shape of our auth context
interface AuthContextProps {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isError: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextProps>({
  user: null,
  token: null,
  isLoading: true,
  isError: false,
  signIn: async () => {},
  signOut: async () => {},
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // On mount, check if we have a token stored
  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await getToken();
        console.log('Token from storage:', storedToken ? `Found token: ${storedToken.substring(0, 10)}...` : 'No token');
        
        if (!storedToken) {
          console.log('👋 No token found, user needs to log in');
          setTokenState(null);
        } else {
          console.log('🔑 Token found, setting auth state');
          setTokenState(storedToken);
        }
      } catch (error) {
        console.error('Failed to load auth token:', error);
        // If there's an error, make sure to set token to null
        setTokenState(null);
      }
    };

    loadToken();
  }, []);

  // Use React Query to fetch and cache user data
  const { 
    data: user, 
    isLoading: isUserLoading, 
    isError, 
    refetch 
  } = useQuery({
    queryKey: [QUERY_KEYS.user],
    queryFn: api.auth.getCurrentUser,
    enabled: !!token, // Only run query when token exists
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Combined loading state
  const isLoading = !token ? false : isUserLoading;

  // Sign in function
  const signIn = useCallback(async (newToken: string) => {
    try {
      console.log('🔐 Sign-in started with token:', newToken ? `${newToken.substring(0, 10)}...` : 'null');
      
      if (!newToken) {
        console.error('⚠️ Attempted to sign in with null/empty token');
        throw new Error('Invalid token provided');
      }
      
      // Store token in secure storage first
      console.log('💾 Storing token in secure storage');
      await setToken(newToken);
      
      // Update local state immediately
      console.log('🔄 Updating token in state');
      setTokenState(newToken);
      
      // Invalidate and refetch user data
      console.log('🔄 Invalidating and refetching user data');
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.user] });
      
      // Force a verification that the token is properly set
      const checkToken = await getToken();
      console.log('✅ Token verification:', checkToken ? 'Token is properly stored' : 'Token storage failed');
      
      console.log('✅ Sign-in successful, token saved and state updated');
    } catch (error) {
      console.error('❌ Failed to sign in:', error);
      throw error;
    }
  }, [queryClient]);

  // Sign out function
  const signOut = useCallback(async () => {
    try {
      console.log('Beginning sign out process');
      
      // Remove token from storage first
      console.log('Removing token from storage');
      await removeToken();
      
      // Reset local state
      console.log('Resetting token state');
      setTokenState(null);
      
      // Clear user from cache
      console.log('Clearing queries from cache');
      queryClient.removeQueries({ queryKey: [QUERY_KEYS.user] });
      
      // Optional logout call
      console.log('Calling logout API (optional)');
      try {
        await api.auth.logout();
      } catch (logoutError) {
        console.log('Logout API call failed, but continuing with sign out', logoutError);
      }
      
      console.log('Sign-out successfully completed');
      
      // Force navigation or app reload to trigger layout change
      if (Platform.OS === 'web') {
        // For web, reload the page to ensure auth state is refreshed
        window.location.href = '/';
      }
      // For native platforms, the layout will update automatically
      // because we've set tokenState to null, which will trigger 
      // RootLayoutNav to show the auth screens
    } catch (error) {
      console.error('Failed to sign out:', error);
      // Even if there's an error, try to reset the state
      setTokenState(null);
      throw error;
    }
  }, [queryClient]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (token) {
      await refetch();
    }
  }, [token, refetch]);

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        token,
        isLoading,
        isError,
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