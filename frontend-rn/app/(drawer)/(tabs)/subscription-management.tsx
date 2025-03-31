// frontend-rn/app/(drawer)/(tabs)/subscription-management.tsx
import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import EnhancedSubscriptionManager from '@/components/SubscriptionManager';
import PaymentHistory from '@/components/PaymentHistory';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function SubscriptionManagementScreen() {
  // State for tab navigation
  const [activeTab, setActiveTab] = useState('subscription');

  // Get theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const cardBackground = useThemeColor({}, 'inputBackground');
  const borderColor = useThemeColor({}, 'inputBorder');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Subscription',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />

      <View style={styles.content}>
        <Text style={[styles.headerText, { color: textColor }]}>
          Subscription Management
        </Text>
        <Text style={[styles.subtitle, { color: textColor }]}>
          Manage your subscription and view payment history
        </Text>

        {/* Tab Navigation */}
        <View style={[styles.tabBar, { backgroundColor: cardBackground, borderColor }]}>
          <TouchableOpacity
            style={[
              styles.tabItem,
              activeTab === 'subscription' && [styles.activeTabItem, { borderBottomColor: tintColor }]
            ]}
            onPress={() => setActiveTab('subscription')}
          >
            <Ionicons
              name="card-outline"
              size={20}
              color={activeTab === 'subscription' ? tintColor : textColor}
            />
            <Text
              style={[
                styles.tabText,
                { color: textColor },
                activeTab === 'subscription' && { color: tintColor, fontWeight: 'bold' }
              ]}
            >
              Subscription
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabItem,
              activeTab === 'history' && [styles.activeTabItem, { borderBottomColor: tintColor }]
            ]}
            onPress={() => setActiveTab('history')}
          >
            <Ionicons
              name="receipt-outline"
              size={20}
              color={activeTab === 'history' ? tintColor : textColor}
            />
            <Text
              style={[
                styles.tabText,
                { color: textColor },
                activeTab === 'history' && { color: tintColor, fontWeight: 'bold' }
              ]}
            >
              Payment History
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'subscription' ? (
            <EnhancedSubscriptionManager />
          ) : (
            <PaymentHistory />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.8,
  },
  tabBar: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomWidth: 2,
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
  },
  tabContent: {
    flex: 1,
  },
});
