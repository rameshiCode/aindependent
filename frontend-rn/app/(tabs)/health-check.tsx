import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { healthCheckOptions } from '@/src/client/@tanstack/react-query.gen';

export default function HealthCheckScreen() {
  // Add this logging to see what's happening when the component mounts
  useEffect(() => {
    console.log('HealthCheckScreen mounted');

    // Test the API endpoint directly with fetch
    const testDirectFetch = async () => {
      try {
        console.log('Testing direct fetch to health check endpoint...');
        const response = await fetch('http://100.78.104.99:8000/api/v1/utils/health-check/');
        const data = await response.text();
        console.log('Direct fetch successful:', data);
      } catch (error) {
        console.error('Direct fetch failed:', error);
      }
    };

    testDirectFetch();
  }, []);

  // Continue with your normal React Query implementation
  const { data, error, isLoading } = useQuery({
    ...healthCheckOptions(),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 30000
  });

  // Log when data changes
  useEffect(() => {
    console.log('Health check data:', data);
  }, [data]);

  // Log when error changes
  useEffect(() => {
    if (error) {
      console.error('Health check error details:', error);
    }
  }, [error]);

  return (
    <View style={styles.container}>
      {isLoading ? <ActivityIndicator size="small" color="#0000ff" /> :
      <Text style={error ? styles.errorText : styles.statusText}>
        {error ? `Error: ${error instanceof Error ? error.message : 'Unknown'}` : `Status: ${data ? 'Healthy ✓' : 'Unhealthy ✗'}`}
      </Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusText: { color: '#22c55e', fontWeight: 'bold' },
  errorText: { color: '#ef4444', fontWeight: 'bold' },
});
