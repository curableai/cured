// app/_layout.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuthStore } from '@/lib/authStore';
import { handleNotificationResponse, requestNotificationPermissions, scheduleDailyCheckin } from '@/lib/checkinNotification';
import { initializeHealthKit } from '@/lib/healthkitManager';
import { supabase } from '@/lib/supabaseClient';
import * as Notifications from 'expo-notifications';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<'patient' | 'doctor' | null>(null);
  const { hasCompletedOnboarding, setHasCompletedOnboarding } = useAuthStore();

  // Initialize app on mount
  useEffect(() => {
    initializeApp();

    // Setup Notifications
    requestNotificationPermissions().then(granted => {
      if (granted) {
        scheduleDailyCheckin();
      }
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      handleNotificationResponse(response, router);
    });

    return () => subscription.remove();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          setIsAuthenticated(true);
          console.log('User signed in, initializing HealthKit');
          await initializeHealthKit(session.user.id);

          // Check if user is a doctor
          const { data: doctor } = await supabase
            .from('doctors')
            .select('id')
            .eq('user_id', session.user.id)
            .single();

          setUserRole(doctor ? 'doctor' : 'patient');

          // Check onboarding status
          const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', session.user.id)
            .single();

          setHasCompletedOnboarding(!!profile?.onboarding_completed);
          console.log('Onboarding status:', !!profile?.onboarding_completed);

        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false);
          setUserRole(null);
          setHasCompletedOnboarding(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const initializeApp = async () => {
    try {
      // Check auth status
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setIsAuthenticated(true);
        console.log('User authenticated, initializing HealthKit');
        await initializeHealthKit(user.id);

        // Check user role (doctor or patient)
        const { data: doctor } = await supabase
          .from('doctors')
          .select('id')
          .eq('user_id', user.id)
          .single();

        setUserRole(doctor ? 'doctor' : 'patient');

        // Check onboarding status
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single();

        setHasCompletedOnboarding(!!profile?.onboarding_completed);
        console.log('App init onboarding status:', !!profile?.onboarding_completed);

      } else {
        setIsAuthenticated(false);
        setUserRole(null);
        setHasCompletedOnboarding(false);
        console.log('No authenticated user');
      }
    } catch (error) {
      console.error('App initialization error:', error);
      setIsAuthenticated(false);
    } finally {
      setIsInitializing(false);
      SplashScreen.hideAsync();
    }
  };

  // Handle navigation based on state
  useEffect(() => {
    if (isInitializing || isAuthenticated === null) {
      return;
    }

    const currentRoute = segments[0];

    // Route authenticated users based on role
    if (isAuthenticated && userRole) {
      const inAuthScreen = currentRoute === 'login';
      const inDoctorGroup = (currentRoute as any) === '(doctor)';
      const inPatientGroup = (currentRoute as any) === '(tabs)';
      const inProfileSetup = currentRoute === 'profile-setup';

      if (userRole === 'doctor') {
        if (inAuthScreen || (!inDoctorGroup && !inProfileSetup)) {
          router.replace('/(doctor)/dashboard' as any);
        }
      } else {
        // Patient Role
        if (!hasCompletedOnboarding) {
          // If not completed onboarding, force to profile-setup
          if (currentRoute !== 'profile-setup') {
            router.replace('/profile-setup');
          }
        } else {
          // Onboarding complete
          if (inAuthScreen || inProfileSetup) {
            router.replace('/ai-assistant');
          } else if (inDoctorGroup) {
            router.replace('/ai-assistant');
          }
        }
      }
    }
    // Unauthenticated users can freely browse the app (index.tsx)
    // They'll be prompted to login when they try to access features
  }, [isInitializing, isAuthenticated, userRole, hasCompletedOnboarding, segments]);

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#FF6B00" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
          {/* Landing page - shown to everyone first */}
          <Stack.Screen
            name="index"
            options={{ gestureEnabled: false }}
          />

          {/* Onboarding - First time users only */}
          <Stack.Screen
            name="onboarding"
            options={{ gestureEnabled: false }}
          />

          {/* Auth screens */}
          <Stack.Screen
            name="login"
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen name="screens/HomeScreen" />

          {/* Profile setup (after first login) */}
          <Stack.Screen name="profile-setup" />

          {/* Patient app */}
          <Stack.Screen
            name="(tabs)"
            options={{ gestureEnabled: false }}
          />

          {/* Doctor portal */}
          <Stack.Screen
            name="(doctor)"
            options={{ gestureEnabled: false }}
          />

          {/* Modal */}
          <Stack.Screen
            name="modal"
            options={{ presentation: 'modal' }}
          />

          {/* Disclaimer */}
          <Stack.Screen
            name="disclaimer"
            options={{ gestureEnabled: false }}
          />

          {/* Daily Check-in Flow */}
          <Stack.Screen
            name="daily-checkin"
            options={{
              gestureEnabled: false, // Prevent swipe back during check-in
              headerShown: false
            }}
          />

          <Stack.Screen
            name="CheckinCompleteScreen"
            options={{
              gestureEnabled: false, // Prevent going back to check-in
              headerShown: false
            }}
          />
        </Stack>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
});