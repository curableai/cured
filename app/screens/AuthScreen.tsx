import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function AuthScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { checkExistingSession(); }, []);

  const checkExistingSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) await redirectUser(session.user.id);
    } catch (err) { console.log('No existing session'); }
  };

  const redirectUser = async (userId: string) => {
    try {
      const { data: doctor } = await supabase.from('doctors').select('id').eq('user_id', userId).single();
     // if (doctor) { router.replace('/(doctor)/dashboard'); return; }//

      const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', userId).single();

      if (!profile || !profile.onboarding_completed) {
        router.replace('/profile-setup');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err) { router.replace('/(tabs)'); }
  };

  const handleSignUp = async () => {
    setError('');
    if (!email.trim()) return setError('Email is required');
    if (!password) return setError('Password is required');
    if (password !== confirmPassword) return setError('Passwords do not match');

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
        options: { data: { email: email.trim().toLowerCase() } }
      });
      if (signUpError) { setError(signUpError.message); setLoading(false); return; }
      if (data.user && !data.session) {
        Alert.alert('Verification Required', 'Please check your email to verify your account.', [{ text: 'OK' }]);
        setLoading(false);
      }
    } catch (err) { setError('System error. Please try again.'); setLoading(false); }
  };

  const handleSignIn = async () => {
    setError('');
    if (!email.trim()) return setError('Email is required');
    if (!password) return setError('Password is required');

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (signInError) { setError(signInError.message); setLoading(false); }
    } catch (err) { setError('Connection error. Please try again.'); setLoading(false); }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          <View style={styles.header}>
            <View style={[styles.logoCircle, { borderColor: colors.primary }]}>
              <Feather name="activity" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Curable</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {isSignUp ? 'Create clinical profile' : 'Secure Clinical Access'}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Email Address</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                placeholder="email@example.com"
                placeholderTextColor="#666"
                value={email}
                onChangeText={(t) => setEmail(t)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Password</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                  placeholder="••••••••"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={(t) => setPassword(t)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textLight} />
                </TouchableOpacity>
              </View>
            </View>

            {isSignUp && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Confirm Password</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                  placeholder="••••••••"
                  placeholderTextColor="#666"
                  value={confirmPassword}
                  onChangeText={(t) => setConfirmPassword(t)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>
            )}

            {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, { borderColor: colors.primary }]}
              onPress={isSignUp ? handleSignUp : handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.primary }]}>
                  {isSignUp ? 'Establish Account' : 'Authenticate'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => setIsSignUp(!isSignUp)}
            >
              <Text style={[styles.toggleText, { color: colors.textMuted }]}>
                {isSignUp ? 'Already have an account? Sign In' : 'New user? Establish Account'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textLight }]}>
              Secured with 256-bit encryption. Access is restricted to authorized users only.
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 40, paddingTop: 100, paddingBottom: 40, flexGrow: 1 },
  header: { alignItems: 'center', marginBottom: 60 },
  logoCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  subtitle: { fontSize: 14, textTransform: 'uppercase', letterSpacing: 2, marginTop: 8 },
  form: { flex: 1 },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { height: 56, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 16 },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1 },
  eyeIcon: { position: 'absolute', right: 16 },
  errorText: { fontSize: 14, marginBottom: 20, textAlign: 'center' },
  primaryButton: { height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryButtonText: { fontSize: 16, fontWeight: '600' },
  toggleButton: { marginTop: 24, paddingVertical: 12 },
  toggleText: { fontSize: 14, textAlign: 'center' },
  footer: { marginTop: 'auto', paddingTop: 40 },
  footerText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
});