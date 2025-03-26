import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, ActivityIndicator, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { usePathname, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getConversationsOptions, OpenaiService } from '@/src/client/@tanstack/react-query.gen';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaProvider, useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';

// Custom drawer content component to display chat history
function CustomDrawerContent() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  // Fetch conversations using React Query with error handling
  const conversationsOptions = getConversationsOptions();
  const { data: conversations, isLoading, error } = useQuery({
    queryKey: conversationsOptions.queryKey,
    queryFn: conversationsOptions.queryFn,
    staleTime: 1000 * 60, // 1 minute
    retry: 3
  });

  // Handle errors with useEffect
  React.useEffect(() => {
    if (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [error]);

  // Create a new conversation with error handling
  const handleNewConversation = async () => {
    try {
      // Check if we're in development and using localhost
      const baseUrl = Constants.expoConfig?.extra?.API_URL;
      if (!baseUrl && Platform.OS !== 'web') {
        console.warn('API_URL not configured. On physical devices, localhost will not work.');
      }

      const response = await OpenaiService.createConversation({
        body: { title: "New Conversation" }
      });

      if (response.data) {
        router.push({
          pathname: '/(drawer)/(tabs)/chat',
          params: { id: response.data.id }
        });

        // Invalidate and refetch conversations
        queryClient.invalidateQueries({
          queryKey: getConversationsOptions().queryKey
        });
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  // Navigate to a conversation
  const handleConversationPress = (id: string) => {
    router.push({
      pathname: '/(drawer)/(tabs)/chat',
      params: { id }
    });
  };

  // Render each conversation item
  const renderConversationItem = ({ item }: any) => {
    const isActive = pathname.includes(`id=${item.id}`);

    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          isActive && styles.activeConversationItem,
          { backgroundColor: isActive ? (isDarkMode ? '#333' : '#e6e6e6') : 'transparent' }
        ]}
        onPress={() => handleConversationPress(item.id)}
      >
        <Ionicons
          name="chatbubble-outline"
          size={20}
          color={isDarkMode ? '#fff' : '#000'}
          style={styles.conversationIcon}
        />
        <Text
          style={[
            styles.conversationTitle,
            { color: isDarkMode ? '#fff' : '#000' }
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.title || 'New Conversation'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: isDarkMode ? '#121212' : '#f5f5f5',
        // Use the insets from useSafeAreaInsets
        paddingTop: insets.top,
      }
    ]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#fff' : '#000' }]}>Chat History</Text>
        <TouchableOpacity
          style={[styles.newChatButton, { backgroundColor: isDarkMode ? '#333' : '#e6e6e6' }]}
          onPress={handleNewConversation}
        >
          <Ionicons name="add" size={24} color={isDarkMode ? '#fff' : '#000'} />
          <Text style={[styles.newChatText, { color: isDarkMode ? '#fff' : '#000' }]}>New Chat</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#fff' : '#000'} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: isDarkMode ? '#ff6b6b' : '#ff3b30' }]}>
            Error loading conversations
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: isDarkMode ? '#333' : '#e6e6e6' }]}
            onPress={() => {
              queryClient.invalidateQueries({
                queryKey: getConversationsOptions().queryKey
              });
            }}
          >
            <Text style={[styles.retryText, { color: isDarkMode ? '#fff' : '#000' }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: isDarkMode ? '#fff' : '#000' }]}>
                No conversations yet
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

export default function DrawerLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Drawer
          drawerContent={() => <CustomDrawerContent />}
          screenOptions={{
            headerShown: false,
            drawerType: 'front',
            drawerStyle: {
              width: '75%',
            },
            // Add these options to fix the bleeding issue
            drawerStatusBarAnimation: 'fade',
            overlayColor: 'rgba(0,0,0,0.5)',
          }}
        >
          <Drawer.Screen
            name="(tabs)"
            options={{
              drawerLabel: 'Home',
              title: 'Home',
            }}
          />
        </Drawer>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  newChatText: {
    marginLeft: 8,
    fontSize: 16,
  },
  listContainer: {
    paddingVertical: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 8,
    marginVertical: 4,
  },
  activeConversationItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#0084ff',
  },
  conversationIcon: {
    marginRight: 12,
  },
  conversationTitle: {
    fontSize: 16,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
