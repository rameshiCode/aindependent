import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { ProfileVisualizer } from '../../../components/ProfileVisualizer';
import { useAuth } from '../../../context/authProvider';
import { ThemedText } from '../../../components/ThemedText';

export default function ProfileScreen() {
  const { currentUser, isLoading } = useAuth();
  const userId = currentUser?.id;

  useEffect(() => {
    console.log("Current user:", currentUser);
    console.log("User ID:", userId);
  }, [currentUser, userId]);

  // Show loading state while auth is being determined
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ThemedText>Loading authentication data...</ThemedText>
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={styles.container}>
        <ThemedText>User not authenticated. Please log in.</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ProfileVisualizer userId={userId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
