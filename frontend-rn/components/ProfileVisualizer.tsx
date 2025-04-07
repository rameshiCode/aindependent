import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, ProgressBar, Chip, List, Divider } from 'react-native-paper';
import ThemedText from './ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import { useProfile } from '../hooks/useProfile';

export const ProfileVisualizer = ({ userId }: { userId: string }) => {
  const { profile, insights, isLoading, error } = useProfile(userId);
  const backgroundColor = useThemeColor({}, 'background');
  const primaryColor = useThemeColor({}, 'primary');
  const textColor = useThemeColor({}, 'text');

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
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

  // Group insights by type
  const insightsByType = insights?.reduce((acc, insight) => {
    if (!acc[insight.insight_type]) {
      acc[insight.insight_type] = [];
    }
    acc[insight.insight_type].push(insight);
    return acc;
  }, {});

  return (
    <ScrollView style={[styles.container, { backgroundColor }]}>
      <Card style={styles.card}>
        <Card.Title title="User Profile" subtitle="Based on Motivational Interviewing" />
        <Card.Content>
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Addiction Type</ThemedText>
            <ThemedText>{profile.addiction_type || 'Not identified yet'}</ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Motivation Level</ThemedText>
            {profile.motivation_level ? (
              <>
                <ProgressBar
                  progress={profile.motivation_level / 10}
                  color={primaryColor}
                  style={styles.progressBar}
                />
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
                      <Chip key={index} style={styles.chip} mode="outlined">
                        {trait.replace(/_/g, ' ')}
                      </Chip>
                    );
                  }
                  return null;
                })
              ) : (
                <ThemedText>No traits identified yet</ThemedText>
              )}
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Triggers</ThemedText>
            {insightsByType?.trigger ? (
              <List.Section>
                {insightsByType.trigger.map((insight, index) => (
                  <List.Item
                    key={index}
                    title={insight.value}
                    description={`${insight.day_of_week || ''} ${insight.time_of_day || ''}`}
                    left={props => <List.Icon {...props} icon="alert-circle" />}
                  />
                ))}
              </List.Section>
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
        </Card.Content>
      </Card>
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
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    marginVertical: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    margin: 4,
  },
  divider: {
    marginVertical: 16,
  },
});
