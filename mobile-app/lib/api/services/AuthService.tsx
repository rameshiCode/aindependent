// lib/api/services/AuthService.tsx
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

export class AuthService {
  /**
   * Login for access token
   * @param requestBody Login credentials
   * @returns Login response with access token
   */
  public static async login(requestBody: LoginRequest): Promise<LoginResponse> {
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
  public static async register(requestBody: RegisterRequest): Promise<any> {
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
  public static async testToken(): Promise<any> {
    return request({
      method: 'POST',
      url: `${OpenAPI.BASE_URL}/api/login/test-token`,
      headers: {
        'Authorization': `Bearer ${OpenAPI.TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  }
}