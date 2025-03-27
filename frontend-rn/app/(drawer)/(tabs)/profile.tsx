import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, useColorScheme, ActivityIndicator, ScrollView } from 'react-native';
import { useAuth } from '@/context/authProvider';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { useQuery } from '@tanstack/react-query';
import { getSubscriptionStatusOptions } from '@/src/client/@tanstack/react-query.gen';

// Define TypeScript interfaces for subscription data
interface SubscriptionPlan {
  name?: string;
}

interface SubscriptionDetails {
  status?: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
}

interface SubscriptionPrice {
  amount?: number;
  interval?: string;
}

interface SubscriptionData {
  has_subscription?: boolean;
  plan?: SubscriptionPlan;
  subscription?: SubscriptionDetails;
  price?: SubscriptionPrice;
}

export default function Profile() {
  const { currentUser, signOut } = useAuth();
  const router = useRouter();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const placeholderBackground = useThemeColor({}, 'inputBackground');
  const placeholderTextColor = useThemeColor({}, 'inputText');
  const buttonBackground = useThemeColor({}, 'buttonBackground');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const theme = useColorScheme();

  // Fetch subscription data using React Query with proper typing
  const {
    data: subscription,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery(getSubscriptionStatusOptions()) as {
    data: SubscriptionData | undefined;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<any>;
  };

  // Format date function
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <ThemedView useSafeAreaTop style={[styles.container, { backgroundColor }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <Image
            source={require('../../../assets/images/pfp.png')}
            style={styles.profileImage}
          />
          <Text style={[styles.profileName, { color: textColor }]}>{currentUser?.full_name || 'User'}</Text>
          <Text style={[styles.profileEmail, { color: placeholderTextColor }]}>{currentUser?.email}</Text>
        </View>

        {/* Subscription Section */}
        <View style={[styles.subscriptionSection, { backgroundColor: placeholderBackground }]}>
          <Text style={[styles.settingsTitle, { color: textColor }]}>Subscription</Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#5469D4" />
              <Text style={[styles.loadingText, { color: placeholderTextColor }]}>Loading subscription...</Text>
            </View>
          ) : isError ? (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: '#FF4444' }]}>
                {error instanceof Error ? error.message : 'Failed to load subscription data'}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: buttonBackground }]}
                onPress={() => refetch()}
              >
                <Text style={[styles.retryButtonText, { color: buttonTextColor }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : subscription?.has_subscription ? (
            <>
              <View style={styles.subscriptionItem}>
                <Text style={[styles.settingText, { color: textColor }]}>Plan</Text>
                <Text style={[styles.subscriptionValue, { color: textColor }]}>
                  {subscription.plan?.name || 'Premium Plan'}
                </Text>
              </View>

              <View style={styles.subscriptionItem}>
                <Text style={[styles.settingText, { color: textColor }]}>Status</Text>
                <View style={[
                  styles.statusBadge,
                  subscription.subscription?.status === 'active' && styles.activeBadge,
                  subscription.subscription?.status === 'past_due' && styles.pastDueBadge,
                  subscription.subscription?.status === 'canceled' && styles.canceledBadge,
                ]}>
                  <Text style={styles.statusText}>
                    {subscription.subscription?.status
                      ? subscription.subscription.status.charAt(0).toUpperCase() +
                        subscription.subscription.status.slice(1)
                      : 'Unknown'}
                  </Text>
                </View>
              </View>

              <View style={styles.subscriptionItem}>
                <Text style={[styles.settingText, { color: textColor }]}>Price</Text>
                <Text style={[styles.subscriptionValue, { color: textColor }]}>
                  ${(subscription.price?.amount || 0) / 100} / {subscription.price?.interval || 'month'}
                </Text>
              </View>

              <View style={styles.subscriptionItem}>
                <Text style={[styles.settingText, { color: textColor }]}>Renewal Date</Text>
                <Text style={[styles.subscriptionValue, { color: textColor }]}>
                  {formatDate(subscription.subscription?.current_period_end)}
                </Text>
              </View>

              {subscription.subscription?.cancel_at_period_end && (
                <View style={styles.cancelNotice}>
                  <Text style={styles.cancelText}>
                    Your subscription will end on {formatDate(subscription.subscription.current_period_end)}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.manageButton, { backgroundColor: buttonBackground }]}
                onPress={() => router.push('/subscription')}
              >
                <Text style={[styles.manageButtonText, { color: buttonTextColor }]}>Manage Subscription</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.noSubscriptionContainer}>
              <Text style={[styles.noSubscriptionText, { color: placeholderTextColor }]}>
                You don't have an active subscription.
              </Text>
              <TouchableOpacity
                style={[styles.subscribeButton, { backgroundColor: buttonBackground }]}
                onPress={() => router.push('/subscription')}
              >
                <Text style={[styles.subscribeButtonText, { color: buttonTextColor }]}>Subscribe Now</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Settings Section */}
        <View style={[styles.settingsSection, { backgroundColor: placeholderBackground }]}>
          <Text style={[styles.settingsTitle, { color: textColor }]}>Settings</Text>
          {/* Theme Setting */}
          <TouchableOpacity style={styles.settingItem}>
            <Text style={[styles.settingText, { color: textColor }]}>Theme</Text>
            <Text style={[styles.settingValue, { color: placeholderTextColor }]}>
              {theme === 'light' ? 'Light' : 'Dark'}
            </Text>
          </TouchableOpacity>
          {/* Notifications Setting */}
          <TouchableOpacity style={styles.settingItem}>
            <Text style={[styles.settingText, { color: textColor }]}>Notifications</Text>
            <Text style={[styles.settingValue, { color: placeholderTextColor }]}>On</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.signOutButton, { backgroundColor: buttonBackground }]}
          onPress={signOut}
        >
          <Text style={[styles.signOutButtonText, { color: buttonTextColor }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileEmail: {
    fontSize: 16,
  },
  subscriptionSection: {
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
  },
  settingsSection: {
    borderRadius: 10,
    padding: 20,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingText: {
    fontSize: 16,
  },
  settingValue: {
    fontSize: 16,
  },
  signOutButton: {
    marginTop: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 10,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  subscriptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  subscriptionValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#9CA3AF',
  },
  activeBadge: {
    backgroundColor: '#10B981',
  },
  pastDueBadge: {
    backgroundColor: '#F59E0B',
  },
  canceledBadge: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cancelNotice: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  cancelText: {
    color: '#B91C1C',
    fontSize: 14,
    textAlign: 'center',
  },
  manageButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  noSubscriptionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noSubscriptionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  subscribeButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  subscribeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
