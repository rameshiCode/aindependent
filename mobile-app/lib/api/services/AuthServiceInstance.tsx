// lib/api/services/AuthServiceInstance.tsx
import { OpenAPI } from '../core/OpenAPI';
import { request } from '../core/request';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  full_name: string;
}

class AuthServiceClass {
  /**
   * Login for access token
   * @param requestBody Login credentials
   * @returns Login response with access token
   */
  async login(requestBody: LoginRequest): Promise<LoginResponse> {
    const formData = new FormData();
    formData.append('username', requestBody.username);
    formData.append('password', requestBody.password);

    return request({
      method: 'POST',
      url: `${OpenAPI.BASE_URL}/api/login/access-token`,
      body: formData, 
      // For FormData, don't set the Content-Type header, the browser will set it with the correct boundary
      headers: { 'Accept': 'application/json' },
    });
  }

  /**
   * Register a new user
   * @param requestBody Registration data
   * @returns Success message
   */
  async register(requestBody: RegisterRequest): Promise<any> {
    return request({
      method: 'POST',
      url: `${OpenAPI.BASE_URL}/api/users/`,
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Test the token validation
   * @returns User information
   */
  async testToken(): Promise<any> {
    return request({
      method: 'POST',
      url: `${OpenAPI.BASE_URL}/api/login/test-token`,
      headers: {
        'Authorization': `Bearer ${OpenAPI.TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get current user profile
   * @returns User profile information
   */
  async getCurrentUser(): Promise<UserProfile> {
    return request({
      method: 'GET',
      url: `${OpenAPI.BASE_URL}/api/users/me`,
      headers: {
        'Authorization': `Bearer ${OpenAPI.TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  }
}

// Create a singleton instance
export const authService = new AuthServiceClass();