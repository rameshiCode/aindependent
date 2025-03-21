import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '../../../components/ThemedView';
import { ThemedText } from '../../../components/ThemedText';
import { StripeService } from '../../../src/client';
import StripePaymentForm from '../../../components/StripePaymentForm';

export default function SubscriptionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  // Fetch subscription data
  const fetchSubscription = async () => {
    try {
      setLoading(true);
      setError(null);

      const stripeService = new StripeService();
      const response = await stripeService.getSubscriptionStatus();
      setSubscription(response);
    } catch (e: any) {
      console.error('Error fetching subscription:', e);
      setError('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  // Open customer portal
  const openCustomerPortal = async () => {
    try {
      setPortalLoading(true);

      const stripeService = new StripeService();
      const response = await stripeService.createPortalSession({
        return_url: `${window.location.origin}/subscription`,
      });

      if (response.url) {
        router.push(`/web-view?url=${encodeURIComponent(response.url)}`);
      } else {
        setError('Failed to open customer portal');
      }
    } catch (e: any) {
      console.error('Error opening customer portal:', e);
      setError(`Failed to open customer portal: ${e.message}`);
    } finally {
      setPortalLoading(false);
    }
  };

  // Load subscription data on mount
  useEffect(() => {
    fetchSubscription();
  }, []);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Render loading state
  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#5469D4" />
        <ThemedText style={styles.loadingText}>Loading subscription data...</ThemedText>
      </ThemedView>
    );
  }

  // Render error state
  if (error) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <Pressable style={styles.button} onPress={fetchSubscription}>
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      </ThemedView>
    );
  }

  // Render subscription details or subscription form
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.title}>Subscription</ThemedText>

        {subscription?.has_subscription ? (
          // Active subscription view
          <View style={styles.subscriptionContainer}>
            <ThemedText style={styles.planName}>{subscription.plan?.name || 'Premium Plan'}</ThemedText>

            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Status:</ThemedText>
              <ThemedText style={[
                styles.detailValue,
                subscription.subscription.status === 'active' && styles.activeStatus,
                subscription.subscription.status === 'past_due' && styles.pastDueStatus,
                subscription.subscription.status === 'canceled' && styles.canceledStatus,
              ]}>
                {subscription.subscription.status.charAt(0).toUpperCase() + subscription.subscription.status.slice(1)}
              </ThemedText>
            </View>

            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Price:</ThemedText>
              <ThemedText style={styles.detailValue}>
                ${(subscription.price?.amount / 100).toFixed(2)} / {subscription.price?.interval}
              </ThemedText>
            </View>

            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Current Period:</ThemedText>
              <ThemedText style={styles.detailValue}>
                {formatDate(subscription.subscription.current_period_start)} - {formatDate(subscription.subscription.current_period_end)}
              </ThemedText>
            </View>

            {subscription.subscription.cancel_at_period_end && (
              <View style={styles.cancelNotice}>
                <ThemedText style={styles.cancelText}>
                  Your subscription will end on {formatDate(subscription.subscription.current_period_end)}
                </ThemedText>
              </View>
            )}

            <Pressable
              style={styles.portalButton}
              onPress={openCustomerPortal}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.portalButtonText}>Manage Subscription</Text>
              )}
            </Pressable>
          </View>
        ) : (
          // No subscription view
          <View style={styles.noSubscriptionContainer}>
            <ThemedText style={styles.noSubscriptionText}>
              You don't have an active subscription.
            </ThemedText>

            <View style={styles.pricingContainer}>
              <ThemedText style={styles.pricingTitle}>Choose a Plan</ThemedText>

              <View style={styles.planCard}>
                <ThemedText style={styles.planCardTitle}>Premium Plan</ThemedText>
                <ThemedText style={styles.planCardPrice}>$15/month</ThemedText>
                <ThemedText style={styles.planCardDescription}>
                  Get access to all premium features and priority support.
                </ThemedText>

                <StripePaymentForm
                  priceId="price_premium" // Replace with your actual price ID
                  useCheckout={true}
                />
              </View>

              <View style={styles.planCard}>
                <ThemedText style={styles.planCardTitle}>Basic Plan</ThemedText>
                <ThemedText style={styles.planCardPrice}>$5/month</ThemedText>
                <ThemedText style={styles.planCardDescription}>
                  Get access to basic features.
                </ThemedText>

                <StripePaymentForm
                  priceId="price_basic" // Replace with your actual price ID
                  useCheckout={true}
                />
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#FF4444',
    marginBottom: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  subscriptionContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#334155',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  detailLabel: {
    fontSize: 16,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  activeStatus: {
    color: '#10b981',
  },
  pastDueStatus: {
    color: '#f59e0b',
  },
  canceledStatus: {
    color: '#ef4444',
  },
  cancelNotice: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  cancelText: {
    color: '#b91c1c',
    fontSize: 14,
    textAlign: 'center',
  },
  portalButton: {
    backgroundColor: '#5469D4',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  portalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#5469D4',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  noSubscriptionContainer: {
    alignItems: 'center',
  },
  noSubscriptionText: {
    fontSize: 18,
    marginBottom: 24,
    textAlign: 'center',
  },
  pricingContainer: {
    width: '100%',
  },
  pricingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  planCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  planCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  planCardPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#5469D4',
    marginBottom: 12,
  },
  planCardDescription: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 20,
  },
});
