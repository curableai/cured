// lib/healthKitManager.ts
import { supabase } from '@/lib/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

const HEALTHKIT_PERMISSION_PREFIX = '@healthkit_permission_';

export interface HealthData {
  steps: number;
  heartRate: number;
  sleepHours: number;
  bloodPressure: string;
  bloodOxygen?: number;
  activeEnergyBurned?: number;
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
    const value = await AsyncStorage.getItem(key);
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
    await AsyncStorage.setItem(key, 'true');
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
    
    // TODO: Replace with actual HealthKit permission request
    // Example using react-native-health or @kingstinct/react-native-healthkit:
    // 
    // import AppleHealthKit from 'react-native-health';
    // 
    // const permissions = {
    //   permissions: {
    //     read: [
    //       AppleHealthKit.Constants.Permissions.StepCount,
    //       AppleHealthKit.Constants.Permissions.HeartRate,
    //       AppleHealthKit.Constants.Permissions.SleepAnalysis,
    //       AppleHealthKit.Constants.Permissions.BloodPressureSystolic,
    //       AppleHealthKit.Constants.Permissions.BloodPressureDiastolic,
    //       AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
    //     ],
    //     write: [],
    //   },
    // };
    // 
    // return new Promise((resolve) => {
    //   AppleHealthKit.initHealthKit(permissions, (error) => {
    //     if (error) {
    //       console.error('HealthKit init error:', error);
    //       resolve(false);
    //       return;
    //     }
    //     console.log('HealthKit initialized successfully');
    //     resolve(true);
    //   });
    // });

    // Simulate permission request for now
    console.log('HealthKit permissions granted (simulated)');
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
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    // TODO: Replace with actual HealthKit availability check
    // Example:
    // return await AppleHealthKit.isAvailable();
    return true;
  } catch (error) {
    console.error('HealthKit availability check failed:', error);
    return false;
  }
};

/**
 * Fetch health data from HealthKit
 */
export const fetchHealthData = async (): Promise<HealthData | null> => {
  if (Platform.OS !== 'ios') {
    console.log('HealthKit only available on iOS');
    return null;
  }

  try {
    console.log('Fetching HealthKit data...');
    
    // TODO: Replace with actual HealthKit data fetching
    // Example:
    // const options = {
    //   startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    //   endDate: new Date().toISOString(),
    // };
    // 
    // const [steps, heartRate, sleep] = await Promise.all([
    //   AppleHealthKit.getStepCount(options),
    //   AppleHealthKit.getHeartRateSamples(options),
    //   AppleHealthKit.getSleepSamples(options),
    // ]);

    // Simulated data for now
    const mockHealthData: HealthData = {
      steps: Math.floor(Math.random() * 5000) + 5000,
      heartRate: Math.floor(Math.random() * 20) + 60,
      sleepHours: Math.random() * 3 + 6,
      bloodPressure: '120/80',
      activeEnergyBurned: Math.floor(Math.random() * 300) + 200,
      lastUpdated: new Date().toISOString(),
    };

    console.log('Health data fetched successfully');
    return mockHealthData;
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
    console.log('Uploading health data for user:', userId);
    console.log('Health data to upload:', healthData);

    const { data, error } = await supabase.from('health_metrics').insert({
      user_id: userId,
      steps: healthData.steps,
      heart_rate: healthData.heartRate,
      sleep_hours: healthData.sleepHours,
      blood_pressure: healthData.bloodPressure,
      blood_oxygen: healthData.bloodOxygen,
      active_energy_burned: healthData.activeEnergyBurned,
      recorded_at: healthData.lastUpdated,
      created_at: new Date().toISOString(),
    }).select();

    if (error) {
      console.error('Supabase upload error:', error);
      return false;
    }

    console.log('Health data uploaded successfully:', data);
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