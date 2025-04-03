// Alternative approach using the StripeService directly

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsageStatusOptions } from '@/src/client/@tanstack/react-query.gen';
import { StripeService } from '@/src/client';

interface UsageData {
  has_active_subscription: boolean;
  unlimited_requests: boolean;
  requests_used: number;
  requests_limit: number;
  requests_remaining: number | string;
  limit_reached: boolean;
}

interface UseUsageHook {
  usageData: UsageData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  limitReached: boolean;
  hasSubscription: boolean;
  incrementUsage: () => Promise<void>;
  refetchUsage: () => Promise<void>;
}

export const useUsage = (): UseUsageHook => {
  const queryClient = useQueryClient();

  // Query for getting usage status
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery(getUsageStatusOptions());

  // Cast the data to our interface
  const usageData = data as UsageData | undefined;

  // Determine if limit is reached
  const limitReached = !!usageData?.limit_reached;
  const hasSubscription = !!usageData?.has_active_subscription;

  // Create a mutation using the StripeService directly
  const { mutateAsync } = useMutation({
    mutationFn: async () => {
      const response = await StripeService.incrementUsage({
        throwOnError: true
      });
      return response.data as unknown as UsageData;
    },
    onSuccess: (data) => {
      // Update the usage status in the cache
      queryClient.setQueryData(getUsageStatusOptions().queryKey, (oldData) => {
        return { ...oldData, ...data };
      });
    },
  });

  // Function to increment usage
  const incrementUsage = async () => {
    // Only increment if user doesn't have a subscription
    if (!hasSubscription) {
      await mutateAsync();
    }
  };

  // Function to refetch usage data
  const refetchUsage = async () => {
    await refetch();
  };

  return {
    usageData,
    isLoading,
    isError,
    error: error as Error | null,
    limitReached,
    hasSubscription,
    incrementUsage,
    refetchUsage,
  };
};

export default useUsage;
