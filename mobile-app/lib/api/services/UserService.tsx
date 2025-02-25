// lib/api/services/UserService.tsx
import { OpenAPI } from '../core/OpenAPI';
import { request } from '../core/request';

export interface UserProfile {
  id: string;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  full_name: string;
}

export class UserService {
  /**
   * Get current user profile
   * @returns User profile information
   */
  public static async getCurrentUser(): Promise<UserProfile> {
    return request({
      method: 'GET',
      url: `${OpenAPI.BASE_URL}/api/users/me`,
      headers: {
        'Authorization': `Bearer ${OpenAPI.TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Update current user profile
   * @param requestBody Updated user data
   * @returns Updated user profile
   */
  public static async updateProfile(requestBody: Partial<UserProfile>): Promise<UserProfile> {
    return request({
      method: 'PUT',
      url: `${OpenAPI.BASE_URL}/api/users/me`,
      body: JSON.stringify(requestBody),
      headers: {
        'Authorization': `Bearer ${OpenAPI.TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get user by ID
   * @param id User ID
   * @returns User profile
   */
  public static async getUserById(id: string): Promise<UserProfile> {
    return request({
      method: 'GET',
      url: `${OpenAPI.BASE_URL}/api/users/${id}`,
      headers: {
        'Authorization': `Bearer ${OpenAPI.TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  }
}