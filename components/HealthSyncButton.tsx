// components/HealthSyncButton.tsx
import { requestHealthKitPermissions, syncHealthData } from '@/lib/healthkitManager';
import { supabase } from '@/lib/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';

interface HealthSyncButtonProps {
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
}

export default function HealthSyncButton({
  variant = 'primary',
  fullWidth = false
}: HealthSyncButtonProps) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'Please sign in to sync health data');
        return;
      }

      // Try to sync data
      const success = await syncHealthData(user.id);

      if (success) {
        Alert.alert('Success', 'Health data synced successfully! 🎉');
      } else {
        // If sync failed, might be permissions issue
        Alert.alert(
          'Sync Failed',
          'Unable to sync health data. Would you like to check HealthKit permissions?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Check Permissions',
              onPress: async () => {
                await requestHealthKitPermissions(undefined, true);
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