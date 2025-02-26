import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/context/AuthContext';
import { extractAccessToken } from '@/utils/authUtils';
import { api } from '@/services/api';

// Make sure to handle auth redirect
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // This function handles the Google OAuth flow
  const handleGoogleSignIn = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get the Google login URL from our API service
      const googleLoginUrl = api.auth.getGoogleLoginUrl();
      
      // Adjust URL based on platform to ensure proper connectivity to backend
      let redirectUri = Constants.expoConfig?.scheme ? `${Constants.expoConfig.scheme}://` : undefined;
      
      // Open the browser for the OAuth flow
      const result = await WebBrowser.openAuthSessionAsync(
        googleLoginUrl,
        redirectUri
      );

      if (result.type === 'success' && result.url) {
        try {
          // Extract token from the redirect URL - our backend will return the token in the URL
          const token = extractAccessToken(result);
          
          if (token) {
            await signIn(token);
          } else {
            // If we couldn't extract the token, check the URL parameters
            const url = new URL(result.url);
            const accessToken = url.searchParams.get('access_token');
            
            if (accessToken) {
              await signIn(accessToken);
            } else {
              // If we still can't find a token, show an error
              throw new Error('No access token found in the response');
            }
          }
        } catch (tokenError) {
          console.error('Token extraction error:', tokenError);
          setError('Authentication failed. Please try again.');
        }
      } else if (result.type === 'cancel') {
        // User canceled the authentication flow
        console.log('Authentication canceled by user');
      } else {
        // Some other error occurred
        setError('Authentication failed. Please try again.');
      }
    } catch (error) {
      console.error('Error during Google sign-in:', error);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [signIn]);

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.logoContainer}>
        <ThemedText type="title">Welcome</ThemedText>
        <ThemedText style={styles.subtitle}>Sign in to continue</ThemedText>
      </ThemedView>

      <ThemedView style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.googleButton, isLoading && styles.disabledButton]} 
          onPress={handleGoogleSignIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#757575" />
          ) : (
            <>
              <Image 
                source={require('@/assets/images/google-logo.png')} 
                style={styles.googleIcon} 
                // If you don't have the Google logo, you can add it to your assets or use plain text
              />
              <ThemedText style={styles.googleButtonText}>Continue with Google</ThemedText>
            </>
          )}
        </TouchableOpacity>
        
        {error && (
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 10,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 4,
    padding: 16,
    width: '100%',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#dddddd',
    minHeight: 54,
  },
  disabledButton: {
    opacity: 0.7,
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  googleButtonText: {
    color: '#757575',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: 'red',
    marginTop: 20,
    textAlign: 'center',
  },
});