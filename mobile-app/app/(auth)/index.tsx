// app/login/index.tsx
import { Redirect } from 'expo-router';
import React from 'react';

export default function LoginIndex() {
  // By default, redirect to the login screen
  return <Redirect href="/login/login" />;
}