// supabase/functions/medical-research/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { query } = await req.json()

        // Support both env var names for flexibility
        const apiKey = Deno.env.get('OPENAI_API_KEY')

        if (!apiKey) {
            throw new Error('Missing OpenAI API Key (OPENAI_API_KEY)')
        }

        console.log(`🔍 Researching with OpenAI: ${query}`)

        const systemPrompt = `
      You are a specialized medical research assistant. 
      Your goal is to answer the user's query using ONLY trusted medical sources.
      
      Trusted Sources (ONLY):
      - WHO (World Health Organization)
      - NCDC (Nigeria CDC)
      - PubMed (NIH database)
      - NIH (National Institutes of Health)
      - CDC (Centers for Disease Control)

      Instructions:
      1. Search your internal knowledge base specifically for information from these sources.
      2. Do NOT use blogs, news sites, Wikipedia, or forum discussions.
      3. If no information is found from these sources, state that clearly.
      4. Format your response into the specified JSON structure.

      Return EXACTLY this JSON structure (no markdown formatting, just raw JSON):
      {
        "query": "${query}",
        "source": "Source Name (e.g., WHO)",
        "source_url": "URL to the source (if precise match known) or general domain (e.g., https://www.who.int)",
        "year": "Year of data (e.g., 2024)",
        "confidence": "high|medium|low",
        "findings": [
          "Short fact 1 (max 1 sentence)",
          "Short fact 2 (max 1 sentence)",
          "Short fact 3 (optional)"
        ]
      }
    `

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o', // Capable model for research
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: query }
                ],
                temperature: 0.3, // Lower temperature for accuracy
                response_format: { type: 'json_object' }
            })
        })

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API Error:', errorText);
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json()
        const text = data.choices[0].message.content

        let parsedResult
        try {
            parsedResult = JSON.parse(text)
        } catch (e) {
            console.error('Failed to parse JSON:', text)
            parsedResult = {
                query,
                source: "AI Knowledge Base",
                source_url: "",
                year: new Date().getFullYear().toString(),
                confidence: "low",
                findings: ["Could not retrieve structured research data. Please consult a doctor."]
            }
        }

        return new Response(
            JSON.stringify(parsedResult),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )

    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
    }
})
