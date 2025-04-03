import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getSubscriptionStatusOptions } from '../../../src/client/@tanstack/react-query.gen';
import { router } from 'expo-router';
import { useAuth } from '@/context/authProvider'; // Import useAuth

// Define the subscription data type
interface SubscriptionData {
  has_active_subscription: boolean;
  subscription_id?: string;
  stripe_subscription_id?: string;
  status?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  plan?: {
    name: string;
    description: string;
  };
  price?: {
    amount: number;
    currency: string;
    interval: string;
  };
}

export default function ProfileScreen() {
  // Use the actual auth hook
  const { currentUser, signOut } = useAuth();

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

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

  const handleRefresh = async () => {
    console.log('Refreshing subscription data...');
    try {
      const result = await refetch();
      console.log('Refresh result:', JSON.stringify(result.data, null, 2));
      Alert.alert('Refresh Complete', 'Subscription data has been refreshed.');
    } catch (err) {
      console.error('Error refreshing subscription data:', err);
      Alert.alert('Refresh Error', 'Failed to refresh subscription data.');
    }
  };

  const handleSubscribe = () => {
    // Navigate to subscription page
    router.push('/subscription');
  };

  const handleManageSubscription = () => {
    router.push('/subscription');
  };

  const handleSignOut = async () => {
    try {
      // Call the signOut function from auth context
      signOut();
      // No need to navigate as the signOut function already handles that
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  // Render subscription section based on status
  const renderSubscriptionSection = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={styles.loadingText}>Loading subscription info...</Text>
        </View>
      );
    }

    if (isError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading subscription data</Text>
          <Text style={styles.errorDetail}>{error?.message || 'Unknown error'}</Text>
          <TouchableOpacity style={styles.button} onPress={handleRefresh}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (subscription?.has_active_subscription) {
      return (
        <View style={styles.subscriptionContainer}>
          <Text style={styles.subscriptionTitle}>Active Subscription</Text>
          <View style={styles.subscriptionDetails}>
            <Text style={styles.planName}>{subscription.plan?.name || 'Premium Plan'}</Text>
            <Text style={styles.planDescription}>{subscription.plan?.description || 'Full access to all features'}</Text>
            <Text style={styles.priceInfo}>
              {subscription.price?.amount ? `${(subscription.price.amount / 100).toFixed(2)} ${subscription.price.currency.toUpperCase()}` : 'Price info unavailable'}
              {subscription.price?.interval ? ` / ${subscription.price.interval}` : ''}
            </Text>
            <Text style={styles.renewalInfo}>
              {subscription.cancel_at_period_end
                ? `Your subscription will end on ${formatDate(subscription.current_period_end || '')}`
                : `Renews on ${formatDate(subscription.current_period_end || '')}`}
            </Text>
          </View>
          <TouchableOpacity style={styles.button} onPress={handleManageSubscription}>
            <Text style={styles.buttonText}>Manage Subscription</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineButton} onPress={handleRefresh}>
            <Text style={styles.outlineButtonText}>Refresh Status</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.subscriptionContainer}>
        <Text style={styles.subscriptionTitle}>Subscription</Text>
        <Text style={styles.noSubscriptionText}>You don't have an active subscription.</Text>
        <TouchableOpacity style={styles.button} onPress={handleSubscribe}>
          <Text style={styles.buttonText}>Subscribe Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.outlineButton} onPress={handleRefresh}>
          <Text style={styles.outlineButtonText}>Refresh Status</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {currentUser?.full_name?.charAt(0) || currentUser?.email?.charAt(0) || 'U'}
          </Text>
        </View>
        <Text style={styles.userName}>
          {currentUser?.full_name || currentUser?.email || 'User'}
        </Text>
        <Text style={styles.userEmail}>
          {currentUser?.email || 'a@b.cc'}
        </Text>
      </View>

      {renderSubscriptionSection()}

      <View style={styles.settingsContainer}>
        <Text style={styles.settingsTitle}>Settings</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Theme</Text>
          <Text style={styles.settingValue}>Dark</Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Notifications</Text>
          <Text style={styles.settingValue}>On</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  profileHeader: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#6200ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: 'white',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 16,
  },
  subscriptionContainer: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    marginTop: 0,
  },
  subscriptionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  noSubscriptionText: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#6200ee',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#6200ee',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: '#6200ee',
    fontWeight: 'bold',
    fontSize: 16,
  },
  subscriptionDetails: {
    marginBottom: 16,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
  },
  priceInfo: {
    fontSize: 16,
    color: '#6200ee',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  renewalInfo: {
    fontSize: 14,
    color: '#aaa',
  },
  settingsContainer: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 20,
    margin: 16,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
  },
  settingValue: {
    fontSize: 16,
    color: '#aaa',
  },
  signOutButton: {
    backgroundColor: '#6200ee',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    alignItems: 'center',
    marginBottom: 40,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 150,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#ccc',
  },
  errorContainer: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff6b6b',
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 16,
    textAlign: 'center',
  }
});
