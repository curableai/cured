// lib/uploadHealthData.js
import { supabase } from './supabaseClient';

export const uploadHealthData = async (userId, data) => {
  const { error } = await supabase.from('health_metrics').insert([
    {
      user_id: userId,
      steps: data.steps,
      active_energy: data.activeEnergy,
      resting_energy: data.restingEnergy,
      walking_asymmetry: data.walkingAsymmetry,
      double_support_time: data.doubleSupportTime,
      headphone_audio_level: data.headphoneAudioLevel,
      heart_rate: data.heartRate,
      heart_rate_variability: data.heartRateVariability,
      resting_heart_rate: data.restingHeartRate,
      walking_heart_rate_average: data.walkingHeartRateAverage,
      sleep_start: data.sleep?.start,
      sleep_end: data.sleep?.end,
      sleep_duration_hours: data.sleep?.durationHours,
      timestamp: new Date(),
    },
  ]);

  if (error) {
    console.error('❌ Supabase upload error:', error);
  } else {
    console.log('✅ Health data uploaded to Supabase');
  }
};
