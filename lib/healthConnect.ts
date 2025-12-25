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
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);

        const timeRangeFilter = {
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
            readRecords('Steps', { timeRangeFilter }),
            readRecords('HeartRate', { timeRangeFilter }),
            readRecords('HeartRateVariabilityRmssd', { timeRangeFilter }),
            readRecords('SleepSession', { timeRangeFilter }),
            readRecords('RespiratoryRate', { timeRangeFilter }),
            readRecords('OxygenSaturation', { timeRangeFilter }),
            readRecords('TotalCaloriesBurned', { timeRangeFilter }),
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
