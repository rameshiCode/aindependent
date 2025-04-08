// frontend-rn/hooks/useProfile.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProfilesService } from '@/src/client';
import { useAuth } from '@/context/authProvider';
import { QueryObserverResult, RefetchOptions } from '@tanstack/react-query';

// Define interfaces for type safety
export interface UserProfile {
  id: string;
  user_id: string;
  addiction_type: string | null;
  abstinence_days: number;
  abstinence_start_date: string | null;
  motivation_level: number | null;
  recovery_stage: string | null;
  psychological_traits: Record<string, any> | null;
  last_updated: string;
  [key: string]: any;
}

export interface UserInsight {
  id: string;
  insight_type: string;
  value: string;
  confidence: number;
  extracted_at: string;
  mi_stage: string | null;
  day_of_week: string | null;
  time_of_day: string | null;
  emotional_significance: number | null;
  [key: string]: any;
}

export interface UserGoal {
  id: string;
  description: string;
  created_at: string;
  target_date: string | null;
  status: string;
  [key: string]: any;
}

// Type for the hook return value
export interface UseProfileResult {
  profile: UserProfile | null;
  isLoadingProfile: boolean;
  profileError: Error | null;
  refetchProfile: (options?: RefetchOptions) => Promise<QueryObserverResult<UserProfile, Error>>;
  getInsights: (type?: string) => {
    data: UserInsight[] | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<QueryObserverResult<UserInsight[], Error>>;
  };
  getGoals: (status?: string) => {
    data: UserGoal[] | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<QueryObserverResult<UserGoal[], Error>>;
  };
}

export function useProfile(): UseProfileResult {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  // Get user profile
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
    refetch: refetchProfile
  } = useQuery<UserProfile, Error>({
    queryKey: ['profile'],
    queryFn: async () => {
      try {
        const response = await ProfilesService.getMyProfile();
        return response.data as unknown as UserProfile;
      } catch (error) {
        console.error('Error fetching profile:', error);
        throw new Error('Failed to fetch profile');
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get user insights - returns a function that can be called with optional type
  const getInsights = (type?: string) => {
    const {
      data,
      isLoading,
      error,
      refetch
    } = useQuery<UserInsight[], Error>({
      queryKey: ['insights', type],
      queryFn: async () => {
        try {
          const response = await ProfilesService.getUserInsights({
            query: type ? { insight_type: type } : undefined
          });
          return response.data as unknown as UserInsight[];
        } catch (error) {
          console.error('Error fetching insights:', error);
          throw new Error('Failed to fetch insights');
        }
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

    return {
      data,
      isLoading,
      error: error as Error | null,
      refetch
    };
  };

  // Get user goals - returns a function that can be called with optional status
  const getGoals = (status?: string) => {
    const {
      data,
      isLoading,
      error,
      refetch
    } = useQuery<UserGoal[], Error>({
      queryKey: ['goals', status],
      queryFn: async () => {
        try {
          const response = await ProfilesService.getUserGoals({
            query: status ? { status } : undefined
          });
          return response.data as unknown as UserGoal[];
        } catch (error) {
          console.error('Error fetching goals:', error);
          throw new Error('Failed to fetch goals');
        }
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

    return {
      data,
      isLoading,
      error: error as Error | null,
      refetch
    };
  };

  return {
    profile: profile || null,
    isLoadingProfile,
    profileError: profileError as Error | null,
    refetchProfile,
    getInsights,
    getGoals,
  };
}