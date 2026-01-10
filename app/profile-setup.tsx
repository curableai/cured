import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { clinicalSignalService } from '@/services/clinicalSignalCapture';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
  View
} from 'react-native';

interface OnboardingData {
  full_name: string;
  date_of_birth: string;
  gender: string;
  weight_kg: string;
  height_cm: string;
  location: string;
  blood_group: string;
  smoker: boolean;
  alcohol_drinker: boolean;
  chronic_conditions: string[];
  long_term_medications: string;
  family_history: string[];
  genotype: string;
}

const GENOTYPES = ['AA', 'AS', 'AC', 'SS', 'SC'];

const CHRONIC_CONDITIONS = [
  'Hypertension', 'Diabetes', 'Asthma', 'Sickle Cell', 'Heart Disease',
  'Cancer', 'Kidney Disease', 'Liver Disease', 'Thyroid Disorder', 'Other'
];

const FAMILY_HISTORY_CONDITIONS = [
  'Hypertension', 'Diabetes', 'Cancer', 'Heart Disease', 'Stroke',
  'Mental Health Issues', 'Kidney Disease', 'Other'
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function Onboarding() {
  const router = useRouter();
  const { colors } = useTheme();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    full_name: '',
    date_of_birth: '',
    gender: '',
    weight_kg: '',
    height_cm: '',
    location: '',
    blood_group: '',
    smoker: false,
    alcohol_drinker: false,
    chronic_conditions: [],
    long_term_medications: '',
    family_history: [],
    genotype: ''
  });

  const totalSteps = 4;

  const handleInputChange = (field: keyof OnboardingData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: 'chronic_conditions' | 'family_history', item: string) => {
    setData(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter((x: string) => x !== item)
        : [...prev[field], item]
    }));
  };

  const validateStep = (): boolean => {
    switch (currentStep) {
      case 1:
        if (!data.full_name.trim()) {
          Alert.alert('Required', 'Please enter your full name');
          return false;
        }
        if (!data.date_of_birth) {
          Alert.alert('Required', 'Please enter your date of birth');
          return false;
        }
        if (!data.gender) {
          Alert.alert('Required', 'Please select your gender');
          return false;
        }
        return true;
      case 2:
        if (!data.weight_kg || parseFloat(data.weight_kg) <= 0) {
          Alert.alert('Required', 'Please enter your weight');
          return false;
        }
        if (!data.height_cm || parseFloat(data.height_cm) <= 0) {
          Alert.alert('Required', 'Please enter your height');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep()) {
      if (currentStep < totalSteps) {
        setCurrentStep(prev => prev + 1);
      } else {
        submitOnboarding();
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const submitOnboarding = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Save onboarding data
      const { error: onboardingError } = await supabase
        .from('onboarding')
        .insert({
          user_id: user.id,
          full_name: data.full_name,
          date_of_birth: data.date_of_birth,
          gender: data.gender,
          weight_kg: parseFloat(data.weight_kg),
          height_cm: parseFloat(data.height_cm),
          location: data.location || null,
          blood_group: data.blood_group || null,
          smoker: data.smoker,
          alcohol_drinker: data.alcohol_drinker,
          chronic_conditions: data.chronic_conditions,
          long_term_medications: data.long_term_medications.split('\n').filter((x: string) => x.trim()),
          family_history: data.family_history,
          genotype: data.genotype || null
        });

      if (onboardingError) throw onboardingError;

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          onboarding_completed: true,
          full_name: data.full_name,
          height_cm: parseFloat(data.height_cm),
          weight_kg: parseFloat(data.weight_kg)
        });

      if (profileError) throw profileError;

      // Capture clinical signals
      try {
        const now = new Date().toISOString();
        const signalsToCapture = [];

        if (data.weight_kg) {
          signalsToCapture.push(clinicalSignalService.captureSignal({
            signalId: 'weight',
            value: parseFloat(data.weight_kg),
            unit: 'kg',
            source: 'onboarding',
            context: {},
            capturedAt: now
          }));
        }

        if (data.height_cm) {
          signalsToCapture.push(clinicalSignalService.captureSignal({
            signalId: 'height',
            value: parseFloat(data.height_cm),
            unit: 'cm',
            source: 'onboarding',
            context: {},
            capturedAt: now
          }));
        }

        if (data.gender) {
          signalsToCapture.push(clinicalSignalService.captureSignal({
            signalId: 'sex',
            value: data.gender.toLowerCase(),
            unit: 'n/a',
            source: 'onboarding',
            context: {},
            capturedAt: now
          }));
        }

        if (data.date_of_birth) {
          const dob = new Date(data.date_of_birth);
          const age = Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);

          signalsToCapture.push(clinicalSignalService.captureSignal({
            signalId: 'age',
            value: age,
            unit: 'years',
            source: 'onboarding',
            context: {},
            capturedAt: now
          }));
        }

        if (data.chronic_conditions?.length > 0) {
          data.chronic_conditions.forEach(condition => {
            signalsToCapture.push(clinicalSignalService.captureSignal({
              signalId: 'chronic_condition',
              value: condition.toLowerCase(),
              unit: 'n/a',
              source: 'onboarding',
              context: {},
              capturedAt: now
            }));
          });
        }

        if (data.genotype) {
          signalsToCapture.push(clinicalSignalService.captureSignal({
            signalId: 'genotype',
            value: data.genotype.toLowerCase(),
            unit: 'n/a',
            source: 'onboarding',
            context: {},
            capturedAt: now
          }));
        }

        await Promise.all(signalsToCapture);
      } catch (signalError) {
        console.error('Failed to capture clinical signals:', signalError);
      }

      Alert.alert(
        'Profile Created',
        'Your clinical profile has been successfully established.',
        [
          {
            text: 'I Understand',
            onPress: () => router.replace('/disclaimer')
          }
        ]
      );

    } catch (error: any) {
      console.error('Error saving onboarding:', error);
      Alert.alert('Error', error.message || 'Failed to save information');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Identity</Text>
              <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>Verify your clinical identity details</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Full Medical Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                placeholder="Name as it appears on records"
                placeholderTextColor="#666"
                value={data.full_name}
                onChangeText={(text) => handleInputChange('full_name', text)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Date of Birth</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#666"
                value={data.date_of_birth}
                onChangeText={(text) => handleInputChange('date_of_birth', text)}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Biological Sex</Text>
              <View style={styles.optionsGrid}>
                {['Male', 'Female', 'Other'].map((gender) => (
                  <TouchableOpacity
                    key={gender}
                    style={[
                      styles.optionCard,
                      { backgroundColor: '#121212', borderColor: data.gender === gender ? colors.primary : '#333' }
                    ]}
                    onPress={() => handleInputChange('gender', gender)}
                  >
                    <Text style={[
                      styles.optionLabel,
                      { color: data.gender === gender ? colors.primary : colors.textMuted }
                    ]}>{gender}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Physiology</Text>
              <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>Establish your baseline physical metrics</Text>
            </View>

            <View style={styles.rowInputs}>
              <View style={styles.halfWidth}>
                <Text style={[styles.label, { color: colors.text }]}>Weight (kg)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                  placeholder="0.0"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={data.weight_kg}
                  onChangeText={(text) => handleInputChange('weight_kg', text)}
                />
              </View>
              <View style={styles.halfWidth}>
                <Text style={[styles.label, { color: colors.text }]}>Height (cm)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                  placeholder="170"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={data.height_cm}
                  onChangeText={(text) => handleInputChange('height_cm', text)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Blood Group</Text>
              <View style={styles.bloodGroupGrid}>
                {BLOOD_GROUPS.map((bg) => (
                  <TouchableOpacity
                    key={bg}
                    style={[
                      styles.bloodGroupButton,
                      { backgroundColor: '#121212', borderColor: data.blood_group === bg ? colors.primary : '#333' }
                    ]}
                    onPress={() => handleInputChange('blood_group', bg)}
                  >
                    <Text style={[
                      styles.bloodGroupText,
                      { color: data.blood_group === bg ? colors.primary : colors.textMuted }
                    ]}>{bg}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Behavioral Factors</Text>
              <TouchableOpacity
                style={[styles.toggleRow, { borderColor: '#333' }]}
                onPress={() => handleInputChange('smoker', !data.smoker)}
              >
                <Text style={[styles.toggleLabel, { color: colors.text }]}>Current Smoker</Text>
                <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: data.smoker ? colors.primary : 'transparent' }]}>
                  {data.smoker && <Ionicons name="checkmark" size={12} color="#000" />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleRow, { borderColor: '#333' }]}
                onPress={() => handleInputChange('alcohol_drinker', !data.alcohol_drinker)}
              >
                <Text style={[styles.toggleLabel, { color: colors.text }]}>Regular Alcohol Consumption</Text>
                <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: data.alcohol_drinker ? colors.primary : 'transparent' }]}>
                  {data.alcohol_drinker && <Ionicons name="checkmark" size={12} color="#000" />}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Medical History</Text>
              <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>Document diagnosed chronic conditions</Text>
            </View>

            <View style={styles.conditionsGrid}>
              {CHRONIC_CONDITIONS.map((condition) => (
                <TouchableOpacity
                  key={condition}
                  style={[
                    styles.conditionChip,
                    {
                      backgroundColor: data.chronic_conditions.includes(condition) ? colors.primary + '22' : '#121212',
                      borderColor: data.chronic_conditions.includes(condition) ? colors.primary : '#333'
                    }
                  ]}
                  onPress={() => toggleArrayItem('chronic_conditions', condition)}
                >
                  <Text style={[
                    styles.conditionChipText,
                    { color: data.chronic_conditions.includes(condition) ? colors.primary : colors.textMuted }
                  ]}>{condition}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Active Medications</Text>
              <TextInput
                style={[styles.textarea, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                placeholder="List ongoing medications (one per line)"
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                value={data.long_term_medications}
                onChangeText={(text) => handleInputChange('long_term_medications', text)}
              />
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Genetic History</Text>
              <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>Identify hereditary clinical risks</Text>
            </View>

            <View style={styles.conditionsGrid}>
              {FAMILY_HISTORY_CONDITIONS.map((condition) => (
                <TouchableOpacity
                  key={condition}
                  style={[
                    styles.conditionChip,
                    {
                      backgroundColor: data.family_history.includes(condition) ? colors.primary + '22' : '#121212',
                      borderColor: data.family_history.includes(condition) ? colors.primary : '#333'
                    }
                  ]}
                  onPress={() => toggleArrayItem('family_history', condition)}
                >
                  <Text style={[
                    styles.conditionChipText,
                    { color: data.family_history.includes(condition) ? colors.primary : colors.textMuted }
                  ]}>{condition}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Geographic Location</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                placeholder="City, Country"
                placeholderTextColor="#666"
                value={data.location}
                onChangeText={(text) => handleInputChange('location', text)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Genotype</Text>
              <View style={styles.bloodGroupGrid}>
                {GENOTYPES.map((gt) => (
                  <TouchableOpacity
                    key={gt}
                    style={[
                      styles.bloodGroupButton,
                      { backgroundColor: '#121212', borderColor: data.genotype === gt ? colors.primary : '#333' }
                    ]}
                    onPress={() => handleInputChange('genotype', gt)}
                  >
                    <Text style={[
                      styles.bloodGroupText,
                      { color: data.genotype === gt ? colors.primary : colors.textMuted }
                    ]}>{gt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressText, { color: colors.textMuted }]}>
              Assessment Stage {currentStep} of {totalSteps}
            </Text>
            <View style={styles.progressBar}>
              {Array.from({ length: totalSteps }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressSegment,
                    { backgroundColor: i < currentStep ? colors.primary : '#222' }
                  ]}
                />
              ))}
            </View>
          </View>

          {renderStep()}

          <View style={styles.buttonContainer}>
            {currentStep > 1 && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={prevStep}
                disabled={loading}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.textMuted }]}>Back</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, { borderColor: colors.primary, marginLeft: currentStep > 1 ? 12 : 0, flex: 1 }]}
              onPress={nextStep}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.primary }]}>
                  {currentStep === totalSteps ? 'Finalize Profile' : 'Continue'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: 60, paddingBottom: 40 },
  progressHeader: { marginBottom: 48 },
  progressText: { fontSize: 12, fontWeight: '500', marginBottom: 12, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  progressBar: { flexDirection: 'row', gap: 6 },
  progressSegment: { flex: 1, height: 2, borderRadius: 1 },
  stepContainer: { flex: 1 },
  stepHeader: { marginBottom: 40 },
  stepTitle: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  stepSubtitle: { fontSize: 15, lineHeight: 22 },
  inputGroup: { marginBottom: 32 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { height: 56, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 16 },
  textarea: { height: 120, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingTop: 16, fontSize: 16, textAlignVertical: 'top' },
  rowInputs: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  halfWidth: { flex: 1 },
  optionsGrid: { flexDirection: 'row', gap: 12 },
  optionCard: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
  optionLabel: { fontSize: 15, fontWeight: '600' },
  bloodGroupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bloodGroupButton: { width: '22%', height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1 },
  bloodGroupText: { fontSize: 14, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1 },
  toggleLabel: { fontSize: 15 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  conditionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  conditionChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  conditionChipText: { fontSize: 13, fontWeight: '500' },
  buttonContainer: { flexDirection: 'row', marginTop: 40 },
  primaryButton: { height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 16, fontWeight: '600' },
  secondaryButton: { width: 80, height: 56, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 16, fontWeight: '500' },
});