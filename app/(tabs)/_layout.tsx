import { AnimatedTabIcon } from '@/components/AnimatedTabIcon';
import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

export default function TabLayout() {
  const { colors } = useTheme();
  const [userDisplay, setUserDisplay] = useState('Profile');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: onboarding } = await supabase
        .from('onboarding')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      if (onboarding?.full_name) {
        const nameParts = onboarding.full_name.trim().split(' ');
        if (nameParts.length > 1) {
          // If more than one word, use acronym
          const acronym = nameParts.map((p: string) => p[0]).join('').toUpperCase();
          setUserDisplay(acronym.substring(0, 3)); // Max 3 chars
        } else {
          // If one word, use first 4 chars
          setUserDisplay(nameParts[0].substring(0, 4));
        }
      }
    } catch (error) {
      console.error('Error fetching user for tab:', error);
    }
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF6B00', // Cosmic Orange
        tabBarInactiveTintColor: '#A1A1AA', // Muted Gray

        tabBarStyle: {
          position: 'absolute',
          bottom: 24,
          left: 40,
          right: 40,
          elevation: 0,
          backgroundColor: '#121212', // Slightly elevated black
          borderRadius: 20,
          height: 64,
          paddingBottom: 0,
          paddingTop: 0,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: 'rgba(255, 107, 0, 0.1)',
          display: isKeyboardVisible ? 'none' : 'flex', // Hide when keyboard is visible
        },

        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },

        tabBarIconStyle: {
          marginTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="daily-checkin"
        options={{
          title: 'Log',
          tabBarIcon: ({ color }) => (
            <Ionicons name="calendar" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="ai-assistant"
        options={{
          title: 'Curable AI',
          tabBarStyle: { display: 'none' },
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name={focused ? "ellipse" : "ellipse-outline"}
              size={22}
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="medication/index"
        options={{
          title: 'Meds',
          tabBarIcon: ({ color }) => (
            <Ionicons name="medical" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile/index"
        options={{
          title: userDisplay,
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-circle" size={22} color={color} />
          ),
        }}
      />

      {/* Hide legacy and utility tabs */}
      <Tabs.Screen name="doctors" options={{ href: null }} />
      <Tabs.Screen name="medication" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="predictions" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}

