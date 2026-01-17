import { Linking, Platform } from 'react-native';
import {
    getSdkStatus,
    initialize,
    readRecords,
    requestPermission,
    SdkAvailabilityStatus,
} from 'react-native-health-connect';

export { SdkAvailabilityStatus };

export const HEALTH_CONNECT_PACKAGE_NAME =
    'com.google.android.apps.healthdata';

/* -------------------------------------------
   SDK AVAILABILITY
-------------------------------------------- */
export const checkHealthConnectAvailability = async () => {
    if (Platform.OS !== 'android') {
        return SdkAvailabilityStatus.SDK_UNAVAILABLE;
    }

    try {
        return await getSdkStatus();
    } catch (error) {
        console.error('Health Connect availability error:', error);
        return SdkAvailabilityStatus.SDK_UNAVAILABLE;
    }
};

/* -------------------------------------------
   OPEN STORE / SETTINGS
-------------------------------------------- */
export const openHealthConnectStore = () => {
    if (Platform.OS === 'android') {
        Linking.openURL(
            `market://details?id=${HEALTH_CONNECT_PACKAGE_NAME}`
        );
    }
};

export const openHealthConnectSettings = () => {
    if (Platform.OS === 'android') {
        Linking.openSettings();
    }
};

/* -------------------------------------------
   PERMISSIONS
-------------------------------------------- */
export const requestHealthConnectPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return false;

    try {
        await requestPermission([
            { accessType: 'read', recordType: 'Steps' },
            { accessType: 'read', recordType: 'HeartRate' },
            { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
            { accessType: 'read', recordType: 'SleepSession' },
            { accessType: 'read', recordType: 'RespiratoryRate' },
            { accessType: 'read', recordType: 'OxygenSaturation' },
            { accessType: 'read', recordType: 'TotalCaloriesBurned' },
        ]);

        return true;
    } catch (error) {
        console.error('Permission request failed:', error);
        return false;
    }
};

/* -------------------------------------------
   INITIALIZE
-------------------------------------------- */
export const initializeHealthConnect = async () => {
    if (Platform.OS !== 'android') return false;

    try {
        return await initialize();
    } catch (error) {
        console.error('Initialization error:', error);
        return false;
    }
};

/* -------------------------------------------
   READ DAILY HEALTH DATA
-------------------------------------------- */
export const readHealthData = async () => {
    if (Platform.OS !== 'android') return null;

    try {
        const now = new Date();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);

        // For cumulative metrics (Steps, Calories, Sleep), use "Since Midnight"
        const dailyTimeRange = {
            operator: 'between' as const,
            startTime: startOfDay.toISOString(),
            endTime: now.toISOString(),
        };

        // For instantaneous metrics (HR, SpO2, HRV, Resp Rate), use "Last 24h" to find the latest
        // This ensures we get a value even if the user hasn't measured it *today* yet.
        const recentTimeRange = {
            operator: 'between' as const,
            startTime: yesterday.toISOString(),
            endTime: now.toISOString(),
        };

        const [
            steps,
            heartRate,
            hrv,
            sleep,
            respiratoryRate,
            oxygenSaturation,
            calories,
        ] = await Promise.all([
            readRecords('Steps', { timeRangeFilter: dailyTimeRange }),
            readRecords('HeartRate', { timeRangeFilter: recentTimeRange }),
            readRecords('HeartRateVariabilityRmssd', { timeRangeFilter: recentTimeRange }),
            readRecords('SleepSession', { timeRangeFilter: dailyTimeRange }),
            readRecords('RespiratoryRate', { timeRangeFilter: recentTimeRange }),
            readRecords('OxygenSaturation', { timeRangeFilter: recentTimeRange }),
            readRecords('TotalCaloriesBurned', { timeRangeFilter: dailyTimeRange }),
        ]);

        return {
            steps,
            heartRate,
            hrv,
            sleep,
            respiratoryRate,
            oxygenSaturation,
            calories,
        };
    } catch (error) {
        console.error('Error reading health data:', error);
        return null;
    }
};
