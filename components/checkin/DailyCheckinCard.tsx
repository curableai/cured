import { useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const DailyCheckinCard = () => {
    const { colors, isDark } = useTheme();
    const router = useRouter();

    return (
        <Pressable
            onPress={() => router.push('/daily-checkin')}
            style={({ pressed }) => [
                styles.container,
                {
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.9)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                },
                pressed && styles.pressed
            ]}
        >
            <LinearGradient
                colors={['#a855f7', '#7c3aed']} // Purple/Violet gradient to stand out
                style={styles.iconContainer}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <Ionicons name="sparkles" size={26} color="white" />
            </LinearGradient>

            <View style={styles.textContainer}>
                <Text style={[styles.title, { color: colors.text }]}>Daily Check-in</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                    How are you feeling today? Complete your 2-min check-in.
                </Text>
            </View>

            <View style={[styles.arrowContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <Ionicons name="arrow-forward" size={18} color={isDark ? '#e9d5ff' : '#7c3aed'} />
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 24,
        marginHorizontal: 20,
        marginTop: -40, // Pull it up over the hero section
        marginBottom: 24,
        borderWidth: 1,
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    pressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 13,
        lineHeight: 18,
    },
    arrowContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
