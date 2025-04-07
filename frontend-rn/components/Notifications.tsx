import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useThemeColor } from '@/hooks/useThemeColor';
import { client } from '@/src/client/client.gen';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

// Define notification types with icons and colors
const NOTIFICATION_TYPES = {
  abstinence_milestone: {
    icon: "trophy-outline",
    color: {
      light: '#dbeafe',  // Light blue
      dark: '#1e3a8a'    // Dark blue
    }
  },
  relapse_risk_critical: {
    icon: "alert-circle",
    color: {
      light: '#fee2e2',  // Light red
      dark: '#991b1b'    // Dark red
    }
  },
  relapse_risk_high: {
    icon: "warning-outline",
    color: {
      light: '#ffedd5',  // Light amber
      dark: '#92400e'    // Dark amber
    }
  },
  high_risk_period: {
    icon: "trending-up-outline",
    color: {
      light: '#fef3c7',  // Light yellow
      dark: '#854d0e'    // Dark yellow
    }
  },
  goal_deadline: {
    icon: "flag-outline",
    color: {
      light: '#d1fae5',  // Light green
      dark: '#065f46'    // Dark green
    }
  },
  goal_reminder: {
    icon: "flag-outline",
    color: {
      light: '#d1fae5',  // Light green
      dark: '#065f46'    // Dark green
    }
  },
  motivation_boost: {
    icon: "heart-outline",
    color: {
      light: '#fce7f3',  // Light pink
      dark: '#831843'    // Dark pink
    }
  },
  coping_strategy: {
    icon: "fitness-outline",
    color: {
      light: '#e0e7ff',  // Light indigo
      dark: '#3730a3'    // Dark indigo
    }
  },
  check_in: {
    icon: "chatbubble-ellipses-outline",
    color: {
      light: '#f3f4f6',  // Light gray
      dark: '#1f2937'    // Dark gray
    }
  },
  milestone_approaching: {
    icon: "star-outline",
    color: {
      light: '#dbeafe',  // Light blue
      dark: '#1e3a8a'    // Dark blue
    }
  },
  educational: {
    icon: "book-outline",
    color: {
      light: '#e0f2fe',  // Light sky blue
      dark: '#0c4a6e'    // Dark sky blue
    }
  },
  default: {
    icon: "notifications-outline",
    color: {
      light: '#f3f4f6',  // Light gray
      dark: '#1f2937'    // Dark gray
    }
  }
};

const EnhancedNotificationScreen = () => {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  // Theme colors
  const themeType = useThemeColor({}, 'background') === '#fff' ? 'light' : 'dark';
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const cardBackground = useThemeColor({}, 'inputBackground');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'inputBorder');
  const subtleTextColor = themeType === 'dark' ? '#a3a3a3' : '#666666';

  // Fetch notifications
  const {
    data: notifications,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await client.GET('/api/v1/notifications/', {
        query: { limit: 50, offset: 0 }
      });
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute
  });

  // Mark notification as read mutation
  const markAsRead = useMutation({
    mutationFn: async (notificationId) => {
      const response = await client.POST(`/api/v1/notifications/mark-read/${notificationId}`, {
        throwOnError: true
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationCount'] });
    }
  });

  // Mark all as read mutation
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const response = await client.POST('/api/v1/notifications/mark-all-read', {
        throwOnError: true
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationCount'] });
    }
  });

  // Handle refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['notificationCount'] });
    } catch (e) {
      console.error('Error refreshing notifications:', e);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle notification tap
  const handleNotificationPress = async (notification) => {
    try {
      // Mark as read
      if (!notification.was_opened) {
        markAsRead.mutate(notification.id);
      }

      // Handle navigation based on notification type
      if (notification.notification_type.includes('goal') && notification.related_entity_id) {
        // Navigate to user goals screen
        router.push('/(drawer)/(tabs)/user-profile?tab=goals');
      }
      else if (notification.notification_type.includes('relapse_risk')) {
        // Navigate to chat for immediate support
        router.push('/(drawer)/(tabs)/chat');
      }
      else if (notification.notification_type.includes('abstinence_milestone')) {
        // Navigate to profile screen
        router.push('/(drawer)/(tabs)/user-profile');
      }
      else {
        // Default action - navigate to main chat
        router.push('/(drawer)/(tabs)/chat');
      }
    } catch (e) {
      console.error('Error handling notification:', e);
    }
  };

  // Handle "Mark All as Read" button press
  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  // Get notification icon and color
  const getNotificationStyle = (type) => {
    // Find matching notification type
    for (const [key, value] of Object.entries(NOTIFICATION_TYPES)) {
      if (type.includes(key)) {
        return {
          icon: value.icon,
          color: value.color[themeType]
        };
      }
    }

    // Default style
    return {
      icon: NOTIFICATION_TYPES.default.icon,
      color: NOTIFICATION_TYPES.default.color[themeType]
    };
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Render notification item
  const renderNotificationItem = ({ item }) => {
    const style = getNotificationStyle(item.notification_type);

    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(300)}
      >
        <TouchableOpacity
          style={[
            styles.notificationItem,
            {
              backgroundColor: style.color,
              borderColor,
              opacity: item.was_opened ? 0.8 : 1
            }
          ]}
          onPress={() => handleNotificationPress(item)}
        >
          <View style={styles.notificationIcon}>
            <Ionicons
              name={style.icon}
              size={24}
              color={themeType === 'dark' ? '#fff' : '#000'}
            />
          </View>

          <View style={styles.notificationContent}>
            <Text
              style={[
                styles.notificationTitle,
                {
                  color: textColor,
                  fontWeight: item.was_opened ? '400' : '600'
                }
              ]}
            >
              {item.title}
            </Text>

            <Text
              style={[
                styles.notificationBody,
                { color: textColor }
              ]}
              numberOfLines={2}
            >
              {item.body}
            </Text>

            <Text style={[styles.notificationTime, { color: subtleTextColor }]}>
              {formatDate(item.created_at)}
            </Text>
          </View>

          {!item.was_opened && (
            <View style={[styles.unreadIndicator, { backgroundColor: tintColor }]} />
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Empty state component
  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="notifications-off-outline"
        size={80}
        color={subtleTextColor}
        style={styles.emptyIcon}
      />
      <Text style={[styles.emptyTitle, { color: textColor }]}>
        No Notifications
      </Text>
      <Text style={[styles.emptySubtitle, { color: subtleTextColor }]}>
        We'll notify you when there are important updates about your recovery journey.
      </Text>
    </View>
  );

  // Loading state component
  const LoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={tintColor} />
      <Text style={[styles.loadingText, { color: textColor }]}>
        Loading notifications...
      </Text>
    </View>
  );

  // Error state component
  const ErrorState = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={60} color="#ff3b30" />
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorSubtitle}>
        We couldn't load your notifications.
      </Text>
      <TouchableOpacity
        style={[styles.retryButton, { backgroundColor: tintColor }]}
        onPress={onRefresh}
      >
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header Section */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>
          Notifications
        </Text>
        {notifications && notifications.length > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllAsRead}
            disabled={markAllAsRead.isPending}
          >
            {markAllAsRead.isPending ? (
              <ActivityIndicator size="small" color={tintColor} />
            ) : (
              <Text style={[styles.markAllText, { color: tintColor }]}>
                Mark All Read
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Content Section */}
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState />
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContainer,
            notifications && notifications.length === 0 && styles.emptyListContainer
          ]}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={<EmptyState />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    zIndex: 1000,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  markAllButton: {
    padding: 8,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationItem: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: 16,
    right: 16,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    color: '#ff3b30',
  },
  errorSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    color: '#666',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
  }
});

export default EnhancedNotificationScreen;
