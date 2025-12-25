/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#1DB954'; // Spotify Green
const tintColorDark = '#1DB954'; // Spotify Green

export const Colors = {
  light: {
    text: '#121212',
    background: '#FFFFFF',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    primary: '#1DB954',
    secondary: '#191414',
    glass: 'rgba(0, 0, 0, 0.05)',
    card: '#F5F5F5',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000', // Pure Black for OLED pop
    tint: tintColorDark,
    icon: '#B3B3B3',
    tabIconDefault: '#B3B3B3',
    tabIconSelected: tintColorDark,
    primary: '#1DB954',
    secondary: '#FFFFFF',
    glass: 'rgba(255, 255, 255, 0.1)', // Light glass on dark background
    card: '#121212',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
