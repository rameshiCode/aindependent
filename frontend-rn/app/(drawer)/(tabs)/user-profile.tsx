// frontend-rn/app/(drawer)/(tabs)/user-profile.tsx
import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useThemeColor } from '@/hooks/useThemeColor';

// Import the generated React Query hooks
import {
  getMyProfileOptions,
  getMyProfileQueryKey,
  updateAbstinenceStatusMutation,
  updateUserGoalMutation
} from '@/src/client/@tanstack/react-query.gen';

// Define types for the profile data
interface UserProfile {
  id: string;
  addiction_type: string | null;
  abstinence_days: number;
  abstinence_start_date: string | null;
  motivation_level: number | null;
  insights: ProfileInsight[];
  goals: ProfileGoal[];
  last_updated: string;
}

interface ProfileInsight {
  id: string;
  type: string;
  value: string;
  significance: number;
}

interface ProfileGoal {
  id: string;
  description: string;
  created_at: string;
  target_date: string | null;
  status: string;
}

export default function UserProfileScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'inputBackground');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'inputBorder');

  // Fetch user profile data using the generated query hook
  const { data: profile, isLoading, error, refetch } = useQuery({
    ...getMyProfileOptions(),
    select: (data) => data as unknown as UserProfile, // Type cast the response
  });

  // Mutation for updating abstinence status using the generated mutation hook
  const resetAbstinence = useMutation({
    ...updateAbstinenceStatusMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getMyProfileQueryKey() });
    }
  });

  // Mutation for updating goal status using the generated mutation hook
  const updateGoalStatus = useMutation({
    ...updateUserGoalMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getMyProfileQueryKey() });
    }
  });

  // Handle refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Handle abstinence reset
  const handleResetAbstinence = () => {
    Alert.alert(
      "Reset Abstinence Counter",
      "Are you sure you want to reset your abstinence counter? This will set your current streak to 0 days.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => resetAbstinence.mutate({
            body: { reset: true }
          })
        }
      ]
    );
  };

  // Handle completing a goal
  const handleCompleteGoal = (goalId: string) => {
    Alert.alert(
      "Complete Goal",
      "Mark this goal as completed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: () => updateGoalStatus.mutate({
            path: { goal_id: goalId },
            body: { status: 'completed' }
          })
        }
      ]
    );
  };

  // Handle abandoning a goal
  const handleAbandonGoal = (goalId: string) => {
    Alert.alert(
      "Abandon Goal",
      "Are you sure you want to abandon this goal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Abandon",
          style: "destructive",
          onPress: () => updateGoalStatus.mutate({
            path: { goal_id: goalId },
            body: { status: 'abandoned' }
          })
        }
      ]
    );
  };

  // Get insight icon based on type
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'trigger':
        return 'alert-circle';
      case 'coping_strategy':
        return 'shield';
      case 'motivation':
        return 'star';
      case 'addiction_type':
        return 'medical';
      case 'schedule':
        return 'time';
      case 'goal':
        return 'flag';
      case 'abstinence':
        return 'calendar';
      case 'emotion':
        return 'heart';
      default:
        return 'information-circle';
    }
  };

  // Format insight type for display
  const formatInsightType = (type: string) => {
    return type.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <Stack.Screen options={{ title: "Your Profile" }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tintColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>
            Loading your profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <Stack.Screen options={{ title: "Your Profile" }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading profile</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: tintColor }]}
            onPress={onRefresh}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['bottom']}>
      <Stack.Screen options={{ title: "Your Profile" }} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tintColor]}
            tintColor={tintColor}
          />
        }
      >
        {/* Abstinence Card */}
        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Abstinence Tracker</Text>

          <View style={styles.abstinenceContainer}>
            <View style={styles.abstinenceDaysContainer}>
              <Text style={[styles.abstinenceDays, { color: tintColor }]}>
                {profile?.abstinence_days || 0}
              </Text>
              <Text style={[styles.abstinenceDaysLabel, { color: textColor }]}>
                DAYS
              </Text>
            </View>

            {profile?.abstinence_start_date && (
              <Text style={[styles.abstinenceDate, { color: textColor }]}>
                Since {formatDate(profile.abstinence_start_date)}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.resetButton, { borderColor: '#ff3b30' }]}
            onPress={handleResetAbstinence}
          >
            <Text style={[styles.resetButtonText, { color: '#ff3b30' }]}>
              Reset Counter
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active Goals Card */}
        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: textColor }]}>Your Goals</Text>
            <TouchableOpacity style={styles.addButton}>
              <Ionicons name="add-circle" size={24} color={tintColor} />
            </TouchableOpacity>
          </View>

          {profile?.goals && profile.goals.length > 0 ? (
            profile.goals
              .filter(goal => goal.status === 'active')
              .map(goal => (
                <View key={goal.id} style={[styles.goalItem, { borderColor }]}>
                  <View style={styles.goalContent}>
                    <Text style={[styles.goalText, { color: textColor }]}>
                      {goal.description}
                    </Text>
                    {goal.target_date && (
                      <Text style={[styles.goalDate, { color: textColor }]}>
                        Target: {formatDate(goal.target_date)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.goalActions}>
                    <TouchableOpacity
                      style={[styles.goalButton, { backgroundColor: tintColor }]}
                      onPress={() => handleCompleteGoal(goal.id)}
                    >
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.goalButton, { backgroundColor: '#ff3b30' }]}
                      onPress={() => handleAbandonGoal(goal.id)}
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
          ) : (
            <Text style={[styles.emptyText, { color: textColor }]}>
              No active goals. Tap + to add a goal.
            </Text>
          )}
        </View>

        {/* Insights Card */}
        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Insights</Text>

          {profile?.insights && profile.insights.length > 0 ? (
            profile.insights.map(insight => (
              <View key={insight.id} style={[styles.insightItem, { borderColor }]}>
                <View style={styles.insightIconContainer}>
                  <Ionicons
                    name={getInsightIcon(insight.type)}
                    size={24}
                    color={tintColor}
                  />
                </View>

                <View style={styles.insightContent}>
                  <Text style={[styles.insightType, { color: tintColor }]}>
                    {formatInsightType(insight.type)}
                  </Text>
                  <Text style={[styles.insightValue, { color: textColor }]}>
                    {insight.value}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: textColor }]}>
              No insights yet. Continue your conversations to build insights.
            </Text>
          )}
        </View>

        {/* Additional Information */}
        {profile && (
          <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}>
            <Text style={[styles.cardTitle, { color: textColor }]}>Profile Details</Text>

            <View style={[styles.detailRow, { borderColor }]}>
              <Text style={[styles.detailLabel, { color: textColor }]}>Addiction Type:</Text>
              <Text style={[styles.detailValue, { color: textColor }]}>
                {profile.addiction_type || 'Not specified'}
              </Text>
            </View>

            <View style={[styles.detailRow, { borderColor }]}>
              <Text style={[styles.detailLabel, { color: textColor }]}>Motivation Level:</Text>
              <Text style={[styles.detailValue, { color: textColor }]}>
                {profile.motivation_level ? `${profile.motivation_level}/10` : 'Not assessed'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: textColor }]}>Last Updated:</Text>
              <Text style={[styles.detailValue, { color: textColor }]}>
                {formatDate(profile.last_updated)}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff3b30',
    marginBottom: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  abstinenceContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  abstinenceDaysContainer: {
    alignItems: 'center',
  },
  abstinenceDays: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  abstinenceDaysLabel: {
    fontSize: 16,
    marginTop: 4,
  },
  abstinenceDate: {
    fontSize: 14,
    marginTop: 8,
  },
  resetButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  resetButtonText: {
    fontWeight: '600',
  },
  addButton: {
    padding: 4,
  },
  goalItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  goalContent: {
    flex: 1,
  },
  goalText: {
    fontSize: 16,
  },
  goalDate: {
    fontSize: 14,
    marginTop: 4,
  },
  goalActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  insightItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  insightIconContainer: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
  },
  insightContent: {
    flex: 1,
  },
  insightType: {
    fontWeight: '600',
    marginBottom: 4,
  },
  insightValue: {
    fontSize: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  detailLabel: {
    fontSize: 16,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 16,
  },
});
