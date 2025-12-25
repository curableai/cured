// lib/healthDataSync.ts
import { checkHealthInstantly } from './instantHealthMonitoring';
import { supabase } from './supabaseClient';

/**
 * Sync health data and IMMEDIATELY check for anomalies
 */
export async function syncHealthDataWithInstantCheck(
  userId: string,
  healthData: {
    heart_rate?: number;
    resting_heart_rate?: number;
    blood_pressure_systolic?: number;
    blood_pressure_diastolic?: number;
    sleep_hours?: number;
    sleep_quality?: number;
    steps?: number;
    body_temperature?: number;
    blood_oxygen?: number;
    mood_score?: number;
    stress_level?: number;
    energy_level?: number;
    [key: string]: any;
  },
  source: 'manual' | 'wearable' | 'api' | 'device' = 'manual'
): Promise<boolean> {
  try {
    console.log('💾 Syncing health data...');

    // Step 1: Save to database
    const { data: savedMetric, error } = await supabase
      .from('health_metrics')
      .insert({
        user_id: userId,
        ...healthData,
        source,
        recorded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving health data:', error);
      return false;
    }

    console.log('✅ Health data saved');

    // Step 2: INSTANTLY check for anomalies
    console.log('⚡ Running INSTANT anomaly check...');
    const { anomaliesDetected, questionsAsked } = await checkHealthInstantly(userId);

    if (anomaliesDetected > 0) {
      console.log(`🚨 ${anomaliesDetected} anomalies detected!`);
      console.log(`💬 ${questionsAsked} questions sent to user`);
    } else {
      console.log('✅ All metrics normal');
    }

    return true;
  } catch (error) {
    console.error('Error in health data sync:', error);
    return false;
  }
}

/**
 * Batch sync multiple health records (e.g., from wearable)
 */
export async function batchSyncHealthData(
  userId: string,
  healthRecords: Array<{
    data: any;
    recorded_at: string;
    source?: string;
  }>
): Promise<void> {
  try {
    console.log(`💾 Batch syncing ${healthRecords.length} records...`);

    // Insert all records
    const records = healthRecords.map(record => ({
      user_id: userId,
      ...record.data,
      source: record.source || 'wearable',
      recorded_at: record.recorded_at,
    }));

    const { error } = await supabase
      .from('health_metrics')
      .insert(records);

    if (error) throw error;

    console.log('✅ Batch sync complete');

    // Run anomaly check after batch
    await checkHealthInstantly(userId);
  } catch (error) {
    console.error('Error in batch sync:', error);
  }
}

/**
 * Manual health check-in with instant feedback
 */
export async function manualHealthCheckIn(
  userId: string,
  checkInData: {
    mood_score?: number;
    stress_level?: number;
    energy_level?: number;
    sleep_hours?: number;
    sleep_quality?: number;
    notes?: string;
  }
): Promise<{
  success: boolean;
  anomaliesFound: number;
  message: string;
}> {
  try {
    console.log('📝 Manual check-in...');

    // Save check-in data
    const success = await syncHealthDataWithInstantCheck(
      userId,
      checkInData,
      'manual'
    );

    if (!success) {
      return {
        success: false,
        anomaliesFound: 0,
        message: 'Failed to save check-in data',
      };
    }

    // Get any new questions that were generated
    const { data: newQuestions } = await supabase
      .from('contextual_questions')
      .select('id')
      .eq('user_id', userId)
      .is('user_answer', null)
      .gte('asked_at', new Date(Date.now() - 60000).toISOString()); // Last minute

    const anomaliesFound = newQuestions?.length || 0;

    return {
      success: true,
      anomaliesFound,
      message: anomaliesFound > 0
        ? `Check-in saved! I have ${anomaliesFound} question${anomaliesFound > 1 ? 's' : ''} for you.`
        : 'Check-in saved! Everything looks good.',
    };
  } catch (error) {
    console.error('Error in manual check-in:', error);
    return {
      success: false,
      anomaliesFound: 0,
      message: 'Error processing check-in',
    };
  }
}