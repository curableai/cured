/**
 * lib/nutritionIntelligence.ts
 * 
 * Analyzes health signals and medications to provide
 * precision nutrition suggestions and "swaps".
 */

import { supabase } from './supabaseClient';

export interface NutritionSwap {
    trigger: string;
    suggestion: string;
    reason: string;
    severity: 'info' | 'caution' | 'urgent';
}

class NutritionIntelligence {
    /**
     * Analyzes current health state to suggest dietary adjustments
     */
    async getNutritionalSwaps(userId: string): Promise<NutritionSwap[]> {
        const swaps: NutritionSwap[] = [];

        // 1. Fetch recent signals and medications
        const { data: medications } = await supabase
            .from('medications')
            .select('*')
            .eq('user_id', userId);

        // Logic Example: High Sodium + Hypertension med
        const hasHypertensionMed = medications?.some(m =>
            (m?.name || '').toLowerCase().includes('lisinopril') ||
            (m?.name || '').toLowerCase().includes('amlodipine')
        );

        if (hasHypertensionMed) {
            swaps.push({
                trigger: 'High Blood Pressure Medication',
                suggestion: 'Swap high-sodium snacks (chips) for unsalted nuts or fresh celery.',
                reason: 'Excess salt counteracts your hypertension medication and increases fluid retention.',
                severity: 'caution'
            });
        }

        // Logic Example: Potassium-sparing diuretics
        const hasPotassiumSparingMed = medications?.some(m =>
            (m?.name || '').toLowerCase().includes('spironolactone')
        );

        if (hasPotassiumSparingMed) {
            swaps.push({
                trigger: 'Potassium Influence',
                suggestion: 'Monitor intake of high-potassium foods like bananas and spinach.',
                reason: 'Your current medication keeps potassium in your body; too much can be dangerous for your heart rate.',
                severity: 'caution'
            });
        }

        return swaps;
    }
}

export const nutritionIntelligence = new NutritionIntelligence();
