import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/src/client/client.gen';
import { useThemeColor } from '@/hooks/useThemeColor';

interface NotificationBadgeProps {
  size?: number;
  color?: string;
  textColor?: string;
}

export default function NotificationBadge({
  size = 20,
  color,
  textColor
}: NotificationBadgeProps) {
  // Use theme colors if not provided as props
  const tintColor = useThemeColor({}, 'tint');
  const badgeColor = color || tintColor || '#ff3b30';
  const badgeTextColor = textColor || '#ffffff';

  // Fetch notification count
  const {
    data,
    isLoading,
    isError
  } = useQuery({
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
    // Start with stale data while revalidating
    staleTime: 30000,
  });

  // Don't show badge if loading, error, or count is 0
  if (isLoading || isError || !data || data.unread_count === 0) {
    return null;
  }

  return (
    <View style={[
      styles.badge,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: badgeColor
      }
    ]}>
      <Text style={[styles.text, { color: badgeTextColor, fontSize: size * 0.6 }]}>
        {data.unread_count > 9 ? '9+' : data.unread_count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  text: {
    fontWeight: 'bold',
  },
});
