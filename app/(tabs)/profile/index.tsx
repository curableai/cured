// app/(tabs)/profile/index.tsx
import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('onboarding').select('*').eq('user_id', user.id).single();
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/login');
        }
      }
    ]);
  };

  const menuItems = [
    { label: 'Clinical Bio-Data', icon: 'finger-print', route: '/clinical-biodata' },
    { label: 'Pharmacological Regimen', icon: 'medical', route: '/medication' },
    { label: 'Sensor Integration', icon: 'watch', route: '/connect-device' },
    { label: 'System Disclaimer', icon: 'document-text', route: '/disclaimer' },
    { label: 'Support Terminal', icon: 'help-buoy', route: null },
  ];

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Profile Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
          <View style={styles.profileBox}>
            <View style={[styles.avatar, { borderColor: colors.primary }]}>
              <Ionicons name="person" size={44} color={colors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.name, { color: colors.text }]}>{profile?.full_name || 'Anonymous'}</Text>
              <View style={styles.statusBadge}>
                <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
                <Text style={[styles.statusText, { color: colors.primary }]}>Verified Patient</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Menu List */}
        <View style={styles.listSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.listItem, { backgroundColor: '#0D0D0D' }]}
              onPress={() => {
                if (item.label === 'Support Terminal') {
                  Alert.alert('Support Terminal', 'Phone: 08105535057\nEmail: curable4@gmail.com');
                } else if (item.route) {
                  router.push(item.route as any);
                } else {
                  Alert.alert('Coming Soon', 'This terminal feature is under development.');
                }
              }}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,107,0,0.08)' }]}>
                  <Ionicons name={item.icon as any} size={22} color={colors.primary} />
                </View>
                <Text style={[styles.listLabel, { color: colors.text }]}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.2)" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity onPress={handleSignOut} style={[styles.signOutButton, { borderColor: '#FF5252' }]}>
          <Ionicons name="log-out-outline" size={20} color="#FF5252" />
          <Text style={[styles.signOutText, { color: '#FF5252' }]}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={[styles.versionText, { color: colors.textLight }]}>Curable App v1.2.0 • HIPAA Secure</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingVertical: 60, paddingBottom: 120 },
  header: { marginBottom: 44 },
  headerTitle: { fontSize: 32, fontWeight: '800', marginBottom: 32, letterSpacing: -1 },
  profileBox: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D0D0D' },
  profileInfo: { gap: 6 },
  name: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,107,0,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start' },
  statusText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  listSection: { gap: 12 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255, 107, 0, 0.05)' },
  listItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconContainer: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  listLabel: { fontSize: 16, fontWeight: '600' },

  signOutButton: {
    marginTop: 40,
    height: 68,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 82, 82, 0.05)'
  },
  signOutText: { fontSize: 16, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  versionText: { textAlign: 'center', fontSize: 12, marginTop: 40, opacity: 0.4, letterSpacing: 0.5 },
});
