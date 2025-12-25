// lib/checkinSummaryAI.ts - FIXED VERSION

import { clinicalSignalService } from '@/services/clinicalSignalCapture';
import { CheckinAnswers } from './checkinQuestions';

/**
 * Generate AI-powered summary using historical signal data
 * This makes the AI "smarter" by analyzing patterns over time
 */
export async function generateCheckinSummary(
    userId: string,
    currentAnswers: CheckinAnswers
): Promise<{
    message: string;
    hasCriticalAlerts: boolean;
    insights: string[];
}> {
    try {
        // 1. Check for immediate critical values
        const criticalAlerts = checkCriticalValues(currentAnswers);

        if (criticalAlerts.length > 0) {
            return {
                message: formatCriticalAlert(criticalAlerts[0]),
                hasCriticalAlerts: true,
                insights: criticalAlerts.map(a => a.message)
            };
        }

        // 2. Get historical context from signal database
        const recentHistory = await getRecentSignalHistory(userId);

        // 3. Analyze patterns and generate insights
        const insights = await analyzeHealthPatterns(
            userId,
            currentAnswers,
            recentHistory
        );

        // 4. Generate personalized message
        const message = await generatePersonalizedMessage(
            currentAnswers,
            insights
        );

        return {
            message,
            hasCriticalAlerts: false,
            insights: insights.map(i => i.message)
        };

    } catch (error) {
        console.error('Error generating check-in summary:', error);
        return {
            message: "✨ Check-in recorded! Keep tracking daily for personalized insights.",
            hasCriticalAlerts: false,
            insights: []
        };
    }
}

/**
 * Check for immediate critical values that need urgent attention
 */
function checkCriticalValues(answers: CheckinAnswers): Array<{
    type: 'urgent' | 'warning';
    signal: string;
    value: any;
    message: string;
}> {
    const alerts: Array<{ type: 'urgent' | 'warning'; signal: string; value: any; message: string }> = [];

    // High fever
    if (answers.body_temperature && answers.body_temperature >= 39.5) {
        alerts.push({
            type: 'urgent',
            signal: 'body_temperature',
            value: answers.body_temperature,
            message: `Your temperature (${answers.body_temperature}°C) is very high. Please see a doctor today, especially if you have severe headache or confusion.`
        });
    }

    // Hypertensive crisis
    const systolic = answers.blood_pressure_systolic;
    const diastolic = answers.blood_pressure_diastolic;
    if (systolic && diastolic && (systolic >= 180 || diastolic >= 120)) {
        alerts.push({
            type: 'urgent',
            signal: 'blood_pressure',
            value: `${systolic}/${diastolic}`,
            message: `Your blood pressure (${systolic}/${diastolic}) is dangerously high. Seek emergency medical care immediately.`
        });
    }

    // Severe pain with concerning location
    if (answers.pain_severity === 'severe') {
        if (answers.pain_location === 'chest') {
            alerts.push({
                type: 'urgent',
                signal: 'pain_location',
                value: 'chest',
                message: 'Severe chest pain requires immediate medical evaluation. Call emergency services if accompanied by shortness of breath or arm pain.'
            });
        } else if (answers.pain_location === 'abdomen') {
            alerts.push({
                type: 'urgent',
                signal: 'pain_location',
                value: 'abdomen',
                message: 'Severe abdominal pain requires medical evaluation today. Seek care if accompanied by vomiting or fever.'
            });
        }
    }

    return alerts;
}

/**
 * Get recent signal history from database
 */
async function getRecentSignalHistory(userId: string) {
    const signalsToFetch = [
        'general_wellbeing',
        'energy_level',
        'sleep_quality',
        'body_temperature',
        'blood_pressure_systolic',
        'blood_pressure_diastolic',
        'stress_level'
    ];

    const history: Record<string, any[]> = {};

    for (const signalId of signalsToFetch) {
        const data = await clinicalSignalService.getSignalHistory(userId, signalId, 7);
        history[signalId] = data;
    }

    return history;
}

/**
 * Analyze health patterns using historical data
 */
async function analyzeHealthPatterns(
    userId: string,
    currentAnswers: CheckinAnswers,
    history: Record<string, any[]>
): Promise<Array<{ type: 'pattern' | 'trend' | 'insight'; message: string }>> {
    const insights: Array<{ type: 'pattern' | 'trend' | 'insight'; message: string }> = [];

    // Pattern: Consistently poor sleep
    const sleepHistory = history['sleep_quality'] || [];
    const poorSleepCount = sleepHistory.filter(s =>
        s.value === 'poor' || s.value === 'fair'
    ).length;

    if (poorSleepCount >= 4 && sleepHistory.length >= 5) {
        insights.push({
            type: 'pattern',
            message: `You've had poor sleep ${poorSleepCount} of the last ${sleepHistory.length} nights. This can affect your energy and overall health.`
        });
    }

    // Pattern: Low energy trend
    const energyHistory = history['energy_level'] || [];
    const lowEnergyCount = energyHistory.filter(e =>
        e.value === 'low' || e.value === 'very_low'
    ).length;

    if (lowEnergyCount >= 4 && currentAnswers.energy_level !== 'normal') {
        insights.push({
            type: 'pattern',
            message: `Your energy has been consistently low for ${lowEnergyCount} days. Consider your sleep quality, hydration, and stress levels.`
        });
    }

    // Trend: Blood pressure
    if (currentAnswers.blood_pressure_systolic) {
        const bpTrend = await clinicalSignalService.computeTrend(
            userId,
            'blood_pressure_systolic',
            14
        );

        if (bpTrend && bpTrend.dataPoints.length >= 3) {
            const avgBP = bpTrend.dataPoints.reduce((sum, dp) =>
                sum + (typeof dp.value === 'number' ? dp.value : 0), 0
            ) / bpTrend.dataPoints.length;

            if (avgBP > 130) {
                insights.push({
                    type: 'trend',
                    message: `Your average blood pressure over 2 weeks is ${Math.round(avgBP)}. Consider reducing salt and managing stress.`
                });
            }
        }
    }

    // Pattern: Not feeling well overall
    const wellbeingHistory = history['general_wellbeing'] || [];
    const unwell = wellbeingHistory.filter(w => w.value === 'not_well').length;

    if (unwell >= 3 && currentAnswers.general_wellbeing === 'not_well') {
        insights.push({
            type: 'pattern',
            message: `You've reported not feeling well for ${unwell} of the last ${wellbeingHistory.length} days. Consider scheduling a check-up with your doctor.`
        });
    }

    return insights;
}

/**
 * Generate personalized message based on current state and insights
 */
async function generatePersonalizedMessage(
    currentAnswers: CheckinAnswers,
    insights: Array<{ type: string; message: string }>
): Promise<string> {
    // If we have concerning patterns, prioritize those
    if (insights.length > 0) {
        let message = " **Health Insights**\n\n";
        message += insights.slice(0, 2).map(i => `• ${i.message}`).join('\n\n');
        message += "\n\n Keep tracking daily so I can provide better guidance!";
        return message;
    }

    // Otherwise, provide context-aware encouragement
    if (currentAnswers.general_wellbeing === 'very_good' ||
        currentAnswers.general_wellbeing === 'great') {
        return " Great to hear you're feeling well! Consistent tracking helps maintain this healthy state.";
    }

    if (currentAnswers.general_wellbeing === 'not_well') {
        return " I'm sorry you're not feeling your best. Rest is important—listen to your body. I'll keep monitoring your patterns to help identify what might be affecting you.";
    }

    if (currentAnswers.sleep_quality === 'poor') {
        return " Poor sleep can really impact your day. Try to prioritize rest tonight. I'll track how your sleep affects your energy levels over time.";
    }

    if (currentAnswers.energy_level === 'very_low' && !currentAnswers.fever) {
        return " Very low energy can indicate you need more rest or better nutrition. I'll monitor this pattern—if it continues, consider seeing a doctor.";
    }

    // Default positive message
    return "✅ Check-in recorded! The more you track, the better I understand your health patterns and can provide personalized advice.";
}

/**
 * Format critical alert message
 */
function formatCriticalAlert(alert: {
    type: 'urgent' | 'warning';
    signal: string;
    value: any;
    message: string;
}): string {
    const emoji = alert.type === 'urgent' ? '🚨' : '⚠️';
    const header = alert.type === 'urgent' ? 'URGENT' : 'WARNING';

    return `${emoji} **${header}**\n\n${alert.message}`;
}

/**
 * Simple version without AI for basic completion message
 */
export function getSimpleCompletionMessage(answersCount: number): string {
    if (answersCount >= 7) {
        return " Complete check-in recorded! This helps me understand your health patterns better.";
    } else if (answersCount >= 4) {
        return " Check-in saved! The more you track, the smarter I become about your health.";
    } else {
        return " Thanks for checking in! Try to complete more questions next time for better insights.";
    }
}