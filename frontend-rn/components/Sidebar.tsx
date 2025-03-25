import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/authProvider';
import { router } from 'expo-router';

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

interface SidebarProps {
  onSelectConversation: (conversation: Conversation) => void;
  onCreateNewChat: () => void;
  activeConversationId?: string;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  onSelectConversation,
  onCreateNewChat,
  activeConversationId,
  onClose
}) => {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch conversations
  const { data: conversations, isLoading } = useQuery({
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

  // Create a new conversation
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
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      onSelectConversation(data);
    },
  });

  // Handle creating a new chat
  const handleNewChat = () => {
    createConversation.mutate();
    onCreateNewChat();
  };

  // Filter conversations based on search query
  const filteredConversations = conversations?.filter(
    (conversation: Conversation) =>
      conversation.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get conversation title
  const getConversationTitle = (conversation: Conversation) => {
    // If the title is "New Conversation" and there are messages, use the first message content as title
    if (conversation.title === "New Conversation" && conversation.messages.length > 0) {
      // Get first user message
      const firstUserMessage = conversation.messages.find(msg => msg.role === "user");
      if (firstUserMessage) {
        // Truncate message if it's too long
        const content = firstUserMessage.content;
        return content.length > 25 ? content.substring(0, 25) + '...' : content;
      }
    }
    return conversation.title;
  };

  return (
    <View style={[
      styles.sidebar,
      {
        paddingTop: insets.top > 0 ? insets.top : 20,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 20
      }
    ]}>
      {/* Header with search */}
      <View style={styles.sidebarHeader}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* New Chat Button */}
      <TouchableOpacity
        style={styles.newChatButton}
        onPress={handleNewChat}
      >
        <Ionicons name="add" size={20} color="#FFF" />
        <Text style={styles.newChatText}>New chat</Text>
      </TouchableOpacity>

      {/* Chats List */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>Chats</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#10a37f" />
        </View>
      ) : (
        <ScrollView style={styles.conversationsList}>
          {filteredConversations?.map((conversation: Conversation) => (
            <TouchableOpacity
              key={conversation.id}
              style={[
                styles.conversationItem,
                activeConversationId === conversation.id && styles.activeConversation
              ]}
              onPress={() => onSelectConversation(conversation)}
            >
              <Ionicons name="chatbubble-outline" size={18} color="#CCC" />
              <View style={styles.conversationDetails}>
                <Text style={styles.conversationTitle} numberOfLines={1}>
                  {getConversationTitle(conversation)}
                </Text>
                <Text style={styles.conversationDate}>
                  {formatDate(conversation.updated_at)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {filteredConversations?.length === 0 && (
            <Text style={styles.emptyMessage}>No conversations found</Text>
          )}
        </ScrollView>
      )}

      {/* User Profile at bottom */}
      <View style={styles.userProfile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>CA</Text>
        </View>
        <Text style={styles.username}>User</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: '80%',
    maxWidth: 350,
    height: '100%',
    backgroundColor: '#202123',
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 999,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  closeButton: {
    padding: 5,
    marginRight: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#3a3a3c',
    borderRadius: 20,
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    height: 40,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a3a3c',
    marginHorizontal: 15,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  newChatText: {
    color: '#fff',
    marginLeft: 10,
    fontSize: 16,
  },
  listHeader: {
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  listHeaderText: {
    color: '#999',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  activeConversation: {
    backgroundColor: '#343541',
    borderLeftColor: '#10a37f',
  },
  conversationDetails: {
    flex: 1,
    marginLeft: 12,
  },
  conversationTitle: {
    color: '#fff',
    fontSize: 14,
  },
  conversationDate: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyMessage: {
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
    padding: 20,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#3a3a3c',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f39c12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  username: {
    color: '#fff',
    marginLeft: 10,
    fontSize: 16,
  },
});

export default Sidebar;
