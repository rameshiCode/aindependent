// frontend-rn/app/web-view.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ActivityIndicator } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getSubscriptionStatusOptions } from '@/src/client/@tanstack/react-query.gen';

export default function WebViewScreen() {
  const router = useRouter();
  const { url, redirect_to } = useLocalSearchParams();
  const queryClient = useQueryClient();

  if (!url) {
    router.back();
    return null;
  }

  const handleNavigationStateChange = (navState: any) => {
    console.log('WebView navigating to:', navState.url);

    // Handle return from Stripe Portal
    if (navState.url.includes('example.com/return')) {
      console.log('Returning from Stripe Portal');

      // Refresh subscription data
      queryClient.invalidateQueries({
        queryKey: getSubscriptionStatusOptions().queryKey
      });

      // Navigate back to subscription management
      setTimeout(() => {
        router.push('/subscription-management');
      }, 1000);
      return;
    }

    // Handle other navigation states
    if (navState.url.includes('subscription-success') || navState.url.includes('/success')) {
      // Refresh subscription data
      queryClient.invalidateQueries({
        queryKey: getSubscriptionStatusOptions().queryKey
      });

      // If redirect_to is specified, use that destination
      if (redirect_to === 'chat') {
        setTimeout(() => {
          router.push('/(drawer)/(tabs)/chat');
        }, 1000);
      } else {
        // Default behavior - redirect to subscription page after successful payment
        setTimeout(() => {
          router.push('/subscription-management');
        }, 1000);
      }
    } else if (navState.url.includes('subscription-cancel') || navState.url.includes('/cancel')) {
      // Go back to subscription page if payment was canceled
      router.back();
    }
  };

  return (
    <ThemedView style={styles.container}>
      <WebView
        source={{ uri: url as string }}
        style={styles.webview}
        onNavigationStateChange={handleNavigationStateChange}
        startInLoadingState={true}
        renderLoading={() => (
          <ThemedView style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
          </ThemedView>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
