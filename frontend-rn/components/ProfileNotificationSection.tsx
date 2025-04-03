import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/src/client/client.gen';

export default function ProfileNotificationSection() {
  const navigation = useNavigation();
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'inputBackground');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'inputBorder');

  // Fetch notification count
  const { data: notificationData } = useQuery({
    queryKey: ['notificationCount'],
    queryFn: async () => {
      const response = await client.get({
        path: '/api/v1/notifications/count'
      });
      return response.data as { unread_count: number };
    },
    // Refresh every minute
    refetchInterval: 60000,
    // Don't refetch on window focus to reduce API calls
    refetchOnWindowFocus: false,
  });

  const unreadCount = notificationData?.unread_count || 0;

  const handleViewNotifications = () => {
    // @ts-ignore - navigation typing issue
    navigation.navigate('notifications');
  };

  const handleNotificationSettings = () => {
    // @ts-ignore - navigation typing issue
    navigation.navigate('notification-settings');
  };

  return (
    <View style={[styles.notificationContainer, { backgroundColor: cardBackground, borderColor }]}>
      <Text style={[styles.notificationTitle, { color: textColor }]}>Notifications</Text>

      <View style={styles.notificationInfo}>
        <View style={styles.notificationCountContainer}>
          <Ionicons name="notifications-outline" size={24} color={tintColor} style={styles.notificationIcon} />
          <Text style={[styles.notificationCount, { color: textColor }]}>
            {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
          </Text>
        </View>

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
});
