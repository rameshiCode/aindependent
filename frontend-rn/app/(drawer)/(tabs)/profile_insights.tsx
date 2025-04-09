// In frontend-rn/app/(drawer)/(tabs)/profile_insights.tsx

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { ThemedText } from '../../../components/ThemedText';
import { useAuth } from '../../../context/authProvider';
import EnhancedProfileVisualizer from '../../../components/ProfileVisualizer';
import RecoveryStageTracker from '../../../components/RecoveryStageTracker';

export default function ProfileScreen() {
  const { currentUser } = useAuth();
  const userId = currentUser?.id;

  if (!userId) {
    return (
      <View style={styles.container}>
        <ThemedText>User not authenticated. Please log in.</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Main profile summary card */}
      <View style={styles.sectionContainer}>
        <ThemedText style={styles.sectionTitle}>Recovery Progress</ThemedText>
        <RecoveryStageTracker userId={userId} />
      </View>

      {/* Profile visualization */}
      <View style={styles.sectionContainer}>
        <ThemedText style={styles.sectionTitle}>Profile Insights</ThemedText>
        <EnhancedProfileVisualizer userId={userId} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    padding: 16,
  },
});
