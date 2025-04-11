// Place this file at: frontend-rn/app/(drawer)/(tabs)/profile-analysis.tsx

import React from 'react';
import { Text } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '../../../context/authProvider';
import ProfileAnalysisScreen from '../../../components/ProfileAnalysisScreen';

export default function ProfileAnalysisPage() {
  const { isLoggedIn, currentUser } = useAuth();

  if (!isLoggedIn) {
    return <Text style={{ padding: 20, textAlign: 'center' }}>Please log in to view this page</Text>;
  }

  return <ProfileAnalysisScreen />;
}