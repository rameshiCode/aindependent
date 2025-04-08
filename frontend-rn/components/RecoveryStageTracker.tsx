import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';

interface StageInfo {
  name: string;
  description: string;
}

const RECOVERY_STAGES: Record<string, StageInfo> = {
  'precontemplation': {
    name: 'Precontemplation',
    description: 'Not yet acknowledging there is a problem to change.'
  },
  'contemplation': {
    name: 'Contemplation',
    description: 'Aware that a problem exists but not ready to make a change.'
  },
  'preparation': {
    name: 'Preparation',
    description: 'Intends to take action and begins making small changes.'
  },
  'action': {
    name: 'Action',
    description: 'Actively engaged in changing behavior and environment.'
  },
  'maintenance': {
    name: 'Maintenance',
    description: 'Sustaining new behavior and preventing relapse.'
  }
};

// Order of stages for visual progression
const STAGE_ORDER = [
  'precontemplation',
  'contemplation',
  'preparation',
  'action',
  'maintenance'
];

interface RecoveryStageTrackerProps {
  currentStage?: string | null;
}

export const RecoveryStageTracker: React.FC<RecoveryStageTrackerProps> = ({
  currentStage
}) => {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const cardBackground = useThemeColor({}, 'inputBackground');
  const borderColor = useThemeColor({}, 'inputBorder');

  // If stage is not recognized, default to contemplation
  const normalizedStage = currentStage &&
    Object.keys(RECOVERY_STAGES).includes(currentStage.toLowerCase())
    ? currentStage.toLowerCase()
    : null;

  // Get current stage index
  const currentStageIndex = normalizedStage
    ? STAGE_ORDER.indexOf(normalizedStage)
    : -1;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Recovery Stage</ThemedText>
        <ThemedText style={styles.subtitle}>
          Based on the Stages of Change model
        </ThemedText>
      </View>

      {/* Progress Tracker */}
      <View style={[styles.stageTracker, { borderColor }]}>
        {STAGE_ORDER.map((stage, index) => (
          <React.Fragment key={stage}>
            {/* Connector line */}
            {index > 0 && (
              <View
                style={[
                  styles.connector,
                  {
                    backgroundColor: index <= currentStageIndex ? tintColor : '#ddd'
                  }
                ]}
              />
            )}

            {/* Stage circle */}
            <View
              style={[
                styles.stageCircle,
                {
                  borderColor: tintColor,
                  backgroundColor: index <= currentStageIndex ? tintColor : backgroundColor,
                }
              ]}
            >
              {index === currentStageIndex && (
                <View style={[styles.currentIndicator, { borderColor: tintColor }]} />
              )}
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* Stage Labels */}
      <View style={styles.stageLabels}>
        {STAGE_ORDER.map((stage, index) => (
          <ThemedText
            key={stage}
            style={[
              styles.stageLabel,
              {
                color: index <= currentStageIndex ? tintColor : textColor,
                opacity: index <= currentStageIndex ? 1 : 0.5,
                fontWeight: index === currentStageIndex ? 'bold' : 'normal',
              }
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {RECOVERY_STAGES[stage].name}
          </ThemedText>
        ))}
      </View>

      {/* Current Stage Description */}
      {normalizedStage ? (
        <View style={[styles.descriptionCard, { backgroundColor: cardBackground, borderColor }]}>
          <ThemedText style={styles.descriptionTitle}>
            {RECOVERY_STAGES[normalizedStage].name} Stage
          </ThemedText>
          <ThemedText style={styles.description}>
            {RECOVERY_STAGES[normalizedStage].description}
          </ThemedText>

          {/* Typical behaviors for this stage */}
          <View style={styles.behaviorsSection}>
            <ThemedText style={styles.behaviorHeader}>Typical thoughts:</ThemedText>
            {getThoughtsForStage(normalizedStage).map((thought, index) => (
              <View key={index} style={styles.behaviorItem}>
                <View style={[styles.bulletPoint, { backgroundColor: tintColor }]} />
                <ThemedText style={styles.behaviorText}>{thought}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={[styles.descriptionCard, { backgroundColor: cardBackground, borderColor }]}>
          <ThemedText style={styles.descriptionTitle}>
            Recovery Stage Not Yet Determined
          </ThemedText>
          <ThemedText style={styles.description}>
            Continue your therapeutic conversations to help determine your current stage in the recovery process.
          </ThemedText>
        </View>
      )}
    </View>
  );
};

// Helper function to get typical thoughts for each stage
function getThoughtsForStage(stage: string): string[] {
  switch (stage) {
    case 'precontemplation':
      return [
        "I don't really have a problem.",
        "Others are exaggerating my situation.",
        "I can stop whenever I want to.",
        "People should mind their own business."
      ];
    case 'contemplation':
      return [
        "I might have a problem, but I'm not sure.",
        "Sometimes I think I should cut back.",
        "I'm worried about my habits but afraid of change.",
        "I'm weighing the pros and cons."
      ];
    case 'preparation':
      return [
        "I need to make some changes soon.",
        "I'm gathering information about recovery.",
        "I'm setting a date to start changing.",
        "I'm figuring out my first steps."
      ];
    case 'action':
      return [
        "I'm actively working on my recovery.",
        "I'm learning new coping strategies.",
        "I'm avoiding my triggers.",
        "I'm committed to staying clean/sober."
      ];
    case 'maintenance':
      return [
        "I need to stay vigilant to prevent relapse.",
        "I'm integrating my new behaviors into my lifestyle.",
        "I have more confidence in my ability to stay clean/sober.",
        "I've made positive changes in my life."
      ];
    default:
      return [];
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  stageTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 30,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
  },
  stageCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentIndicator: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  connector: {
    flex: 1,
    height: 3,
  },
  stageLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    marginBottom: 24,
  },
  stageLabel: {
    fontSize: 10,
    textAlign: 'center',
    width: 60,
  },
  descriptionCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    marginBottom: 16,
  },
  behaviorsSection: {
    marginTop: 8,
  },
  behaviorHeader: {
    fontWeight: '600',
    marginBottom: 8,
  },
  behaviorItem: {
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
  behaviorText: {
    flex: 1,
  },
});
