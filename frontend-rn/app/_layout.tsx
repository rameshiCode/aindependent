// Update to app/_layout.tsx to initialize Stripe

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import Constants from 'expo-constants';
import { OpenAPI } from '@/src/client';
import { StripeProvider } from '@stripe/stripe-react-native';

import { useColorScheme } from '@/hooks/useColorScheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReactQueryDevTools } from '@dev-plugins/react-query';

// Get the Stripe publishable key from app config
const stripePublishableKey = Constants.expoConfig?.extra?.STRIPE_PUBLISHABLE_KEY || 
  'pk_test_51R04QIF7P8kDElAhIvVr0fDR3qSwPClQOSeTGaQhGAculMikrRATQaPFdF8G5chyz7ntVNOLAoC3A1weNRMDk4Qk00k20RqJ79';

OpenAPI.BASE = Constants.expoConfig?.extra?.API_URL || 'http://localhost:8000';
const queryClient = new QueryClient();

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useReactQueryDevTools(queryClient);  // TODO: this is only used for debugging, delete this in prod.

  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StripeProvider
          publishableKey={stripePublishableKey}
          merchantIdentifier="merchant.com.YourApp" // Only needed for Apple Pay
        >
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="subscription" options={{ title: "Premium Subscription" }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </StripeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}