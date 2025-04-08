import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import { useProfile } from '../hooks/useProfile';

export const ProfileVisualizer = ({ userId }: { userId: string }) => {
  const { profile, isLoadingProfile, profileError, getInsights, getGoals, refetchProfile } = useProfile();
  
  // Get insights using the hook function
  const { 
    data: insightsData,
    isLoading: isLoadingInsights,
    error: insightsError
  } = getInsights();
  
  const isLoading = isLoadingProfile || isLoadingInsights;
  const error = profileError || insightsError;
  
  // Create a helper function to group insights by type
  const [insightsByType, setInsightsByType] = useState<Record<string, any[]>>({});
  
  useEffect(() => {
    if (insightsData) {
      const grouped = insightsData.reduce((acc: Record<string, any[]>, insight: any) => {
        if (!acc[insight.insight_type]) {
          acc[insight.insight_type] = [];
        }
        acc[insight.insight_type].push(insight);
        return acc;
      }, {});
      setInsightsByType(grouped);
    }
  }, [insightsData]);
  
  // Use the theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const cardBgColor = useThemeColor({}, 'inputBackground');
  const borderColor = useThemeColor({}, 'inputBorder');

  useEffect(() => {
    console.log("Profile data:", profile);
    console.log("Insights data:", insightsData);
  }, [profile, insightsData]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
        <ThemedText>Loading profile data...</ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ThemedText>Error loading profile: {error.message}</ThemedText>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ThemedText>No profile data available yet.</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor }]}>
      <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
        {/* Card Title */}
        <View style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>User Profile</ThemedText>
          <ThemedText style={styles.cardSubtitle}>Based on Motivational Interviewing</ThemedText>
        </View>

        {/* Card Content */}
        <View style={styles.cardContent}>
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Addiction Type</ThemedText>
            <ThemedText>{profile.addiction_type || 'Not identified yet'}</ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Motivation Level</ThemedText>
            {profile.motivation_level ? (
              <>
                {/* Custom Progress Bar */}
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${profile.motivation_level * 10}%`,
                        backgroundColor: tintColor
                      }
                    ]}
                  />
                </View>
                <ThemedText>{profile.motivation_level}/10</ThemedText>
              </>
            ) : (
              <ThemedText>Not measured yet</ThemedText>
            )}
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Psychological Traits</ThemedText>
            <View style={styles.chipContainer}>
              {insightsByType?.psychological_trait ? (
                insightsByType.psychological_trait.map((insight, index) => {
                  const [trait, value] = insight.value.split(':');
                  if (value === 'true') {
                    return (
                      <View key={index} style={[styles.chip, { borderColor: tintColor }]}>
                        <ThemedText style={styles.chipText}>
                          {trait.replace(/_/g, ' ')}
                        </ThemedText>
                      </View>
                    );
                  }
                  return null;
                })
              ) : (
                <ThemedText>No traits identified yet</ThemedText>
              )}
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: `${textColor}30` }]} />

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Triggers</ThemedText>
            {insightsByType?.trigger ? (
              <View style={styles.listSection}>
                {insightsByType.trigger.map((insight, index) => (
                  <View key={index} style={styles.listItem}>
                    <View style={[styles.listIcon, { backgroundColor: `${tintColor}30` }]}>
                      <ThemedText style={{ color: tintColor }}>!</ThemedText>
                    </View>
                    <View style={styles.listContent}>
                      <ThemedText style={styles.listTitle}>{insight.value}</ThemedText>
                      <ThemedText style={styles.listDescription}>
                        {`${insight.day_of_week || ''} ${insight.time_of_day || ''}`}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <ThemedText>No triggers identified yet</ThemedText>
            )}
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Recovery Stage</ThemedText>
            {insightsByType?.recovery_stage ? (
              <ThemedText>
                {insightsByType.recovery_stage[0].value.charAt(0).toUpperCase() +
                  insightsByType.recovery_stage[0].value.slice(1)}
              </ThemedText>
            ) : (
              <ThemedText>Not determined yet</ThemedText>
            )}
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Abstinence</ThemedText>
            {profile.abstinence_days !== undefined ? (
              <ThemedText>{profile.abstinence_days} days</ThemedText>
            ) : (
              <ThemedText>Not tracked yet</ThemedText>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  cardSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  cardContent: {
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginVertical: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    margin: 4,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  listSection: {
    marginTop: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  listIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  listContent: {
    flex: 1,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  listDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
});