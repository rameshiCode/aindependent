// frontend-rn/components/PaymentHistory.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';

// Note: You'll need to create this endpoint in your backend
// This is a placeholder for now
const usePaymentHistory = () => {
  // This is a mock implementation - replace with actual API call
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [data, setData] = useState([
    {
      id: '1',
      date: new Date('2023-12-01'),
      amount: 15.99,
      status: 'successful',
      description: 'Monthly Subscription',
    },
    {
      id: '2',
      date: new Date('2023-11-01'),
      amount: 15.99,
      status: 'successful',
      description: 'Monthly Subscription',
    },
    {
      id: '3',
      date: new Date('2023-10-01'),
      amount: 15.99,
      status: 'successful',
      description: 'Monthly Subscription',
    },
  ]);

  const refetch = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      // In real implementation, fetch actual data
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, refetch };
};

const PaymentHistory = () => {
  const [refreshing, setRefreshing] = useState(false);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const cardBackground = useThemeColor({}, 'inputBackground');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'inputBorder');
  const successColor = '#10b981';
  const errorColor = '#ef4444';
  const pendingColor = '#f59e0b';

  const { data: payments, isLoading, error, refetch } = usePaymentHistory();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'successful':
      case 'succeeded':
      case 'paid':
        return successColor;
      case 'failed':
      case 'canceled':
        return errorColor;
      case 'pending':
      case 'processing':
        return pendingColor;
      default:
        return textColor;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'successful':
      case 'succeeded':
      case 'paid':
        return 'checkmark-circle';
      case 'failed':
      case 'canceled':
        return 'close-circle';
      case 'pending':
      case 'processing':
        return 'time';
      default:
        return 'help-circle';
    }
  };

  const renderPaymentItem = ({ item }: { item: any }) => {
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);

    return (
      <View style={[styles.paymentItem, { backgroundColor: cardBackground, borderColor }]}>
        <View style={styles.paymentMain}>
          <View>
            <Text style={[styles.paymentDescription, { color: textColor }]}>
              {item.description}
            </Text>
            <Text style={[styles.paymentDate, { color: textColor }]}>
              {formatDate(item.date)}
            </Text>
          </View>
          <Text style={[styles.paymentAmount, { color: tintColor }]}>
            ${item.amount.toFixed(2)}
          </Text>
        </View>

        <View style={[styles.paymentStatus, { borderTopColor: borderColor }]}>
          <Ionicons name={statusIcon} size={16} color={statusColor} />
          <Text style={[styles.paymentStatusText, { color: statusColor }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  paymentItem: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  paymentMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  paymentDescription: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  paymentDate: {
    fontSize: 14,
    opacity: 0.7,
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  paymentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  paymentStatusText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});

return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={[styles.title, { color: textColor }]}>Payment History</Text>

      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tintColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>
            Loading payment history...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={errorColor} />
          <Text style={[styles.errorText, { color: errorColor }]}>
            Failed to load payment history
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: tintColor }]}
            onPress={refetch}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : payments && payments.length > 0 ? (
        <FlatList
          data={payments}
          renderItem={renderPaymentItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[tintColor]}
              tintColor={tintColor}
            />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color={textColor} style={{ opacity: 0.5 }} />
          <Text style={[styles.emptyText, { color: textColor }]}>
            No payment history available
          </Text>
        </View>
      )}
    </View>
  );
};

export default PaymentHistory;
