import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import { useProfile } from '../hooks/useProfile';

// Define TypeScript interfaces for the recovery data
interface UserInsight {
  id: string;
  type: string;
  value: string;
  extracted_at: string;
  significance?: number;
  confidence?: number;
  day_of_week?: string;
  time_of_day?: string;
}

interface UserProfile {
  id: string;
  user_id: string;
  addiction_type: string | null;
  recovery_stage?: string | null;
  abstinence_days?: number;
  abstinence_start_date?: string | null;
  motivation_level?: number | null;
  last_updated?: string;
  [key: string]: any;
}

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
}

interface RecoveryStageTrackerProps {
  userId: string;
}

/**
 * Recovery Stage Tracker that visualizes a user's journey through
 * recovery stages without external dependencies
 */
const RecoveryStageTracker: React.FC<RecoveryStageTrackerProps> = ({ userId }) => {
  const { profile, isLoadingProfile, profileError, getInsights } = useProfile();
  const [stageHistory, setStageHistory] = useState<HistoryItem[]>([]);

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

  // Get insights about recovery stages
  const {
    data: insightsData,
    isLoading: isLoadingInsights,
    error: insightsError
  } = getInsights('recovery_stage');

  const isLoading = isLoadingProfile || isLoadingInsights;
  const error = profileError || insightsError;

  // Process profile and insights to build stage history
  useEffect(() => {
    if (profile && insightsData) {
      // Get current recovery stage from profile
      const currentStage = profile.recovery_stage || 'contemplation';

      // Build stage history from insights
      const stageInsights = [...(insightsData || [])].filter(
        insight => insight.type === 'recovery_stage'
      );

      // Sort insights by date (newest first)
      stageInsights.sort((a, b) =>
        new Date(b.extracted_at).getTime() - new Date(a.extracted_at).getTime()
      );

      // Create history entries with dates and stages
      const history: HistoryItem[] = stageInsights.map(insight => ({
        stage: insight.value,
        date: new Date(insight.extracted_at),
        stageName: RECOVERY_STAGES[insight.value]?.name || insight.value,
        order: RECOVERY_STAGES[insight.value]?.order || 0
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
    }
  }, [profile, insightsData]);

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

  // Get typical thoughts for a specific stage
  const getThoughtsForStage = (stage: string): string[] => {
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

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ThemedText style={styles.loadingText}>Loading recovery stage data...</ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ThemedText style={styles.errorText}>Error loading recovery data: {error.message}</ThemedText>
      </View>
    );
  }

  // Get current stage info
  const currentStageIndex = getCurrentStageIndex();
  const activeStage = profile?.recovery_stage || stageHistory[0]?.stage || 'contemplation';
  const currentStageInfo = RECOVERY_STAGES[activeStage];
  const currentStageThoughts = getThoughtsForStage(activeStage);

  return (
    <ScrollView style={[styles.container, { backgroundColor }]}>
      <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
        {/* Card Title */}
        <View style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>Recovery Stage Tracker</ThemedText>
          <ThemedText style={styles.cardSubtitle}>Based on the Stages of Change model</ThemedText>
        </View>

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

            {/* Common thoughts in this stage */}
            <View style={styles.thoughtsContainer}>
              <ThemedText style={styles.thoughtsTitle}>Typical thoughts in this stage:</ThemedText>
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

        {/* Goals & Next Steps based on current stage */}
        <View style={[styles.goalsContainer, { borderTopColor: borderColor }]}>
          <ThemedText style={styles.goalsTitle}>Recommended Next Steps</ThemedText>

          {activeStage === 'precontemplation' && (
            <View style={styles.goalsList}>
              <View style={styles.goalItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.goalText}>
                  Learn more about the potential impacts of your behavior
                </ThemedText>
              </View>
              <View style={styles.goalItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.goalText}>
                  Keep a journal to track behavior patterns and consequences
                </ThemedText>
              </View>
              <View style={styles.goalItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.goalText}>
                  Consider what would be different if you made small changes
                </ThemedText>
              </View>
            </View>
          )}

          {activeStage === 'contemplation' && (
            <View style={styles.goalsList}>
              <View style={styles.goalItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.goalText}>
                  Write down pros and cons of continued use vs. changing
                </ThemedText>
              </View>
              <View style={styles.goalItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.goalText}>
                  Imagine your future with and without changes
                </ThemedText>
              </View>
              <View style={styles.goalItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.goalText}>
                  Start thinking about small, achievable first steps
                </ThemedText>
              </View>
            </View>
          )}

          {activeStage === 'preparation' && (
            <View style={styles.goalsList}>
              <View style={styles.goalItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.goalText}>
                  Set a specific change date within the next 2 weeks
                </ThemedText>
              </View>
              <View style={styles.goalItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.goalText}>
                  Create a detailed action plan with specific steps
                </ThemedText>
              </View>
              <View style={styles.goalItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.goalText}>
                  Tell supportive friends or family about your plans
                </ThemedText>
              </View>
            </View>
          )}

          {activeStage === 'action' && (
            <View style={styles.goalsList}>
              <View style={styles.goalItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.goalText}>
                  Use the app daily to reinforce your commitment
                </ThemedText>
              </View>
              <View style={styles.goalItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.goalText}>
                  Avoid high-risk situations and practice refusal skills
                </ThemedText>
              </View>
              <View style={styles.goalItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.goalText}>
                  Reward yourself for achieving milestones
                </ThemedText>
              </View>
            </View>
          )}

          {activeStage === 'maintenance' && (
            <View style={styles.goalsList}>
              <View style={styles.goalItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.goalText}>
                  Develop long-term strategies for preventing relapse
                </ThemedText>
              </View>
              <View style={styles.goalItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.goalText}>
                  Continue building a lifestyle that supports your recovery
                </ThemedText>
              </View>
              <View style={styles.goalItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.goalText}>
                  Consider mentoring others who are earlier in their journey
                </ThemedText>
              </View>
            </View>
          )}
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
