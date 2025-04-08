// frontend-rn/components/ProfileInsightsMobile.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ProfilesService } from '@/src/client';
import { useThemeColor } from '@/hooks/useThemeColor';

// Helper for formatting strings
const formatAttribute = (attribute) => {
  if (typeof attribute === 'string') {
    return attribute
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  return 'Unknown';
};

export default function ProfileInsightsMobile() {
  const [refreshing, setRefreshing] = useState(false);

  // Get theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const cardBackground = useThemeColor({}, 'inputBackground');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'inputBorder');

  // Fetch profile data
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
    refetch: refetchProfile
  } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await ProfilesService.getMyProfile();
      return response.data;
    },
    staleTime: 60000 // 1 minute
  });

  // Fetch insights data
  const {
    data: insights,
    isLoading: insightsLoading,
    error: insightsError,
    refetch: refetchInsights
  } = useQuery({
    queryKey: ['insights'],
    queryFn: async () => {
      const response = await ProfilesService.getUserInsights();
      return response.data;
    },
    staleTime: 60000 // 1 minute
  });

  // Helper to filter insights by type
  const getInsightsByType = (type) => {
    if (!insights) return [];
    return insights.filter(insight => insight.type === type);
  };

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchProfile(), refetchInsights()]);
    setRefreshing(false);
  };

  // Determine if we're in loading state
  const isLoading = profileLoading || insightsLoading;
  const error = profileError || insightsError;

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[tintColor]}
          tintColor={tintColor}
        />
      }
    >
      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tintColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>
            Loading profile insights...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Error loading profile data'}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: tintColor }]}
            onPress={onRefresh}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Profile Summary Card */}
          {profile && (
            <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>Profile Overview</Text>

              <View style={[styles.infoRow, { borderColor }]}>
                <Text style={[styles.infoLabel, { color: textColor }]}>Addiction Type:</Text>
                <Text style={[styles.infoValue, { color: textColor }]}>
                  {profile.addiction_type || 'Not specified'}
                </Text>
              </View>

              <View style={[styles.infoRow, { borderColor }]}>
                <Text style={[styles.infoLabel, { color: textColor }]}>Abstinence Days:</Text>
                <Text style={[styles.infoValue, { color: tintColor, fontWeight: 'bold' }]}>
                  {profile.abstinence_days || '0'}
                </Text>
              </View>

              {profile.abstinence_start_date && (
                <View style={[styles.infoRow, { borderColor }]}>
                  <Text style={[styles.infoLabel, { color: textColor }]}>Since:</Text>
                  <Text style={[styles.infoValue, { color: textColor }]}>
                    {formatDate(profile.abstinence_start_date)}
                  </Text>
                </View>
              )}

              <View style={[styles.infoRow, { borderColor }]}>
                <Text style={[styles.infoLabel, { color: textColor }]}>Motivation Level:</Text>
                <Text style={[styles.infoValue, { color: textColor }]}>
                  {profile.motivation_level ? `${profile.motivation_level}/10` : 'Not assessed'}
                </Text>
              </View>

              <View style={[styles.infoRow, { borderColor: 'transparent' }]}>
                <Text style={[styles.infoLabel, { color: textColor }]}>Recovery Stage:</Text>
                <Text style={[styles.infoValue, { color: textColor }]}>
                  {profile.recovery_stage
                    ? formatAttribute(profile.recovery_stage)
                    : 'Not determined'}
                </Text>
              </View>
            </View>
          )}

          {/* Psychological Traits Card */}
          <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}>
            <Text style={[styles.cardTitle, { color: textColor }]}>Psychological Traits</Text>

            {getInsightsByType('psychological_trait').length > 0 ? (
              <View style={styles.traitsContainer}>
                {getInsightsByType('psychological_trait').map((trait, index) => {
                  const [traitName, value] = trait.value.split(':');
                  if (value === 'true') {
                    return (
                      <View
                        key={index}
                        style={[styles.traitChip, { backgroundColor: `${tintColor}20`, borderColor: tintColor }]}
                      >
                        <Text style={[styles.traitText, { color: tintColor }]}>
                          {formatAttribute(traitName)}
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: textColor }]}>
                No psychological traits identified yet. Continue your conversations for more insights.
              </Text>
            )}
          </View>

          {/* Triggers Card */}
          <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}>
            <Text style={[styles.cardTitle, { color: textColor }]}>Identified Triggers</Text>

            {getInsightsByType('trigger
