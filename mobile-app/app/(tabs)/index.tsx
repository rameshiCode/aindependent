// app/(tabs)/index.tsx or other location where you use Message.tsx
import React, { useState } from 'react';
import { View, FlatList, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { Text } from '../../components/Themed';
import { Message, MessageType } from '../../components/chat/Message';
import { MessageInput } from '../../components/chat/MessageInput';

export default function ChatScreen() {
  const [messages, setMessages] = useState<MessageType[]>([
    // Example initial messages - replace or remove as needed
    {
      id: '1',
      text: 'Hello there!',
      sender: 'User',
      timestamp: new Date(),
    },
  ]);

  const handleSend = (text: string) => {
    const newMessage: MessageType = {
      id: Date.now().toString(),
      text,
      sender: 'User',
      timestamp: new Date(),
    };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat</Text>
      </View>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Message message={item} />}
        contentContainerStyle={styles.messageList}
        inverted
      />
      <MessageInput onSend={handleSend} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  messageList: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
});