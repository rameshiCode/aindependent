#!/bin/bash
# Script to create all required folders and files for the mobile app

# Navigate to the mobile-app directory
cd mobile-app || exit

# Create directory structure
mkdir -p lib/api/core lib/api/services lib/auth components/ui
mkdir -p "app/login" "app/(tabs)"

# Create API client files
cat > lib/api/core/OpenAPI.tsx << 'EOF'
export const OpenAPI = {
  BASE: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
  TOKEN: '',
  CREDENTIALS: 'include',
  WITH_CREDENTIALS: true,
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  setAccessToken(token: string) {
    OpenAPI.TOKEN = token;
  },
};
EOF

cat > lib/api/core/request.tsx << 'EOF'
import { OpenAPI } from './OpenAPI';

export interface ApiRequestOptions {
  method: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'PATCH';
  url: string;
  path?: Record<string, any>;
  cookies?: Record<string, any>;
  headers?: Record<string, any>;
  query?: Record<string, any>;
  formData?: Record<string, any>;
  body?: any;
  mediaType?: string;
  responseHeader?: string;
  errors?: Record<number, string>;
}

export class ApiError extends Error {
  public readonly url: string;
  public readonly status: number;
  public readonly statusText: string;
  public readonly body: any;
  public readonly request: ApiRequestOptions;

  constructor(request: ApiRequestOptions, response: Response, body: any) {
    super(`${response.status} ${response.statusText} for ${request.method} ${request.url}`);
    this.name = 'ApiError';
    this.url = request.url;
    this.status = response.status;
    this.statusText = response.statusText;
    this.body = body;
    this.request = request;
  }
}

export async function request<T>(options: ApiRequestOptions): Promise<T> {
  const { method, url, path, cookies, headers, query, formData, body, mediaType, responseHeader, errors } = options;

  // Build the URL
  let requestUrl = `${OpenAPI.BASE}${url}`;
  if (path) {
    Object.keys(path).forEach((key) => {
      requestUrl = requestUrl.replace(`{${key}}`, encodeURIComponent(String(path[key])));
    });
  }

  // Build query string
  if (query) {
    const queryParams = new URLSearchParams();
    Object.keys(query).forEach((key) => {
      if (query[key] !== undefined) {
        queryParams.append(key, String(query[key]));
      }
    });
    const queryString = queryParams.toString();
    if (queryString) {
      requestUrl += `?${queryString}`;
    }
  }

  // Prepare headers
  const requestHeaders = new Headers({
    ...OpenAPI.HEADERS,
    ...headers,
  });

  // Add auth token if available
  if (OpenAPI.TOKEN) {
    requestHeaders.set('Authorization', `Bearer ${OpenAPI.TOKEN}`);
  }

  // Prepare the request
  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
    credentials: OpenAPI.CREDENTIALS as RequestCredentials,
  };

  // Add body if needed
  if (body !== undefined) {
    requestOptions.body = JSON.stringify(body);
  }

  // Make the request
  const response = await fetch(requestUrl, requestOptions);
  
  // Handle potential errors
  if (!response.ok) {
    let responseBody: any;
    try {
      responseBody = await response.json();
    } catch (error) {
      responseBody = await response.text();
    }
    
    throw new ApiError(options, response, responseBody);
  }

  // Parse the response
  let responseBody: any;
  if (responseHeader) {
    responseBody = response.headers.get(responseHeader);
  } else {
    try {
      responseBody = await response.json();
    } catch {
      responseBody = await response.text();
    }
  }

  return responseBody as T;
}
EOF

cat > lib/api/services/AuthService.tsx << 'EOF'
import { request } from '../core/request';
import { OpenAPI } from '../core/OpenAPI';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface UserCreate {
  email: string;
  password: string;
  full_name?: string;
}

export class AuthService {
  /**
   * Login for access token
   */
  public static async login(requestBody: LoginRequest): Promise<Token> {
    const result = await request<Token>({
      method: 'POST',
      url: '/api/v1/login/access-token',
      body: new URLSearchParams({
        username: requestBody.username,
        password: requestBody.password,
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    // Set the token for future requests
    if (result.access_token) {
      OpenAPI.setAccessToken(result.access_token);
    }
    
    return result;
  }

  /**
   * Register new user
   */
  public static async register(requestBody: UserCreate): Promise<any> {
    return request<any>({
      method: 'POST',
      url: '/api/v1/users/open',
      body: requestBody,
    });
  }
}
EOF

cat > lib/api/services/UserService.tsx << 'EOF'
import { request } from '../core/request';

export interface UserProfile {
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  full_name: string;
  id: string;
}

export class UserService {
  /**
   * Get current user
   */
  public static async getCurrentUser(): Promise<UserProfile> {
    return request<UserProfile>({
      method: 'GET',
      url: '/api/v1/users/me',
    });
  }
}
EOF

cat > lib/api/index.tsx << 'EOF'
export * from './services/AuthService';
export * from './services/UserService';
export * from './core/OpenAPI';
EOF

# Create Auth context
cat > lib/auth/AuthContext.tsx << 'EOF'
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService, UserService, UserProfile, OpenAPI } from '../api';
import { router } from 'expo-router';

// Define the context shape
interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys
const TOKEN_KEY = 'auth_token';

// Provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize - check for existing token
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token) {
          OpenAPI.setAccessToken(token);
          const userData = await UserService.getCurrentUser();
          setUser(userData);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        // Clear any invalid tokens
        await AsyncStorage.removeItem(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await AuthService.login({ username: email, password });
      await AsyncStorage.setItem(TOKEN_KEY, result.access_token);
      OpenAPI.setAccessToken(result.access_token);
      const userData = await UserService.getCurrentUser();
      setUser(userData);
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (email: string, password: string, fullName?: string) => {
    setLoading(true);
    setError(null);
    try {
      await AuthService.register({ email, password, full_name: fullName });
      // Automatically login after successful registration
      await login(email, password);
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to register');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    setLoading(true);
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
      OpenAPI.setAccessToken('');
      setUser(null);
      router.replace('/login');
    } catch (err: any) {
      console.error('Logout error:', err);
      setError(err.message || 'Failed to logout');
    } finally {
      setLoading(false);
    }
  };

  // Context value
  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook for using the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
EOF

cat > lib/auth/protected-route.tsx << 'EOF'
import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from './AuthContext';

export function useProtectedRoute() {
  const { user, loading } = useAuth();

  useEffect(() => {
    // You can add additional auth checks here if needed
  }, [user, loading]);

  if (loading) {
    // You could return a loading component here
    return null;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return null;
}
EOF

# Create UI components
cat > lib/utils.tsx << 'EOF'
import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export function validateEmail(email: string): boolean {
  return emailRegex.test(email);
}

export function validatePassword(password: string): boolean {
  // At least 8 characters, one uppercase, one lowercase, one number
  return password.length >= 8 && 
    /[A-Z]/.test(password) && 
    /[a-z]/.test(password) && 
    /[0-9]/.test(password);
}
EOF

cat > components/ui/Button.tsx << 'EOF'
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, TouchableOpacityProps } from 'react-native';
import { cn } from '../../lib/utils';

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}) => {
  const baseStyles = 'rounded-md items-center justify-center';
  
  const variantStyles = {
    primary: 'bg-primary-500 active:bg-primary-600',
    secondary: 'bg-gray-200 active:bg-gray-300',
    outline: 'border border-gray-300 active:bg-gray-100',
    ghost: 'active:bg-gray-100',
    destructive: 'bg-red-500 active:bg-red-600',
  };
  
  const sizeStyles = {
    sm: 'py-1 px-3',
    md: 'py-2 px-4',
    lg: 'py-3 px-6',
  };
  
  const textVariantStyles = {
    primary: 'text-white',
    secondary: 'text-gray-800',
    outline: 'text-gray-800',
    ghost: 'text-gray-800',
    destructive: 'text-white',
  };
  
  const textSizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };
  
  const disabledStyles = 'opacity-50';

  return (
    <TouchableOpacity
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && disabledStyles,
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'outline' || variant === 'ghost' ? '#1F2937' : '#FFFFFF'} />
      ) : (
        <Text className={cn('font-medium', textVariantStyles[variant], textSizeStyles[size])}>
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
};
EOF

cat > components/ui/Input.tsx << 'EOF'
import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, TextInputProps } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { cn } from '../../lib/utils';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  isPassword?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  isPassword = false,
  leftIcon,
  rightIcon,
  className = '',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!isPassword);

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-gray-700 font-medium mb-1 text-sm">{label}</Text>
      )}
      <View
        className={cn(
          'flex-row items-center border rounded-md overflow-hidden bg-white',
          isFocused && !error ? 'border-primary-500' : 'border-gray-300',
          error && 'border-red-500',
          className
        )}
      >
        {leftIcon && (
          <View className="pl-3 pr-1">{leftIcon}</View>
        )}
        <TextInput
          className="flex-1 py-2 px-3 text-gray-900"
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholderTextColor="#9CA3AF"
          {...props}
        />
        {isPassword ? (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            className="pr-3 pl-1"
          >
            <Feather
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color="#6B7280"
            />
          </TouchableOpacity>
        ) : (
          rightIcon && <View className="pr-3 pl-1">{rightIcon}</View>
        )}
      </View>
      {error ? (
        <Text className="text-red-500 text-xs mt-1">{error}</Text>
      ) : helperText ? (
        <Text className="text-gray-500 text-xs mt-1">{helperText}</Text>
      ) : null}
    </View>
  );
};
EOF

# Create login and signup screens
cat > app/login/login.tsx << 'EOF'
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, Link } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { validateEmail } from '../../lib/utils';

export default function LoginScreen() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    
    try {
      await login(email, password);
      // Navigation happens in the auth context after successful login
    } catch (error: any) {
      // Handle specific error cases
      if (error.status === 401) {
        Alert.alert('Login Failed', 'Incorrect email or password. Please try again.');
      } else {
        Alert.alert('Login Error', error.message || 'An unexpected error occurred');
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 justify-center p-6">
            <View className="items-center mb-8">
              <Image 
                source={require('../../assets/images/icon.png')} 
                className="w-20 h-20"
                resizeMode="contain"
              />
              <Text className="text-2xl font-bold mt-4 text-gray-800">Welcome Back</Text>
              <Text className="text-gray-500 mt-2">Sign in to your account</Text>
            </View>
            
            <View className="space-y-4">
              <Input
                label="Email"
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                leftIcon={<Feather name="mail" size={18} color="#6B7280" />}
              />
              
              <Input
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                isPassword
                leftIcon={<Feather name="lock" size={18} color="#6B7280" />}
              />
              
              <TouchableOpacity className="self-end" onPress={() => router.push('/recover-password')}>
                <Text className="text-primary-500 text-sm">Forgot Password?</Text>
              </TouchableOpacity>
            </View>
            
            <View className="mt-6">
              <Button 
                onPress={handleLogin} 
                loading={loading}
                disabled={loading}
                size="lg"
                className="w-full"
              >
                Sign In
              </Button>
              
              <View className="flex-row justify-center mt-6">
                <Text className="text-gray-500">Don't have an account? </Text>
                <Link href="/login/signup" asChild>
                  <TouchableOpacity>
                    <Text className="text-primary-500 font-medium">Sign Up</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
EOF

cat > app/login/signup.tsx << 'EOF'
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Link, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { validateEmail, validatePassword } from '../../lib/utils';

export default function SignupScreen() {
  const { register, loading } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(password)) {
      newErrors.password = 'Password must be at least 8 characters with uppercase, lowercase, and number';
    }
    
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    
    try {
      await register(email, password, fullName);
      // Navigation happens in the auth context after successful registration
    } catch (error: any) {
      // Handle specific error cases
      if (error.status === 400) {
        Alert.alert('Registration Failed', 'This email may already be registered.');
      } else {
        Alert.alert('Registration Error', error.message || 'An unexpected error occurred');
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 p-6">
            <TouchableOpacity 
              onPress={() => router.back()}
              className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 mb-4"
            >
              <Feather name="arrow-left" size={20} color="#374151" />
            </TouchableOpacity>
            
            <View className="items-center mb-6">
              <Image 
                source={require('../../assets/images/icon.png')} 
                className="w-20 h-20"
                resizeMode="contain"
              />
              <Text className="text-2xl font-bold mt-4 text-gray-800">Create Account</Text>
              <Text className="text-gray-500 mt-2">Sign up to get started</Text>
            </View>
            
            <View className="space-y-4">
              <Input
                label="Full Name"
                placeholder="Enter your full name"
                autoCapitalize="words"
                value={fullName}
                onChangeText={setFullName}
                error={errors.fullName}
                leftIcon={<Feather name="user" size={18} color="#6B7280" />}
              />
              
              <Input
                label="Email"
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                leftIcon={<Feather name="mail" size={18} color="#6B7280" />}
              />
              
              <Input
                label="Password"
                placeholder="Create a password"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                isPassword
                leftIcon={<Feather name="lock" size={18} color="#6B7280" />}
                helperText="At least 8 characters with uppercase, lowercase, and number"
              />
              
              <Input
                label="Confirm Password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                error={errors.confirmPassword}
                isPassword
                leftIcon={<Feather name="lock" size={18} color="#6B7280" />}
              />
            </View>
            
            <View className="mt-6">
              <Button 
                onPress={handleSignup} 
                loading={loading}
                disabled={loading}
                size="lg"
                className="w-full"
              >
                Create Account
              </Button>
              
              <View className="flex-row justify-center mt-6">
                <Text className="text-gray-500">Already have an account? </Text>
                <Link href="/login" asChild>
                  <TouchableOpacity>
                    <Text className="text-primary-500 font-medium">Sign In</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
EOF

# Create/update app layouts
cat > app/_layout.tsx << 'EOF'
import React from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { useColorScheme } from 'react-native';
import { AuthProvider } from '../lib/auth/AuthContext';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'SpaceMono-Regular': require('../assets/fonts/SpaceMono-Regular.ttf'),
    // Add more fonts if needed
  });
  
  const colorScheme = useColorScheme();

  if (!fontsLoaded) {
    return null; // Avoid rendering until fonts are loaded
  }

  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="login/login" options={{ headerShown: false }} />
        <Stack.Screen name="login/signup" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
EOF

# Use quotes for paths with parentheses
mkdir -p "app/(tabs)"
cat > "app/(tabs)/_layout.tsx" << 'EOF'
import React from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useProtectedRoute } from '../../lib/auth/protected-route';

export default function TabsLayout() {
  // This will redirect to login if not authenticated
  const redirectComponent = useProtectedRoute();
  if (redirectComponent) return redirectComponent;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0967D2', // primary-500
        tabBarInactiveTintColor: '#6B7280',
        tabBarLabelStyle: {
          fontSize: 12,
        },
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Feather name="message-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
EOF

cat > "app/(tabs)/index.tsx" << 'EOF'
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth/AuthContext';
import { Button } from '../../components/ui/Button';

export default function ChatScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 p-4">
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-800">Welcome, {user?.full_name}</Text>
          <Text className="text-gray-500">Your chat interface</Text>
        </View>
        
        {/* Placeholder for chat UI */}
        <View className="flex-1 items-center justify-center p-8 mb-4 bg-gray-50 rounded-lg border border-gray-200">
          <Text className="text-lg text-gray-700 text-center mb-4">
            This is where your chat interface will be implemented
          </Text>
          <Text className="text-gray-500 text-center">
            You'll connect to Claude API here to provide the chat functionality
          </Text>
        </View>
        
        <Button 
          variant="outline"
          onPress={logout}
          className="mt-4"
        >
          Sign Out
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
EOF

# Create NativeWind configuration
cat > tailwind.config.js << 'EOF'
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E6F6FF',
          100: '#BAE3FF',
          200: '#7CC4FA',
          300: '#47A3F3',
          400: '#2186EB',
          500: '#0967D2',
          600: '#0552B5',
          700: '#03449E',
          800: '#01337D',
          900: '#002159',
        }
      },
    },
  },
  plugins: [],
};
EOF

# Update babel config
if [ -f babel.config.js ]; then
  cp babel.config.js babel.config.js.backup
fi

cat > babel.config.js << 'EOF'
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ["nativewind/babel"],
  };
};
EOF

# Create app.d.ts
cat > app.d.ts << 'EOF'
/// <reference types="nativewind/types" />
EOF

# Update package.json to include required dependencies
cat > package.json.updates << 'EOF'
{
  "dependencies": {
    "@react-native-async-storage/async-storage": "1.21.0",
    "clsx": "^2.1.0",
    "nativewind": "^4.0.1",
    "tailwind-merge": "^2.2.1"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.1"
  }
}
EOF

echo "All files have been created successfully!"
echo "Please run the following commands to install the necessary dependencies:"
echo "cd mobile-app"
echo "npm install @react-native-async-storage/async-storage clsx nativewind tailwind-merge"
echo "npm install -D tailwindcss"
echo "npx tailwindcss init"
echo ""
echo "If you encounter any issues with the file generation, please check file permissions and paths."