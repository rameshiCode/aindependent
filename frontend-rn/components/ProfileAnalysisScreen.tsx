import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '../context/authProvider';
import { useProfile } from '../hooks/useProfile';
import EnhancedProfileDashboard from '../components/UserProfileDashboard';
import ConversationAnalyzer from '../components/ConversationAnalyzer';

const ProfileAnalysisScreen = () => {
  const [selectedTab, setSelectedTab] = useState('profile'); // 'profile' or 'analyzer'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { session, currentUser } = useAuth();
  
  // Use the useProfile hook to get profile data
  const { 
    structuredProfile, 
    profile,
    isLoadingProfile, 
    generateStructuredProfile, 
    processAllConversations 
  } = useProfile();
  
  // Determine which profile data to use (structured profile if available, otherwise regular profile)
  const profileData = structuredProfile || profile;
  
  // Load profile data on component mount
  useEffect(() => {
    if (session && currentUser && !profileData && !isLoadingProfile) {
      generateStructuredProfile();
    }
  }, [session, currentUser]);
  
  // Render the tab buttons
  const renderTabButtons = () => (
    <View style={styles.tabsContainer}>
      <TouchableOpacity
        style={[styles.tabButton, selectedTab === 'profile' && styles.activeTabButton]}
        onPress={() => setSelectedTab('profile')}
      >
        <Text 
          style={[styles.tabText, selectedTab === 'profile' && styles.activeTabText]}
        >
          Profile Dashboard
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tabButton, selectedTab === 'analyzer' && styles.activeTabButton]}
        onPress={() => setSelectedTab('analyzer')}
      >
        <Text 
          style={[styles.tabText, selectedTab === 'analyzer' && styles.activeTabText]}
        >
          Analyze Conversations
        </Text>
      </TouchableOpacity>
    </View>
  );
  
  // Render toolbar with action buttons
  const renderToolbar = () => (
    <View style={styles.toolbarContainer}>
      {selectedTab === 'profile' ? (
        <>
          <TouchableOpacity 
            style={styles.toolbarButton} 
            onPress={() => generateStructuredProfile()}
            disabled={isLoadingProfile}
          >
            <Text style={styles.toolbarButtonText}>Generate New</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.toolbarButton} 
            onPress={() => processAllConversations()}
            disabled={isLoadingProfile}
          >
            <Text style={styles.toolbarButtonText}>Process All</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
  
  // Render content based on selected tab
  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }
    
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }
    
    if (selectedTab === 'profile') {
      return (
        <EnhancedProfileDashboard 
          profileData={profileData} 
          onRefresh={() => generateStructuredProfile()}
        />
      );
    } else {
      return (
        <ConversationAnalyzer />
      );
    }
  };
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Recovery Insights" }} />
      
      {renderTabButtons()}
      {renderToolbar()}
      
      <View style={styles.contentContainer}>
        {renderContent()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#3498db',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#3498db',
    fontWeight: '600',
  },
  toolbarContainer: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f5f7fa',
  },
  toolbarButton: {
    backgroundColor: '#3498db',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  toolbarButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  contentContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default ProfileAnalysisScreen;