// app/index.tsx
import { Redirect } from 'expo-router';
import { useAuthContext } from '../lib/auth/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import React from 'react';

export default function Root() {
  const { user, loading } = useAuthContext();

  // Show loading indicator while checking authentication
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Redirect based on auth state
  return user ? <Redirect href="/(tabs)" /> : <Redirect href="/login" />;
}