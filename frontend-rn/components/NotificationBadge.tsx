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

  // Fetch notification count with error handling
  const {
    data,
    isLoading,
    isError,
    error
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
    // Start with stale data while revalidating
    staleTime: 30000,
    retry: 2,
    // Return empty object on error for graceful fallback
    onError: (err) => {
      console.error('Notification count query error:', err);
    }
  });

  // Log loading or error states for debugging
  React.useEffect(() => {
    if (isLoading) {
      console.log('Loading notification count...');
    }
    if (isError) {
      console.error('Error fetching notification count:', error);
    }
  }, [isLoading, isError, error]);

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
