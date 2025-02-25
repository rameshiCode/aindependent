// lib/auth/protected-route.tsx
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router, useRootNavigationState } from 'expo-router';
import { useAuthContext, isLoggedIn } from './AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Component that protects routes
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuthContext();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    const checkAuth = async () => {
      // Make sure navigation is ready
      if (!navigationState?.key) return;
      
      // Skip if we're already loading auth state
      if (loading) return;
      
      // If no user and not loading, redirect to login
      if (!user) {
        const loggedIn = await isLoggedIn();
        if (!loggedIn) {
          router.replace('/login');
        }
      }
    };

    checkAuth();
  }, [user, loading, navigationState?.key]);

  if (loading || !navigationState?.key) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // If we have a user, render the children
  return user ? <>{children}</> : null;
};

// Hook to use in layouts or components that need auth protection
export const useProtectedRoute = () => {
  const { user, loading } = useAuthContext();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    const checkAuth = async () => {
      // Make sure navigation is ready
      if (!navigationState?.key) return;
      
      // Skip if we're already loading auth state
      if (loading) return;
      
      // If no user and not loading, redirect to login
      if (!user) {
        const loggedIn = await isLoggedIn();
        if (!loggedIn) {
          router.replace('/login');
        }
      }
    };

    checkAuth();
  }, [user, loading, navigationState?.key]);

  return {
    isAuthenticated: !!user,
    isLoading: loading || !navigationState?.key
  };
};