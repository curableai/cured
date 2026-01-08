// app/CheckinCompleteScreen.tsx - UPDATED FOR LIFESTYLE SYSTEM

import { CheckinAnswers } from '@/lib/checkinQuestions';
import { generateCheckinSummary } from '@/lib/checkinSummaryAI';
import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';

export default function CheckinCompleteScreen() {
    const router = useRouter();
    const { colors, isDark } = useTheme();
    const params = useLocalSearchParams();

    // Parse params
    const message = params.message as string;
    const score = params.score ? parseInt(params.score as string) : 0;
    const insights = params.insights ? JSON.parse(params.insights as string) : [];

    const [aiMessage, setAiMessage] = useState<string>(message || '');
    const [loading, setLoading] = useState(!message);

    useEffect(() => {
        // If message wasn't passed, generate it
        if (!message) {
            loadSummary();
        }
    }, []);

    const loadSummary = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && params.answers) {
                const answers = JSON.parse(params.answers as string) as CheckinAnswers;
                const summary = await generateCheckinSummary(user.id, answers);
                setAiMessage(summary.message);
            }
        } catch (error) {
            console.error('Error generating summary:', error);
            setAiMessage('Your health data has been successfully recorded.');
        } finally {
            setLoading(false);
        }
    };

    // Get score color
    const getScoreColor = (score: number) => {
        if (score >= 80) return '#10B981'; // Green
        if (score >= 60) return '#F59E0B'; // Orange
        return '#EF4444'; // Red
    };

    // Get score label
    const getScoreLabel = (score: number) => {
        if (score >= 80) return 'Excellent';
        if (score >= 60) return 'Good';
        if (score >= 40) return 'Fair';
        return 'Needs Improvement';
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={[styles.iconCircle, { borderColor: colors.primary }]}>
                        <Ionicons name="checkmark" size={48} color={colors.primary} />
                    </View>
                    <Text style={[styles.title, { color: colors.text }]}>
                        Check-in Complete
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                        Your daily health data has been recorded
                    </Text>
                </View>

                {/* Lifestyle Score Card */}
                {score > 0 && (
                    <View style={[
                        styles.scoreCard,
                        {
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                        }
                    ]}>
                        <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>
                            Lifestyle Score
                        </Text>
                        <View style={styles.scoreRow}>
                            <Text style={[
                                styles.scoreNumber,
                                { color: getScoreColor(score) }
                            ]}>
                                {score}
                            </Text>
                            <Text style={[styles.scoreOutOf, { color: colors.textMuted }]}>
                                /100
                            </Text>
                        </View>
                        <Text style={[
                            styles.scoreStatus,
                            { color: getScoreColor(score) }
                        ]}>
                            {getScoreLabel(score)}
                        </Text>
                    </View>
                )}

                {/* AI Summary */}
                <View style={[
                    styles.aiCard,
                    {
                        backgroundColor: isDark ? '#1a1a1a' : '#f9fafb',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                    }
                ]}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                                Analyzing your lifestyle patterns...
                            </Text>
                        </View>
                    ) : (
                        <>
                            <Text style={[styles.aiLabel, { color: colors.textMuted }]}>
                                Health Insights
                            </Text>
                            <Text style={[styles.aiText, { color: colors.text }]}>
                                {aiMessage}
                            </Text>
                        </>
                    )}
                </View>


            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    content: {
        padding: 24,
        paddingTop: 40,
        paddingBottom: 60
    },

    // Header
    header: {
        alignItems: 'center',
        marginBottom: 32
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: -0.5,
        marginBottom: 8
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '500'
    },

    // Score Card
    scoreCard: {
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1
    },
    scoreLabel: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 8
    },
    scoreNumber: {
        fontSize: 56,
        fontWeight: '800',
        letterSpacing: -2
    },
    scoreOutOf: {
        fontSize: 24,
        fontWeight: '600',
        marginLeft: 4
    },
    scoreStatus: {
        fontSize: 16,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1
    },

    // AI Card
    aiCard: {
        borderRadius: 20,
        padding: 24,
        marginBottom: 24,
        borderWidth: 1
    },
    loadingContainer: {
        alignItems: 'center',
        gap: 12
    },
    loadingText: {
        fontSize: 14,
        fontWeight: '500'
    },
    aiLabel: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12
    },
    aiText: {
        fontSize: 15,
        lineHeight: 24,
        fontWeight: '400'
    },

    // Insights List
    insightsList: {
        marginBottom: 32
    },
    insightsTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 16,
        letterSpacing: -0.3
    },
    insightTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
        opacity: 0.9
    },
    insightItem: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderLeftWidth: 3
    },
    insightText: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500'
    },

    // Actions
    actions: {
        gap: 16
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        borderRadius: 16,
        gap: 8
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.3
    },
    secondaryButton: {
        paddingVertical: 16,
        alignItems: 'center'
    },
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: '600'
    }
});