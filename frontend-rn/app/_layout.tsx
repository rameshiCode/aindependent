import { StripeProvider } from '@stripe/stripe-react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import Constants from 'expo-constants';
// import { OpenAPI } from '@/src/client';

import { useColorScheme } from '@/hooks/useColorScheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReactQueryDevTools } from '@dev-plugins/react-query';
import { client } from '@/src/client/client.gen';


client.setConfig({
  baseUrl: Constants.expoConfig?.extra?.API_URL || 'http://localhost:8000',
  auth: () => '',
});

client.interceptors.request.use(async (request) => {
  console.log(`Request: ${request}`);
  return request;
});

client.interceptors.response.use((response) => {
  console.log(`Response: ${response}`);
  return response;
});

const queryClient = new QueryClient();

// Stripe publishable key - replace with your actual key from environment
const STRIPE_PUBLISHABLE_KEY = 'pk_test_your_stripe_key';

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
    {/* <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}> */}
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="subscription" options={{ title: 'Subscription' }} />
            <Stack.Screen name="web-view" options={{ title: 'Checkout', headerBackTitle: 'Back' }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
    {/* </StripeProvider> */}
      </QueryClientProvider>
  );
}
