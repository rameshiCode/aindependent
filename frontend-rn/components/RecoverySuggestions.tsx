// frontend-rn/components/RecoverySuggestions.tsx

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import { UserProfile, UserInsight } from '../hooks/useProfile';

interface RecoverySuggestionsProps {
  profile: UserProfile;
  insights: UserInsight[];
  onCreateGoal?: (goalDescription: string) => void;
}

/**
 * Component that provides personalized recovery suggestions and next steps
 * based on the user's profile and insights
 */
const RecoverySuggestions: React.FC<RecoverySuggestionsProps> = ({
  profile,
  insights,
  onCreateGoal
}) => {
  const tintColor = useThemeColor({}, 'tint');
  const cardBgColor = useThemeColor({}, 'inputBackground');
  const borderColor = useThemeColor({}, 'inputBorder');

  // Group insights by type
  const groupedInsights = React.useMemo(() => {
    const grouped: { [key: string]: UserInsight[] } = {};
    
    if (insights) {
      insights.forEach(insight => {
        if (!grouped[insight.type]) {
          grouped[insight.type] = [];
        }
        grouped[insight.type].push(insight);
      });
    }
    
    return grouped;
  }, [insights]);

  // Generate suggestions based on profile and insights
  const generateSuggestions = () => {
    const suggestions: { title: string; description: string; asGoal?: boolean }[] = [];
    const recoveryStage = profile?.recovery_stage || 'contemplation';
    const triggers = groupedInsights['trigger'] || [];
    
    // Stage-based suggestions
    if (recoveryStage === 'precontemplation') {
      suggestions.push({
        title: 'Learn More',
        description: 'Read about how your behavior might be affecting different areas of your life.',
      });
      suggestions.push({
        title: 'Keep a Journal',
        description: 'Track your behavior patterns and notice any consequences.',
        asGoal: true
      });
    } 
    else if (recoveryStage === 'contemplation') {
      suggestions.push({
        title: 'Pros and Cons List',
        description: 'Write down the benefits of changing versus continuing current behavior.',
        asGoal: true
      });
      suggestions.push({
        title: 'Set Small Goal',
        description: 'Choose one small aspect of your behavior to modify this week.',
        asGoal: true
      });
    }
    else if (recoveryStage === 'preparation') {
      suggestions.push({
        title: 'Create Action Plan',
        description: 'Develop a detailed plan with specific steps for change.',
        asGoal: true
      });
      suggestions.push({
        title: 'Share Your Intention',
        description: 'Tell a supportive friend or family member about your plans.',
        asGoal: true
      });
    }
    else if (recoveryStage === 'action') {
      suggestions.push({
        title: 'Daily Check-ins',
        description: 'Continue using the app daily to reinforce your commitment.',
        asGoal: true
      });
      suggestions.push({
        title: 'Reward Progress',
        description: 'Create small rewards for yourself when you reach milestones.',
        asGoal: true
      });
    }
    else if (recoveryStage === 'maintenance') {
      suggestions.push({
        title: 'Prevent Relapse',
        description: 'Develop long-term strategies for maintaining your progress.',
        asGoal: true
      });
      suggestions.push({
        title: 'Build Support Network',
        description: 'Connect with others who support your recovery journey.',
        asGoal: true
      });
    }
    
    // Trigger-based suggestions
    if (triggers.length > 0) {
      // Get the most recent trigger
      const latestTrigger = triggers[0];
      
      suggestions.push({
        title: 'Avoid Trigger Situation',
        description: `Create a plan to avoid or manage your "${latestTrigger.value}" trigger.`,
        asGoal: true
      });
      
      // If time-based trigger
      if (latestTrigger.day_of_week || latestTrigger.time_of_day) {
        const timeContext = latestTrigger.day_of_week 
          ? latestTrigger.day_of_week.charAt(0).toUpperCase() + latestTrigger.day_of_week.slice(1)
          : latestTrigger.time_of_day;
          
        suggestions.push({
          title: `${timeContext} Plan`,
          description: `Create a specific plan for handling ${timeContext?.toLowerCase() || 'this time'} when you typically experience "${latestTrigger.value}".`,
          asGoal: true
        });
      }
    }
    
    // Motivation-based suggestion
    const motivationLevel = profile?.motivation_level || 5;
    if (motivationLevel < 5) {
      suggestions.push({
        title: 'Explore Your Motivation',
        description: 'Spend some time thinking about your personal reasons for wanting to change.',
      });
    } else if (motivationLevel >= 7) {
      suggestions.push({
        title: 'Leverage Your Motivation',
        description: 'Use your current high motivation to take concrete action steps toward change.',
        asGoal: true
      });
    }
    
    return suggestions;
  };
  
  const suggestions = generateSuggestions();

  // Handle creating a goal from a suggestion
  const handleCreateGoal = (description: string) => {
    if (onCreateGoal) {
      onCreateGoal(description);
    }
  };
  
  if (!profile || !insights) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ThemedText style={styles.title}>
        Next Steps & Suggestions
      </ThemedText>
      
      <ThemedText style={styles.description}>
        Based on your current recovery stage and profile, here are some personalized suggestions:
      </ThemedText>
      
      <View style={styles.suggestionsContainer}>
        {suggestions.map((suggestion, index) => (
          <View 
            key={`suggestion-${index}`}
            style={[
              styles.suggestionCard,
              { backgroundColor: cardBgColor, borderColor }
            ]}
          >
            <ThemedText style={styles.suggestionTitle}>
              {suggestion.title}
            </ThemedText>
            
            <ThemedText style={styles.suggestionDescription}>
              {suggestion.description}
            </ThemedText>
            
            {suggestion.asGoal && (
              <TouchableOpacity
                style={[styles.createGoalButton, { backgroundColor: tintColor }]}
                onPress={() => handleCreateGoal(suggestion.description)}
              >
                <ThemedText style={styles.createGoalText}>
                  Add as Goal
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
    opacity: 0.7,
  },
  suggestionsContainer: {
    gap: 12,
  },
  suggestionCard: {
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  suggestionDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  createGoalButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  createGoalText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 14,
  },
});

export default RecoverySuggestions;