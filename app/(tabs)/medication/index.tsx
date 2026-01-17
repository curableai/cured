// app/(tabs)/medication/index.tsx - AI Medication Analysis
import { analyzeMedicationsWithAI } from '@/lib/openAIHealthService';
import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
  View
} from 'react-native';

interface Medication {
  id?: string;
  name: string;
  dosage: string;
  frequency: string;
  end_date?: string;
  status?: 'active' | 'completed';
}

interface AIAnalysis {
  effects: string[];
  sideEffects: string[];
  interactions: string[];
  recommendations: string[];
  confidence: number;
}

export default function MedicationAnalyzer() {
  const router = useRouter();
  const { colors } = useTheme();
  const [userId, setUserId] = useState<string>('');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [currentMed, setCurrentMed] = useState<Medication>({ name: '', dosage: '', frequency: '', end_date: undefined });
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    loadUserAndMeds();
  }, []);

  const loadUserAndMeds = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      fetchMedications(user.id);

      // Fetch user name for personalized button
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (profile?.full_name) {
        setUserName(profile.full_name.split(' ')[0]); // Get first name
      }
    }
  };

  const fetchMedications = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data) {
        // Map DB fields to local state
        const loadedMeds = data.map(m => ({
          name: m.medication_name,
          dosage: m.dosage,
          frequency: m.frequency,
          end_date: m.end_date,
          status: m.status || 'active',
          id: m.id
        }));
        setMedications(loadedMeds);
      }
    } catch (error) {
      console.error('Error fetching medications:', error);
    }
  };

  const handleAddMedication = async () => {
    if (currentMed.name && currentMed.dosage && userId) {
      try {
        const { data, error } = await supabase
          .from('medications')
          .insert({
            user_id: userId,
            medication_name: currentMed.name,
            dosage: currentMed.dosage,
            frequency: currentMed.frequency,
            end_date: currentMed.end_date || null,
            status: 'active'
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const newMed = {
            name: data.medication_name,
            dosage: data.dosage,
            frequency: data.frequency,
            end_date: data.end_date,
            status: data.status || 'active',
            id: data.id
          };
          setMedications([...medications, newMed]);
          setCurrentMed({ name: '', dosage: '', frequency: '', end_date: undefined });
          setSelectedEndDate(undefined);
          setShowInput(false);
          setAnalysis(null);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to save medication.');
        console.error(error);
      }
    }
  };

  const removeMedication = async (index: number) => {
    const medToDelete = medications[index];
    // Optimize UI first
    setMedications(medications.filter((_, i) => i !== index));
    setAnalysis(null);

    if (medToDelete.id) {
      try {
        const { error } = await supabase
          .from('medications')
          .delete()
          .eq('id', medToDelete.id);

        if (error) {
          console.error('Error deleting med:', error);
          // Ideally revert UI state here if failed
          loadUserAndMeds(); // Reload to sync
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleAnalyze = async () => {
    if (medications.length === 0) return;

    setAnalyzing(true);
    setAnalysis(null);

    try {
      const result = await analyzeMedicationsWithAI(userId, medications);

      if (result) {
        setAnalysis(result);
      } else {
        Alert.alert('Analysis Failed', 'Could not retrieve clinical insights. Please try again.');
      }
    } catch (error) {
      console.error('AI Analysis Error:', error);
      Alert.alert('Server Error', 'The clinical AI is currently busy. Please try again in a moment.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>My Medications</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Manage and analyze your current medications and interactions.
            </Text>
          </View>

          {/* Active Regimen List */}
          {medications.length > 0 && (
            <View style={[styles.medicationList, { marginBottom: 32 }]}>
              <View style={[styles.cardHeader, { marginBottom: 16 }]}>
                <Text style={[styles.cardTitle, { color: colors.textMuted }]}>ACTIVE REGIMEN ({medications.length})</Text>
              </View>
              {medications.map((med, index) => (
                <View key={index} style={styles.medItem}>
                  <View style={styles.medInfo}>
                    <View style={[styles.iconBox, { backgroundColor: 'rgba(255,107,0,0.1)' }]}>
                      <Ionicons name="medical" size={20} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={[styles.medName, { color: colors.text }]}>{med.name}</Text>
                      <Text style={[styles.medDetails, { color: colors.textMuted }]}>
                        {med.dosage} • {med.frequency}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => removeMedication(index)}>
                    <Ionicons name="trash-outline" size={20} color="#FF5252" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Entry Card */}
          <View style={[styles.card, { backgroundColor: '#0D0D0D' }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
                {showInput ? "Entry Terminal" : "Log New Medication"}
              </Text>
              <TouchableOpacity
                onPress={() => setShowInput(!showInput)}
                style={[styles.addButton, { borderColor: colors.primary, backgroundColor: showInput ? colors.primary : 'transparent' }]}
              >
                <Ionicons name={showInput ? "close" : "add"} size={24} color={showInput ? "#fff" : colors.primary} />
              </TouchableOpacity>
            </View>

            {
              showInput && (
                <>
                  <View style={styles.inputSection}>
                    <TextInput
                      style={[styles.input, { color: colors.text, borderColor: 'rgba(255,255,255,0.1)' }]}
                      placeholder="Medication name"
                      placeholderTextColor={colors.textLight}
                      value={currentMed.name}
                      onChangeText={(text) => setCurrentMed({ ...currentMed, name: text })}
                    />
                    <View style={styles.inputRow}>
                      <TextInput
                        style={[styles.input, styles.inputHalf, { color: colors.text, borderColor: 'rgba(255,255,255,0.1)' }]}
                        placeholder="Dosage (e.g., 500mg)"
                        placeholderTextColor={colors.textLight}
                        value={currentMed.dosage}
                        onChangeText={(text) => setCurrentMed({ ...currentMed, dosage: text })}
                      />
                      <TextInput
                        style={[styles.input, styles.inputHalf, { color: colors.text, borderColor: 'rgba(255,255,255,0.1)' }]}
                        placeholder="How often? (e.g., Twice daily)"
                        placeholderTextColor={colors.textLight}
                        value={currentMed.frequency}
                        onChangeText={(text) => setCurrentMed({ ...currentMed, frequency: text })}
                      />
                    </View>
                  </View>

                  {/* End Date (Optional) */}
                  <View style={{ marginTop: 16 }}>
                    <Text style={[styles.label, { color: colors.text, fontSize: 13, marginBottom: 8 }]}>End Date (Optional)</Text>
                    <TouchableOpacity
                      onPress={() => setShowEndDatePicker(true)}
                      style={[styles.input, { justifyContent: 'center', backgroundColor: '#121212' }]}
                    >
                      <Text style={{ color: selectedEndDate ? colors.text : colors.textLight }}>
                        {selectedEndDate ? selectedEndDate.toLocaleDateString() : 'Tap to set end date'}
                      </Text>
                    </TouchableOpacity>
                    {selectedEndDate && (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedEndDate(undefined);
                          setCurrentMed({ ...currentMed, end_date: undefined });
                        }}
                        style={{ marginTop: 8 }}
                      >
                        <Text style={{ color: colors.primary, fontSize: 14 }}>Clear end date</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {showEndDatePicker && (
                    <DateTimePicker
                      value={selectedEndDate || new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      minimumDate={new Date()}
                      onChange={(event, date) => {
                        setShowEndDatePicker(Platform.OS === 'ios');
                        if (date) {
                          setSelectedEndDate(date);
                          setCurrentMed({ ...currentMed, end_date: date.toISOString().split('T')[0] });
                        }
                      }}
                    />
                  )}

                  <TouchableOpacity onPress={handleAddMedication} style={[styles.submitButton, { backgroundColor: colors.primary }]}>
                    <Text style={styles.submitButtonText}>Add Medication</Text>
                  </TouchableOpacity>
                </>
              )
            }
          </View>

          {
            medications.length === 0 && !showInput && (
              <View style={styles.emptyContainer}>
                <Ionicons name="layers-outline" size={48} color="rgba(255,255,255,0.1)" />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No pharmacological data entered.</Text>
              </View>
            )
          }

          {
            medications.length > 0 && (
              <TouchableOpacity
                onPress={handleAnalyze}
                disabled={analyzing}
                style={[styles.analyzeButton, { backgroundColor: colors.primary }, analyzing && { opacity: 0.7 }]}
              >
                {analyzing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.analyzeButtonText}>Effect of drug on {userName || 'User'}</Text>
                )}
              </TouchableOpacity>
            )
          }

          {/* AI Results Section */}
          {
            analysis && (
              <View style={styles.results}>
                <View style={[styles.resultCard, { backgroundColor: '#121212' }]}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="flash" size={20} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Insights & Benefits</Text>
                  </View>
                  {analysis.effects.map((item, i) => (
                    <View key={i} style={styles.resultItem}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                      <Text style={[styles.resultText, { color: colors.textMuted }]}>{item}</Text>
                    </View>
                  ))}
                </View>

                <View style={[styles.resultCard, { backgroundColor: '#121212' }]}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="alert-circle" size={20} color="#FFC107" />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Potential Side Effects</Text>
                  </View>
                  {analysis.sideEffects.map((item, i) => (
                    <View key={i} style={styles.resultItem}>
                      <Ionicons name="radio-button-on" size={16} color="#FFC107" />
                      <Text style={[styles.resultText, { color: colors.textMuted }]}>{item}</Text>
                    </View>
                  ))}
                </View>

                <LinearGradient
                  colors={['#1A1A1A', '#000000']}
                  style={styles.guideCard}
                >
                  <View style={styles.sectionHeader}>
                    <Ionicons name="shield-checkmark" size={20} color="#00E676" />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Safe Usage Guidance</Text>
                  </View>
                  {analysis.recommendations.map((item, i) => (
                    <Text key={i} style={[styles.guideText, { color: colors.textMuted }]}>• {item}</Text>
                  ))}
                </LinearGradient>
              </View>
            )
          }
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingVertical: 60, paddingBottom: 100 },
  header: { marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 8, letterSpacing: -1 },
  subtitle: { fontSize: 16, fontWeight: '400', opacity: 0.7 },

  card: { borderRadius: 32, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255, 107, 0, 0.05)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  addButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  inputSection: { marginBottom: 24, gap: 16 },
  input: { height: 60, borderRadius: 20, borderWidth: 1, paddingHorizontal: 20, fontSize: 16, backgroundColor: 'rgba(255,255,255,0.02)' },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputHalf: { flex: 1 },
  submitButton: { height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  label: { fontSize: 14, fontWeight: '600', marginBottom: 4 },

  medicationList: { gap: 12 },
  medItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  medInfo: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBox: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  medName: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  medDetails: { fontSize: 14, opacity: 0.6 },

  emptyContainer: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  emptyText: { fontSize: 16, fontWeight: '500', opacity: 0.5 },

  analyzeButton: { height: 72, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 40, elevation: 8, shadowColor: '#FF6B00', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  analyzeButtonText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },

  results: { gap: 24, marginTop: 24 },
  resultCard: { padding: 28, borderRadius: 32, gap: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  resultItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  resultText: { flex: 1, fontSize: 15, lineHeight: 24, opacity: 0.8 },

  guideCard: { padding: 32, borderRadius: 32, gap: 20, overflow: 'hidden' },
  guideText: { fontSize: 15, lineHeight: 26, opacity: 0.9 },
});