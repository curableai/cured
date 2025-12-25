import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleSheet, useColorScheme, View, ViewProps } from 'react-native';

interface GlassViewProps extends ViewProps {
    intensity?: number;
}

export function GlassView({ style, intensity = 20, children, ...props }: GlassViewProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    // On Android, BlurView support can be limited or look different.
    // We can fallback to a semi-transparent view if needed, but expo-blur works reasonably well on modern Android.

    return (
        <View style={[styles.container, style]} {...props}>
            <BlurView
                intensity={intensity}
                tint={isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
            />
            <View style={[
                styles.content,
                {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.4)',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
                }
            ]}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        borderRadius: 20,
    },
    content: {
        flex: 1,
        padding: 20,
        borderWidth: 1,
        borderRadius: 20,
    },
});
