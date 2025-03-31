// components/SubscriptionManager.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  getSubscriptionStatusOptions,
  getProductsOptions,
  getProductPricesOptions,
  createPortalSessionOptions,
  cancelSubscriptionOptions
} from '../src/client/@tanstack/react-query.gen';

export const SubscriptionManager = ({ onComplete }) => {
  const [showUpgradeOptions, setShowUpgradeOptions] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);

  // Get current subscription
  const {
    data: subscription,
    isLoading: isLoadingSubscription,
    refetch: refetchSubscription
  } = useQuery(getSubscriptionStatusOptions());

  // Get available products for upgrade
  const {
    data: products,
    isLoading: isLoadingProducts
  } = useQuery(getProductsOptions(), {
    enabled: showUpgradeOptions
  });

  // Get prices for selected product
  const {
    data: prices,
    isLoading: isLoadingPrices
  } = useQuery(getProductPricesOptions(selectedProductId), {
    enabled: !!selectedProductId
  });

  // Create portal session mutation
  const { mutate: createPortalSession, isLoading: isCreatingPortal } = useMutation(
    createPortalSessionOptions({
      return_url: 'your-app-scheme://subscription'
    }),
    {
      onSuccess: (data) => {
        // Open the portal URL in a WebView or browser
        if (data?.url) {
          // Navigate to WebView with portal URL
          // For example: router.push({ pathname: '/portal-webview', params: { url: data.url } });
          Alert.alert('Portal Created', `Portal URL: ${data.url}`);
        }
      },
      onError: (error) => {
        Alert.alert('Error', `Failed to create portal: ${error.message}`);
      }
    }
  );

  // Cancel subscription mutation
  const { mutate: cancelSubscription, isLoading: isCanceling } = useMutation(
    (subscriptionId) => cancelSubscriptionOptions(subscriptionId),
    {
      onSuccess: () => {
        Alert.alert(
          'Subscription Canceled',
          'Your subscription has been canceled and will end at the current billing period.',
          [{ text: 'OK', onPress: refetchSubscription }]
        );
      },
      onError: (error) => {
        Alert.alert('Error', `Failed to cancel subscription: ${error.message}`);
      }
    }
  );

  const handleManageInPortal = () => {
    createPortalSession();
  };

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

  const handleUpgrade = () => {
    setShowUpgradeOptions(!showUpgradeOptions);
  };

  const handleSelectProduct = (productId) => {
    setSelectedProductId(productId);
  };

  const handleSelectPrice = (priceId) => {
    // Navigate to checkout with this price
    // For example: router.push({ pathname: '/checkout', params: { priceId } });
    Alert.alert('Selected Price', `Price ID: ${priceId}`);
  };

  if (isLoadingSubscription) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={styles.loadingText}>Loading subscription info...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {subscription?.has_active_subscription ? (
        <View>
          <View style={styles.subscriptionDetails}>
            <Text style={styles.planName}>{subscription.plan?.name || 'Premium Plan'}</Text>
            <Text style={styles.planDescription}>{subscription.plan?.description || 'Full access to all features'}</Text>
            <Text style={styles.priceInfo}>
              {subscription.price?.amount ? `${subscription.price.amount.toFixed(2)} ${subscription.price.currency.toUpperCase()}` : 'Price info unavailable'}
              {subscription.price?.interval ? ` / ${subscription.price.interval}` : ''}
            </Text>
            <Text style={styles.renewalInfo}>
              {subscription.cancel_at_period_end
                ? `Your subscription will end on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                : `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleManageInPortal}
            disabled={isCreatingPortal}
          >
            {isCreatingPortal ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.buttonText}>Manage in Stripe Portal</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={handleUpgrade}
          >
            <Text style={styles.buttonText}>
              {showUpgradeOptions ? 'Hide Upgrade Options' : 'Upgrade Plan'}
            </Text>
          </TouchableOpacity>

          {!subscription.cancel_at_period_end && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelSubscription}
              disabled={isCanceling}
            >
              {isCanceling ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.buttonText}>Cancel Subscription</Text>
              )}
            </TouchableOpacity>
          )}

          {showUpgradeOptions && (
            <View style={styles.upgradeOptions}>
              <Text style={styles.upgradeTitle}>Available Plans</Text>

              {isLoadingProducts ? (
                <ActivityIndicator size="small" color="#6200ee" />
              ) : (
                products?.map(product => (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.productItem}
                    onPress={() => handleSelectProduct(product.id)}
                  >
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productDescription}>{product.description}</Text>
                  </TouchableOpacity>
                ))
              )}

              {selectedProductId && (
                <View style={styles.priceOptions}>
                  <Text style={styles.pricesTitle}>Select a Plan:</Text>

                  {isLoadingPrices ? (
                    <ActivityIndicator size="small" color="#6200ee" />
                  ) : (
                    prices?.map(price => (
                      <TouchableOpacity
                        key={price.id}
                        style={styles.priceItem}
                        onPress={() => handleSelectPrice(price.id)}
                      >
                        <Text style={styles.priceText}>
                          {price.unit_amount / 100} {price.currency.toUpperCase()} / {price.recurring.interval}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      ) : (
        <Text style={styles.noSubscriptionText}>You don't have an active subscription.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  subscriptionDetails: {
    marginBottom: 20,
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
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#6200ee',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: '#cf6679',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  noSubscriptionText: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 16,
  },
  upgradeOptions: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#2c2c2c',
    borderRadius: 8,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  productItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    marginBottom: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  productDescription: {
    fontSize: 14,
    color: '#ccc',
  },
  priceOptions: {
    marginTop: 16,
  },
  pricesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  priceItem: {
    padding: 12,
    backgroundColor: '#3c3c3c',
    borderRadius: 6,
    marginBottom: 8,
  },
  priceText: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
  },
});
