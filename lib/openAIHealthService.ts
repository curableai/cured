import { CURABLE_AI_SYSTEM_PROMPT, getAIPromptMetadata } from '@/lib/ai-prompt';
import { clinicalSignalService as signalCaptureService } from '@/services/clinicalSignalCapture';
import { supabase } from './supabaseClient';

// ==================== CONSTANTS ====================

const EDGE_FUNCTION_NAME = 'smart-ai-controller';

// ==================== TYPES ====================

interface UserHealthProfile {
  // Onboarding data
  fullName: string;
  dateOfBirth: string;
  gender: string;
  weightKg: number;
  heightCm: number;
  location: string;
  bloodGroup: string;
  smoker: boolean;
  alcoholDrinker: boolean;
  chronicConditions: string[];
  longTermMedications: string[];
  familyHistory: string[];

  // Latest metrics
  heartRate?: number;
  restingHeartRate?: number;
  hrv?: number;
  steps?: number;
  doubleSupportTime?: number;
  walkingSpeed?: number;
  walkingStepLength?: number;
  walkingAsymmetry?: number;
  walkingSteadiness?: number;
  headphoneAudioLevel?: number;
  environmentalSoundLevel?: number;

  // Historical data (last 30 days)
  historicalMetrics: any[];
}

interface AIHealthInsight {
  type: 'alert' | 'insight' | 'prediction' | 'recommendation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  reasoning: string;
  recommendations: string[];
  relatedMetrics: string[];
}

interface ContextualQuestion {
  question: string;
  context: string;
  possibleTriggers: string[];
  urgency: 'low' | 'medium' | 'high';
}

// ==================== GET USER HEALTH PROFILE ====================

export async function getUserHealthProfile(userId: string): Promise<UserHealthProfile | null> {
  try {
    // Get onboarding data
    const { data: onboarding } = await supabase
      .from('onboarding')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!onboarding) {
      console.log('No onboarding data found');
      return null;
    }

    // Get latest health metrics
    const { data: latestMetrics } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    // Get historical data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: historicalMetrics } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', userId)
      .gte('recorded_at', thirtyDaysAgo.toISOString())
      .order('recorded_at', { ascending: false });

    // Get latest signals from Clinical Service (Source of Truth)
    const [
      weightSignal,
      heightSignal,
      heartRateSignal,
      stepsSignal
    ] = await Promise.all([
      signalCaptureService.getLatestSignal(userId, 'weight'),
      signalCaptureService.getLatestSignal(userId, 'height'),
      signalCaptureService.getLatestSignal(userId, 'heart_rate'),
      signalCaptureService.getLatestSignal(userId, 'steps_count')
    ]);

    return {
      fullName: onboarding.full_name,
      dateOfBirth: onboarding.date_of_birth,
      gender: onboarding.gender,
      weightKg: (weightSignal?.value as number) || onboarding.weight_kg,
      heightCm: (heightSignal?.value as number) || onboarding.height_cm,
      location: onboarding.location,
      bloodGroup: onboarding.blood_group,
      smoker: onboarding.smoker,
      alcoholDrinker: onboarding.alcohol_drinker,
      chronicConditions: onboarding.chronic_conditions || [],
      longTermMedications: onboarding.long_term_medications || [],
      familyHistory: onboarding.family_history || [],

      heartRate: (heartRateSignal?.value as number) || latestMetrics?.heart_rate,
      restingHeartRate: latestMetrics?.resting_heart_rate,
      hrv: latestMetrics?.hrv,
      steps: (stepsSignal?.value as number) || latestMetrics?.steps,
      doubleSupportTime: latestMetrics?.double_support_time,
      walkingSpeed: latestMetrics?.walking_speed,
      walkingStepLength: latestMetrics?.walking_step_length,
      walkingAsymmetry: latestMetrics?.walking_asymmetry,
      walkingSteadiness: latestMetrics?.walking_steadiness,
      headphoneAudioLevel: latestMetrics?.headphone_audio_level,
      environmentalSoundLevel: latestMetrics?.environmental_sound_level,

      historicalMetrics: historicalMetrics || [],
    };
  } catch (error) {
    console.error('Error getting user health profile:', error);
    return null;
  }
}

// ==================== OPENAI HEALTH ANALYSIS ====================

export async function analyzeHealthWithOpenAI(userId: string): Promise<AIHealthInsight[]> {
  try {
    const { data, error: functionError } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      body: { action: 'analyze', userId }
    });

    if (functionError) {
      console.error('Edge Function error:', functionError);
      return [];
    }

    return data.insights || [];
  } catch (error) {
    console.error('Error analyzing health with OpenAI:', error);
    return [];
  }
}

// ==================== GENERATE CONTEXTUAL QUESTION ====================

export async function generateContextualQuestion(
  userId: string,
  anomaly: { metric: string; value: number; change: number }
): Promise<ContextualQuestion | null> {
  try {
    const { data, error: functionError } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      body: { action: 'generate_question', userId, payload: { anomaly } }
    });

    if (functionError) {
      console.error('Edge Function error:', functionError);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error generating contextual question:', error);
    return null;
  }
}

// ==================== LEARN FROM USER ANSWER ====================

export async function learnFromAnswer(
  userId: string,
  question: string,
  answer: string,
  metric: string
): Promise<{ triggers: string[]; insights: string }> {
  try {
    const { data, error: functionError } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      body: {
        action: 'learn',
        userId,
        payload: { question, answer, metric }
      }
    });

    if (functionError) {
      console.error('Edge Function error:', functionError);
      return { triggers: [], insights: '' };
    }

    // Save triggers to database (client-side for now as per original code pattern, 
    // but the AI extraction happened on backend)
    if (data.triggers && data.triggers.length > 0) {
      await saveTriggers(userId, data.triggers, metric);
    }

    return data;
  } catch (error) {
    console.error('Error learning from answer:', error);
    return { triggers: [], insights: '' };
  }
}

// ==================== GENERATE HEALTH PREDICTIONS ====================

export async function generatePredictions(userId: string): Promise<any[]> {
  try {
    const { data, error: functionError } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      body: { action: 'predictions', userId }
    });

    if (functionError) {
      console.error('Edge Function error:', functionError);
      return [];
    }

    return data.predictions || [];
  } catch (error) {
    console.error('Error generating predictions:', error);
    return [];
  }
}

// ==================== COMPREHENSIVE HEALTH SUMMARY ====================

export async function generateHealthSummary(userId: string): Promise<string> {
  try {
    const { data, error: functionError } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      body: { action: 'summary', userId }
    });

    if (functionError) {
      console.error('Edge Function error:', functionError);
      return 'Unable to generate summary at this time.';
    }

    return data;
  } catch (error) {
    console.error('Error generating summary:', error);
    return 'Unable to generate comprehensive summary at this time.';
  }
}

// ==================== MEDICATION ANALYSIS ====================

export async function analyzeMedicationsWithAI(
  userId: string,
  medications: Array<{ name: string; dosage: string; frequency: string }>
): Promise<{
  effects: string[];
  sideEffects: string[];
  interactions: string[];
  recommendations: string[];
  confidence: number;
} | null> {
  try {
    console.log('Analyzing medications with OpenAI:', medications);
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return null;
    }

    const medList = medications
      .map(m => `${m.name} ${m.dosage} ${m.frequency}`)
      .join(', ');

    const prompt = `Analyze these medications: ${medList}

Return ONLY this JSON format:
{
  "effects": ["effect1", "effect2"],
  "sideEffects": ["side1", "side2"],
  "interactions": ["interaction1"],
  "recommendations": ["rec1"],
  "confidence": 0.85
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a medication analysis assistant. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      return null;
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '{}';
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    console.log('Medication analysis result:', parsed);

    return {
      effects: parsed?.effects || [],
      sideEffects: parsed?.sideEffects || [],
      interactions: parsed?.interactions || [],
      recommendations: parsed?.recommendations || [],
      confidence: parsed?.confidence || 0
    };
  } catch (error) {
    console.error('Error analyzing medications:', error);
    return null;
  }
}

// ==================== DOCTOR REVIEW SUMMARY ====================

export async function generateDoctorReviewSummary(userId: string): Promise<any> {
  try {
    const { data, error: functionError } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      body: { action: 'doctor_summary', userId }
    });

    if (functionError) {
      console.error('Edge Function error:', functionError);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error generating doctor review summary:', error);
    return null;
  }
}

// ==================== CHAT WITH AI ASSISTANT ====================

export async function chatWithHealthAI(
  userId: string,
  message: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
  signal?: AbortSignal
): Promise<{
  message: string;
  reasoning?: string;
  hasExtremeFlags: boolean;
  extremeSignals?: any[];
  groundingMetadata?: any;
  researchSummary?: string;
}> {
  try {

    const profile = await getUserHealthProfile(userId);
    if (!profile) {
      return {
        message: "I don't have access to your health data yet. Please complete your onboarding first.",
        hasExtremeFlags: false
      };
    }

    // ✅ CHECK FOR EXTREME VALUES
    const recentSignals = await signalCaptureService.getSignalHistory(userId, 'all', 30);
    const extremeSignals = recentSignals.filter(s => s.safetyAlertLevel === 'extreme');
    const hasExtremeFlags = extremeSignals.length > 0;

    // ✅ FETCH DETAILED CONTEXT (Medications & Check-ins)
    const [medications, checkinTrends] = await Promise.all([
      getDetailedMedications(userId),
      getCheckinTrends(userId)
    ]);

    console.log('📊 User Data Loaded:', {
      profile: profile.fullName,
      medications: medications.length,
      hasCheckins: !!checkinTrends,
      signals: recentSignals.length
    });

    // ✅ USE THE SAFE PROMPT (from ai-prompt.ts)
    let systemPrompt = CURABLE_AI_SYSTEM_PROMPT;

    // ✅ ADD USER CONTEXT
    systemPrompt += `\n\nUSER CONTEXT:\n`;
    systemPrompt += `Name: ${profile.fullName}\n`;
    systemPrompt += `Age: ${calculateAge(profile.dateOfBirth)} years\n`;
    systemPrompt += `Gender: ${profile.gender}\n`;
    systemPrompt += `Location: ${profile.location}\n`;
    systemPrompt += `Chronic Conditions: ${profile.chronicConditions.join(', ') || 'None'}\n`;

    // Detailed Medications
    systemPrompt += `Medications: ${medications.length > 0 ? medications.map(m => `${m.name} (${m.dosage}, ${m.frequency})`).join(', ') : 'None reported'}\n`;

    systemPrompt += `Family History: ${profile.familyHistory.join(', ') || 'None'}\n\n`;

    // Check-in Trends
    if (checkinTrends) {
      systemPrompt += `DAILY CHECK-IN TRENDS (Last 3 days):\n${checkinTrends}\n\n`;
    }

    systemPrompt += `CURRENT HEALTH METRICS:\n`;
    systemPrompt += `- Heart Rate: ${profile.heartRate || 'N/A'} bpm\n`;
    systemPrompt += `- Resting HR: ${profile.restingHeartRate || 'N/A'} bpm\n`;
    systemPrompt += `- HRV: ${profile.hrv || 'N/A'} ms\n`;
    systemPrompt += `- Steps: ${profile.steps || 'N/A'}\n`;
    systemPrompt += `- Walking Speed: ${profile.walkingSpeed || 'N/A'} km/h\n`;
    systemPrompt += `- Walking Steadiness: ${profile.walkingSteadiness || 'N/A'}%\n`;

    // ✅ ADD EXTREME WARNING IF NEEDED
    if (hasExtremeFlags) {
      systemPrompt += `\n⚠️ CRITICAL: USER HAS EXTREME VALUES:\n`;
      extremeSignals.forEach(s => {
        systemPrompt += `- ${s.signalId}: ${s.value} ${s.unit || ''} (captured ${new Date(s.capturedAt).toLocaleDateString()})\n`;
      });
      systemPrompt += `\nYou MUST address these extreme values first and recommend immediate medical care.\n`;
    }

    // ✅ ADD RECENT SIGNAL HISTORY
    if (recentSignals.length > 0) {
      systemPrompt += `\nRECENT SIGNALS (Last 30 days):\n`;
      recentSignals.slice(0, 10).forEach(s => {
        systemPrompt += `- ${s.signalId}: ${s.value} ${s.unit || ''} (${new Date(s.capturedAt).toLocaleDateString()}, confidence: ${s.confidence})\n`;
      });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message },
    ];

    console.log('🤖 Calling OpenAI with full context...');

    // ✅ CALL OPENAI DIRECTLY (NOT EDGE FUNCTION)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not configured');
      return {
        message: "I'm not properly configured. Please contact support.",
        hasExtremeFlags: false
      };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 800
      }),
      signal: signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiMessage = data.choices[0].message.content;

    console.log('✅ AI Response received');

    // ✅ EXTRACT LOGIC (Visual Reasoning)
    let finalMessage = aiMessage;
    let reasoning: string | undefined = undefined;

    const logicMatch = aiMessage.match(/\[LOGIC: (.*?)\]/);
    if (logicMatch) {
      reasoning = logicMatch[1];
      finalMessage = aiMessage.replace(/\[LOGIC: (.*?)\]\n?/, '').trim();
    }

    // ✅ VALIDATE RESPONSE
    const validation = validateAIResponse(finalMessage);
    if (!validation.isValid) {
      console.error('⚠️ AI USED FORBIDDEN PHRASES:', validation.errors);
      await logValidationFailure(userId, finalMessage, validation.errors);
    }

    // ✅ LOG FOR AUDIT TRAIL
    await logAIInteraction(userId, message, finalMessage, hasExtremeFlags);

    return {
      message: finalMessage,
      reasoning,
      hasExtremeFlags,
      extremeSignals: hasExtremeFlags ? extremeSignals : undefined,
      groundingMetadata: undefined,
      researchSummary: undefined
    };

  } catch (error) {
    console.error('Error chatting with AI:', error);
    return {
      message: "I'm having trouble connecting right now. Please try again in a moment.",
      hasExtremeFlags: false
    };
  }
}

// ==================== NEW HELPER FUNCTIONS ====================

async function getDetailedMedications(userId: string): Promise<any[]> {
  try {
    // Fetch from medications table as requested by user
    const { data, error } = await supabase
      .from('medications')
      .select('medication_name, dosage, frequency')
      .eq('user_id', userId);

    if (error) throw error;

    return data?.map(m => ({
      name: m.medication_name,
      dosage: m.dosage,
      frequency: m.frequency
    })) || [];
  } catch (e) {
    console.error('Error fetching meds:', e);
    return [];
  }
}

async function getCheckinTrends(userId: string): Promise<string> {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Fetch from daily_checkins table as requested by user
    const { data: checkins, error } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', userId)
      .gte('checkin_date', threeDaysAgo.toISOString().split('T')[0])
      .order('checkin_date', { ascending: false });

    if (error) {
      console.error('Error fetching checkins:', error);
      return '';
    }

    if (!checkins || checkins.length === 0) return '';

    // Format for AI context
    const lines: string[] = [];
    checkins.forEach(c => {
      lines.push(`📅 ${c.checkin_date}:`);
      lines.push(`  - Lifestyle Score: ${c.lifestyle_score}/100`);
      lines.push(`  - Mood: ${c.mood}`);
      lines.push(`  - Stress: ${c.stress_level}`);
      lines.push(`  - Sleep: ${c.sleep_quality}`);
      lines.push(`  - Energy: ${c.energy_level}`);
      if (c.insights && Array.isArray(c.insights)) {
        lines.push(`  - Insights: ${c.insights.join(', ')}`);
      }
    });

    return lines.join('\n');
  } catch (e) {
    console.error('Error fetching checkin trends:', e);
    return '';
  }
}


// ==================== HELPER FUNCTIONS ====================

function buildHealthAnalysisPrompt(profile: UserHealthProfile): string {
  return `
ANALYZE THIS USER'S HEALTH:

PERSONAL INFO:
Name: ${profile.fullName}
Age: ${calculateAge(profile.dateOfBirth)} years old
Gender: ${profile.gender}
Height: ${profile.heightCm} cm
Weight: ${profile.weightKg} kg
BMI: ${calculateBMI(profile.heightCm, profile.weightKg)}
Location: ${profile.location}
Blood Group: ${profile.bloodGroup}

HEALTH BACKGROUND:
Chronic Conditions: ${profile.chronicConditions.join(', ') || 'None reported'}
Long-term Medications: ${profile.longTermMedications.join(', ') || 'None reported'}
Family History: ${profile.familyHistory.join(', ') || 'No significant family history'}
Smoker: ${profile.smoker ? 'Yes ⚠️' : 'No ✓'}
Alcohol Drinker: ${profile.alcoholDrinker ? 'Yes' : 'No'}

CURRENT METRICS (Latest Reading):
❤️ Cardiovascular:
- Heart Rate: ${profile.heartRate || 'No data'} bpm
- Resting Heart Rate: ${profile.restingHeartRate || 'No data'} bpm
- HRV: ${profile.hrv || 'No data'} ms

🚶 Mobility & Balance:
- Daily Steps: ${profile.steps || 'No data'}
- Walking Speed: ${profile.walkingSpeed || 'No data'} km/h
- Step Length: ${profile.walkingStepLength || 'No data'} cm
- Walking Asymmetry: ${profile.walkingAsymmetry || 'No data'}%
- Walking Steadiness: ${profile.walkingSteadiness || 'No data'}% (fall risk indicator)
- Double Support Time: ${profile.doubleSupportTime || 'No data'}s

🔊 Audio & Environmental:
- Headphone Audio Level: ${profile.headphoneAudioLevel || 'No data'} dB
- Environmental Sound Level: ${profile.environmentalSoundLevel || 'No data'} dB

HISTORICAL DATA:
${profile.historicalMetrics.length} days of data available
${generateHistoricalSummary(profile.historicalMetrics)}

Provide 3-7 health insights as JSON array. Focus on what matters most for THIS specific person.`;
}

function buildPredictionPrompt(profile: UserHealthProfile, triggers: any[]): string {
  return `
USER: ${profile.fullName}, ${calculateAge(profile.dateOfBirth)} years old
CONDITIONS: ${profile.chronicConditions.join(', ') || 'None'}

LEARNED PATTERNS:
${triggers.map(t => `- When ${t.keyword} → ${t.related_metrics.join(', ')} affected (${(t.confidence * 100).toFixed(0)}% confidence, ${t.times_observed} observations)`).join('\n')}

RECENT ACTIVITY (Last 24h):
Check if any triggers are currently active and predict what might happen next.

Return predictions array as JSON.`;
}

function buildDiagnosisPrompt(profile: UserHealthProfile): string {
  return `
Generate comprehensive health diagnosis for:

${profile.fullName}
${calculateAge(profile.dateOfBirth)} years old, ${profile.gender}
${profile.location}

COMPLETE HEALTH PROFILE:
${JSON.stringify(profile, null, 2)}

Generate a detailed, personalized health report.`;
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function calculateBMI(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function generateHistoricalSummary(metrics: any[]): string {
  if (metrics.length === 0) return 'No historical data';

  // Calculate trends for key metrics
  const recent = metrics.slice(0, 7);
  const older = metrics.slice(7, 30);

  return `
Recent 7 days avg vs previous 23 days:
- Heart Rate: ${avg(recent, 'heart_rate')} vs ${avg(older, 'heart_rate')} bpm
- Steps: ${avg(recent, 'steps')} vs ${avg(older, 'steps')}
- Walking Speed: ${avg(recent, 'walking_speed')} vs ${avg(older, 'walking_speed')} km/h`;
}

function avg(data: any[], field: string): string {
  const values = data.map(d => d[field]).filter(v => v != null);
  if (values.length === 0) return 'N/A';
  const sum = values.reduce((a, b) => a + b, 0);
  return (sum / values.length).toFixed(1);
}

async function saveTriggers(userId: string, triggers: string[], metric: string): Promise<void> {
  try {
    for (const trigger of triggers) {
      const { data: existing } = await supabase
        .from('user_triggers')
        .select('*')
        .eq('user_id', userId)
        .eq('keyword', trigger)
        .contains('related_metrics', [metric])
        .single();

      if (existing) {
        await supabase
          .from('user_triggers')
          .update({
            times_observed: existing.times_observed + 1,
            confidence: Math.min(existing.confidence + 0.1, 0.95),
            last_observed_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('user_triggers')
          .insert({
            user_id: userId,
            keyword: trigger,
            related_metrics: [metric],
            times_observed: 1,
            confidence: 0.4,
            first_observed_at: new Date().toISOString(),
            last_observed_at: new Date().toISOString(),
          });
      }
    }
  } catch (error) {
    console.error('Error saving triggers:', error);
  }
}

// ==================== AI SAFETY HELPERS ====================

function validateAIResponse(message: string): { isValid: boolean; errors: string[] } {
  const forbiddenPhrases = [
    'you are diagnosed',
    'this confirms',
    'this proves',
    'you definitely have',
    'diagnosis:',
    'diagnosed with',
    'i diagnose',
    'this is a diagnosis'
  ];

  const errors: string[] = [];
  const lowerMessage = message.toLowerCase();

  forbiddenPhrases.forEach(phrase => {
    if (lowerMessage.includes(phrase)) {
      errors.push(`Contains forbidden phrase: "${phrase}"`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

async function logAIInteraction(
  userId: string,
  userMessage: string,
  aiResponse: string,
  hadExtremeFlags: boolean
) {
  try {
    await supabase.from('ai_chat_history').insert({
      user_id: userId,
      user_message: userMessage,
      ai_response: aiResponse,
      had_extreme_flags: hadExtremeFlags,
      prompt_version: getAIPromptMetadata().version,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log AI interaction:', error);
  }
}

async function logValidationFailure(
  userId: string,
  aiResponse: string,
  errors: string[]
) {
  try {
    await supabase.from('ai_validation_failures').insert({
      user_id: userId,
      ai_response: aiResponse,
      validation_errors: errors,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log validation failure:', error);
  }
}


