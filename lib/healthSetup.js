import AppleHealthKit from 'react-native-health';

const permissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.BasalEnergyBurned, // Resting energy
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.HeartRateVariability,
      AppleHealthKit.Constants.Permissions.RestingHeartRate,
      AppleHealthKit.Constants.Permissions.WalkingHeartRateAverage,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.WalkingAsymmetryPercentage,
      AppleHealthKit.Constants.Permissions.DoubleSupportTime,
      AppleHealthKit.Constants.Permissions.HeadphoneAudioExposure,
    ],
  },
};


// Initialize HealthKit
export const setupHealthKit = () => {
  AppleHealthKit.initHealthKit(permissions, (error) => {
    if (error) {
      console.log('[ERROR] Cannot grant permissions:', error);
      return;
    }

    console.log('✅ HealthKit permissions granted!');
  });
};
