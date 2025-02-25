// lib/api/core/OpenAPI.tsx
export const OpenAPI = {
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
  TOKEN: '',
  USERNAME: '',
  PASSWORD: '',
  HEADERS: {},
  
  setAccessToken(token: string) {
    this.TOKEN = token;
  },
  
  withCredentials: true,
};