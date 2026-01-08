import { clinicalSignalService } from '../services/clinicalSignalCapture';
import { supabase } from './supabaseClient';

export interface HealthPrompt {
    id: string;
    source: 'daily_checkin' | 'medication' | 'signal' | 'onboarding' | 'history';
    confidence: 'low' | 'medium' | 'high';
    reason: string;      // Internal explanation of what was noticed
    trigger_text: string; // Short, captivating sentence shown on the card
    chat_opening: string; // First message the AI sends when chat opens
    next_action: 'discuss' | 'monitor' | 'escalate';
}

class AIPromptService {
    /**
     * Scans all relevant data sources to find meaningful patterns
     */
    async generatePrompts(userId: string): Promise<HealthPrompt[]> {
        const prompts: HealthPrompt[] = [];

        try {
            // 1. Check Daily Check-in Patterns (Last 7 days)
            const checkinPrompts = await this.analyzeCheckinPatterns(userId);
            prompts.push(...checkinPrompts);

            // 2. Check Health Signal Trends (Last 7 days)
            const signalPrompts = await this.analyzeSignalTrends(userId);
            prompts.push(...signalPrompts);

            // 3. Check Medications (Logic placeholder for adherence/concerns)
            const medPrompts = await this.analyzeMedicationContext(userId);
            prompts.push(...medPrompts);

            // 4. Check Onboarding Risks
            const onboardingPrompts = await this.analyzeOnboardingRisks(userId);
            prompts.push(...onboardingPrompts);

            // 5. Check Activity Trends
            const activityPrompts = await this.analyzeActivityTrends(userId);
            prompts.push(...activityPrompts);

        } catch (error) {
            console.error('Error generating proactive prompts:', error);
        }

        // Filter by frequency rules (In a real app, you'd track shown prompts in DB)
        // For now, return top 3 most confident/relevant
        return prompts
            .sort((a, b) => this.confidenceScore(b.confidence) - this.confidenceScore(a.confidence))
            .slice(0, 3);
    }

    private confidenceScore(conf: string): number {
        if (conf === 'high') return 3;
        if (conf === 'medium') return 2;
        return 1;
    }

    private async analyzeCheckinPatterns(userId: string): Promise<HealthPrompt[]> {
        const prompts: HealthPrompt[] = [];
        const { data: checkins } = await supabase
            .from('daily_checkins')
            .select('*')
            .eq('user_id', userId)
            .order('checkin_date', { ascending: false })
            .limit(7);

        if (!checkins || checkins.length < 2) return [];

        // Pattern: Multiple "Not Well" moods
        const poorMoods = checkins.filter(c => c.mood === 'not_well').length;
        if (poorMoods >= 2) {
            prompts.push({
                id: 'poor_mood_streak',
                source: 'daily_checkin',
                confidence: poorMoods >= 4 ? 'high' : 'medium',
                reason: `User reported feeling 'not well' ${poorMoods} times in the last week.`,
                trigger_text: "I noticed something concerning in your recent mood logs.",
                chat_opening: `You've reported feeling 'not well' ${poorMoods} times this week. I'm observant of this pattern and wanted to discuss if there's a specific cause we can address.`,
                next_action: 'discuss'
            });
        }

        // Pattern: Poor sleep
        const poorSleep = checkins.filter(c => c.sleep_quality === 'poor').length;
        if (poorSleep >= 3) {
            prompts.push({
                id: 'poor_sleep_streak',
                source: 'daily_checkin',
                confidence: 'high',
                reason: `User reported 'poor' sleep quality ${poorSleep} nights this week.`,
                trigger_text: "Your sleep patterns have been irregular lately.",
                chat_opening: `I've noticed you logged poor sleep quality ${poorSleep} times this week. Poor sleep often triggers other health clusters, so I wanted to see how you're coping.`,
                next_action: 'discuss'
            });
        }

        // Pattern: High stress
        const highStress = checkins.filter(c => c.stress_level === 'very_stressed').length;
        if (highStress >= 2) {
            prompts.push({
                id: 'high_stress_pattern',
                source: 'daily_checkin',
                confidence: 'medium',
                reason: `User reported 'very stressed' ${highStress} times.`,
                trigger_text: "A pattern of high stress is forming in your data.",
                chat_opening: `You've logged high stress levels recently. Since chronic stress impacts your cardiovascular health and sleep, I'd like to look at what's been happening.`,
                next_action: 'discuss'
            });
        }

        return prompts;
    }

    private async analyzeSignalTrends(userId: string): Promise<HealthPrompt[]> {
        const prompts: HealthPrompt[] = [];

        // 1. Heart Rate Trend
        const hrHistory = await clinicalSignalService.getSignalHistory(userId, 'heart_rate', 10);
        if (hrHistory.length >= 5) {
            const averageHR = hrHistory.reduce((sum, s) => sum + (s.value as number), 0) / hrHistory.length;
            const latestHR = hrHistory[0].value as number;

            if (latestHR > averageHR + 15) {
                prompts.push({
                    id: 'elevated_hr',
                    source: 'signal',
                    confidence: 'medium',
                    reason: `Latest HR (${latestHR}) is significantly higher than 10-day average (${Math.round(averageHR)}).`,
                    trigger_text: "Your resting heart rate shows an unusual trend.",
                    chat_opening: `I've noticed your resting heart rate is consistently higher today than your recent average. This can sometimes be a precursor to fatigue or illness, or just a reflection of stress.`,
                    next_action: 'monitor'
                });
            }
        }

        // 2. HRV Trend (Stress/Recovery)
        const hrvHistory = await clinicalSignalService.getSignalHistory(userId, 'heart_rate_variability', 10);
        if (hrvHistory.length >= 5) {
            const averageHRV = hrvHistory.slice(1).reduce((sum, s) => sum + (s.value as number), 0) / (hrvHistory.length - 1);
            const latestHRV = hrvHistory[0].value as number;

            if (latestHRV < averageHRV * 0.7) {
                prompts.push({
                    id: 'low_hrv_detected',
                    source: 'signal',
                    confidence: 'high',
                    reason: `Latest HRV (${latestHRV}ms) is 30% lower than 10-day average (${Math.round(averageHRV)}ms).`,
                    trigger_text: "Your body shows signs of significant physiological stress.",
                    chat_opening: `I've noticed a significant drop in your heart rate variability (HRV) compared to your recent baseline. This often indicates that your nervous system is under stress or that you haven't fully recovered. How has your energy been?`,
                    next_action: 'discuss'
                });
            }
        }

        // 3. Resting HR Trend
        const restingHRHistory = await clinicalSignalService.getSignalHistory(userId, 'resting_heart_rate', 10);
        if (restingHRHistory.length >= 5) {
            const averageRHR = restingHRHistory.slice(1).reduce((sum, s) => sum + (s.value as number), 0) / (restingHRHistory.length - 1);
            const latestRHR = restingHRHistory[0].value as number;

            if (latestRHR > averageRHR + 8) {
                prompts.push({
                    id: 'elevated_resting_hr',
                    source: 'signal',
                    confidence: 'medium',
                    reason: `Resting HR (${latestRHR}) is elevated compared to baseline (${Math.round(averageRHR)}).`,
                    trigger_text: "Your resting heart rate is higher than usual today.",
                    chat_opening: `Your resting heart rate is up about ${Math.round(latestRHR - averageRHR)} bpm from your usual average. This can sometimes be an early sign of a cold or general fatigue. Are you feeling any other symptoms?`,
                    next_action: 'monitor'
                });
            }
        }

        return prompts;
    }

    private async analyzeMedicationContext(userId: string): Promise<HealthPrompt[]> {
        const prompts: HealthPrompt[] = [];
        const { data: medications } = await supabase
            .from('medications')
            .select('*')
            .eq('user_id', userId);

        if (!medications || medications.length === 0) return [];

        // Logic: If user has medications but hasn't had a check-in in 2 days
        const { data: lastCheckin } = await supabase
            .from('daily_checkins')
            .select('checkin_date')
            .eq('user_id', userId)
            .order('checkin_date', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lastCheckin) {
            const daysSince = (Date.now() - new Date(lastCheckin.checkin_date).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince > 2) {
                prompts.push({
                    id: 'med_followup_missing_logs',
                    source: 'medication',
                    confidence: 'low',
                    reason: "User has active medications but hasn't logged symptoms/side-effects in 2+ days.",
                    trigger_text: "We should check in on your medication progress.",
                    chat_opening: `You have active medications recorded, but I haven't seen a daily log from you in a couple of days. Consistent tracking helps me catch side effects early.`,
                    next_action: 'discuss'
                });
            }
        }

        return prompts;
    }

    private async analyzeOnboardingRisks(userId: string): Promise<HealthPrompt[]> {
        const prompts: HealthPrompt[] = [];
        const { data: onboarding } = await supabase
            .from('onboarding')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (!onboarding) return [];

        if (onboarding.smoker) {
            prompts.push({
                id: 'lifestyle_smoker',
                source: 'onboarding',
                confidence: 'low',
                reason: "User is a smoker; periodic reminders about cardiovascular impact are observant.",
                trigger_text: "Let's review how your lifestyle factors are impacting your current metrics.",
                chat_opening: `During onboarding, you mentioned that you're a smoker. I've been watching your cardiovascular data, and it might be a good time to discuss how we can mitigate the long-term impact on your heart health.`,
                next_action: 'discuss'
            });
        }

        if (onboarding.alcohol_drinker) {
            prompts.push({
                id: 'lifestyle_alcohol',
                source: 'onboarding',
                confidence: 'low',
                reason: "User is an alcohol drinker; observant regarding sleep/recovery impacts.",
                trigger_text: "I want to talk about how dietary choices might be affecting your sleep.",
                chat_opening: `I'm observing a correlation between recovery days and your onboarding notes about alcohol consumption. We should discuss how this affects your sleep architecture.`,
                next_action: 'monitor'
            });
        }

        return prompts;
    }

    private async analyzeActivityTrends(userId: string): Promise<HealthPrompt[]> {
        const prompts: HealthPrompt[] = [];

        const stepsHistory = await clinicalSignalService.getSignalHistory(userId, 'steps_count', 7);
        if (stepsHistory.length >= 4) {
            const averageSteps = stepsHistory.slice(1).reduce((sum, s) => sum + (s.value as number), 0) / (stepsHistory.length - 1);
            const latestSteps = stepsHistory[0].value as number;

            if (latestSteps < averageSteps * 0.5) {
                prompts.push({
                    id: 'activity_drop',
                    source: 'signal',
                    confidence: 'medium',
                    reason: `Steps dropped significantly (${latestSteps}) compared to 7-day average (${Math.round(averageSteps)}).`,
                    trigger_text: "Your activity levels have dropped sharply over the last 48 hours.",
                    chat_opening: `I've noticed a significant decrease in your physical activity compared to your usual baseline. This often happens alongside fatigue or illness, or it might just be a busy schedule. How have you been feeling?`,
                    next_action: 'discuss'
                });
            }
        }

        return prompts;
    }
}

export const aiPromptService = new AIPromptService();
