// app/(drawer)/(tabs)/chat.tsx
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getConversationOptions, getConversationsOptions, OpenaiService } from '@/src/client/@tanstack/react-query.gen';
import ChatHeader from '../../../components/ChatHeader';
import { ConversationWithMessages } from '@/src/client';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface Message {
  role: string;
  content: string;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const [inputText, setInputText] = useState<string>('');
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // Use React Query to fetch conversation data
  const {
    data: chatData,
    isLoading,
    error
  } = useQuery({
    ...getConversationOptions({
      path: { conversation_id: id as string }
    }),
    enabled: !!id,
    staleTime: 1000 * 60, // 1 minute
  });

  // Mutation for deleting a conversation
  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await OpenaiService.deleteConversation({
        path: { conversation_id: conversationId }
      });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch conversations
      queryClient.invalidateQueries({
        queryKey: getConversationsOptions().queryKey
      });
    },
    onError: (error) => {
      console.error('Failed to delete conversation:', error);
    }
  });

  // Mutation for updating conversation title
  const updateConversationTitleMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const response = await OpenaiService.updateConversation({
        path: { conversation_id: id },
        query: { title }
      });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch conversations
      queryClient.invalidateQueries({
        queryKey: getConversationsOptions().queryKey
      });
    },
    onError: (error) => {
      console.error('Failed to update conversation title:', error);
    }
  });

  // Use React Query mutation for sending messages
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data } = await OpenaiService.createMessage({
        path: { conversation_id: id as string },
        body: { role: 'user', content }
      });
      return data;
    },
    onSuccess: (data) => {
      // Invalidate and refetch the conversation to get the updated messages
      queryClient.invalidateQueries({
        queryKey: getConversationOptions({
          path: { conversation_id: id as string }
        }).queryKey
      });

      // If this is the first message, generate a title based on the content
      if (chatData && chatData.messages && chatData.messages.length === 0) {
        generateTitleFromContent(inputText);
      }
    }
  });

  // Mutation for creating a new conversation
  const createConversationMutation = useMutation<ConversationWithMessages, Error>({
    mutationFn: async () => {
      const response = await OpenaiService.createConversation({
        body: { title: "New Conversation" }
      });
      if (!response.data) {
        throw new Error('No data returned from API');
      }
      return response.data;
    },
    onSuccess: (data) => {
      router.push({
        pathname: '/(drawer)/(tabs)/chat',
        params: { id: data.id }
      });
      queryClient.invalidateQueries({
        queryKey: getConversationsOptions().queryKey
      });
    },
    onError: (error) => {
      console.error('Failed to create conversation:', error);
    }
  });

  // Function to generate a title from the first message content
  const generateTitleFromContent = async (content: string) => {
    if (!id || !content) return;

    try {
      // Generate a title based on the first message
      // This is a simple implementation - you could use AI to generate a more meaningful title
      let title = content.substring(0, 30);
      if (content.length > 30) title += '...';

      // Update the conversation title
      updateConversationTitleMutation.mutate({ id: id as string, title });
    } catch (error) {
      console.error('Error generating title:', error);
    }
  };

  // Auto-delete functionality has been removed

  const handleSendMessage = async () => {
    if (!inputText.trim() || !id) return;

    try {
      await sendMessageMutation.mutateAsync(inputText);
      setInputText('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageBubble,
      item.role === 'user' ? styles.userBubble :
      item.role === 'system' ? styles.systemBubble : styles.assistantBubble
    ]}>
      <Text style={[
        styles.messageText,
        item.role === 'system' && styles.systemText
      ]}>{item.content}</Text>
    </View>
  );

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: isDarkMode ? '#000' : '#fff',
        }
      ]}
    >
      {/* Hide the default Stack header */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header with three dots */}
      <ChatHeader
        title={chatData?.title || 'Chat'}
        onNewChat={() => createConversationMutation.mutate()}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#fff' : '#000'} />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#fff' : '#000' }]}>Loading chat...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: isDarkMode ? '#ff6b6b' : '#ff3b30' }]}>
            Error loading chat
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }]}
            onPress={() => {
              queryClient.invalidateQueries({
                queryKey: getConversationOptions({
                  path: { conversation_id: id as string }
                }).queryKey
              });
            }}
          >
            <Text style={[styles.retryText, { color: isDarkMode ? '#fff' : '#000' }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : id && chatData ? (
        <>
          <FlatList
            data={chatData.messages}
            renderItem={renderMessage}
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={styles.chatContainer}
          />
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: isDarkMode ? '#fff' : '#000' }]}>
            Select a chat from the sidebar or start a new conversation
          </Text>
          <TouchableOpacity
            style={[styles.newChatButton, { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }]}
            onPress={() => {
              // Create a new conversation
              createConversationMutation.mutate();
            }}
            disabled={createConversationMutation.isPending}
          >
            {createConversationMutation.isPending ? (
              <ActivityIndicator size="small" color={isDarkMode ? '#fff' : '#000'} />
            ) : (
              <>
                <Ionicons name="add" size={24} color={isDarkMode ? '#fff' : '#000'} />
                <Text style={[styles.newChatText, { color: isDarkMode ? '#fff' : '#000' }]}>
                  New Conversation
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {id && (
        <View style={[
          styles.inputContainer,
          { paddingBottom: Math.max(10, insets.bottom) }
        ]}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDarkMode ? '#1e1e1e' : '#f0f0f0',
                color: isDarkMode ? '#fff' : '#000'
              }
            ]}
            placeholder="Message ChatGPT"
            placeholderTextColor={isDarkMode ? '#888' : '#666'}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSendMessage}
            editable={!sendMessageMutation.isPending}
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || !id || sendMessageMutation.isPending}
          >
            {sendMessageMutation.isPending ? (
              <ActivityIndicator size="small" color="#0084ff" />
            ) : (
              <Ionicons
                name="send"
                size={24}
                color={!inputText.trim() || !id ? '#888' : '#0084ff'}
              />
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

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
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    padding: 12,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  newChatText: {
    fontSize: 16,
    marginLeft: 10,
  },
  chatContainer: {
    padding: 10,
  },
  messageBubble: {
    padding: 15,
    borderRadius: 20,
    maxWidth: '80%',
    marginBottom: 15,
  },
  userBubble: {
    backgroundColor: '#0084ff',
    alignSelf: 'flex-end',
  },
  assistantBubble: {
    backgroundColor: '#343541',
    alignSelf: 'flex-start',
  },
  systemBubble: {
    backgroundColor: '#ff3b30',
    alignSelf: 'center',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  systemText: {
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: 15,
    borderRadius: 25,
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 10,
    padding: 5,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
