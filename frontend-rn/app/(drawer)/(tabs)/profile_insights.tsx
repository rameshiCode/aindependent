// In frontend-rn/app/(drawer)/(tabs)/profile_insights.tsx
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { ThemedText } from '../../../components/ThemedText';
import { useAuth } from '../../../context/authProvider';
import { Stack } from 'expo-router';
import { useProfile } from '../../../hooks/useProfile';
import { useThemeColor } from '../../../hooks/useThemeColor';
import EnhancedProfileDashboard from '../../../components/UserProfileDashboard';

export default function ProfileInsightsScreen() {
  const { currentUser } = useAuth();
  const userId = currentUser?.id;
  const { processAllConversations, isLoadingProfile } = useProfile();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const tintColor = useThemeColor({}, 'tint');
  const cardBgColor = useThemeColor({}, 'inputBackground');
  const borderColor = useThemeColor({}, 'inputBorder');

  // Handle processing all conversations
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
              setIsProcessing(true);
              await processAllConversations();
              Alert.alert('Success', 'All conversations processed successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to process conversations. Please try again.');
            } finally {
              setIsProcessing(false);
            }
          }
        }
      ]
    );
  };

  if (!userId) {
    return (
      <View style={styles.container}>
        <ThemedText>User not authenticated. Please log in.</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: "Your Recovery Profile", 
        headerTitleStyle: { fontWeight: 'bold' },
      }} />
      
      {/* Process Conversations Button */}
      <View style={[styles.toolsCard, { backgroundColor: cardBgColor, borderColor }]}>
        <ThemedText style={styles.toolsTitle}>Profile Tools</ThemedText>
        <View style={styles.toolsButtonContainer}>
          <TouchableOpacity
            style={[styles.toolsButton, { backgroundColor: tintColor }]}
            onPress={handleProcessConversations}
            disabled={isProcessing || isLoadingProfile}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <ThemedText style={styles.toolsButtonText}>Process All Conversations</ThemedText>
            )}
          </TouchableOpacity>
        </View>
        <ThemedText style={styles.toolsDescription}>
          Process all your conversations to build a more comprehensive profile based on your chat history.
        </ThemedText>
      </View>
      
      {/* Enhanced Profile Dashboard - Replace UserProfileDashboard with this */}
      <EnhancedProfileDashboard userId={userId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolsCard: {
    margin: 16,
    marginBottom: 8,
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
    marginBottom: 8,
  },
  toolsButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  toolsButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  toolsDescription: {
    fontSize: 12,
    opacity: 0.7,
  },
});