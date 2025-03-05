import { StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ProfileScreen() {
  const { user, signOut, refreshUser } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await signOut();
              
              // Force navigation to login screen
              console.log('🔀 Navigating to login screen after logout');
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Profile</ThemedText>
        <TouchableOpacity 
          onPress={handleLogout}
          disabled={isLoading}
          style={styles.logoutButton}
        >
          <IconSymbol
            name="chevron.right"
            size={24}
            color={colorScheme === 'light' ? Colors.light.icon : Colors.dark.icon}
          />
          <ThemedText style={styles.logoutText}>Logout</ThemedText>
        </TouchableOpacity>
      </ThemedView>

      <ThemedView style={styles.profileSection}>
        <ThemedView style={styles.avatarContainer}>
          <ThemedText style={styles.avatarText}>
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : user?.email.charAt(0).toUpperCase()}
          </ThemedText>
        </ThemedView>
        
        <ThemedView style={styles.userInfo}>
          {user?.full_name && (
            <ThemedText style={styles.userName}>{user.full_name}</ThemedText>
          )}
          <ThemedText style={styles.userEmail}>{user?.email}</ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.infoSection}>
        <ThemedText type="subtitle">Account Information</ThemedText>
        
        <ThemedView style={styles.infoItem}>
          <ThemedText style={styles.infoLabel}>Email</ThemedText>
          <ThemedText>{user?.email}</ThemedText>
        </ThemedView>
        
        <ThemedView style={styles.infoItem}>
          <ThemedText style={styles.infoLabel}>Full Name</ThemedText>
          <ThemedText>{user?.full_name || 'Not set'}</ThemedText>
        </ThemedView>
        
        <ThemedView style={styles.infoItem}>
          <ThemedText style={styles.infoLabel}>Account Type</ThemedText>
          <ThemedText>{user?.is_superuser ? 'Administrator' : 'Standard User'}</ThemedText>
        </ThemedView>
        
        <ThemedView style={styles.infoItem}>
          <ThemedText style={styles.infoLabel}>Status</ThemedText>
          <ThemedText>{user?.is_active ? 'Active' : 'Inactive'}</ThemedText>
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 50,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    color: '#e74c3c',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0a7ea4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
  },
  infoSection: {
    marginTop: 20,
  },
  infoItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
});