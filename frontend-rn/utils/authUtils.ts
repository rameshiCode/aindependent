import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

// For testing: Force clear the auth token
export async function clearAuthToken(): Promise<void> {
  console.log('⚠️ Clearing auth token for testing purposes');
  try {
    // Only clear on web for now to avoid SecureStore errors
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('auth_token');
    }
    
    // In native environments, we'd use SecureStore but we'll skip for now
    // to avoid the errors on web
  } catch (error) {
    console.error('Error clearing auth token:', error);
  }
}

/**
 * Extracts the access token from the redirect URL after OAuth authentication
 * 
 * This function handles multiple OAuth response formats:
 * 1. Direct access_token in URL params (mobile flow): "frontendrn:///(auth)/callback?access_token={jwt_token}"
 * 2. JSON response body (standard flow): {"access_token": "token", "token_type": "bearer"}
 */
export function extractAccessToken(result: WebBrowser.WebBrowserAuthSessionResult): string | null {
  if (result.type !== 'success' || !('url' in result)) {
    console.log('❌ WebBrowser result not successful or missing URL', result.type);
    return null;
  }

  // Parse the URL to extract the token
  try {
    // Parse the URL that matches our backend redirect pattern
    const url = new URL(result.url);
    console.log('🔄 Auth redirect URL received:', result.url);
    
    // Check if the URL contains our API endpoint for token retrieval
    // This handles the standard OAuth flow where we get redirected back to the API endpoint
    if (url.pathname.includes('/login/auth/google')) {
      console.log('✅ Detected standard OAuth flow, extracting JSON token response');
      
      // For this flow, the response body contains the token as JSON
      // We'll need to parse result.responseText if it exists
      if ('responseText' in result && result.responseText) {
        try {
          const jsonResponse = JSON.parse(result.responseText);
          if (jsonResponse.access_token) {
            console.log('✅ Found access_token in JSON response');
            return jsonResponse.access_token;
          }
        } catch (jsonError) {
          console.error('Failed to parse JSON response:', jsonError);
        }
      }
    }
    
    // Direct access_token in URL params from our FastAPI backend (mobile flow)
    const accessToken = url.searchParams.get('access_token');
    if (accessToken) {
      console.log('✅ Found access_token in URL params:', accessToken.substring(0, 10) + '...');
      return accessToken;
    }
    
    // Try to extract from token_data if the backend changes
    const tokenData = url.searchParams.get('token_data');
    if (tokenData) {
      try {
        const parsedData = JSON.parse(decodeURIComponent(tokenData));
        console.log('Found and parsed token_data');
        return parsedData.access_token;
      } catch {
        // If parsing fails, tokenData might be the raw token itself
        console.log('Found token_data but failed to parse as JSON');
        return tokenData;
      }
    }
    
    // Check hash fragment (JWT flows sometimes use this)
    const hashParams = new URLSearchParams(url.hash.substring(1));
    const hashToken = hashParams.get('access_token');
    if (hashToken) {
      console.log('Found token in hash fragment');
      return hashToken;
    }
    
    // Check if the path itself contains the token (rare case)
    const pathParts = url.pathname.split('/');
    const callbackIndex = pathParts.findIndex(part => part === 'callback');
    if (callbackIndex >= 0 && callbackIndex < pathParts.length - 1) {
      console.log('Found token in URL path');
      return pathParts[callbackIndex + 1];
    }
    
    console.log('No token found in redirect URL');
    return null;
  } catch (error) {
    console.error('Failed to extract access token:', error);
    return null;
  }
}