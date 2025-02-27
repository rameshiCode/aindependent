import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { QueryProvider } from '@/context/QueryProvider';
import { useColorScheme } from '@/hooks/useColorScheme';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Make sure WebBrowser can complete auth session
WebBrowser.maybeCompleteAuthSession();

// This is the main layout component that wraps the entire app
function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isLoading, token, signIn } = useAuth();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Effect to hide splash screen when ready
  useEffect(() => {
    if (loaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isLoading]);
  
  // Check for token in URL for web platform (direct redirect from backend)
  useEffect(() => {
    const checkUrlForToken = async () => {
      console.log('🔍 Running URL token check on platform:', Platform.OS);
      if (Platform.OS === 'web') {
        try {
          // Parse the current URL
          const url = new URL(window.location.href);
          const token = url.searchParams.get('token');
          
          // If token exists in URL, handle it
          if (token) {
            console.log('🔑 Found token in URL, processing sign-in');
            
            // Remove the token from URL for security (using history API)
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            
            // Sign in with the token
            await signIn(token);
            console.log('✅ Sign-in from URL token complete');
            
            // Ensure UI updates immediately - this helps with direct navigation
            if (window.location.pathname !== '/(tabs)') {
              window.location.href = '/(tabs)';
            }
          } else {
            // Check localStorage as a fallback (for HTML redirect approach)
            const localStorageToken = localStorage.getItem('auth_token');
            if (localStorageToken) {
              console.log('🔑 Found token in localStorage, processing sign-in');
              await signIn(localStorageToken);
              localStorage.removeItem('auth_token'); // Clean up after use
              console.log('✅ Sign-in from localStorage token complete');
              
              // Ensure UI updates immediately - this helps with direct navigation
              if (window.location.pathname !== '/(tabs)') {
                window.location.href = '/(tabs)';
              }
            }
          }
        } catch (error) {
          console.error('Error checking URL/localStorage for token:', error);
        }
      }
    };
    
    // Run immediately
    checkUrlForToken();
    
    // Also run when window gets focus again (for when popup flow redirects back)
    const handleFocus = () => {
      console.log('🔍 Window focused, checking for token again');
      checkUrlForToken();
    };
    
    window.addEventListener('focus', handleFocus);
    
    // Clean up listener on unmount
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [signIn]);

  // Show loading state until we're ready
  if (!loaded || isLoading) {
    return null;
  }

  // Log detailed authentication state for debugging
  console.log('RootLayoutNav - Auth State:', { 
    isLoading, 
    hasToken: !!token,
    tokenValue: token ? `${token.substring(0, 10)}...` : 'No token'
  });

  // Conditionally render screens based on authentication state
  console.log("AUTH STATE DEBUG:", { 
    hasToken: !!token, 
    tokenValue: token || "No token"
  });
  
  // Route to the appropriate screens based on authentication state
  if (!token) {
    console.log("No token found, showing login screen");
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ animation: 'slide_from_right' }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    );
  } else {
    console.log("Token found, showing main app with tabs");
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ animation: 'slide_from_right' }}>
          <Stack.Screen name="(tabs)" options={{ 
            headerShown: false,
            headerBackVisible: false, // Prevent going back to login
          }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    );
  }
}

// This wraps the navigation with the AuthProvider and QueryProvider
export default function RootLayout() {
  return (
    <QueryProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </QueryProvider>
  );
}