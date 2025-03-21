import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert
} from 'react-native';
import { CardField, useStripe, CardFieldInput } from '@stripe/stripe-react-native';

interface StripePaymentFormProps {
  onPaymentMethodCreated: (paymentMethodId: string) => void;
  isLoading: boolean;
}

const StripePaymentForm: React.FC<StripePaymentFormProps> = ({
  onPaymentMethodCreated,
  isLoading
}) => {
  const stripe = useStripe();
  const { createPaymentMethod } = stripe;
  const [cardComplete, setCardComplete] = useState(false);
  const [cardDetails, setCardDetails] = useState<CardFieldInput.Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStripeReady, setIsStripeReady] = useState(false);

  // Check if Stripe SDK is initialized
  useEffect(() => {
    if (stripe) {
      console.log('Stripe SDK is ready');
      setIsStripeReady(true);
    } else {
      console.log('Stripe SDK is not initialized');
    }
  }, [stripe]);

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

  const handlePayPress = async () => {
    try {
      console.log('Card complete status:', cardComplete);

      if (!cardComplete) {
        console.log('Card is incomplete, showing error');
        setError('Please complete the card details');
        return;
      }

      setError(null);
      console.log('Creating payment method...');

      // Try this approach which works with newer Stripe versions
      const result = await createPaymentMethod({
        paymentMethodType: 'Card',
      });

      console.log('Payment method result:', result);

      if (result.error) {
        console.log('Payment method error:', result.error);
        setError(result.error.message);
      } else if (result.paymentMethod) {
        console.log('Payment method created:', result.paymentMethod.id);
        onPaymentMethodCreated(result.paymentMethod.id);
      }
    } catch (e: any) {
      console.error('Payment form error details:', e);
      setError(`An unexpected error occurred: ${e.message}`);
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
              // Import ValidationState enum or use the string values directly
              // CardFieldInput.ValidationState.Valid would be the proper enum value
              setCardDetails({
                complete: true,
                brand: 'Visa',
                last4: '4242',
                expiryMonth: 12,
                expiryYear: 2030,
                postalCode: '12345',
                validCVC: 'Valid',       // Use ValidationState.Valid or 'Valid' string
                validExpiryDate: 'Valid', // Use ValidationState.Valid or 'Valid' string
                validNumber: 'Valid'      // Use ValidationState.Valid or 'Valid' string
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
        style={{
          width: '100%',
          height: 50,
          marginVertical: 12,
        }}
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

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          isLoading && styles.buttonDisabled
        ]}
        onPress={handlePayPress}
        disabled={isLoading || !cardComplete}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {cardComplete ? 'Subscribe' : 'Complete Card Details'}
          </Text>
        )}
      </Pressable>

      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Payment Form Debug</Text>
          <Text style={styles.debugText}>Stripe Ready: {isStripeReady ? 'Yes' : 'No'}</Text>
          <Text style={styles.debugText}>Card Complete: {cardComplete ? 'Yes' : 'No'}</Text>
          {cardDetails && (
            <>
              <Text style={styles.debugText}>Brand: {cardDetails.brand || 'None'}</Text>
              <Text style={styles.debugText}>Last 4: {cardDetails.last4 || 'None'}</Text>
            </>
          )}
          <Pressable
            style={styles.debugButton}
            onPress={() => {
              Alert.alert(
                'Stripe Status',
                `Stripe initialized: ${isStripeReady ? 'Yes' : 'No'}\n` +
                `Card complete: ${cardComplete ? 'Yes' : 'No'}\n` +
                `Card details: ${cardDetails ? 'Available' : 'None'}`
              );
            }}
          >
            <Text style={styles.debugButtonText}>Check Stripe Status</Text>
          </Pressable>
        </View>
      )}
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
  debugContainer: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  debugTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  debugText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  debugButton: {
    marginTop: 12,
    backgroundColor: '#5469D4',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  debugButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default StripePaymentForm;
