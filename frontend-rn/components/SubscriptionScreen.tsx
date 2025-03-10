import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import axios from 'axios';
import { OpenAPI } from '@/src/client';

// Only import Stripe on Android
const stripeModule = Platform.OS === 'android' ? require('@stripe/stripe-react-native') : null;

// Simple type for subscription pricing
type SubscriptionPrice = {
  id: string;
  product_name: string;
  product_description: string | null;
  unit_amount: number;
  currency: string;
  interval: string;
};

// Simple context with function types
const SubscriptionContext = createContext({
  isLoading: true,
  hasActiveSubscription: false,
  refreshSubscriptionStatus: async (): Promise<void> => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

// Fix the children typing with ReactNode
export const SubscriptionProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  const refreshSubscriptionStatus = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${OpenAPI.BASE}/api/v1/stripe/subscription`);
      setHasActiveSubscription(response.data.has_active_subscription);
    } catch (error) {
      console.error('Failed to check subscription status', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSubscriptionStatus();
  }, []);

  return (
    <SubscriptionContext.Provider 
      value={{ isLoading, hasActiveSubscription, refreshSubscriptionStatus }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

// Subscription screen component
export function SubscriptionScreen() {
  const { isLoading, hasActiveSubscription, refreshSubscriptionStatus } = useSubscription();
  const [prices, setPrices] = useState<SubscriptionPrice[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  // Fetch available subscription prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        setLoadingPrices(true);
        const response = await axios.get(`${OpenAPI.BASE}/api/v1/stripe/prices`);
        setPrices(response.data);
      } catch (error) {
        console.error('Failed to fetch prices', error);
        Alert.alert('Error', 'Failed to load subscription options');
      } finally {
        setLoadingPrices(false);
      }
    };

    fetchPrices();
  }, []);

  // Handle subscription purchase
  const handleSubscribe = async (priceId: string) => {
    try {
      setProcessingPayment(true);
      
      // Create the checkout session
      const response = await axios.post(`${OpenAPI.BASE}/api/v1/stripe/create-checkout-session`, {
        price_id: priceId,
        success_url: 'yourapp://subscription-success',
        cancel_url: 'yourapp://subscription-cancel',
      });
      
      // Open the checkout URL in a browser
      if (response.data.url) {
        await Linking.openURL(response.data.url);
      }
    } catch (error) {
      console.error('Payment failed', error);
      Alert.alert('Error', 'Payment process failed');
    } finally {
      setProcessingPayment(false);
    }
  };

  // Handle opening customer portal
  const handleManageSubscription = async () => {
    try {
      setProcessingPayment(true);
      
      // Create the portal session
      const response = await axios.post(`${OpenAPI.BASE}/api/v1/stripe/create-portal-session`, {
        return_url: 'yourapp://subscription-return',
      });
      
      // Open the portal URL
      if (response.data.url) {
        await Linking.openURL(response.data.url);
      }
    } catch (error) {
      console.error('Failed to open customer portal', error);
      Alert.alert('Error', 'Could not open subscription management');
    } finally {
      setProcessingPayment(false);
    }
  };

  if (isLoading || loadingPrices) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading subscription options...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {hasActiveSubscription 
          ? 'You have an active subscription!' 
          : 'Subscribe to Premium Features'}
      </Text>
      
      {hasActiveSubscription ? (
        <TouchableOpacity 
          style={styles.manageButton} 
          onPress={handleManageSubscription}
          disabled={processingPayment}
        >
          {processingPayment ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Manage Subscription</Text>
          )}
        </TouchableOpacity>
      ) : (
        <>
          <Text style={styles.subtitle}>Choose a subscription plan:</Text>
          
          {prices.map((price) => (
            <TouchableOpacity
              key={price.id}
              style={styles.priceButton}
              onPress={() => handleSubscribe(price.id)}
              disabled={processingPayment}
            >
              <Text style={styles.priceName}>{price.product_name}</Text>
              <Text style={styles.priceDetails}>
                {(price.unit_amount / 100).toFixed(2)} {price.currency.toUpperCase()} / {price.interval}
              </Text>
              {price.product_description && (
                <Text style={styles.priceDescription}>{price.product_description}</Text>
              )}
            </TouchableOpacity>
          ))}
        </>
      )}
      
      <TouchableOpacity 
        style={styles.refreshButton} 
        onPress={refreshSubscriptionStatus}
        disabled={isLoading}
      >
        <Text style={styles.refreshButtonText}>Refresh Status</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 15,
  },
  priceButton: {
    width: '100%',
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  priceName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  priceDetails: {
    fontSize: 16,
    marginTop: 5,
  },
  priceDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  manageButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  refreshButton: {
    marginTop: 20,
    padding: 10,
  },
  refreshButtonText: {
    color: '#2196F3',
    fontSize: 16,
  },
});