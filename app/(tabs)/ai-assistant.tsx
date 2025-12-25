import { chatSessionService } from '@/lib/chatSessionService';
import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { width } = Dimensions.get('window');

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  shouldAnimate?: boolean;
}

import { TypewriterMessage } from '@/components/TypewriterMessage';


export default function AIHealthAssistant() {
  const { colors } = useTheme();
  // ... existing hooks
  const { sessionId: paramSessionId } = useLocalSearchParams<{ sessionId: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const [userId, setUserId] = useState<string>('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (paramSessionId) {
      // If a session ID is provided via params, load it prioritized
      setupWithSession(paramSessionId);
    } else {
      initializeAssistant();
    }
  }, [paramSessionId]);

  const setupWithSession = async (sid: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const userSessions = await chatSessionService.getUserSessions(user.id);
      setSessions(userSessions);
      await loadSession(sid);
    }
  };

  useEffect(() => {
    if (chatMessages.length > 0) {
      // Small timeout to allow layout to settle before scrolling
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatMessages]);

  const initializeAssistant = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const userSessions = await chatSessionService.getUserSessions(user.id);
        setSessions(userSessions);

        if (userSessions.length > 0) {
          await loadSession(userSessions[0].id);
        } else {
          // Start a new session if none exists
          const welcomeMessage = "Hello! I'm your Curable AI health assistant. How can I help you today?";
          setChatMessages([{
            id: '1',
            role: 'assistant',
            content: welcomeMessage,
            created_at: new Date().toISOString(),
            shouldAnimate: true // Animate welcome message
          }]);
        }
      }
    } catch (error) {
      console.error('Error initializing assistant:', error);
    }
  };

  const loadSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    const messages = await chatSessionService.getSessionMessages(sessionId);
    // When loading history, we DO NOT animate
    const formattedMessages = messages.map(m => ({ ...m, shouldAnimate: false })) as ChatMessage[];
    setChatMessages(formattedMessages);
    setIsSidebarOpen(false);
  };

  const handleStartNewChat = async () => {
    setChatMessages([]);
    setCurrentSessionId(null);
    setIsSidebarOpen(false);
    const welcomeMessage = "Starting a new clinical investigation. What's on your mind?";
    setChatMessages([{
      id: 'welcome',
      role: 'assistant',
      content: welcomeMessage,
      created_at: new Date().toISOString(),
      shouldAnimate: true // Animate new chat welcome
    }]);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSendingMessage || !userId) return;

    const messageText = inputMessage.trim();
    const tempUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
      shouldAnimate: false // Never animate user messages
    };

    setChatMessages(prev => [...prev, tempUserMsg]);
    setInputMessage('');
    setIsSendingMessage(true);

    try {
      const result = await chatSessionService.sendMessage(userId, currentSessionId, messageText);

      if (!currentSessionId) {
        setCurrentSessionId(result.sessionId);
        // Refresh sessions list
        const updatedSessions = await chatSessionService.getUserSessions(userId);
        setSessions(updatedSessions);
      }

      setChatMessages(prev => [...prev, {
        ...(result.assistantMessage as any),
        shouldAnimate: true // Animate the new AI response
      }]);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setIsSidebarOpen(true)} style={styles.menuButton}>
          <Ionicons name="time-outline" size={24} color={colors.text} />
          <Text style={[styles.historyLabel, { color: colors.textMuted }]}>History</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Curable AI</Text>
        </View>

        <TouchableOpacity onPress={handleStartNewChat} style={styles.newChatButton}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
      >
        {chatMessages.length === 0 && !isSendingMessage && (
          <View style={styles.emptyState}>
            <Ionicons name="sparkles" size={48} color="rgba(255,107,0,0.1)" />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Curable AI is ready to analyze.</Text>
          </View>
        )}

        {chatMessages.map((msg) => (
          <View key={msg.id} style={[styles.messageRow, msg.role === 'user' ? styles.userRow : styles.aiRow]}>
            <View style={[
              styles.bubble,
              msg.role === 'user' ? [styles.userBubble, { borderColor: colors.primary }] : [styles.aiBubble, { backgroundColor: '#0D0D0D' }],
            ]}>
              <TypewriterMessage
                style={[styles.messageText, { color: colors.text }]}
                text={msg.content}
                shouldAnimate={msg.shouldAnimate}
              />
            </View>
          </View>
        ))}
        {isSendingMessage && (
          <View style={styles.messageRow}>
            <View style={[styles.bubble, styles.aiBubble, { backgroundColor: '#0D0D0D' }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          </View>
        )}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
        <View style={[styles.inputContainer, { borderTopColor: 'rgba(255,255,255,0.05)' }]}>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: '#0A0A0A' }]}
            placeholder="Describe clinical symptoms or query..."
            placeholderTextColor={colors.textLight}
            value={inputMessage}
            onChangeText={setInputMessage}
            multiline
          />
          <TouchableOpacity onPress={handleSendMessage} disabled={!inputMessage.trim() || isSendingMessage} style={styles.sendButton}>
            <Ionicons name="arrow-up" size={24} color={inputMessage.trim() ? colors.primary : colors.textLight} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Sidebar Modal */}
      <Modal
        visible={isSidebarOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsSidebarOpen(false)}
      >
        <View style={styles.sidebarOverlay}>
          <TouchableOpacity style={styles.sidebarDismiss} onPress={() => setIsSidebarOpen(false)} />
          <Animated.View style={[styles.sidebarContent, { backgroundColor: '#0A0A0A' }]}>
            <View style={styles.sidebarHeader}>
              <Text style={[styles.sidebarTitle, { color: colors.text }]}>Investigation History</Text>
              <TouchableOpacity onPress={() => setIsSidebarOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.sidebarNewChat, { backgroundColor: 'rgba(255,107,0,0.05)' }]} onPress={handleStartNewChat}>
              <Ionicons name="add" size={20} color={colors.primary} />
              <Text style={[styles.sidebarNewChatText, { color: colors.primary }]}>New Investigation</Text>
            </TouchableOpacity>

            <ScrollView contentContainerStyle={styles.sidebarList}>
              {sessions.map((session) => (
                <TouchableOpacity
                  key={session.id}
                  style={[styles.sessionItem, session.id === currentSessionId && { backgroundColor: '#121212' }]}
                  onPress={() => loadSession(session.id)}
                >
                  <Ionicons name="chatbox-ellipses-outline" size={18} color={session.id === currentSessionId ? colors.primary : colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>{session.title}</Text>
                    <Text style={[styles.sessionDate, { color: colors.textMuted }]}>{new Date(session.created_at).toLocaleDateString()}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16
  },
  menuButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0D0D0D', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  historyLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  newChatButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#0D0D0D' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, textTransform: 'uppercase' },
  chatArea: { flex: 1 },
  chatContent: { padding: 24, paddingBottom: 60 },
  messageRow: { marginBottom: 20, flexDirection: 'row' },
  userRow: { justifyContent: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '85%', padding: 16, borderRadius: 24 },
  userBubble: { backgroundColor: '#000000', borderWidth: 1 },
  aiBubble: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  messageText: { fontSize: 16, lineHeight: 24 },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 100 : 90,
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  sendButton: { padding: 8 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100, gap: 16 },
  emptyText: { fontSize: 15, fontWeight: '500' },

  // Sidebar Styles
  sidebarOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', flexDirection: 'row' },
  sidebarDismiss: { flex: 1 },
  sidebarContent: { width: width * 0.8, height: '100%', padding: 24, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)' },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, marginTop: 40 },
  sidebarTitle: { fontSize: 20, fontWeight: '800' },
  sidebarNewChat: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, gap: 12, marginBottom: 24 },
  sidebarNewChatText: { fontWeight: '700', fontSize: 15 },
  sidebarList: { gap: 8 },
  sessionItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, gap: 12 },
  sessionTitle: { fontSize: 15, fontWeight: '600' },
  sessionDate: { fontSize: 12, marginTop: 2 }
});
