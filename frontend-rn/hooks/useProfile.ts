// frontend-rn/hooks/useProfile.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProfileService, UserProfile, UserInsight, UserGoal } from '@/src/client/@tanstack/react-query.gen';

export function useProfile() {
  const queryClient = useQueryClient();

  // Get user profile
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
    refetch: refetchProfile
  } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await ProfileService.getMyProfile();
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get user insights
  const getInsights = (type?: string) => {
    return useQuery<UserInsight[]>({
      queryKey: ['insights', type],
      queryFn: async () => {
        const response = await ProfileService.getMyInsights(type);
        return response.data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  // Get user goals
  const getGoals = (status?: string) => {
    return useQuery<UserGoal[]>({
      queryKey: ['goals', status],
      queryFn: async () => {
        const response = await ProfileService.getMyGoals(status);
        return response.data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  return {
    profile,
    isLoadingProfile,
    profileError,
    refetchProfile,
    getInsights,
    getGoals,
  };
}
