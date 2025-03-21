import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import {
  getSubscriptionStatusOptions,
  getProductsOptions,
  getProductPricesOptions,
  createSubscriptionWithPaymentMethodMutation,
  createPortalSessionMutation,
} from '@/src/client/@tanstack/react-query.gen';

import {
  StripeGetSubscriptionStatusResponse,
  StripeGetProductsResponse,
  StripeGetProductPricesResponse
} from '@/src/client/types.gen';

// import StripePaymentForm from '../../components/StripePaymentForm';
import * as SecureStore from 'expo-secure-store';
import { StripeService } from '@/src/client/sdk.gen';

// DEVELOPMENT ONLY - Replace with real auth in production
const DEV_AUTH_TOKEN = "your-dev-jwt-token-here"; // Get this from your backend developer

// Type definitions
interface StripeProduct {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  images?: string[];
  default_price?: string;
  object: string;
  created: number;
  metadata: Record<string, unknown>;
}

interface StripePrice {
  id: string;
  unit_amount: number;
  currency: string;
  nickname?: string;
  recurring?: {
    interval: 'day' | 'week' | 'month' | 'year';
    interval_count: number;
  };
}

// Local QueryClient with improved configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3, // Increased from 1 to 3 for better reliability
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute stale time to reduce unnecessary refetches
      cacheTime: 300000, // 5 minutes cache time
    },
  },
});

// Helper function to safely check if a value is an array
const isValidArray = (value: any): boolean => {
  return Array.isArray(value) && value.length > 0;
};

// Helper function to safely extract data from API responses
const extractArrayData = (data: any): any[] => {
  if (!data) return [];

  // Handle if data is already an array
  if (Array.isArray(data)) return data;

  // Handle if data is wrapped in a data property
  if (data?.data && Array.isArray(data.data)) return data.data;

  // Handle if data is in results property
  if (data?.results && Array.isArray(data.results)) return data.results;

  // If data is an object but not recognized format, try to extract values
  if (typeof data === 'object' && data !== null) {
    console.log('Attempting to extract values from object:', Object.keys(data));
    // Try to find any array in the object
    for (const key in data) {
      if (Array.isArray(data[key]) && data[key].length > 0) {
        console.log(`Found array in key '${key}' with ${data[key].length} items`);
        return data[key];
      }
    }
  }

  // If we can't find an array, log and return empty array
  console.error('Could not extract array data from:', JSON.stringify(data).substring(0, 200));
  return [];
};

// Wrapper component with QueryClientProvider
export default function SubscriptionWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <SubscriptionScreen />
    </QueryClientProvider>
  );
}

// Main component
function SubscriptionScreen() {
  // State
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [isCreatingSubscriptionState, setIsCreatingSubscriptionState] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [directApiProducts, setDirectApiProducts] = useState<any[]>([]);

  // Handle price selection
  const handleSelectPrice = (priceId: string) => {
    setSelectedPriceId(priceId);
    setShowPaymentForm(true);
  };

  // Reset payment form when switching products
  useEffect(() => {
    if (selectedProductId) {
      setShowPaymentForm(false);
      setSelectedPriceId(null);
    }
  }, [selectedProductId]);

  // Queries
  const {
    data: subscriptionStatus,
    isLoading: statusLoading,
    refetch: refetchStatus
  } = useQuery(getSubscriptionStatusOptions());

  // Products query with improved error handling
  const productsOptions = getProductsOptions();
  const {
    data: productsData,
    isLoading: productsLoading,
    error: productsError,
    refetch: refetchProducts
  } = useQuery({
    ...productsOptions,
    staleTime: 60000, // 1 minute
    retry: 3,
  });

  // Add success and error handlers with useEffect instead
  useEffect(() => {
    if (productsData) {
      console.log('Products API success, data type:', typeof productsData);
      console.log('Products sample:', JSON.stringify(productsData).substring(0, 200) + '...');
    }
  }, [productsData]);

  useEffect(() => {
    if (productsError) {
      console.error('Products fetch error:', productsError);
      const errorMessage =
        (productsError as any)?.response?.data?.message ||
        (productsError as Error)?.message ||
        'Unknown error';
      setLoadError(`Failed to load subscription plans: ${errorMessage}`);

      // Log more details about the error
      if ((productsError as any).response) {
        console.error('Error response:', (productsError as any).response.status, (productsError as any).response.data);
      }
    }
  }, [productsError]);

  // Ensure products is always defined
  const products = productsData || [];

  // Prices query
  const {
    data: prices,
    isLoading: pricesLoading,
    error: pricesError,
    refetch: refetchPrices
  } = useQuery({
    ...getProductPricesOptions({
      path: { product_id: selectedProductId || '' }
    }),
    enabled: !!selectedProductId,
    onError: (error: any) => {
      console.error('Prices fetch error:', error);
      Alert.alert('Error', 'Failed to load pricing options: ' +
        (error?.message || 'Unknown error'));
    }
  });

  // Mutations
  const {
    mutate: createSubscription,
    isPending: isCreatingSubscription
  } = useMutation({
    ...createSubscriptionWithPaymentMethodMutation(),
    onSuccess: (data) => {
      Alert.alert(
        'Subscription Activated',
        `Your subscription has been successfully created! You now have access to premium features.`,
        [{ text: 'Great!', onPress: () => refetchStatus() }]
      );
      setShowPaymentForm(false);
      setSelectedProductId(null);
      setSelectedPriceId(null);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message
        || error?.message
        || 'There was a problem processing your subscription. Please try again.';

      console.error('Subscription error:', error);
      Alert.alert('Subscription Error', errorMessage, [{ text: 'OK' }]);
    }
  });

  const {
    mutate: createPortalSession,
    isPending: isCreatingPortal
  } = useMutation({
    ...createPortalSessionMutation(),
    onSuccess: (data) => {
      Alert.alert(
        'Portal Access',
        'In a real app, you would be redirected to the Stripe Customer Portal.',
        [{ text: 'OK' }]
      );
    }
  });

  // Direct API test for debugging
  useEffect(() => {
    const testProductsAPI = async () => {
      try {
        // This client should already handle authentication tokens
        const { data } = await StripeService.getProducts({
          throwOnError: true
        });

        console.log('Direct client test response:', JSON.stringify(data).substring(0, 200) + '...');
        setDirectApiProducts(Array.isArray(data) ? data : []);

        Alert.alert(
          'API Test Success',
          `Received ${Array.isArray(data) ? data.length : 'non-array'} products`
        );
      } catch (error) {
        console.error('API test error:', error);
        Alert.alert('API Test Error', error.message);
      }
    };

    // Uncomment this line to test direct API access
    // testProductsAPI();
  }, []);

  // Filter and sort products with improved handling
  const filteredProducts = React.useMemo<StripeProduct[]>(() => {
    // Extract products array safely with additional logging
    console.log('Processing products data of type:', typeof products);
    if (products === null || products === undefined) {
      console.log('Products is null/undefined, returning empty array');
      return [];
    }

    const productsArray = extractArrayData(products);
    console.log('Extracted products array length:', productsArray.length);

    try {
      // Apply less restrictive filtering with error handling
      return productsArray
        .filter(product => {
          if (!product) return false;
          console.log(`Product ${product?.id || 'unknown'}: active=${product?.active}`);
          return product.active === true;
        })
        .sort((a, b) => ((b?.created || 0) - (a?.created || 0)));
    } catch (err) {
      console.error('Error filtering products:', err);
      return [];
    }
  }, [products]);

  // Add comprehensive debugging logs
  useEffect(() => {
    console.log('=== SUBSCRIPTION DEBUG ===');
    console.log('Products data received:', products ? 'Yes' : 'No');

    if (products) {
      console.log('Products type:', typeof products);
      console.log('Is array:', Array.isArray(products));
      console.log('Length:', Array.isArray(products) ? products.length : 'N/A');
      console.log('Sample:', JSON.stringify(products).substring(0, 100) + '...');
    }

    console.log('Filtered products length:', filteredProducts.length);
    console.log('Direct API products length:', directApiProducts.length);
    console.log('=========================');
  }, [products, filteredProducts, directApiProducts]);

  // Handle payment method
  const handlePaymentMethod = async (paymentMethodId: string) => {
    try {
      setIsCreatingSubscriptionState(true);

      // Check authentication - replace with your actual auth check
      const hasAuth = true; // Replace with actual auth check
      if (!hasAuth) {
        Alert.alert('Authentication Required', 'You need to log in to create a subscription');
        return;
      }

      // Create subscription
      createSubscription({
        payment_method_id: paymentMethodId,
        price_id: selectedPriceId || ''
      });

    } catch (error: any) {
      console.error('Subscription creation failed:', error);
      Alert.alert('Subscription Error', `Failed to create subscription: ${error.message}`);
    } finally {
      setIsCreatingSubscriptionState(false);
    }
  };

  // Calculate active subscription status
  const hasActiveSubscription = subscriptionStatus?.has_active_subscription;

  // Handle portal session
  const handleManageSubscription = () => {
    Alert.alert(
      'Manage Subscription',
      'Would you like to manage your subscription?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => createPortalSession({
            query: { return_url: 'app://subscription' }
          })
        }
      ]
    );
  };

  // Loading state
  const isLoading = statusLoading || productsLoading ||
                    (selectedProductId && pricesLoading) ||
                    isCreatingSubscription ||
                    isCreatingPortal;

  // Error handling
  if (loadError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{loadError}</Text>
        <Pressable
          style={styles.retryButton}
          onPress={() => {
            setLoadError(null);
            refetchProducts();
          }}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5469D4" />
        <Text style={styles.loadingText}>
          {statusLoading ? 'Loading subscription information...' :
           productsLoading ? 'Loading available plans...' :
           pricesLoading ? 'Loading pricing options...' :
           isCreatingSubscription ? 'Creating your subscription...' :
           'Processing your request...'}
        </Text>
      </View>
    );
  }

  // Fallback to direct API products if query returns empty
  const displayProducts = (filteredProducts?.length > 0) ?
    filteredProducts :
    (directApiProducts?.filter(p => p?.active === true) || []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Subscription</Text>

      {/* Active Subscription Card */}
      {hasActiveSubscription ? (
        <View style={[styles.card, styles.activeSubscriptionCard]}>
          <View style={styles.activeSubscriptionHeader}>
            <Text style={styles.activeTitle}>Active Subscription</Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Plan: </Text>
            {formatPlanName(subscriptionStatus?.plan)}
          </Text>

          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Renews: </Text>
            {formatDate(subscriptionStatus?.current_period_end)}
          </Text>

          <Pressable
            style={({pressed}) => [
              styles.button,
              styles.manageButton,
              pressed && styles.buttonPressed,
              isCreatingPortal && styles.buttonDisabled
            ]}
            disabled={isCreatingPortal}
            onPress={handleManageSubscription}
          >
            {isCreatingPortal ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Manage Subscription</Text>
            )}
          </Pressable>
          {hasActiveSubscription && (
            <View style={styles.statusDetails}>
              <Text style={styles.statusLabel}>Status:
                <Text style={[styles.statusValue,
                  { color: formatStatusColor(subscriptionStatus?.status) }]}>
                  {' '}{formatStatus(subscriptionStatus?.status)}
                </Text>
              </Text>

              {typeof subscriptionStatus?.trial_end !== 'undefined' && subscriptionStatus.trial_end !== null && (
                <Text style={styles.trialText}>
                  Trial ends: {formatDate(subscriptionStatus.trial_end)}
                </Text>
              )}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.subscriptionSelectionContainer}>
          {/* Products List */}
          {productsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#5469D4" />
              <Text style={styles.loadingText}>Loading subscription plans...</Text>
            </View>
          ) : displayProducts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No subscription plans available</Text>
              <Text style={styles.emptyStateSubtext}>
                Please check back later or contact support
              </Text>
              <Pressable
                style={styles.retryButton}
                onPress={() => refetchProducts()}
              >
                <Text style={styles.buttonText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Select a Plan</Text>

              <FlatList
                data={displayProducts}
                keyExtractor={(item) => String(item.id)}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const hasImage = item.images && item.images.length > 0;

                  return (
                    <Pressable
                      onPress={() => {
                        setSelectedProductId(String(item.id));
                        setSelectedPriceId(null);
                        setShowPaymentForm(false);
                      }}
                    >
                      <View
                        style={[
                          styles.card,
                          selectedProductId === String(item.id) && styles.selectedCard
                        ]}
                      >
                        <View style={styles.productCardContent}>
                          {hasImage && (
                            <View style={styles.imageContainer}>
                              <Image
                                source={{ uri: item.images?.[0] }}
                                style={styles.productImage}
                                resizeMode="cover"
                              />
                            </View>
                          )}

                          <View style={styles.productInfo}>
                            <Text style={styles.cardTitle}>{String(item.name)}</Text>
                            <Text style={styles.cardDescription}>{String(item.description || '')}</Text>

                            {item.default_price && (
                              <View style={styles.defaultPriceBadge}>
                                <Text style={styles.defaultPriceText}>Recommended</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  );
                }}
              />

              {/* Price Selection */}
              {selectedProductId && (
                <View style={styles.pricesContainer}>
                  <Text style={styles.sectionTitle}>Select a Pricing Plan</Text>

                  {pricesLoading ? (
                    <ActivityIndicator size="small" color="#5469D4" style={styles.smallLoader} />
                  ) : !prices || !isValidArray(prices) ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>No pricing available</Text>
                      <Text style={styles.emptyStateSubtext}>
                        This product doesn't have any pricing options available yet.
                      </Text>
                      <Pressable
                        style={styles.retryButton}
                        onPress={() => {
                          setSelectedProductId(null);
                          refetchPrices();
                        }}
                      >
                        <Text style={styles.buttonText}>Select Different Plan</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <FlatList
                      data={extractArrayData(prices)}
                      keyExtractor={(item) => String(item.id)}
                      scrollEnabled={false}
                      renderItem={({ item }) => {
                        const amount = Number(item.unit_amount) || 0;
                        const currency = String(item.currency || 'usd').toUpperCase();
                        const interval = item.recurring?.interval || 'one-time';
                        const intervalCount = item.recurring?.interval_count || 1;

                        const intervalDisplay = interval === 'month' && intervalCount === 1
                          ? 'Monthly'
                          : interval === 'year' && intervalCount === 1
                            ? 'Yearly'
                            : `${intervalCount} ${interval}${intervalCount > 1 ? 's' : ''}`;

                        const savings = interval === 'year' ? '20% savings compared to monthly' : '';

                        return (
                          <Pressable onPress={() => handleSelectPrice(item.id)}>
                            <View
                              style={[
                                styles.card,
                                styles.priceCard,
                                selectedPriceId === String(item.id) && styles.selectedCard
                              ]}
                            >
                              <View style={styles.priceCardHeader}>
                                <Text style={styles.cardTitle}>
                                  ${(amount / 100).toFixed(2)} {currency}
                                </Text>
                                <Text style={styles.intervalText}>{intervalDisplay}</Text>
                              </View>

                              {item.nickname && (
                                <Text style={styles.nickNameText}>{String(item.nickname)}</Text>
                              )}

                              {savings && (
                                <Text style={styles.savingsText}>{savings}</Text>
                              )}
                              <Pressable
                                style={({pressed}) => [
                                  styles.button,
                                  pressed && styles.buttonPressed,
                                ]}
                                disabled={isCreatingSubscription}
                                onPress={() => handleSelectPrice(item.id)}
                              >
                                <Text style={styles.buttonText}>Subscribe</Text>
                              </Pressable>
                            </View>
                          </Pressable>
                        );
                      }}
                    />
                  )}
                </View>
              )}

              {/* Payment Form
              {showPaymentForm && (
                <View style={styles.paymentFormContainer}>
                  <Text style={styles.sectionTitle}>Payment Details</Text>
                   <StripePaymentForm
                    onPaymentMethodCreated={handlePaymentMethod}
                    isLoading={isCreatingSubscription}
                  />
                </View>
              )} */}
            </>
          )}
        </View>
      )}

      {/* Loading overlay */}
      {(statusLoading || productsLoading || isCreatingSubscription) && (
        <View style={styles.overlayLoader}>
          <ActivityIndicator size="large" color="#5469D4" />
        </View>
      )}

      {/* Debug section */}
      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Subscription Debug Info</Text>
          <Text>Products API call: {productsLoading ? 'Loading' :
            productsError ? 'Error: ' + (productsError as Error).message :
            products ? 'Success' : 'No data'}</Text>
          <Text>Products count: {Array.isArray(products) ? products.length :
            products ? 'Not an array' : 'N/A'}</Text>
          <Text>Filtered products: {filteredProducts.length}</Text>
          <Text>Direct API products: {directApiProducts.length}</Text>
          <Pressable
            style={styles.debugButton}
            onPress={() => {
              const productsData = JSON.stringify(products, null, 2);
              console.log('Raw products data:', productsData);
              Alert.alert('Products Debug', productsData.length > 1000 ?
                productsData.substring(0, 1000) + '...' : productsData);
            }}
          >
            <Text style={styles.buttonText}>Show Raw Products</Text>
          </Pressable>
          <Pressable
            style={styles.debugButton}
            onPress={() => refetchProducts()}
          >
            <Text style={styles.buttonText}>Refetch Products</Text>
          </Pressable>
          <Pressable
            style={styles.debugButton}
            onPress={async () => {
              try {
                // Configure client with development token
                // This should be replaced with real auth later
                if (!DEV_AUTH_TOKEN) {
                  Alert.alert("Error", "No development token configured");
                  return;
                }

                // Make direct API call using hardcoded token
                const response = await fetch('http://localhost:8000/api/v1/stripe/products', {
                  headers: {
                    'Authorization': `Bearer ${DEV_AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                  }
                });

                if (!response.ok) {
                  const errorText = await response.text();
                  throw new Error(`API error ${response.status}: ${errorText}`);
                }

                const data = await response.json();
                console.log('Direct fetch result:', data);
                setDirectApiProducts(Array.isArray(data) ? data : []);
                Alert.alert('Success', `Retrieved ${Array.isArray(data) ? data.length : 0} products`);
              } catch (err) {
                console.error('Direct API error:', err);
                Alert.alert('Error', err.message);
              }
            }}
          >
            <Text style={styles.buttonText}>Test With Dev Token</Text>
          </Pressable>
        </View>
      )}

      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Debug Info</Text>
          <Text>Selected Product: {selectedProductId || 'None'}</Text>
          <Text>Selected Price: {selectedPriceId || 'None'}</Text>
          <Text>Show Payment Form: {showPaymentForm ? 'Yes' : 'No'}</Text>
          <Text>Loading States: {JSON.stringify({
            status: statusLoading,
            products: productsLoading,
            prices: pricesLoading,
            creating: isCreatingSubscription
          })}</Text>
          <Pressable
            style={styles.debugButton}
            onPress={() => console.log('Products:', products)}
          >
            <Text style={styles.buttonText}>Log Products</Text>
          </Pressable>
        </View>
      )}

      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>API Response Debug</Text>
          <Text>Raw products type: {typeof productsData}</Text>
          <Text>Is null/undefined: {productsData === null || productsData === undefined ? 'Yes' : 'No'}</Text>
          <Text>Is empty array: {Array.isArray(productsData) && productsData.length === 0 ? 'Yes' : 'No'}</Text>
          <Pressable
            style={styles.debugButton}
            onPress={() => {
              // Test direct API call for debugging
              fetch('https://your-backend-url/api/v1/stripe/products', {
                headers: {
                  'Authorization': 'Bearer your-auth-token' // Replace with your auth
                }
              })
              .then(res => res.json())
              .then(data => {
                console.log('Direct fetch result:', data);
                Alert.alert('Direct API Result', JSON.stringify(data).substring(0, 500));
              })
              .catch(err => {
                console.error('Direct API error:', err);
                Alert.alert('Direct API Error', err.message);
              });
            }}
          >
            <Text style={styles.buttonText}>Test Direct API Call</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

// Helper functions
const formatDate = (value: unknown): string => {
  if (typeof value === 'string') {
    return new Date(value).toLocaleDateString();
  }
  return 'Unknown date';
};

const formatPlanName = (plan: unknown): string => {
  if (plan && typeof plan === 'object' && 'name' in plan) {
    return String(plan.name);
  }
  return 'Premium';
};

const formatStatus = (status: unknown): string => {
  return typeof status === 'string' ? status : 'Unknown';
};

const formatStatusColor = (status: unknown): string => {
  return status === 'active' ? '#4CAF50' : '#FFA726';
};

// Debug token function - replace with your actual auth check
const debugToken = async () => {
  // Simulate auth check
  return true;
};

const getDevToken = () => {
  // TEMPORARY: In production, this should use proper authentication
  // This is only for development testing
  return DEV_AUTH_TOKEN;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#5469D4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#1a1a1a',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 16,
    color: '#333',
  },
  card: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedCard: {
    borderColor: '#5469D4',
    borderWidth: 2,
    shadowColor: '#5469D4',
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  activeSubscriptionCard: {
    borderLeftWidth: 5,
    borderLeftColor: '#4CAF50',
    paddingLeft: 16,
  },
  activeSubscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  activeBadge: {
    backgroundColor: '#4CAF50',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  detailText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#333',
  },
  detailLabel: {
    fontWeight: '600',
    color: '#666',
  },
  button: {
    backgroundColor: '#5469D4',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  manageButton: {
    backgroundColor: '#5469D4',
  },
  buttonPressed: {
    backgroundColor: '#4A5BC0',
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    backgroundColor: '#A3B0E6',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  subscriptionSelectionContainer: {
    marginTop: 8,
  },
  productCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 16,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  defaultPriceBadge: {
    backgroundColor: '#5469D4',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  defaultPriceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  pricesContainer: {
    marginTop: 8,
  },
  priceCard: {
    paddingVertical: 16,
  },
  priceCardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  intervalText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  nickNameText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  savingsText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '500',
    marginTop: 8,
  },
  paymentFormContainer: {
    marginTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: 'white',
    borderRadius: 12,
    marginTop: 24,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginTop: 8,
  },
  smallLoader: {
    marginVertical: 20,
  },
  noDataText: {
    textAlign: 'center',
    color: '#777',
    padding: 20,
  },
  overlayLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  statusDetails: {
    marginTop: 16,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  trialText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  debugContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  debugButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#5469D4',
    borderRadius: 8,
    alignItems: 'center',
  },
});
