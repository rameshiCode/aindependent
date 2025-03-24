import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useStripe, initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { useRouter } from 'expo-router';
import { StripeService } from '../src/client';
import { useMutation } from '@tanstack/react-query';
import { createPaymentIntentMutation, confirmSubscriptionMutation } from '../src/client/@tanstack/react-query.gen';

interface StripePaymentFormProps {
  priceId: string;
  onPaymentSuccess?: (subscriptionId: string) => void;
  isLoading?: boolean;
  useCheckout?: boolean; // Add this prop to support both approaches
}

const StripePaymentForm: React.FC<StripePaymentFormProps> = ({
  priceId,
  onPaymentSuccess,
  isLoading = false,
  useCheckout = false, // Default to false (use PaymentSheet)
}) => {
  const stripe = useStripe();
  const router = useRouter();
  const [isStripeInitialized, setIsStripeInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false); // Add this to prevent infinite loop

  // Create payment intent mutation
  const paymentIntentMutation = useMutation(createPaymentIntentMutation());

  // Confirm subscription mutation
  const subscriptionMutation = useMutation(confirmSubscriptionMutation());

  // Check if Stripe is ready
  useEffect(() => {
    if (stripe) {
      setIsStripeInitialized(true);
    }
  }, [stripe]);

  // Initialize payment sheet when Stripe is ready and not already initialized
  useEffect(() => {
    // Only initialize if Stripe is ready and we haven't initialized yet
    if (isStripeInitialized && !isInitialized && !useCheckout) {
      setIsInitialized(true); // Mark as initialized to prevent repeated calls
      initializePaymentSheet();
    }
  }, [isStripeInitialized, isInitialized, priceId, useCheckout]);

  const initializePaymentSheet = async () => {
    try {
      setError(null);
      setIsSubmitting(true);

      // Create payment intent
      const data = await paymentIntentMutation.mutateAsync({
        body: {
          price_id: priceId,
          setup_future_usage: "off_session",
          metadata: {
            source: "mobile_app"
          }
        }
      });

      if (!data) {
        throw new Error("Failed to create payment intent");
      }

      // Save payment intent ID for later confirmation
      if (data.client_secret) {
        setPaymentIntentId(data.client_secret.split('_secret_')[0]);
      }

      // Initialize payment sheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "AI Independent",
        customerId: data.customer_id,
        customerEphemeralKeySecret: data.ephemeral_key,
        paymentIntentClientSecret: data.client_secret,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {
          name: 'Default Name', // You can customize this with user data
        }
      });

      if (initError) {
        throw new Error(initError.message);
      }

      setIsSubmitting(false);
    } catch (e: any) {
      console.error('Payment sheet initialization error:', e);
      setError(`Failed to initialize payment: ${e.message}`);
      setIsSubmitting(false);
    }
  };

  // Handle checkout approach (for backward compatibility)
// In StripePaymentForm.tsx
const handleCheckout = async () => {
  try {
    setError(null);
    setIsSubmitting(true);

    // Use valid URLs for Stripe checkout
    const { data } = await StripeService.createCheckoutSession({
      body: {
        price_id: priceId,
        success_url: `https://example.com/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `https://example.com/cancel`,
      },
      throwOnError: true
    }) ;

    // Check what fields are actually in your response
    console.log("Checkout session response:", data);
    // Add this to your handleCheckout function
    console.log("Full checkout response:", JSON.stringify(data, null, 2));


    // Try different possible field names
    const checkoutUrl = data?.checkout_url || data?.url || data?.session_url;

    if (checkoutUrl && typeof checkoutUrl === 'string') {
      router.push(`/web-view?url=${encodeURIComponent(checkoutUrl)}`);
    } else {
      throw new Error("No checkout URL returned or URL is not a string");
    }

    setIsSubmitting(false);
  } catch (e: any) {
    console.error('Checkout error:', e);
    setError(`Failed to start checkout: ${e.message}`);
    setIsSubmitting(false);
  }
};


  const handlePayPress = async () => {
    // If using checkout approach, use that instead of PaymentSheet
    if (useCheckout) {
      await handleCheckout();
      return;
    }

    try {
      setError(null);
      setIsSubmitting(true);

      // Present payment sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          // User canceled the payment - not an error
          setIsSubmitting(false);
          return;
        }
        throw new Error(presentError.message);
      }

      // Payment successful, confirm subscription
      if (paymentIntentId) {
        const result = await subscriptionMutation.mutateAsync({
          query: {
            payment_intent_id: paymentIntentId
          }
        });

        if (result && onPaymentSuccess) {
          // Ensure we're passing a string to onPaymentSuccess
          const subscriptionId = typeof result.subscription_id === 'string'
            ? result.subscription_id
            : typeof result.id === 'string'
              ? result.id
              : String(result.subscription_id || result.id || "");
          onPaymentSuccess(subscriptionId);
        }

        Alert.alert(
          "Subscription Successful",
          "Your subscription has been activated successfully!",
          [{ text: "OK" }]
        );
      } else {
        throw new Error("Payment intent ID not found");
      }

      setIsSubmitting(false);
    } catch (e: any) {
      console.error('Payment error:', e);
      setError(`Payment failed: ${e.message}`);
      setIsSubmitting(false);
    }
  };

  // Show loading state if Stripe is not initialized and we're not using checkout
  if (!isStripeInitialized && !useCheckout) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Initializing payment system...</Text>
        <ActivityIndicator size="small" color="#5469D4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {__DEV__ && (
        <View style={styles.testModeContainer}>
          <Text style={styles.testModeTitle}>⚠️ Test Mode</Text>
          <Text style={styles.testCardText}>
            You can use test card 4242 4242 4242 4242 with any future expiry date and CVC.
          </Text>
        </View>
      )}

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          (isLoading || isSubmitting || paymentIntentMutation.isPending) && styles.buttonDisabled
        ]}
        onPress={handlePayPress}
        disabled={isLoading || isSubmitting || paymentIntentMutation.isPending}
      >
        {(isLoading || isSubmitting || paymentIntentMutation.isPending) ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Subscribe Now</Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  loadingText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    color: '#FF4444',
    marginTop: 8,
    marginBottom: 16,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#5469D4',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  testModeContainer: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FBBF24',
  },
  testModeTitle: {
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#92400E',
  },
  testCardText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#78350F',
  },
});

export default StripePaymentForm;
