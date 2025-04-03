import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/src/client/client.gen';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// Define notification type
interface Notification {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  scheduled_for: string;
  priority: number;
  was_sent: boolean;
  was_opened: boolean;
}

export default function NotificationsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'inputBackground');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'inputBorder');

  // Fetch notifications
  const {
    data: notifications,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await client.GET('/api/v1/notifications');
      return response.data as Notification[];
    }
  });

  // Mark notification as read
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await client.POST(`/api/v1/notifications/mark-read/${notificationId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationCount'] });
    }
  });

  // Mark all notifications as read
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const response = await client.POST('/api/v1/notifications/mark-all-read');
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
    await refetch();
    setRefreshing(false);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get icon based on notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'goal_reminder':
        return 'flag';
      case 'risk_event':
        return 'warning';
      case 'abstinence_milestone':
        return 'trophy';
      default:
        return 'notifications';
    }
  };

  // Handle notification press
  const handleNotificationPress = (notification: Notification) => {
    if (!notification.was_opened) {
      markAsRead.mutate(notification.id);
    }
    // Additional navigation or action based on notification type could be added here
  };

  // Handle mark all as read
  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  // Render notification item
  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        {
          backgroundColor: item.was_opened ? cardBackground : `${tintColor}20`,
          borderColor
        }
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={getNotificationIcon(item.notification_type)}
          size={24}
          color={tintColor}
        />
      </View>
      <View style={styles.contentContainer}>
        <Text style={[styles.notificationTitle, { color: textColor }]}>
          {item.title}
        </Text>
        <Text style={[styles.notificationBody, { color: textColor }]}>
          {item.body}
        </Text>
        <Text style={[styles.notificationTime, { color: `${textColor}80` }]}>
          {formatDate(item.scheduled_for)}
        </Text>
      </View>
      {!item.was_opened && (
        <View style={[styles.unreadIndicator, { backgroundColor: tintColor }]} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: "Notifications",
          headerRight: () => (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={handleMarkAllAsRead}
            >
              <Text style={[styles.markAllText, { color: tintColor }]}>
                Mark all as read
              </Text>
            </TouchableOpacity>
          )
        }}
      />

      {isLoading ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.statusText, { color: textColor }]}>Loading notifications...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.statusText, { color: textColor }]}>
            Failed to load notifications
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: tintColor }]}
            onPress={onRefresh}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : notifications && notifications.length > 0 ? (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[tintColor]}
              tintColor={tintColor}
            />
          }
        />
      ) : (
        <View style={styles.centerContainer}>
          <Ionicons name="notifications-off" size={48} color={`${textColor}50`} />
          <Text style={[styles.statusText, { color: textColor }]}>
            No notifications yet
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    padding: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
  },
  iconContainer: {
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 14,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
  },
  unreadIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  statusText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  markAllButton: {
    paddingHorizontal: 16,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
