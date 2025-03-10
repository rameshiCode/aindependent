import React from 'react';
import { StyleSheet } from 'react-native';
import { SubscriptionScreen, SubscriptionProvider } from '@/components/SubscriptionScreen';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

export default function SubscriptionTab() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.pageTitle}>Premium Subscription</ThemedText>
      <SubscriptionProvider>
        <SubscriptionScreen />
      </SubscriptionProvider>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  pageTitle: {
    marginBottom: 20,
    textAlign: 'center',
  },
});