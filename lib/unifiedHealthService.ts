// lib/unifiedHealthService.ts
// Cross-platform health data service - prioritizing Android Health Connect

import {
    checkHealthConnectAvailability,
    initializeHealthConnect,
    readHealthData,
    requestHealthConnectPermissions,
    SdkAvailabilityStatus,
} from '@/lib/healthConnect';
import { fetchHealthData, isHealthKitAvailable } from '@/lib/healthkitManager';
import { supabase } from '@/lib/supabaseClient';
import { Platform } from 'react-native';

export interface HealthMetric {
    id: string;
    label: string;
    value: string | number;
    unit: string;
    icon: string;
    available: boolean;
    source: 'watch' | 'checkin' | 'manual';
}

export interface UnifiedHealthData {
    metrics: HealthMetric[];
    isWatchConnected: boolean;
    lastSyncTime: string | null;
    availableMetricCount: number;
}

/**
 * Get all available health metrics from watch + check-in data
 */
export async function getUnifiedHealthData(userId: string): Promise<UnifiedHealthData> {
    const metrics: HealthMetric[] = [];
    let isWatchConnected = false;
    let lastSyncTime: string | null = null;

    // 1. Try to get watch data (Health Connect on Android)
    if (Platform.OS === 'android') {
        const watchData = await fetchAndroidHealthData();
        if (watchData) {
            isWatchConnected = true;
            lastSyncTime = new Date().toISOString();

            // Heart Rate
            if (watchData.heartRate?.records?.length > 0) {
                const latestHR = watchData.heartRate.records[watchData.heartRate.records.length - 1];
                const bpm = latestHR.samples?.[0]?.beatsPerMinute || 0;
                if (bpm > 0) {
                    metrics.push({
                        id: 'heart_rate',
                        label: 'Heart Rate',
                        value: Math.round(bpm),
                        unit: 'bpm',
                        icon: 'heart-outline',
                        available: true,
                        source: 'watch',
                    });
                }
            }

            // HRV
            if (watchData.hrv?.records?.length > 0) {
                const latestHRV = watchData.hrv.records[watchData.hrv.records.length - 1];
                if (latestHRV.heartRateVariabilityMillis) {
                    metrics.push({
                        id: 'hrv',
                        label: 'HRV',
                        value: Math.round(latestHRV.heartRateVariabilityMillis),
                        unit: 'ms',
                        icon: 'pulse-outline',
                        available: true,
                        source: 'watch',
                    });
                }
            }

            // Steps
            if (watchData.steps?.records?.length > 0) {
                const totalSteps = watchData.steps.records.reduce(
                    (sum: number, record: any) => sum + (record.count || 0),
                    0
                );
                if (totalSteps > 0) {
                    metrics.push({
                        id: 'steps',
                        label: 'Steps',
                        value: totalSteps.toLocaleString(),
                        unit: 'steps',
                        icon: 'walk-outline',
                        available: true,
                        source: 'watch',
                    });
                }
            }

            // SpO2 (Oxygen Saturation)
            if (watchData.oxygenSaturation?.records?.length > 0) {
                const latestSpO2 = watchData.oxygenSaturation.records[watchData.oxygenSaturation.records.length - 1];
                if (latestSpO2.percentage) {
                    metrics.push({
                        id: 'spo2',
                        label: 'SpO2',
                        value: Math.round(latestSpO2.percentage * 100),
                        unit: '%',
                        icon: 'water-outline',
                        available: true,
                        source: 'watch',
                    });
                }
            }

            // Respiratory Rate
            if (watchData.respiratoryRate?.records?.length > 0) {
                const latestRR = watchData.respiratoryRate.records[watchData.respiratoryRate.records.length - 1];
                if (latestRR.rate) {
                    metrics.push({
                        id: 'respiratory_rate',
                        label: 'Resp. Rate',
                        value: Math.round(latestRR.rate),
                        unit: 'brpm',
                        icon: 'fitness-outline',
                        available: true,
                        source: 'watch',
                    });
                }
            }

            // Sleep (convert to hours)
            if (watchData.sleep?.records?.length > 0) {
                let totalSleepMs = 0;
                watchData.sleep.records.forEach((session: any) => {
                    if (session.startTime && session.endTime) {
                        totalSleepMs += new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
                    }
                });
                const sleepHours = totalSleepMs / (1000 * 60 * 60);
                if (sleepHours > 0) {
                    metrics.push({
                        id: 'sleep',
                        label: 'Sleep',
                        value: sleepHours.toFixed(1),
                        unit: 'hrs',
                        icon: 'moon-outline',
                        available: true,
                        source: 'watch',
                    });
                }
            }
        }
    } else if (Platform.OS === 'ios') {
        const watchData = await fetchHealthData();
        if (watchData) {
            isWatchConnected = true;
            lastSyncTime = watchData.lastUpdated;

            // Heart Rate
            if (watchData.heartRate > 0) {
                metrics.push({
                    id: 'heart_rate',
                    label: 'Heart Rate',
                    value: Math.round(watchData.heartRate),
                    unit: 'bpm',
                    icon: 'heart-outline',
                    available: true,
                    source: 'watch',
                });
            }

            // Steps
            if (watchData.steps > 0) {
                metrics.push({
                    id: 'steps',
                    label: 'Steps',
                    value: watchData.steps.toLocaleString(),
                    unit: 'steps',
                    icon: 'walk-outline',
                    available: true,
                    source: 'watch',
                });
            }

            // Sleep
            if (watchData.sleepHours > 0) {
                metrics.push({
                    id: 'sleep',
                    label: 'Sleep',
                    value: watchData.sleepHours.toFixed(1),
                    unit: 'hrs',
                    icon: 'moon-outline',
                    available: true,
                    source: 'watch',
                });
            }

            // SpO2
            if (watchData.bloodOxygen && watchData.bloodOxygen > 0) {
                metrics.push({
                    id: 'spo2',
                    label: 'SpO2',
                    value: Math.round(watchData.bloodOxygen * 100),
                    unit: '%',
                    icon: 'water-outline',
                    available: true,
                    source: 'watch',
                });
            }

            // Active Energy
            if (watchData.activeEnergyBurned && watchData.activeEnergyBurned > 0) {
                metrics.push({
                    id: 'calories',
                    label: 'Calories',
                    value: Math.round(watchData.activeEnergyBurned),
                    unit: 'kcal',
                    icon: 'flame-outline',
                    available: true,
                    source: 'watch',
                });
            }

            // Blood Pressure (Removed from Watch source as per user request)
        }
    }

    /* 
    // 2. Get BP from daily check-in (signals table)
    const bpData = await fetchBPFromCheckin(userId);
    if (bpData) {
        metrics.push({
            id: 'blood_pressure',
            label: 'Blood Pressure',
            value: bpData,
            unit: 'mmHg',
            icon: 'thermometer-outline',
            available: true,
            source: 'checkin',
        });
    }
    */

    // 3. Add other watch-specific metrics for Apple Watch
    if (Platform.OS === 'ios' && isWatchConnected) {
        const watchData = await fetchHealthData();
        if (watchData) {
            // Heart Rate Variability
            if (watchData.heartRateVariability > 0) {
                metrics.push({
                    id: 'hrv',
                    label: 'HRV',
                    value: Math.round(watchData.heartRateVariability),
                    unit: 'ms',
                    icon: 'pulse-outline',
                    available: true,
                    source: 'watch',
                });
            }

            // Resting Heart Rate
            if (watchData.restingHeartRate > 0) {
                metrics.push({
                    id: 'resting_hr',
                    label: 'Resting HR',
                    value: Math.round(watchData.restingHeartRate),
                    unit: 'bpm',
                    icon: 'heart-half-outline',
                    available: true,
                    source: 'watch',
                });
            }

            // Headphone Audio Level
            if (watchData.headphoneAudioLevel > 0) {
                metrics.push({
                    id: 'audio_level',
                    label: 'Audio Level',
                    value: Math.round(watchData.headphoneAudioLevel),
                    unit: 'dB',
                    icon: 'headset-outline',
                    available: true,
                    source: 'watch',
                });
            }
        }
    }

    return {
        metrics,
        isWatchConnected,
        lastSyncTime,
        availableMetricCount: metrics.filter(m => m.available).length,
    };
}

/**
 * Fetch health data from Android Health Connect
 */
async function fetchAndroidHealthData() {
    try {
        const status = await checkHealthConnectAvailability();
        if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
            console.log('[HealthConnect] SDK not available, status:', status);
            return null;
        }

        const initialized = await initializeHealthConnect();
        if (!initialized) {
            console.log('[HealthConnect] Failed to initialize');
            return null;
        }

        // Request permissions if needed
        const hasPermissions = await requestHealthConnectPermissions();
        if (!hasPermissions) {
            console.log('[HealthConnect] Permissions not granted');
            return null;
        }

        const data = await readHealthData();
        console.log('[HealthConnect] Data fetched:', Object.keys(data || {}));
        return data;
    } catch (error) {
        console.error('[HealthConnect] Error fetching data:', error);
        return null;
    }
}

/**
 * Fetch Blood Pressure from daily check-in signals
 */
async function fetchBPFromCheckin(userId: string): Promise<string | null> {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Check for BP systolic signal
        const { data: systolicData } = await supabase
            .from('signals')
            .select('value')
            .eq('user_id', userId)
            .eq('signal_id', 'blood_pressure_systolic')
            .gte('created_at', todayStart.toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

        const { data: diastolicData } = await supabase
            .from('signals')
            .select('value')
            .eq('user_id', userId)
            .eq('signal_id', 'blood_pressure_diastolic')
            .gte('created_at', todayStart.toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

        if (systolicData?.[0]?.value && diastolicData?.[0]?.value) {
            return `${systolicData[0].value}/${diastolicData[0].value}`;
        }

        return null;
    } catch (error) {
        console.error('[BP Checkin] Error:', error);
        return null;
    }
}

/**
 * Check if Health Connect is available and configured
 */
export async function isHealthServiceAvailable(): Promise<boolean> {
    if (Platform.OS === 'android') {
        const status = await checkHealthConnectAvailability();
        return status === SdkAvailabilityStatus.SDK_AVAILABLE;
    }
    if (Platform.OS === 'ios') {
        return await isHealthKitAvailable();
    }
    return false;
}
/**
 * Sync health data for any platform (iOS/Android)
 */
export async function syncUnifiedHealthData(userId: string): Promise<boolean> {
    if (Platform.OS === 'android') {
        const watchData = await fetchAndroidHealthData();
        if (!watchData) return false;
        return await captureAndroidSignals(userId, watchData);
    } else if (Platform.OS === 'ios') {
        const { syncHealthData } = require('./healthkitManager');
        return await syncHealthData(userId);
    }
    return false;
}

/**
 * Capture clinical signals from Android health data
 */
async function captureAndroidSignals(userId: string, data: any): Promise<boolean> {
    try {
        const now = new Date().toISOString();
        const signals = [];

        // Steps
        if (data.steps?.records?.length > 0) {
            const totalSteps = data.steps.records.reduce((sum: number, r: any) => sum + (r.count || 0), 0);
            signals.push({ id: 'steps_count', value: totalSteps });
        }

        // Heart Rate
        if (data.heartRate?.records?.length > 0) {
            const latestHR = data.heartRate.records[data.heartRate.records.length - 1];
            const bpm = latestHR.samples?.[0]?.beatsPerMinute || 0;
            if (bpm > 0) signals.push({ id: 'heart_rate', value: Math.round(bpm) });
        }

        // HRV
        if (data.hrv?.records?.length > 0) {
            const latestHRV = data.hrv.records[data.hrv.records.length - 1];
            if (latestHRV.heartRateVariabilityMillis) {
                signals.push({ id: 'heart_rate_variability', value: Math.round(latestHRV.heartRateVariabilityMillis) });
            }
        }

        // SpO2
        if (data.oxygenSaturation?.records?.length > 0) {
            const latestSpO2 = data.oxygenSaturation.records[data.oxygenSaturation.records.length - 1];
            if (latestSpO2.percentage) {
                signals.push({ id: 'blood_oxygen', value: Math.round(latestSpO2.percentage * 100) });
            }
        }

        // Sleep
        if (data.sleep?.records?.length > 0) {
            let totalSleepMs = 0;
            data.sleep.records.forEach((s: any) => {
                if (s.startTime && s.endTime) {
                    totalSleepMs += new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
                }
            });
            const sleepHours = totalSleepMs / (1000 * 60 * 60);
            if (sleepHours > 0) signals.push({ id: 'sleep_duration', value: sleepHours });
        }

        const { clinicalSignalService } = require('@/services/clinicalSignalCapture');
        await Promise.all(
            signals.map(s =>
                clinicalSignalService.captureSignal({
                    signalId: s.id,
                    value: s.value,
                    source: 'device_health_connect',
                    capturedAt: now
                })
            )
        );

        return true;
    } catch (error) {
        console.error('[HealthConnect] Signal capture error:', error);
        return false;
    }
}
