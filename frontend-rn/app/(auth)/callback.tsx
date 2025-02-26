import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/context/AuthContext';

export default function AuthCallbackScreen() {
  const { signIn } = useAuth();
  const params = useLocalSearchParams();
  const navigation = useNavigation();

  useEffect(() => {
    async function handleCallback() {
      try {
        // The backend should redirect with the token as a parameter
        const token = params.access_token as string;
        
        if (token) {
          await signIn(token);
        } else {
          // Handle case where token is not present in the URL
          console.error('No token received in callback');
          navigation.navigate('/(auth)/login' as never);
        }
      } catch (error) {
        console.error('Error handling auth callback:', error);
        navigation.navigate('/(auth)/login' as never);
      }
    }

    handleCallback();
  }, [params, signIn, navigation]);

  return (
    <ThemedView style={styles.container}>
      <ActivityIndicator size="large" color="#0a7ea4" />
      <ThemedText style={styles.text}>Completing login...</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    marginTop: 20,
    fontSize: 16,
  },
});