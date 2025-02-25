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
