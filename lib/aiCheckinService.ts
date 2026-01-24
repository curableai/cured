/**
 * lib/aiCheckinService.ts
 * 
 * Orchestrates the "AI Oracle" check-in experience.
 * Instead of fixed questions, it analyzes the user's health state and 
 * generates the most relevant follow-up stack for today.
 */

import { supabase } from './supabaseClient';

export interface DynamicQuestion {
    id: string; // Signal ID
    pillar: string;
    question: string;
    helpText?: string;
    options: { label: string; value: any }[];
}

class AICheckinService {
    /**
     * Generates a tailored stack of questions for today's check-in.
     * Context: onboarding, medications, recent signals, previous checkins
     */
    async generateDailyStack(userId: string): Promise<DynamicQuestion[]> {
        try {
            const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY;

            if (!OPENAI_API_KEY) {
                console.warn('OpenAI API key not configured');
                return this.getFallbackStack();
            }

            // Fetch user context
            const context = await this.buildUserContext(userId);

            const prompt = `Generate 4-6 UNIQUE personalized daily health check-in questions based on this user's context:

USER PROFILE:
- Age: ${context.age || 'Unknown'}
- Gender: ${context.gender || 'Unknown'}
- Chronic Conditions: ${context.chronicConditions?.join(', ') || 'None'}${context.otherChronicConditions ? ` (Other: ${context.otherChronicConditions})` : ''}
- Behavioral Factors: ${context.smoker ? 'Smoker' : 'Non-smoker'}, ${context.alcoholDrinker ? 'Alcohol' : 'No alcohol'}${context.otherBehavioralFactors ? `, Other: ${context.otherBehavioralFactors}` : ''}
- Current Medications: ${context.medications?.join(', ') || 'None'}
- Genotype: ${context.genotype || 'Unknown'}

RECENT HEALTH SIGNALS (Last 7 days):
${context.recentSignals || 'None recorded'}

PREVIOUS CHECK-IN PATTERNS (Last 3 check-ins):
${context.previousCheckins || 'No history'}

IMPORTANT RULES:
1. Questions should be DIFFERENT from previous check-ins shown above
2. Focus on areas relevant to their conditions and medications
3. Include follow-ups based on recent signal trends
4. Make questions conversational and non-medical
5. Vary the pillars: wellness, energy, sleep, pain, mood, medication adherence, lifestyle

Return ONLY this JSON format. ensure "options" array is ALWAYS included and has at least 2 items:
{
  "questions": [
    {
      "id": "signal_id_or_unique_id",
      "pillar": "category",
      "question": "Natural question text?",
      "helpText": "optional guidance",
      "options": [
        {"label": "Label to show user", "value": "value_to_store"},
        {"label": "Another option", "value": "another_value"}
      ]
    }
  ]
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
                        { role: 'system', content: 'You are a clinical health assistant generating personalized, adaptive check-in questions. Generate UNIQUE questions that adapt to patient context. Return only valid JSON.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.8, // Higher temp for more variation
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) {
                console.warn('OpenAI API failed');
                return this.getFallbackStack();
            }

            const data = await response.json();
            const text = data?.choices?.[0]?.message?.content || '{"questions":[]}';
            if (!text || text === '{"questions":[]}') {
                console.warn('OpenAI returned no questions');
                return this.getFallbackStack();
            }
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);

            return parsed?.questions || this.getFallbackStack();
        } catch (error) {
            console.error('Error in generateDailyStack:', error);
            return this.getFallbackStack();
        }
    }

    /**
     * Build contextual user data for AI prompt
     */
    private async buildUserContext(userId: string): Promise<any> {
        try {
            const context: any = {};

            // 1. Fetch onboarding data
            const { data: onboarding } = await supabase
                .from('onboarding')
                .select('*')
                .eq('user_id', userId)
                .single();

            context.age = onboarding?.age;
            context.gender = onboarding?.gender;
            context.chronicConditions = onboarding?.chronic_conditions || [];
            context.otherChronicConditions = onboarding?.other_chronic_conditions;
            context.smoker = onboarding?.smoker;
            context.alcoholDrinker = onboarding?.alcohol_drinker;
            context.otherBehavioralFactors = onboarding?.other_behavioral_factors;
            context.genotype = onboarding?.genotype;

            // 2. Fetch medications
            const { data: medications } = await supabase
                .from('medications')
                .select('medication_name, dosage, frequency')
                .eq('user_id', userId);

            context.medications = medications?.map(m => `${m.medication_name} ${m.dosage} ${m.frequency}`) || [];

            // 3. Fetch recent signals (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const { data: signals } = await supabase
                .from('signal_instances')
                .select('signal_id, value, unit, captured_at')
                .eq('user_id', userId)
                .gte('captured_at', sevenDaysAgo.toISOString())
                .order('captured_at', { ascending: false })
                .limit(20);

            if (signals && signals.length > 0) {
                context.recentSignals = signals
                    .map(s => `${s.signal_id}: ${s.value} ${s.unit} (${new Date(s.captured_at).toLocaleDateString()})`)
                    .join('\n');
            }

            // 4. Fetch previous check-in questions (last 3)
            const { data: previousCheckins } = await supabase
                .from('daily_checkins')
                .select('questions, answers, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(3);

            if (previousCheckins && previousCheckins.length > 0) {
                context.previousCheckins = previousCheckins
                    .map(c => `[${new Date(c.created_at).toLocaleDateString()}] Asked: ${c.questions?.slice(0, 2)?.join(', ')}`)
                    .join('\n');
            }

            return context;
        } catch (error) {
            console.error('Error building user context:', error);
            return {};
        }
    }

    /**
     * Scores a completed check-in using OpenAI.
     */
    async scoreCheckin(userId: string, answers: any): Promise<{ score: number, feedback: string, insights: string[] }> {
        try {
            const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY;

            if (!OPENAI_API_KEY) {
                console.warn('[AICheckinService] No API key found, using local fallback.');
                return this.scoreCheckinLocally(answers);
            }

            const prompt = `As a clinical health assistant, analyze these daily check-in responses: ${JSON.stringify(answers)}

Provide:
1. A lifestyle score (0-100) based on positive/negative health behaviors.
2. "feedback": A warm, encouraging paragraph (2-3 sentences) giving specific advice based on their lowest scoring answers. If they reported low energy, poor sleep, or high stress, address that directly with a tip.
3. "insights": 2-3 short, bullet-point observations about their patterns today.

Return ONLY this JSON:
{
  "score": 85,
  "feedback": "Specific advice based on their answers...",
  "insights": ["Observation 1", "Observation 2"]
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
                        { role: 'system', content: 'You are a health scoring assistant. Return only valid JSON.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.5,
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) {
                return { score: 0, feedback: "Analysis engine offline. Please try again.", insights: [] };
            }

            const data = await response.json();
            const text = data?.choices?.[0]?.message?.content || '{"score":0,"feedback":"","insights":[]}';
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);

            return {
                score: parsed?.score || 0,
                feedback: parsed?.feedback || '',
                insights: parsed?.insights || []
            };
        } catch (error) {
            console.error('[AICheckinService] Error scoring check-in:', error);
            return { score: 0, feedback: "Analysis engine offline. Please try again.", insights: [] };
        }
    }

    /**
     * Fallback to a smart-ish set of core metrics if AI fails.
     */
    private getFallbackStack(): DynamicQuestion[] {
        return [
            {
                id: 'general_wellbeing',
                pillar: 'lifestyle',
                question: 'Overall, how are you feeling today?',
                options: [
                    { label: 'Very good', value: 'very_good' },
                    { label: 'Okay', value: 'okay' },
                    { label: 'Not well', value: 'not_well' }
                ]
            },
            {
                id: 'energy_level',
                pillar: 'lifestyle',
                question: 'How is your energy level?',
                options: [
                    { label: 'High', value: 'high' },
                    { label: 'Normal', value: 'normal' },
                    { label: 'Low', value: 'low' }
                ]
            },
            {
                id: 'sleep_quality',
                pillar: 'sleep',
                question: 'How was your sleep last night?',
                options: [
                    { label: 'Excellent', value: 'excellent' },
                    { label: 'Good', value: 'good' },
                    { label: 'Fair', value: 'fair' },
                    { label: 'Poor', value: 'poor' }
                ]
            }
        ];
    }
    /**
     * Local fallback scoring when AI is unavailable.
     */
    private scoreCheckinLocally(answers: any): { score: number, feedback: string, insights: string[] } {
        let score = 75; // Base score
        const insights: string[] = [];

        // Simple heuristic scoring
        if (answers.energy_level === 'high') score += 5;
        if (answers.energy_level === 'low') { score -= 10; insights.push("Energy is lower than usual."); }

        if (answers.sleep_quality === 'excellent' || answers.sleep_quality === 'good') score += 5;
        if (answers.sleep_quality === 'poor') { score -= 10; insights.push("Sleep quality needs improvement."); }

        if (answers.stress_level === 'relaxed') score += 5;
        if (answers.stress_level === 'stressed' || answers.stress_level === 'very_stressed') {
            score -= 10;
            insights.push("High stress levels detected.");
        }

        // Clamp score
        score = Math.max(0, Math.min(100, score));

        let feedback = "Thanks for checking in! Keep monitoring your healthy habits.";
        if (score < 60) feedback = "It looks like you're having a tough day. Try to get some rest and stay hydrated.";
        if (score > 85) feedback = "You're doing great! Keep up the excellent work.";

        return { score, feedback, insights: insights.length > 0 ? insights : ["Stable vitals", "Consistent consistency"] };
    }
}

export const aiCheckinService = new AICheckinService();
