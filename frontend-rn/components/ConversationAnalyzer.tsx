import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { useAuth } from '../context/authProvider';
import Constants from 'expo-constants';

// Define TypeScript interfaces for our data
interface Message {
  role: string;
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

interface Profile {
  [key: string]: any; // This can be more specific based on your profile structure
}

// Component to analyze the last conversation and extract a profile
const ConversationAnalyzer = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();
  
  // API URL from environment
  const API_URL = Constants.expoConfig?.extra?.API_URL || 'http://localhost:8000';
  
  // Fetch the most recent conversation
  const fetchLastConversation = async (): Promise<Conversation | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/openai/conversations`, {
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch conversations: ${response.status}`);
      }
      
      const conversations = await response.json() as Conversation[];
      
      if (conversations && conversations.length > 0) {
        // Get the most recent conversation
        const lastConversation = conversations[0];
        setConversation(lastConversation);
        return lastConversation;
      } else {
        setError('No conversations found');
        return null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Error: ${errorMessage}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Analyze the conversation using backend endpoint
  const analyzeConversation = async (conversationId: string): Promise<Profile | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/profiles/analyze-full-conversation/${conversationId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to analyze conversation: ${response.status}`);
      }
      
      const profileData = await response.json() as Profile;
      setProfile(profileData);
      return profileData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Error: ${errorMessage}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Analyze conversation to generate a structured profile
  const generateStructuredProfile = async (): Promise<Profile | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/profiles/generate-structured-profile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate profile: ${response.status}`);
      }
      
      const profileData = await response.json() as Profile;
      setProfile(profileData);
      return profileData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Error: ${errorMessage}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Generate profile from conversation
  const generateFromConversations = async (): Promise<Profile | null> => {
    setIsLoading(true);
    setError(null);
    try {
      // Get proper URL based on platform
      // For Android emulator use 10.0.2.2 instead of localhost
      const apiBaseUrl = Platform.OS === 'android' 
        ? 'http://10.0.2.2:8000' 
        : API_URL;
      
      const response = await fetch(`${apiBaseUrl}/api/v1/profiles/generate-from-conversations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate profile: ${response.status}`);
      }
      
      const profileData = await response.json() as Profile;
      setProfile(profileData);
      return profileData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Error: ${errorMessage}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch last conversation and analyze it
  const handleAnalyzeLastConversation = async (): Promise<void> => {
    const lastConversation = await fetchLastConversation();
    if (lastConversation) {
      await analyzeConversation(lastConversation.id);
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleAnalyzeLastConversation}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            Analyze Last Conversation
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={generateStructuredProfile}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            Generate Structured Profile
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={generateFromConversations}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            Generate From All Conversations
          </Text>
        </TouchableOpacity>
      </View>
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      {conversation && !profile && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Last Conversation</Text>
          <Text>ID: {conversation.id}</Text>
          <Text>Title: {conversation.title}</Text>
          <Text>Message count: {conversation.messages.length}</Text>
        </View>
      )}
      
      {profile && (
        <ScrollView style={styles.profileContainer}>
          <Text style={styles.profileTitle}>Profile Analysis</Text>
          <Text style={styles.jsonText}>
            {JSON.stringify(profile, null, 2)}
          </Text>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    padding: 12,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: 'red',
  },
  infoContainer: {
    padding: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  profileContainer: {
    flex: 1,
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  jsonText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
});

export default ConversationAnalyzer;