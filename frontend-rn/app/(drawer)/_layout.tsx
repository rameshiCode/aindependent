import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, ActivityIndicator, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { usePathname, router, useNavigation } from 'expo-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getConversationsOptions, getConversationOptions, OpenaiService } from '@/src/client/@tanstack/react-query.gen';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaProvider, useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';

// Custom drawer content component to display chat history and navigation
function CustomDrawerContent() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // Fetch conversations using React Query with error handling
  const { data: conversations, isLoading, error } = useQuery({
    ...getConversationsOptions(),
    staleTime: 1000 * 60, // 1 minute
    retry: 3
  });

  // Handle errors from the query
  useEffect(() => {
    if (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [error]);

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
    // Check if we're navigating away from an empty conversation
    const currentConversationId = pathname.includes('id=')
      ? pathname.split('id=')[1].split('&')[0]
      : null;

    if (currentConversationId) {
      // Check if the current conversation is empty
      const conversationData = queryClient.getQueryData(
        getConversationOptions({ path: { conversation_id: currentConversationId } }).queryKey
      );

      if (conversationData && conversationData.messages && conversationData.messages.length === 0) {
        // Delete the empty conversation
        deleteConversationMutation.mutate(currentConversationId);
      }
    }

    router.push({
      pathname: '/(drawer)/(tabs)/chat',
      params: { id }
    });
  };

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: isDarkMode ? '#121212' : '#f5f5f5',
        paddingTop: insets.top,
      }
    ]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#fff' : '#000' }]}>AIndependent</Text>

        {/* Main Navigation Links */}
        <View style={styles.navigationContainer}>
          {/* Profile Link */}
          <TouchableOpacity
            style={[
              styles.navigationButton,
              pathname.includes('/user-profile') && styles.activeNavigationButton
            ]}
            onPress={() => router.push('/(drawer)/(tabs)/user-profile')}
          >
            <Ionicons name="person" size={20} color={isDarkMode ? '#fff' : '#000'} />
            <Text style={[styles.navigationText, { color: isDarkMode ? '#fff' : '#000' }]}>
              Your Profile
            </Text>
          </TouchableOpacity>

          {/* Home Link */}
          <TouchableOpacity
            style={[
              styles.navigationButton,
              pathname === '/(drawer)/(tabs)/index' && styles.activeNavigationButton
            ]}
            onPress={() => router.push('/(drawer)/(tabs)')}
          >
            <Ionicons name="home" size={20} color={isDarkMode ? '#fff' : '#000'} />
            <Text style={[styles.navigationText, { color: isDarkMode ? '#fff' : '#000' }]}>
              Home
            </Text>
          </TouchableOpacity>

          {/* Subscription Link */}
          <TouchableOpacity
            style={[
              styles.navigationButton,
              pathname.includes('/subscription') && styles.activeNavigationButton
            ]}
            onPress={() => router.push('/(drawer)/(tabs)/subscription')}
          >
            <Ionicons name="card" size={20} color={isDarkMode ? '#fff' : '#000'} />
            <Text style={[styles.navigationText, { color: isDarkMode ? '#fff' : '#000' }]}>
              Subscription
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat History Section */}
      <View style={styles.chatHistoryHeader}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
          Chat History
        </Text>
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
          renderItem={({ item }) => {
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
          }}
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
  navigationContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  navigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  activeNavigationButton: {
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
  navigationText: {
    marginLeft: 12,
    fontSize: 16,
  },
  chatHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  newChatText: {
    marginLeft: 8,
    fontSize: 14,
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
