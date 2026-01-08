import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
} from 'react-native-reanimated';

interface AnimatedTabIconProps {
    name: any;
    color: string;
    size: number;
    focused: boolean;
}

export function AnimatedTabIcon({ name, color, size, focused }: AnimatedTabIconProps) {
    const scale = useSharedValue(1);

    useEffect(() => {
        if (focused) {
            // Pulse animation when tab becomes active
            scale.value = withSequence(
                withSpring(1.3, { damping: 8, stiffness: 200 }),
                withSpring(1, { damping: 8, stiffness: 200 })
            );
        }
    }, [focused]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View style={animatedStyle}>
            <Ionicons name={name} size={size} color={color} />
        </Animated.View>
    );
}
