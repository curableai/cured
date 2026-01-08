import OptionChips from '@/components/checkin/OptionChips';
import DailyTipsCard from '@/components/DailyTipsCard';
import { HealthInsightBoard } from '@/components/HealthInsightBoard';
import { aiCheckinService, DynamicQuestion } from '@/lib/aiCheckinService';
import {
    CheckinAnswers
} from '@/lib/checkinQuestions';
import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { clinicalSignalService } from '@/services/clinicalSignalCapture';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DailyCheckinScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    const [answers, setAnswers] = useState<CheckinAnswers>({});
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [saving, setSaving] = useState(false);

    // Dynamic Questions
    const [questions, setQuestions] = useState<DynamicQuestion[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(true);

    // Lock states
    const [isLoading, setIsLoading] = useState(true);
    const [isLocked, setIsLocked] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const [availableTime, setAvailableTime] = useState("6:00 PM");

    const currentQuestion = questions[currentQuestionIndex];
    const isFirstQuestion = currentQuestionIndex === 0;
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

    // Check status check on mount
    useEffect(() => {
        checkStatusAndSchedule();

        // Setup notifications handler
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
            }),
        });
    }, []);

    const checkStatusAndSchedule = async () => {
        try {
            setIsLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // 1. Check if already completed today
                const today = new Date().toISOString().split('T')[0];

                const { data: checkin } = await supabase
                    .from('daily_checkins')
                    .select('id, completed')
                    .eq('user_id', user.id)
                    .eq('checkin_date', today)
                    .eq('completed', true) // ✅ Only show as completed if explicitly marked
                    .maybeSingle();

                if (checkin) {
                    // ✅ User completed today's check-in
                    // Check if it's past 6 PM - if so, allow new check-in for tomorrow
                    const currentHour = new Date().getHours();
                    const UNLOCK_HOUR = 18; // 6 PM

                    if (currentHour >= UNLOCK_HOUR) {
                        // It's past 6 PM, check if tomorrow's check-in exists
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        const tomorrowDate = tomorrow.toISOString().split('T')[0];

                        const { data: tomorrowCheckin } = await supabase
                            .from('daily_checkins')
                            .select('id, completed')
                            .eq('user_id', user.id)
                            .eq('checkin_date', tomorrowDate)
                            .eq('completed', true)
                            .maybeSingle();

                        if (tomorrowCheckin) {
                            // Tomorrow's check-in also completed, show completed state
                            setIsCompleted(true);
                            setIsLoading(false);
                            return;
                        }
                        // Else: Fall through to load questions for tomorrow
                    } else {
                        // Before 6 PM and today is completed, show completed state
                        setIsCompleted(true);
                        setIsLoading(false);
                        return;
                    }
                }

                // 2. Fetch AI-generated dynamic questions
                try {
                    setLoadingQuestions(true);
                    const dynamicQuestions = await aiCheckinService.generateDailyStack(user.id);
                    setQuestions(dynamicQuestions);
                } catch (err) {
                    console.error('Failed to load dynamic questions:', err);
                } finally {
                    setLoadingQuestions(false);
                }
            }

            // 3. No time-based locking - available anytime if not completed
            setIsLocked(false);

            scheduleDailyReminder();

        } catch (error) {
            console.error('Error checking status:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const scheduleDailyReminder = async () => {
        const { status } = await Notifications.getPermissionsAsync();
        let finalStatus = status;
        if (status !== 'granted') {
            const { status: newStatus } = await Notifications.requestPermissionsAsync();
            finalStatus = newStatus;
        }

        if (finalStatus === 'granted') {
            // Cancel existing to avoid dupes
            await Notifications.cancelAllScheduledNotificationsAsync();

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "Time to check in! 🌙",
                    body: "How did your day go? Log your lifestyle stats now.",
                },
                trigger: {
                    hour: 18, // 6 PM - matches unlock time
                    minute: 0,
                    type: Notifications.SchedulableTriggerInputTypes.DAILY
                },
            });
        }
    };

    // ... [Helper functions getPillarIcon, etc.] ...

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
            // Try to get user with session refresh
            let { data: { user }, error: authError } = await supabase.auth.getUser();

            // If no user, try refreshing the session
            if (!user || authError) {
                console.log('⚠️ No user found, attempting session refresh...');
                const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

                if (refreshError || !session) {
                    console.error('❌ Session refresh failed:', refreshError);
                    throw new Error('Your session has expired. Please log in again.');
                }

                user = session.user;
                console.log('✅ Session refreshed successfully');
            }

            if (!user) {
                console.error('❌ User still not authenticated after refresh');
                throw new Error('User not authenticated');
            }

            console.log('✅ User authenticated:', user.id);

            // 1. Get AI-driven Score & Insights
            const aiAnalysis = await aiCheckinService.scoreCheckin(user.id, finalAnswers);
            const { score, feedback, insights } = aiAnalysis;

            // 2. CAPTURE AS CLINICAL SIGNALS
            // Every answer from a check-in is a SignalInstance
            for (const [signalId, value] of Object.entries(finalAnswers)) {
                try {
                    await clinicalSignalService.captureSignal({
                        signalId,
                        value: value as any,
                        source: 'daily_checkin',
                        capturedAt: new Date().toISOString()
                    });
                } catch (sigErr) {
                    console.error(`Failed to capture signal ${signalId}:`, sigErr);
                }
            }

            // 3. Prepare Record for daily_checkins table
            const checkinRecord = {
                user_id: user.id,
                checkin_date: new Date().toISOString().split('T')[0],
                lifestyle_score: score,
                mood: finalAnswers.general_wellbeing || finalAnswers.mood,
                stress_level: finalAnswers.stress_level,
                sleep_quality: finalAnswers.sleep_quality,
                energy_level: finalAnswers.energy_level,
                answers: finalAnswers,
                insights: insights,
                completed: true // ✅ Mark as completed only when user finishes all questions
            };

            const { error } = await supabase
                .from('daily_checkins')
                .upsert(checkinRecord, {
                    onConflict: 'user_id, checkin_date'
                });

            if (error) throw error;

            // 3. Navigate to Complete Screen
            router.replace({
                pathname: '/CheckinCompleteScreen' as any,
                params: {
                    message: feedback,
                    score,
                    insights: JSON.stringify(insights)
                }
            });

        } catch (error) {
            console.error('Error completing check-in:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to save check-in. Please try again.';
            Alert.alert('Error', errorMessage);
            setSaving(false);
        }
    };

    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (isCompleted) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScrollView
                    contentContainerStyle={{ padding: 24, alignItems: 'center' }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={isLoading} onRefresh={checkStatusAndSchedule} tintColor={colors.primary} />
                    }
                >
                    <Text style={{ fontSize: 48, marginBottom: 16, marginTop: 40 }}>✅</Text>
                    <Text style={[styles.questionText, { color: colors.text, textAlign: 'center' }]}>You're all set for today!</Text>
                    <Text style={[styles.helpText, { color: colors.textMuted, textAlign: 'center' }]}>
                        Great job checking in. Your medical signals have been updated across your health board.
                    </Text>

                    <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 40, padding: 12 }}>
                        <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>← Go Home</Text>
                    </TouchableOpacity>

                    {/* Daily Health Tips */}
                    <View style={{ width: '100%', marginBottom: 24 }}>
                        <DailyTipsCard />
                    </View>

                    {/* Show updated insights immediately */}
                    <View style={{ width: '100%', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 32 }}>
                        <HealthInsightBoard showHeader={false} />
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    if (isLocked) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScrollView
                    contentContainerStyle={{ padding: 24, alignItems: 'center' }}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={{ fontSize: 48, marginBottom: 16, marginTop: 40 }}>🌙</Text>
                    <Text style={[styles.questionText, { color: colors.text, textAlign: 'center' }]}>Come back at 6 PM</Text>
                    <Text style={[styles.helpText, { color: colors.textMuted, textAlign: 'center' }]}>
                        You've completed today's check-in! New check-ins unlock at 6 PM daily.
                    </Text>

                    <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 40, padding: 12 }}>
                        <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>← Go Home</Text>
                    </TouchableOpacity>

                    {/* Daily Health Tips */}
                    <View style={{ width: '100%', marginBottom: 24 }}>
                        <DailyTipsCard />
                    </View>

                    {/* Show current signals even while locked */}
                    <View style={{ width: '100%', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 32 }}>
                        <HealthInsightBoard showHeader={false} />
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

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

            {/* Navigation - must clear floating tab bar (height:64 + bottom:24 + buffer) */}
            <View style={[styles.footer, { paddingBottom: 110 + insets.bottom }]}>
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

                <View style={styles.spacer} />
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
    scrollContent: {
        padding: 24,
        paddingTop: 40,
        paddingBottom: 200
    },
    loadingText: {
        marginTop: 16,
        fontSize: 14,
        fontWeight: '500'
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 8
    },
    pillarBadge: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginBottom: 16
    },
    pillarName: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    progressContainer: {
        gap: 8
    },
    progressBar: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden'
    },
    progressFill: {
        height: '100%',
        borderRadius: 3
    },
    progressText: {
        fontSize: 12,
        fontWeight: '600'
    },
    questionArea: {
        marginBottom: 32
    },
    questionText: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 12,
        lineHeight: 34
    },
    helpText: {
        fontSize: 16,
        lineHeight: 22,
        marginBottom: 24
    },
    inputArea: {
        marginTop: 8
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 16,
        backgroundColor: 'transparent'
    },
    navButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    navButtonText: {
        fontSize: 16,
        fontWeight: '600'
    },
    spacer: {
        flex: 1
    },
    hidden: {
        opacity: 0
    }
});

