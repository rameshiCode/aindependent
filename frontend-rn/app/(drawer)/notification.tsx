import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';
import { client } from '@/src/client/client.gen';
import { useAuth } from '@/context/authProvider';
import { getUserNotificationsOptions } from '@/src/client/@tanstack/react-query.gen';
import { useRouter } from 'expo-router';
import Animated, { 
  FadeIn, 
  FadeOut, 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  interpolate
} from 'react-native-reanimated';

// Notification types with icons
const NOTIFICATION_ICONS = {
  abstinence_milestone: "trophy-outline",
  relapse_risk_critical: "alert-circle",
  relapse_risk_high: "warning-outline",
  goal_reminder: "flag-outline",
  goal_deadline: "time-outline",
  motivation_boost: "heart-outline",
  coping_strategy: "fitness-outline",
  check_in: "chatbubble-ellipses-outline",
  high_risk_period: "trending-up-outline",
  milestone_approaching: "star-outline",
  educational: "book-outline"
};

// Default fallback icon
const DEFAULT_ICON = "notifications-outline";

// Define notification type
interface Notification {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  created_at: string;
  was_opened: boolean;
  priority: number;
  related_entity_id?: string;
  metadata?: any;
}

// Different notification background colors by type/priority
const getNotificationColor = (type: string, priority: number, theme: string) => {
  // Base colors
  const baseColors = {
    dark: {
      abstinence_milestone: '#1e3a8a', // Blue
      relapse_risk_critical: '#991b1b', // Red
      relapse_risk_high: '#92400e', // Amber
      goal_reminder: '#065f46', // Green
      default: '#1f2937' // Default dark
    },
    light: {
      abstinence_milestone: '#dbeafe', // Light blue
      relapse_risk_critical: '#fee2e2', // Light red
      relapse_risk_high: '#ffedd5', // Light amber
      goal_reminder: '#d1fae5', // Light green
      default: '#f3f4f6' // Default light
    }
  };

  // Get appropriate color theme
  const colors = theme === 'dark' ? baseColors.dark : baseColors.light;
  
  // First check by type
  for (const [key, value] of Object.entries(colors)) {
    if (type.includes(key)) {
      return value;
    }
  }
  
  // Fallback to priority if no type match
  if (priority >= 9) return colors.relapse_risk_critical;
  if (priority >= 7) return colors.relapse_risk_high;
  if (priority >= 5) return colors.goal_reminder;
  
  // Default color
  return colors.default;
};

export default function EnhancedNotificationScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { session } = useAuth();
  const themeType = useThemeColor({}, 'background') === '#fff' ? 'light' : 'dark';

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const cardBackground = useThemeColor({}, 'inputBackground');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'inputBorder');
  const subtleTextColor = themeType === 'dark' ? '#a3a3a3' : '#666666';

  // Animation values
  const headerOpacity = useSharedValue(1);
  const scrollY = useSharedValue(0);

  // Fetch notifications
  const {
    data: notifications,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    ...getUserNotificationsOptions(),
    queryKey: ['notifications'],
    staleTime: 60 * 1000, // 1 minute
  });

  // Animation styles
  const headerStyle = useAnimatedStyle(() => {
    return {
      opacity: headerOpacity.value,
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [0, 50],
            [0, -10],
            'clamp'
          ),
        },
      ],
    };
  });

  // Mark notification as read mutation
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await client.post({
        path: `/api/v1/notifications/mark-read/${notificationId}`,
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
      const response = await client.post({
        path: '/api/v1/notifications/mark-all-read',
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
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['notificationCount'] });
    } catch (e) {
      console.error('Error refreshing notifications:', e);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, queryClient]);

  // Refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      onRefresh();
    }, [onRefresh])
  );

  // Handle notification tap
  const handleNotificationPress = async (notification: Notification) => {
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
    Alert.alert(
      "Mark All as Read",
      "Are you sure you want to mark all notifications as read?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Yes, Mark All", 
          onPress: () => markAllAsRead.mutate() 
        }
      ]
    );
  };

  // Get notification icon
  const getNotificationIcon = (type: string) => {
    for (const [key, value] of Object.entries(NOTIFICATION_ICONS)) {
      if (type.includes(key)) {
        return value;
      }
    }
    return DEFAULT_ICON;
  };

  // Format date for display
  const formatDate = (dateString: string) => {
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
  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const bgColor = getNotificationColor(item.notification_type, item.priority, themeType);
    const icon = getNotificationIcon(item.notification_type);
    
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(300)}
      >
        <TouchableOpacity
          style={[
            styles.notificationItem,
            { 
              backgroundColor: bgColor,
              borderColor,
              opacity: item.was_opened ? 0.8 : 1
            }
          ]}
          onPress={() => handleNotificationPress(item)}
        >
          <View style={styles.notificationIcon}>
            <Ionicons 
              name={icon as any} 
              size={24} 
              color={themeType === 'dark' ? '#fff' : tintColor} 
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
      <Animated.View style={[styles.header, headerStyle, { borderBottomColor: borderColor }]}>
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
      </Animated.View>

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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tintColor}
              colors={[tintColor]}
            />
          }
          ListEmptyComponent={<EmptyState />}
          onScroll={(event) => {
            scrollY.value = event.nativeEvent.contentOffset.y;
            headerOpacity.value = withTiming(
              event.nativeEvent.contentOffset.y > 50 ? 0.8 : 1,
              { duration: 200 }
            );
          }}
          scrollEventThrottle={16}
        />
      )}
    </View>
  );
}

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