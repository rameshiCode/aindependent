import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Pressable
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatComponent from '@/components/ChatComponent';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import Sidebar from '@/components/Sidebar';
import { useQueryClient } from '@tanstack/react-query';

// Get screen dimensions
const { width } = Dimensions.get('window');

// Interface for our data types
interface Message {
  role: string;
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
}

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // Default to dark theme for ChatGPT look
  const isDark = true;
  const headerBgColor = isDark ? '#222' : '#f5f5f5';
  const headerTextColor = isDark ? '#fff' : '#000';

  // Sidebar animation
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Active conversation state
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  // Handle sidebar open/close animations
  useEffect(() => {
    if (sidebarVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.5,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -width,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [sidebarVisible]);

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  // Handle selecting a conversation from the sidebar
  const handleSelectConversation = (conversation: Conversation) => {
    setActiveConversation(conversation);
    setSidebarVisible(false);
  };

  // Handle creating a new chat
  const handleCreateNewChat = () => {
    // This will be triggered from the sidebar when a new chat is created
    setSidebarVisible(false);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: isDark ? '#000' : Colors[colorScheme ?? 'light'].background }]}
      edges={['right', 'left']}
    >
      {/* Custom Header */}
      <View style={[styles.header, { backgroundColor: headerBgColor, paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.menuButton} onPress={toggleSidebar}>
          <Ionicons name="menu-outline" size={24} color={headerTextColor} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: headerTextColor }]}>ChatGPT</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={24} color={headerTextColor} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-vertical" size={24} color={headerTextColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat Component */}
      <View style={styles.chatContainer}>
        <ChatComponent
          initialConversation={activeConversation}
          onConversationChange={setActiveConversation}
        />
      </View>

      {/* Sidebar component with animation */}
      {sidebarVisible && (
        <>
          <Animated.View
            style={[
              styles.backdrop,
              { opacity: backdropOpacity }
            ]}
          >
            <Pressable
              style={styles.backdropPressable}
              onPress={() => setSidebarVisible(false)}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.sidebarContainer,
              { transform: [{ translateX: slideAnim }] }
            ]}
          >
            <Sidebar
              onSelectConversation={handleSelectConversation}
              onCreateNewChat={handleCreateNewChat}
              activeConversationId={activeConversation?.id}
              onClose={() => setSidebarVisible(false)}
            />
          </Animated.View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatContainer: {
    flex: 1,
  },
  sidebarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 1000,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 999,
  },
  backdropPressable: {
    width: '100%',
    height: '100%',
  },
});
