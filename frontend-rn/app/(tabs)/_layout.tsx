import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/react-query';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  // Create a new QueryClient if useQueryClient fails (this ensures we have a QueryClient)
  let queryClient;
  try {
    queryClient = useQueryClient();
  } catch (error) {
    // If we can't access the root QueryClient, create a new one for this tab context
    queryClient = new QueryClient();
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: Platform.select({
            ios: {
              // Use a transparent background on iOS to show the blur effect
              position: 'absolute',
            },
            default: {},
          }),
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="subscription"
          options={{
            title: 'Subscription',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="creditcard.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="health-check"
          options={{
            title: 'Health',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="heart.fill" color={color} />,
          }}
        />
      </Tabs>
    </QueryClientProvider>
  );
}
