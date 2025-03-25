// components/CustomDrawerContent.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getConversationsOptions } from '@/src/client/@tanstack/react-query.gen';

interface Conversation {
  id: string;
  title: string;
}

interface Project {
  id: string;
  title: string;
}

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const currentPath = usePathname();

  // Use React Query to fetch conversations
  const { data: conversations, isLoading, error } = useQuery({
    ...getConversationsOptions(),
    staleTime: 1000 * 60, // 1 minute
  });

  // For projects (mock data for now)
  useEffect(() => {
    fetchProjects().then(data => setProjects(data));
  }, []);

  const navigateToChat = (chatId: string) => {
    router.push({
      pathname: '/(drawer)/(tabs)/chat',
      params: { id: chatId }
    });
    props.navigation.closeDrawer();
  };

  const createNewChat = () => {
    router.push('/(drawer)/(tabs)');
    props.navigation.closeDrawer();
  };

  return (
    <DrawerContentScrollView
      {...props}
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? '#1e1e1e' : '#fff' }
      ]}
    >
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: isDarkMode ? '#2d2d2d' : '#f0f0f0' }]}>
        <Ionicons name="search" size={20} color={isDarkMode ? '#888' : '#666'} />
        <Text style={[styles.searchPlaceholder, { color: isDarkMode ? '#888' : '#666' }]}>Search</Text>
      </View>

      {/* ChatGPT Section */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[
            styles.item,
            currentPath === '/(drawer)/(tabs)' && styles.activeItem
          ]}
          onPress={createNewChat}
        >
          <Ionicons
            name="chatbubble-outline"
            size={20}
            color={isDarkMode ? '#fff' : '#000'}
            style={styles.icon}
          />
          <Text style={[styles.itemText, { color: isDarkMode ? '#fff' : '#000' }]}>New Chat</Text>
        </TouchableOpacity>
      </View>

      {/* Projects Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#888' : '#666' }]}>Projects</Text>
          <TouchableOpacity>
            <Text style={[styles.addButton, { color: isDarkMode ? '#fff' : '#000' }]}>+</Text>
          </TouchableOpacity>
        </View>

        {projects.map((project, index) => (
          <TouchableOpacity key={index} style={styles.item}>
            <Ionicons
              name="folder-outline"
              size={20}
              color={isDarkMode ? '#fff' : '#000'}
              style={styles.icon}
            />
            <Text style={[styles.itemText, { color: isDarkMode ? '#fff' : '#000' }]}>{project.title}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.item}>
          <Ionicons
            name="list-outline"
            size={20}
            color={isDarkMode ? '#fff' : '#000'}
            style={styles.icon}
          />
          <Text style={[styles.itemText, { color: isDarkMode ? '#fff' : '#000' }]}>All projects</Text>
        </TouchableOpacity>
      </View>

      {/* Chats Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#888' : '#666' }]}>Chats</Text>

        {isLoading ? (
          <Text style={[styles.loadingText, { color: isDarkMode ? '#888' : '#666' }]}>Loading chats...</Text>
        ) : error ? (
          <Text style={[styles.errorText, { color: isDarkMode ? '#ff6b6b' : '#ff3b30' }]}>
            Error loading chats
          </Text>
        ) : conversations && conversations.length > 0 ? (
          conversations.map((chat, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.item,
                currentPath.includes(`chat?id=${chat.id}`) && styles.activeItem
              ]}
              onPress={() => navigateToChat(chat.id)}
            >
              <Ionicons
                name="chatbubble-outline"
                size={20}
                color={isDarkMode ? '#fff' : '#000'}
                style={styles.icon}
              />
              <Text
                style={[styles.itemText, { color: isDarkMode ? '#fff' : '#000' }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {chat.title}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: isDarkMode ? '#888' : '#666' }]}>No conversations found</Text>
        )}
      </View>

      {/* User Section */}
      <View style={[styles.userSection, { borderTopColor: isDarkMode ? '#333' : '#ddd' }]}>
        <TouchableOpacity
          style={styles.userButton}
          onPress={() => {
            router.push('/(drawer)/(tabs)/profile');
            props.navigation.closeDrawer();
          }}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>CA</Text>
          </View>
          <Text style={[styles.userName, { color: isDarkMode ? '#fff' : '#000' }]}>Your Username</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    borderRadius: 20,
    padding: 10,
    margin: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchPlaceholder: {
    marginLeft: 10,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 10,
  },
  addButton: {
    fontSize: 24,
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeItem: {
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
  icon: {
    marginRight: 10,
  },
  itemText: {
    fontSize: 16,
    flex: 1, // Allow text to shrink
  },
  loadingText: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontStyle: 'italic',
  },
  errorText: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontStyle: 'italic',
  },
  emptyText: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontStyle: 'italic',
  },
  userSection: {
    marginTop: 'auto',
    padding: 10,
    borderTopWidth: 1,
  },
  userButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0a500',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 16,
    marginLeft: 10,
  },
});

// Mock function for projects (since you don't have a projects endpoint yet)
async function fetchProjects(): Promise<Project[]> {
  return [
    { id: '1', title: 'CCP' },
    { id: '2', title: 'fullstack project' },
  ];
}
