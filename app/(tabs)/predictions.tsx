import { getUserHealthProfile } from '@/lib/openAIHealthService';
import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { clinicalSignalService } from '@/services/clinicalSignalCapture';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface InsightCard {
    title: string;
    value: string;
    trend: 'improving' | 'declining' | 'stable';
    color: string;
    icon: string;
    description: string;
}

export default function InsightsScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userName, setUserName] = useState('');
    const [insights, setInsights] = useState<InsightCard[]>([]);

    useEffect(() => {
        loadInsights();
    }, []);

    const loadInsights = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch profile for context
            const profile = await getUserHealthProfile(user.id);
            if (profile) setUserName(profile.fullName.split(' ')[0]);

            const signals = ['general_wellbeing', 'energy_level', 'sleep_quality', 'body_temperature', 'blood_pressure_systolic'];
            const generatedInsights: InsightCard[] = [];

            for (const sigId of signals) {
                const history = await clinicalSignalService.getSignalHistory(user.id, sigId, 7);
                const latest = await clinicalSignalService.getLatestSignal(user.id, sigId);

                if (latest) {
                    const trend = calculateCategoricalTrend(sigId, history);
                    generatedInsights.push(mapSignalToInsight(sigId, latest, trend));
                }
            }

            // Default if no data
            if (generatedInsights.length === 0) {
                generatedInsights.push({
                    title: 'No Data Yet',
                    value: 'Start Check-in',
                    trend: 'stable',
                    color: colors.textMuted,
                    icon: 'calendar',
                    description: 'Complete your daily check-in to see your health trends here.'
                });
            }

            setInsights(generatedInsights);
        } catch (error) {
            console.error('Error loading insights:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateCategoricalTrend = (id: string, history: any[]): 'improving' | 'declining' | 'stable' => {
        if (history.length < 2) return 'stable';

        const newest = history[0].value;
        const previous = history[1].value;

        // Custom scoring maps for categorical data
        const scores: any = {
            general_wellbeing: { 'very_good': 3, 'okay': 2, 'not_well': 1 },
            energy_level: { 'normal': 3, 'low': 2, 'very_low': 1 },
            sleep_quality: { 'excellent': 4, 'good': 3, 'fair': 2, 'poor': 1 },
        };

        if (scores[id]) {
            const newestScore = scores[id][newest] || 0;
            const previousScore = scores[id][previous] || 0;
            if (newestScore > previousScore) return 'improving';
            if (newestScore < previousScore) return 'declining';
            return 'stable';
        }

        // Numeric logic (temperature, BP)
        if (typeof newest === 'number' && typeof previous === 'number') {
            // For temp/BP, "improving" usually means returning to normal range
            // but we'll use simple delta for now
            if (id === 'body_temperature' || id === 'blood_pressure_systolic') {
                // If it was high and is going down, that's improved
                // For simplicity, just check if it's closer to normal (36.6 or 120)
                const normal = id === 'body_temperature' ? 36.6 : 120;
                const newestDist = Math.abs(newest - normal);
                const previousDist = Math.abs(previous - normal);
                if (newestDist < previousDist) return 'improving';
                if (newestDist > previousDist) return 'declining';
                return 'stable';
            }
            if (newest > previous) return 'improving';
            if (newest < previous) return 'declining';
        }

        return 'stable';
    };

    const mapSignalToInsight = (id: string, latest: any, trend: 'improving' | 'declining' | 'stable'): InsightCard => {
        const config: any = {
            general_wellbeing: {
                title: 'Daily Mood',
                icon: 'sunny',
                color: '#FF6B00',
                format: formatMood,
                desc: (t: string) => t === 'improving' ? 'Your mood is on an upward trajectory this week.' :
                    t === 'declining' ? 'We noticed a dip in your mood scores recently.' :
                        'Your mood has been consistent over the last few days.'
            },
            energy_level: {
                title: 'Energy Levels',
                icon: 'flash',
                color: '#4CAF50',
                format: (v: string) => v === 'normal' ? 'Normal' : v === 'low' ? 'Low' : 'Very Low',
                desc: (t: string) => t === 'improving' ? 'Great progress! Your energy is returning to normal levels.' :
                    t === 'declining' ? 'Energy levels are lower than usual. Monitor for fatigue.' :
                        'Your energy levels are holding steady.'
            },
            sleep_quality: {
                title: 'Sleep Quality',
                icon: 'moon',
                color: '#2196F3',
                format: (v: string) => v.charAt(0).toUpperCase() + v.slice(1),
                desc: (t: string) => t === 'improving' ? 'Your sleep quality is improving. Keep it up!' :
                    t === 'declining' ? 'Sleep quality has dropped. Try to rest earlier.' :
                        'Sleep patterns are stable.'
            },
            body_temperature: {
                title: 'Body Temp',
                icon: 'thermometer',
                color: '#FF5252',
                format: (v: number) => `${v}°C`,
                desc: (t: string) => t === 'improving' ? 'Your temperature is stabilizing within normal range.' :
                    t === 'declining' ? 'Temperature fluctuations detected.' :
                        'Temperature remains within physiological norms.'
            },
            blood_pressure_systolic: {
                title: 'Systolic BP',
                icon: 'pulse',
                color: '#E91E63',
                format: (v: number) => `${v} mmHg`,
                desc: (t: string) => t === 'improving' ? 'Blood pressure is moving toward optimal levels.' :
                    t === 'declining' ? 'Increased blood pressure detected. Avoid high-sodium intake.' :
                        'Blood pressure levels are currently stable.'
            }
        };

        const c = config[id];
        return {
            title: c.title,
            value: c.format(latest.value),
            trend: trend as any,
            color: c.color,
            icon: c.icon,
            description: c.desc(trend)
        };
    };

    const formatMood = (mood: string) => {
        const map: any = { 'very_good': 'Excellent', 'okay': 'Steady', 'not_well': 'Low' };
        return map[mood] || mood;
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadInsights();
        setRefreshing(false);
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="small" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                <View style={styles.header}>
                    <Text style={[styles.greeting, { color: colors.text }]}>Patient Analysis Port</Text>
                    <Text style={[styles.title, { color: colors.text }]}>Clinical Insights</Text>
                </View>

                <View style={styles.insightList}>
                    {insights.map((insight, index) => (
                        <View key={index} style={[styles.card, { backgroundColor: '#0D0D0D' }]}>
                            <View style={styles.cardTop}>
                                <View style={[styles.iconBox, { backgroundColor: `${insight.color}20` }]}>
                                    <Ionicons name={insight.icon as any} size={22} color={insight.color} />
                                </View>
                                <View style={styles.trendInfo}>
                                    <Ionicons
                                        name={insight.trend === 'improving' ? 'trending-up' : insight.trend === 'declining' ? 'trending-down' : 'remove'}
                                        size={14}
                                        color={insight.trend === 'improving' ? '#4CAF50' : insight.trend === 'declining' ? '#FF5252' : colors.textMuted}
                                    />
                                    <Text style={[styles.trendText, { color: colors.textMuted }]}>{insight.trend}</Text>
                                </View>
                            </View>

                            <Text style={[styles.cardValue, { color: colors.text }]}>{insight.value}</Text>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>{insight.title}</Text>
                            <Text style={[styles.cardDesc, { color: colors.textMuted }]}>{insight.description}</Text>
                        </View>
                    ))}
                </View>

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
                        Leverage our proprietary clinical models to analyze longitudinal trends and physiological deviations.
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color={colors.primary} style={styles.aiArrow} />
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingHorizontal: 24, paddingVertical: 60, paddingBottom: 100 },
    header: { marginBottom: 40 },
    greeting: { fontSize: 16, fontWeight: '500', opacity: 0.6, marginBottom: 8 },
    title: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },

    insightList: { gap: 16, marginBottom: 40 },
    card: { width: '100%', borderRadius: 32, padding: 28, borderWidth: 1, borderColor: 'rgba(255, 107, 0, 0.05)' },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    iconBox: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    trendInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    trendText: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },

    cardValue: { fontSize: 28, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
    cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, opacity: 0.9 },
    cardDesc: { fontSize: 14, lineHeight: 22, opacity: 0.6 },

    aiCTA: { padding: 32, borderRadius: 32, gap: 16, borderLeftWidth: 3, borderLeftColor: '#FF6B00' },
    aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    aiTitle: { fontSize: 18, fontWeight: '700' },
    aiDesc: { fontSize: 14, lineHeight: 24, opacity: 0.7 },
    aiArrow: { alignSelf: 'flex-end', marginTop: 8 },
});
