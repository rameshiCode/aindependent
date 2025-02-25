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
