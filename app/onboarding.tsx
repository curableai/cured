import { useTheme } from '@/lib/theme';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const OnboardingScreen = () => {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.iconWrapper, { borderColor: colors.primary }]}>
            <Feather name="activity" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Curable</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Clinical-grade health monitoring and AI-assisted diagnostics interface.
          </Text>
        </View>

        <View style={styles.section}>
          <FeatureItem
            icon="shield"
            title="Privacy & Security"
            description="Your clinical data is encrypted and stored securely according to medical standards."
            colors={colors}
          />
          <FeatureItem
            icon="cpu"
            title="AI Diagnostics"
            description="Evidence-based insights generated from your personal health signals."
            colors={colors}
          />
          <FeatureItem
            icon="heart"
            title="Continuous Care"
            description="Proactive monitoring of vitals to identify potential health risks early."
            colors={colors}
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            onPress={() => router.push('/login')}
            style={[styles.primaryButton, { borderColor: colors.primary }]}
          >
            <Text style={[styles.primaryButtonText, { color: colors.primary }]}>
              Get Started
            </Text>
          </TouchableOpacity>

          <Text style={[styles.legalText, { color: colors.textLight }]}>
            By continuing, you agree to our Terms of Service and Privacy Policy. This application is not a substitute for professional medical advice.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const FeatureItem = ({ icon, title, description, colors }: any) => (
  <View style={styles.featureItem}>
    <View style={styles.featureIcon}>
      <Feather name={icon} size={20} color={colors.primary} />
    </View>
    <View style={styles.featureContent}>
      <Text style={[styles.featureTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.featureDescription, { color: colors.textMuted }]}>{description}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 40,
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 64,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 64,
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 32,
    alignItems: 'flex-start',
  },
  featureIcon: {
    marginTop: 2,
    marginRight: 20,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    marginTop: 'auto',
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  legalText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});

export default OnboardingScreen;
