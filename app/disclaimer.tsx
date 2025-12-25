import {
    CURABLE_DISCLAIMER_TYPE,
    CURABLE_DISCLAIMER_VERSION
} from '@/lib/disclaimer';
import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function DisclaimerScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const [loading, setLoading] = useState(false);

    const handleAccept = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('disclaimer_acceptances').insert({
                    user_id: user.id,
                    disclaimer_type: CURABLE_DISCLAIMER_TYPE,
                    disclaimer_version: CURABLE_DISCLAIMER_VERSION,
                    accepted_at: new Date().toISOString()
                });
            }
            router.replace('/(tabs)');
        } catch (error) {
            console.error('Error saving disclaimer:', error);
            router.replace('/(tabs)'); // Still allow passage for demo/test flow
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#000000' }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>

                <View style={styles.header}>
                    <Text style={[styles.title, { color: '#FFFFFF' }]}>Disclaimer</Text>
                    <View style={[styles.divider, { backgroundColor: colors.primary }]} />
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.primary }]}>Not Medical Advice</Text>
                    <Text style={[styles.bodyText, { color: '#FFFFFF' }]}>
                        Curable is an AI-powered health monitoring tool designed for informational purposes only. It is not a medical device and does not provide professional medical diagnosis or treatment.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.primary }]}>Professional Consultation</Text>
                    <Text style={[styles.bodyText, { color: '#FFFFFF' }]}>
                        Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.primary }]}>Emergency Use</Text>
                    <Text style={[styles.bodyText, { color: '#FFFFFF' }]}>
                        Do not use this app in a medical emergency. If you are experiencing a health crisis, contact emergency services immediately.
                    </Text>
                </View>

            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity onPress={handleAccept} disabled={loading} style={[styles.button, { borderColor: colors.primary }]}>
                    {loading ? (
                        <ActivityIndicator color={colors.primary} />
                    ) : (
                        <Text style={[styles.buttonText, { color: colors.primary }]}>I Understand</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: 40, paddingTop: 60 },
    header: { marginBottom: 60 },
    title: { fontSize: 32, fontWeight: '700', marginBottom: 20 },
    divider: { height: 1, width: 40 },
    section: { marginBottom: 48 },
    sectionTitle: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
    bodyText: { fontSize: 16, lineHeight: 28, fontWeight: '400', opacity: 0.9 },
    footer: { padding: 40 },
    button: { paddingVertical: 18, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
    buttonText: { fontSize: 16, fontWeight: '600' },
});
