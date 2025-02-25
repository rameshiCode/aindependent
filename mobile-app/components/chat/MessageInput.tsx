// components/chat/MessageInput.tsx
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import { useColorScheme } from '../useColorScheme';

interface MessageInputProps {
  onSend: (text: string) => void;
}

export function MessageInput({ onSend }: MessageInputProps) {
  const [text, setText] = useState('');
  const colorScheme = useColorScheme();
  
  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={[
          styles.input,
          { 
            color: Colors[colorScheme ?? 'light'].text,
            backgroundColor: colorScheme === 'dark' ? '#1c1c1c' : '#f5f5f5'
          }
        ]}
        value={text}
        onChangeText={setText}
        placeholder="Type a message..."
        placeholderTextColor="#999"
        returnKeyType="send"
        onSubmitEditing={handleSend}
      />
      <TouchableOpacity 
        style={styles.sendButton} 
        onPress={handleSend}
        disabled={!text.trim()}
      >
        <Ionicons 
          name="send" 
          size={24} 
          color={text.trim() ? Colors[colorScheme ?? 'light'].tint : '#999'} 
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});