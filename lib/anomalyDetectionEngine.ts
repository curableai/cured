// lib/anomalyDetectionEngine.ts
import { supabase } from './supabaseClient';

// Detection thresholds per metric
const THRESHOLDS = {
  heart_rate: { min: 50, max: 100, changePercent: 15, severity_urgent: 25 },
  resting_heart_rate: { min: 45, max: 90, changePercent: 12, severity_urgent: 20 },
  hrv: { min: 20, max: 100, changePercent: 15, severity_urgent: 25 },
  blood_pressure_systolic: { min: 90, max: 140, changePercent: 10, severity_urgent: 20 },
  blood_pressure_diastolic: { min: 60, max: 90, changePercent: 10, severity_urgent: 20 },
  sleep_hours: { min: 5, max: 10, changePercent: 20, severity_urgent: 35 },
  sleep_quality: { min: 4, max: 10, changePercent: 25, severity_urgent: 40 },
  steps: { min: 2000, max: 20000, changePercent: 30, severity_urgent: 50 },
  body_temperature: { min: 36.0, max: 37.5, changePercent: 2, severity_urgent: 5 },
  blood_oxygen: { min: 92, max: 100, changePercent: 3, severity_urgent: 5 },
  mood_score: { min: 3, max: 10, changePercent: 30, severity_urgent: 50 },
  stress_level: { min: 1, max: 7, changePercent: 40, severity_urgent: 60 },
  energy_level: { min: 3, max: 10, changePercent: 30, severity_urgent: 50 },
};

interface Anomaly {
  metric_name: string;
  baseline_value: number;
  current_value: number;
  change_direction: 'increase' | 'decrease' | 'too_high' | 'too_low';
  change_percent: number;
  severity: 'info' | 'warning' | 'urgent' | 'critical';
  detection_window_days: number;
  baseline_window_days: number;
}

/**
 * Main anomaly detection function
 * Runs for a specific user and detects all anomalies
 */
export async function detectAnomaliesForUser(userId: string): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  try {
    // Get date ranges
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch recent data (last 7 days)
    const { data: recentData, error: recentError } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', userId)
      .gte('recorded_at', sevenDaysAgo.toISOString())
      .order('recorded_at', { ascending: false });

    if (recentError) throw recentError;
    if (!recentData || recentData.length === 0) {
      console.log('No recent data for user:', userId);
      return anomalies;
    }

    // Fetch baseline data (8-37 days ago)
    const { data: baselineData, error: baselineError } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', userId)
      .gte('recorded_at', thirtyDaysAgo.toISOString())
      .lt('recorded_at', sevenDaysAgo.toISOString())
      .order('recorded_at', { ascending: false });

    if (baselineError) throw baselineError;
    if (!baselineData || baselineData.length === 0) {
      console.log('No baseline data for user:', userId);
      return anomalies;
    }

    // Check each metric
    const metrics = Object.keys(THRESHOLDS) as Array<keyof typeof THRESHOLDS>;

    for (const metric of metrics) {
      const anomaly = await detectMetricAnomaly(
        metric,
        recentData,
        baselineData
      );

      if (anomaly) {
        anomalies.push(anomaly);
      }
    }

    console.log(`Detected ${anomalies.length} anomalies for user ${userId}`);
    return anomalies;
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    return anomalies;
  }
}

/**
 * Detect anomaly for a specific metric
 */
async function detectMetricAnomaly(
  metric: keyof typeof THRESHOLDS,
  recentData: any[],
  baselineData: any[]
): Promise<Anomaly | null> {
  // Calculate averages
  const recentAvg = calculateAverage(recentData, metric);
  const baselineAvg = calculateAverage(baselineData, metric);

  if (recentAvg === null || baselineAvg === null) {
    return null; // No data for this metric
  }

  const threshold = THRESHOLDS[metric];
  const changePercent = Math.abs(((recentAvg - baselineAvg) / baselineAvg) * 100);

  // Check 1: Significant change from baseline
  if (changePercent > threshold.changePercent) {
    const direction = recentAvg > baselineAvg ? 'increase' : 'decrease';
    
    // Determine severity
    let severity: Anomaly['severity'] = 'info';
    if (changePercent > threshold.severity_urgent) {
      severity = 'urgent';
    } else if (changePercent > threshold.changePercent * 1.5) {
      severity = 'warning';
    }

    return {
      metric_name: metric,
      baseline_value: parseFloat(baselineAvg.toFixed(2)),
      current_value: parseFloat(recentAvg.toFixed(2)),
      change_direction: direction,
      change_percent: parseFloat(changePercent.toFixed(2)),
      severity,
      detection_window_days: 7,
      baseline_window_days: 30,
    };
  }

  // Check 2: Out of normal range
  if (recentAvg < threshold.min || recentAvg > threshold.max) {
    return {
      metric_name: metric,
      baseline_value: parseFloat(baselineAvg.toFixed(2)),
      current_value: parseFloat(recentAvg.toFixed(2)),
      change_direction: recentAvg < threshold.min ? 'too_low' : 'too_high',
      change_percent: parseFloat(changePercent.toFixed(2)),
      severity: recentAvg < threshold.min * 0.8 || recentAvg > threshold.max * 1.2 
        ? 'critical' 
        : 'warning',
      detection_window_days: 7,
      baseline_window_days: 30,
    };
  }

  return null; // No anomaly detected
}

/**
 * Calculate average for a metric
 */
function calculateAverage(data: any[], metric: string): number | null {
  const values = data
    .map(d => d[metric])
    .filter(v => v !== null && v !== undefined && !isNaN(Number(v)));

  if (values.length === 0) return null;

  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/**
 * Save detected anomalies to database
 */
export async function saveAnomalies(userId: string, anomalies: Anomaly[]): Promise<string[]> {
  const savedIds: string[] = [];

  try {
    for (const anomaly of anomalies) {
      // Check if similar anomaly already exists (within last 24 hours)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data: existing } = await supabase
        .from('health_anomalies')
        .select('id')
        .eq('user_id', userId)
        .eq('metric_name', anomaly.metric_name)
        .eq('status', 'active')
        .gte('detected_at', oneDayAgo.toISOString())
        .single();

      if (existing) {
        console.log(`Anomaly for ${anomaly.metric_name} already exists, skipping`);
        continue;
      }

      // Insert new anomaly
      const { data: saved, error } = await supabase
        .from('health_anomalies')
        .insert({
          user_id: userId,
          ...anomaly,
          detected_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error saving anomaly:', error);
        continue;
      }

      if (saved) {
        savedIds.push(saved.id);
      }
    }

    console.log(`Saved ${savedIds.length} new anomalies for user ${userId}`);
    return savedIds;
  } catch (error) {
    console.error('Error in saveAnomalies:', error);
    return savedIds;
  }
}

/**
 * Get active anomalies for user
 */
export async function getActiveAnomalies(userId: string) {
  try {
    const { data, error } = await supabase
      .from('health_anomalies')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('severity', { ascending: false })
      .order('detected_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching active anomalies:', error);
    return [];
  }
}

/**
 * Mark anomaly as resolved
 */
export async function resolveAnomaly(anomalyId: string, reason?: string) {
  try {
    const { error } = await supabase
      .from('health_anomalies')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', anomalyId);

    if (error) throw error;
    console.log(`Anomaly ${anomalyId} marked as resolved`);
  } catch (error) {
    console.error('Error resolving anomaly:', error);
    throw error;
  }
}

/**
 * Calculate baseline and update database
 */
export async function updateUserBaselines(userId: string) {
  try {
    const metrics = Object.keys(THRESHOLDS) as Array<keyof typeof THRESHOLDS>;

    for (const metric of metrics) {
      const { data, error } = await supabase.rpc('calculate_baseline', {
        p_user_id: userId,
        p_metric: metric,
        p_days: 30,
      });

      if (error) {
        console.error(`Error calculating baseline for ${metric}:`, error);
        continue;
      }

      if (data && data.length > 0 && data[0].baseline !== null) {
        const baseline = data[0];

        // Upsert baseline
        await supabase
          .from('user_baselines')
          .upsert({
            user_id: userId,
            metric_name: metric,
            baseline_value: baseline.baseline,
            min_normal: baseline.min_val,
            max_normal: baseline.max_val,
            std_deviation: baseline.std_dev,
            calculated_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            calculated_to: new Date().toISOString(),
            data_points_count: baseline.data_points,
            calculated_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          }, {
            onConflict: 'user_id,metric_name',
          });
      }
    }

    console.log(`Updated baselines for user ${userId}`);
  } catch (error) {
    console.error('Error updating baselines:', error);
  }
}

/**
 * Run complete anomaly detection flow
 */
export async function runAnomalyDetection(userId: string): Promise<{
  anomalies: Anomaly[];
  savedIds: string[];
}> {
  try {
    console.log(`Running anomaly detection for user ${userId}`);

    // Step 1: Update baselines
    await updateUserBaselines(userId);

    // Step 2: Detect anomalies
    const anomalies = await detectAnomaliesForUser(userId);

    // Step 3: Save new anomalies
    const savedIds = await saveAnomalies(userId, anomalies);

    return { anomalies, savedIds };
  } catch (error) {
    console.error('Error in runAnomalyDetection:', error);
    return { anomalies: [], savedIds: [] };
  }
}