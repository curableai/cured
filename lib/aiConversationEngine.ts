// lib/aiConversationEngine.ts
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import OpenAI from 'openai';
import { supabase } from './supabaseClient';

// Safe OpenAI initialization
const getOpenAIClient = () => {
  const apiKey = Constants.expoConfig?.extra?.openAIApiKey;
  
  if (!apiKey) {
    console.error('OpenAI API key is missing');
    return null;
  }

  try {
    return new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true,
    });
  } catch (error) {
    console.error('Failed to initialize OpenAI:', error);
    return null;
  }
};

const openai = getOpenAIClient();

// Update your generateProactiveQuestion function to handle missing OpenAI client
export async function generateProactiveQuestion(
  anomaly: any,
  userContext: any
): Promise<string> {
  try {
    // If OpenAI client is not available, use fallback immediately
    if (!openai) {
      console.warn('OpenAI client not available, using fallback question');
      return generateFallbackQuestion(anomaly, userContext);
    }

    const timeContext = getTimeContext(userContext.current_hour);
    const triggerContext = getRelevantTriggers(anomaly.metric_name, userContext.known_triggers || []);
    
    const prompt = buildQuestionPrompt(anomaly, userContext, timeContext, triggerContext);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are Curable AI, a friendly and caring health companion for ${userContext.full_name}. 
Your job is to check in on health changes with warmth, curiosity, and zero medical jargon. 
Be conversational, brief (2-3 sentences max), and always end with an open question.
Use their name naturally, add relevant emoji sparingly, and speak like a supportive friend.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content?.trim() || generateFallbackQuestion(anomaly, userContext);
  } catch (error) {
    console.error('Error generating AI question:', error);
    return generateFallbackQuestion(anomaly, userContext);
  }
}

// Type definitions

type UserContext = {
  full_name?: string;
  recent_answers?: { question: string; user_answer: string }[];
  known_triggers?: any[];
  current_hour: number;
};

type Anomaly = {
  id: string;
  metric_name: string;
  change_direction: string;
  baseline_value: number;
  current_value: number;
  change_percent: number;
  severity: string;
  [key: string]: any;
};

// Rest of your existing functions...

/**
 * Build the prompt for AI question generation
 */
function buildQuestionPrompt(
  anomaly: Anomaly,
  userContext: UserContext,
  timeContext: string,
  triggerContext: string
): string {
  const metricDisplay = formatMetricName(anomaly.metric_name);
  const changeDescription = `${anomaly.change_direction} from ${anomaly.baseline_value} to ${anomaly.current_value} (${anomaly.change_percent}% change)`;

  let prompt = `User: ${userContext.full_name}\n`;
  prompt += `Time: ${timeContext}\n`;
  prompt += `Metric: ${metricDisplay} - ${changeDescription}\n`;
  prompt += `Severity: ${anomaly.severity}\n\n`;

  if (triggerContext) {
    prompt += `Known patterns:\n${triggerContext}\n\n`;
  }

  if (userContext.recent_answers && userContext.recent_answers.length > 0) {
    prompt += `Recent conversation:\n`;
    userContext.recent_answers.slice(0, 3).forEach(qa => {
      prompt += `Q: ${qa.question}\nA: ${qa.user_answer}\n`;
    });
    prompt += `\n`;
  }

  prompt += `Generate a caring, personalized check-in question about this ${metricDisplay} change. `;
  prompt += `${anomaly.severity === 'urgent' || anomaly.severity === 'critical' ? 'Express gentle concern.' : 'Keep it light and curious.'} `;
  prompt += `If there are known triggers, ask specifically about them. Otherwise, ask an open exploration question.`;

  return prompt;
}

/**
 * Format metric name for display
 */
function formatMetricName(metric: string): string {
  const displayNames: Record<string, string> = {
    heart_rate: 'heart rate',
    resting_heart_rate: 'resting heart rate',
    blood_pressure_systolic: 'blood pressure',
    blood_pressure_diastolic: 'blood pressure',
    sleep_hours: 'sleep',
    sleep_quality: 'sleep quality',
    steps: 'activity level',
    body_temperature: 'body temperature',
    blood_oxygen: 'oxygen levels',
    mood_score: 'mood',
    stress_level: 'stress',
    energy_level: 'energy',
  };

  return displayNames[metric] || metric.replace('_', ' ');
}

/**
 * Get time-appropriate context
 */
function getTimeContext(hour: number): string {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Get relevant triggers for metric
 */
function getRelevantTriggers(metric: string, triggers: any[]): string {
  const relevant = triggers.filter(t => t.related_metric === metric && t.confidence > 0.5);
  
  if (relevant.length === 0) return '';

  const triggerList = relevant
    .map(t => `- "${t.keyword}" usually ${t.impact_direction}s your ${formatMetricName(metric)} (${(t.confidence * 100).toFixed(0)}% confident)`)
    .join('\n');

  return triggerList;
}

/**
 * Fallback question if AI generation fails
 */
function generateFallbackQuestion(anomaly: Anomaly, userContext: UserContext): string {
  const metric = formatMetricName(anomaly.metric_name);
  const name = userContext.full_name || 'there';
  
  const templates = [
    `Hey ${name} 👋, I noticed your ${metric} ${anomaly.change_direction} by ${anomaly.change_percent}%. How are you feeling today?`,
    `Hi ${name}, your ${metric} has changed quite a bit recently. Did anything different happen?`,
    `${name}, I'm seeing some changes in your ${metric}. Want to chat about what might be going on?`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Save question to database
 */
export async function saveProactiveQuestion(
  userId: string,
  anomalyId: string,
  question: string,
  anomalyData: any
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('contextual_questions')
      .insert({
        user_id: userId,
        anomaly_id: anomalyId,
        question,
        question_type: 'proactive',
        related_metric: anomalyData.metric_name,
        context_data: {
          anomaly: anomalyData,
          asked_via: 'ai_engine',
        },
        asked_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;

    // Update anomaly to mark question sent
    await supabase
      .from('health_anomalies')
      .update({
        ai_question_sent: true,
        ai_question_id: data.id,
      })
      .eq('id', anomalyId);

    console.log(`Saved proactive question ${data.id} for anomaly ${anomalyId}`);
    return data.id;
  } catch (error) {
    console.error('Error saving proactive question:', error);
    return null;
  }
}

/**
 * Send notification to user
 */
export async function sendProactiveNotification(
  userId: string,
  question: string,
  questionId: string,
  anomalyData: any
): Promise<boolean> {
  try {
    // Get user's push token
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('push_token, full_name')
      .eq('id', userId)
      .single();

    if (userError || !userData?.push_token) {
      console.log('No push token for user:', userId);
      return false;
    }

    // Send push notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💚 Health Check-in',
        body: question.slice(0, 120) + (question.length > 120 ? '...' : ''),
        data: {
          type: 'proactive_question',
          questionId,
          anomalyId: anomalyData.id,
          metric: anomalyData.metric_name,
          severity: anomalyData.severity,
          screen: 'AIAssistant',
        },
        sound: 'default',
        badge: 1,
      },
      trigger: null,
    });

    // Save notification history
    await supabase.from('notification_history').insert({
      user_id: userId,
      title: '💚 Health Check-in',
      body: question,
      notification_type: 'question',
      question_id: questionId,
      anomaly_id: anomalyData.id,
      delivery_method: 'push',
      delivered_at: new Date().toISOString(),
    });

    console.log(`Sent notification for question ${questionId}`);
    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

/**
 * Get user context for question generation
 */
export async function getUserContext(userId: string): Promise<UserContext> {
  try {
    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .single();

    // Get recent Q&A history
    const { data: recentAnswers } = await supabase
      .from('contextual_questions')
      .select('question, user_answer')
      .eq('user_id', userId)
      .not('user_answer', 'is', null)
      .order('answered_at', { ascending: false })
      .limit(5);

    // Get known triggers
    const { data: triggers } = await supabase
      .from('user_triggers')
      .select('*')
      .eq('user_id', userId)
      .gte('confidence', 0.3)
      .order('confidence', { ascending: false });

    return {
      full_name: user?.full_name || 'there',
      recent_answers: recentAnswers || [],
      known_triggers: triggers || [],
      current_hour: new Date().getHours(),
    };
  } catch (error) {
    console.error('Error getting user context:', error);
    return {
      full_name: 'there',
      current_hour: new Date().getHours(),
    };
  }
}

/**
 * Process anomaly and send proactive question
 */
export async function processAnomalyAndSendQuestion(
  userId: string,
  anomaly: Anomaly
): Promise<boolean> {
  try {
    console.log(`Processing anomaly ${anomaly.id} for user ${userId}`);

    // Get user context
    const userContext = await getUserContext(userId);

    // Generate AI question
    const question = await generateProactiveQuestion(anomaly, userContext);

    // Save question
    const questionId = await saveProactiveQuestion(userId, anomaly.id, question, anomaly);

    if (!questionId) {
      throw new Error('Failed to save question');
    }

    // Send notification
    const sent = await sendProactiveNotification(userId, question, questionId, anomaly);

    if (!sent) {
      console.warn('Failed to send notification, but question saved');
    }

    return true;
  } catch (error) {
    console.error('Error processing anomaly:', error);
    return false;
  }
}

/**
 * Process all active anomalies for a user
 */
export async function processUserAnomalies(userId: string): Promise<number> {
  try {
    // Get anomalies that haven't had questions sent yet
    const { data: anomalies, error } = await supabase
      .from('health_anomalies')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('ai_question_sent', false)
      .order('severity', { ascending: false })
      .limit(3); // Process max 3 at a time to avoid overwhelming user

    if (error) throw error;
    if (!anomalies || anomalies.length === 0) {
      console.log('No pending anomalies for user:', userId);
      return 0;
    }

    let processed = 0;
    for (const anomaly of anomalies) {
      const success = await processAnomalyAndSendQuestion(userId, anomaly);
      if (success) processed++;
      
      // Small delay between questions
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Processed ${processed}/${anomalies.length} anomalies for user ${userId}`);
    return processed;
  } catch (error) {
    console.error('Error processing user anomalies:', error);
    return 0;
  }
}