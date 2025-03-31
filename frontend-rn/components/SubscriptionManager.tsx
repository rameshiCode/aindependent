// frontend-rn/components/SubscriptionManager.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  getSubscriptionStatusOptions,
  getProductsOptions,
  getProductPricesOptions,
  cancelSubscriptionMutation,
  getAvailableSubscriptionsOptions,
  createPortalSessionMutation
} from '../src/client/@tanstack/react-query.gen';
import { useThemeColor } from '@/hooks/useThemeColor';
import StripePaymentForm from './StripePaymentForm';
import {
  StripeGetSubscriptionStatusResponse,
  StripeGetProductsResponse,
  StripeGetProductPricesResponse,
  StripeGetAvailableSubscriptionsResponse,
  StripeCreatePortalSessionResponse,
  StripeCancelSubscriptionResponse,
  PortalSessionCreate,
  StripeCancelSubscriptionData
} from '@/src/client';

interface SubscriptionManagerProps {
  onComplete?: () => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ onComplete }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [showUpgradeOptions, setShowUpgradeOptions] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams();

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const cardBackground = useThemeColor({}, 'inputBackground');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'inputBorder');
  const errorColor = '#FF4444';

  // Get current subscription
  const {
    data: subscription,
    isLoading: isLoadingSubscription,
    error: subscriptionError,
    refetch: refetchSubscription
  } = useQuery<StripeGetSubscriptionStatusResponse>({
    ...getSubscriptionStatusOptions(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  } as any);

  // Force refresh when returning from Portal
  useEffect(() => {
    // Check if we're returning with a refresh parameter
    if (params.refresh) {
      refetchSubscription();
    }
  }, [params.refresh]);

  // Get available subscription plans
  const {
    data: availableSubscriptions,
    isLoading: isLoadingAvailableSubscriptions
  } = useQuery<StripeGetAvailableSubscriptionsResponse>({
    ...getAvailableSubscriptionsOptions(),
    enabled: showUpgradeOptions,
  } as any);

  // Get products for the subscription plans
  const {
    data: products,
    isLoading: isLoadingProducts
  } = useQuery<StripeGetProductsResponse>({
    ...getProductsOptions(),
    enabled: showUpgradeOptions && !availableSubscriptions,
  } as any);

  // Get prices for selected product
  const {
    data: prices,
    isLoading: isLoadingPrices
  } = useQuery<StripeGetProductPricesResponse>({
    ...getProductPricesOptions({
      path: { product_id: selectedProductId || '' }
    }),
    enabled: !!selectedProductId,
  } as any);

  // Create portal session mutation
  const { mutate: createPortalSession, isPending: isCreatingPortal } = useMutation<
    any,
    Error,
    { body: PortalSessionCreate }
  >({
    ...(createPortalSessionMutation() as any),
    onSuccess: (data) => {
      console.log('Portal session response:', JSON.stringify(data));

      // Try all possible properties where URL might be found
      let portalUrl = null;
      try {
        if (data) {
          if (typeof data.url === 'string') {
            portalUrl = data.url;
          } else if (data.session_url && typeof data.session_url === 'string') {
            portalUrl = data.session_url;
          } else if (data.data && typeof data.data === 'object') {
            if (typeof data.data.url === 'string') {
              portalUrl = data.data.url;
            }
          }
        }
      } catch (e) {
        console.error('Error extracting URL from portal data:', e);
      }

      if (portalUrl) {
        console.log('Portal URL found:', portalUrl);
        router.push(`/web-view?url=${encodeURIComponent(portalUrl)}`);
      } else {
        console.error('Portal URL not found in response:', data);
        Alert.alert('Error', 'Failed to create portal session. No URL returned.');
      }
    },
    onError: (error) => {
      console.error('Portal session error:', error);
      Alert.alert('Error', `Failed to create payment portal: ${error.message}`);
    }
  });

  // Cancel subscription mutation
  const { mutate: cancelSubscription, isPending: isCanceling } = useMutation<
    StripeCancelSubscriptionResponse,
    any,
    StripeCancelSubscriptionData
  >({
    ...cancelSubscriptionMutation(),
    onSuccess: () => {
      Alert.alert(
        'Subscription Canceled',
        'Your subscription has been canceled and will end at the current billing period.',
        [{
          text: 'OK',
          onPress: () => {
            refetchSubscription();
            queryClient.invalidateQueries({ queryKey: getSubscriptionStatusOptions().queryKey });
          }
        }]
      );
    },
    onError: (error: any) => {
      console.error('Cancel subscription error:', error);
      Alert.alert('Error', `Failed to cancel subscription: ${error.message}`);
    }
  });

  // Refresh subscription data
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchSubscription();
      if (selectedProductId) {
        queryClient.invalidateQueries({
          queryKey: getProductPricesOptions({
            path: { product_id: selectedProductId }
          }).queryKey
        });
      }
      if (showUpgradeOptions) {
        queryClient.invalidateQueries({
          queryKey: getProductsOptions().queryKey
        });
        queryClient.invalidateQueries({
          queryKey: getAvailableSubscriptionsOptions().queryKey
        });
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle subscription portal
  const handleManageInPortal = () => {
    try {
      console.log('Attempting to create portal session');

      // Use a fully-qualified URL instead of a custom scheme
      const portalData: PortalSessionCreate = {
        return_url: 'https://example.com/return' // This will be caught by our WebView
      };

      createPortalSession({
        body: portalData
      });
    } catch (e) {
      console.error('Error in handleManageInPortal:', e);
      Alert.alert('Error', 'Failed to initialize Stripe portal');
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
          onPress: () => {
            const cancelData: StripeCancelSubscriptionData = {
              path: { subscription_id: subscription.stripe_subscription_id as string },
              url: "/api/v1/stripe/cancel-subscription/{subscription_id}"
            };
            cancelSubscription(cancelData);
          }
        }
      ]
    );
  };

  // Toggle upgrade options
  const handleUpgradeToggle = () => {
    setShowUpgradeOptions(!showUpgradeOptions);
    setSelectedProductId(null);
  };

  // Select a product for upgrade/downgrade
  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
  };

  // Format date for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Helper to safely get subscription status with proper capitalization
  const getFormattedStatus = (status?: unknown): string => {
    if (!status || typeof status !== 'string') return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Helper function to safely get a property from an unknown object
  const getProp = <T,>(obj: unknown, key: string, defaultValue: T): T => {
    if (typeof obj === 'object' && obj !== null && key in obj) {
      return (obj as Record<string, unknown>)[key] as T;
    }
    return defaultValue;
  };

  // Get proper subscription values with type handling
  const hasActiveSubscription = subscription ? getProp(subscription, 'has_active_subscription', false) : false;
  const subscriptionStatus: string = subscription ? getProp(subscription, 'status', 'unknown') : 'unknown';
  const currentPeriodEnd = subscription ? getProp(subscription, 'current_period_end', '') : '';
  const cancelAtPeriodEnd = subscription ? getProp(subscription, 'cancel_at_period_end', false) : false;
  const stripeSubscriptionId = subscription ? getProp(subscription, 'stripe_subscription_id', '') : '';

  // Get plan information
  const planName = subscription && typeof subscription === 'object' ?
    getProp(getProp(subscription, 'plan', {}), 'name', 'Premium Plan') :
    'Premium Plan';

  const planDescription = subscription && typeof subscription === 'object' ?
    getProp(getProp(subscription, 'plan', {}), 'description', 'Full access to all features') :
    'Full access to all features';

  // Get price information
  const priceAmount = subscription && typeof subscription === 'object' ?
    getProp(getProp(subscription, 'price', {}), 'amount', 0) :
    0;

  const priceCurrency = subscription && typeof subscription === 'object' ?
    getProp(getProp(subscription, 'price', {}), 'currency', 'USD') :
    'USD';

  const priceInterval = subscription && typeof subscription === 'object' ?
    getProp(getProp(subscription, 'price', {}), 'interval', 'month') :
    'month';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[tintColor]}
          tintColor={tintColor}
        />
      }
    >
      {/* Loading State */}
      {isLoadingSubscription && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tintColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>
            Loading subscription information...
          </Text>
        </View>
      )}

      {/* Error State */}
      {subscriptionError && (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: errorColor }]}>
            Error loading subscription
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: tintColor }]}
            onPress={() => refetchSubscription()}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Has Active Subscription */}
      {!isLoadingSubscription && !subscriptionError && hasActiveSubscription && (
        <View style={[styles.subscriptionCard, { backgroundColor: cardBackground, borderColor }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Current Subscription</Text>

          <View style={styles.subscriptionDetails}>
            <Text style={[styles.planName, { color: textColor }]}>
              {planName}
            </Text>

            <Text style={[styles.planDescription, { color: textColor }]}>
              {planDescription}
            </Text>

            <View style={[styles.infoRow, { borderColor }]}>
              <Text style={[styles.infoLabel, { color: textColor }]}>Status:</Text>
              <Text style={[
                styles.infoValue,
                {
                  color: subscriptionStatus === 'active' ? '#10b981' :
                         subscriptionStatus === 'past_due' ? '#f59e0b' : '#ef4444'
                }
              ]}>
                {getFormattedStatus(subscriptionStatus)}
              </Text>
            </View>

            <View style={[styles.infoRow, { borderColor }]}>
              <Text style={[styles.infoLabel, { color: textColor }]}>Price:</Text>
              <Text style={[styles.infoValue, { color: tintColor }]}>
                {priceAmount
                  ? `$${(priceAmount / 100).toFixed(2)} ${priceCurrency?.toUpperCase() || 'USD'}`
                  : 'N/A'
                }
                {priceInterval ? ` / ${priceInterval}` : ''}
              </Text>
            </View>

            <View style={[styles.infoRow, { borderColor }]}>
              <Text style={[styles.infoLabel, { color: textColor }]}>Renewal Date:</Text>
              <Text style={[styles.infoValue, { color: textColor }]}>
                {formatDate(currentPeriodEnd as string)}
              </Text>
            </View>
          </View>

          {cancelAtPeriodEnd && currentPeriodEnd && (
            <View style={styles.cancelNotice}>
              <Text style={styles.cancelText}>
                Your subscription will end on {formatDate(currentPeriodEnd as string)}
              </Text>
            </View>
          )}

          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: tintColor }]}
              onPress={handleManageInPortal}
              disabled={isCreatingPortal}
            >
              {isCreatingPortal ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Manage in Stripe Portal</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.outlineButton, { borderColor: tintColor }]}
              onPress={handleUpgradeToggle}
            >
              <Text style={[styles.outlineButtonText, { color: tintColor }]}>
                {showUpgradeOptions ? 'Hide Plans' : 'Change Plan'}
              </Text>
            </TouchableOpacity>

            {cancelAtPeriodEnd === false && (
              <TouchableOpacity
                style={[styles.dangerButton]}
                onPress={handleCancelSubscription}
                disabled={isCanceling}
              >
                {isCanceling ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.buttonText}>Cancel Subscription</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* No Active Subscription */}
      {!isLoadingSubscription && !subscriptionError && subscription && !hasActiveSubscription && (
        <View style={[styles.subscriptionCard, { backgroundColor: cardBackground, borderColor }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Subscription</Text>
          <Text style={[styles.noSubscriptionText, { color: textColor }]}>
            You don't have an active subscription. Subscribe to access premium features.
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: tintColor }]}
            onPress={handleUpgradeToggle}
          >
            <Text style={styles.buttonText}>
              {showUpgradeOptions ? 'Hide Plans' : 'View Subscription Plans'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Available Plans Section */}
      {showUpgradeOptions && (
        <View style={[styles.plansCard, { backgroundColor: cardBackground, borderColor }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Available Plans</Text>

          {(isLoadingAvailableSubscriptions || isLoadingProducts) ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={tintColor} />
              <Text style={[styles.loadingText, { color: textColor }]}>Loading plans...</Text>
            </View>
          ) : (
            // If we have available subscriptions data, use that first
            availableSubscriptions && Array.isArray(availableSubscriptions) && availableSubscriptions.length > 0 ? (
              <View style={styles.plansList}>
                {availableSubscriptions.map((sub: any, index: number) => (
                  <TouchableOpacity
                    key={typeof sub.id === 'string' ? sub.id : `subscription-${index}`}
                    style={[
                      styles.planItem,
                      selectedProductId === sub.id && styles.selectedPlanItem,
                      { borderColor }
                    ]}
                    onPress={() => typeof sub.id === 'string' ? handleSelectProduct(sub.id) : null}
                  >
                    <Text style={[styles.planItemName, { color: textColor }]}>
                      {typeof sub.name === 'string' ? sub.name : `Plan ${index + 1}`}
                    </Text>
                    {typeof sub.description === 'string' && (
                      <Text style={[styles.planItemDescription, { color: textColor }]}>
                        {sub.description}
                      </Text>
                    )}

                    {/* Display Prices */}
                    {Array.isArray(sub.prices) && sub.prices.length > 0 && (
                      <View style={styles.pricesList}>
                        {sub.prices.map((price: any, priceIndex: number) => (
                          <View key={`price-${priceIndex}`} style={styles.priceItem}>
                            <Text style={[styles.priceText, { color: tintColor }]}>
                              ${typeof price.amount === 'number' ? price.amount.toFixed(2) : '0.00'}
                              {typeof price.currency === 'string' ? ` ${price.currency.toUpperCase()}` : ' USD'} /
                              {typeof price.interval === 'string' ? price.interval : 'month'}
                            </Text>

                            {typeof price.id === 'string' && (
                              <StripePaymentForm
                                priceId={price.id}
                                useCheckout={true}
                                onPaymentSuccess={() => {
                                  refetchSubscription();
                                  setShowUpgradeOptions(false);
                                }}
                              />
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : products && Array.isArray(products) && products.length > 0 ? (
              // Fallback to products data if available subscriptions not available
              <View style={styles.plansList}>
                {products.map((product: any, index: number) => (
                  <TouchableOpacity
                    key={typeof product.id === 'string' ? product.id : `product-${index}`}
                    style={[
                      styles.planItem,
                      selectedProductId === product.id && styles.selectedPlanItem,
                      { borderColor }
                    ]}
                    onPress={() => typeof product.id === 'string' ? handleSelectProduct(product.id) : null}
                  >
                    <Text style={[styles.planItemName, { color: textColor }]}>
                      {typeof product.name === 'string' ? product.name : `Product ${index + 1}`}
                    </Text>
                    {typeof product.description === 'string' && (
                      <Text style={[styles.planItemDescription, { color: textColor }]}>
                        {product.description}
                      </Text>
                    )}

                    {/* If this product is selected, show prices */}
                    {selectedProductId === product.id && (
                      <View style={styles.pricesList}>
                        {isLoadingPrices ? (
                          <ActivityIndicator size="small" color={tintColor} />
                        ) : prices && Array.isArray(prices) && prices.length > 0 ? (
                          prices.map((price: any, priceIndex: number) => (
                            <View key={`price-${priceIndex}`} style={styles.priceItem}>
                              <Text style={[styles.priceText, { color: tintColor }]}>
                                ${typeof price.unit_amount === 'number' ? (price.unit_amount / 100).toFixed(2) : '0.00'}
                                {typeof price.currency === 'string' ? ` ${price.currency.toUpperCase()}` : ' USD'} /
                                {typeof price.recurring === 'object' && price.recurring && typeof price.recurring.interval === 'string'
                                  ? price.recurring.interval
                                  : 'month'}
                              </Text>

                              {typeof price.id === 'string' && (
                                <StripePaymentForm
                                  priceId={price.id}
                                  useCheckout={true}
                                  onPaymentSuccess={() => {
                                    refetchSubscription();
                                    setShowUpgradeOptions(false);
                                  }}
                                />
                              )}
                            </View>
                          ))
                        ) : (
                          <Text style={[styles.noDataText, { color: textColor }]}>
                            No pricing options available
                          </Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={[styles.noDataText, { color: textColor }]}>
                No subscription plans available
              </Text>
            )
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  subscriptionCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  plansCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subscriptionDetails: {
    marginBottom: 16,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 16,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  cancelNotice: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  cancelText: {
    color: '#B91C1C',
    textAlign: 'center',
  },
  actionsContainer: {
    gap: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  outlineButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  outlineButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  dangerButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
  },
  noSubscriptionText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  plansList: {
    gap: 12,
  },
  planItem: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  selectedPlanItem: {
    borderWidth: 2,
  },
  planItemName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  planItemDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  pricesList: {
    marginTop: 12,
    gap: 8,
  },
  priceItem: {
    marginBottom: 8,
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noDataText: {
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  }
});

export default SubscriptionManager;
