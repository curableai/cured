
export interface ResearchPaper {
    title: string;
    url: string;
    snippet: string;
    date: string;
    source: string;
}

class HealthResearchService {
    /**
     * Search for latest regional medical research and health information
     * Uses OpenAI for analysis and research insights.
     */
    async performDeepSearch(query: string, region?: string): Promise<ResearchPaper[]> {
        console.log(`🔍 [OpenAI Research] Searching: ${query} ${region ? `in ${region}` : ''}`);

        try {
            const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY;
            
            if (!OPENAI_API_KEY) {
                console.error('OpenAI API key not configured');
                return [];
            }

            const regionStr = region ? ` in ${region}` : '';
            const prompt = `Based on your medical knowledge, provide current health research insights for: "${query}"${regionStr}

Return ONLY this JSON format with exactly 3-4 papers:
{
  "papers": [
    {
      "title": "Research Topic Title",
      "snippet": "Brief 1-2 sentence summary of findings",
      "date": "2025-11",
      "source": "Medical Research",
      "url": "https://example.com/research"
    }
  ]
}

Focus on:
- Recent health findings related to the query
- Regional health concerns if specified
- Evidence-based information
- Safety and prevention information`;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'You are a health research assistant with access to current medical knowledge. Return only valid JSON with realistic research insights.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.5,
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) {
                console.error('OpenAI API error:', response.status);
                return [];
            }

            const data = await response.json();
            const text = data?.choices?.[0]?.message?.content || '{"papers":[]}';
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);

            return parsed?.papers || [];
        } catch (err) {
            console.error('Research error:', err);
            return [];
        }
    }
}

export const healthResearchService = new HealthResearchService();
