import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/src/client/client.gen';

export default function ProfileNotificationSection() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'inputBackground');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'inputBorder');

  // Fetch notification count with error handling
  const {
    data: notificationData,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['notificationCount'],
    queryFn: async () => {
      try {
        const response = await client.get({
          path: '/api/v1/notifications/count',
          throwOnError: true
        });
        return response.data as { unread_count: number };
      } catch (err) {
        console.error('Error fetching notification count:', err);
        throw err;
      }
    },
    // Refresh every minute
    refetchInterval: 60000,
    // Don't refetch on window focus to reduce API calls
    refetchOnWindowFocus: false,
    // Return 0 unread count on error for graceful fallback
    onError: (err) => {
      console.error('Notification count query error:', err);
    }
  });

  // Get unread count or default to 0
  const unreadCount = notificationData?.unread_count || 0;

  // Navigate to notifications screen
  const handleViewNotifications = () => {
    // @ts-ignore - navigation typing issue
    navigation.navigate('notification');
  };

  // Navigate to notification settings
  const handleNotificationSettings = () => {
    // @ts-ignore - navigation typing issue
    navigation.navigate('notification-settings');
  };

  // Manually refresh notification count
  const handleRefresh = async () => {
    try {
      await refetch();
    } catch (err) {
      console.error('Error refreshing notification count:', err);
    }
  };

  return (
    <View style={[styles.notificationContainer, { backgroundColor: cardBackground, borderColor }]}>
      <Text style={[styles.notificationTitle, { color: textColor }]}>Notifications</Text>

      <View style={styles.notificationInfo}>
        {isLoading ? (
          <ActivityIndicator size="small" color={tintColor} style={styles.loader} />
        ) : isError ? (
          <TouchableOpacity style={styles.errorContainer} onPress={handleRefresh}>
            <Ionicons name="refresh-circle-outline" size={24} color={tintColor} />
            <Text style={[styles.errorText, { color: textColor }]}>Tap to refresh</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.notificationCountContainer}>
            <Ionicons name="notifications-outline" size={24} color={tintColor} style={styles.notificationIcon} />
            <Text style={[styles.notificationCount, { color: textColor }]}>
              {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
            </Text>
          </View>
        )}

        <View style={styles.notificationButtons}>
          <TouchableOpacity
            style={[styles.notificationButton, { backgroundColor: tintColor }]}
            onPress={handleViewNotifications}
          >
            <Text style={styles.notificationButtonText}>View All</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.notificationButton, { backgroundColor: 'transparent', borderColor: tintColor, borderWidth: 1 }]}
            onPress={handleNotificationSettings}
          >
            <Text style={[styles.notificationButtonText, { color: tintColor }]}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notificationContainer: {
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 0,
    borderWidth: 1,
  },
  notificationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  notificationInfo: {
    marginBottom: 8,
  },
  notificationCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  notificationIcon: {
    marginRight: 8,
  },
  notificationCount: {
    fontSize: 16,
  },
  notificationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  notificationButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  notificationButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  loader: {
    marginBottom: 16,
    alignSelf: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
  },
});
