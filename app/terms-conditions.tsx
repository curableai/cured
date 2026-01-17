// app/terms-conditions.tsx
import { useAuthStore } from '@/lib/authStore';
import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
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

export default function TermsConditionsScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const [loading, setLoading] = useState(false);
    const { setHasAcceptedTerms } = useAuthStore();

    const handleAccept = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error } = await supabase.from('disclaimer_acceptances').insert({
                    user_id: user.id,
                    disclaimer_type: 'TERMS_AND_CONDITIONS',
                    disclaimer_version: '1.0.0',
                    accepted_at: new Date().toISOString()
                });

                if (error) throw error;

                setHasAcceptedTerms(true);
                // After accepting, we can proceed to onboarding/setup or main app
                // The root layout will handle the final destination based on onboarding status
                router.replace('/profile-setup');
            }
        } catch (error) {
            console.error('Error saving T&C acceptance:', error);
            Alert.alert('Error', 'Failed to save your acceptance. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#000000' }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={[styles.title, { color: '#FFFFFF' }]}>Terms & Conditions</Text>
                    <View style={[styles.divider, { backgroundColor: colors.primary }]} />
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.primary }]}>1. Acceptance of Terms</Text>
                    <Text style={[styles.bodyText, { color: '#FFFFFF' }]}>
                        By using Curable, you agree to be bound by these Terms and Conditions. If you do not agree, you may not access the application.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.primary }]}>2. Medical Disclaimer</Text>
                    <Text style={[styles.bodyText, { color: '#FFFFFF' }]}>
                        Curable is an AI-powered health monitoring tool and NOT a medical device. It does not provide professional medical diagnosis, treatment, or advice. Always consult with a qualified healthcare professional.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.primary }]}>3. Data Privacy</Text>
                    <Text style={[styles.bodyText, { color: '#FFFFFF' }]}>
                        Your health data is encrypted and handled in accordance with our Privacy Policy. We prioritize your privacy and security.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.primary }]}>4. Limitations of Liability</Text>
                    <Text style={[styles.bodyText, { color: '#FFFFFF' }]}>
                        Curable is provided "as is". We are not liable for any decisions made based on the information provided by the AI assistant.
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    onPress={handleAccept}
                    disabled={loading}
                    style={[styles.button, { backgroundColor: colors.primary }]}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>I Agree to the Terms</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: 40, paddingTop: 60, paddingBottom: 40 },
    header: { marginBottom: 44 },
    title: { fontSize: 32, fontWeight: '800', marginBottom: 20, letterSpacing: -1 },
    divider: { height: 2, width: 40, borderRadius: 1 },
    section: { marginBottom: 32 },
    sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
    bodyText: { fontSize: 15, lineHeight: 26, fontWeight: '400', opacity: 0.8 },
    footer: { padding: 40, paddingBottom: 40, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    button: { paddingVertical: 20, borderRadius: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    buttonText: { fontSize: 16, fontWeight: '700' },
});
