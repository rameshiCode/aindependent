import { WebBrowserRedirectResult } from 'expo-web-browser';

/**
 * Extracts the access token from the redirect URL after OAuth authentication
 */
export function extractAccessToken(result: WebBrowserRedirectResult): string | null {
  if (result.type !== 'success' || !result.url) {
    return null;
  }

  // Parse the URL to extract the token
  try {
    // For this implementation, we're assuming the token is returned as JSON in the URL
    // Your actual implementation may differ based on how your backend returns the token
    const url = new URL(result.url);
    const tokenData = url.searchParams.get('token_data');
    
    if (tokenData) {
      const parsedData = JSON.parse(decodeURIComponent(tokenData));
      return parsedData.access_token;
    }
    
    // Alternative approach if token is in hash fragment
    const hashParams = new URLSearchParams(url.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    if (accessToken) {
      return accessToken;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to extract access token:', error);
    return null;
  }
}