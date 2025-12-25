import { useTheme } from '@/lib/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ProgressBannerProps {
    currentQuestion: number;
    totalQuestions: number;
}

export default function ProgressBanner({ currentQuestion, totalQuestions }: ProgressBannerProps) {
    const { colors } = useTheme();
    const progress = (currentQuestion / totalQuestions) * 100;

    return (
        <View style={[styles.container, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <View style={styles.header}>
                <Text style={[styles.text, { color: colors.textMuted }]}>
                    Question {currentQuestion} of {totalQuestions}
                </Text>
                <Text style={[styles.percentage, { color: colors.primary }]}>
                    {Math.round(progress)}%
                </Text>
            </View>

            {/* Progress Bar */}
            <View style={[styles.progressBarContainer, { backgroundColor: colors.surface }]}>
                <View
                    style={[
                        styles.progressBarFill,
                        { backgroundColor: colors.primary, width: `${progress}%` }
                    ]}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    text: {
        fontSize: 14,
        fontWeight: '500',
    },
    percentage: {
        fontSize: 14,
        fontWeight: '700',
    },
    progressBarContainer: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
});
