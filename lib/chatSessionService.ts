// lib/chatSessionService.ts
import { chatWithHealthAI } from './openAIHealthService';
import { supabase } from './supabaseClient';

interface ChatSession {
    id: string;
    user_id: string;
    title: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    message_count: number;
    has_extreme_flags: boolean;
    last_message_preview: string;
    context_summary?: string;
    summary_updated_at?: string;
    summary_message_count?: number;
}

interface ChatMessage {
    id: string;
    session_id: string;
    user_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    had_extreme_flags: boolean;
    extreme_signals?: any[];
    created_at: string;
}

export class ChatSessionService {

    // ==================== CREATE NEW SESSION ====================
    async createSession(userId: string, firstMessage: string): Promise<string> {
        try {
            const title = firstMessage.length > 50
                ? firstMessage.substring(0, 50) + '...'
                : firstMessage;

            const { data, error } = await supabase
                .from('chat_sessions')
                .insert({
                    user_id: userId,
                    title: title,
                    message_count: 0,
                    last_message_preview: firstMessage
                })
                .select()
                .single();

            if (error) throw error;
            return data.id;
        } catch (error) {
            console.error('Error creating chat session:', error);
            throw error;
        }
    }

    // ==================== GET ALL USER SESSIONS ====================
    async getUserSessions(userId: string): Promise<ChatSession[]> {
        try {
            const { data, error } = await supabase
                .from('chat_sessions')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching sessions:', error);
            return [];
        }
    }

    // ==================== GET ACTIVE SESSION ====================
    async getActiveSession(userId: string): Promise<ChatSession | null> {
        try {
            const { data, error } = await supabase
                .from('chat_sessions')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching active session:', error);
            return null;
        }
    }

    // ==================== GET SESSION MESSAGES ====================
    async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching messages:', error);
            return [];
        }
    }

    // ==================== HYBRID SMART CONTEXT (90% cost savings) ====================
    async getSmartContext(sessionId: string, userId: string): Promise<Array<{ role: string; content: string }>> {
        const context: Array<{ role: string; content: string }> = [];

        try {
            // 1. ALWAYS include extreme value warnings (critical safety)
            const extremeMessages = await this.getExtremeMessages(sessionId);
            if (extremeMessages.length > 0) {
                const extremeSummary = extremeMessages.map(msg =>
                    `${new Date(msg.created_at).toLocaleDateString()}: ${JSON.stringify(msg.extreme_signals)}`
                ).join('; ');

                context.push({
                    role: 'system',
                    content: `⚠️ CRITICAL: Extreme values detected in this session: ${extremeSummary}`
                });
            }

            // 2. Get session info
            const { data: session } = await supabase
                .from('chat_sessions')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (!session) return context;

            // 3. Use cached summary if session is long (>20 messages)
            if (session.message_count > 20) {
                // Check if summary needs update
                if (!session.context_summary ||
                    (session.summary_message_count && session.message_count - session.summary_message_count >= 10)) {
                    // Update summary every 10 messages
                    await this.updateSessionSummary(sessionId);

                    // Refetch session with new summary
                    const { data: updatedSession } = await supabase
                        .from('chat_sessions')
                        .select('context_summary')
                        .eq('id', sessionId)
                        .single();

                    if (updatedSession?.context_summary) {
                        context.push({
                            role: 'system',
                            content: `Previous conversation summary: ${updatedSession.context_summary}`
                        });
                    }
                } else if (session.context_summary) {
                    context.push({
                        role: 'system',
                        content: `Previous conversation summary: ${session.context_summary}`
                    });
                }
            }

            // 4. Last 8 messages (full context for recent conversation)
            const recentMessages = await this.getRecentMessages(sessionId, 8);
            recentMessages.forEach(msg => {
                context.push({ role: msg.role, content: msg.content });
            });

            return context;

        } catch (error) {
            console.error('Error building smart context:', error);
            // Fallback: just get last 8 messages
            const recentMessages = await this.getRecentMessages(sessionId, 8);
            return recentMessages.map(msg => ({ role: msg.role, content: msg.content }));
        }
    }

    // Helper: Get extreme value messages
    async getExtremeMessages(sessionId: string): Promise<ChatMessage[]> {
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('session_id', sessionId)
                .eq('had_extreme_flags', true)
                .order('created_at', { ascending: false })
                .limit(3); // Keep last 3 extreme warnings

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching extreme messages:', error);
            return [];
        }
    }

    // Helper: Get recent messages
    async getRecentMessages(sessionId: string, limit: number): Promise<ChatMessage[]> {
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return (data || []).reverse(); // Return in chronological order
        } catch (error) {
            console.error('Error fetching recent messages:', error);
            return [];
        }
    }

    // ==================== UPDATE SESSION SUMMARY (CACHED) ====================
    async updateSessionSummary(sessionId: string): Promise<void> {
        try {
            console.log('🔄 Generating session summary...');

            // Get all messages except the last 8 (those will be sent as recent context)
            const { data: messages } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true });

            if (!messages || messages.length <= 8) {
                console.log('Not enough messages for summary');
                return; // Don't summarize short conversations
            }

            // Summarize all but last 8 messages
            const messagesToSummarize = messages.slice(0, -8);
            const summary = await this.generateCompactSummary(messagesToSummarize);

            // Cache the summary
            await supabase
                .from('chat_sessions')
                .update({
                    context_summary: summary,
                    summary_updated_at: new Date().toISOString(),
                    summary_message_count: messages.length
                })
                .eq('id', sessionId);

            console.log('✅ Summary cached:', summary.substring(0, 100) + '...');

        } catch (error) {
            console.error('Error updating session summary:', error);
        }
    }

    // Helper: Generate compact summary using AI
    async generateCompactSummary(messages: ChatMessage[]): Promise<string> {
        try {
            const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

            if (!OPENAI_API_KEY) {
                console.error('OpenAI API key not configured');
                return this.generateBasicSummary(messages); // Fallback to simple summary
            }

            const conversationText = messages
                .map(m => `${m.role}: ${m.content}`)
                .join('\n');

            const prompt = `Summarize this health conversation in 150 words or less. Focus on:
- Main symptoms/concerns discussed
- Key advice given
- Any extreme values flagged
- Current health status

Conversation:
${conversationText}

Concise summary:`;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini', // Cheapest model
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 200, // Keep it short = cheap
                    temperature: 0.5
                })
            });

            if (!response.ok) {
                throw new Error('OpenAI API error');
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();

        } catch (error) {
            console.error('Error generating AI summary:', error);
            return this.generateBasicSummary(messages); // Fallback
        }
    }

    // Fallback: Basic summary without AI (free)
    generateBasicSummary(messages: ChatMessage[]): string {
        const userMessages = messages.filter(m => m.role === 'user');
        const extremeCount = messages.filter(m => m.had_extreme_flags).length;

        const topics = new Set<string>();
        userMessages.forEach(m => {
            const keywords = m.content.toLowerCase().match(/\b(headache|fever|pain|blood pressure|sleep|stress|fatigue|nausea|cough)\b/g);
            if (keywords) keywords.forEach(k => topics.add(k));
        });

        return `Topics discussed: ${Array.from(topics).slice(0, 5).join(', ') || 'general health'}. ${extremeCount > 0 ? `${extremeCount} extreme value(s) flagged.` : ''} ${messages.length} messages exchanged.`;
    }

    // ==================== SEND MESSAGE (UPDATED WITH SMART CONTEXT) ====================
    async sendMessage(
        userId: string,
        sessionId: string | null,
        userMessage: string
    ): Promise<{
        sessionId: string;
        userMessageId: string;
        assistantMessage: ChatMessage;
    }> {
        try {
            // Create new session if none exists
            let currentSessionId = sessionId;
            if (!currentSessionId) {
                currentSessionId = await this.createSession(userId, userMessage);
            }

            // Save user message
            const { data: userMsg, error: userMsgError } = await supabase
                .from('chat_messages')
                .insert({
                    session_id: currentSessionId,
                    user_id: userId,
                    role: 'user',
                    content: userMessage
                })
                .select()
                .single();

            if (userMsgError) throw userMsgError;

            // ✅ GET SMART CONTEXT (not all messages!)
            const smartContext = await this.getSmartContext(currentSessionId, userId);

            console.log(`📊 Context size: ${smartContext.length} items (instead of potentially 50+)`);

            // Call AI with optimized context
            const aiResponse = await chatWithHealthAI(userId, userMessage, smartContext);

            // Save assistant message
            const { data: assistantMsg, error: assistantMsgError } = await supabase
                .from('chat_messages')
                .insert({
                    session_id: currentSessionId,
                    user_id: userId,
                    role: 'assistant',
                    content: aiResponse.message,
                    had_extreme_flags: aiResponse.hasExtremeFlags,
                    extreme_signals: aiResponse.extremeSignals || null
                })
                .select()
                .single();

            if (assistantMsgError) throw assistantMsgError;

            // Update session metadata
            const { data: session } = await supabase
                .from('chat_sessions')
                .select('message_count')
                .eq('id', currentSessionId)
                .single();

            await supabase
                .from('chat_sessions')
                .update({
                    updated_at: new Date().toISOString(),
                    message_count: (session?.message_count || 0) + 2, // +2 for user + assistant
                    last_message_preview: userMessage.substring(0, 100),
                    has_extreme_flags: aiResponse.hasExtremeFlags || false
                })
                .eq('id', currentSessionId);

            return {
                sessionId: currentSessionId,
                userMessageId: userMsg.id,
                assistantMessage: assistantMsg
            };

        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    // ==================== START NEW SESSION ====================
    async startNewSession(userId: string): Promise<string> {
        try {
            // Mark current active session as inactive
            await supabase
                .from('chat_sessions')
                .update({ is_active: false })
                .eq('user_id', userId)
                .eq('is_active', true);

            // Create new session with placeholder
            return await this.createSession(userId, 'New conversation');
        } catch (error) {
            console.error('Error starting new session:', error);
            throw error;
        }
    }

    // ==================== DELETE SESSION ====================
    async deleteSession(sessionId: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('chat_sessions')
                .delete()
                .eq('id', sessionId);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting session:', error);
            throw error;
        }
    }

    // ==================== SWITCH SESSION ====================
    async switchToSession(userId: string, sessionId: string): Promise<void> {
        try {
            // Mark all sessions as inactive
            await supabase
                .from('chat_sessions')
                .update({ is_active: false })
                .eq('user_id', userId);

            // Mark selected session as active
            await supabase
                .from('chat_sessions')
                .update({ is_active: true })
                .eq('id', sessionId);
        } catch (error) {
            console.error('Error switching session:', error);
            throw error;
        }
    }

    // ==================== GENERATE SESSION SUMMARY (for doctors) ====================
    async generateDoctorSummary(sessionId: string): Promise<string> {
        try {
            const messages = await this.getSessionMessages(sessionId);

            const { data: session } = await supabase
                .from('chat_sessions')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (!session) return '';

            const extremeMessages = messages.filter(m => m.had_extreme_flags);

            return `
SESSION SUMMARY
Date: ${new Date(session.created_at).toLocaleDateString()}
Duration: ${messages.length} messages
${session.has_extreme_flags ? '⚠️ EXTREME VALUES DETECTED' : '✓ No extreme values'}

KEY TOPICS:
${messages
                    .filter(m => m.role === 'user')
                    .slice(0, 5)
                    .map((m, i) => `${i + 1}. ${m.content.substring(0, 100)}${m.content.length > 100 ? '...' : ''}`)
                    .join('\n')}

${extremeMessages.length > 0 ? `
EXTREME VALUES:
${extremeMessages.map(m =>
                        `- ${new Date(m.created_at).toLocaleDateString()}: ${JSON.stringify(m.extreme_signals)}`
                    ).join('\n')}
` : ''}

CONTEXT SUMMARY:
${session.context_summary || 'No summary generated yet'}
      `.trim();

        } catch (error) {
            console.error('Error generating doctor summary:', error);
            return '';
        }
    }
}

export const chatSessionService = new ChatSessionService();
