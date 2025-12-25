import { useTheme } from '@/lib/theme';
import React from 'react';
import { StyleSheet, Text, TextStyle, TouchableOpacity, TouchableOpacityProps, ViewStyle } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
    variant?: 'default' | 'ghost' | 'outline';
    size?: 'default' | 'sm' | 'lg';
    children: React.ReactNode;
}

export const Button = ({
    variant = 'default',
    size = 'default',
    children,
    style,
    ...props
}: ButtonProps) => {
    const { colors } = useTheme();

    const getVariantStyle = (): ViewStyle => {
        switch (variant) {
            case 'ghost':
                return { backgroundColor: 'transparent' };
            case 'outline':
                return { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary };
            default:
                return { backgroundColor: colors.primary };
        }
    };

    const getSizeStyle = (): ViewStyle => {
        switch (size) {
            case 'sm':
                return { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 };
            case 'lg':
                return { paddingHorizontal: 32, paddingVertical: 18, borderRadius: 16 };
            default:
                return { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 };
        }
    };

    const getTextStyle = (): TextStyle => {
        switch (variant) {
            case 'ghost':
                return { color: colors.text, fontWeight: '600' };
            case 'outline':
                return { color: colors.primary, fontWeight: '600' };
            default:
                return { color: '#000000', fontWeight: '700' };
        }
    };

    return (
        <TouchableOpacity
            style={[
                styles.button,
                getVariantStyle(),
                getSizeStyle(),
                style
            ]}
            activeOpacity={0.8}
            {...props}
        >
            <Text style={[styles.text, getTextStyle()]}>{children}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 15,
        letterSpacing: 0.5,
    },
});
