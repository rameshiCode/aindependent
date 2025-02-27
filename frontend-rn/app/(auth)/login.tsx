import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, Platform, View, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useMutation } from '@tanstack/react-query';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/context/AuthContext';
import { extractAccessToken } from '@/utils/authUtils';
import { api } from '@/services/api';

// Make sure to handle auth redirect
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  
  // We've removed automatic token clearing to allow for persistent login
  // Users should only reach this screen if they're not authenticated

  // Use TanStack Mutation for Google Sign-In
  const googleSignInMutation = useMutation({
    mutationFn: async () => {
      // Get the Google login URL from our API service
      const googleLoginUrl = api.auth.getGoogleLoginUrl();
      console.log('🔄 Opening Google login URL:', googleLoginUrl);
      
      // Adjust URL based on platform to ensure proper connectivity to backend
      // Make sure we use a proper scheme for redirects
      let redirectUri;
      if (Platform.OS === 'web') {
        // For web, we'll use the current URL as the redirect base
        redirectUri = window.location.origin;
      } else {
        // For native, use the app scheme
        redirectUri = Constants.expoConfig?.scheme ? `${Constants.expoConfig.scheme}://` : 'frontendrn://';
      }
      console.log('📱 Redirect URI:', redirectUri);
      
      // Open the browser for the OAuth flow
      console.log('🌐 Opening WebBrowser for OAuth flow...');
      
      try {
        // Log additional details about our environment
        console.log('📱 Platform:', Platform.OS);
        console.log('🌐 Debug mode:', __DEV__ ? 'Yes' : 'No');
        console.log('🔗 Expo Scheme:', Constants.expoConfig?.scheme || 'Not defined');
        
        let result;
        
        // For web platform, we need a different approach
        if (Platform.OS === 'web') {
          console.log('🌐 Using web-specific auth approach...');
          
          // For web, we'll directly redirect instead of opening a popup
          console.log('🌐 For web, using direct redirect instead of popup');
          
          // Store the current URL to return to after authentication
          const currentUrl = window.location.href;
          localStorage.setItem('auth_return_url', currentUrl);
          
          // Directly navigate to the Google login URL
          window.location.href = googleLoginUrl;
          
          // Return a promise that never resolves since we're redirecting away from the page
          // This is to prevent the rest of the function from executing
          return await new Promise<string>(() => {
            // This promise intentionally never resolves
          });
          
          // The code below this will never execute because we're redirecting
          // It's here only as a fallback in case the redirect doesn't happen for some reason
          result = { 
            type: 'cancel',
            url: null
          } as WebBrowser.WebBrowserAuthSessionResult;
        } else {
          // Native platforms use the standard WebBrowser approach
          // Create browser options for more control
          const browserOptions = {
            showInRecents: true,
            createTask: true,
            enableBarCollapsing: false,
            showTitle: true,
            enableDefaultShareMenuItem: false,
            toolbarColor: '#4285F4',
            secondaryToolbarColor: '#ffffff',
          };
          
          console.log('🔄 Opening browser with URL:', googleLoginUrl);
          console.log('🔄 Using redirect URI:', redirectUri || 'undefined');
          
          // Use auth session approach (don't use openBrowserAsync before this)
          console.log('🌐 Attempting openAuthSessionAsync...');
          result = await WebBrowser.openAuthSessionAsync(
            googleLoginUrl,
            redirectUri, 
            browserOptions
          );
        }
        
        console.log('🔄 WebBrowser session complete');
        console.log('🔄 WebBrowser result type:', result.type);
        console.log('🔄 WebBrowser result URL:', 'url' in result ? result.url : 'No URL returned');
        console.log('🔄 Full result object:', JSON.stringify(result));
        
        // Debug logging to understand what we're getting back
        if (result.type === 'success') {
          console.log('✅ Success! Response has these properties:', Object.keys(result).join(', '));
          // Check if url property exists (for WebBrowserAuthSessionResult)
          if ('url' in result) {
            console.log('🔍 URL includes /auth/google:', result.url.includes('/auth/google'));
          }
          // Check if responseText property exists (for WebBrowserRedirectResult)
          if ('responseText' in result) {
            console.log('📄 Response body available:', result.responseText ? 'Yes' : 'No');
          }
        } else {
          console.log('❌ WebBrowser session was not successful:', result.type);
        }

        if (result.type !== 'success' || !('url' in result)) {
          console.error('❌ WebBrowser session failed or was cancelled', result);
          throw new Error(result.type === 'cancel' 
            ? 'Authentication canceled' 
            : `Authentication failed: ${JSON.stringify(result)}`);
        }

        console.log('🔍 Extracting token from redirect URL...');
        // Extract token from the redirect URL
        const token = extractAccessToken(result);
        
        if (!token) {
          console.error('❌ No token found in redirect URL');
          
          // If we redirected to the standard OAuth endpoint but couldn't extract a token,
          // we need to handle the authorization code flow manually
          if ('url' in result && result.url.includes('/login/auth/google')) {
            console.log('🔄 Detected standard OAuth flow, trying to extract code...');
            
            // Extract the authorization code from the URL
            const url = new URL(result.url);
            const code = url.searchParams.get('code');
            
            if (code) {
              console.log('🔄 Found authorization code, making direct API call...');
              
              // Make a direct API call to exchange the code for a token
              const baseUrl = api.getBaseUrl();
              const response = await fetch(`${baseUrl}/login/auth/google?code=${code}`);
              
              if (response.ok) {
                const data = await response.json();
                if (data.access_token) {
                  console.log('✅ Successfully got token from API call');
                  return data.access_token;
                }
              } else {
                console.error('❌ API call failed:', await response.text());
              }
            }
          }
          
          throw new Error('No access token found in the response');
        }
        
        console.log('✅ Successfully extracted token, returning for sign-in');
        return token;
      } catch (error) {
        console.error('❌ Error during OAuth flow:', error);
        throw error;
      }
    },
    onSuccess: async (token) => {
      console.log('✅ Authentication successful, signing in with token');
      console.log('🔑 TOKEN LENGTH:', token.length);
      console.log('🔑 TOKEN START:', token.substring(0, 10));
      
      // Store token first so it's immediately available
      await signIn(token);
      
      console.log('✅ signIn complete, token saved');
      
      // Force a rerender of the navigation tree to redirect to tabs
      // This only matters for web, as native handles it automatically
      if (Platform.OS === 'web') {
        console.log('🌐 Web platform detected, forcing navigation update to tabs');
        // Use setTimeout to ensure state has time to update
        setTimeout(() => {
          window.location.href = '/(tabs)';
        }, 500);
      }
      // Native platforms will automatically update via the _layout.tsx routing
    },
    onError: (error: Error) => {
      if (error.message === 'Authentication canceled') {
        console.log('Authentication canceled by user');
      } else {
        console.error('Google sign-in error:', error);
        setError(error.message || 'Authentication failed. Please try again.');
      }
    }
  });

  // Handle deep linking for auth redirects
  useEffect(() => {
    // Function to handle incoming links
    const handleUrl = async (event: { url: string }) => {
      console.log('📱 Received deep link URL:', event.url);
      
      if (event.url.includes('callback')) {
        console.log('🔄 Processing OAuth callback URL');
        
        try {
          // Parse the URL to extract token
          const url = new URL(event.url);
          
          // Check for access_token in query params
          const accessToken = url.searchParams.get('access_token');
          console.log('🔍 Looking for access_token in URL:', accessToken ? 'Found token' : 'No token in params');
          
          if (accessToken) {
            console.log('🔑 Found access token, signing in');
            await signIn(accessToken);
          } else {
            console.error('❌ No access token found in callback URL');
            setError('Authentication failed: No token found in the response');
          }
        } catch (error) {
          console.error('Error handling deep link:', error);
          setError(`Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    };

    // Add event listener for deep linking
    const subscription = Linking.addEventListener('url', handleUrl);

    // Get the initial URL (if app was opened through a deep link)
    const getInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleUrl({ url: initialUrl });
      }
    };
    getInitialUrl();

    // Cleanup
    return () => {
      subscription.remove();
    };
  }, [signIn]);

  console.log('🔐 RENDERING LOGIN SCREEN for Google Authentication');

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.logoContainer}>
        <Text style={styles.logo}>AI Independent</Text>
        <ThemedText style={styles.subtitle}>Welcome Back!</ThemedText>
        <ThemedText style={styles.description}>
          Sign in with your Google account to continue to the app
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.googleButton, googleSignInMutation.isPending && styles.disabledButton]} 
          onPress={() => {
            console.log('Google sign-in button pressed');
            googleSignInMutation.mutate();
          }}
          disabled={googleSignInMutation.isPending}
        >
          {googleSignInMutation.isPending ? (
            <ActivityIndicator size="small" color="#757575" />
          ) : (
            <>
              <View style={styles.googleLogoContainer}>
                <Text style={styles.googleG}>G</Text>
              </View>
              <ThemedText style={styles.googleButtonText}>Continue with Google</ThemedText>
            </>
          )}
        </TouchableOpacity>
        
        {error && (
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        )}

        {/* Authentication explanation */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            We use Google OAuth for secure authentication.
            Your information is kept private and secure.
          </Text>
        </View>

        {/* Debug section (hidden by default) */}
        {__DEV__ && (
          <View style={styles.debugContainer}>
            <ThemedText style={styles.debugTitle}>Debug Options:</ThemedText>
            
            <TouchableOpacity 
              style={styles.debugButton}
              onPress={() => {
                console.log('Testing API URL');
                const url = api.auth.getGoogleLoginUrl();
                console.log('Google Login URL:', url);
                setError(`API URL: ${url}`);
              }}
            >
              <ThemedText style={styles.debugButtonText}>Test API URL</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.debugButton}
              onPress={async () => {
                try {
                  console.log('Testing direct browser open...');
                  const url = api.auth.getGoogleLoginUrl();
                  await WebBrowser.openBrowserAsync(url);
                } catch (err) {
                  console.error('Browser open failed:', err);
                  const errorMessage = err instanceof Error ? err.message : String(err);
                  setError(`Browser open error: ${errorMessage}`);
                }
              }}
            >
              <ThemedText style={styles.debugButtonText}>Open Browser</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.debugButton}
              onPress={async () => {
                try {
                  console.log('Testing direct fetch...');
                  const baseUrl = api.getBaseUrl();
                  // Use a simpler endpoint that doesn't require authentication
                  const response = await fetch(`${baseUrl}/utils/health-check/`, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    // Add mode: 'cors' for web platform
                    ...(Platform.OS === 'web' ? { mode: 'cors' } : {})
                  });
                  
                  console.log('API Response:', response.status);
                  if (response.ok) {
                    const data = await response.json();
                    console.log('API Data:', JSON.stringify(data));
                    setError(`API connection OK: ${response.status} - ${data.message || JSON.stringify(data)}`);
                  } else {
                    setError(`API error: ${response.status}`);
                  }
                } catch (err) {
                  console.error('API test failed:', err);
                  const errorMessage = err instanceof Error ? err.message : String(err);
                  setError(`API test error: ${errorMessage}`);
                }
              }}
            >
              <ThemedText style={styles.debugButtonText}>Test API Connection</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.debugButton}
              onPress={() => {
                // Report environment info
                const info = {
                  platform: Platform.OS,
                  deviceName: Constants.deviceName,
                  webViewUserAgent: Constants.webViewUserAgent,
                  linkingURL: Linking.createURL(''),
                  scheme: Constants.expoConfig?.scheme,
                  baseUrl: api.getBaseUrl(),
                  redirectUri: Constants.expoConfig?.scheme ? `${Constants.expoConfig.scheme}://` : undefined,
                };
                
                console.log('Environment info:', info);
                setError(`Environment: ${JSON.stringify(info, null, 2)}`);
              }}
            >
              <ThemedText style={styles.debugButtonText}>Show Environment</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#f9f9f9',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4285F4',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#555',
    marginHorizontal: 20,
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
    borderRadius: 8,
    padding: 16,
    width: '100%',
    maxWidth: 300,
    // Use boxShadow for web compatibility
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 3,
    borderWidth: 1,
    borderColor: '#dddddd',
    minHeight: 54,
    marginBottom: 15,
  },
  disabledButton: {
    opacity: 0.7,
  },
  googleLogoContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  googleG: {
    color: '#4285F4',
    fontWeight: 'bold',
    fontSize: 18,
  },
  googleButtonText: {
    color: '#444',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: 'red',
    marginTop: 15,
    textAlign: 'left',
    maxWidth: '100%',
    padding: 10,
    backgroundColor: 'rgba(255,0,0,0.05)',
    borderRadius: 8,
    fontFamily: 'monospace',
    fontSize: 12,
    minHeight: 50,
    maxHeight: 250,
  },
  infoContainer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    borderRadius: 8,
    width: '100%',
    maxWidth: 340,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Debug styles
  debugContainer: {
    marginTop: 30,
    width: '100%',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 20,
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#888',
  },
  debugButton: {
    backgroundColor: '#eaeaea',
    padding: 10,
    borderRadius: 4,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  debugButtonText: {
    color: '#555',
  },
});