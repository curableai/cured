import { useTheme } from '@/lib/theme';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function IndexScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.heroSection}>
          <View style={[styles.logoCircle, { borderColor: colors.primary }]}>
            <Feather name="activity" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Curable</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Clinical Analytics & AI-Driven Health Monitoring
          </Text>
        </View>

        <View style={styles.featuresSection}>
          <FeatureBox
            icon="watch"
            title="Signal Integration"
            description="Synchronize autonomous clinical signals from validated biometric sensors."
            colors={colors}
          />
          <FeatureBox
            icon="shield"
            title="Privacy-First"
            description="Medical-grade data encryption and secure clinical records management."
            colors={colors}
          />
          <FeatureBox
            icon="bar-chart-2"
            title="Predictive Models"
            description="Proprietary AI models to identify potential physiological deviations early."
            colors={colors}
          />
        </View>

        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.primaryButton, { borderColor: colors.primary }]}
            onPress={() => router.push('/login')}
          >
            <Text style={[styles.primaryButtonText, { color: colors.primary }]}>
              Authenticate to Access
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/onboarding')}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.textMuted }]}>
              System Overview
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textLight }]}>
            Curable Terminal v1.2.0 • HIPAA Compliant Environment
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const FeatureBox = ({ icon, title, description, colors }: any) => (
  <View style={styles.featureBox}>
    <View style={styles.featureIcon}>
      <Feather name={icon} size={20} color={colors.primary} />
    </View>
    <View style={styles.featureText}>
      <Text style={[styles.featureTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.featureDescription, { color: colors.textMuted }]}>{description}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 40, paddingTop: 120, paddingBottom: 40, flexGrow: 1 },
  heroSection: { alignItems: 'center', marginBottom: 80 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 36, fontWeight: '700', letterSpacing: -1 },
  subtitle: { fontSize: 16, textAlign: 'center', marginTop: 12, lineHeight: 24, maxWidth: 280 },
  featuresSection: { marginBottom: 60 },
  featureBox: { flexDirection: 'row', marginBottom: 32 },
  featureIcon: { marginRight: 20, marginTop: 2 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  featureDescription: { fontSize: 14, lineHeight: 22 },
  actionSection: { marginBottom: 40 },
  primaryButton: { height: 60, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  primaryButtonText: { fontSize: 16, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  secondaryButton: { height: 50, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 14, fontWeight: '500' },
  footer: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: '#111', paddingTop: 24 },
  footerText: { fontSize: 11, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
});