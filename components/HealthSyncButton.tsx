// components/HealthSyncButton.tsx
import {
  checkHealthConnectAvailability,
  openHealthConnectStore,
  requestHealthConnectPermissions,
  SdkAvailabilityStatus,
} from '@/lib/healthConnect';
import { requestHealthKitPermissions } from '@/lib/healthkitManager';
import { supabase } from '@/lib/supabaseClient';
import { syncUnifiedHealthData } from '@/lib/unifiedHealthService';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text } from 'react-native';

interface HealthSyncButtonProps {
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
}

export default function HealthSyncButton({
  variant = 'primary',
  fullWidth = false
}: HealthSyncButtonProps) {
  const [syncing, setSyncing] = useState(false);

  const showConnectionGuide = () => {
    Alert.alert(
      'Android Watch Connection Guide',
      '1. Wear OS (Samsung, Pixel): Syncs directly to Health Connect.\n\n' +
      '2. Other Watches (Oraimo, Fitbit, etc): Connect your watch app (e.g., Oraimo Health) to Google Fit, then link Google Fit to Health Connect.\n\n' +
      '3. Ensure all permissions are on in the Health Connect app.',
      [{ text: 'Got it' }]
    );
  };

  const handleSync = async () => {
    setSyncing(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'Please sign in to sync health data');
        return;
      }

      // Android Pre-checks
      if (Platform.OS === 'android') {
        const status = await checkHealthConnectAvailability();

        if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
          Alert.alert(
            'Health Connect Required',
            'To sync your watch, you need to install the Google Health Connect app. Most watches (Samsung, Google Pixel, Oraimo) sync through this hub.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'How to Connect?', onPress: showConnectionGuide },
              { text: 'Install App', onPress: () => openHealthConnectStore() }
            ]
          );
          return;
        }

        if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
          Alert.alert(
            'Update Required',
            'Please update Health Connect in the Play Store to continue.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Update', onPress: () => openHealthConnectStore() }
            ]
          );
          return;
        }
      }

      // Try to sync data
      const success = await syncUnifiedHealthData(user.id);

      if (success) {
        Alert.alert('Success', 'Health data synced successfully! 🎉');
      } else {
        // If sync failed, might be permissions issue
        const platformName = Platform.OS === 'ios' ? 'Apple Health (HealthKit)' : 'Google Health Connect';

        Alert.alert(
          'Sync Failed',
          `Unable to sync data from ${platformName}. Would you like to check permissions?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'How to Connect?', onPress: showConnectionGuide },
            {
              text: 'Check Permissions',
              onPress: async () => {
                if (Platform.OS === 'ios') {
                  await requestHealthKitPermissions(undefined, true);
                } else {
                  const granted = await requestHealthConnectPermissions();
                  if (!granted) {
                    Alert.alert('Permissions Required', 'Please enable all health permissions in the Health Connect app to sync your data.');
                  }
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Error', 'Failed to sync health data. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' ? styles.buttonPrimary : styles.buttonSecondary,
        fullWidth && styles.buttonFullWidth,
        pressed && styles.buttonPressed,
        syncing && styles.buttonDisabled,
      ]}
      onPress={handleSync}
      disabled={syncing}
    >
      {syncing ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#ffffff' : '#38bdf8'}
          size="small"
        />
      ) : (
        <>
          <Ionicons
            name="sync"
            size={20}
            color={variant === 'primary' ? '#ffffff' : '#38bdf8'}
          />
          <Text style={[
            styles.buttonText,
            variant === 'primary' ? styles.buttonTextPrimary : styles.buttonTextSecondary,
          ]}>
            Sync Health Data
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonSecondary: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#38bdf8',
  },
  buttonFullWidth: {
    width: '100%',
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextPrimary: {
    color: '#ffffff',
  },
  buttonTextSecondary: {
    color: '#38bdf8',
  },
});