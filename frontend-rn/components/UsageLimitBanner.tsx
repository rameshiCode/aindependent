// Create this as /components/UsageLimitBanner.tsx

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';

interface UsageLimitBannerProps {
  usageData: {
    requests_used: number;
    requests_limit: number;
    requests_remaining: number;
    limit_reached: boolean;
  };
  onDismiss?: () => void;
}

const UsageLimitBanner: React.FC<UsageLimitBannerProps> = ({ usageData, onDismiss }) => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Calculate percentage used
  const percentUsed = Math.min(
    100,
    Math.round((usageData.requests_used / usageData.requests_limit) * 100)
  );

  const handleSubscribe = () => {
    router.push({
      pathname: '/(drawer)/(tabs)/subscription',
      params: { fromUsageLimit: 'true' }
    });
  };

  // If limit is not approaching, don't show banner
  if (usageData.requests_remaining > 2 && !usageData.limit_reached) {
    return null;
  }

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
        borderColor: usageData.limit_reached
          ? '#ef4444'
          : isDark ? '#4a4a4a' : '#d1d1d6'
      }
    ]}>
      {usageData.limit_reached ? (
        // Limit reached banner
        <>
          <Text style={[styles.title, { color: '#ef4444' }]}>
            Free Message Limit Reached
          </Text>
          <Text style={[styles.message, { color: isDark ? '#d1d1d6' : '#3a3a3c' }]}>
            You've used all {usageData.requests_limit} free messages. Subscribe to continue using the chat.
          </Text>
          <TouchableOpacity
            style={styles.subscribeButton}
            onPress={handleSubscribe}
          >
            <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
          </TouchableOpacity>
        </>
      ) : (
        // Approaching limit banner
        <>
          <Text style={[styles.title, { color: isDark ? '#f59e0b' : '#d97706' }]}>
            Free Message Limit Approaching
          </Text>
          <Text style={[styles.message, { color: isDark ? '#d1d1d6' : '#3a3a3c' }]}>
            You have {usageData.requests_remaining} message{usageData.requests_remaining !== 1 ? 's' : ''} remaining out of {usageData.requests_limit}
          </Text>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${percentUsed}%`,
                  backgroundColor: percentUsed > 80 ? '#ef4444' : '#10a37f'
                }
              ]}
            />
          </View>
          <TouchableOpacity
            style={[styles.subscribeButton, { backgroundColor: '#10a37f' }]}
            onPress={handleSubscribe}
          >
            <Text style={styles.subscribeButtonText}>Get Unlimited Access</Text>
          </TouchableOpacity>
        </>
      )}

      {onDismiss && (
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Text style={[styles.dismissText, { color: isDark ? '#d1d1d6' : '#3a3a3c' }]}>
            Dismiss
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#e5e5ea',
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
  subscribeButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  dismissButton: {
    marginTop: 10,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
  }
});

export default UsageLimitBanner;
