import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { useNavigation, router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getConversationsOptions, OpenaiService } from '@/src/client/@tanstack/react-query.gen';

interface ChatHeaderProps {
  title: string;
  onNewChat: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ title, onNewChat }) => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [menuVisible, setMenuVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const { id } = useLocalSearchParams();

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
      // Navigate to home or create a new conversation
      router.push({
        pathname: '/(drawer)/(tabs)/chat',
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
      setRenameModalVisible(false);
    },
    onError: (error) => {
      console.error('Failed to update conversation title:', error);
    }
  });

  const handleRename = () => {
    if (id && newTitle.trim()) {
      updateConversationTitleMutation.mutate({
        id: id as string,
        title: newTitle.trim()
      });
    }
  };

  const handleDelete = () => {
    if (id) {
      deleteConversationMutation.mutate(id as string);
    }
    setMenuVisible(false);
  };

  return (
    <View style={[
      styles.header,
      { backgroundColor: isDarkMode ? '#000' : '#fff' }
    ]}>
      {/* Hamburger menu on left */}
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => {
          // @ts-ignore - navigation.openDrawer() exists on drawer navigation
          navigation.openDrawer();
        }}
      >
        <Ionicons
          name="menu"
          size={24}
          color={isDarkMode ? '#fff' : '#000'}
        />
      </TouchableOpacity>

      {/* Title */}
      <Text
        style={[
          styles.title,
          { color: isDarkMode ? '#fff' : '#000' }
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {title}
      </Text>

      <View style={styles.rightButtons}>
        {/* New conversation button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onNewChat}
        >
          <Ionicons
            name="add"
            size={24}
            color={isDarkMode ? '#fff' : '#000'}
          />
        </TouchableOpacity>

        {/* Three dots menu */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setMenuVisible(true)}
        >
          <Ionicons
            name="ellipsis-vertical"
            size={24}
            color={isDarkMode ? '#fff' : '#000'}
          />
        </TouchableOpacity>
      </View>

      {/* Three dots menu modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={[
            styles.menuContainer,
            { backgroundColor: isDarkMode ? '#333' : '#fff' }
          ]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setRenameModalVisible(true);
              }}
            >
              <Ionicons
                name="pencil"
                size={20}
                color={isDarkMode ? '#fff' : '#000'}
                style={styles.menuIcon}
              />
              <Text style={{ color: isDarkMode ? '#fff' : '#000' }}>Rename</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDelete}
            >
              <Ionicons
                name="trash"
                size={20}
                color={isDarkMode ? '#ff6b6b' : '#ff3b30'}
                style={styles.menuIcon}
              />
              <Text style={{ color: isDarkMode ? '#ff6b6b' : '#ff3b30' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Rename modal */}
      <Modal
        visible={renameModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setRenameModalVisible(false)}
        >
          <View style={[
            styles.renameContainer,
            { backgroundColor: isDarkMode ? '#333' : '#fff' }
          ]}>
            <Text style={[
              styles.renameTitle,
              { color: isDarkMode ? '#fff' : '#000' }
            ]}>
              Rename conversation
            </Text>

            <TextInput
              style={[
                styles.renameInput,
                {
                  backgroundColor: isDarkMode ? '#1e1e1e' : '#f0f0f0',
                  color: isDarkMode ? '#fff' : '#000'
                }
              ]}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />

            <View style={styles.renameButtons}>
              <TouchableOpacity
                style={[
                  styles.renameButton,
                  { backgroundColor: isDarkMode ? '#1e1e1e' : '#f0f0f0' }
                ]}
                onPress={() => setRenameModalVisible(false)}
              >
                <Text style={{ color: isDarkMode ? '#fff' : '#000' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.renameButton,
                  { backgroundColor: '#0084ff' }
                ]}
                onPress={handleRename}
              >
                <Text style={{ color: '#fff' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  menuButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 12,
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuContainer: {
    width: 200,
    marginTop: 60,
    marginRight: 20,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuIcon: {
    marginRight: 12,
  },
  renameContainer: {
    width: '80%',
    alignSelf: 'center',
    marginTop: '40%',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  renameTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  renameInput: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  renameButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  renameButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 12,
  },
});

export default ChatHeader;
