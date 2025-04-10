import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  Animated,
  Easing
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/authProvider';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

// Debug API configuration
const API_URL = Constants.expoConfig?.extra?.API_URL || 'http://localhost:8000';
console.log('=== CHAT COMPONENT API CONFIG ===');
console.log('API_URL from app.config:', Constants.expoConfig?.extra?.API_URL);
console.log('Using API URL:', API_URL);
console.log('All extra config:', JSON.stringify(Constants.expoConfig?.extra));
console.log('================================');

interface Message {
  role: string;
  content: string;
  metadata?: {
    stage?: string;
    summary_style?: boolean;
    [key: string]: any;
  };
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
}

interface ChatComponentProps {
  initialConversation?: Conversation | null;
  onConversationChange?: (conversation: Conversation | null) => void;
  forceNewConversation?: boolean;
  showMIStages?: boolean;
}

const ChatComponent: React.FC<ChatComponentProps> = ({
  initialConversation,
  onConversationChange,
  forceNewConversation,
  showMIStages = true
}) => {
  const [input, setInput] = useState('');
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(initialConversation || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [miStage, setMiStage] = useState<string | null>(null);
  const [animatedStageValue] = useState(new Animated.Value(0));
  const flatListRef = useRef<FlatList>(null);
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  const miProgressSteps = ["engaging", "focusing", "evoking", "planning"];

  // Use dark mode by default for ChatGPT style
  const isDark = true;
  const textColor = isDark ? '#fff' : Colors[colorScheme ?? 'light'].text;
  const backgroundColor = isDark ? '#000' : Colors[colorScheme ?? 'light'].background;
  const tintColor = isDark ? '#10a37f' : Colors[colorScheme ?? 'light'].tint; // ChatGPT green
  const bubbleUserColor = isDark ? '#10a37f' : '#2196F3'; // ChatGPT green for user
  const bubbleAssistantColor = isDark ? '#333' : '#f1f1f1'; // Dark gray for assistant

  // Fetch conversations
  const { data: conversations, isLoading: isLoadingConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      console.log('Fetching conversations with session token:', session ? `${session.substring(0, 10)}...` : 'none');

      try {
        const response = await fetch(`${API_URL}/api/v1/openai/conversations`, {
          headers: {
            'Authorization': `Bearer ${session}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('Conversations API response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API error response:', errorText);
          throw new Error(`Failed to fetch conversations: ${errorText}`);
        }

        const data = await response.json();
        console.log('Received conversations:', data.length);
        return data;
      } catch (error) {
        console.error('Error in conversations fetch:', error);
        throw error;
      }
    },
    enabled: !!session,
  });

  // Create conversation mutation
  const createConversation = useMutation({
    mutationFn: async (title: string = 'New Conversation') => {
      const response = await fetch(`${API_URL}/api/v1/openai/conversations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setActiveConversation(data);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string, content: string }) => {
      const message = {
        role: "user",
        content,
      };

      const response = await fetch(`${API_URL}/api/v1/openai/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send message: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', activeConversation?.id] });

      // Add the assistant's response to the UI
      if (activeConversation) {
        setActiveConversation(prev => {
          if (!prev) return null;
          return {
            ...prev,
            messages: [...prev.messages, data],
          };
        });
        
        // Update MI stage if available in response metadata
        if (data.metadata?.stage) {
          setMiStage(data.metadata.stage);
          
          // Animate the progress indicator
          const targetValue = miProgressSteps.indexOf(data.metadata.stage) / (miProgressSteps.length - 1);
          Animated.timing(animatedStageValue, {
            toValue: targetValue,
            duration: 500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false
          }).start();
        }
      }
    },
  });

  // Update active conversation when initialConversation prop changes
  useEffect(() => {
    if (initialConversation) {
      setActiveConversation(initialConversation);
    }
  }, [initialConversation]);

  // Notify parent about conversation changes
  useEffect(() => {
    if (onConversationChange && activeConversation) {
      onConversationChange(activeConversation);
    }
  }, [activeConversation, onConversationChange]);

  // Check if user is authenticated
  useEffect(() => {
    if (!session) {
      router.replace('/(auth)/sign-in');
    }
  }, [session]);

  // Initialize by creating a new conversation if none exists
  useEffect(() => {
    if (forceNewConversation) {
      createConversation.mutate('New Conversation');
    } else if (conversations && conversations.length > 0 && !activeConversation) {
      setActiveConversation(conversations[0]);
    } else if (conversations && conversations.length === 0 && !activeConversation && !isLoadingConversations) {
      createConversation.mutate('New Conversation');
    }
  }, [conversations, isLoadingConversations, initialConversation, forceNewConversation]);

  // Extract current MI stage from conversation
  useEffect(() => {
    if (activeConversation && activeConversation.messages.length > 0) {
      // Look for the most recent assistant message with stage metadata
      for (let i = activeConversation.messages.length - 1; i >= 0; i--) {
        const message = activeConversation.messages[i];
        if (message.role === 'assistant' && message.metadata?.stage) {
          setMiStage(message.metadata.stage);
          
          // Set animated value based on stage
          const stageIndex = miProgressSteps.indexOf(message.metadata.stage);
          if (stageIndex !== -1) {
            animatedStageValue.setValue(stageIndex / (miProgressSteps.length - 1));
          }
          
          break;
        }
      }
    }
  }, [activeConversation]);

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!input.trim() || !activeConversation) return;

    try {
      setLoading(true);
      setError(null);

      // Optimize UI by showing message immediately
      const userMessage = {
        role: "user",
        content: input
      };

      // Update UI immediately to show user message
      setActiveConversation(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...prev.messages, userMessage]
        };
      });

      // Clear input
      setInput('');

      // Send to API
      await sendMessage.mutateAsync({
        conversationId: activeConversation.id,
        content: input
      });

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (e: any) {
      console.error('Error sending message:', e);
      setError(`Failed to send message: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Render a message
  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageBubble,
      item.role === 'user'
        ? [styles.userMessage, { backgroundColor: bubbleUserColor }]
        : [styles.assistantMessage, { backgroundColor: bubbleAssistantColor }]
    ]}>
      {item.metadata?.stage && showMIStages && (
        <View style={styles.metadataContainer}>
          <Text style={styles.metadataText}>
            {item.metadata.stage.charAt(0).toUpperCase() + item.metadata.stage.slice(1)} Stage
          </Text>
        </View>
      )}
      <Text style={[
        styles.messageText,
        { color: item.role === 'user' ? '#fff' : textColor }
      ]}>
        {item.content}
      </Text>
    </View>
  );

  // Render the MI progress indicator
  const renderMIProgressIndicator = () => {
    if (!showMIStages || !miStage) return null;
    
    return (
      <View style={styles.miProgressContainer}>
        <Text style={styles.miProgressTitle}>Therapy Progress</Text>
        
        <View style={styles.progressBarContainer}>
          <Animated.View 
            style={[
              styles.progressBarFill,
              {
                width: animatedStageValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%']
                })
              }
            ]} 
          />
          
          <View style={styles.stageMarkersContainer}>
            {miProgressSteps.map((stage, index) => (
              <View 
                key={stage}
                style={[
                  styles.stageMarker,
                  miStage === stage && styles.activeStageMarker,
                  miProgressSteps.indexOf(miStage || '') > index && styles.completedStageMarker
                ]}
              >
                <Text style={styles.stageMarkerText}>{index + 1}</Text>
              </View>
            ))}
          </View>
        </View>
        
        <View style={styles.stageLabelsContainer}>
          {miProgressSteps.map((stage) => (
            <Text 
              key={stage}
              style={[
                styles.stageLabel,
                miStage === stage && styles.activeStageLabel
              ]}
            >
              {stage.charAt(0).toUpperCase() + stage.slice(1)}
            </Text>
          ))}
        </View>
        
        <Text style={styles.stageDescription}>
          {miStage === 'engaging' && "Building rapport and understanding your situation"}
          {miStage === 'focusing' && "Identifying specific behaviors and aspects to change"}
          {miStage === 'evoking' && "Exploring your motivations and reasons for change"}
          {miStage === 'planning' && "Developing a concrete plan for making changes"}
        </Text>
      </View>
    );
  };

  // Render empty state with welcome message
  const renderEmptyChat = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>Recovery Assistant</Text>

      <View style={styles.suggestionContainer}>
        <TouchableOpacity style={styles.suggestionButton}>
          <Ionicons name="chatbubble-outline" size={24} color="#10a37f" />
          <Text style={styles.suggestionText}>Discuss your recovery goals</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.suggestionButton}>
          <Ionicons name="pulse-outline" size={24} color="#10a37f" />
          <Text style={styles.suggestionText}>Talk about triggers</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.suggestionButton}>
          <Ionicons name="heart-outline" size={24} color="#10a37f" />
          <Text style={styles.suggestionText}>Get support for urges</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.suggestionButton}>
          <Ionicons name="star-outline" size={24} color="#10a37f" />
          <Text style={styles.suggestionText}>Celebrate milestones</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoadingConversations) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
        <Text style={[styles.loadingText, { color: textColor }]}>Loading conversations...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor }]}
      keyboardVerticalOffset={100}
    >
      <View style={styles.container}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {showMIStages && miStage && renderMIProgressIndicator()}

        {activeConversation ? (
          activeConversation.messages.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={activeConversation.messages}
              renderItem={renderMessage}
              keyExtractor={(_, index) => `msg-${index}`}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              onLayout={() => {
                if (activeConversation.messages.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }
              }}
            />
          ) : renderEmptyChat()
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={tintColor} />
            <Text style={[styles.loadingText, { color: textColor }]}>Creating a new conversation...</Text>
          </View>
        )}

        {/* ChatGPT style input bar */}
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, { color: textColor }]}
              value={input}
              onChangeText={setInput}
              placeholder="Message your recovery assistant..."
              placeholderTextColor="#999"
              multiline
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                (!input.trim() || loading) && styles.sendButtonDisabled
              ]}
              disabled={!input.trim() || loading}
              onPress={handleSendMessage}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name="paper-plane"
                  size={18}
                  color={!input.trim() ? '#555' : '#fff'}
                />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimer}>
            This AI assistant is designed to support your recovery journey using Motivational Interviewing techniques.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    padding: 12,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    textAlign: 'center',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    marginVertical: 6,
    maxWidth: '95%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    borderTopRightRadius: 2,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    borderTopLeftRadius: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  metadataContainer: {
    alignSelf: 'flex-start',
    marginBottom: 4,
    backgroundColor: 'rgba(16, 163, 127, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  metadataText: {
    fontSize: 10,
    color: '#10a37f',
  },
  inputContainer: {
    paddingTop: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 40,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10a37f',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: 4,
  },
  sendButtonPressed: {
    opacity: 0.8,
  },
  sendButtonDisabled: {
    backgroundColor: '#333',
  },
  disclaimer: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 40,
  },
  suggestionContainer: {
    width: '100%',
    maxWidth: 400,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  suggestionButton: {
    width: '45%',
    backgroundColor: '#222',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#444',
    padding: 16,
    margin: 8,
    alignItems: 'center',
  },
  suggestionText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 16,
  },
  // MI progress styles
  miProgressContainer: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  miProgressTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    marginVertical: 16,
    position: 'relative',
  },
  progressBarFill: {
    position: 'absolute',
    height: '100%',
    left: 0,
    backgroundColor: '#10a37f',
    borderRadius: 4,
  },
  stageMarkersContainer: {
    position: 'absolute',
    top: -8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  stageMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  activeStageMarker: {
    backgroundColor: '#10a37f',
  },
  completedStageMarker: {
    backgroundColor: '#10a37f',
  },
  stageMarkerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stageLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stageLabel: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    width: '25%',
  },
  activeStageLabel: {
    color: '#10a37f',
    fontWeight: 'bold',
  },
  stageDescription: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ChatComponent;