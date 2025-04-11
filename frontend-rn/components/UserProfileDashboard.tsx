// Import required modules
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Text } from 'react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import RecoveryStageTracker from './RecoveryStageTracker';
import ProfileInsightsVisualization from './ProfileInsightsVisualization';
// Import client from the API client generated file
import { ProfilesService } from '../src/client/sdk.gen';

// Fixed interface definitions to avoid TypeScript errors
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
  // Updated to fix TypeScript errors with other_traits
  psychological_traits?: {
    [key: string]: boolean | string[] | undefined;
    need_for_approval?: boolean;
    fear_of_rejection?: boolean;
    low_self_confidence?: boolean;
    submissiveness?: boolean;
    other_traits?: string[];
  };
  motivation?: {
    internal_motivators?: string[];
    external_motivators?: string[];
    ambivalence_factors?: string[];
  };
  triggers?: {
    emotional?: string[];
    social?: string[];
    time_based?: {
      days?: string[];
      times?: string[];
    };
  };
  analysis?: {
    key_insights?: string[];
    recommended_focus?: string;
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
      // Use the ProfilesService from the SDK to fetch profile data
      console.log("Fetching profile data...");
      const { data } = await ProfilesService.getMyProfile({
        throwOnError: true,
      });
      console.log("Profile API raw response:", JSON.stringify(data, null, 2));
      
      // Log properties to see what's actually in the data
      console.log("Profile data properties:", Object.keys(data || {}));
      console.log("Has profile object?", data?.profile ? "Yes" : "No");
      console.log("Has insights?", data?.insights ? `Yes (${Object.keys(data.insights || {}).length} types)` : "No");
      
      setProfileData(data as unknown as StructuredProfile);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('Error fetching profile data:', err);
      console.log('Error details:', JSON.stringify(err));
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStructuredProfile = async () => {
    console.log("Generating structured profile...");
    try {
      const response = await fetch('/api/v1/profiles/generate-structured-profile', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      const data = await response.json();
      console.log("Generated profile structure:", data);
      setProfileData(data as unknown as StructuredProfile);
      return data;
    } catch (err) {
      console.error("Error generating structured profile:", err);
      return null;
    }
  };

  const fetchRawInsights = async () => {
    console.log("Fetching raw insights data...");
    try {
      const response = await fetch('/api/v1/profiles/raw-insights-data');
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      const data = await response.json();
      console.log("Raw insights data:", data);
      return data;
    } catch (err) {
      console.error("Error fetching raw insights:", err);
      return null;
    }
  };

  const generateFromConversations = async () => {
    try {
      console.log("Generating profile from existing conversations...");
      // Use complete URL instead of relative path
      const API_BASE_URL = 'http://10.0.2.2:8000'; // For Android emulator
      // const API_BASE_URL = 'http://localhost:8000'; // For iOS simulator
      
      const response = await fetch(`${API_BASE_URL}/api/v1/profiles/generate-from-conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_AUTH_TOKEN' // Add your auth token if required
        }
      });
      
      // Rest of function remains the same
      const data = await response.json();
      console.log("Generated profile from conversations:", JSON.stringify(data, null, 2));
      
      if (data && !data.error) {
        setProfileData(data as unknown as StructuredProfile);
        return true;
      } else {
        console.error("Error in response:", data.error);
        return false;
      }
    } catch (err) {
      console.error("Error generating profile from conversations:", err);
      return false;
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
        <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: tintColor }]}
          onPress={() => fetchProfileData()}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Debug view to see raw data - remove for production
  const showDebugView = true; // Change to false to hide
  if (showDebugView) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Profile Data Debug View</ThemedText>
          </View>
          <View style={{ padding: 16 }}>
            <ThemedText style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {profileData ? JSON.stringify(profileData, null, 2) : "No data received"}
            </ThemedText>
          </View>
        </View>
        <TouchableOpacity 
          style={[styles.refreshButton, {backgroundColor: tintColor}]} 
          onPress={() => fetchProfileData()}
        >
          <Text style={styles.refreshButtonText}>Refresh Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.debugButton, {backgroundColor: '#8b5cf6', marginTop: 10}]} 
          onPress={generateFromConversations}
        >
          <Text style={styles.buttonText}>Generate from Conversations</Text>
        </TouchableOpacity>
      </ScrollView>
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
        <RecoveryStageTracker 
          userId={userId} 
          initialStage={profileData.profile.recovery_stage} // Changed from stage to initialStage
        />
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

      {/* Enhanced Psychological Traits section */}
      {profileData.psychological_traits && (
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Psychological Profile</ThemedText>
          </View>
          <View style={styles.traitsContainer}>
            {Object.entries(profileData.psychological_traits).filter(([key, value]) => 
              key !== 'other_traits' && typeof value === 'boolean' && value
            ).map(([trait, value]) => (
              <View key={trait} style={styles.traitItem}>
                <View style={[styles.traitDot, { backgroundColor: '#4ecdc4' }]} />
                <ThemedText style={styles.traitText}>
                  {trait.split('_').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')}
                </ThemedText>
              </View>
            ))}
            
            {profileData.psychological_traits.other_traits && 
            profileData.psychological_traits.other_traits.length > 0 && (
              <View style={styles.otherTraitsContainer}>
                <ThemedText style={styles.sectionSubtitle}>Other Traits</ThemedText>
                {profileData.psychological_traits.other_traits.map((trait, index) => (
                  <View key={`other_trait_${index}`} style={styles.traitItem}>
                    <View style={[styles.traitDot, { backgroundColor: '#94a3b8' }]} />
                    <ThemedText style={styles.traitText}>{trait}</ThemedText>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}
      
      {/* Motivation Factors */}
      {profileData.motivation && (
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Motivation Analysis</ThemedText>
          </View>
          <View style={styles.motivationContainer}>
            {/* Level visualization - reuse your existing motivation bar */}
            
            {/* Internal motivators */}
            {profileData.motivation.internal_motivators && 
            profileData.motivation.internal_motivators.length > 0 && (
              <View style={styles.motivationSection}>
                <ThemedText style={styles.sectionSubtitle}>Internal Motivators</ThemedText>
                {profileData.motivation.internal_motivators.map((motivator, index) => (
                  <View key={`internal_${index}`} style={styles.motivatorItem}>
                    <View style={[styles.motivatorDot, { backgroundColor: '#10b981' }]} />
                    <ThemedText style={styles.motivatorText}>{motivator}</ThemedText>
                  </View>
                ))}
              </View>
            )}
            
            {/* External motivators */}
            {profileData.motivation.external_motivators && 
            profileData.motivation.external_motivators.length > 0 && (
              <View style={styles.motivationSection}>
                <ThemedText style={styles.sectionSubtitle}>External Motivators</ThemedText>
                {profileData.motivation.external_motivators.map((motivator, index) => (
                  <View key={`external_${index}`} style={styles.motivatorItem}>
                    <View style={[styles.motivatorDot, { backgroundColor: '#3b82f6' }]} />
                    <ThemedText style={styles.motivatorText}>{motivator}</ThemedText>
                  </View>
                ))}
              </View>
            )}
            
            {/* Ambivalence factors */}
            {profileData.motivation.ambivalence_factors && 
            profileData.motivation.ambivalence_factors.length > 0 && (
              <View style={styles.motivationSection}>
                <ThemedText style={styles.sectionSubtitle}>Ambivalence Factors</ThemedText>
                {profileData.motivation.ambivalence_factors.map((factor, index) => (
                  <View key={`ambivalence_${index}`} style={styles.motivatorItem}>
                    <View style={[styles.motivatorDot, { backgroundColor: '#f59e0b' }]} />
                    <ThemedText style={styles.motivatorText}>{factor}</ThemedText>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}
      
      {/* Triggers Map */}
      {profileData.triggers && (
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Trigger Analysis</ThemedText>
          </View>
          <View style={styles.triggersContainer}>
            {/* Emotional triggers */}
            {profileData.triggers.emotional && profileData.triggers.emotional.length > 0 && (
              <View style={styles.triggerSection}>
                <ThemedText style={styles.sectionSubtitle}>Emotional Triggers</ThemedText>
                {profileData.triggers.emotional.map((trigger, index) => (
                  <View key={`emotional_${index}`} style={styles.triggerItem}>
                    <View style={[styles.triggerDot, { backgroundColor: '#ff6b6b' }]} />
                    <ThemedText style={styles.triggerText}>{trigger}</ThemedText>
                  </View>
                ))}
              </View>
            )}
            
            {/* Social triggers */}
            {profileData.triggers.social && profileData.triggers.social.length > 0 && (
              <View style={styles.triggerSection}>
                <ThemedText style={styles.sectionSubtitle}>Social Triggers</ThemedText>
                {profileData.triggers.social.map((trigger, index) => (
                  <View key={`social_${index}`} style={styles.triggerItem}>
                    <View style={[styles.triggerDot, { backgroundColor: '#8b5cf6' }]} />
                    <ThemedText style={styles.triggerText}>{trigger}</ThemedText>
                  </View>
                ))}
              </View>
            )}
            
            {/* Time-based triggers */}
            {profileData.triggers.time_based && (
              <>
                {profileData.triggers.time_based.days && profileData.triggers.time_based.days.length > 0 && (
                  <View style={styles.triggerSection}>
                    <ThemedText style={styles.sectionSubtitle}>Day Triggers</ThemedText>
                    {profileData.triggers.time_based.days.map((day, index) => (
                      <View key={`day_${index}`} style={styles.triggerItem}>
                        <View style={[styles.triggerDot, { backgroundColor: '#4ecdc4' }]} />
                        <ThemedText style={styles.triggerText}>{day}</ThemedText>
                      </View>
                    ))}
                  </View>
                )}
                
                {profileData.triggers.time_based.times && profileData.triggers.time_based.times.length > 0 && (
                  <View style={styles.triggerSection}>
                    <ThemedText style={styles.sectionSubtitle}>Time Triggers</ThemedText>
                    {profileData.triggers.time_based.times.map((time, index) => (
                      <View key={`time_${index}`} style={styles.triggerItem}>
                        <View style={[styles.triggerDot, { backgroundColor: '#4ecdc4' }]} />
                        <ThemedText style={styles.triggerText}>{time}</ThemedText>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      )}

      {/* Key Insights */}
      {profileData.analysis && profileData.analysis.key_insights && profileData.analysis.key_insights.length > 0 && (
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Key Insights</ThemedText>
          </View>
          <View style={styles.insightsContainer}>
            {profileData.analysis.key_insights.map((insight, index) => (
              <View key={`insight_${index}`} style={styles.insightItem}>
                <View style={styles.insightNumber}>
                  <ThemedText style={styles.insightNumberText}>{index + 1}</ThemedText>
                </View>
                <ThemedText style={styles.insightText}>{insight}</ThemedText>
              </View>
            ))}
            
            {profileData.analysis.recommended_focus && (
              <View style={styles.recommendedFocusContainer}>
                <ThemedText style={styles.recommendedFocusLabel}>Recommended Focus:</ThemedText>
                <ThemedText style={styles.recommendedFocusText}>
                  {profileData.analysis.recommended_focus}
                </ThemedText>
              </View>
            )}
          </View>
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
  // Updated styles with new definitions
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.8,
  },
  otherTraitsContainer: {
    marginTop: 12,
  },
  motivationSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  motivatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  motivatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  motivatorText: {
    fontSize: 14,
  },
  triggersContainer: {
    padding: 16,
  },
  triggerSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  triggerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  triggerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  triggerText: {
    fontSize: 14,
  },
  insightItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  insightNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  insightNumberText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  insightText: {
    fontSize: 14,
    flex: 1,
  },
  recommendedFocusContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
  },
  recommendedFocusLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  recommendedFocusText: {
    fontSize: 14,
  },
  debugButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default EnhancedProfileDashboard;