// frontend-rn/hooks/useProfile.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/src/client/client.gen';

// Define the correct interfaces to match your backend models
export interface UserProfile {
  id: string;
  addiction_type: string | null;
  abstinence_days: number;
  abstinence_start_date: string | null;
  motivation_level: number | null;
  relapse_risk_score: number | null;
  big_five_scores: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  } | null;
  insights: ProfileInsight[];
  goals: UserGoal[];
  last_updated: string;
}

export interface ProfileInsight {
  id: string;
  type: string;
  value: string;
  significance: number;
  confidence: number;
  day_of_week?: string;
  time_of_day?: string;
}

export interface UserGoal {
  id: string;
  description: string;
  created_at: string;
  target_date: string | null;
  status: string;
}

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
      const response = await client.get({
        path: '/api/v1/profiles/my-profile'
      });
      return response.data as UserProfile;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3
  });

  // Get user goals with optional status filter
  const getUserGoals = (status?: string) => {
    return useQuery<UserGoal[]>({
      queryKey: ['goals', status],
      queryFn: async () => {
        const response = await client.get({
          path: '/api/v1/profiles/goals',
          query: status ? { status } : undefined
        });
        return response.data as UserGoal[];
      },
      staleTime: 5 * 60 * 1000 // 5 minutes
    });
  };

  // Create a new goal
  const createGoal = useMutation({
    mutationFn: async (goalData: { description: string, target_date?: string }) => {
      const response = await client.post({
        path: '/api/v1/profiles/goals',
        body: goalData
      });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate goals queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    }
  });

  // Update goal status (complete, abandon, etc.)
  const updateGoalStatus = useMutation({
    mutationFn: async ({ goalId, status }: { goalId: string, status: string }) => {
      const response = await client.put({
        path: `/api/v1/profiles/goals/${goalId}`,
        body: { status }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    }
  });

  // Update abstinence status
  const updateAbstinence = useMutation({
    mutationFn: async (data: { reset?: boolean, days?: number }) => {
      const response = await client.post({
        path: '/api/v1/profiles/update-abstinence',
        body: data
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  });

  return {
    // Profile data and status
    profile,
    isLoadingProfile,
    profileError,
    refetchProfile,

    // Goals
    getUserGoals,
    createGoal,
    updateGoalStatus,

    // Abstinence tracking
    updateAbstinence
  };
}

export default useProfile;
