import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/authProvider';

interface Message {
  role: string;
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
}

export function useChat() {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { session } = useAuth();

  // Debug API URL from environment
  console.log('API_URL from env:', process.env.API_URL);
  const apiUrl = process.env.API_URL || 'http://localhost:8000';
  console.log('Using API URL:', apiUrl);

  // Fetch conversations
  const { data: conversations, isLoading: isLoadingConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      console.log('Fetching conversations with session token:', session ? `${session.substring(0, 10)}...` : 'none');

      try {
        const response = await fetch(`${apiUrl}/api/v1/openai/conversations`, {
          headers: {
            'Authorization': `Bearer ${session}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('Conversations API response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API error response:', errorText);
          throw new Error(`Failed to fetch conversations: ${errorText}`);
        }

        const data = await response.json();
        console.log('Received conversations:', data.length);
        return data;
      } catch (error) {
        console.error('Error in conversations fetch:', error);
        throw error;
      }
    },
    enabled: !!session,
  });

  // Create conversation mutation
  const createConversation = useMutation({
    mutationFn: async (title: string = 'New Conversation') => {
      const response = await fetch(`${apiUrl}/api/v1/openai/conversations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setActiveConversation(data);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string, content: string }) => {
      const message = {
        role: "user",
        content,
      };

      const response = await fetch(`${apiUrl}/api/v1/openai/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send message: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', activeConversation?.id] });

      // Add the assistant's response to the UI
      if (activeConversation) {
        setActiveConversation(prev => {
          if (!prev) return null;
          return {
            ...prev,
            messages: [...prev.messages, data],
          };
        });
      }
    },
  });

  // Initialize by creating a new conversation if none exists
  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeConversation) {
      setActiveConversation(conversations[0]);
    } else if (conversations && conversations.length === 0 && !activeConversation && !isLoadingConversations) {
      createConversation.mutate('New Conversation');
    }
  }, [conversations, isLoadingConversations]);

  const sendChatMessage = useCallback(async (content: string) => {
    if (!content.trim() || !activeConversation) return;

    try {
      setError(null);

      // Optimize UI by showing message immediately
      const userMessage = {
        role: "user",
        content
      };

      // Update UI immediately to show user message
      setActiveConversation(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...prev.messages, userMessage]
        };
      });

      // Send to API
      await sendMessage.mutateAsync({
        conversationId: activeConversation.id,
        content
      });

    } catch (e: any) {
      console.error('Error sending message:', e);
      setError(`Failed to send message: ${e.message}`);
      return false;
    }

    return true;
  }, [activeConversation, sendMessage]);

  return {
    conversations,
    activeConversation,
    isLoading: isLoadingConversations || createConversation.isPending || sendMessage.isPending,
    error,
    sendMessage: sendChatMessage,
    createConversation: createConversation.mutate,
    setActiveConversation,
  };
}
