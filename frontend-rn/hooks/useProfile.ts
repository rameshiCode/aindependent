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
  insights: UserInsight[];
  goals: UserGoal[];
  [key: string]: any;
}

export interface UserInsight {
  id: string;
  type: string;
  value: string;
  significance: number | null;
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
  updateAbstinence: (data: { reset?: boolean; days?: number }) => Promise<void>;
  createGoal: (data: { description: string; target_date?: string }) => Promise<void>;
  updateGoal: (goalId: string, data: { status?: string; description?: string; target_date?: string }) => Promise<void>;
  triggerProfileExtraction: (conversationId: string) => Promise<void>;
  processAllConversations: () => Promise<void>;
}

/**
 * Custom hook for managing user profile data
 * Provides access to profile data, insights, goals, and profile-related mutations
 */
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
        // Normalize the response data to our UserProfile interface
        const profileData = response.data as any;

        // Transform insights format if needed
        if (profileData.insights) {
          profileData.insights = profileData.insights.map((insight: any) => ({
            ...insight,
            type: insight.type || insight.insight_type, // Ensure we use type consistently
          }));
        }

        return profileData as UserProfile;
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

          // Normalize the response data
          const insights = (response.data as any[]).map(insight => ({
            ...insight,
            // Ensure we have a consistent 'type' field
            type: insight.type || insight.insight_type,
          }));

          return insights as UserInsight[];
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

  // Update abstinence status mutation
  const updateAbstinenceMutation = useMutation({
    mutationFn: async (data: { reset?: boolean; days?: number }) => {
      const response = await ProfilesService.updateAbstinenceStatus({
        body: data
      });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch profile
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  });

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (data: { description: string; target_date?: string }) => {
      const response = await ProfilesService.createUserGoal({
        body: data
      });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch goals
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    }
  });

  // Update goal mutation
  const updateGoalMutation = useMutation({
    mutationFn: async ({
      goalId,
      data
    }: {
      goalId: string;
      data: { status?: string; description?: string; target_date?: string }
    }) => {
      const response = await ProfilesService.updateUserGoal({
        path: { goal_id: goalId },
        body: data
      });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch goals
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    }
  });

  // Force profile extraction from a conversation
  const triggerProfileExtractionMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await ProfilesService.forceProfileExtraction({
        path: { conversation_id: conversationId }
      });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch profile and insights
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    }
  });

  // Process all conversations mutation
  const processAllConversationsMutation = useMutation({
    mutationFn: async () => {
      const response = await ProfilesService.processAllConversations();
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch everything
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    }
  });

  // Helper function to update abstinence
  const updateAbstinence = async (data: { reset?: boolean; days?: number }) => {
    await updateAbstinenceMutation.mutateAsync(data);
  };

  // Helper function to create a goal
  const createGoal = async (data: { description: string; target_date?: string }) => {
    await createGoalMutation.mutateAsync(data);
  };

  // Helper function to update a goal
  const updateGoal = async (
    goalId: string,
    data: { status?: string; description?: string; target_date?: string }
  ) => {
    await updateGoalMutation.mutateAsync({ goalId, data });
  };

  // Helper function to trigger profile extraction
  const triggerProfileExtraction = async (conversationId: string) => {
    await triggerProfileExtractionMutation.mutateAsync(conversationId);
  };

  // Helper function to process all conversations
  const processAllConversations = async () => {
    await processAllConversationsMutation.mutateAsync();
  };

  return {
    profile: profile || null,
    isLoadingProfile,
    profileError: profileError as Error | null,
    refetchProfile,
    getInsights,
    getGoals,
    updateAbstinence,
    createGoal,
    updateGoal,
    triggerProfileExtraction,
    processAllConversations
  };
}