// ============================================================================
// REDESIGNED DAILY CHECK-IN - LIFESTYLE PILLARS
// ============================================================================
// Focuses on 4 core behaviors that prevent chronic disease:
// 1. Diet & Nutrition
// 2. Physical Activity  
// 3. Sleep Quality
// 4. Stress Management
// ============================================================================

export interface CheckinQuestion {
    id: string;
    order: number;
    pillar: 'diet' | 'activity' | 'sleep' | 'stress' | 'general';
    emoji: string;
    question: string;
    signalId: string; // Maps to signal_schema.ts
    type: 'chips' | 'numeric' | 'scale';
    options?: CheckinOption[];
    unit?: string;
    helpText?: string;
}

export interface CheckinOption {
    label: string;
    value: string | number;
    impact?: 'negative' | 'neutral' | 'positive';
}

export interface CheckinAnswers {
    [key: string]: any;
}

/**
 * DAILY CHECK-IN QUESTIONS - 10 ESSENTIAL LIFESTYLE SIGNALS
 */
export const DAILY_CHECKIN_QUESTIONS: CheckinQuestion[] = [
    // ===================================================================
    // 0. GENERAL WELLBEING (Overall health status)
    // ===================================================================
    {
        id: 'general_wellbeing',
        order: 1,
        pillar: 'general',
        emoji: '',
        question: 'How are you feeling overall today?',
        signalId: 'general_wellbeing',
        type: 'chips',
        options: [
            { label: 'Great', value: 'very_good', impact: 'positive' },
            { label: 'Good', value: 'okay', impact: 'neutral' },
            { label: 'Not well', value: 'not_well', impact: 'negative' }
        ]
    },

    // ===================================================================
    // PILLAR 1: DIET & NUTRITION (3 questions)
    // ===================================================================
    {
        id: 'meal_quality',
        order: 10,
        pillar: 'diet',
        emoji: '🍎',
        question: 'How would you rate your meals today?',
        signalId: 'diet_quality',
        type: 'chips',
        helpText: 'Think: fruits, veggies, whole grains, lean proteins',
        options: [
            { label: 'Mostly unhealthy', value: 'unhealthy', impact: 'negative' },
            { label: 'Mixed', value: 'moderate', impact: 'neutral' },
            { label: 'Mostly healthy', value: 'healthy', impact: 'positive' },
            { label: 'Very healthy', value: 'very_healthy', impact: 'positive' }
        ]
    },
    {
        id: 'meal_frequency',
        order: 11,
        pillar: 'diet',
        emoji: '🍽️',
        question: 'How many meals did you eat today?',
        signalId: 'meal_frequency',
        type: 'chips',
        helpText: 'Regular eating patterns support metabolism',
        options: [
            { label: '0-1 meals', value: 1, impact: 'negative' },
            { label: '2 meals', value: 2, impact: 'neutral' },
            { label: '3 meals', value: 3, impact: 'positive' },
            { label: '4+ meals', value: 4, impact: 'neutral' }
        ]
    },
    {
        id: 'water_intake',
        order: 12,
        pillar: 'diet',
        emoji: '💧',
        question: 'How much water did you drink?',
        signalId: 'water_intake',
        type: 'chips',
        helpText: 'Aim for 6-8 glasses per day',
        options: [
            { label: '0-2 glasses', value: 1, impact: 'negative' },
            { label: '3-4 glasses', value: 3, impact: 'neutral' },
            { label: '5-6 glasses', value: 5, impact: 'positive' },
            { label: '7+ glasses', value: 7, impact: 'positive' }
        ],
        unit: 'glasses'
    },

    // ===================================================================
    // PILLAR 2: PHYSICAL ACTIVITY (2 questions)
    // ===================================================================
    {
        id: 'physical_activity',
        order: 20,
        pillar: 'activity',
        emoji: '🏃',
        question: 'How active were you today?',
        signalId: 'physical_activity',
        type: 'chips',
        helpText: 'Any movement counts: walking, stairs, exercise',
        options: [
            { label: 'Sedentary (no movement)', value: 'none', impact: 'negative' },
            { label: 'Light (short walks)', value: 'light', impact: 'neutral' },
            { label: 'Moderate (30+ min)', value: 'moderate', impact: 'positive' },
            { label: 'Intense (exercise/sports)', value: 'intense', impact: 'positive' }
        ]
    },
    {
        id: 'sitting_time',
        order: 21,
        pillar: 'activity',
        emoji: '🪑',
        question: 'How much time did you spend sitting?',
        signalId: 'sedentary_hours',
        type: 'chips',
        helpText: 'Prolonged sitting increases health risks',
        options: [
            { label: '0-4 hours', value: 2, impact: 'positive' },
            { label: '5-8 hours', value: 6, impact: 'neutral' },
            { label: '9-12 hours', value: 10, impact: 'negative' },
            { label: '12+ hours', value: 13, impact: 'negative' }
        ],
        unit: 'hours'
    },

    // ===================================================================
    // PILLAR 3: SLEEP (2 questions)
    // ===================================================================
    {
        id: 'sleep_duration',
        order: 30,
        pillar: 'sleep',
        emoji: '😴',
        question: 'How many hours did you sleep last night?',
        signalId: 'sleep_duration',
        type: 'chips',
        helpText: 'Adults need 7-9 hours for optimal health',
        options: [
            { label: 'Less than 5', value: 4, impact: 'negative' },
            { label: '5-6 hours', value: 5, impact: 'negative' },
            { label: '7-8 hours', value: 7, impact: 'positive' },
            { label: '9+ hours', value: 9, impact: 'neutral' }
        ],
        unit: 'hours'
    },
    {
        id: 'sleep_quality',
        order: 31,
        pillar: 'sleep',
        emoji: '🌙',
        question: 'How was your sleep quality?',
        signalId: 'sleep_quality',
        type: 'chips',
        helpText: 'Quality matters as much as quantity',
        options: [
            { label: 'Poor (restless)', value: 'poor', impact: 'negative' },
            { label: 'Fair (woke up often)', value: 'fair', impact: 'neutral' },
            { label: 'Good (mostly rested)', value: 'good', impact: 'positive' },
            { label: 'Excellent (fully rested)', value: 'excellent', impact: 'positive' }
        ]
    },

    // ===================================================================
    // PILLAR 4: STRESS MANAGEMENT (2 questions)
    // ===================================================================
    {
        id: 'stress_level',
        order: 40,
        pillar: 'stress',
        emoji: '🧠',
        question: 'How stressed did you feel today?',
        signalId: 'stress_level',
        type: 'chips',
        helpText: 'Chronic stress impacts both body and mind',
        options: [
            { label: 'Relaxed', value: 'relaxed', impact: 'positive' },
            { label: 'Normal', value: 'normal', impact: 'neutral' },
            { label: 'Stressed', value: 'stressed', impact: 'negative' },
            { label: 'Very stressed', value: 'very_stressed', impact: 'negative' }
        ]
    },
    {
        id: 'stress_coping',
        order: 41,
        pillar: 'stress',
        emoji: '🌿',
        question: 'Did you do anything to manage stress?',
        signalId: 'stress_management_used',
        type: 'chips',
        helpText: 'Examples: meditation, exercise, talking to someone, hobbies',
        options: [
            { label: 'No, felt overwhelmed', value: 'none', impact: 'negative' },
            { label: "Tried but didn't help", value: 'attempted', impact: 'neutral' },
            { label: 'Yes, helped a bit', value: 'somewhat', impact: 'positive' },
            { label: 'Yes, felt much better ', value: 'effective', impact: 'positive' }
        ]
    },

    // ===================================================================
    // ENERGY LEVEL (Context signal - shows impact of lifestyle)
    // ===================================================================
    {
        id: 'energy_level',
        order: 50,
        pillar: 'general',
        emoji: '⚡',
        question: 'How was your energy level today?',
        signalId: 'energy_level',
        type: 'chips',
        helpText: 'Low energy often reflects poor sleep, diet, or stress',
        options: [
            { label: 'Very low', value: 'very_low', impact: 'negative' },
            { label: 'Low', value: 'low', impact: 'negative' },
            { label: 'Normal', value: 'normal', impact: 'neutral' },
            { label: 'High', value: 'high', impact: 'positive' }
        ]
    }
];

/**
 * Get questions grouped by pillar (for UI sections)
 */
export function getQuestionsByPillar(pillar: CheckinQuestion['pillar']): CheckinQuestion[] {
    return DAILY_CHECKIN_QUESTIONS.filter(q => q.pillar === pillar);
}

/**
 * Map answers to signal instances for database storage
 */
export function mapAnswersToSignals(answers: CheckinAnswers): Array<{
    signalId: string;
    value: any;
    source: 'daily_checkin';
}> {
    const signals: Array<{ signalId: string; value: any; source: 'daily_checkin' }> = [];

    DAILY_CHECKIN_QUESTIONS.forEach(q => {
        const answer = answers[q.id];
        if (answer !== undefined && answer !== null) {
            signals.push({
                signalId: q.signalId,
                value: answer,
                source: 'daily_checkin'
            });
        }
    });

    return signals;
}