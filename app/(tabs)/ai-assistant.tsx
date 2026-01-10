import { aiPromptService, HealthPrompt } from '@/lib/AIPromptService';
import { chatSessionService } from '@/lib/chatSessionService';
import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
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
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  shouldAnimate?: boolean;
  imageUri?: string;
}

import { TypewriterMessage } from '@/components/TypewriterMessage';

export default function AIHealthAssistant() {
  const { colors } = useTheme();
  const router = useRouter();
  const { sessionId: paramSessionId } = useLocalSearchParams<{ sessionId: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [proactivePrompts, setProactivePrompts] = useState<HealthPrompt[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);

  // Auto-focus input when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 400);
      return () => clearTimeout(timer);
    }, [])
  );

  // Auto-scroll whenever content size changes (new message)
  const handleContentSizeChange = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSendingMessage(false);
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: '*(Response stopped by user)*',
        created_at: new Date().toISOString(),
        shouldAnimate: false
      }]);
    }
  };

  useEffect(() => {
    if (paramSessionId) {
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
          fetchProactivePrompts(user.id);
        }
      }
    } catch (error) {
      console.error('Error initializing:', error);
    }
  };

  const fetchProactivePrompts = async (uid: string) => {
    setIsLoadingPrompts(true);
    try {
      const prompts = await aiPromptService.generatePrompts(uid);
      setProactivePrompts(prompts);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingPrompts(false);
    }
  };

  const loadSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    const messages = await chatSessionService.getSessionMessages(sessionId);
    const formattedMessages = messages.map(m => ({ ...m, shouldAnimate: false })) as ChatMessage[];
    setChatMessages(formattedMessages);
    setIsSidebarOpen(false);
    // Force scroll after loading history
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 50);
  };

  const handleStartNewChat = async () => {
    setChatMessages([]);
    setCurrentSessionId(null);
    setIsSidebarOpen(false);
    if (userId) fetchProactivePrompts(userId);
  };

  const handleSelectPrompt = async (prompt: HealthPrompt) => {
    setIsSendingMessage(true);
    try {
      const sid = await chatSessionService.createSession(userId, prompt.trigger_text);
      setCurrentSessionId(sid);
      setSessions(await chatSessionService.getUserSessions(userId));

      const { data: assistantMsg, error } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sid,
          user_id: userId,
          role: 'assistant',
          content: prompt.chat_opening
        })
        .select()
        .single();

      if (error) throw error;

      setChatMessages([{
        id: assistantMsg.id,
        role: 'assistant',
        content: assistantMsg.content,
        created_at: assistantMsg.created_at,
        shouldAnimate: true
      }]);

      setProactivePrompts([]);

    } catch (e) {
      Alert.alert('Error', 'Failed to start.');
    } finally {
      setIsSendingMessage(false);
    }
  };


  const handleSendMessage = async () => {
    const messageText = inputMessage.trim();

    const tempUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
      shouldAnimate: true, // Animate user message too!
    };

    setChatMessages(prev => [...prev, tempUserMsg]);
    setInputMessage('');
    setIsSendingMessage(true);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const result = await chatSessionService.sendMessage(userId, currentSessionId, messageText, controller.signal);

      if (!currentSessionId) {
        setCurrentSessionId(result.sessionId);
        setSessions(await chatSessionService.getUserSessions(userId));
      }

      setChatMessages(prev => [...prev, {
        ...(result.assistantMessage as any),
        shouldAnimate: true
      }]);
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message === 'Aborted') {
        console.log('Chat message aborted');
        return;
      }
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setIsSendingMessage(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.push('/')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsSidebarOpen(true)} style={styles.menuButton}>
            <Ionicons name="time-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Curable AI</Text>
        <TouchableOpacity onPress={handleStartNewChat} style={styles.newChatButton}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={handleContentSizeChange} // Smooth auto-scroll
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
          {/* Empty State */}
          {chatMessages.length === 0 && !isSendingMessage && (
            <Animated.View entering={FadeInDown.springify()} style={styles.emptyState}>
              <Ionicons name="sparkles" size={32} color={colors.primary} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Clinical Observations</Text>

              {isLoadingPrompts ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
              ) : (
                <View style={styles.promptList}>
                  {proactivePrompts.map((prompt, index) => (
                    <Animated.View
                      key={prompt.id}
                      entering={FadeInDown.delay(index * 100).springify()}
                    >
                      <TouchableOpacity
                        style={[styles.promptCard, { backgroundColor: '#0D0D0D' }]}
                        onPress={() => handleSelectPrompt(prompt)}
                      >
                        <Text style={[styles.promptText, { color: colors.text }]}>{prompt.trigger_text}</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                  {proactivePrompts.length === 0 && (
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                      No data-driven patterns detected yet.
                    </Text>
                  )}
                </View>
              )}
            </Animated.View>
          )}

          {/* Messages */}
          {chatMessages.map((msg) => (
            <Animated.View
              key={msg.id}
              entering={msg.shouldAnimate ? FadeInDown.springify().damping(15) : undefined}
              layout={Layout.springify()}
              style={[styles.messageRow, msg.role === 'user' ? styles.userRow : styles.aiRow]}
            >
              <View style={[
                styles.bubble,
                msg.role === 'user' ? [styles.userBubble, { borderColor: colors.primary }] : [styles.aiBubble, { backgroundColor: '#0D0D0D' }],
              ]}>
                {msg.imageUri && (
                  <Image source={{ uri: msg.imageUri }} style={styles.msgImage} resizeMode="cover" />
                )}
                {/* Use the new Typewriter that supports Bold Markdown */}
                {msg.content ? (
                  <TypewriterMessage
                    style={[styles.messageText, { color: colors.text }]}
                    text={msg.content}
                    shouldAnimate={msg.shouldAnimate}
                    typingSpeed={10} // Faster typing
                  />
                ) : null}
              </View>
            </Animated.View>
          ))}

          {isSendingMessage && (
            <Animated.View entering={FadeInDown} style={styles.messageRow}>
              <View style={[styles.bubble, styles.aiBubble, { backgroundColor: '#0D0D0D', flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Analyzing...</Text>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </View>

      {/* Input Area - Native behavior handling */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={styles.keyboardContainer}
      >

        <View style={[styles.inputContainer, { borderTopColor: 'rgba(255,255,255,0.05)', backgroundColor: colors.background }]}>

          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.text, backgroundColor: '#0A0A0A' }]}
            placeholder="Describe symptoms..."
            placeholderTextColor={colors.textLight}
            value={inputMessage}
            onChangeText={setInputMessage}
            multiline
            textAlignVertical="center"
            editable={!isSendingMessage}
          />

          {isSendingMessage ? (
            <TouchableOpacity onPress={handleStopGeneration} style={styles.stopButton}>
              <Ionicons name="stop-circle" size={32} color="#FF453A" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleSendMessage}
              disabled={!inputMessage.trim() || isSendingMessage}
              style={styles.sendButton}
            >
              <Ionicons name="arrow-up" size={24} color={inputMessage.trim() ? colors.primary : colors.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Sidebar Modal (Simplified for brevity of full-file-replace, keeping logic) */}
      <Modal visible={isSidebarOpen} transparent animationType="fade" onRequestClose={() => setIsSidebarOpen(false)}>
        <View style={styles.sidebarOverlay}>
          <TouchableOpacity style={styles.sidebarDismiss} onPress={() => setIsSidebarOpen(false)} />
          <View style={[styles.sidebarContent, { backgroundColor: '#0A0A0A' }]}>
            <View style={styles.sidebarHeader}>
              <Text style={[styles.sidebarTitle, { color: colors.text }]}>Start New Check-in</Text>
              <TouchableOpacity onPress={handleStartNewChat}>
                <Ionicons name="add-circle" size={32} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.sidebarList}>
              {sessions.map((session) => (
                <TouchableOpacity key={session.id} style={styles.sessionItem} onPress={() => loadSession(session.id)}>
                  <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>{session.title}</Text>
                  <Text style={[styles.sessionDate, { color: colors.textMuted }]}>{new Date(session.created_at).toLocaleDateString()}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    zIndex: 10
  },
  menuButton: { padding: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center', marginRight: 40 }, // Offset for centered text if needed, or adjust
  newChatButton: { padding: 8, marginLeft: 8 },

  chatArea: { flex: 1 },
  chatContent: { padding: 20, paddingBottom: 40 },

  messageRow: { marginBottom: 24, flexDirection: 'row', width: '100%' },
  userRow: { justifyContent: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },

  bubble: { maxWidth: '85%', padding: 16, borderRadius: 20 },
  userBubble: { backgroundColor: '#1A1A1A', borderWidth: 1, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#0D0D0D', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderBottomLeftRadius: 4 },

  messageText: { fontSize: 16, lineHeight: 24 },
  msgImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 8 },

  keyboardContainer: {},
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'flex-end',
    gap: 12,
    borderTopWidth: 1,
  },
  attachButton: { padding: 10, paddingBottom: 12 },
  input: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  sendButton: { padding: 10, paddingBottom: 12 },
  stopButton: {
    padding: 10,
    paddingBottom: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },

  imagePreviewContainer: { padding: 12, flexDirection: 'row' },
  imagePreview: { width: 60, height: 60, borderRadius: 8 },
  removeImageButton: { marginLeft: -10, marginTop: -10, backgroundColor: 'white', borderRadius: 12 },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginBottom: 30 },
  promptList: { width: '100%', gap: 12 },
  promptCard: { padding: 20, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  promptText: { fontSize: 16, fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 20 },

  sidebarOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', flexDirection: 'row' },
  sidebarDismiss: { flex: 1 },
  sidebarContent: { width: width * 0.8, height: '100%', padding: 24, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)' },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 40 },
  sidebarTitle: { fontSize: 20, fontWeight: '700' },
  sidebarList: { gap: 16 },
  sessionItem: { padding: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)' },
  sessionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  sessionDate: { fontSize: 12 }
});
