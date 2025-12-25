import { useTheme } from '@/lib/theme';
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface BloodPressureInputProps {
    systolicValue: number | undefined;
    diastolicValue: number | undefined;
    onValueChange: (systolic: number | undefined, diastolic: number | undefined) => void;
    onSkip: () => void;
}

export default function BloodPressureInput({
    systolicValue,
    diastolicValue,
    onValueChange,
    onSkip
}: BloodPressureInputProps) {
    const { colors } = useTheme();

    return (
        <View style={styles.container}>
            <View style={styles.inputsRow}>
                <View style={[styles.inputGroup, { borderBottomColor: colors.primary }]}>
                    <Text style={[styles.label, { color: colors.textMuted }]}>Systolic</Text>
                    <TextInput
                        style={[styles.input, { color: colors.text }]}
                        placeholder="120"
                        placeholderTextColor={colors.textLight}
                        keyboardType="number-pad"
                        value={systolicValue?.toString() || ''}
                        onChangeText={(t) => onValueChange(parseInt(t) || undefined, diastolicValue)}
                        maxLength={3}
                    />
                </View>

                <Text style={[styles.divider, { color: colors.textLight }]}>/</Text>

                <View style={[styles.inputGroup, { borderBottomColor: colors.primary }]}>
                    <Text style={[styles.label, { color: colors.textMuted }]}>Diastolic</Text>
                    <TextInput
                        style={[styles.input, { color: colors.text }]}
                        placeholder="80"
                        placeholderTextColor={colors.textLight}
                        keyboardType="number-pad"
                        value={diastolicValue?.toString() || ''}
                        onChangeText={(t) => onValueChange(systolicValue, parseInt(t) || undefined)}
                        maxLength={3}
                    />
                </View>
            </View>

            <Text style={[styles.unit, { color: colors.textMuted }]}>mmHg</Text>

            <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
                <Text style={[styles.skipText, { color: colors.textLight }]}>
                    I haven't checked it today
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'flex-start',
    },
    inputsRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 20,
        marginBottom: 16,
    },
    inputGroup: {
        borderBottomWidth: 1,
        minWidth: 100,
        paddingBottom: 8,
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    input: {
        fontSize: 32,
        fontWeight: '700',
    },
    divider: {
        fontSize: 32,
        fontWeight: '300',
        marginBottom: 8,
    },
    unit: {
        fontSize: 14,
        marginBottom: 40,
    },
    skipButton: {
        paddingVertical: 12,
    },
    skipText: {
        fontSize: 14,
        fontWeight: '500',
        textDecorationLine: 'underline',
    },
});
