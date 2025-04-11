import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Text } from 'react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import RecoveryStageTracker from './RecoveryStageTracker';
import ProfileInsightsVisualization from './ProfileInsightsVisualization';
// import { useStructuredProfile } from '../hooks/useProfile';

// Define the types for structured profile data
interface UserInsight {
  id: string;
  value: string;
  confidence: number;
  emotional_significance?: number;
  day_of_week?: string;
  time_of_day?: string;
  extracted_at?: string;
}

interface UserGoal {
  id: string;
  description: string;
  created_at: string;
  target_date?: string;
  status: string;
}

interface StructuredProfile {
  profile: {
    id: string;
    addiction_type?: string;
    recovery_stage?: string;
    motivation_level?: number;
    abstinence_days?: number;
    abstinence_start_date?: string;
    psychological_traits?: Record<string, boolean>;
    last_updated?: string;
  };
  insights: Record<string, UserInsight[]>;
  goals: UserGoal[];
  summary: {
    has_profile: boolean;
    insight_count: number;
    insight_types: string[];
    goals_count: number;
    last_updated?: string;
  };
}

interface EnhancedProfileDashboardProps {
  userId: string;
  onRefresh?: () => void;
}

const EnhancedProfileDashboard: React.FC<EnhancedProfileDashboardProps> = ({ userId, onRefresh }) => {
  const [profileData, setProfileData] = useState<StructuredProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const cardBgColor = useThemeColor({}, 'inputBackground');
  const borderColor = useThemeColor({}, 'inputBorder');

  // Fetch structured profile data
  useEffect(() => {
    fetchProfileData();
  }, [userId]);

  const fetchProfileData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Replace with your actual API call
      const response = await fetch(`/api/v1/profiles/structured-profile`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile data');
      }
      
      const data = await response.json();
      setProfileData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching profile data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get color for insight type
  const getTypeColor = (type: string): string => {
    switch(type) {
      case 'trigger': return '#ff6b6b';
      case 'psychological_trait': return '#4ecdc4';
      case 'coping_strategy': return '#ffd166';
      case 'recovery_stage': return '#3b82f6';
      case 'motivation': return '#10b981';
      case 'goal_acceptance': return '#8b5cf6';
      case 'notification_keyword': return '#f59e0b';
      case 'addiction_type': return '#ec4899';
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tintColor} />
        <ThemedText style={styles.loadingText}>Loading profile data...</ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <ThemedText style={styles.errorText}>Error: {error instanceof Error ? error.message : 'Unknown error'}</ThemedText>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: tintColor }]}
          onPress={() => refetch()}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!profileData || !profileData.profile) {
    return (
      <View style={styles.emptyContainer}>
        <ThemedText style={styles.emptyText}>
          No profile data available yet. Start chatting to build your profile.
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Recovery Stage Section */}
      <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
        <View style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>Recovery Journey</ThemedText>
        </View>
        <RecoveryStageTracker userId={userId} initialStage={profileData.profile.recovery_stage} />
      </View>

      {/* Abstinence Progress Section */}
      <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
        <View style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>Abstinence Progress</ThemedText>
        </View>
        <View style={styles.abstinenceContainer}>
          <View style={styles.abstinenceDaysContainer}>
            <ThemedText style={styles.abstinenceDaysValue}>
              {profileData.profile.abstinence_days || 0}
            </ThemedText>
            <ThemedText style={styles.abstinenceDaysLabel}>Days</ThemedText>
          </View>
          <View style={styles.abstinenceDetails}>
            {profileData.profile.abstinence_start_date && (
              <ThemedText style={styles.abstinenceStartDate}>
                Since: {new Date(profileData.profile.abstinence_start_date).toLocaleDateString()}
              </ThemedText>
            )}
            <View style={styles.motivationContainer}>
              <ThemedText style={styles.motivationLabel}>Motivation Level:</ThemedText>
              <View style={styles.motivationBarContainer}>
                <View 
                  style={[
                    styles.motivationBarFill, 
                    { 
                      width: `${(profileData.profile.motivation_level || 0) * 10}%`,
                      backgroundColor: tintColor
                    }
                  ]} 
                />
              </View>
              <ThemedText style={styles.motivationValue}>
                {profileData.profile.motivation_level || 0}/10
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      {/* Profile Summary */}
      <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
        <View style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>Profile Summary</ThemedText>
        </View>
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryLabel}>Addiction Type</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {profileData.profile.addiction_type ? 
                  profileData.profile.addiction_type.charAt(0).toUpperCase() + profileData.profile.addiction_type.slice(1) : 
                  'Not identified'}
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryLabel}>Recovery Stage</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {profileData.profile.recovery_stage ? 
                  profileData.profile.recovery_stage.charAt(0).toUpperCase() + profileData.profile.recovery_stage.slice(1) : 
                  'Not determined'}
              </ThemedText>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryLabel}>Insights</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {profileData.summary.insight_count || 0}
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryLabel}>Active Goals</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {profileData.summary.goals_count || 0}
              </ThemedText>
            </View>
          </View>
          {profileData.profile.last_updated && (
            <ThemedText style={styles.lastUpdatedText}>
              Last updated: {new Date(profileData.profile.last_updated).toLocaleString()}
            </ThemedText>
          )}
        </View>
      </View>

      {/* Psychological Traits */}
      {profileData.profile.psychological_traits && 
       Object.keys(profileData.profile.psychological_traits).length > 0 && (
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Psychological Traits</ThemedText>
          </View>
          <View style={styles.traitsContainer}>
            {Object.entries(profileData.profile.psychological_traits).map(([trait, value]) => (
              <View key={trait} style={styles.traitItem}>
                <View style={[styles.traitDot, { 
                  backgroundColor: value ? '#4ecdc4' : '#ff6b6b' 
                }]} />
                <ThemedText style={styles.traitText}>
                  {trait.split('_').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Insights Categories */}
      {profileData.insights && Object.keys(profileData.insights).length > 0 && (
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Your Insights</ThemedText>
          </View>
          <View style={styles.categoriesContainer}>
            {Object.keys(profileData.insights).map(type => (
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
                  {formatType(type)} ({profileData.insights[type].length})
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Selected category insights */}
          {selectedCategory && profileData.insights[selectedCategory] && (
            <View style={styles.insightsContainer}>
              <ThemedText style={styles.sectionTitle}>{formatType(selectedCategory)}</ThemedText>
              
              {profileData.insights[selectedCategory].map((insight, index) => (
                <View 
                  key={insight.id || `${selectedCategory}_${index}`}
                  style={[
                    styles.insightCard, 
                    { backgroundColor: getTypeColor(selectedCategory) + '22' }
                  ]}
                >
                  <View style={styles.insightHeader}>
                    <View style={[styles.insightDot, { backgroundColor: getTypeColor(selectedCategory) }]} />
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
                              backgroundColor: getTypeColor(selectedCategory)
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
            </View>
          )}
        </View>
      )}

      {/* Active Goals */}
      {profileData.goals && profileData.goals.length > 0 && (
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Your Recovery Goals</ThemedText>
          </View>
          <View style={styles.goalsContainer}>
            {profileData.goals.map(goal => (
              <View 
                key={goal.id}
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

      {/* Refresh Button */}
      <TouchableOpacity 
        style={[styles.refreshButton, {backgroundColor: tintColor}]} 
        onPress={() => {
          fetchProfileData();
          if (onRefresh) onRefresh();
        }}
      >
        <Text style={styles.refreshButtonText}>Refresh Profile</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    marginBottom: 16,
    textAlign: 'center',
    color: '#ff6b6b',
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 16,
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
  summaryContainer: {
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  lastUpdatedText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 8,
    textAlign: 'right',
  },
  traitsContainer: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  traitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 12,
  },
  traitDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  traitText: {
    fontSize: 14,
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
  insightsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
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
  summaryText: {
    textAlign: 'center',
    marginBottom: 16,
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
  refreshButton: {
    marginTop: 16,
    marginBottom: 32,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'center',
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default EnhancedProfileDashboard;