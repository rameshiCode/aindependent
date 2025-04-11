// frontend-rn/hooks/useProfile.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProfilesService } from '@/src/client';
import { useAuth } from '@/context/authProvider';
import { QueryObserverResult, RefetchOptions } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';

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

// New interface for structured profile data
export interface StructuredProfile {
  profile: {
    id: string;
    addiction_type?: string;
    recovery_stage?: string;
    motivation_level?: number;
    abstinence_days?: number;
    abstinence_start_date?: string;
    psychological_traits?: Record<string, boolean>;
    last_updated?: string;
  };
  insights: Record<string, UserInsight[]>;
  goals: UserGoal[];
  summary: {
    has_profile: boolean;
    insight_count: number;
    insight_types: string[];
    goals_count: number;
    last_updated?: string;
  };
  motivational_interviewing?: {
    current_stage?: string;
    stages_visited?: string[];
    message_count?: number;
  };
  // Additional structured data from generated profile
  psychological_traits?: {
    need_for_approval?: boolean;
    fear_of_rejection?: boolean;
    low_self_confidence?: boolean;
    submissiveness?: boolean;
    other_traits?: string[];
  };
  motivation?: {
    level?: number;
    internal_motivators?: string[];
    external_motivators?: string[];
    ambivalence_factors?: string[];
  };
  triggers?: {
    emotional?: string[];
    situational?: string[];
    social?: string[];
    time_based?: {
      days?: string[];
      times?: string[];
    };
  };
  analysis?: {
    key_insights?: string[];
    recommended_focus?: string;
    confidence_level?: number;
  };
}

// Type for the hook return value
export interface UseProfileResult {
  profile: UserProfile | null;
  structuredProfile: StructuredProfile | null;
  isLoadingProfile: boolean;
  profileError: Error | null;
  refetchProfile: (options?: RefetchOptions) => Promise<QueryObserverResult<UserProfile, Error>>;
  refetchStructuredProfile: (options?: RefetchOptions) => Promise<QueryObserverResult<StructuredProfile, Error>>;
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
  updateGoal: (goalId: string, data: { status?: string; description?: string; target_date?: string; progress?: number; metadata?: any }) => Promise<void>;
  triggerProfileExtraction: (conversationId: string) => Promise<void>;
  processAllConversations: () => Promise<void>;
  // New structured profile methods
  getStructuredProfile: () => {
    data: StructuredProfile | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<QueryObserverResult<StructuredProfile, Error>>;
  };
  generateStructuredProfile: () => Promise<StructuredProfile | null>;
  analyzeConversation: (conversationId: string) => Promise<any>;
  updateGoalProgress: (goalId: string, progress: number) => Promise<void>;
  getLastConversation: () => Promise<any>;
  isAnalyzingConversation: boolean;
  isGeneratingProfile: boolean;
}

/**
 * Custom hook for managing user profile data
 * Provides access to profile data, insights, goals, and profile-related mutations
 */
export function useProfile(): UseProfileResult {
  const queryClient = useQueryClient();
  const { currentUser, session } = useAuth();
  
  // Helper to determine the correct API URL based on platform
  const getApiUrl = () => {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:8000'; // For Android emulator
    } else {
      return Constants.expoConfig?.extra?.API_URL || 'http://localhost:8000';
    }
  };
  
  const API_URL = getApiUrl();

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

  // Get structured profile data
  const {
    data: structuredProfile,
    isLoading: isLoadingStructuredProfile,
    error: structuredProfileError,
    refetch: refetchStructuredProfile
  } = useQuery<StructuredProfile, Error>({
    queryKey: ['structuredProfile'],
    queryFn: async () => {
      try {
        // Try to use the SDK if possible
        try {
          const response = await ProfilesService.getStructuredProfile();
          return response.data as StructuredProfile;
        } catch (sdkError) {
          // Fall back to direct fetch if SDK method doesn't exist
          console.log('SDK method not available, using direct fetch');
          
          const response = await fetch(`${API_URL}/api/v1/profiles/structured-profile`, {
            headers: {
              'Authorization': `Bearer ${session}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch structured profile: ${response.status}`);
          }
          
          return await response.json() as StructuredProfile;
        }
      } catch (error) {
        console.error('Error fetching structured profile:', error);
        throw new Error('Failed to fetch structured profile');
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!session
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
      queryClient.invalidateQueries({ queryKey: ['structuredProfile'] });
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
      queryClient.invalidateQueries({ queryKey: ['structuredProfile'] });
    }
  });

  // Update goal mutation
  const updateGoalMutation = useMutation({
    mutationFn: async ({
      goalId,
      data
    }: {
      goalId: string;
      data: { status?: string; description?: string; target_date?: string; progress?: number; metadata?: any }
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
      queryClient.invalidateQueries({ queryKey: ['structuredProfile'] });
    }
  });

  // Update goal progress mutation
  const updateGoalProgressMutation = useMutation({
    mutationFn: async ({
      goalId,
      progress
    }: {
      goalId: string;
      progress: number;
    }) => {
      try {
        // Try to use SDK first
        try {
          const response = await ProfilesService.updateGoalProgress({
            path: { goal_id: goalId },
            body: { progress }
          });
          return response.data;
        } catch (sdkError) {
          // Fallback to direct fetch
          const response = await fetch(`${API_URL}/api/v1/profiles/goals/${goalId}/progress`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${session}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ progress }),
          });
          
          if (!response.ok) {
            throw new Error(`Failed to update goal progress: ${response.status}`);
          }
          
          return await response.json();
        }
      } catch (error) {
        console.error('Error updating goal progress:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch goals
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['structuredProfile'] });
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
      queryClient.invalidateQueries({ queryKey: ['structuredProfile'] });
    }
  });

  // Process all conversations mutation
  const processAllConversationsMutation = useMutation({
    mutationFn: async () => {
      try {
        // Try to use SDK first
        try {
          const response = await ProfilesService.processAllConversations();
          return response.data;
        } catch (sdkError) {
          // Fallback to direct fetch
          const response = await fetch(`${API_URL}/api/v1/profiles/process-all-conversations`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            throw new Error(`Failed to process all conversations: ${response.status}`);
          }
          
          return await response.json();
        }
      } catch (error) {
        console.error('Error processing all conversations:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch everything
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['structuredProfile'] });
      Alert.alert('Success', 'All conversations processed successfully!');
    }
  });

  // Analyze conversation mutation
  const analyzeConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      try {
        // Try to use SDK first
        try {
          const response = await ProfilesService.analyzeConversation({
            path: { conversation_id: conversationId }
          });
          return response.data;
        } catch (sdkError) {
          // Fallback to direct fetch
          const response = await fetch(`${API_URL}/api/v1/profiles/analyze-full-conversation/${conversationId}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            throw new Error(`Failed to analyze conversation: ${response.status}`);
          }
          
          return await response.json();
        }
      } catch (error) {
        console.error('Error analyzing conversation:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch everything related to profile
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      queryClient.invalidateQueries({ queryKey: ['structuredProfile'] });
      Alert.alert('Success', 'Conversation analyzed successfully!');
    }
  });

  // Generate structured profile mutation
  const generateStructuredProfileMutation = useMutation({
    mutationFn: async () => {
      try {
        // Try to use SDK first
        try {
          const response = await ProfilesService.generateStructuredProfile();
          return response.data;
        } catch (sdkError) {
          // Fallback to direct fetch
          const response = await fetch(`${API_URL}/api/v1/profiles/generate-structured-profile`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            throw new Error(`Failed to generate structured profile: ${response.status}`);
          }
          
          return await response.json();
        }
      } catch (error) {
        console.error('Error generating structured profile:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['structuredProfile'] });
      Alert.alert('Success', 'Structured profile generated successfully!');
      return data;
    }
  });

  // Helper function to get the last conversation
  const getLastConversation = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/openai/conversations`, {
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch conversations: ${response.status}`);
      }
      
      const conversations = await response.json();
      
      if (conversations && conversations.length > 0) {
        return conversations[0]; // Return the most recent conversation
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching last conversation:', error);
      return null;
    }
  };

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
    data: { status?: string; description?: string; target_date?: string; progress?: number; metadata?: any }
  ) => {
    await updateGoalMutation.mutateAsync({ goalId, data });
  };

  // Helper function to update goal progress
  const updateGoalProgress = async (goalId: string, progress: number) => {
    await updateGoalProgressMutation.mutateAsync({ goalId, progress });
  };

  // Helper function to trigger profile extraction
  const triggerProfileExtraction = async (conversationId: string) => {
    await triggerProfileExtractionMutation.mutateAsync(conversationId);
  };

  // Helper function to process all conversations
  const processAllConversations = async () => {
    return await processAllConversationsMutation.mutateAsync();
  };

  // Helper function to generate structured profile
  const generateStructuredProfile = async () => {
    try {
      const result = await generateStructuredProfileMutation.mutateAsync();
      return result as StructuredProfile;
    } catch (error) {
      console.error('Error in generateStructuredProfile:', error);
      return null;
    }
  };

  // Helper function to analyze a conversation
  const analyzeConversation = async (conversationId: string) => {
    try {
      return await analyzeConversationMutation.mutateAsync(conversationId);
    } catch (error) {
      console.error('Error in analyzeConversation:', error);
      Alert.alert('Error', `Failed to analyze conversation: ${error}`);
      return null;
    }
  };

  return {
    profile: profile || null,
    structuredProfile: structuredProfile || null,
    isLoadingProfile: isLoadingProfile || isLoadingStructuredProfile,
    profileError: profileError as Error | null,
    refetchProfile,
    refetchStructuredProfile,
    getInsights,
    getGoals,
    updateAbstinence,
    createGoal,
    updateGoal,
    updateGoalProgress,
    triggerProfileExtraction,
    processAllConversations,
    getStructuredProfile: () => ({
      data: structuredProfile,
      isLoading: isLoadingStructuredProfile,
      error: structuredProfileError as Error | null,
      refetch: refetchStructuredProfile
    }),
    generateStructuredProfile,
    analyzeConversation,
    getLastConversation,
    isAnalyzingConversation: analyzeConversationMutation.isPending,
    isGeneratingProfile: generateStructuredProfileMutation.isPending
  };
}