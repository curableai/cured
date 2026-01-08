import { HealthAdvisory, localAdvisoryService } from '@/lib/localAdvisoryService';
import { nutritionIntelligence, NutritionSwap } from '@/lib/nutritionIntelligence';
import { getUserHealthProfile } from '@/lib/openAIHealthService';
import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { clinicalSignalService } from '@/services/clinicalSignalCapture';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View
} from 'react-native';

interface InsightCard {
    title: string;
    value: string;
    trend: 'improving' | 'declining' | 'stable';
    color: string;
    icon: string;
    description: string;
}

interface Props {
    showHeader?: boolean;
}

export function HealthInsightBoard({ showHeader = true }: Props) {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [insights, setInsights] = useState<InsightCard[]>([]);
    const [swaps, setSwaps] = useState<NutritionSwap[]>([]);
    const [advisories, setAdvisories] = useState<HealthAdvisory[]>([]);
    const [steadyMetricsCount, setSteadyMetricsCount] = useState(0);

    useEffect(() => {
        loadInsights();
    }, []);

    const loadInsights = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const profile = await getUserHealthProfile(user.id);
            if (profile) setUserName(profile.fullName.split(' ')[0]);

            const [nutritionSwaps, healthAdvisories] = await Promise.all([
                nutritionIntelligence.getNutritionalSwaps(user.id),
                localAdvisoryService.getAdvisories(user.id)
            ]);

            setSwaps(nutritionSwaps);
            setAdvisories(healthAdvisories);

            const { data: checkinHistory } = await supabase
                .from('daily_checkins')
                .select('*')
                .eq('user_id', user.id)
                .order('checkin_date', { ascending: false })
                .limit(7);

            const allInsights: InsightCard[] = [];

            // 1. Process Core Signals
            if (checkinHistory && checkinHistory.length > 0) {
                const latest = checkinHistory[0];
                const keySignals = ['mood', 'energy_level', 'sleep_quality'];

                for (const key of keySignals) {
                    if (latest[key]) {
                        const trend = calculateCategoricalTrendFromHistory(checkinHistory, key);
                        const insight = mapCheckinToInsight(key === 'mood' ? 'general_wellbeing' : key, latest[key], trend);
                        allInsights.push(insight);
                    }
                }
            }

            // 2. Clinical Vitals
            for (const sigId of ['body_temperature', 'blood_pressure_systolic']) {
                const history = await clinicalSignalService.getSignalHistory(user.id, sigId, 7);
                const latest = await clinicalSignalService.getLatestSignal(user.id, sigId);
                if (latest) {
                    const trend = calculateCategoricalTrend(sigId, history);
                    allInsights.push(mapSignalToInsight(sigId, latest, trend));
                }
            }

            // 3. APPLY BRUTAL HONESTY FILTER
            const highAttention = allInsights.filter(insight => {
                if (!insight?.value) return false;

                const isDeclining = insight.trend === 'declining';
                const valueStr = String(insight.value || '');
                const lowerValue = valueStr.toLowerCase();
                const isLow = lowerValue.includes('low') || lowerValue.includes('poor');
                const isVital = insight?.title?.includes('BP') || insight?.title?.includes('Temp');

                return isDeclining || isLow || (isVital && insight.trend !== 'stable');
            });

            if (highAttention.length === 0) {
                setInsights(allInsights.slice(0, 2));
            } else {
                setInsights(highAttention);
            }

            const steadyCount = allInsights.length - highAttention.length;
            setSteadyMetricsCount(steadyCount > 0 ? steadyCount : 0);

        } catch (error) {
            console.error('Error loading insights:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateCategoricalTrendFromHistory = (history: any[], key: string): 'improving' | 'declining' | 'stable' => {
        if (history.length < 2) return 'stable';
        const newest = history[0][key];
        const previous = history[1][key];

        const scores: any = {
            general_wellbeing: { 'very_good': 3, 'okay': 2, 'not_well': 1 },
            mood: { 'very_good': 3, 'okay': 2, 'not_well': 1 },
            energy_level: { 'normal': 3, 'low': 2, 'very_low': 1 },
            sleep_quality: { 'excellent': 4, 'good': 3, 'fair': 2, 'poor': 1 },
        };

        const scoreMap = scores[key] || scores['general_wellbeing'];
        const newestScore = scoreMap[newest] || 0;
        const previousScore = scoreMap[previous] || 0;

        if (newestScore > previousScore) return 'improving';
        if (newestScore < previousScore) return 'declining';
        return 'stable';
    };

    const mapCheckinToInsight = (id: string, value: any, trend: 'improving' | 'declining' | 'stable'): InsightCard => {
        return mapSignalToInsight(id, { value }, trend);
    };

    const calculateCategoricalTrend = (id: string, history: any[]): 'improving' | 'declining' | 'stable' => {
        if (history.length < 2) return 'stable';

        const newest = history[0].value;
        const previous = history[1].value;

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

        if (typeof newest === 'number' && typeof previous === 'number') {
            const normal = id === 'body_temperature' ? 36.6 : 120;
            const newestDist = Math.abs(newest - normal);
            const previousDist = Math.abs(previous - normal);
            if (newestDist < previousDist) return 'improving';
            if (newestDist > previousDist) return 'declining';
            return 'stable';
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
                format: (v: string) => {
                    if (!v) return 'N/A';
                    return v === 'normal' ? 'Normal' : v === 'low' ? 'Low' : 'Very Low';
                },
                desc: (t: string) => t === 'improving' ? 'Great progress! Your energy is returning to normal levels.' :
                    t === 'declining' ? 'Energy levels are lower than usual. Monitor for fatigue.' :
                        'Your energy levels are holding steady.'
            },
            sleep_quality: {
                title: 'Sleep Quality',
                icon: 'moon',
                color: '#2196F3',
                format: (v: string) => v ? v.charAt(0).toUpperCase() + v.slice(1) : 'N/A',
                desc: (t: string) => t === 'improving' ? 'Your sleep quality is improving. Keep it up!' :
                    t === 'declining' ? 'Sleep quality has dropped. Try to rest earlier.' :
                        'Sleep patterns are stable.'
            },
            body_temperature: {
                title: 'Body Temp',
                icon: 'thermometer',
                color: '#FF5252',
                format: (v: number) => v ? `${v}°C` : 'N/A',
                desc: (t: string) => t === 'improving' ? 'Your temperature is stabilizing within normal range.' :
                    t === 'declining' ? 'Temperature fluctuations detected.' :
                        'Temperature remains within physiological norms.'
            },
            blood_pressure_systolic: {
                title: 'Systolic BP',
                icon: 'pulse',
                color: '#E91E63',
                format: (v: number) => v ? `${v} mmHg` : 'N/A',
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
        if (!mood) return 'N/A';
        const map: any = { 'very_good': 'Excellent', 'okay': 'Steady', 'not_well': 'Low' };
        return map[mood] || mood;
    };

    if (loading) {
        return (
            <View style={[styles.centered, { padding: 40 }]}>
                <ActivityIndicator size="small" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.boardContainer}>
            {showHeader && (
                <View style={styles.header}>
                    <Text style={[styles.greeting, { color: colors.text }]}>Patient Analysis Port</Text>
                    <Text style={[styles.title, { color: colors.text }]}>Clinical Insights</Text>
                </View>
            )}

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

                {steadyMetricsCount > 0 && (
                    <View style={[styles.card, { backgroundColor: '#0D0D0D', borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }]}>
                        <View style={styles.aiHeader}>
                            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                            <Text style={[styles.cardTitle, { color: '#4CAF50', marginBottom: 0 }]}>
                                {steadyMetricsCount} Steady Metrics
                            </Text>
                        </View>
                        <Text style={[styles.cardDesc, { color: colors.textMuted, marginTop: 12 }]}>
                            These metrics are currently stable based on your recent check-in data. Connect a device to track heart rate and blood pressure automatically.
                        </Text>
                    </View>
                )}
            </View>

            {/* Precision Nutrition Swaps */}
            {swaps.length > 0 && (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Precision Nutrition Swaps</Text>
                    {swaps.map((swap, index) => (
                        <View key={index} style={[styles.swapCard, { backgroundColor: '#0D0D0D' }]}>
                            <View style={styles.swapHeader}>
                                <Ionicons name="restaurant" size={20} color={colors.primary} />
                                <Text style={[styles.swapTrigger, { color: colors.text }]}>{swap.trigger}</Text>
                            </View>
                            <Text style={[styles.swapSuggestion, { color: colors.text }]}>{swap.suggestion}</Text>
                            <Text style={[styles.swapReason, { color: colors.textMuted }]}>{swap.reason}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Regional Health Advisory */}
            {advisories.length > 0 && (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Regional Advisory</Text>
                    {advisories.map((advisory, index) => (
                        <View key={index} style={[styles.advisoryCard, { backgroundColor: advisory.severity === 'urgent' ? '#2A0000' : '#0D0D0D' }]}>
                            <View style={styles.swapHeader}>
                                <Ionicons
                                    name={advisory.severity === 'urgent' ? 'alert-circle' : 'information-circle'}
                                    size={20}
                                    color={advisory.severity === 'urgent' ? '#FF5252' : colors.primary}
                                />
                                <Text style={[styles.swapTrigger, { color: advisory.severity === 'urgent' ? '#FF5252' : colors.text }]}>{advisory.title}</Text>
                            </View>
                            <Text style={[styles.swapSuggestion, { color: colors.text }]}>{advisory.message}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    boardContainer: { width: '100%' },
    centered: { justifyContent: 'center', alignItems: 'center' },
    header: { marginBottom: 32 },
    greeting: { fontSize: 13, fontWeight: '600', opacity: 0.6, marginBottom: 4, textTransform: 'uppercase' },
    title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },

    insightList: { gap: 16, marginBottom: 32 },
    card: { width: '100%', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255, 107, 0, 0.05)' },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    trendInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    trendText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
    cardValue: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
    cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8, opacity: 0.9 },
    cardDesc: { fontSize: 13, lineHeight: 20, opacity: 0.6 },

    aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, opacity: 0.9 },
    swapCard: { padding: 20, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255, 107, 0, 0.1)' },
    swapHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    swapTrigger: { fontSize: 13, fontWeight: '600', opacity: 0.7 },
    swapSuggestion: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
    swapReason: { fontSize: 13, lineHeight: 18, opacity: 0.5 },
    advisoryCard: { padding: 20, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255, 107, 0, 0.05)' },
});
