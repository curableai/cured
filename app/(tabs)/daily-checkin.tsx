// app/daily-checkin.tsx - LIFESTYLE PILLAR VERSION

import OptionChips from '@/components/checkin/OptionChips';
import {
    calculateLifestyleScore,
    CheckinAnswers,
    DAILY_CHECKIN_QUESTIONS,
    generateLifestyleMessage,
    mapAnswersToSignals
} from '@/lib/checkinQuestions';
import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { clinicalSignalService } from '@/services/clinicalSignalCapture';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function DailyCheckinScreen() {
    const router = useRouter();
    const { colors } = useTheme();

    const [answers, setAnswers] = useState<CheckinAnswers>({});
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [saving, setSaving] = useState(false);

    const questions = DAILY_CHECKIN_QUESTIONS;
    const currentQuestion = questions[currentQuestionIndex];
    const isFirstQuestion = currentQuestionIndex === 0;
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

    // Get pillar name for current question
    const getPillarIcon = (pillar: string) => {
        switch (pillar) {
            case 'diet': return '🍎';
            case 'activity': return '🏃';
            case 'sleep': return '💤';
            case 'stress': return '🧘';
            default: return '💚';
        }
    };

    const getPillarName = (pillar: string) => {
        switch (pillar) {
            case 'diet': return 'Diet & Nutrition';
            case 'activity': return 'Physical Activity';
            case 'sleep': return 'Sleep Quality';
            case 'stress': return 'Stress Management';
            default: return 'General Health';
        }
    };

    const handleAnswer = (value: any) => {
        const newAnswers = { ...answers, [currentQuestion.id]: value };
        setAnswers(newAnswers);

        // Auto-advance
        setTimeout(() => {
            if (isLastQuestion) {
                handleComplete(newAnswers);
            } else {
                setCurrentQuestionIndex(prev => prev + 1);
            }
        }, 300);
    };

    const goToPreviousQuestion = () => {
        if (!isFirstQuestion) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const handleComplete = async (finalAnswers: CheckinAnswers) => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            // Map answers to signals
            const signals = mapAnswersToSignals(finalAnswers);

            // Save each signal
            const savePromises = signals.map(signal =>
                clinicalSignalService.captureSignal({
                    signalId: signal.signalId,
                    value: signal.value,
                    source: 'daily_checkin',
                    capturedAt: new Date().toISOString()
                })
            );

            const results = await Promise.allSettled(savePromises);
            const failedCount = results.filter(r => r.status === 'rejected').length;

            if (failedCount > 0) {
                console.warn(`${failedCount} signals failed to save`);
            }

            // Calculate lifestyle score
            const { score, insights } = calculateLifestyleScore(finalAnswers);

            // Generate personalized message
            const message = generateLifestyleMessage(finalAnswers);

            // Navigate to completion screen
            router.replace({
                pathname: '/CheckinCompleteScreen' as any,
                params: {
                    message,
                    score,
                    insights: JSON.stringify(insights)
                }
            });

        } catch (error) {
            console.error('Error completing check-in:', error);
            Alert.alert('Error', 'Failed to save check-in. Please try again.');
            setSaving(false);
        }
    };

    if (saving) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                    Analyzing your lifestyle choices...
                </Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header with Pillar Badge */}
            <View style={styles.header}>
                <View style={[styles.pillarBadge, { backgroundColor: `${colors.primary}15` }]}>
                    <Text style={[styles.pillarName, { color: colors.primary }]}>
                        {getPillarName(currentQuestion.pillar)}
                    </Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { backgroundColor: `${colors.primary}20` }]}>
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    width: `${progress}%`,
                                    backgroundColor: colors.primary
                                }
                            ]}
                        />
                    </View>
                    <Text style={[styles.progressText, { color: colors.textMuted }]}>
                        Question {currentQuestionIndex + 1} of {questions.length}
                    </Text>
                </View>
            </View>

            {/* Main Question */}
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.questionArea}>
                    <Text style={[styles.questionText, { color: colors.text }]}>
                        {currentQuestion.question}
                    </Text>

                    {currentQuestion.helpText && (
                        <Text style={[styles.helpText, { color: colors.textMuted }]}>
                            {currentQuestion.helpText}
                        </Text>
                    )}

                    <View style={styles.inputArea}>
                        <OptionChips
                            options={currentQuestion.options?.map(o => o.label) || []}
                            selectedValue={
                                currentQuestion.options?.find(
                                    o => o.value === answers[currentQuestion.id]
                                )?.label
                            }
                            onSelect={(label) => {
                                const option = currentQuestion.options?.find(o => o.label === label);
                                if (option) handleAnswer(option.value);
                            }}
                        />
                    </View>
                </View>
            </ScrollView>

            {/* Navigation */}
            <View style={styles.footer}>
                <TouchableOpacity
                    onPress={goToPreviousQuestion}
                    disabled={isFirstQuestion}
                    style={[styles.navButton, isFirstQuestion && styles.hidden]}
                >
                    <Text style={[styles.navButtonText, { color: colors.textMuted }]}>
                        ← Back
                    </Text>
                </TouchableOpacity>

                <View style={styles.spacer} />

                {/* Show preview of lifestyle score */}
                {Object.keys(answers).length > 3 && (
                    <View style={[styles.scorePreview, { backgroundColor: `${colors.primary}10` }]}>
                        <Text style={[styles.scoreText, { color: colors.primary }]}>
                            Score: {calculateLifestyleScore(answers).score}%
                        </Text>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center'
    },

    header: {
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 16
    },
    pillarBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        marginBottom: 16
    },
    pillarName: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase'
    },
    progressContainer: {
        gap: 8
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
        overflow: 'hidden'
    },
    progressFill: {
        height: '100%',
        borderRadius: 2
    },
    progressText: {
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center'
    },

    scrollContent: {
        flexGrow: 1
    },
    questionArea: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingVertical: 40,
        minHeight: 400
    },
    questionText: {
        fontSize: 24,
        fontWeight: '700',
        lineHeight: 32,
        textAlign: 'center',
        letterSpacing: -0.5,
        marginBottom: 12
    },
    helpText: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 32,
        opacity: 0.8,
        fontStyle: 'italic'
    },
    inputArea: {
        width: '100%',
        marginTop: 16
    },

    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingBottom: 32,
        gap: 16
    },
    navButton: {
        paddingVertical: 12,
        paddingHorizontal: 8
    },
    navButtonText: {
        fontSize: 16,
        fontWeight: '600'
    },
    spacer: {
        flex: 1
    },
    scorePreview: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12
    },
    scoreText: {
        fontSize: 14,
        fontWeight: '700'
    },
    hidden: {
        opacity: 0,
        pointerEvents: 'none'
    }
});