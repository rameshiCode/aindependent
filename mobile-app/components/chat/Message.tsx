// components/chat/Message.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../../constants/Colors';
import { useColorScheme } from '../useColorScheme';

// Define the message type
export interface MessageType {
  id: string;
  text: string;
  sender: string;
  timestamp: Date;
}

// Define props for the Message component
export interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const colorScheme = useColorScheme();
  
  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: Colors[colorScheme ?? 'light'].text }]}>
        {message.text}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.sender}>{message.sender}</Text>
        <Text style={styles.timestamp}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    backgroundColor: '#f0f0f0',
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sender: {
    fontSize: 12,
    color: '#666',
  },
  timestamp: {
    fontSize: 10,
    color: '#999',
  },
});