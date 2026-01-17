import { supabase } from './supabaseClient';

export interface ResearchResult {
    query: string;
    source: string;
    source_url: string;
    year: string;
    confidence: 'high' | 'medium' | 'low';
    findings: string[];
}

export const researchService = {
    /**
     * Performs medical research using specific trusted sources.
     * Only call this when the AI determines it needs evidence-based verification.
     */
    async performResearch(query: string): Promise<ResearchResult | null> {
        try {
            console.log('🔬 Starting medical research for:', query);

            const { data, error } = await supabase.functions.invoke('medical-research', {
                body: { query }
            });

            if (error) {
                console.error('Research function error:', error);
                return null;
            }

            if (!data) {
                console.warn('Research returned no data');
                return null;
            }

            console.log('✅ Research completed:', data);
            return data as ResearchResult;
        } catch (err) {
            console.error('Unexpected error in research service:', err);
            return null;
        }
    }
};
