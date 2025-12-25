// lib/theme.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { create } from 'zustand';

// Theme Types
export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'blue' | 'green' | 'purple' | 'orange';

interface ThemeState {
    mode: ThemeMode;
    accent: AccentColor;
    setMode: (mode: ThemeMode) => void;
    setAccent: (accent: AccentColor) => void;
    loadTheme: () => Promise<void>;
}

// Accent color palettes
export const ACCENTS = {
    blue: {
        primary: '#3B82F6',
        primaryDark: '#1D4ED8',
        primaryLight: '#93C5FD',
        primaryBg: '#EFF6FF',
    },
    green: {
        primary: '#10B981',
        primaryDark: '#059669',
        primaryLight: '#6EE7B7',
        primaryBg: '#ECFDF5',
    },
    purple: {
        primary: '#8B5CF6',
        primaryDark: '#6D28D9',
        primaryLight: '#C4B5FD',
        primaryBg: '#F5F3FF',
    },
    orange: {
        primary: '#FF6B00', // Cosmic Orange
        primaryDark: '#CC5500',
        primaryLight: '#FF8533',
        primaryBg: 'rgba(255, 107, 0, 0.1)',
    },
};

// Base colors for light/dark modes
// Note: Per the brief, the app is primarily BLACK background.
const LIGHT_COLORS = {
    background: '#FFFFFF',
    surface: '#F8F9FA',
    surfaceElevated: '#FFFFFF',
    text: '#000000',
    textMuted: '#4B5563',
    textLight: '#9CA3AF',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    inputBg: '#F8F9FA',
    error: '#EF4444',
    errorBg: '#FEF2F2',
    success: '#10B981',
    successBg: '#ECFDF5',
    warning: '#FF6B00',
    warningBg: '#FFF7ED',
    overlay: 'rgba(0,0,0,0.5)',
};

const DARK_COLORS = {
    background: '#000000', // Pure Black
    surface: '#0A0A0A',   // Very dark gray for soft depth
    surfaceElevated: '#121212',
    text: '#FFFFFF',      // Pure White
    textMuted: '#A1A1AA', // Calm muted text
    textLight: '#52525B',
    border: '#FF6B00',    // Cosmic Orange borders for active/important elements
    borderLight: '#27272A',
    inputBg: '#0A0A0A',
    error: '#EF4444',
    errorBg: '#450A0A',
    success: '#10B981',
    successBg: '#064E3B',
    warning: '#FF6B00',
    warningBg: '#431407',
    overlay: 'rgba(0,0,0,0.8)',
};

// Zustand store for theme
export const useThemeStore = create<ThemeState>((set) => ({
    mode: 'system',
    accent: 'orange', // Default to Cosmic Orange
    setMode: async (mode) => {
        set({ mode });
        await AsyncStorage.setItem('@curable_theme_mode', mode);
    },
    setAccent: async (accent) => {
        set({ accent });
        await AsyncStorage.setItem('@curable_theme_accent', accent);
    },
    loadTheme: async () => {
        try {
            const [mode, accent] = await Promise.all([
                AsyncStorage.getItem('@curable_theme_mode'),
                AsyncStorage.getItem('@curable_theme_accent'),
            ]);
            set({
                mode: (mode as ThemeMode) || 'system',
                accent: (accent as AccentColor) || 'orange',
            });
        } catch (e) {
            console.error('Failed to load theme:', e);
        }
    },
}));

// Hook to get current theme colors
export function useTheme() {
    const systemScheme = useColorScheme();
    const { mode, accent } = useThemeStore();

    const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
    // Ensure we default to DARK experience as requested in the brief
    const activeIsDark = true; // Overriding to force dark-first medical interface
    const baseColors = DARK_COLORS;
    const accentColors = ACCENTS[accent];

    return {
        isDark: activeIsDark,
        colors: {
            ...baseColors,
            ...accentColors,
            // Computed colors for the medical interface
            primaryGradient: [accentColors.primary, accentColors.primary] as [string, string], // No gradients per brief
            cardShadow: 'transparent',
        },
        accent,
        mode,
    };
}

// ============================================================
// USAGE EXAMPLE IN COMPONENT:
// ============================================================
// import { useTheme, useThemeStore } from '@/lib/theme';
//
// export default function MyScreen() {
//   const { colors, isDark } = useTheme();
//   const { setMode, setAccent } = useThemeStore();
//
//   return (
//     <View style={{ backgroundColor: colors.background }}>
//       <Text style={{ color: colors.text }}>Hello</Text>
//       <Button onPress={() => setMode('dark')}>Dark Mode</Button>
//       <Button onPress={() => setAccent('green')}>Green Theme</Button>
//     </View>
//   );
// }