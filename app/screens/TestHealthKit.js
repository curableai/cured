import { useEffect } from 'react';
import { Text, View } from 'react-native';
import AppleHealthKit from 'react-native-health';

export default function TestHealthKit() {
  useEffect(() => {
    const permissions = {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.StepCount,
          AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
          AppleHealthKit.Constants.Permissions.RestingHeartRate,
          AppleHealthKit.Constants.Permissions.HeartRate,
          AppleHealthKit.Constants.Permissions.HeartRateVariability,
          AppleHealthKit.Constants.Permissions.SleepAnalysis,
          AppleHealthKit.Constants.Permissions.WalkingAsymmetryPercentage,
          AppleHealthKit.Constants.Permissions.DoubleSupportTime,
          AppleHealthKit.Constants.Permissions.HeadphoneAudioExposure,
          AppleHealthKit.Constants.Permissions.WalkingHeartRateAverage,
        ],
      },
    };

    AppleHealthKit.initHealthKit(permissions, (error) => {
      if (error) {
        console.log('❌ HealthKit Permission Error:', error);
        return;
      }
      console.log('✅ HealthKit permissions granted!');
    });
  }, []);

  return (
    <View style={{ padding: 20 }}>
      <Text>Testing HealthKit permission...</Text>
    </View>
  );
}
