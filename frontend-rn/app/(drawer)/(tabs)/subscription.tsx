import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '../../../components/ThemedView';
import { ThemedText } from '../../../components/ThemedText';
import { StripeService } from '../../../src/client';
import StripePaymentForm from '../../../components/StripePaymentForm';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getProductsOptions, getProductPricesOptions, cancelSubscriptionOptions } from '../../../src/client/@tanstack/react-query.gen';

export default function SubscriptionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showUpgradeOptions, setShowUpgradeOptions] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);

  // Fetch subscription data
  const fetchSubscription = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await StripeService.getSubscriptionStatus({
        throwOnError: true
      });
      setSubscription(data);
      console.log("Subscription data:", JSON.stringify(data, null, 2));
    } catch (e: any) {
      console.error('Error fetching subscription:', e);
      setError('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch products for upgrade
  const {
    data: products,
    isLoading: isLoadingProducts,
    error: productsError
  } = useQuery({
    ...getProductsOptions(),
    enabled: showUpgradeOptions
  });

  // Log product errors
  useEffect(() => {
    if (productsError) {
      console.error('Error fetching products:', productsError);
    }
  }, [productsError]);

  // Fetch prices for selected product
  const {
    data: prices,
    isLoading: isLoadingPrices,
    error: pricesError
  } = useQuery({
    ...getProductPricesOptions({
      path: { product_id: selectedProductId || '' }
    }),
    enabled: !!selectedProductId
  });

  // Log price errors
  useEffect(() => {
    if (pricesError) {
      console.error('Error fetching prices:', pricesError);
    }
  }, [pricesError]);

  // Cancel subscription mutation
  const { mutate: cancelSubscription, isPending: isCanceling } = useMutation({
    mutationFn: (subscriptionId: string) => {
      return StripeService.cancelSubscription({
        path: { subscription_id: subscriptionId },
        throwOnError: true
      });
    },
    onSuccess: () => {
      Alert.alert(
        'Subscription Canceled',
        'Your subscription has been canceled and will end at the current billing period.',
        [{ text: 'OK', onPress: fetchSubscription }]
      );
    },
    onError: (error: any) => {
      Alert.alert('Error', `Failed to cancel subscription: ${error.message}`);
    }
  });

  // Update the openCustomerPortal function in Subscription.tsx
  const openCustomerPortal = async () => {
    try {
      setPortalLoading(true);

      // Use a valid URL for Stripe portal
      const { data } = await StripeService.createPortalSession({
        body: {
          return_url: `https://example.com/return`, // Use a valid URL here
        },
        throwOnError: true
      });

      // Add type checking
      if (data && typeof data.url === 'string') {
        router.push(`/web-view?url=${encodeURIComponent(data.url)}`);
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

  // Handle cancel subscription
  const handleCancelSubscription = () => {
    if (!subscription?.stripe_subscription_id) return;

    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will still have access until the end of your current billing period.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => cancelSubscription(subscription.stripe_subscription_id)
        }
      ]
    );
  };

  // Handle upgrade options toggle
  const handleUpgradeToggle = () => {
    setShowUpgradeOptions(!showUpgradeOptions);
    setSelectedProductId(null);
    setSelectedPriceId(null);
  };

  // Handle product selection
  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    setSelectedPriceId(null);
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
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <ActivityIndicator size="large" color="#5469D4" />
          <ThemedText style={styles.loadingText}>Loading subscription data...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Pressable style={styles.button} onPress={fetchSubscription}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    );
  }

  // Render subscription details or subscription form
  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText style={styles.title}>Subscription</ThemedText>

          {subscription?.has_active_subscription ? (
            // Active subscription view
            <View style={styles.subscriptionContainer}>
              <ThemedText style={styles.planName}>{subscription.plan?.name || 'Premium Plan'}</ThemedText>

              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>Status:</ThemedText>
                <ThemedText style={[
                  styles.detailValue,
                  subscription.status === 'active' && styles.activeStatus,
                  subscription.status === 'past_due' && styles.pastDueStatus,
                  subscription.status === 'canceled' && styles.canceledStatus,
                ]}>
                  {subscription.status?.charAt(0).toUpperCase() + subscription.status?.slice(1) || 'Active'}
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
                  Ends on {formatDate(subscription.current_period_end)}
                </ThemedText>
              </View>

              {subscription.cancel_at_period_end && (
                <View style={styles.cancelNotice}>
                  <ThemedText style={styles.cancelText}>
                    Your subscription will end on {formatDate(subscription.current_period_end)}
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
                  <Text style={styles.portalButtonText}>Manage in Stripe Portal</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.upgradeButton}
                onPress={handleUpgradeToggle}
              >
                <Text style={styles.buttonText}>
                  {showUpgradeOptions ? 'Hide Upgrade Options' : 'Upgrade Plan'}
                </Text>
              </Pressable>

              {!subscription.cancel_at_period_end && (
                <Pressable
                  style={styles.cancelButton}
                  onPress={handleCancelSubscription}
                  disabled={isCanceling}
                >
                  {isCanceling ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
                  )}
                </Pressable>
              )}

              {/* Upgrade options */}
              {showUpgradeOptions && (
                <View style={styles.upgradeOptions}>
                  <ThemedText style={styles.upgradeTitle}>Available Plans</ThemedText>

                  {isLoadingProducts ? (
                    <ActivityIndicator size="small" color="#5469D4" />
                  ) : productsError ? (
                    <ThemedText style={styles.errorText}>Error loading plans</ThemedText>
                  ) : (
                    products?.map((product: any) => (
                      <Pressable
                        key={product.id}
                        style={[
                          styles.productItem,
                          selectedProductId === product.id && styles.selectedProductItem
                        ]}
                        onPress={() => handleSelectProduct(product.id)}
                      >
                        <ThemedText style={styles.productName}>{product.name}</ThemedText>
                        <ThemedText style={styles.productDescription}>{product.description}</ThemedText>
                      </Pressable>
                    ))
                  )}

                  {selectedProductId && (
                    <View style={styles.priceOptions}>
                      <ThemedText style={styles.pricesTitle}>Select a Plan:</ThemedText>

                      {isLoadingPrices ? (
                        <ActivityIndicator size="small" color="#5469D4" />
                      ) : pricesError ? (
                        <ThemedText style={styles.errorText}>Error loading prices</ThemedText>
                      ) : (
                        prices?.map((price: any) => (
                          <View key={price.id} style={styles.priceItem}>
                            <ThemedText style={styles.priceText}>
                              ${(price.unit_amount / 100).toFixed(2)} {price.currency.toUpperCase()} / {price.recurring.interval}
                            </ThemedText>
                            <StripePaymentForm
                              priceId={price.id}
                              useCheckout={true}
                              onPaymentSuccess={fetchSubscription}
                            />
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              )}
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
                    priceId="price_1R4HTbK8wIdhxRomQmYkYDe1"
                    useCheckout={true}
                    onPaymentSuccess={fetchSubscription}
                  />
                </View>

                <View style={styles.planCard}>
                  <ThemedText style={styles.planCardTitle}>Basic Plan</ThemedText>
                  <ThemedText style={styles.planCardPrice}>$5/month</ThemedText>
                  <ThemedText style={styles.planCardDescription}>
                    Get access to basic features.
                  </ThemedText>

                  <StripePaymentForm
                    priceId="price_1R4HTbK8wIdhxRomQmYkYDe1" // Replace with your actual price ID
                    useCheckout={true}
                    onPaymentSuccess={fetchSubscription}
                  />
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
safeArea: {
  flex: 1,
},
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
upgradeButton: {
  backgroundColor: '#4f46e5',
  paddingVertical: 14,
  borderRadius: 8,
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 12,
},
cancelButton: {
  backgroundColor: '#ef4444',
  paddingVertical: 14,
  borderRadius: 8,
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 12,
},
cancelButtonText: {
  color: 'white',
  fontSize: 16,
  fontWeight: '600',
},
upgradeOptions: {
  marginTop: 20,
  paddingTop: 16,
  borderTopWidth: 1,
  borderTopColor: '#e2e8f0',
},
upgradeTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  marginBottom: 12,
  color: '#334155',
},
productItem: {
  padding: 14,
  borderWidth: 1,
  borderColor: '#e2e8f0',
  borderRadius: 8,
  marginBottom: 10,
  backgroundColor: '#fff',
},
selectedProductItem: {
  borderColor: '#5469D4',
  borderWidth: 2,
  backgroundColor: '#EEF2FF',
},
productName: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#334155',
  marginBottom: 4,
},
productDescription: {
  fontSize: 14,
  color: '#64748b',
},
priceOptions: {
  marginTop: 16,
},
pricesTitle: {
  fontSize: 16,
  fontWeight: 'bold',
  marginBottom: 12,
  color: '#334155',
},
priceItem: {
  marginBottom: 12,
  padding: 12,
  backgroundColor: '#fff',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#e2e8f0',
},
priceText: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#334155',
  marginBottom: 8,
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
