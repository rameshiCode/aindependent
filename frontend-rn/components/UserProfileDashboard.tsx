// frontend-rn/components/UserProfileDashboard.tsx

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import { useProfile, UserInsight } from '../hooks/useProfile';
import RecoveryStageTracker from './RecoveryStageTracker';
import ProfileInsightsVisualization from './ProfileInsightsVisualization';
import RecoverySuggestions from './RecoverySuggestions';

interface UserProfileDashboardProps {
  userId: string;
}

/**
 * A comprehensive dashboard displaying all profile insights about the user
 * based on conversation analysis and motivational interviewing
 */
const UserProfileDashboard: React.FC<UserProfileDashboardProps> = ({ userId }) => {
  const { 
    profile, 
    isLoadingProfile, 
    profileError, 
    getInsights,
    createGoal,
    processAllConversations
  } = useProfile();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Get insights using the hook function
  const {
    data: insightsData,
    isLoading: isLoadingInsights,
    error: insightsError
  } = getInsights();

  const isLoading = isLoadingProfile || isLoadingInsights;
  const error = profileError || insightsError;

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const cardBgColor = useThemeColor({}, 'inputBackground');
  const borderColor = useThemeColor({}, 'inputBorder');

  // Group insights by type
  const groupedInsights = React.useMemo(() => {
    if (!insightsData) return {};
    
    const grouped: { [key: string]: any[] } = {};
    insightsData.forEach(insight => {
      if (!grouped[insight.type]) {
        grouped[insight.type] = [];
      }
      grouped[insight.type].push(insight);
    });
    
    return grouped;
  }, [insightsData]);

  // Get color for insight type
  const getTypeColor = (type: string): string => {
    switch(type) {
      case 'trigger': return '#ff6b6b';
      case 'psychological_trait': return '#4ecdc4';
      case 'coping_strategy': return '#ffd166';
      case 'recovery_stage': return '#3b82f6';
      case 'motivation': return '#10b981';
      case 'goal_acceptance': return '#8b5cf6';
      default: return '#94a3b8';
    }
  };

  // Format insight type for display
  const formatType = (type: string): string => {
    if (!type) return '';
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Format insight value for display
  const formatValue = (value: string): string => {
    if (!value) return '';
    
    // Handle psychological traits format (trait:true)
    if (value.includes(':')) {
      const [trait, present] = value.split(':');
      return trait.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }
    
    return value;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
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
        <ThemedText>No profile data available yet. Start chatting to build your profile.</ThemedText>
      </View>
    );
  }

  const handleProcessConversations = async () => {
    Alert.alert(
      'Process Conversations',
      'This will analyze all your past conversations to update your profile. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Process',
          onPress: async () => {
            try {
              await processAllConversations();
              Alert.alert('Success', 'All conversations processed successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to process conversations. Please try again.');
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor }]}>
      {/* Admin Tools */}
      <View style={[styles.toolsCard, { backgroundColor: cardBgColor, borderColor }]}>
        <ThemedText style={styles.toolsTitle}>Profile Tools</ThemedText>
        <View style={styles.toolsButtonContainer}>
          <TouchableOpacity
            style={[styles.toolsButton, { backgroundColor: tintColor }]}
            onPress={handleProcessConversations}
          >
            <ThemedText style={styles.toolsButtonText}>Process All Conversations</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Recovery Stage Tracker */}
      <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
        <View style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>Recovery Journey</ThemedText>
        </View>
        <RecoveryStageTracker userId={userId} />
      </View>

      {/* Abstinence Tracker */}
      <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
        <View style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>Abstinence Progress</ThemedText>
        </View>
        <View style={styles.abstinenceContainer}>
          <View style={styles.abstinenceDaysContainer}>
            <ThemedText style={styles.abstinenceDaysValue}>{profile.abstinence_days || 0}</ThemedText>
            <ThemedText style={styles.abstinenceDaysLabel}>Days</ThemedText>
          </View>
          <View style={styles.abstinenceDetails}>
            {profile.abstinence_start_date && (
              <ThemedText style={styles.abstinenceStartDate}>
                Since: {new Date(profile.abstinence_start_date).toLocaleDateString()}
              </ThemedText>
            )}
            <View style={styles.motivationContainer}>
              <ThemedText style={styles.motivationLabel}>Motivation Level:</ThemedText>
              <View style={styles.motivationBarContainer}>
                <View 
                  style={[
                    styles.motivationBarFill, 
                    { 
                      width: `${(profile.motivation_level || 0) * 10}%`,
                      backgroundColor: tintColor
                    }
                  ]} 
                />
              </View>
              <ThemedText style={styles.motivationValue}>{profile.motivation_level || 0}/10</ThemedText>
            </View>
          </View>
        </View>
      </View>

      {/* Profile Insights Visualization */}
      <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
        <View style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>Profile Network</ThemedText>
          <ThemedText style={styles.cardSubtitle}>How your insights connect</ThemedText>
        </View>
        
        <ProfileInsightsVisualization 
          insights={insightsData || []} 
          onSelectInsight={(insight: UserInsight) => {
            setSelectedCategory(insight.type);
          }}
        />
      </View>
      
      {/* Profile Insights List */}
      <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
        <View style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>Your Profile Insights</ThemedText>
          <ThemedText style={styles.cardSubtitle}>Built from our conversations</ThemedText>
        </View>

        {/* Categories */}
        <View style={styles.categoriesContainer}>
          {Object.keys(groupedInsights).map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.categoryButton,
                { 
                  backgroundColor: getTypeColor(type),
                  borderWidth: selectedCategory === type ? 2 : 0,
                  borderColor: 'white'
                }
              ]}
              onPress={() => setSelectedCategory(selectedCategory === type ? null : type)}
            >
              <ThemedText style={styles.categoryText}>
                {formatType(type)} ({groupedInsights[type].length})
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Selected category insights */}
        {selectedCategory && groupedInsights[selectedCategory] && (
          <View style={styles.insightsContainer}>
            <ThemedText style={styles.sectionTitle}>{formatType(selectedCategory)}</ThemedText>
            
            {groupedInsights[selectedCategory].map((insight, index) => (
              <View 
                key={`${insight.type}_${index}`}
                style={[
                  styles.insightCard, 
                  { backgroundColor: getTypeColor(insight.type) + '22' }
                ]}
              >
                <View style={styles.insightHeader}>
                  <View style={[styles.insightDot, { backgroundColor: getTypeColor(insight.type) }]} />
                  <ThemedText style={styles.insightValue}>
                    {formatValue(insight.value)}
                  </ThemedText>
                </View>
                
                {/* Metadata */}
                {insight.confidence && (
                  <View style={styles.insightMetadata}>
                    <ThemedText style={styles.metadataLabel}>Confidence:</ThemedText>
                    <View style={styles.confidenceContainer}>
                      <View
                        style={[
                          styles.confidenceFill,
                          {
                            width: `${insight.confidence * 100}%`,
                            backgroundColor: getTypeColor(insight.type)
                          }
                        ]}
                      />
                    </View>
                    <ThemedText style={styles.confidenceValue}>{Math.round(insight.confidence * 100)}%</ThemedText>
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
                
                {insight.extracted_at && (
                  <View style={styles.extractedAtContainer}>
                    <ThemedText style={styles.extractedAtText}>
                      Identified: {new Date(insight.extracted_at).toLocaleDateString()}
                    </ThemedText>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* If no category is selected, show summary */}
        {!selectedCategory && (
          <View style={styles.summaryContainer}>
            <ThemedText style={styles.summaryText}>
              Select a category above to see detailed insights. Your profile is built automatically based on our conversations.
            </ThemedText>
            
            <View style={styles.summaryStats}>
              <View style={styles.summaryStatItem}>
                <ThemedText style={styles.summaryStatValue}>
                  {Object.keys(groupedInsights).length}
                </ThemedText>
                <ThemedText style={styles.summaryStatLabel}>Categories</ThemedText>
              </View>
              
              <View style={styles.summaryStatItem}>
                <ThemedText style={styles.summaryStatValue}>
                  {insightsData?.length || 0}
                </ThemedText>
                <ThemedText style={styles.summaryStatLabel}>Total Insights</ThemedText>
              </View>
              
              <View style={styles.summaryStatItem}>
                <ThemedText style={styles.summaryStatValue}>
                  {profile.recovery_stage || 'N/A'}
                </ThemedText>
                <ThemedText style={styles.summaryStatLabel}>Current Stage</ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Legend */}
        <View style={styles.legendContainer}>
          <ThemedText style={styles.legendTitle}>Categories Legend</ThemedText>
          <View style={styles.legendGrid}>
            {Object.keys(groupedInsights).map(type => (
              <View key={`legend_${type}`} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: getTypeColor(type) }]} />
                <ThemedText style={styles.legendText}>{formatType(type)}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* User Goals Section */}
      {profile?.goals && profile.goals.length > 0 && (
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Your Recovery Goals</ThemedText>
          </View>
          
          <View style={styles.goalsContainer}>
            {profile.goals.map((goal, index) => (
              <View 
                key={`goal_${index}`}
                style={[
                  styles.goalCard, 
                  { 
                    backgroundColor: goal.status === 'active' ? '#4ecdc433' : 
                                    goal.status === 'completed' ? '#10b98133' : '#ff6b6b33'
                  }
                ]}
              >
                <View style={styles.goalHeader}>
                  <View style={[
                    styles.goalStatusDot, 
                    { 
                      backgroundColor: goal.status === 'active' ? '#4ecdc4' : 
                                      goal.status === 'completed' ? '#10b981' : '#ff6b6b'
                    }
                  ]} />
                  <ThemedText style={styles.goalDescription}>{goal.description}</ThemedText>
                </View>
                
                <View style={styles.goalDetails}>
                  <View style={styles.goalDetailItem}>
                    <ThemedText style={styles.goalDetailLabel}>Status:</ThemedText>
                    <ThemedText style={styles.goalDetailValue}>
                      {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
                    </ThemedText>
                  </View>
                  
                  {goal.target_date && (
                    <View style={styles.goalDetailItem}>
                      <ThemedText style={styles.goalDetailLabel}>Target:</ThemedText>
                      <ThemedText style={styles.goalDetailValue}>
                        {new Date(goal.target_date).toLocaleDateString()}
                      </ThemedText>
                    </View>
                  )}
                  
                  <View style={styles.goalDetailItem}>
                    <ThemedText style={styles.goalDetailLabel}>Created:</ThemedText>
                    <ThemedText style={styles.goalDetailValue}>
                      {new Date(goal.created_at).toLocaleDateString()}
                    </ThemedText>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
      
      {/* Recovery Suggestions */}
      <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
        <View style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>Personalized Suggestions</ThemedText>
        </View>
        <RecoverySuggestions 
          profile={profile} 
          insights={insightsData || []}
          onCreateGoal={(goalDescription) => {
            Alert.alert(
              'Create Goal',
              'Do you want to add this as a recovery goal?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel'
                },
                {
                  text: 'Create Goal',
                  onPress: async () => {
                    try {
                      await createGoal({
                        description: goalDescription
                      });
                      Alert.alert('Success', 'New goal created successfully!');
                    } catch (error) {
                      Alert.alert('Error', 'Failed to create goal. Please try again.');
                    }
                  }
                }
              ]
            );
          }}
        />
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
  toolsCard: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  toolsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  toolsButtonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  toolsButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  toolsButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
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
  abstinenceContainer: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  abstinenceDaysContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3b82f6',
    marginRight: 16,
  },
  abstinenceDaysValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  abstinenceDaysLabel: {
    fontSize: 14,
    color: 'white',
  },
  abstinenceDetails: {
    flex: 1,
  },
  abstinenceStartDate: {
    fontSize: 16,
    marginBottom: 8,
  },
  motivationContainer: {
    marginTop: 8,
  },
  motivationLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  motivationBarContainer: {
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 4,
  },
  motivationBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  motivationValue: {
    fontSize: 12,
  },
  categoriesContainer: {
    padding: 16,
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
  categoryText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  insightsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
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
    flex: 1,
  },
  insightMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metadataLabel: {
    fontSize: 12,
    width: 80,
    opacity: 0.7,
  },
  metadataValue: {
    fontSize: 12,
    flex: 1,
  },
  confidenceContainer: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    width: 100,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceValue: {
    fontSize: 12,
  },
  extractedAtContainer: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  extractedAtText: {
    fontSize: 10,
    opacity: 0.6,
  },
  summaryContainer: {
    padding: 16,
    alignItems: 'center',
  },
  summaryText: {
    textAlign: 'center',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 16,
  },
  summaryStatItem: {
    alignItems: 'center',
  },
  summaryStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryStatLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  legendContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
  },
  goalsContainer: {
    padding: 16,
  },
  goalCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  goalDescription: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  goalDetails: {
    marginLeft: 20,
  },
  goalDetailItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  goalDetailLabel: {
    fontSize: 12,
    width: 60,
    opacity: 0.7,
  },
  goalDetailValue: {
    fontSize: 12,
  },
});

export default UserProfileDashboard;