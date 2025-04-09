import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import { useProfile } from '../hooks/useProfile';
import { UserInsight } from '../hooks/useProfile'; // Import the type directly
// Define TypeScript interfaces for the profile data

interface GroupedInsights {
  [key: string]: UserInsight[];
}

interface ProfileVisualizerProps {
  userId: string;
}

/**
 * Enhanced Profile Visualizer that shows connections between different
 * aspects of a user's recovery profile without external dependencies
 */
export const EnhancedProfileVisualizer: React.FC<ProfileVisualizerProps> = ({ userId }) => {
  const { profile, isLoadingProfile, profileError, getInsights } = useProfile();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [groupedInsights, setGroupedInsights] = useState<GroupedInsights>({});

  // Get insights using the hook function
  const {
    data: insightsData,
    isLoading: isLoadingInsights,
    error: insightsError
  } = getInsights();

  const isLoading = isLoadingProfile || isLoadingInsights;
  const error = profileError || insightsError;

  // Use the theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const cardBgColor = useThemeColor({}, 'inputBackground');
  const borderColor = useThemeColor({}, 'inputBorder');

  // Group insights by type when data is loaded
  useEffect(() => {
    if (insightsData && insightsData.length > 0) {
      // Group insights by type
      const grouped: GroupedInsights = {};

      insightsData.forEach((insight: UserInsight) => {
        if (!grouped[insight.type]) {
          grouped[insight.type] = [];
        }
        grouped[insight.type].push(insight);
      });

      setGroupedInsights(grouped);
    }
  }, [insightsData]);

  // Get color based on insight type
  const getTypeColor = (type: string): string => {
    switch(type) {
      case 'trigger': return '#ff6b6b';
      case 'psychological_trait': return '#4ecdc4';
      case 'coping_strategy': return '#ffd166';
      case 'recovery_stage': return '#3b82f6';
      case 'motivation': return '#10b981';
      default: return '#94a3b8';
    }
  };

  // Format insight type for display
  const formatType = (type: string): string => {
    if (!type) return '';
    return type.split('_').map((word: string) =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Format insight value for display
  const formatValue = (value: string, type: string): string => {
    if (!value) return '';

    if (type === 'psychological_trait' && value.includes(':')) {
      const [trait, present] = value.split(':');
      return trait.split('_').map((word: string) =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }

    return value;
  };

  // Find related insights based on selected type
  const getRelatedInsights = (type: string, value: string): UserInsight[] => {
    if (!insightsData) return [];

    const related: UserInsight[] = [];

    // Different relationship logic based on insight type
    if (type === 'trigger') {
      // Find psychological traits that might be related to this trigger
      const traits = groupedInsights['psychological_trait'] || [];
      traits.forEach(trait => {
        if (areRelated(trait.value, value)) {
          related.push(trait);
        }
      });

      // Find coping strategies related to this trigger
      const strategies = groupedInsights['coping_strategy'] || [];
      strategies.forEach(strategy => {
        if (isRelevantStrategy(strategy.value, value)) {
          related.push(strategy);
        }
      });
    }
    else if (type === 'psychological_trait') {
      // Find triggers related to this trait
      const triggers = groupedInsights['trigger'] || [];
      triggers.forEach(trigger => {
        if (areRelated(value, trigger.value)) {
          related.push(trigger);
        }
      });
    }
    else if (type === 'coping_strategy') {
      // Find triggers this strategy might help with
      const triggers = groupedInsights['trigger'] || [];
      triggers.forEach(trigger => {
        if (isRelevantStrategy(value, trigger.value)) {
          related.push(trigger);
        }
      });
    }

    return related;
  };

  // Check if a psychological trait and trigger are related
  const areRelated = (trait: string, trigger: string): boolean => {
    if (!trait || !trigger) return false;

    // Convert to lowercase for comparison
    const traitLower = trait.toLowerCase();
    const triggerLower = trigger.toLowerCase();

    // Define common relationships
    if (traitLower.includes('need_for_approval') &&
        (triggerLower.includes('social') || triggerLower.includes('friend'))) {
      return true;
    }

    if (traitLower.includes('low_self_confidence') &&
        (triggerLower.includes('stress') || triggerLower.includes('anxi'))) {
      return true;
    }

    if (traitLower.includes('fear_of_rejection') &&
        (triggerLower.includes('social') || triggerLower.includes('family'))) {
      return true;
    }

    if (traitLower.includes('submissiveness') &&
        triggerLower.includes('pressure')) {
      return true;
    }

    return false;
  };

  // Check if a coping strategy is relevant for a trigger
  const isRelevantStrategy = (strategy: string, trigger: string): boolean => {
    if (!strategy || !trigger) return false;

    // Convert to lowercase for comparison
    const strategyLower = strategy.toLowerCase();
    const triggerLower = trigger.toLowerCase();

    // Define strategy-trigger relationships
    if ((strategyLower.includes('exercise') && triggerLower.includes('stress')) ||
        (strategyLower.includes('meditation') && triggerLower.includes('anxi')) ||
        (strategyLower.includes('call') && triggerLower.includes('lone')) ||
        (strategyLower.includes('support') && triggerLower.includes('urge'))) {
      return true;
    }

    return false;
  };

  // Handle selection of insight type
  const handleSelectType = (type: string): void => {
    setSelectedType(type === selectedType ? null : type);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ThemedText style={styles.loadingText}>Loading profile data...</ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ThemedText style={styles.errorText}>Error loading profile: {error.message}</ThemedText>
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
          <ThemedText style={styles.cardTitle}>Recovery Profile</ThemedText>
          <ThemedText style={styles.cardSubtitle}>Tap sections to explore relationships</ThemedText>
        </View>

        {/* Profile Summary */}
        <View style={[styles.summaryContainer, { borderColor }]}>
          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>Addiction Type:</ThemedText>
            <ThemedText style={styles.summaryValue}>
              {profile.addiction_type || 'Not identified yet'}
            </ThemedText>
          </View>

          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>Recovery Stage:</ThemedText>
            <ThemedText style={styles.summaryValue}>
              {profile.recovery_stage
                ? profile.recovery_stage.charAt(0).toUpperCase() + profile.recovery_stage.slice(1)
                : 'Not determined yet'}
            </ThemedText>
          </View>

          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>Motivation Level:</ThemedText>
            <View style={styles.motivationContainer}>
              {profile.motivation_level ? (
                <>
                  <View style={styles.motivationBarContainer}>
                    <View
                      style={[
                        styles.motivationBarFill,
                        {
                          width: `${profile.motivation_level * 10}%`,
                          backgroundColor: tintColor
                        }
                      ]}
                    />
                  </View>
                  <ThemedText style={styles.motivationText}>
                    {profile.motivation_level}/10
                  </ThemedText>
                </>
              ) : (
                <ThemedText>Not measured yet</ThemedText>
              )}
            </View>
          </View>
        </View>

        {/* Insight Categories */}
        <View style={styles.categoriesContainer}>
          <ThemedText style={styles.sectionTitle}>Profile Elements</ThemedText>

          <View style={styles.categoryButtons}>
            {Object.keys(groupedInsights).map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.categoryButton,
                  { backgroundColor: getTypeColor(type) },
                  selectedType === type && styles.selectedCategory
                ]}
                onPress={() => handleSelectType(type)}
              >
                <ThemedText style={styles.categoryText}>
                  {formatType(type)} ({groupedInsights[type].length})
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Selected Category Insights */}
        {selectedType && groupedInsights[selectedType] && (
          <View style={[styles.insightsContainer, { borderTopColor: borderColor }]}>
            <ThemedText style={styles.sectionTitle}>
              {formatType(selectedType)}
            </ThemedText>

            {groupedInsights[selectedType].map((insight, index) => {
              // Find related insights
              const relatedInsights = getRelatedInsights(insight.type, insight.value);

              return (
                <View
                  key={`${insight.type}_${index}`}
                  style={[styles.insightCard, { backgroundColor: getTypeColor(insight.type) + '33' }]}
                >
                  <View style={styles.insightHeader}>
                    <View style={[styles.insightDot, { backgroundColor: getTypeColor(insight.type) }]} />
                    <ThemedText style={styles.insightValue}>
                      {formatValue(insight.value, insight.type)}
                    </ThemedText>
                  </View>

                  {insight.significance && (
                    <View style={styles.insightMetadata}>
                      <ThemedText style={styles.metadataLabel}>Significance:</ThemedText>
                      <View style={styles.significanceContainer}>
                        <View
                          style={[
                            styles.significanceFill,
                            {
                              width: `${insight.significance * 100}%`,
                              backgroundColor: getTypeColor(insight.type)
                            }
                          ]}
                        />
                      </View>
                    </View>
                  )}

                  {insight.day_of_week && (
                    <View style={styles.insightMetadata}>
                      <ThemedText style={styles.metadataLabel}>Day:</ThemedText>
                      <ThemedText style={styles.metadataValue}>
                        {insight.day_of_week.charAt(0).toUpperCase() + insight.day_of_week.slice(1)}
                      </ThemedText>
                    </View>
                  )}

                  {insight.time_of_day && (
                    <View style={styles.insightMetadata}>
                      <ThemedText style={styles.metadataLabel}>Time:</ThemedText>
                      <ThemedText style={styles.metadataValue}>
                        {insight.time_of_day.charAt(0).toUpperCase() + insight.time_of_day.slice(1)}
                      </ThemedText>
                    </View>
                  )}

                  {relatedInsights.length > 0 && (
                    <View style={styles.relatedContainer}>
                      <ThemedText style={styles.relatedTitle}>Related to:</ThemedText>
                      <View style={styles.relatedItems}>
                        {relatedInsights.map((related, idx) => (
                          <TouchableOpacity
                            key={`related_${idx}`}
                            style={[
                              styles.relatedItem,
                              { backgroundColor: getTypeColor(related.type) }
                            ]}
                            onPress={() => handleSelectType(related.type)}
                          >
                            <ThemedText style={styles.relatedItemText}>
                              {formatValue(related.value, related.type)}
                            </ThemedText>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Legend */}
        <View style={[styles.legendContainer, { borderTopColor: borderColor }]}>
          <ThemedText style={styles.legendTitle}>Legend</ThemedText>
          <View style={styles.legendContent}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#ff6b6b' }]} />
              <ThemedText style={styles.legendText}>Triggers</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#4ecdc4' }]} />
              <ThemedText style={styles.legendText}>Psychological Traits</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#ffd166' }]} />
              <ThemedText style={styles.legendText}>Coping Strategies</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#3b82f6' }]} />
              <ThemedText style={styles.legendText}>Recovery Stage</ThemedText>
            </View>
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
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#ff6b6b',
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  summaryContainer: {
    padding: 16,
    borderBottomWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  summaryLabel: {
    width: 120,
    fontWeight: '600',
  },
  summaryValue: {
    flex: 1,
  },
  motivationContainer: {
    flex: 1,
  },
  motivationBarContainer: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginVertical: 6,
    overflow: 'hidden',
  },
  motivationBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  motivationText: {
    fontSize: 12,
  },
  categoriesContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedCategory: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  categoryText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
  insightsContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  insightCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  insightValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  insightMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metadataLabel: {
    fontSize: 12,
    width: 80,
    opacity: 0.7,
  },
  metadataValue: {
    fontSize: 12,
  },
  significanceContainer: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    width: 100,
    marginVertical: 2,
    overflow: 'hidden',
  },
  significanceFill: {
    height: '100%',
    borderRadius: 3,
  },
  relatedContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  relatedTitle: {
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '500',
  },
  relatedItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  relatedItem: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
  },
  relatedItemText: {
    color: '#fff',
    fontSize: 12,
  },
  legendContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  legendContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
  },
});

export default EnhancedProfileVisualizer;
