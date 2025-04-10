// frontend-rn/components/RecoveryStageTracker.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import { useProfile, UserInsight } from '../hooks/useProfile';

interface StageInfo {
  name: string;
  description: string;
  order: number;
  color: string;
}

interface RecoveryStages {
  [key: string]: StageInfo;
}

interface HistoryItem {
  stage: string;
  date: Date;
  stageName: string;
  order: number;
  insight?: UserInsight;
}

// Define the valid MI stage types
type MIStageType = 'engaging' | 'focusing' | 'evoking' | 'planning';

// Type guard to check if a string is a valid MI stage
function isMIStage(stage: string): stage is MIStageType {
  return ['engaging', 'focusing', 'evoking', 'planning'].includes(stage);
}

interface RecoveryStageTrackerProps {
  userId: string;
}

/**
 * Dynamic Recovery Stage Tracker that visualizes a user's journey through
 * recovery stages based on actual conversation data
 */
const RecoveryStageTracker: React.FC<RecoveryStageTrackerProps> = ({ userId }) => {
  const { profile, isLoadingProfile, profileError, getInsights } = useProfile();
  const [stageHistory, setStageHistory] = useState<HistoryItem[]>([]);
  const [userThoughts, setUserThoughts] = useState<{ [stage: string]: string[] }>({});

  // Define recovery stages and their order
  const RECOVERY_STAGES: RecoveryStages = {
    'precontemplation': {
      name: 'Precontemplation',
      description: 'Not yet acknowledging there is a problem to change',
      order: 0,
      color: '#ff9f9f'  // Light red
    },
    'contemplation': {
      name: 'Contemplation',
      description: 'Aware that a problem exists but not ready to make a change',
      order: 1,
      color: '#ffcf9f'  // Light orange
    },
    'preparation': {
      name: 'Preparation',
      description: 'Intends to take action and begins making small changes',
      order: 2,
      color: '#fff59f'  // Light yellow
    },
    'action': {
      name: 'Action',
      description: 'Actively engaged in changing behavior and environment',
      order: 3,
      color: '#9fff9f'  // Light green
    },
    'maintenance': {
      name: 'Maintenance',
      description: 'Sustaining new behavior and preventing relapse',
      order: 4,
      color: '#9fcfff'  // Light blue
    }
  };

  // Mapping between MI stages and recovery stages with proper typing
  const MI_STAGE_MAPPING: Record<MIStageType, string> = {
    'engaging': 'precontemplation',
    'focusing': 'contemplation',
    'evoking': 'preparation',
    'planning': 'action'
  };

  // Get ordered stage names
  const stageOrder = Object.keys(RECOVERY_STAGES).sort(
    (a, b) => RECOVERY_STAGES[a].order - RECOVERY_STAGES[b].order
  );

  // Use the theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const cardBgColor = useThemeColor({}, 'inputBackground');
  const borderColor = useThemeColor({}, 'inputBorder');

  // Get all insights to work with
  const {
    data: allInsightsData,
    isLoading: isLoadingAllInsights,
    error: allInsightsError
  } = getInsights();

  // Get recovery stage insights specifically
  const {
    data: stageInsightsData,
    isLoading: isLoadingStageInsights,
    error: stageInsightsError
  } = getInsights('recovery_stage');

  const isLoading = isLoadingProfile || isLoadingAllInsights || isLoadingStageInsights;
  const error = profileError || allInsightsError || stageInsightsError;

  // Process profile and insights to build stage history
  useEffect(() => {
    if (profile && allInsightsData) {
      // Get current recovery stage from profile
      const currentStage = profile.recovery_stage || 'contemplation';

      // Build stage history from insights
      // Look for insights with recovery_stage type or mi_stage metadata
      const stageRelatedInsights: UserInsight[] = [];
      
      allInsightsData.forEach(insight => {
        if (insight.type === 'recovery_stage') {
          stageRelatedInsights.push(insight);
        } 
        else if (insight.mi_stage && isMIStage(insight.mi_stage)) {
          // Create a synthetic stage insight based on MI stage
          stageRelatedInsights.push({
            ...insight,
            type: 'mi_derived_stage',
            value: MI_STAGE_MAPPING[insight.mi_stage]
          });
        }
      });

      // Sort insights by date (newest first)
      stageRelatedInsights.sort((a, b) =>
        new Date(b.extracted_at).getTime() - new Date(a.extracted_at).getTime()
      );

      // Create history entries with dates and stages
      const history: HistoryItem[] = stageRelatedInsights.map(insight => ({
        stage: insight.value,
        date: new Date(insight.extracted_at),
        stageName: RECOVERY_STAGES[insight.value]?.name || insight.value,
        order: RECOVERY_STAGES[insight.value]?.order || 0,
        insight: insight
      }));

      // Filter out duplicates (same stage) in sequence
      const uniqueHistory = history.filter((item, index, self) =>
        index === 0 || item.stage !== self[index - 1].stage
      );

      setStageHistory(uniqueHistory);

      // If we have no history but have a current stage, create a history entry
      if (uniqueHistory.length === 0 && currentStage) {
        setStageHistory([{
          stage: currentStage,
          date: new Date(),
          stageName: RECOVERY_STAGES[currentStage]?.name || currentStage,
          order: RECOVERY_STAGES[currentStage]?.order || 0
        }]);
      }

      // Extract user thoughts for each stage
      const thoughts: { [stage: string]: string[] } = {};
      
      // Find user messages associated with specific stages
      allInsightsData.forEach(insight => {
        if (insight.mi_stage && isMIStage(insight.mi_stage) && insight.value) {
          const stage = MI_STAGE_MAPPING[insight.mi_stage];
          if (!thoughts[stage]) {
            thoughts[stage] = [];
          }
          
          // Add insight value as a thought if it's meaningful
          if (insight.value.length > 10 && insight.value.length < 150) {
            thoughts[stage].push(insight.value);
          }
        }
      });

      // Deduplicate thoughts
      Object.keys(thoughts).forEach(stage => {
        thoughts[stage] = [...new Set(thoughts[stage])].slice(0, 3);
      });

      setUserThoughts(thoughts);
    }
  }, [profile, allInsightsData]);

  // Helper functions
  const formatDate = (date: Date): string => {
    if (!date) return '';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get current stage index based on active stage
  const getCurrentStageIndex = (): number => {
    const currentStage = profile?.recovery_stage || stageHistory[0]?.stage;
    return currentStage ? stageOrder.indexOf(currentStage) : -1;
  };

  // Get user thoughts for a specific stage, or fallback to default thoughts
  const getThoughtsForStage = (stage: string): string[] => {
    // If we have extracted user thoughts for this stage, use them
    if (userThoughts[stage] && userThoughts[stage].length > 0) {
      return userThoughts[stage];
    }
    
    // Otherwise, fallback to default thoughts
    switch (stage) {
      case 'precontemplation':
        return [
          "I don't really have a problem",
          "Others are exaggerating my situation",
          "I can stop whenever I want to"
        ];
      case 'contemplation':
        return [
          "I might have a problem, but I'm not sure",
          "Sometimes I think I should cut back",
          "I'm worried about my habits"
        ];
      case 'preparation':
        return [
          "I need to make some changes soon",
          "I'm gathering information about recovery",
          "I'm figuring out my first steps"
        ];
      case 'action':
        return [
          "I'm actively working on my recovery",
          "I'm learning new coping strategies",
          "I'm avoiding my triggers"
        ];
      case 'maintenance':
        return [
          "I need to stay vigilant to prevent relapse",
          "I'm integrating new behaviors into my lifestyle",
          "I have more confidence in my ability to stay clean"
        ];
      default:
        return [];
    }
  };

  // Generate personalized recommendations based on stage and insights
  const generateRecommendations = (stage: string): string[] => {
    const recommendations: string[] = [];
    const triggers = allInsightsData?.filter(i => i.type === 'trigger') || [];
    const traits = allInsightsData?.filter(i => i.type === 'psychological_trait') || [];
    const copingStrategies = allInsightsData?.filter(i => i.type === 'coping_strategy') || [];

    // Add stage-specific recommendations
    if (stage === 'precontemplation') {
      recommendations.push('Learn more about the potential impacts of your behavior');
      recommendations.push('Keep a journal to track behavior patterns and consequences');
      recommendations.push('Consider what would be different if you made small changes');
    } 
    else if (stage === 'contemplation') {
      recommendations.push('Write down pros and cons of continued use vs. changing');
      recommendations.push('Imagine your future with and without changes');
      
      // Add personalized recommendation based on triggers
      if (triggers.length > 0) {
        recommendations.push(`Identify your key triggers like "${triggers[0].value}"`);
      } else {
        recommendations.push('Start thinking about small, achievable first steps');
      }
    }
    else if (stage === 'preparation') {
      recommendations.push('Set a specific change date within the next 2 weeks');
      
      // Add personalized recommendation based on psychological traits
      if (traits.length > 0) {
        const trait = traits[0].value.split(':')[0].replace(/_/g, ' ');
        recommendations.push(`Consider how ${trait} might affect your recovery journey`);
      } else {
        recommendations.push('Create a detailed action plan with specific steps');
      }
      
      recommendations.push('Tell supportive friends or family about your plans');
    }
    else if (stage === 'action') {
      recommendations.push('Use the app daily to reinforce your commitment');
      
      // Add personalized recommendation based on triggers
      if (triggers.length > 0) {
        recommendations.push(`Practice avoiding "${triggers[0].value}" situations`);
      } else {
        recommendations.push('Avoid high-risk situations and practice refusal skills');
      }
      
      // Add personalized recommendation based on coping strategies
      if (copingStrategies.length > 0) {
        recommendations.push(`Continue practicing "${copingStrategies[0].value}" when facing challenges`);
      } else {
        recommendations.push('Reward yourself for achieving milestones');
      }
    }
    else if (stage === 'maintenance') {
      recommendations.push('Develop long-term strategies for preventing relapse');
      
      // Add personalized recommendation based on coping strategies
      if (copingStrategies.length > 0) {
        recommendations.push(`Strengthen your "${copingStrategies[0].value}" practice`);
      } else {
        recommendations.push('Continue building a lifestyle that supports your recovery');
      }
      
      recommendations.push('Consider mentoring others who are earlier in their journey');
    }

    return recommendations;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ThemedText style={styles.loadingText}>Loading recovery stage data...</ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ThemedText style={styles.errorText}>Error loading recovery data: {error.message}</ThemedText>
      </View>
    );
  }

  // Get current stage info
  const currentStageIndex = getCurrentStageIndex();
  const activeStage = profile?.recovery_stage || stageHistory[0]?.stage || 'contemplation';
  const currentStageInfo = RECOVERY_STAGES[activeStage];
  const currentStageThoughts = getThoughtsForStage(activeStage);
  
  // Get personalized recommendations
  const stageRecommendations = generateRecommendations(activeStage);

  return (
    <View style={styles.container}>
      {/* Progress Tracker Visualization - Simplified without SVG */}
      <View style={[styles.progressContainer, { borderColor }]}>
        <View style={styles.stageLabels}>
          {stageOrder.map((stage, index) => (
            <ThemedText
              key={`label_${stage}`}
              style={[
                styles.stageLabel,
                stage === activeStage && {
                  color: tintColor,
                  fontWeight: 'bold'
                }
              ]}
              numberOfLines={1}
            >
              {RECOVERY_STAGES[stage].name}
            </ThemedText>
          ))}
        </View>

        <View style={styles.progressTrack}>
          {/* Background track */}
          <View style={styles.trackBackground} />

          {/* Progress fill */}
          <View
            style={[
              styles.trackFill,
              {
                width: `${((currentStageIndex + 1) / stageOrder.length) * 100}%`,
                backgroundColor: tintColor
              }
            ]}
          />

          {/* Stage points */}
          <View style={styles.stagePoints}>
            {stageOrder.map((stage, index) => {
              const isCurrent = stage === activeStage;
              const isPast = RECOVERY_STAGES[stage].order < RECOVERY_STAGES[activeStage].order;

              return (
                <View
                  key={`point_${stage}`}
                  style={[
                    styles.stagePoint,
                    isCurrent && styles.currentStagePoint,
                    isPast && { backgroundColor: tintColor },
                    isCurrent && { backgroundColor: tintColor },
                    isCurrent && { borderColor: 'white', borderWidth: 2 }
                  ]}
                />
              );
            })}
          </View>
        </View>
      </View>

      {/* Current Stage Description */}
      {currentStageInfo && (
        <View style={[styles.stageInfoContainer, {
          backgroundColor: currentStageInfo.color,
          borderColor
        }]}>
          <ThemedText style={styles.stageInfoTitle}>
            {currentStageInfo.name} Stage
          </ThemedText>
          <ThemedText style={styles.stageInfoDescription}>
            {currentStageInfo.description}
          </ThemedText>

          {/* Common thoughts in this stage - dynamically sourced when available */}
          <View style={styles.thoughtsContainer}>
            <ThemedText style={styles.thoughtsTitle}>
              {userThoughts[activeStage] && userThoughts[activeStage].length > 0 
                ? "Your thoughts at this stage:" 
                : "Typical thoughts at this stage:"}
            </ThemedText>
            {currentStageThoughts.map((thought, index) => (
              <View key={`thought_${index}`} style={styles.thoughtItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.thoughtText}>{thought}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Stage History Timeline */}
      {stageHistory.length > 0 && (
        <View style={[styles.historyContainer, { borderTopColor: borderColor }]}>
          <ThemedText style={styles.historyTitle}>Your Recovery Journey</ThemedText>

          {stageHistory.map((historyItem, index) => {
            const isLatest = index === 0;

            return (
              <View key={`history_${index}`} style={styles.historyItem}>
                {/* Timeline vertical line */}
                {index < stageHistory.length - 1 && (
                  <View style={[styles.timelineConnector, { backgroundColor: tintColor }]} />
                )}

                {/* Timeline dot */}
                <View style={[styles.timelineDot, {
                  backgroundColor: isLatest ? tintColor : cardBgColor,
                  borderColor: tintColor
                }]} />

                {/* History content */}
                <View style={styles.historyContent}>
                  <ThemedText style={[styles.historyStageName, { color: isLatest ? tintColor : textColor }]}>
                    {historyItem.stageName}
                  </ThemedText>
                  <ThemedText style={styles.historyDate}>
                    {formatDate(historyItem.date)}
                  </ThemedText>

                  {isLatest && (
                    <ThemedText style={[styles.currentLabel, { color: tintColor }]}>
                      Current Stage
                    </ThemedText>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Goals & Next Steps based on current stage - dynamically generated */}
      <View style={[styles.goalsContainer, { borderTopColor: borderColor }]}>
        <ThemedText style={styles.goalsTitle}>Recommended Next Steps</ThemedText>

        <View style={styles.goalsList}>
          {stageRecommendations.map((recommendation, index) => (
            <View key={`recommendation_${index}`} style={styles.goalItem}>
              <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
              <ThemedText style={styles.goalText}>{recommendation}</ThemedText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
  progressContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  stageLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stageLabel: {
    fontSize: 10,
    textAlign: 'center',
    width: 65,
  },
  progressTrack: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  trackBackground: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
  },
  trackFill: {
    position: 'absolute',
    top: 20,
    left: 0,
    height: 6,
    borderRadius: 3,
  },
  stagePoints: {
    position: 'absolute',
    top: 13,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stagePoint: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e0e0e0',
  },
  currentStagePoint: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  stageInfoContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  stageInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stageInfoDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  thoughtsContainer: {
    marginTop: 8,
  },
  thoughtsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  thoughtItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: 8,
  },
  thoughtText: {
    flex: 1,
    fontSize: 13,
  },
  historyContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  historyItem: {
    flexDirection: 'row',
    marginBottom: 20,
    position: 'relative',
  },
  timelineConnector: {
    position: 'absolute',
    left: 10,
    top: 20,
    width: 2,
    height: '100%',
    zIndex: 1,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 12,
    alignSelf: 'flex-start',
    zIndex: 2,
  },
  historyContent: {
    flex: 1,
  },
  historyStageName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 13,
    opacity: 0.7,
  },
  currentLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
  goalsContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  goalsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  goalsList: {
    marginTop: 4,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  goalText: {
    flex: 1,
    fontSize: 14,
  }
});

export default RecoveryStageTracker;