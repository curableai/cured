import { useTheme } from '@/lib/theme';
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface TemperatureInputProps {
    value: number | undefined;
    onValueChange: (value: number | undefined) => void;
    onSkip: () => void;
}

export default function TemperatureInput({ value, onValueChange, onSkip }: TemperatureInputProps) {
    const { colors } = useTheme();

    const handleTextChange = (text: string) => {
        const numValue = parseFloat(text);
        onValueChange(isNaN(numValue) ? undefined : numValue);
    };

    return (
        <View style={styles.container}>
            <View style={[styles.inputContainer, { borderColor: colors.primary }]}>
                <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="36.5"
                    placeholderTextColor={colors.textLight}
                    keyboardType="decimal-pad"
                    value={value?.toString() || ''}
                    onChangeText={handleTextChange}
                    autoFocus
                />
                <Text style={[styles.unitText, { color: colors.textMuted }]}>°C</Text>
            </View>

            <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
                <Text style={[styles.skipText, { color: colors.textLight }]}>
                    I do not have a thermometer
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'flex-start',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        borderBottomWidth: 1,
        width: '100%',
        marginBottom: 40,
        paddingBottom: 8,
    },
    input: {
        fontSize: 48,
        fontWeight: '700',
        marginRight: 12,
        minWidth: 120,
    },
    unitText: {
        fontSize: 24,
        fontWeight: '400',
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
