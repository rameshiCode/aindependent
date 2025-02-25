// mobile-app/lib/api/services/ChatService.tsx
import { request } from '../core/request';

export interface ChatMessage {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: Date;
}

export interface ChatCompletionRequest {
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }[];
  model: string;
  max_tokens?: number;
  temperature?: number;
}

export interface ChatCompletionResponse {
  id: string;
  choices: {
    message: {
      role: 'assistant';
      content: string;
    };
  }[];
}

export class ChatService {
  /**
   * Get a completion from Claude API
   */
  public static async getCompletion(messages: ChatMessage[]): Promise<string> {
    // Transform messages to the format expected by Claude API
    const apiMessages: { role: 'user' | 'assistant'; content: string }[] = messages.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Add a system message if needed
    const systemMessage = {
      role: 'system' as const,
      content: 'You are Claude, a helpful AI assistant.'
    };

    const requestBody: ChatCompletionRequest = {
      messages: [systemMessage, ...apiMessages],
      model: 'claude-3-opus-20240229', // Update with the model you're using
      max_tokens: 1000,
      temperature: 0.7
    };

    try {
      // This assumes your backend has a proxy endpoint to Claude API
      const response = await request<ChatCompletionResponse>({
        method: 'POST',
        url: '/api/v1/chat/completions',
        body: requestBody
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error getting chat completion:', error);
      throw error;
    }
  }
}

