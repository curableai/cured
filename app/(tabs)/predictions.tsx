import { HealthInsightBoard } from '@/components/HealthInsightBoard';
import { useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function InsightsScreen() {
    const router = useRouter();
    const { colors } = useTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Reusable Clinical Board */}
                <HealthInsightBoard />

                {/* Simplified AI Section */}
                <TouchableOpacity
                    onPress={() => router.push('/ai-assistant')}
                    style={[styles.aiCTA, { backgroundColor: '#0D0D0D' }]}
                >
                    <View style={styles.aiHeader}>
                        <Ionicons name="sparkles" size={24} color={colors.primary} />
                        <Text style={[styles.aiTitle, { color: colors.text }]}>Proprietary AI Deep-Dive</Text>
                    </View>
                    <Text style={[styles.aiDesc, { color: colors.textMuted }]}>
                        Leverage our proprietary clinical models to analyze longitudinal trends and physiological deviations with Visual Reasoning.
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color={colors.primary} style={styles.aiArrow} />
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: 24, paddingVertical: 60, paddingBottom: 100 },
    aiCTA: { padding: 32, borderRadius: 32, gap: 16, borderLeftWidth: 3, borderLeftColor: '#FF6B00', marginTop: 24 },
    aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    aiTitle: { fontSize: 18, fontWeight: '700' },
    aiDesc: { fontSize: 14, lineHeight: 24, opacity: 0.7 },
    aiArrow: { alignSelf: 'flex-end', marginTop: 8 },
});
