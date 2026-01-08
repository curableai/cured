import { supabase } from './supabaseClient';

/**
 * lib/localAdvisoryService.ts
 * 
 * Provides simple environmental & health advisories based on user profile.
 * Max 3 advisory boxes showing:
 * 1. Environmental (location-based)
 * 2. Condition-based (chronic conditions)
 * 3. Lifestyle-based (smoking, alcohol)
 */

export interface HealthAdvisory {
    id: string;
    type: 'outbreak' | 'environmental' | 'seasonal' | 'public_health' | 'research';
    title: string;
    message: string;
    severity: 'info' | 'caution' | 'warning' | 'urgent';
    region: string;
    affectedSignals: string[]; // e.g., ['fever', 'headache']
    sourceUrl?: string;
}

class LocalAdvisoryService {
    /**
     * Fetch simple environmental & onboarding-based advisories (max 3)
     */
    async getAdvisories(userId: string): Promise<HealthAdvisory[]> {
        try {
            // 1. Fetch user's onboarding data
            const { data: onboarding } = await supabase
                .from('onboarding')
                .select('location, age, chronic_conditions, smoker, alcohol_drinker')
                .eq('user_id', userId)
                .single();

            if (!onboarding) {
                return [];
            }

            const advisories: HealthAdvisory[] = [];

            // 2. Environmental advisory based on location
            const envAdvisory = this.generateEnvironmentalAdvisory(onboarding.location);
            if (envAdvisory) advisories.push(envAdvisory);

            // 3. Condition-specific advisory based on chronic conditions
            if (onboarding.chronic_conditions && onboarding.chronic_conditions.length > 0) {
                const conditionAdvisory = this.generateConditionAdvisory(onboarding.chronic_conditions[0]);
                if (conditionAdvisory) advisories.push(conditionAdvisory);
            }

            // 4. Lifestyle advisory based on smoking/drinking
            const lifestyleAdvisory = this.generateLifestyleAdvisory(onboarding.smoker, onboarding.alcohol_drinker);
            if (lifestyleAdvisory) advisories.push(lifestyleAdvisory);

            return advisories.slice(0, 3); // Max 3 boxes
        } catch (error) {
            console.error('Error fetching advisories:', error);
            return [];
        }
    }

    private generateEnvironmentalAdvisory(location: string): HealthAdvisory | null {
        const advisories: { [key: string]: HealthAdvisory } = {
            'hot': {
                id: 'env_heat',
                type: 'environmental',
                title: '🌡️ Heat Advisory',
                message: 'High temperatures. Stay hydrated and avoid prolonged sun exposure.',
                severity: 'caution',
                region: location || 'Your Area',
                affectedSignals: ['body_temperature', 'heart_rate'],
                sourceUrl: undefined
            },
            'cold': {
                id: 'env_cold',
                type: 'environmental',
                title: '❄️ Cold Weather Alert',
                message: 'Cold temperatures. Dress warmly and monitor for signs of cold-related illness.',
                severity: 'caution',
                region: location || 'Your Area',
                affectedSignals: ['body_temperature'],
                sourceUrl: undefined
            },
            'humid': {
                id: 'env_humid',
                type: 'environmental',
                title: '💧 High Humidity',
                message: 'High humidity levels. Take breaks and stay cool to prevent heat stress.',
                severity: 'info',
                region: location || 'Your Area',
                affectedSignals: ['heart_rate'],
                sourceUrl: undefined
            }
        };

        // Simple location-based mapping
        const locLower = (location || 'general').toLowerCase();
        if (locLower.includes('sahara') || locLower.includes('desert')) return advisories['hot'];
        if (locLower.includes('arctic') || locLower.includes('siberia') || locLower.includes('alaska')) return advisories['cold'];
        
        // Default environmental advisory
        return {
            id: 'env_general',
            type: 'environmental',
            title: '🌍 Environmental Alert',
            message: 'Check local weather and air quality for your region to stay safe.',
            severity: 'info',
            region: location || 'Your Area',
            affectedSignals: ['general_wellbeing'],
            sourceUrl: undefined
        };
    }

    private generateConditionAdvisory(condition: string): HealthAdvisory | null {
        const conditionMap: { [key: string]: HealthAdvisory } = {
            'diabetes': {
                id: 'cond_diabetes',
                type: 'public_health',
                title: '🩺 Diabetes Care',
                message: 'Monitor blood sugar regularly. Stay active and maintain healthy diet.',
                severity: 'warning',
                region: 'Your Health',
                affectedSignals: ['blood_glucose'],
                sourceUrl: undefined
            },
            'hypertension': {
                id: 'cond_hypertension',
                type: 'public_health',
                title: '❤️ Blood Pressure',
                message: 'Check blood pressure regularly. Reduce salt and manage stress.',
                severity: 'warning',
                region: 'Your Health',
                affectedSignals: ['blood_pressure'],
                sourceUrl: undefined
            },
            'asthma': {
                id: 'cond_asthma',
                type: 'public_health',
                title: '💨 Asthma Alert',
                message: 'Monitor air quality. Keep rescue inhaler nearby during high pollen/pollution.',
                severity: 'caution',
                region: 'Your Health',
                affectedSignals: ['respiratory_rate'],
                sourceUrl: undefined
            }
        };

        const key = condition.toLowerCase();
        return conditionMap[key] || null;
    }

    private generateLifestyleAdvisory(smoker: boolean, alcoholDrinker: boolean): HealthAdvisory | null {
        if (smoker) {
            return {
                id: 'lifestyle_smoking',
                type: 'public_health',
                title: '🚭 Smoking Impact',
                message: 'Consider quitting. Smoking affects heart rate, blood pressure, and lung health.',
                severity: 'warning',
                region: 'Your Health',
                affectedSignals: ['heart_rate', 'respiratory_rate'],
                sourceUrl: undefined
            };
        }

        if (alcoholDrinker) {
            return {
                id: 'lifestyle_alcohol',
                type: 'public_health',
                title: '🍷 Alcohol Awareness',
                message: 'Moderate consumption recommended. Monitor hydration and sleep quality.',
                severity: 'caution',
                region: 'Your Health',
                affectedSignals: ['heart_rate', 'sleep_hours'],
                sourceUrl: undefined
            };
        }

        return null;
    }

    /**
     * Simple heuristic to map snippets to signals
     */
    private detectAffectedSignals(text: string): string[] {
        const signals: string[] = [];
        const lowerText = text.toLowerCase();

        if (lowerText.includes('fever')) signals.push('fever', 'body_temperature');
        if (lowerText.includes('headache')) signals.push('headache');
        if (lowerText.includes('abdominal') || lowerText.includes('stomach')) signals.push('abdominal_pain');
        if (lowerText.includes('cough')) signals.push('cough');
        if (lowerText.includes('rash')) signals.push('skin_rash');
        if (lowerText.includes('fatigue') || lowerText.includes('tired')) signals.push('fatigue');

        return signals.length > 0 ? signals : ['general_wellbeing'];
    }

    /**
     * Checks if a user's symptoms match a local advisory
     */
    async matchSymptomsToAdvisories(userId: string, symptoms: string[]): Promise<HealthAdvisory[]> {
        const advisories = await this.getAdvisories(userId);
        return advisories.filter(advisory =>
            advisory.affectedSignals.some(signal => symptoms.includes(signal))
        );
    }
}

export const localAdvisoryService = new LocalAdvisoryService();
