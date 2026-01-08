import { supabase } from '@/lib/supabaseClient';
import { clinicalSignalService } from '@/services/clinicalSignalCapture';
import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';
import { secureStoreService } from './secureStoreService';

// Only import native HealthKit if we're not in Expo Go and on iOS
let HealthKit: any = null;
if (Platform.OS === 'ios' && Constants.appOwnership !== 'expo') {
  try {
    HealthKit = require('@kingstinct/react-native-healthkit').default;
  } catch (e) {
    console.warn('HealthKit module not found. Real data will not be available.');
  }
}

const HEALTHKIT_PERMISSION_PREFIX = 'healthkit_permission_';

export interface HealthData {
  steps: number;
  heartRate: number;
  heartRateVariability: number;
  restingHeartRate: number;
  bloodOxygen: number;
  headphoneAudioLevel: number;
  sleepHours: number;
  activeEnergyBurned: number;
  lastUpdated: string;
}

/**
 * Check if HealthKit permissions have been requested for a specific user
 */
export const hasRequestedHealthKitPermissions = async (userId?: string): Promise<boolean> => {
  try {
    // If no userId provided, get current user
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      userId = user.id;
    }

    const key = `${HEALTHKIT_PERMISSION_PREFIX}${userId}`;
    const value = await secureStoreService.get(key);
    return value === 'true';
  } catch (error) {
    console.error('Error checking HealthKit permission status:', error);
    return false;
  }
};

/**
 * Mark that HealthKit permissions have been requested for a specific user
 */
const setHealthKitPermissionsRequested = async (userId: string): Promise<void> => {
  try {
    const key = `${HEALTHKIT_PERMISSION_PREFIX}${userId}`;
    await secureStoreService.save(key, 'true');
  } catch (error) {
    console.error('Error saving HealthKit permission status:', error);
  }
};

/**
 * Request HealthKit permissions (only if not requested before for this user)
 * Shows a custom alert before requesting to explain why we need permissions
 */
export const requestHealthKitPermissions = async (userId?: string, force: boolean = false): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    console.log('HealthKit only available on iOS');
    return false;
  }

  try {
    // Get userId if not provided
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      userId = user.id;
    }

    // Check if we've already requested permissions for this user
    const hasRequested = await hasRequestedHealthKitPermissions(userId);

    if (hasRequested && !force) {
      console.log('HealthKit permissions already requested for this user');
      return true;
    }

    // Show explanation alert before requesting
    return new Promise((resolve) => {
      Alert.alert(
        'Health Data Access',
        'Curable would like to access your health data from Apple Health to provide personalized insights and track your wellness journey.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: async () => {
              await setHealthKitPermissionsRequested(userId!);
              resolve(false);
            },
          },
          {
            text: 'Allow',
            onPress: async () => {
              const granted = await requestHealthKitPermissionsNative();
              await setHealthKitPermissionsRequested(userId!);
              resolve(granted);
            },
          },
        ],
        { cancelable: false }
      );
    });
  } catch (error) {
    console.error('HealthKit permission request failed:', error);
    return false;
  }
};

/**
 * Native HealthKit permission request
 * TODO: Replace with actual HealthKit library implementation
 */
const requestHealthKitPermissionsNative = async (): Promise<boolean> => {
  try {
    console.log('Requesting HealthKit permissions...');

    if (!HealthKit) {
      console.warn('HealthKit is not available in Expo Go. Real data requires a Development Build.');
      Alert.alert(
        'Real Data Unavailable',
        'Accessing real Apple Watch data requires a Development Build. You are currently using Expo Go, which does not support native HealthKit access.\n\nTo see real data, you will need to create a build using EAS.',
        [{ text: 'OK' }]
      );
      return false;
    }

    const isAvailable = await HealthKit.isHealthDataAvailable();
    if (!isAvailable) {
      console.log('HealthKit not available on this device');
      return false;
    }

    const permissions = [
      'HKQuantityTypeIdentifierStepCount',
      'HKQuantityTypeIdentifierHeartRate',
      'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
      'HKQuantityTypeIdentifierRestingHeartRate',
      'HKQuantityTypeIdentifierOxygenSaturation',
      'HKQuantityTypeIdentifierHeadphoneAudioExposure',
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      'HKCategoryTypeIdentifierSleepAnalysis',
    ];

    const status = await HealthKit.requestAuthorization(permissions as any, []);
    console.log('HealthKit authorization status:', status);
    return true;
  } catch (error) {
    console.error('Native HealthKit permission request failed:', error);
    return false;
  }
};

/**
 * Check if HealthKit is available on this device
 */
export const isHealthKitAvailable = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios' || !HealthKit || Constants.appOwnership === 'expo') {
    return false;
  }

  try {
    return await HealthKit.isHealthDataAvailable();
  } catch (error) {
    console.error('HealthKit availability check failed:', error);
    return false;
  }
};

/**
 * Fetch health data from HealthKit
 */
export const fetchHealthData = async (): Promise<HealthData | null> => {
  if (Platform.OS !== 'ios' || !HealthKit || Constants.appOwnership === 'expo') {
    return null;
  }

  try {
    console.log('Fetching HealthKit data...');
    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Fetch metrics in parallel using string identifiers
    const [
      steps,
      heartRate,
      hrv,
      restingHR,
      bloodOxygen,
      audioLevel,
      sleep,
      energy
    ] = await Promise.all([
      HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierStepCount' as any, { limit: 1000 }),
      HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate' as any, { limit: 1 }),
      HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierHeartRateVariabilitySDNN' as any, { limit: 1 }),
      HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate' as any, { limit: 1 }),
      HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierOxygenSaturation' as any, { limit: 1 }),
      HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierHeadphoneAudioExposure' as any, { limit: 1 }),
      HealthKit.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis' as any, { limit: 100 }),
      HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierActiveEnergyBurned' as any, { limit: 1000 }),
    ]);

    // Aggregate values (filter by today manually for more reliability)
    const totalSteps = (steps as any[])
      .filter((s: any) => new Date(s.startDate) >= startOfDay)
      .reduce((sum: number, s: any) => sum + s.quantity, 0);

    const latestHR = (heartRate as any[])[0]?.quantity || 0;
    const latestHRV = (hrv as any[])[0]?.quantity || 0;
    const latestRestingHR = (restingHR as any[])[0]?.quantity || 0;
    const latestOxygen = ((bloodOxygen as any[])[0]?.quantity || 0) * 100;
    const latestAudio = (audioLevel as any[])[0]?.quantity || 0;

    const totalEnergy = (energy as any[])
      .filter((s: any) => new Date(s.startDate) >= startOfDay)
      .reduce((sum: number, s: any) => sum + s.quantity, 0);

    // Calculate sleep hours for today
    let totalSleepMs = 0;
    (sleep as any[])
      .filter((s: any) => new Date(s.startDate) >= startOfDay)
      .forEach((s: any) => {
        if (s.startDate && s.endDate) {
          totalSleepMs += new Date(s.endDate).getTime() - new Date(s.startDate).getTime();
        }
      });
    const sleepHours = totalSleepMs / (1000 * 60 * 60);

    const data: HealthData = {
      steps: totalSteps,
      heartRate: latestHR,
      heartRateVariability: latestHRV,
      restingHeartRate: latestRestingHR,
      bloodOxygen: latestOxygen,
      headphoneAudioLevel: latestAudio,
      sleepHours: sleepHours,
      activeEnergyBurned: totalEnergy,
      lastUpdated: now.toISOString(),
    };

    console.log('Health data fetched successfully:', data);
    return data;
  } catch (error) {
    console.error('Error fetching health data:', error);
    return null;
  }
};

/**
 * Upload health data to Supabase
 */
export const uploadHealthData = async (
  userId: string,
  healthData: HealthData
): Promise<boolean> => {
  try {
    console.log('Uploading health data as signals:', userId);

    const signals = [
      { id: 'steps_count', value: healthData.steps },
      { id: 'heart_rate', value: healthData.heartRate },
      { id: 'heart_rate_variability', value: healthData.heartRateVariability },
      { id: 'resting_heart_rate', value: healthData.restingHeartRate },
      { id: 'blood_oxygen', value: healthData.bloodOxygen },
      { id: 'headphone_audio_level', value: healthData.headphoneAudioLevel },
      { id: 'sleep_duration', value: healthData.sleepHours },
      { id: 'physical_activity', value: healthData.activeEnergyBurned > 100 ? 'light' : 'none' }, // Simple mapping for now
    ];

    const results = await Promise.all(
      signals.map(s =>
        clinicalSignalService.captureSignal({
          signalId: s.id,
          value: s.value,
          source: 'device_healthkit',
          capturedAt: healthData.lastUpdated
        })
      )
    );

    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      console.warn('Some signals failed to upload:', failed);
    }

    // Also legacy table support if needed, but we should move to signals
    const { error: legacyError } = await supabase.from('health_metrics').insert({
      user_id: userId,
      steps: healthData.steps,
      heart_rate: healthData.heartRate,
      sleep_hours: healthData.sleepHours,
      blood_oxygen: healthData.bloodOxygen,
      active_energy_burned: healthData.activeEnergyBurned,
      recorded_at: healthData.lastUpdated,
    });

    if (legacyError) console.error('Legacy upload error:', legacyError);

    return true;
  } catch (error) {
    console.error('Error uploading health data:', error);
    return false;
  }
};

/**
 * Sync health data (fetch from HealthKit and upload to Supabase)
 */
export const syncHealthData = async (userId: string): Promise<boolean> => {
  try {
    const healthData = await fetchHealthData();

    if (!healthData) {
      console.log('No health data to sync');
      return false;
    }

    const uploaded = await uploadHealthData(userId, healthData);
    return uploaded;
  } catch (error) {
    console.error('Error syncing health data:', error);
    return false;
  }
};

/**
 * Initialize HealthKit on app startup
 * Requests permissions if not already requested
 */
export const initializeHealthKit = async (userId?: string): Promise<void> => {
  try {
    const available = await isHealthKitAvailable();

    if (!available) {
      console.log('HealthKit not available on this device');
      return;
    }

    const hasRequested = await hasRequestedHealthKitPermissions();

    if (!hasRequested) {
      console.log('First time - requesting HealthKit permissions');
      const granted = await requestHealthKitPermissions();

      if (granted && userId) {
        // Fetch and sync initial data
        await syncHealthData(userId);
      }
    } else {
      console.log('HealthKit permissions already requested');

      // Still try to sync data if user has granted permissions
      if (userId) {
        await syncHealthData(userId);
      }
    }
  } catch (error) {
    console.error('HealthKit initialization error:', error);
  }
};