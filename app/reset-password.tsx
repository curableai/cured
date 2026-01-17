// app/reset-password.tsx
import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function ResetPasswordScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleReset = async () => {
        setError('');
        if (!password) return setError('New password is required');
        if (password.length < 6) return setError('Password must be at least 6 characters');
        if (password !== confirmPassword) return setError('Passwords do not match');

        setLoading(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password,
            });

            if (updateError) {
                setError(updateError.message);
            } else {
                Alert.alert('Success', 'Your password has been updated. You can now access your account.', [
                    { text: 'Continue', onPress: () => router.replace('/ai-assistant') }
                ]);
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
                <ScrollView contentContainerStyle={styles.scrollContent}>

                    <View style={styles.header}>
                        <View style={[styles.logoCircle, { borderColor: colors.primary }]}>
                            <Feather name="lock" size={32} color={colors.primary} />
                        </View>
                        <Text style={[styles.title, { color: colors.text }]}>Reset Password</Text>
                        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                            Securely set a new password for your clinical profile.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.text }]}>New Password</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                                placeholder="••••••••"
                                placeholderTextColor="#666"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.text }]}>Confirm New Password</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                                placeholder="••••••••"
                                placeholderTextColor="#666"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                                autoCapitalize="none"
                            />
                        </View>

                        {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

                        <TouchableOpacity
                            style={[styles.primaryButton, { borderColor: colors.primary }]}
                            onPress={handleReset}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Text style={[styles.primaryButtonText, { color: colors.primary }]}>
                                    Update Password
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    flex: { flex: 1 },
    scrollContent: { paddingHorizontal: 40, paddingTop: 100, paddingBottom: 40, flexGrow: 1 },
    header: { alignItems: 'center', marginBottom: 60 },
    logoCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    title: { fontSize: 32, fontWeight: '700', letterSpacing: -1 },
    subtitle: { fontSize: 14, textAlign: 'center', color: '#666', marginTop: 12, lineHeight: 20 },
    form: { flex: 1 },
    inputGroup: { marginBottom: 24 },
    label: { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { height: 56, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 16 },
    errorText: { fontSize: 14, marginBottom: 20, textAlign: 'center' },
    primaryButton: { height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: 'rgba(255, 107, 0, 0.05)' },
    primaryButtonText: { fontSize: 16, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
});
