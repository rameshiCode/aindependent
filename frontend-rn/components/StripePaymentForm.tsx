import React, { useState, useEffect } from 'react';
import { View, TextInput, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { CardField, useStripe, CardFieldInput } from '@stripe/stripe-react-native';
import { useRouter } from 'expo-router';
import { StripeService } from '../src/client';
import { useMutation } from '@tanstack/react-query';
import { createCheckoutSessionMutation } from '../src/client/@tanstack/react-query.gen';


interface StripePaymentFormProps {
  priceId: string;
  onPaymentMethodCreated?: (paymentMethodId: string) => void;
  isLoading?: boolean;
  useCheckout?: boolean; // Whether to use Stripe Checkout or direct payment
}

const StripePaymentForm: React.FC<StripePaymentFormProps> = ({
  priceId,
  onPaymentMethodCreated,
  isLoading = false,
  useCheckout = true,
}) => {
  const stripe = useStripe();
  const router = useRouter();
  const { createPaymentMethod } = stripe;

  const [cardComplete, setCardComplete] = useState(false);
  const [cardDetails, setCardDetails] = useState<CardFieldInput.Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStripeReady, setIsStripeReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if Stripe SDK is initialized
  useEffect(() => {
    if (stripe) {
      console.log('Stripe SDK is ready');
      setIsStripeReady(true);
    } else {
      console.log('Stripe SDK is not initialized');
    }
  }, [stripe]);

  // Debug logging
  useEffect(() => {
    console.log('=====================');
    console.log('Stripe Payment Form Debug');
    console.log('Stripe initialized:', isStripeReady ? 'Yes' : 'No');
    console.log('Card Complete:', cardComplete);
    console.log('Card Details:', cardDetails ? {
      brand: cardDetails.brand,
      last4: cardDetails.last4,
      expiryMonth: cardDetails.expiryMonth,
      expiryYear: cardDetails.expiryYear,
      complete: cardDetails.complete,
    } : 'None');
    console.log('=====================');
  }, [cardDetails, cardComplete, isStripeReady]);

  // Handle direct payment method creation
  const handleDirectPayment = async () => {
    try {
      console.log('Card complete status:', cardComplete);
      if (!cardComplete) {
        console.log('Card is incomplete, showing error');
        setError('Please complete the card details');
        return;
      }

      setError(null);
      setIsSubmitting(true);
      console.log('Creating payment method...');

      // Create payment method
      const result = await createPaymentMethod({
        paymentMethodType: 'Card',
      });

      console.log('Payment method result:', result);
      if (result.error) {
        console.log('Payment method error:', result.error);
        setError(result.error.message);
      } else if (result.paymentMethod) {
        console.log('Payment method created:', result.paymentMethod.id);
        if (onPaymentMethodCreated) {
          onPaymentMethodCreated(result.paymentMethod.id);
        }
      }
    } catch (e: any) {
      console.error('Payment form error details:', e);
      setError(`An unexpected error occurred: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
const checkoutMutation = useMutation(createCheckoutSessionMutation());
// Handle Stripe Checkout
// Handle Stripe Checkout
const handleCheckout = async () => {
    try {
      setError(null);
      setIsSubmitting(true);
      
      // Use your app's scheme from app.json
      const baseUrl = "com.anonymous.aindependenta://";
      
      const { data } = await StripeService.createCheckoutSession({
        body: {
          price_id: priceId,
          success_url: `${baseUrl}subscription-success`,
          cancel_url: `${baseUrl}subscription-cancel`,
        },
        throwOnError: true
      });
      
      // Add type checking
      if (data && typeof data.url === 'string') {
        router.push(`/web-view?url=${encodeURIComponent(data.url)}`);
      } else {
        setError('Failed to create checkout session');
      }
    } catch (e: any) {
      console.error('Checkout error:', e);
      setError(`Failed to start checkout: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  

  // Handle payment button press
  const handlePayPress = async () => {
    if (useCheckout) {
      await handleCheckout();
    } else {
      await handleDirectPayment();
    }
  };

  // Show loading state if Stripe is not initialized
  if (!isStripeReady) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Initializing payment system...</Text>
        <ActivityIndicator size="small" color="#5469D4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Card Information</Text>

      {__DEV__ && (
        <View style={styles.testModeContainer}>
          <Text style={styles.testModeTitle}>⚠️ Test Mode Shortcut</Text>
          <Pressable
            style={styles.testModeButton}
            onPress={() => {
              console.log('Using test card without form');
              // This simulates a successful card completion
              setCardComplete(true);
              setCardDetails({
                complete: true,
                brand: 'Visa',
                last4: '4242',
                expiryMonth: 12,
                expiryYear: 2030,
                postalCode: '12345',
                validCVC: 'Valid',
                validExpiryDate: 'Valid',
                validNumber: 'Valid'
              } as unknown as CardFieldInput.Details);
            }}
          >
            <Text style={styles.testModeButtonText}>Use Test Card (4242)</Text>
          </Pressable>
        </View>
      )}

      {__DEV__ && (
        <View style={styles.testCardContainer}>
          <Text style={styles.testCardTitle}>Test Card Details:</Text>
          <Text style={styles.testCardText}>• Number: 4242 4242 4242 4242</Text>
          <Text style={styles.testCardText}>• Expiry: Any future date (e.g., 12/30)</Text>
          <Text style={styles.testCardText}>• CVC: Any 3 digits</Text>
          <Text style={styles.testCardText}>• ZIP: Any 5 digits</Text>
        </View>
      )}

      {!useCheckout && (
        <CardField
          postalCodeEnabled={true}
          placeholders={{
            number: '4242 4242 4242 4242',
            expiryDate: 'MM/YY',
            cvc: 'CVC',
            postalCode: 'ZIP',
          }}
          autofocus={true}
          cardStyle={{
            backgroundColor: '#FFFFFF',
            textColor: '#000000',
            borderWidth: 1,
            borderColor: '#CCCCCC',
            borderRadius: 8,
            fontSize: 16,
          }}
          style={{ width: '100%', height: 50, marginVertical: 12 }}
          onCardChange={(cardDetails) => {
            console.log('CARD DETAILS:', {
              brand: cardDetails.brand,
              last4: cardDetails.last4,
              expiryMonth: cardDetails.expiryMonth,
              expiryYear: cardDetails.expiryYear,
              complete: cardDetails.complete,
              validNumber: cardDetails.validNumber,
              validExpiryDate: cardDetails.validExpiryDate,
              validCVC: cardDetails.validCVC,
            });
            setCardDetails(cardDetails);
            setCardComplete(cardDetails.complete);
          }}
        />
      )}

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          (isLoading || isSubmitting) && styles.buttonDisabled
        ]}
        onPress={handlePayPress}
        disabled={isLoading || isSubmitting || (!useCheckout && !cardComplete)}
      >
        {(isLoading || isSubmitting) ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {useCheckout ? 'Proceed to Checkout' : (cardComplete ? 'Subscribe' : 'Complete Card Details')}
          </Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#555',
  },
  loadingText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 12,
    textAlign: 'center',
  },
  cardFieldContainer: {
    height: 50,
    marginVertical: 8,
  },
  cardField: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
  },
  errorText: {
    color: '#FF4444',
    marginTop: 8,
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
  testCardContainer: {
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  testCardTitle: {
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#0369a1',
  },
  testCardText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
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
    color: '#92400E',
    marginBottom: 8,
  },
  testModeButton: {
    backgroundColor: '#F59E0B',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  testModeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default StripePaymentForm;
