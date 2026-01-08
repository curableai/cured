// lib/signal-schema.ts
import * as Crypto from 'expo-crypto';
// ============================================================================
// CURABLE SIGNAL SCHEMA - V4 (ARCHITECTURE FIXES)
// ============================================================================
// FIXES APPLIED:
// 1. SignalInstance model for actual user data
// 2. Confidence scoring per source
// 3. Extended SignalContext for situational metadata
// 4. Data model clarity (signals = single source of truth)
// 5. AI removed as source (AI proposes → user/device confirms)
// ============================================================================

// ============================================================================
// CORE TYPES
// ============================================================================

export type SignalCategory =
    | 'lifestyle'
    | 'symptom'
    | 'vital'
    | 'mental'
    | 'medication'
    | 'context'
    | 'reproductive';

export type ValueType = 'numeric' | 'categorical' | 'boolean' | 'text' | 'severity' | 'time';
export type Frequency = 'once' | 'daily' | 'weekly' | 'on_change' | 'continuous';
export type Mode = 'onboarding' | 'daily_checkin' | 'diagnosis' | 'emergency';

// ============================================================================
// FIX #5: PROPER SIGNAL SOURCES (AI IS NEVER A SOURCE)
// ============================================================================
// AI may PROPOSE signals, but humans or devices CONFIRM them.
// 'chat' here means user-confirmed via chat (not AI extraction).

export type SignalSource =
    | 'device_healthkit'      // iOS HealthKit
    | 'device_health_connect' // Android Health Connect
    | 'onboarding'            // Initial onboarding flow
    | 'daily_checkin'         // Structured daily questions
    | 'chat_confirmed'        // User confirmed in chat (clicked chip/button)
    | 'manual_input';         // User typed and submitted

// ============================================================================
// FIX #2: CONFIDENCE SCORING BY SOURCE
// ============================================================================
// Each source has inherent reliability. This is used for:
// - Risk scoring (low confidence = less weight)
// - Diagnosis (low confidence signals need confirmation)
// - Trend analysis (filter out unreliable data points)

export const SOURCE_CONFIDENCE: Record<SignalSource, number> = {
    device_healthkit: 0.95,       // Hardware sensors, most reliable
    device_health_connect: 0.95,  // Hardware sensors, most reliable
    onboarding: 0.85,             // Structured questions, user-entered
    daily_checkin: 0.90,          // Structured chips/buttons
    chat_confirmed: 0.80,         // User clicked to confirm
    manual_input: 0.75,           // User typed freely (typos possible)
};

// Minimum confidence threshold for different operations
export const CONFIDENCE_THRESHOLDS = {
    DIAGNOSIS_TRIGGER: 0.7,       // Signal can trigger diagnosis logic
    RISK_SCORING: 0.6,            // Signal contributes to risk score
    TREND_ANALYSIS: 0.7,          // Signal included in trend computation
    EMERGENCY_TRIGGER: 0.5,       // Lower threshold for safety (err on side of caution)
};

// ============================================================================
// FIX #3: EXTENDED SIGNAL CONTEXT
// ============================================================================
// Situational metadata that affects signal interpretation.
// Without context, the same value can mean different things.

export interface SignalContext {
    // Activity state (e.g., high HR after exercise ≠ illness)
    activity_state?: 'resting' | 'active' | 'post_exercise' | 'sleeping';

    // Time of day (e.g., morning BP differs from evening)
    time_of_day?: 'morning' | 'afternoon' | 'evening' | 'night';

    // Location context (e.g., work stress vs home)
    location_type?: 'home' | 'work' | 'school' | 'hospital' | 'outdoors' | 'transit';

    // Pregnancy context (changes interpretation of many symptoms)
    pregnancy_trimester?: 1 | 2 | 3;

    // Geographic/endemic disease risk
    malaria_zone?: 'high' | 'medium' | 'low' | 'none';

    // Pre-existing conditions affecting interpretation
    chronic_conditions?: string[];

    // What triggered this symptom (if known)
    symptom_trigger?: string;

    // Fasting state (relevant for blood glucose, etc.)
    fasting?: boolean;

    // Recent medication (affects vital readings)
    recent_medication?: string;

    // Menstrual cycle day (affects many symptoms for females)
    cycle_day?: number;

    // Additional notes
    notes?: string;
}

// ============================================================================
// FIX #1: SIGNAL INSTANCE MODEL
// ============================================================================
// SignalDefinition = metadata (what a signal IS)
// SignalInstance = actual data (what the user REPORTED/RECORDED)
// This is the core model for storing user health data.

export interface SignalInstance {
    // Unique identifier for this instance
    id: string;

    // Foreign key to user (profiles table)
    userId: string;

    // Foreign key to signal definition
    signalId: string;

    // The actual value (type depends on SignalDefinition.valueType)
    value: number | string | boolean;

    // How this data was captured
    source: SignalSource;

    // Confidence in this data point (0.0 - 1.0)
    // Defaults to SOURCE_CONFIDENCE[source] but can be adjusted
    confidence: number;

    // When the measurement/answer was captured
    capturedAt: string; // ISO 8601 timestamp

    // When this was stored in our system (may differ from capturedAt for device sync)
    createdAt: string; // ISO 8601 timestamp

    // Situational context at time of capture
    context?: SignalContext;

    // If this was AI-proposed, track the proposal ID for audit
    aiProposalId?: string;

    // If this supersedes a previous instance (correction)
    supersedes?: string;

    // Soft delete flag
    isDeleted?: boolean;
}

// ============================================================================
// AI PROPOSAL MODEL (AI proposes, user confirms)
// ============================================================================
// When AI extracts data from free text, it creates a PROPOSAL.
// The proposal must be confirmed before becoming a SignalInstance.

export interface AISignalProposal {
    id: string;
    userId: string;
    signalId: string;
    proposedValue: number | string | boolean;
    extractedFrom: string; // The text AI analyzed
    aiConfidence: number; // AI's confidence in extraction (0.0 - 1.0)
    status: 'pending' | 'confirmed' | 'rejected' | 'expired';
    createdAt: string;
    resolvedAt?: string;
    resolvedBy?: 'user_click' | 'user_edit' | 'timeout' | 'superseded';
}

// ============================================================================
// SIGNAL DEFINITION (METADATA)
// ============================================================================

export interface SignalDefinition {
    id: string;
    category: SignalCategory;
    name: string;
    valueType: ValueType;

    validation: {
        required?: boolean;
        min?: number;
        max?: number;
        options?: string[];
        pattern?: string;
    };

    frequency: Frequency;
    freshnessWindow: number; // hours until stale

    trackTrend: boolean;
    trendWindow: number; // days for trend analysis

    affectsRisk: boolean;
    riskWeight?: number; // 0.0 - 1.0

    // Which sources can provide this signal
    allowedSources: SignalSource[];

    // Related signals to ask about
    requiresFollowup?: string[];

    // Device API mappings
    deviceMapping?: {
        ios?: string;     // HealthKit identifier
        android?: string; // Health Connect identifier
    };

    // Contextual requirements for this signal to be relevant
    contextRules?: {
        requiresGender?: 'female' | 'male';
        requiresAge?: { min?: number; max?: number };
        requiresCondition?: string[];
        requiresPregnancyStatus?: string[];
    };

    // UI helpers
    question?: string;
    chips?: string[];
    unit?: string;
}

// ============================================================================
// FIX #4: DATA MODEL CLARITY
// ============================================================================
// ARCHITECTURE PRINCIPLE: Signals are the SINGLE source of truth.
//
// Layer           | Responsibility
// ----------------|--------------------------------------------
// Profiles table  | Auth + identity only (user_id, email, etc.)
// Signals table   | ALL health facts (including age, sex, height)
// SignalInstances | Every measurement/answer with timestamp
// Onboarding      | Optional UX flow (NOT a data store)
//
// Age, sex, height, weight → stored as SignalInstances (frequency: 'once')
// Onboarding collects initial signals but doesn't store them separately.

// ============================================================================
// LIFESTYLE SIGNALS
// ============================================================================

const LIFESTYLE_SIGNALS: SignalDefinition[] = [
    // SLEEP
    {
        id: 'sleep_duration',
        category: 'lifestyle',
        name: 'Sleep Duration',
        valueType: 'numeric',
        validation: { min: 0, max: 16 },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.6,
        allowedSources: ['onboarding', 'daily_checkin', 'chat_confirmed', 'device_healthkit', 'device_health_connect'],
        deviceMapping: {
            ios: 'HKCategoryTypeIdentifierSleepAnalysis',
            android: 'SleepSession'
        },
        question: 'How many hours did you sleep last night?',
        chips: ['<4', '4-6', '6-8', '8+'],
        unit: 'hours'
    },
    {
        id: 'sleep_quality',
        category: 'lifestyle',
        name: 'Sleep Quality',
        valueType: 'categorical',
        validation: { options: ['poor', 'fair', 'good', 'excellent'] },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.5,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        question: 'How was your sleep quality?',
        chips: ['Poor', 'Fair', 'Good', 'Excellent']
    },

    // HYDRATION
    {
        id: 'water_intake',
        category: 'lifestyle',
        name: 'Water Intake',
        valueType: 'numeric',
        validation: { min: 0, max: 15 },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.4,
        allowedSources: ['onboarding', 'daily_checkin', 'chat_confirmed', 'device_healthkit', 'device_health_connect'],
        deviceMapping: {
            ios: 'HKQuantityTypeIdentifierDietaryWater',
            android: 'Hydration'
        },
        question: 'How many bottles of water today?',
        chips: ['0-2', '3-4', '5-6', '7+'],
        unit: 'bottles'
    },

    // ACTIVITY
    {
        id: 'physical_activity',
        category: 'lifestyle',
        name: 'Physical Activity',
        valueType: 'categorical',
        validation: { options: ['none', 'light', 'moderate', 'intense'] },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.3,
        allowedSources: ['onboarding', 'daily_checkin', 'chat_confirmed', 'device_healthkit', 'device_health_connect'],
        deviceMapping: {
            ios: 'HKQuantityTypeIdentifierActiveEnergyBurned',
            android: 'ExerciseSession'
        },
        question: 'How active were you today?',
        chips: ['None', 'Light walk', 'Moderate', 'Intense']
    },
    {
        id: 'steps_count',
        category: 'lifestyle',
        name: 'Steps Count',
        valueType: 'numeric',
        validation: { min: 0, max: 50000 },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: false,
        riskWeight: 0.2,
        allowedSources: ['device_healthkit', 'device_health_connect'],
        deviceMapping: {
            ios: 'HKQuantityTypeIdentifierStepCount',
            android: 'Steps'
        },
        unit: 'steps'
    },

    {
        id: 'sedentary_hours',
        category: 'lifestyle',
        name: 'Sedentary Hours',
        valueType: 'numeric',
        validation: { min: 0, max: 24 },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.6,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        question: 'How many hours did you spend sitting today?',
        chips: ['0-4', '5-8', '9-12', '12+'],
        unit: 'hours'
    },
    {
        id: 'stress_management_used',
        category: 'lifestyle',
        name: 'Stress Management Used',
        valueType: 'categorical',
        validation: {
            options: ['none', 'attempted', 'somewhat', 'effective']
        },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.5,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        question: 'Did you do anything to manage stress today?',
        chips: ['No', 'Tried', 'Yes, helped a bit', 'Yes, helped a lot']
    },

    // NUTRITION
    {
        id: 'meal_frequency',
        category: 'lifestyle',
        name: 'Meal Frequency',
        valueType: 'numeric',
        validation: { min: 0, max: 10 },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.3,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        question: 'How many meals today?',
        chips: ['0-1', '2', '3', '4+'],
        unit: 'meals'
    },
    {
        id: 'diet_quality',
        category: 'lifestyle',
        name: 'Diet Quality',
        valueType: 'categorical',
        validation: { options: ['unhealthy', 'moderate', 'healthy', 'very_healthy'] },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.5,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        question: 'How would you rate your meals today?',
        chips: ['Unhealthy', 'Moderate', 'Healthy', 'Very healthy']
    },
    {
        id: 'sodium_intake',
        category: 'lifestyle',
        name: 'Sodium Intake',
        valueType: 'categorical',
        validation: { options: ['low', 'moderate', 'high', 'excessive'] },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.8,
        allowedSources: ['chat_confirmed', 'daily_checkin'],
        question: 'How much salt was in your food today?',
        chips: ['Very little', 'Normal', 'High (processed food)', 'Very high']
    },
    {
        id: 'sugar_intake',
        category: 'lifestyle',
        name: 'Sugar Intake',
        valueType: 'categorical',
        validation: { options: ['low', 'moderate', 'high', 'excessive'] },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.7,
        allowedSources: ['chat_confirmed', 'daily_checkin'],
        question: 'How much sugar did you have today?',
        chips: ['None/Low', 'Some', 'High', 'Very high']
    },
    {
        id: 'potassium_intake',
        category: 'lifestyle',
        name: 'Potassium Intake',
        valueType: 'categorical',
        validation: { options: ['low', 'adequate', 'high'] },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.4,
        allowedSources: ['chat_confirmed', 'daily_checkin'],
        question: 'Did you eat potassium-rich foods (beans, bananas, greens)?',
        chips: ['No', 'Some', 'Yes, plenty']
    },

    // STRESS & MENTAL
    {
        id: 'stress_level',
        category: 'lifestyle',
        name: 'Stress Level',
        valueType: 'categorical',
        validation: { options: ['relaxed', 'normal', 'stressed', 'very_stressed'] },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.7,
        allowedSources: ['onboarding', 'daily_checkin', 'chat_confirmed'],
        question: 'How stressed are you feeling?',
        chips: ['Relaxed', 'Normal', 'Stressed', 'Very stressed']
    },

    // SUBSTANCES
    {
        id: 'caffeine_intake',
        category: 'lifestyle',
        name: 'Caffeine Intake',
        valueType: 'numeric',
        validation: { min: 0, max: 20 },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.5,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        question: 'Cups of coffee/tea today?',
        chips: ['0', '1-2', '3-4', '5+'],
        unit: 'cups'
    },
    {
        id: 'alcohol_units',
        category: 'lifestyle',
        name: 'Alcohol Units',
        valueType: 'numeric',
        validation: { min: 0, max: 20 },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.7,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        question: 'Alcoholic drinks today?',
        chips: ['0', '1-2', '3-4', '5+'],
        unit: 'units'
    },
    {
        id: 'general_wellbeing',
        category: 'lifestyle',
        name: 'General Wellbeing',
        valueType: 'categorical',
        validation: { options: ['very_good', 'okay', 'not_well'] },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.6,
        allowedSources: ['daily_checkin', 'chat_confirmed', 'onboarding'],
        question: 'How are you feeling today?',
        chips: ['Very good', 'Okay', 'Not well']
    },
    {
        id: 'energy_level',
        category: 'lifestyle',
        name: 'Energy Level',
        valueType: 'categorical',
        validation: { options: ['normal', 'low', 'very_low', 'high'] },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.5,
        allowedSources: ['daily_checkin', 'chat_confirmed', 'onboarding'],
        question: 'How is your energy today?',
        chips: ['Normal', 'Low', 'Very low', 'High']
    }
];

// ============================================================================
// SYMPTOM SIGNALS
// ============================================================================

const SYMPTOM_SIGNALS: SignalDefinition[] = [
    // SYMPTOM DURATION
    {
        id: 'symptom_duration_days',
        category: 'symptom',
        name: 'Symptom Duration',
        valueType: 'numeric',
        validation: { min: 0, max: 365 },
        frequency: 'on_change',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.8,
        allowedSources: ['chat_confirmed', 'manual_input'],
        question: 'How long have you had this symptom?',
        chips: ['Today (hours)', '1-2 days', '3-5 days', '1 week', '2+ weeks'],
        unit: 'days'
    },

    // SYMPTOM PROGRESSION
    {
        id: 'symptom_progression',
        category: 'symptom',
        name: 'Symptom Progression',
        valueType: 'categorical',
        validation: {
            options: ['getting_worse', 'staying_same', 'getting_better', 'fluctuating']
        },
        frequency: 'on_change',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.7,
        allowedSources: ['chat_confirmed', 'manual_input'],
        question: 'Is this symptom getting worse, better, or staying the same?',
        chips: ['Getting worse', 'Staying same', 'Getting better', 'Up and down']
    },

    // FUNCTIONAL IMPAIRMENT
    {
        id: 'functional_impairment',
        category: 'symptom',
        name: 'Functional Impairment',
        valueType: 'categorical',
        validation: {
            options: ['none', 'mild', 'moderate', 'severe', 'cannot_function']
        },
        frequency: 'on_change',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.9,
        allowedSources: ['chat_confirmed', 'manual_input'],
        question: 'How much is this affecting your daily activities?',
        chips: ['Not at all', 'A little', 'Quite a bit', 'Cannot function']
    },

    // COMMON SYMPTOMS
    {
        id: 'headache',
        category: 'symptom',
        name: 'Headache',
        valueType: 'severity',
        validation: { min: 1, max: 10 },
        frequency: 'on_change',
        freshnessWindow: 12,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.6,
        allowedSources: ['chat_confirmed', 'daily_checkin', 'manual_input'],
        requiresFollowup: ['headache_location', 'symptom_duration_days', 'symptom_progression'],
        question: 'How severe is the headache? (1-10)'
    },
    {
        id: 'headache_location',
        category: 'symptom',
        name: 'Headache Location',
        valueType: 'categorical',
        validation: { options: ['front', 'sides', 'back', 'all_over', 'temples'] },
        frequency: 'on_change',
        freshnessWindow: 24,
        trackTrend: false,
        trendWindow: 0,
        affectsRisk: true,
        riskWeight: 0.3,
        allowedSources: ['chat_confirmed', 'manual_input'],
        question: 'Where do you feel the headache?',
        chips: ['Front', 'Sides', 'Back', 'All over', 'Temples']
    },
    {
        id: 'fever',
        category: 'symptom',
        name: 'Fever',
        valueType: 'boolean',
        validation: {},
        frequency: 'on_change',
        freshnessWindow: 12,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.8,
        allowedSources: ['chat_confirmed', 'daily_checkin', 'manual_input'],
        requiresFollowup: ['body_temperature', 'symptom_duration_days'],
        question: 'Do you have a fever?'
    },
    {
        id: 'body_temperature',
        category: 'symptom',
        name: 'Body Temperature',
        valueType: 'numeric',
        validation: { min: 35, max: 42 },
        frequency: 'on_change',
        freshnessWindow: 12,
        trackTrend: true,
        trendWindow: 3,
        affectsRisk: true,
        riskWeight: 0.9,
        allowedSources: ['chat_confirmed', 'device_healthkit', 'device_health_connect', 'manual_input'],
        deviceMapping: {
            ios: 'HKQuantityTypeIdentifierBodyTemperature',
            android: 'BodyTemperature'
        },
        question: 'What is your temperature?',
        unit: '°C'
    },
    {
        id: 'fatigue',
        category: 'symptom',
        name: 'Fatigue',
        valueType: 'severity',
        validation: { min: 1, max: 10 },
        frequency: 'on_change',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.5,
        allowedSources: ['chat_confirmed', 'daily_checkin', 'manual_input'],
        question: 'How tired are you feeling? (1-10)'
    },
    {
        id: 'nausea',
        category: 'symptom',
        name: 'Nausea',
        valueType: 'severity',
        validation: { min: 1, max: 10 },
        frequency: 'on_change',
        freshnessWindow: 12,
        trackTrend: true,
        trendWindow: 3,
        affectsRisk: true,
        riskWeight: 0.6,
        allowedSources: ['chat_confirmed', 'daily_checkin', 'manual_input'],
        question: 'How strong is the nausea? (1-10)'
    },
    {
        id: 'cough',
        category: 'symptom',
        name: 'Cough',
        valueType: 'categorical',
        validation: { options: ['none', 'dry', 'wet', 'severe'] },
        frequency: 'on_change',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.6,
        allowedSources: ['chat_confirmed', 'daily_checkin', 'manual_input'],
        question: 'Any cough?',
        chips: ['None', 'Dry cough', 'Wet cough', 'Severe']
    },

    // NIGERIA-SPECIFIC SYMPTOMS
    {
        id: 'malaria_symptoms',
        category: 'symptom',
        name: 'Malaria-like Symptoms',
        valueType: 'boolean',
        validation: {},
        frequency: 'on_change',
        freshnessWindow: 12,
        trackTrend: true,
        trendWindow: 3,
        affectsRisk: true,
        riskWeight: 0.9,
        allowedSources: ['chat_confirmed', 'daily_checkin', 'manual_input'],
        requiresFollowup: ['fever', 'body_temperature', 'fatigue'],
        question: 'Any fever, chills, or body aches?'
    },
    {
        id: 'typhoid_symptoms',
        category: 'symptom',
        name: 'Typhoid-like Symptoms',
        valueType: 'boolean',
        validation: {},
        frequency: 'on_change',
        freshnessWindow: 12,
        trackTrend: true,
        trendWindow: 3,
        affectsRisk: true,
        riskWeight: 0.9,
        allowedSources: ['chat_confirmed', 'manual_input'],
        requiresFollowup: ['fever', 'body_temperature', 'fatigue', 'headache'],
        question: 'Persistent fever with weakness?'
    },
    {
        id: 'chills_sweating',
        category: 'symptom',
        name: 'Chills or Sweating',
        valueType: 'categorical',
        validation: { options: ['none', 'chills', 'sweating', 'both'] },
        frequency: 'on_change',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.4,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        question: 'Chills or sweating?'
    },
    {
        id: 'has_pain',
        category: 'symptom',
        name: 'Pain or Discomfort',
        valueType: 'boolean',
        validation: {},
        frequency: 'on_change',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.6,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        question: 'Are you in pain?'
    },
    {
        id: 'pain_location',
        category: 'symptom',
        name: 'Pain Location',
        valueType: 'categorical',
        validation: { options: ['head', 'chest', 'abdomen', 'joints', 'body_aches', 'other'] },
        frequency: 'on_change',
        freshnessWindow: 24,
        trackTrend: false,
        trendWindow: 0,
        affectsRisk: true,
        riskWeight: 0.3,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        question: 'Where is the pain?'
    },
    {
        id: 'pain_severity',
        category: 'symptom',
        name: 'Pain Severity',
        valueType: 'categorical',
        validation: { options: ['mild', 'moderate', 'severe'] },
        frequency: 'on_change',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.7,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        question: 'How severe is the pain?'
    }
];

// ============================================================================
// RED FLAG SIGNALS (EMERGENCY TRIGGERS)
// ============================================================================

const RED_FLAG_SIGNALS: SignalDefinition[] = [
    {
        id: 'chest_pain',
        category: 'symptom',
        name: 'Chest Pain',
        valueType: 'severity',
        validation: { min: 1, max: 10 },
        frequency: 'on_change',
        freshnessWindow: 1,
        trackTrend: false,
        trendWindow: 0,
        affectsRisk: true,
        riskWeight: 1.0,
        allowedSources: ['chat_confirmed', 'manual_input'],
        question: '⚠️ URGENT: Describe chest pain severity (1-10)'
    },
    {
        id: 'difficulty_breathing',
        category: 'symptom',
        name: 'Difficulty Breathing',
        valueType: 'severity',
        validation: { min: 1, max: 10 },
        frequency: 'on_change',
        freshnessWindow: 1,
        trackTrend: false,
        trendWindow: 0,
        affectsRisk: true,
        riskWeight: 1.0,
        allowedSources: ['chat_confirmed', 'manual_input'],
        question: '⚠️ URGENT: How severe is breathing difficulty? (1-10)'
    },
    {
        id: 'severe_bleeding',
        category: 'symptom',
        name: 'Severe Bleeding',
        valueType: 'boolean',
        validation: {},
        frequency: 'on_change',
        freshnessWindow: 1,
        trackTrend: false,
        trendWindow: 0,
        affectsRisk: true,
        riskWeight: 1.0,
        allowedSources: ['chat_confirmed', 'manual_input'],
        question: '⚠️ URGENT: Are you experiencing severe bleeding?'
    },
    {
        id: 'sudden_confusion',
        category: 'symptom',
        name: 'Sudden Confusion',
        valueType: 'boolean',
        validation: {},
        frequency: 'on_change',
        freshnessWindow: 1,
        trackTrend: false,
        trendWindow: 0,
        affectsRisk: true,
        riskWeight: 1.0,
        allowedSources: ['chat_confirmed', 'manual_input'],
        question: '⚠️ URGENT: Sudden confusion or disorientation?'
    }
];

// ============================================================================
// VITAL SIGNALS
// ============================================================================

const VITAL_SIGNALS: SignalDefinition[] = [
    {
        id: 'heart_rate_variability',
        category: 'vital',
        name: 'Heart Rate Variability',
        valueType: 'numeric',
        validation: { min: 1, max: 200 },
        frequency: 'continuous',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.5,
        allowedSources: ['device_healthkit'],
        deviceMapping: {
            ios: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN'
        },
        unit: 'ms'
    },
    {
        id: 'resting_heart_rate',
        category: 'vital',
        name: 'Resting Heart Rate',
        valueType: 'numeric',
        validation: { min: 30, max: 120 },
        frequency: 'daily',
        freshnessWindow: 48,
        trackTrend: true,
        trendWindow: 30,
        affectsRisk: true,
        riskWeight: 0.6,
        allowedSources: ['device_healthkit', 'device_health_connect'],
        deviceMapping: {
            ios: 'HKQuantityTypeIdentifierRestingHeartRate',
            android: 'RestingHeartRate'
        },
        unit: 'bpm'
    },
    {
        id: 'headphone_audio_level',
        category: 'vital',
        name: 'Headphone Audio Level',
        valueType: 'numeric',
        validation: { min: 0, max: 150 },
        frequency: 'continuous',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.3,
        allowedSources: ['device_healthkit'],
        deviceMapping: {
            ios: 'HKQuantityTypeIdentifierHeadphoneAudioExposure'
        },
        unit: 'dB'
    },
    {
        id: 'heart_rate',
        category: 'vital',
        name: 'Heart Rate',
        valueType: 'numeric',
        validation: { min: 40, max: 200 },
        frequency: 'continuous',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.7,
        allowedSources: ['device_healthkit', 'device_health_connect', 'chat_confirmed', 'manual_input'],
        deviceMapping: {
            ios: 'HKQuantityTypeIdentifierHeartRate',
            android: 'HeartRate'
        },
        unit: 'bpm'
    },
    {
        id: 'blood_pressure_systolic',
        category: 'vital',
        name: 'Blood Pressure (Systolic)',
        valueType: 'numeric',
        validation: { min: 70, max: 200 },
        frequency: 'weekly',
        freshnessWindow: 168,
        trackTrend: true,
        trendWindow: 30,
        affectsRisk: true,
        riskWeight: 0.8,
        allowedSources: ['device_healthkit', 'device_health_connect', 'chat_confirmed', 'manual_input'],
        deviceMapping: {
            ios: 'HKQuantityTypeIdentifierBloodPressureSystolic',
            android: 'BloodPressure'
        },
        contextRules: { requiresCondition: ['hypertension'] },
        unit: 'mmHg'
    },
    {
        id: 'blood_pressure_diastolic',
        category: 'vital',
        name: 'Blood Pressure (Diastolic)',
        valueType: 'numeric',
        validation: { min: 40, max: 130 },
        frequency: 'weekly',
        freshnessWindow: 168,
        trackTrend: true,
        trendWindow: 30,
        affectsRisk: true,
        riskWeight: 0.8,
        allowedSources: ['device_healthkit', 'device_health_connect', 'chat_confirmed', 'manual_input'],
        deviceMapping: {
            ios: 'HKQuantityTypeIdentifierBloodPressureDiastolic',
            android: 'BloodPressure'
        },
        contextRules: { requiresCondition: ['hypertension'] },
        unit: 'mmHg'
    },
    {
        id: 'blood_oxygen',
        category: 'vital',
        name: 'Blood Oxygen',
        valueType: 'numeric',
        validation: { min: 70, max: 100 },
        frequency: 'continuous',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.9,
        allowedSources: ['device_healthkit', 'device_health_connect'],
        deviceMapping: {
            ios: 'HKQuantityTypeIdentifierOxygenSaturation',
            android: 'OxygenSaturation'
        },
        unit: '%'
    },
    {
        id: 'weight',
        category: 'vital',
        name: 'Weight',
        valueType: 'numeric',
        validation: { min: 30, max: 300 },
        frequency: 'weekly',
        freshnessWindow: 168,
        trackTrend: true,
        trendWindow: 30,
        affectsRisk: false,
        riskWeight: 0.3,
        allowedSources: ['device_healthkit', 'device_health_connect', 'chat_confirmed', 'onboarding', 'manual_input'],
        deviceMapping: {
            ios: 'HKQuantityTypeIdentifierBodyMass',
            android: 'Weight'
        },
        unit: 'kg'
    },
    {
        id: 'height',
        category: 'vital',
        name: 'Height',
        valueType: 'numeric',
        validation: { min: 50, max: 250 },
        frequency: 'once',
        freshnessWindow: 999999,
        trackTrend: false,
        trendWindow: 0,
        affectsRisk: false,
        riskWeight: 0,
        allowedSources: ['onboarding', 'manual_input'],
        deviceMapping: {
            ios: 'HKQuantityTypeIdentifierHeight',
            android: 'Height'
        },
        unit: 'cm'
    }
];

// ============================================================================
// MENTAL HEALTH SIGNALS
// ============================================================================

const MENTAL_SIGNALS: SignalDefinition[] = [
    {
        id: 'mood',
        category: 'mental',
        name: 'Mood',
        valueType: 'categorical',
        validation: { options: ['very_low', 'low', 'neutral', 'good', 'great'] },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.6,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        question: 'How are you feeling today?',
        chips: ['Very low', ' Low', ' Neutral', ' Good', ' Great']
    },
    {
        id: 'anxiety_level',
        category: 'mental',
        name: 'Anxiety Level',
        valueType: 'categorical',
        validation: { options: ['none', 'mild', 'moderate', 'severe'] },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.7,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        question: 'Any anxiety today?',
        chips: ['None', 'A little', 'Moderate', 'A lot']
    }
];

// ============================================================================
// REPRODUCTIVE HEALTH SIGNALS (FEMALE-SPECIFIC)
// ============================================================================

const REPRODUCTIVE_SIGNALS: SignalDefinition[] = [
    {
        id: 'menstrual_phase',
        category: 'reproductive',
        name: 'Menstrual Phase',
        valueType: 'categorical',
        validation: {
            options: ['menstruation', 'follicular', 'ovulation', 'luteal', 'none']
        },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 30,
        affectsRisk: true,
        riskWeight: 0.6,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        contextRules: { requiresGender: 'female' },
        question: 'Where are you in your cycle?',
        chips: ['Period', 'Follicular', 'Ovulation', 'Luteal', 'Not tracking']
    },
    {
        id: 'period_flow',
        category: 'reproductive',
        name: 'Period Flow',
        valueType: 'categorical',
        validation: { options: ['light', 'moderate', 'heavy', 'very_heavy'] },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 30,
        affectsRisk: true,
        riskWeight: 0.5,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        contextRules: { requiresGender: 'female' },
        question: 'How is your period flow?',
        chips: ['Light', 'Moderate', 'Heavy', 'Very heavy']
    },
    {
        id: 'menstrual_cramps',
        category: 'reproductive',
        name: 'Menstrual Cramps',
        valueType: 'severity',
        validation: { min: 1, max: 10 },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 30,
        affectsRisk: true,
        riskWeight: 0.4,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        contextRules: { requiresGender: 'female' },
        question: 'Any menstrual cramps? (1-10)'
    },
    {
        id: 'menstrual_related',
        category: 'reproductive',
        name: 'Menstrual Related',
        valueType: 'categorical',
        validation: { options: ['true', 'false', 'possibly'] },
        frequency: 'on_change',
        freshnessWindow: 24,
        trackTrend: false,
        trendWindow: 0,
        affectsRisk: true,
        riskWeight: 0.3,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        question: 'Menstrual related?'
    }
];

// ============================================================================
// CONTEXT SIGNALS (USER PROFILE - stored as signals, not profiles table)
// ============================================================================

const CONTEXT_SIGNALS: SignalDefinition[] = [
    {
        id: 'age',
        category: 'context',
        name: 'Age',
        valueType: 'numeric',
        validation: { min: 13, max: 120 },
        frequency: 'once',
        freshnessWindow: 999999,
        trackTrend: false,
        trendWindow: 0,
        affectsRisk: true,
        riskWeight: 0.4,
        allowedSources: ['onboarding', 'manual_input'],
        question: 'How old are you?',
        unit: 'years'
    },
    {
        id: 'sex',
        category: 'context',
        name: 'Biological Sex',
        valueType: 'categorical',
        validation: { options: ['male', 'female'] },
        frequency: 'once',
        freshnessWindow: 999999,
        trackTrend: false,
        trendWindow: 0,
        affectsRisk: true,
        riskWeight: 0.3,
        allowedSources: ['onboarding'],
        question: 'What is your biological sex?',
        chips: ['Male', 'Female']
    },
    {
        id: 'pregnancy_status',
        category: 'context',
        name: 'Pregnancy Status',
        valueType: 'categorical',
        validation: {
            options: ['not_pregnant', 'pregnant', 'trying_to_conceive', 'postpartum', 'unsure']
        },
        frequency: 'on_change',
        freshnessWindow: 999999,
        trackTrend: false,
        trendWindow: 0,
        affectsRisk: true,
        riskWeight: 0.9,
        allowedSources: ['onboarding', 'chat_confirmed'],
        contextRules: { requiresGender: 'female' },
        question: 'Are you currently pregnant?',
        chips: ['No', 'Yes', 'Trying', 'Postpartum', 'Not sure']
    },
    {
        id: 'chronic_condition',
        category: 'context',
        name: 'Chronic Condition',
        valueType: 'categorical',
        validation: {
            options: [
                'hypertension', 'diabetes', 'asthma', 'arthritis',
                'heart_disease', 'kidney_disease', 'none'
            ]
        },
        frequency: 'once',
        freshnessWindow: 999999,
        trackTrend: false,
        trendWindow: 0,
        affectsRisk: true,
        riskWeight: 0.8,
        allowedSources: ['onboarding', 'chat_confirmed'],
        question: 'Any chronic health conditions?',
        chips: ['Hypertension', 'Diabetes', 'Asthma', 'None']
    },
    {
        id: 'location_zone',
        category: 'context',
        name: 'Geographic Location Zone',
        valueType: 'categorical',
        validation: {
            options: ['urban', 'suburban', 'rural']
        },
        frequency: 'once',
        freshnessWindow: 999999,
        trackTrend: false,
        trendWindow: 0,
        affectsRisk: true,
        riskWeight: 0.3,
        allowedSources: ['onboarding', 'chat_confirmed'],
        question: 'What type of area do you live in?',
        chips: ['Urban', 'Suburban', 'Rural']
    }
];

// ============================================================================
// MEDICATION SIGNALS
// ============================================================================

const MEDICATION_SIGNALS: SignalDefinition[] = [
    {
        id: 'medication_name',
        category: 'medication',
        name: 'Medication Name',
        valueType: 'text',
        validation: {
            pattern: '^[a-zA-Z0-9\\s-]+$'
        },
        frequency: 'once',
        freshnessWindow: 999999,
        trackTrend: false,
        trendWindow: 0,
        affectsRisk: false,
        riskWeight: 0,
        allowedSources: ['onboarding', 'chat_confirmed', 'manual_input'],
        question: 'What medication are you taking?'
    },
    {
        id: 'medication_dose',
        category: 'medication',
        name: 'Medication Dose',
        valueType: 'text',
        validation: {},
        frequency: 'once',
        freshnessWindow: 999999,
        trackTrend: false,
        trendWindow: 0,
        affectsRisk: false,
        riskWeight: 0,
        allowedSources: ['onboarding', 'chat_confirmed', 'manual_input'],
        question: 'What is the dose?'
    },
    {
        id: 'medication_adherence',
        category: 'medication',
        name: 'Medication Adherence',
        valueType: 'categorical',
        validation: {
            options: ['always', 'usually', 'sometimes', 'rarely', 'never']
        },
        frequency: 'daily',
        freshnessWindow: 24,
        trackTrend: true,
        trendWindow: 7,
        affectsRisk: true,
        riskWeight: 0.6,
        allowedSources: ['daily_checkin', 'chat_confirmed'],
        question: 'Did you take your medication today?',
        chips: ['Yes', 'No', 'Forgot']
    }
];

// ============================================================================
// MASTER SIGNAL REGISTRY
// ============================================================================

export const SIGNAL_REGISTRY: SignalDefinition[] = [
    ...LIFESTYLE_SIGNALS,
    ...SYMPTOM_SIGNALS,
    ...RED_FLAG_SIGNALS,
    ...VITAL_SIGNALS,
    ...MENTAL_SIGNALS,
    ...REPRODUCTIVE_SIGNALS,
    ...CONTEXT_SIGNALS,
    ...MEDICATION_SIGNALS
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getSignalDefinition(signalId: string): SignalDefinition | undefined {
    return SIGNAL_REGISTRY.find(s => s.id === signalId);
}

export function validateSignalValue(
    signalId: string,
    value: unknown
): { valid: boolean; error?: string } {
    const def = getSignalDefinition(signalId);
    if (!def) return { valid: false, error: 'Unknown signal' };

    switch (def.valueType) {
        case 'numeric':
            if (typeof value !== 'number') return { valid: false, error: 'Must be number' };
            if (def.validation.min !== undefined && value < def.validation.min)
                return { valid: false, error: `Min: ${def.validation.min}` };
            if (def.validation.max !== undefined && value > def.validation.max)
                return { valid: false, error: `Max: ${def.validation.max}` };
            break;

        case 'categorical':
            if (!def.validation.options?.includes(value as string))
                return { valid: false, error: 'Invalid option' };
            break;

        case 'boolean':
            if (typeof value !== 'boolean') return { valid: false, error: 'Must be boolean' };
            break;

        case 'severity':
            if (typeof value !== 'number' || value < 1 || value > 10)
                return { valid: false, error: 'Must be 1-10' };
            break;
    }

    return { valid: true };
}

export function filterSignalsByContext(
    signals: SignalDefinition[],
    userContext: { gender?: string; age?: number }
): SignalDefinition[] {
    return signals.filter(signal => {
        if (signal.contextRules?.requiresGender) {
            if (userContext.gender !== signal.contextRules.requiresGender) {
                return false;
            }
        }

        if (signal.contextRules?.requiresAge) {
            const { min, max } = signal.contextRules.requiresAge;
            if (userContext.age) {
                if (min && userContext.age < min) return false;
                if (max && userContext.age > max) return false;
            }
        }

        return true;
    });
}

export function getDeviceMappedSignals(platform: 'ios' | 'android'): SignalDefinition[] {
    return SIGNAL_REGISTRY.filter(s => {
        if (platform === 'ios') return s.deviceMapping?.ios;
        if (platform === 'android') return s.deviceMapping?.android;
        return false;
    });
}

export function getSignalsByCategory(category: SignalCategory): SignalDefinition[] {
    return SIGNAL_REGISTRY.filter(s => s.category === category);
}

export function getSignalsBySource(source: SignalSource): SignalDefinition[] {
    return SIGNAL_REGISTRY.filter(s => s.allowedSources.includes(source));
}

// ============================================================================
// SIGNAL INSTANCE HELPERS
// ============================================================================

/**
 * Create a new SignalInstance with proper defaults
 */
export function createSignalInstance(
    params: Omit<SignalInstance, 'id' | 'createdAt' | 'confidence'> & {
        confidence?: number;
    }
): SignalInstance {
    const confidence = params.confidence ?? SOURCE_CONFIDENCE[params.source];

    return {
        id: Crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        confidence,
        ...params,
    };
}

/**
 * Check if a signal instance has sufficient confidence for a given operation
 */
export function hasMinimumConfidence(
    instance: SignalInstance,
    operation: keyof typeof CONFIDENCE_THRESHOLDS
): boolean {
    return instance.confidence >= CONFIDENCE_THRESHOLDS[operation];
}

/**
 * Filter instances by minimum confidence threshold
 */
export function filterByConfidence(
    instances: SignalInstance[],
    operation: keyof typeof CONFIDENCE_THRESHOLDS
): SignalInstance[] {
    return instances.filter(i => hasMinimumConfidence(i, operation));
}

/**
 * Get the most recent instance of a signal for a user
 */
export function getLatestInstance(
    instances: SignalInstance[],
    signalId: string
): SignalInstance | undefined {
    return instances
        .filter(i => i.signalId === signalId && !i.isDeleted)
        .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
}

/**
 * Check if a signal instance is still fresh based on its definition
 */
export function isSignalFresh(instance: SignalInstance): boolean {
    const def = getSignalDefinition(instance.signalId);
    if (!def) return false;

    const capturedTime = new Date(instance.capturedAt).getTime();
    const now = Date.now();
    const freshnessMs = def.freshnessWindow * 60 * 60 * 1000; // hours to ms

    return now - capturedTime < freshnessMs;
}

/**
 * Compute weighted risk contribution from a signal instance
 */
export function computeRiskContribution(instance: SignalInstance): number {
    const def = getSignalDefinition(instance.signalId);
    if (!def || !def.affectsRisk) return 0;

    // Risk = riskWeight × confidence × value_normalized
    // This is a simplified formula; actual implementation may vary
    const riskWeight = def.riskWeight ?? 0;
    const confidence = instance.confidence;

    return riskWeight * confidence;
}

// ============================================================================
// AI PROPOSAL HELPERS
// ============================================================================

/**
 * Create an AI proposal that requires user confirmation
 */
export function createAIProposal(
    params: Omit<AISignalProposal, 'id' | 'createdAt' | 'status'>
): AISignalProposal {
    return {
        id: Crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        status: 'pending',
        ...params,
    };
}

/**
 * Convert a confirmed AI proposal to a SignalInstance
 */
export function proposalToInstance(
    proposal: AISignalProposal,
    context?: SignalContext
): SignalInstance {
    return createSignalInstance({
        userId: proposal.userId,
        signalId: proposal.signalId,
        value: proposal.proposedValue,
        source: 'chat_confirmed', // User confirmed the AI proposal
        capturedAt: new Date().toISOString(),
        context,
        aiProposalId: proposal.id,
        // AI proposals get a confidence boost when user confirms
        confidence: Math.min(proposal.aiConfidence + 0.2, SOURCE_CONFIDENCE.chat_confirmed),
    });
}

// ============================================================================
// EMERGENCY MODE CONSTANTS
// ============================================================================

export const EMERGENCY_MODE_CONFIG = {
    COOLING_OFF_PERIOD_HOURS: 1,
    DISCLAIMER_TEXT: `⚠️ IMPORTANT DISCLAIMER

By disabling Emergency Mode, you accept full responsibility for your health condition.

Curable is NOT liable for any consequences that may result from:
• Delaying medical treatment
• Self-diagnosing your condition  
• Not seeking professional medical care

Emergency Mode was activated because your symptoms require immediate medical attention. Only proceed if you have consulted a medical professional.`,

    EMERGENCY_BANNER_TEXT: '🚨 EMERGENCY DETECTED - MEDICAL ATTENTION REQUIRED',

    BLOCKED_MODES_DURING_EMERGENCY: ['daily_checkin', 'diagnosis'] as Mode[],

    AI_EMERGENCY_RESPONSE: 'I cannot provide diagnosis or advice in emergency mode. Please consult a doctor immediately or visit the nearest hospital. I can only help you find nearby medical facilities.'
};

// Red flag signal IDs that trigger emergency mode
export const RED_FLAG_SIGNAL_IDS = RED_FLAG_SIGNALS.map(s => s.id);
