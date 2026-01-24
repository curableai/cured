import { useTheme } from '@/lib/theme';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DisclaimerScreen() {
    const router = useRouter();
    const { colors } = useTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.title, { color: colors.text }]}>Medical Disclaimer</Text>

                <View style={[styles.card, { backgroundColor: '#1E1E1E' }]}>
                    <Text style={[styles.text, { color: colors.text }]}>
                        Current AI health analysis is for informational purposes only and does not constitute medical advice, diagnosis, or treatment.
                        {'\n\n'}
                        Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
                        {'\n\n'}
                        Never disregard professional medical advice or delay in seeking it because of something you have read on this application.
                        {'\n\n'}
                        If you think you may have a medical emergency, call your doctor or emergency services immediately.
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.primary }]}
                    onPress={() => router.replace('/(tabs)')}
                >
                    <Text style={styles.buttonText}>I Understand and Agree</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 24,
        flexGrow: 1,
        justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 24,
        textAlign: 'center',
    },
    card: {
        padding: 24,
        borderRadius: 16,
        marginBottom: 32,
    },
    text: {
        fontSize: 16,
        lineHeight: 24,
    },
    button: {
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
    },
});
