// components/ChatHeader.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';

type ChatHeaderProps = {
  title: string;
  onNewChat?: () => void;
};

export default function ChatHeader({ title, onNewChat }: ChatHeaderProps) {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  return (
    <View style={[
      styles.header,
      { backgroundColor: isDarkMode ? '#1e1e1e' : '#fff' }
    ]}>
      <TouchableOpacity
        onPress={() => navigation.openDrawer()}
        style={styles.drawerToggle}
      >
        <View style={styles.dotsContainer}>
          <View style={[styles.dot, { backgroundColor: isDarkMode ? '#fff' : '#000' }]} />
          <View style={[styles.dot, { backgroundColor: isDarkMode ? '#fff' : '#000' }]} />
          <View style={[styles.dot, { backgroundColor: isDarkMode ? '#fff' : '#000' }]} />
        </View>
      </TouchableOpacity>

      <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#000' }]}>
        {title}
      </Text>

      <TouchableOpacity
        onPress={onNewChat}
        style={styles.newChatButton}
      >
        <Ionicons
          name="add"
          size={24}
          color={isDarkMode ? '#fff' : '#000'}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  drawerToggle: {
    padding: 10,
  },
  dotsContainer: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: 20,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginVertical: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  newChatButton: {
    padding: 10,
  },
});
