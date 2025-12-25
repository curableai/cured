import { CURABLE_AI_SYSTEM_PROMPT, getAIPromptMetadata } from '@/lib/ai-prompt';
import { clinicalSignalService as signalCaptureService } from '@/services/clinicalSignalCapture';
import { supabase } from './supabaseClient';

// Get API key from environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

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
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return [];
    }

    const profile = await getUserHealthProfile(userId);
    if (!profile) return [];

    const systemPrompt = `You are an expert AI health analyst for Curable, a personalized health monitoring app.

Your job is to analyze the user's complete health data and provide:
1. Health alerts (significant changes that need attention)
2. Insights (patterns and observations)
3. Predictions (what might happen based on current trends)
4. Recommendations (actionable advice)

IMPORTANT RULES:
- Be empathetic and encouraging
- Use the person's name when appropriate
- Reference their specific conditions and medications
- Consider their age, gender, and lifestyle
- Prioritize safety - flag anything concerning
- Give specific, actionable advice
- Be conversational and natural, not robotic

Return a JSON array of insights. Each insight must have:
{
  "type": "alert" | "insight" | "prediction" | "recommendation",
  "severity": "low" | "medium" | "high" | "critical",
  "title": "Short title",
  "message": "Detailed message (2-3 sentences)",
  "reasoning": "Why this matters for THIS specific user",
  "recommendations": ["Action 1", "Action 2"],
  "relatedMetrics": ["metric1", "metric2"]
}`;

    const userPrompt = buildHealthAnalysisPrompt(profile);

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);

    return parsed.insights || [];
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
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return null;
    }

    const profile = await getUserHealthProfile(userId);
    if (!profile) return null;

    const systemPrompt = `You are Curable's AI health assistant. A health metric changed significantly.

Generate a personalized, empathetic question to understand what caused this change.

RULES:
- Use the person's name
- Reference their chronic conditions or medications if relevant
- Be conversational and caring
- Suggest 3-5 possible triggers based on their profile
- Indicate urgency level

Return JSON:
{
  "question": "The main question to ask (warm, personal)",
  "context": "Why you're asking (1 sentence)",
  "possibleTriggers": ["trigger1", "trigger2", "trigger3"],
  "urgency": "low" | "medium" | "high"
}`;

    const userPrompt = `
USER PROFILE:
Name: ${profile.fullName}
Age: ${calculateAge(profile.dateOfBirth)} years
Gender: ${profile.gender}
Chronic Conditions: ${profile.chronicConditions.join(', ') || 'None'}
Medications: ${profile.longTermMedications.join(', ') || 'None'}
Smoker: ${profile.smoker ? 'Yes' : 'No'}
Alcohol: ${profile.alcoholDrinker ? 'Yes' : 'No'}

ANOMALY DETECTED:
Metric: ${anomaly.metric}
Current Value: ${anomaly.value}
Change: ${anomaly.change > 0 ? '+' : ''}${anomaly.change}%

Generate a contextual question for this user.`;

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error('OpenAI API error');
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    return parsed;
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
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return { triggers: [], insights: '' };
    }

    const profile = await getUserHealthProfile(userId);
    if (!profile) return { triggers: [], insights: '' };

    const systemPrompt = `You are Curable's AI learning engine. 

A user answered a question about a health change. Extract:
1. Specific triggers (activities, foods, behaviors that caused the change)
2. Insights for future predictions

Return JSON:
{
  "triggers": ["trigger1", "trigger2"],
  "insights": "What we learned and how to use it (1 paragraph)"
}`;

    const userPrompt = `
USER: ${profile.fullName}
METRIC AFFECTED: ${metric}
QUESTION ASKED: ${question}
USER'S ANSWER: ${answer}

Extract triggers and insights.`;

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.6,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error('OpenAI API error');
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    // Save triggers to database
    if (parsed.triggers && parsed.triggers.length > 0) {
      await saveTriggers(userId, parsed.triggers, metric);
    }

    return parsed;
  } catch (error) {
    console.error('Error learning from answer:', error);
    return { triggers: [], insights: '' };
  }
}

// ==================== GENERATE HEALTH PREDICTIONS ====================

export async function generatePredictions(userId: string): Promise<any[]> {
  try {
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return [];
    }

    const profile = await getUserHealthProfile(userId);
    if (!profile) return [];

    // Get learned triggers
    const { data: triggers } = await supabase
      .from('user_triggers')
      .select('*')
      .eq('user_id', userId)
      .gte('confidence', 0.6)
      .order('confidence', { ascending: false });

    if (!triggers || triggers.length === 0) return [];

    const systemPrompt = `You are Curable's predictive health AI.

Based on the user's learned patterns and current health data, predict what might happen next.

Return JSON array:
[{
  "metric": "metric_name",
  "prediction": "what will likely happen",
  "confidence": 0.75,
  "timeframe": "2-4 hours",
  "reasoning": "why this will happen",
  "prevention": ["how to prevent if negative", "or how to maintain if positive"]
}]`;

    const userPrompt = buildPredictionPrompt(profile, triggers);

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error('OpenAI API error');
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    return parsed.predictions || [];
  } catch (error) {
    console.error('Error generating predictions:', error);
    return [];
  }
}

// ==================== COMPREHENSIVE HEALTH SUMMARY ====================

export async function generateHealthSummary(userId: string): Promise<string> {
  try {
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return 'Unable to generate summary - OpenAI API key is not configured.';
    }

    const profile = await getUserHealthProfile(userId);
    if (!profile) return 'Unable to generate summary - no health data available.';

    const systemPrompt = `You are Curable's health advisory AI generating a comprehensive report.

Generate a personalized health ADVISORY (NOT diagnosis) that includes:
1. Executive Summary (2-3 sentences)
2. Current Health Status (all metrics with interpretation)
3. Observations & Patterns (what's notable, good or concerning)
4. Risk Factors (personalized based on conditions, family history)
5. Trends & Changes (what's improving/declining)
6. Personalized Recommendations (specific to THIS user)
7. Suggested Next Steps (prioritized actions)

CRITICAL RULES:
- This is ADVISORY, not diagnosis
- Never use: "you have", "diagnosis", "this confirms"
- Use: "may indicate", "could suggest", "patterns consistent with"
- Always give 2-4 possibilities, never just one
- Be honest about concerns but not alarmist
- Focus on actionable insights

TONE:
- Professional but warm and encouraging
- Use the person's name
- Celebrate improvements
- Be specific with numbers from their data

FORMAT:
- Clear headers with emojis
- Bullet points for readability
- Reference conditions/medications when relevant

INCLUDE DISCLAIMER:
"⚠️ IMPORTANT: This is health advisory, not medical diagnosis. Always consult a healthcare professional for medical decisions."`;

    const userPrompt = buildDiagnosisPrompt(profile);

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error('OpenAI API error');
    }

    const data = await response.json();
    return data.choices[0].message.content;
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
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return null;
    }

    if (medications.length === 0) {
      return null;
    }

    const profile = await getUserHealthProfile(userId);
    if (!profile) return null;

    const systemPrompt = `You are Curable's AI medication analyst, integrated with the diagnosis and prediction systems.

Analyze the user's medications considering their complete health profile, existing conditions, and other medications.

CRITICAL RULES:
- Consider drug interactions with existing medications
- Factor in chronic conditions and contraindications
- Reference age, gender, and health metrics
- Integrate with diagnosis and prediction insights
- Be specific about percentages and likelihoods
- Prioritize safety warnings
- Give actionable, personalized recommendations

Return JSON:
{
  "effects": ["expected effect 1", "expected effect 2", ...],
  "sideEffects": ["side effect with likelihood %", ...],
  "interactions": ["interaction or safety note", ...],
  "recommendations": ["specific actionable advice", ...],
  "confidence": 85
}`;

    const medicationList = medications.map(m => `${m.name} ${m.dosage} - ${m.frequency}`).join('\n');

    const userPrompt = `
PATIENT PROFILE:
Name: ${profile.fullName}
Age: ${calculateAge(profile.dateOfBirth)} years
Gender: ${profile.gender}
Weight: ${profile.weightKg} kg
Height: ${profile.heightCm} cm
BMI: ${calculateBMI(profile.heightCm, profile.weightKg).toFixed(1)}

EXISTING CONDITIONS:
${profile.chronicConditions.length > 0 ? profile.chronicConditions.join(', ') : 'None reported'}

CURRENT MEDICATIONS:
${profile.longTermMedications.length > 0 ? profile.longTermMedications.join(', ') : 'None reported'}

LIFESTYLE:
- Smoker: ${profile.smoker ? 'Yes ⚠️' : 'No'}
- Alcohol: ${profile.alcoholDrinker ? 'Yes' : 'No'}

CURRENT HEALTH METRICS:
- Heart Rate: ${profile.heartRate || 'N/A'} bpm
- Resting HR: ${profile.restingHeartRate || 'N/A'} bpm
- Blood Pressure: Monitor for medication effects
- Activity Level: ${profile.steps || 'N/A'} steps/day

NEW MEDICATIONS TO ANALYZE:
${medicationList}

Provide comprehensive analysis considering this specific patient's profile. Include percentage likelihoods for side effects.`;

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error('OpenAI API error');
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    return {
      effects: parsed.effects || [],
      sideEffects: parsed.sideEffects || [],
      interactions: parsed.interactions || [],
      recommendations: parsed.recommendations || [],
      confidence: parsed.confidence || 85,
    };
  } catch (error) {
    console.error('Error analyzing medications:', error);
    return null;
  }
}

// ==================== DOCTOR REVIEW SUMMARY ====================

export async function generateDoctorReviewSummary(userId: string): Promise<any> {
  try {
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return null;
    }

    const profile = await getUserHealthProfile(userId);
    if (!profile) return null;

    // Get AI insights and predictions
    const insights = await analyzeHealthWithOpenAI(userId);
    const summary = await generateHealthSummary(userId);

    // Get medications if available
    const { data: medications } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', userId);

    const systemPrompt = `You are a medical AI assistant preparing a professional summary for a doctor to review.

Generate a comprehensive, structured medical summary suitable for physician review.

CRITICAL RULES:
- Use professional medical terminology
- Organize information clearly and concisely
- Highlight concerning trends and urgent findings
- Include specific metrics and dates
- Format for easy scanning by busy physicians
- Be objective and evidence-based

Return JSON:
{
  "executiveSummary": "2-3 sentence overview of patient's current health status",
  "keyFindings": ["Finding 1", "Finding 2", ...],
  "concerningTrends": ["Trend 1 with specific metrics", ...],
  "recommendations": ["Recommendation 1", "Recommendation 2", ...],
  "urgencyLevel": "routine" | "moderate" | "urgent"
}`;

    const userPrompt = `
PATIENT SUMMARY FOR PHYSICIAN REVIEW

DEMOGRAPHICS:
Name: ${profile.fullName}
Age: ${calculateAge(profile.dateOfBirth)} years
Gender: ${profile.gender}
Blood Type: ${profile.bloodGroup}

MEDICAL HISTORY:
Chronic Conditions: ${profile.chronicConditions.length > 0 ? profile.chronicConditions.join(', ') : 'None'}
Long-term Medications: ${profile.longTermMedications.length > 0 ? profile.longTermMedications.join(', ') : 'None'}
Family History: ${profile.familyHistory.length > 0 ? profile.familyHistory.join(', ') : 'None'}
Smoker: ${profile.smoker ? 'Yes' : 'No'}
Alcohol Use: ${profile.alcoholDrinker ? 'Yes' : 'No'}

CURRENT MEDICATIONS:
${medications && medications.length > 0
        ? medications.map((m: any) => `- ${m.medication_name} ${m.dosage} (${m.frequency})`).join('\n')
        : 'No current medications recorded'}

VITAL SIGNS & METRICS (Current):
- Heart Rate: ${profile.heartRate || 'N/A'} bpm
- Resting Heart Rate: ${profile.restingHeartRate || 'N/A'} bpm
- HRV: ${profile.hrv || 'N/A'} ms
- Daily Steps: ${profile.steps || 'N/A'}
- Walking Speed: ${profile.walkingSpeed || 'N/A'} km/h
- Walking Steadiness: ${profile.walkingSteadiness || 'N/A'}%
- Walking Asymmetry: ${profile.walkingAsymmetry || 'N/A'}%

HISTORICAL DATA:
${profile.historicalMetrics.length} days of continuous monitoring data available
${generateHistoricalSummary(profile.historicalMetrics)}

AI HEALTH INSIGHTS:
${insights.length > 0 ? insights.map((i: any) =>
          `- [${i.severity.toUpperCase()}] ${i.title}: ${i.message}`
        ).join('\n') : 'No significant AI insights at this time'}

AI COMPREHENSIVE SUMMARY:
${summary}

Generate a professional medical summary for physician review.`;

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error('OpenAI API error');
    }

    const data = await response.json();
    const aiSummary = JSON.parse(data.choices[0].message.content);

    // Return complete summary with all data
    return {
      patient: {
        name: profile.fullName,
        age: calculateAge(profile.dateOfBirth),
        gender: profile.gender,
        bloodGroup: profile.bloodGroup,
        dateOfBirth: profile.dateOfBirth,
      },
      medicalHistory: {
        chronicConditions: profile.chronicConditions,
        longTermMedications: profile.longTermMedications,
        familyHistory: profile.familyHistory,
        smoker: profile.smoker,
        alcoholDrinker: profile.alcoholDrinker,
      },
      currentMedications: medications || [],
      vitalSigns: {
        heartRate: profile.heartRate,
        restingHeartRate: profile.restingHeartRate,
        hrv: profile.hrv,
        steps: profile.steps,
        walkingSpeed: profile.walkingSpeed,
        walkingSteadiness: profile.walkingSteadiness,
        walkingAsymmetry: profile.walkingAsymmetry,
      },
      metricsHistory: profile.historicalMetrics,
      aiInsights: insights,
      aiHealthSummary: summary,
      aiSummary: aiSummary,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error generating doctor review summary:', error);
    return null;
  }
}

// ==================== CHAT WITH AI ASSISTANT ====================

export async function chatWithHealthAI(
  userId: string,
  message: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<{
  message: string;
  hasExtremeFlags: boolean;
  extremeSignals?: any[];
}> {
  try {
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return {
        message: "I'm unable to connect right now. Please check your API key configuration.",
        hasExtremeFlags: false
      };
    }

    const profile = await getUserHealthProfile(userId);
    if (!profile) {
      return {
        message: "I don't have access to your health data yet.",
        hasExtremeFlags: false
      };
    }

    // ✅ CHECK FOR EXTREME VALUES
    const recentSignals = await signalCaptureService.getSignalHistory(userId, 'all', 30);
    const extremeSignals = recentSignals.filter(s => s.safetyAlertLevel === 'extreme');
    const hasExtremeFlags = extremeSignals.length > 0;

    // ✅ USE THE SAFE PROMPT (from ai-prompt.ts)
    let systemPrompt = CURABLE_AI_SYSTEM_PROMPT;

    // ✅ ADD USER CONTEXT
    systemPrompt += `\n\nUSER CONTEXT:\n`;
    systemPrompt += `Name: ${profile.fullName}\n`;
    systemPrompt += `Age: ${calculateAge(profile.dateOfBirth)} years\n`;
    systemPrompt += `Gender: ${profile.gender}\n`;
    systemPrompt += `Location: ${profile.location}\n`;
    systemPrompt += `Chronic Conditions: ${profile.chronicConditions.join(', ') || 'None'}\n`;
    systemPrompt += `Medications: ${profile.longTermMedications.join(', ') || 'None'}\n`;
    systemPrompt += `Family History: ${profile.familyHistory.join(', ') || 'None'}\n\n`;

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

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error('OpenAI API error');
    }

    const data = await response.json();
    const aiMessage = data.choices[0].message.content;

    // ✅ VALIDATE RESPONSE
    const validation = validateAIResponse(aiMessage);
    if (!validation.isValid) {
      console.error('⚠️ AI USED FORBIDDEN PHRASES:', validation.errors);
      await logValidationFailure(userId, aiMessage, validation.errors);
    }

    // ✅ LOG FOR AUDIT TRAIL
    await logAIInteraction(userId, message, aiMessage, hasExtremeFlags);

    return {
      message: aiMessage,
      hasExtremeFlags,
      extremeSignals: hasExtremeFlags ? extremeSignals : undefined
    };

  } catch (error) {
    console.error('Error chatting with AI:', error);
    return {
      message: "I'm having trouble connecting right now. Please try again in a moment.",
      hasExtremeFlags: false
    };
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

// ==================== INTERPRET CLINICAL DOCUMENT ====================

export async function interpretClinicalDocument(
  userId: string,
  base64Image: string,
  fileName: string
): Promise<{
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  urgency: 'low' | 'medium' | 'high';
} | null> {
  try {
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return null;
    }

    const profile = await getUserHealthProfile(userId);
    if (!profile) return null;

    const systemPrompt = `You are Curable's medical document specialist AI. Your task is to analyze clinical documents (lab results, prescriptions, imaging reports) and interpret them for the user.

RULES:
- Be precise but use accessible language
- Identify abnormal values
- Contextualize findings based on the user's health profile
- NEVER diagnose; use advisory language
- Flag items that require immediate clinical attention

Return JSON:
{
  "summary": "1-2 sentence overview of the document",
  "keyFindings": ["Finding 1 (abnormal values highlighted)", "Finding 2"],
  "recommendations": ["Actionable step 1", "Actionable step 2"],
  "urgency": "low" | "medium" | "high"
}`;

    const userPrompt = [
      {
        type: "text",
        text: `Patient: ${profile.fullName}\nAge: ${calculateAge(profile.dateOfBirth)}\nConditions: ${profile.chronicConditions.join(', ')}\n\nPlease interpret this medical document: ${fileName}`
      },
      {
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${base64Image}`
        }
      }
    ];

    console.log(`Analyzing document: ${fileName} for user: ${userId}`);
    console.log(`Base64 string length: ${base64Image.length}`);

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt as any }, // casting because of mixed content type
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1, // Low temperature for higher accuracy in factual reading
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI Document Error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI interpreted document successfully');
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('Error interpreting document:', error);
    return null;
  }
}

