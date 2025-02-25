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
