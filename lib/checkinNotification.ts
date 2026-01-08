import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Request permissions
export const requestNotificationPermissions = async (): Promise<boolean> => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return false;
    }

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    return true;
};

// Schedule daily check-in reminder
export const scheduleDailyCheckin = async () => {
    // Cancel existing notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Schedule for 6 PM daily (when check-in feature unlocks)
    await Notifications.scheduleNotificationAsync({
        content: {
            title: "Time to check in! 🌙",
            body: "How did your day go? Log your lifestyle stats now.",
            sound: true,
            data: { screen: 'DailyCheckin' }
        },
        trigger: {
            type: SchedulableTriggerInputTypes.CALENDAR,
            hour: 18,
            minute: 0,
            repeats: true,
        } as any,
    });

    console.log('✓ Daily check-in reminder scheduled for 6:00 PM');
};

// Handle notification tap
export const handleNotificationResponse = (response: Notifications.NotificationResponse, navigation: any) => {
    const screen = response.notification.request.content.data?.screen;

    if (screen === 'DailyCheckin') {
        navigation.navigate('DailyCheckin');
    }
};

// INTEGRATION EXAMPLE - Add this to app/_layout.tsx:
/*
import { requestNotificationPermissions, scheduleDailyCheckin, handleNotificationResponse } from '@/lib/checkinNotification';
import * as Notifications from 'expo-notifications';

// Inside your RootLayout component, add this useEffect:
useEffect(() => {
  requestNotificationPermissions().then(granted => {
    if (granted) {
      scheduleDailyCheckin();
    }
  });
  
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    handleNotificationResponse(response, router); // Use router from expo-router
  });
  
  return () => subscription.remove();
}, []);
*/
