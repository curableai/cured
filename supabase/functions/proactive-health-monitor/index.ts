// supabase/functions/proactive-health-monitor/index.ts
// @ts-ignore: Deno std import used by Supabase Edge Functions; local TS/tsserver may not resolve remote modules.
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
// @ts-ignore: Deno std import used by Supabase Edge Functions; local TS/tsserver may not resolve remote modules.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const denoEnv = (globalThis as any).Deno?.env
const nodeEnv = (globalThis as any).process?.env
const _env: any = denoEnv ?? nodeEnv ?? {}

const supabaseUrl = _env.get ? _env.get('SUPABASE_URL') : _env.SUPABASE_URL
const supabaseKey = _env.get ? _env.get('SUPABASE_SERVICE_ROLE_KEY') : _env.SUPABASE_SERVICE_ROLE_KEY
const openaiKey = _env.get ? _env.get('OPENAI_API_KEY') : _env.OPENAI_API_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

// Thresholds for anomaly detection
const THRESHOLDS = {
  heart_rate: { min: 50, max: 100, changePercent: 15 },
  sleep_hours: { min: 5, max: 10, changePercent: 20 },
  steps: { min: 2000, max: 20000, changePercent: 30 },
  hrv: { min: 20, max: 100, changePercent: 15 },
  mood_score: { min: 1, max: 10, changePercent: 25 },
  body_temperature: { min: 36.0, max: 37.5, changePercent: 2 },
}

serve(async (req: Request) => {
  try {
    console.log('🔍 Starting proactive health monitoring...')

    // Get all active users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('is_active', true)

    if (usersError) throw usersError

    let alertsGenerated = 0

    // Check each user's health data
    for (const user of users || []) {
      const anomalies = await detectAnomalies(user.id)
      
      if (anomalies.length > 0) {
        // Generate AI conversation
        const aiMessage = await generateAIAlert(user, anomalies)
        
        // Send notification and save to contextual_questions
        await sendProactiveAlert(user.id, aiMessage, anomalies)
        alertsGenerated++
      }
    }

    console.log(`✅ Monitoring complete. ${alertsGenerated} alerts generated.`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        usersChecked: users?.length || 0,
        alertsGenerated 
      }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error('❌ Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

/**
 * Detect anomalies in user's health data
 */
async function detectAnomalies(userId: string) {
  const anomalies: any[] = []
  
  // Get last 7 days of data
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Get last 30 days for baseline
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: recentData } = await supabase
    .from('health_metrics')
    .select('*')
    .eq('user_id', userId)
    .gte('recorded_at', sevenDaysAgo.toISOString())
    .order('recorded_at', { ascending: false })

  const { data: baselineData } = await supabase
    .from('health_metrics')
    .select('*')
    .eq('user_id', userId)
    .gte('recorded_at', thirtyDaysAgo.toISOString())
    .lt('recorded_at', sevenDaysAgo.toISOString())
    .order('recorded_at', { ascending: false })

  if (!recentData?.length || !baselineData?.length) {
    return anomalies
  }

  // Check each metric
  const metrics = ['heart_rate', 'sleep_hours', 'steps', 'hrv', 'body_temperature']
  
  for (const metric of metrics) {
    const recentAvg = calculateAverage(recentData, metric)
    const baselineAvg = calculateAverage(baselineData, metric)

    if (recentAvg === null || baselineAvg === null) continue

    const changePercent = Math.abs(((recentAvg - baselineAvg) / baselineAvg) * 100)
    const threshold = THRESHOLDS[metric as keyof typeof THRESHOLDS]

    // Check if change exceeds threshold
    if (changePercent > threshold.changePercent) {
      const direction = recentAvg > baselineAvg ? 'increased' : 'decreased'
      const severity = changePercent > threshold.changePercent * 1.5 ? 'urgent' : 'warning'

      anomalies.push({
        metric,
        baselineValue: baselineAvg.toFixed(1),
        currentValue: recentAvg.toFixed(1),
        changePercent: changePercent.toFixed(1),
        direction,
        severity,
        days: 7,
      })
    }

    // Check if out of normal range
    if (recentAvg < threshold.min || recentAvg > threshold.max) {
      anomalies.push({
        metric,
        baselineValue: baselineAvg.toFixed(1),
        currentValue: recentAvg.toFixed(1),
        changePercent: 0,
        direction: recentAvg < threshold.min ? 'too_low' : 'too_high',
        severity: 'warning',
        days: 7,
      })
    }
  }

  return anomalies
}

/**
 * Calculate average of a metric from data array
 */
function calculateAverage(data: any[], metric: string): number | null {
  const values = data
    .map(d => d[metric])
    .filter(v => v !== null && v !== undefined && !isNaN(v))

  if (values.length === 0) return null
  
  const sum = values.reduce((a, b) => a + b, 0)
  return sum / values.length
}

/**
 * Generate AI alert message using OpenAI
 */
async function generateAIAlert(user: any, anomalies: any[]) {
  const anomalyDescriptions = anomalies.map(a => 
    `${a.metric.replace('_', ' ')} ${a.direction} from ${a.baselineValue} to ${a.currentValue} (${a.changePercent}% change)`
  ).join(', ')

  const otherContext = anomalies.length > 1 
    ? `Other changes: ${anomalies.slice(1).map(a => a.metric).join(', ')}`
    : 'No other significant changes detected'

  const prompt =`Hey! You are Dr. Shaun Murphy, a caring health companion and friend-in-your-pocket. You're warm, conversational, and genuinely interested in the user's wellbeing. Speak naturally, not clinically, in 2-4 sentences max. Use casual language, emojis lightly 🩺❤️🌱, and always check in on how the user is feeling. Never diagnose; always encourage seeing a real doctor if serious.

Here’s some context for your message:
- User name: ${user.full_name || 'there'}
- Recent health changes: ${anomalies.map(a => 
    `${a.metric.replace('_', ' ')} ${a.direction} from ${a.baselineValue} to ${a.currentValue} (${a.changePercent}% change)`
  ).join(', ')}
- Other context: ${anomalies.length > 1 ? `Other changes: ${anomalies.slice(1).map(a => a.metric).join(', ')}` : 'No other significant changes'}

🎯 Your goal:
- Empathetically mention the specific change(s)
- Reference recent patterns naturally
- Ask a friendly folpromptlow-up question to keep conversation going
- Offer 1 quick practical tip if appropriate
- End with encouragement

Generate a short, friendly message for the user that reads like a friend who's also a doctor. MESSAGE:`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are Curable AI, a supportive health assistant. Keep messages brief, warm, and actionable.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    })

    const data = await response.json()
    return data.choices[0].message.content.trim()
  } catch (error) {
    console.error('Error generating AI message:', error)
    
    // Fallback message
    const mainAnomaly = anomalies[0]
    return `Hey ${user.full_name || 'there'}, I noticed your ${mainAnomaly.metric.replace('_', ' ')} ${mainAnomaly.direction} from ${mainAnomaly.baselineValue} to ${mainAnomaly.currentValue} this week. Is everything okay? Let me know if you'd like to discuss this change.`
  }
}

/**
 * Send proactive alert to user
 */
async function sendProactiveAlert(userId: string, message: string, anomalies: any[]) {
  // Save as contextual question
  const { data: question, error: questionError } = await supabase
    .from('contextual_questions')
    .insert({
      user_id: userId,
      question: message,
      context_type: 'proactive_monitoring',
      metric_related: anomalies[0].metric,
      anomaly_data: anomalies,
      asked_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (questionError) {
    console.error('Error saving question:', questionError)
    return
  }

  // Get user's push token
  const { data: userData } = await supabase
    .from('users')
    .select('push_token')
    .eq('id', userId)
    .single()

  if (userData?.push_token) {
    // Send push notification
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: userData.push_token,
        sound: 'default',
        title: '💚 Health Check-in from Curable AI',
        body: message.slice(0, 100) + (message.length > 100 ? '...' : ''),
        data: {
          type: 'proactive_alert',
          questionId: question.id,
          anomalies,
        },
      }),
    })
  }

  console.log(`📬 Alert sent to user ${userId}`)
}