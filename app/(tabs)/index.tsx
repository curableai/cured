import { chatSessionService } from '@/lib/chatSessionService';
import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface VitalCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  unit: string;
}

const VitalCard: React.FC<VitalCardProps> = ({ icon, label, value, unit }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.vitalCard, { borderColor: colors.border }]}>
      <View style={[styles.vitalHeader, { justifyContent: 'center' }]}>
        <Ionicons name={icon} size={14} color={colors.primary} />
        <Text style={[styles.vitalLabel, { color: colors.textMuted, textAlign: 'center' }]}>{label}</Text>
      </View>
      <View style={styles.vitalValueContainer}>
        <Text style={[styles.vitalValue, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.vitalUnit, { color: colors.textMuted }]}>{unit}</Text>
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [userName, setUserName] = useState<string>('there');
  const [recentSessions, setRecentSessions] = useState<any[]>([]);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: onboarding } = await supabase
        .from('onboarding')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      if (onboarding?.full_name) {
        setUserName(onboarding.full_name.split(' ')[0]);
      }

      const sessions = await chatSessionService.getUserSessions(user.id);
      setRecentSessions(sessions.slice(0, 3));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header Section */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.text }]}>
            Good morning, {userName}
          </Text>
          <Text style={[styles.subtext, { color: colors.textMuted }]}>
            Last check-in: Today, 8:30 AM
          </Text>
        </View>

        {/* Vitals Grid */}
        <View style={styles.vitalsGrid}>
          <VitalCard
            icon="heart-outline"
            label="Heart Rate"
            value="72"
            unit="bpm"
          />
          <VitalCard
            icon="thermometer-outline"
            label="Blood Pressure"
            value="120/80"
            unit="mmHg"
          />
          <VitalCard
            icon="moon-outline"
            label="Sleep"
            value="7.5"
            unit="hrs"
          />
          <VitalCard
            icon="walk-outline"
            label="Steps"
            value="8,432"
            unit="steps"
          />
        </View>

        {/* Summary Section */}
        <View style={styles.summarySection}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Today's Clinical Summary</Text>
          <View style={[styles.summaryCard, { backgroundColor: '#0D0D0D' }]}>
            <Text style={[styles.summaryText, { color: colors.text }]}>
              Monitoring vitals in real-time. Your circadian rhythm suggests optimal sleep last night. System status: All metrics nominal.
            </Text>
          </View>
        </View>

        {/* Recent AI Activity */}
        <View style={styles.historySection}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Pinned Investigations</Text>

          {recentSessions.length > 0 ? (
            <View style={{ gap: 12 }}>
              {recentSessions.map((session) => (
                <TouchableOpacity
                  key={session.id}
                  style={[styles.historyCard, { backgroundColor: '#0D0D0D' }]}
                  onPress={() => router.push({ pathname: '/ai-assistant', params: { sessionId: session.id } })}
                >
                  <View style={styles.historyIcon}>
                    <Ionicons name="analytics" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historyText, { color: colors.text }]} numberOfLines={1}>{session.title}</Text>
                    <Text style={[styles.historySubtext, { color: colors.textMuted }]}>
                      {new Date(session.updated_at).toLocaleDateString()} • {session.message_count} messages
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/ai-assistant')}
              style={[styles.historyCard, { backgroundColor: '#0D0D0D' }]}
            >
              <View style={styles.historyIcon}>
                <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.historyText, { color: colors.text }]}>Start Clinical Investigation</Text>
                <Text style={[styles.historySubtext, { color: colors.textMuted }]}>Talk to Curable AI about your health status</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 100, // Space for the tab bar
  },
  header: {
    marginBottom: 40,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtext: {
    fontSize: 15,
    fontWeight: '400',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  vitalCard: {
    width: '47%',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    aspectRatio: 1,
    justifyContent: 'space-between',
  },
  vitalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vitalLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  vitalValueContainer: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    width: '100%',
  },
  vitalValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  vitalUnit: {
    fontSize: 14,
    fontWeight: '400',
  },
  summarySection: {
    marginTop: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  summaryCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  historySection: {
    marginTop: 32,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  historyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,107,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  historyText: {
    fontSize: 15,
    fontWeight: '700'
  },
  historySubtext: {
    fontSize: 12,
    marginTop: 2
  }
});