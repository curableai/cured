import { useTheme } from '@/lib/theme';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface OptionChipsProps {
    options: string[];
    selectedValue: string | undefined;
    onSelect: (value: string) => void;
}

export default function OptionChips({ options, selectedValue, onSelect }: OptionChipsProps) {
    const { colors } = useTheme();

    return (
        <View style={styles.container}>
            {options.map((option) => {
                const isSelected = selectedValue === option;
                return (
                    <TouchableOpacity
                        key={option}
                        onPress={() => onSelect(option)}
                        style={[
                            styles.chip,
                            {
                                backgroundColor: isSelected ? '#000000' : '#121212',
                                borderColor: isSelected ? colors.primary : colors.borderLight
                            }
                        ]}
                        activeOpacity={0.8}
                    >
                        <Text
                            style={[
                                styles.chipText,
                                { color: isSelected ? colors.primary : colors.text }
                            ]}
                        >
                            {option}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 16,
    },
    chip: {
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderRadius: 16,
        borderWidth: 1,
        width: '100%',
        alignItems: 'flex-start',
    },
    chipText: {
        fontSize: 18,
        fontWeight: '500',
    },
});
