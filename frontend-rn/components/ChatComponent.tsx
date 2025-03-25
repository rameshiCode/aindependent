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
  Text
} from 'react-native';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/authProvider';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const API_URL = 'http://100.78.104.99:8000';

interface Message {
  role: string;
  content: string;
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
}

const ChatComponent: React.FC<ChatComponentProps> = ({
  initialConversation,
  onConversationChange
}) => {
  const [input, setInput] = useState('');
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(initialConversation || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  // Use dark mode by default for ChatGPT style
  const isDark = true;
  const textColor = isDark ? '#fff' : Colors[colorScheme ?? 'light'].text;
  const backgroundColor = isDark ? '#000' : Colors[colorScheme ?? 'light'].background;
  const tintColor = isDark ? '#10a37f' : Colors[colorScheme ?? 'light'].tint; // ChatGPT green
  const bubbleUserColor = isDark ? '#10a37f' : '#2196F3'; // ChatGPT green for user
  const bubbleAssistantColor = isDark ? '#333' : '#f1f1f1'; // Dark gray for assistant

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

  // Fetch conversations
  const { data: conversations, isLoading: isLoadingConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/v1/openai/conversations`, {
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      return response.json();
    },
    enabled: !!session,
  });

  // Create conversation mutation
  const createConversation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/api/v1/openai/conversations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'New Conversation',
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
    mutationFn: async ({ conversationId, message }: { conversationId: string, message: Message }) => {
      const response = await fetch(`${API_URL}/api/v1/openai/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Fetch the updated conversation after sending a message
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
      }
    },
  });

  // Initialize by creating a new conversation if none exists
  useEffect(() => {
    if (!initialConversation && conversations && conversations.length > 0 && !activeConversation) {
      setActiveConversation(conversations[0]);
    } else if (!initialConversation && conversations && conversations.length === 0 && !activeConversation && !isLoadingConversations) {
      createConversation.mutate();
    }
  }, [conversations, isLoadingConversations, initialConversation]);

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
        message: userMessage
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
      <ThemedText style={[
        styles.messageText,
        { color: item.role === 'user' ? '#fff' : textColor }
      ]}>
        {item.content}
      </ThemedText>
    </View>
  );

  // Render empty state with welcome message
  const renderEmptyChat = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>ChatGPT</Text>

      <View style={styles.suggestionContainer}>
        <TouchableOpacity style={styles.suggestionButton}>
          <Ionicons name="image-outline" size={24} color="#10a37f" />
          <Text style={styles.suggestionText}>Create image</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.suggestionButton}>
          <Ionicons name="gift-outline" size={24} color="#10a37f" />
          <Text style={styles.suggestionText}>Surprise me</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.suggestionButton}>
          <Ionicons name="analytics-outline" size={24} color="#10a37f" />
          <Text style={styles.suggestionText}>Analyze data</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.suggestionButton}>
          <Ionicons name="ellipsis-horizontal-outline" size={24} color="#10a37f" />
          <Text style={styles.suggestionText}>More</Text>
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
              placeholder="Message ChatGPT"
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
            ChatGPT can make mistakes. Verify important information.
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
});

export default ChatComponent;
