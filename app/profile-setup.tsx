import { useAuthStore } from '@/lib/authStore';
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


// ... imports ...

interface OnboardingData {
  full_name: string;
  date_of_birth: string;
  gender: string;
  // New fields
  occupation_category: string;
  work_hours: string; // New
  work_environment: string; // New
  work_related_health_issues: string; // New
  work_exposures: string[];
  work_stress_level: string;
  // Existing fields
  weight_kg: string;
  height_cm: string;
  location: string;
  blood_group: string;
  smoker: boolean;
  alcohol_drinker: boolean;
  other_behavioral_factors: string;
  chronic_conditions: string[];
  other_chronic_conditions: string;
  long_term_medications: string;
  family_history: string[];
  other_family_history: string;
  genotype: string;
  occupation: string;
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

// New Constants for Step 2
// Removed OCCUPATION_OPTIONS as it is now free text

const ENVIRONMENT_OPTIONS = [
  'Indoor / Office', 'Outdoor / Field', 'Remote / Home', 'Mixed (Indoor & Outdoor)', 'Vehicle / Transport'
];

const WORK_HOURS_OPTIONS = [
  '1-2 hours', '3-4 hours', '5-6 hours', '7-8 hours', '9-10 hours', '10+ hours'
];

const WORK_EXPOSURES = [
  'Long sitting', 'Long standing or lifting', 'Night shifts or late nights',
  'Dust, smoke, or chemicals', 'Blood or body fluid exposure', 'Loud noise',
  'Heat or sun exposure'
];

const STRESS_LEVEL_OPTIONS = [
  'I feel okay most days',
  'I feel tired or overwhelmed often',
  'I feel anxious most days',
  'I feel down or unmotivated for weeks',
  'I’d rather not say'
];

export default function Onboarding() {
  const router = useRouter();
  const { colors } = useTheme();
  const { setHasCompletedOnboarding } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    full_name: '',
    date_of_birth: '',
    gender: '',
    // Initialize new fields
    occupation_category: '', // Now free text
    work_hours: '',
    work_environment: '',
    work_related_health_issues: '',
    work_exposures: [],
    work_stress_level: '',
    weight_kg: '',
    height_cm: '',
    location: '',
    blood_group: '',
    smoker: false,
    alcohol_drinker: false,
    other_behavioral_factors: '',
    chronic_conditions: [],
    other_chronic_conditions: '',
    long_term_medications: '',
    family_history: [],
    other_family_history: '',
    genotype: '',
    occupation: ''
  });

  const totalSteps = 5; // Updated from 4
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');

  const handleInputChange = (field: keyof OnboardingData, value: any) => {
    console.log('[handleInputChange]', field, value);
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleHeightUnitChange = (unit: 'cm' | 'ft') => {
    if (unit === heightUnit) return;
    setHeightUnit(unit);

    // Convert current value
    if (unit === 'ft') {
      // CM to FT/IN
      if (data.height_cm) {
        const cm = parseFloat(data.height_cm);
        const totalInches = cm / 2.54;
        const ft = Math.floor(totalInches / 12);
        const inc = Math.round(totalInches % 12);
        setFeet(ft.toString());
        setInches(inc.toString());
      } else {
        setFeet('');
        setInches('');
      }
    } else {
      // FT/IN to CM
      if (feet || inches) {
        const ft = parseFloat(feet) || 0;
        const inc = parseFloat(inches) || 0;
        const cm = Math.round(((ft * 12) + inc) * 2.54);
        handleInputChange('height_cm', cm.toString());
      } else {
        handleInputChange('height_cm', '');
      }
    }
  };

  const updateHeightFromImperial = (f: string, i: string) => {
    setFeet(f);
    setInches(i);
    const ft = parseFloat(f) || 0;
    const inc = parseFloat(i) || 0;
    if (ft > 0 || inc > 0) {
      const cm = Math.round(((ft * 12) + inc) * 2.54);
      handleInputChange('height_cm', cm.toString());
    } else {
      handleInputChange('height_cm', '');
    }
  };


  const toggleArrayItem = (field: 'chronic_conditions' | 'family_history' | 'work_exposures', item: string) => {
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
      case 2: // New Step: Occupation & Context
        if (!data.occupation_category.trim()) {
          Alert.alert('Required', 'Please enter your occupation');
          return false;
        }
        if (!data.work_hours) {
          Alert.alert('Required', 'Please select your work hours');
          return false;
        }
        if (!data.work_stress_level) {
          Alert.alert('Required', 'Please answer the check-in question');
          return false;
        }
        return true;
      case 3: // Physiology (Was Step 2)
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
    console.log('[Onboarding] Starting submission...');
    setLoading(true);
    try {
      console.log('[Onboarding] Fetching user...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) console.error('[Onboarding] Auth error:', userError);

      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }
      console.log('[Onboarding] User found:', user.id);

      // Save onboarding data
      console.log('[Onboarding] Inserting onboarding data...');
      const { error: onboardingError } = await supabase
        .from('onboarding')
        .insert({
          user_id: user.id,
          full_name: data.full_name,
          date_of_birth: data.date_of_birth,
          gender: data.gender,
          // New fields
          occupation_category: data.occupation_category,
          work_hours: data.work_hours,
          work_environment: data.work_environment,
          work_related_health_issues: data.work_related_health_issues,
          work_exposures: data.work_exposures,
          work_stress_level: data.work_stress_level,

          weight_kg: parseFloat(data.weight_kg),
          height_cm: parseFloat(data.height_cm),
          location: data.location || null,
          blood_group: data.blood_group || null,
          smoker: data.smoker,
          alcohol_drinker: data.alcohol_drinker,
          other_behavioral_factors: data.other_behavioral_factors || null,
          chronic_conditions: data.chronic_conditions,
          other_chronic_conditions: data.other_chronic_conditions || null,
          long_term_medications: data.long_term_medications.split('\n').filter((x: string) => x.trim()),
          family_history: data.family_history,
          other_family_history: data.other_family_history || null,
          genotype: data.genotype || null,
          occupation: data.occupation || null
        });

      if (onboardingError) {
        console.error('[Onboarding] Onboarding insert error:', onboardingError);
        throw onboardingError;
      }
      console.log('[Onboarding] Onboarding data saved.');

      // Update profile
      console.log('[Onboarding] Upserting profile...');
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          onboarding_completed: true,
          full_name: data.full_name,
          height_cm: parseFloat(data.height_cm),
          weight_kg: parseFloat(data.weight_kg)
        });

      if (profileError) {
        console.error('[Onboarding] Profile upsert error:', profileError);
        throw profileError;
      }
      console.log('[Onboarding] Profile updated.');
      setHasCompletedOnboarding(true);

      // Capture clinical signals
      try {
        console.log('[Onboarding] Capturing clinical signals...');
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

        // New Work-Related Signals
        if (data.occupation_category) {
          signalsToCapture.push(clinicalSignalService.captureSignal({
            signalId: 'occupation',
            value: data.occupation_category,
            source: 'onboarding',
            context: {},
            capturedAt: now
          }));
        }

        if (data.work_hours) {
          signalsToCapture.push(clinicalSignalService.captureSignal({
            signalId: 'work_hours',
            value: data.work_hours,
            source: 'onboarding',
            context: {},
            capturedAt: now
          }));
        }

        if (data.work_environment) {
          let envValue = 'mixed';
          if (data.work_environment.includes('Indoor')) envValue = 'indoor_office';
          if (data.work_environment.includes('Outdoor')) envValue = 'outdoor_field';
          if (data.work_environment.includes('Remote')) envValue = 'remote_home';
          if (data.work_environment.includes('Vehicle')) envValue = 'vehicle_transport';

          signalsToCapture.push(clinicalSignalService.captureSignal({
            signalId: 'work_environment',
            value: envValue,
            source: 'onboarding',
            context: {},
            capturedAt: now
          }));
        }

        if (data.work_related_health_issues) {
          signalsToCapture.push(clinicalSignalService.captureSignal({
            signalId: 'work_related_health_issues',
            value: data.work_related_health_issues,
            source: 'onboarding',
            context: {},
            capturedAt: now
          }));
        }

        // Capture Stress Level as a Signal
        if (data.work_stress_level) {
          let stressValue = 'normal';
          if (data.work_stress_level.includes('anxious')) stressValue = 'stressed';
          if (data.work_stress_level.includes('overwhelmed')) stressValue = 'very_stressed';
          if (data.work_stress_level.includes('okay')) stressValue = 'relaxed';

          signalsToCapture.push(clinicalSignalService.captureSignal({
            signalId: 'stress_level',
            value: stressValue,
            unit: 'n/a',
            source: 'onboarding',
            context: { notes: data.work_stress_level },
            capturedAt: now
          }));
        }

        if (data.chronic_conditions?.length > 0) {
          data.chronic_conditions.forEach(condition => {
            if (condition === 'Other' && data.other_chronic_conditions) {
              signalsToCapture.push(clinicalSignalService.captureSignal({
                signalId: 'chronic_condition',
                value: data.other_chronic_conditions.toLowerCase(),
                unit: 'n/a',
                source: 'onboarding',
                context: {},
                capturedAt: now
              }));
            } else if (condition !== 'Other') {
              signalsToCapture.push(clinicalSignalService.captureSignal({
                signalId: 'chronic_condition',
                value: condition.toLowerCase(),
                unit: 'n/a',
                source: 'onboarding',
                context: {},
                capturedAt: now
              }));
            }
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
        console.log('[Onboarding] All signals captured.');
      } catch (signalError) {
        console.error('[Onboarding] Failed to capture clinical signals:', signalError);
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
      console.error('[Onboarding] FINAL CATCH error:', error);
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
                maxLength={10}
                keyboardType="numeric"
                onChangeText={(text) => {
                  const numeric = text.replace(/[^0-9]/g, '');
                  let formatted = numeric;
                  if (numeric.length > 4) {
                    formatted = numeric.slice(0, 4) + '-' + numeric.slice(4);
                  }
                  if (numeric.length > 6) {
                    formatted = formatted.slice(0, 7) + '-' + numeric.slice(6);
                  }
                  if (formatted.length > 10) formatted = formatted.slice(0, 10);
                  handleInputChange('date_of_birth', formatted);
                }}
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

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Occupation</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                placeholder="Examples: Teacher, Engineer, Student"
                placeholderTextColor="#666"
                value={data.occupation}
                onChangeText={(text) => handleInputChange('occupation', text)}
              />
            </View>
          </View>
        );

      case 2: // NEW STEP: Occupation & Content
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Occupation & Context</Text>
              <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>Help us understand your environmental risks.</Text>
            </View>

            {/* Question 1: Occupation (Free Text) */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>What is your occupation?</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                placeholder="E.g. Student, Software Engineer, Nurse..."
                placeholderTextColor="#666"
                value={data.occupation_category}
                onChangeText={(text) => handleInputChange('occupation_category', text)}
              />
            </View>

            {/* Question 1.5: Work Hours (Selection) */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Average Work Hours (Daily)</Text>
              <View style={styles.conditionsGrid}>
                {WORK_HOURS_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.conditionChip,
                      {
                        backgroundColor: data.work_hours === option ? colors.primary + '22' : '#121212',
                        borderColor: data.work_hours === option ? colors.primary : '#333'
                      }
                    ]}
                    onPress={() => handleInputChange('work_hours', option)}
                  >
                    <Text style={[
                      styles.conditionChipText,
                      { color: data.work_hours === option ? colors.primary : colors.textMuted }
                    ]}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Question 1.7: Work Environment (Selection) */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Work Environment</Text>
              <View style={styles.conditionsGrid}>
                {ENVIRONMENT_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.conditionChip,
                      {
                        backgroundColor: data.work_environment === option ? colors.primary + '22' : '#121212',
                        borderColor: data.work_environment === option ? colors.primary : '#333'
                      }
                    ]}
                    onPress={() => handleInputChange('work_environment', option)}
                  >
                    <Text style={[
                      styles.conditionChipText,
                      { color: data.work_environment === option ? colors.primary : colors.textMuted }
                    ]}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Question 2: Exposures (Conditional) */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Does your work or study involve any of these?</Text>
              <View style={styles.conditionsGrid}>
                {WORK_EXPOSURES.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.conditionChip,
                      {
                        backgroundColor: data.work_exposures.includes(option) ? colors.primary + '22' : '#121212',
                        borderColor: data.work_exposures.includes(option) ? colors.primary : '#333'
                      }
                    ]}
                    onPress={() => toggleArrayItem('work_exposures', option)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <Text style={[
                        styles.conditionChipText,
                        { color: data.work_exposures.includes(option) ? colors.primary : colors.textMuted }
                      ]}>{option}</Text>
                      {data.work_exposures.includes(option) && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.conditionChip,
                    { borderColor: '#333', backgroundColor: '#121212' }
                  ]}
                  onPress={() => handleInputChange('work_exposures', [])}
                >
                  <Text style={[styles.conditionChipText, { color: colors.textMuted }]}>None of these</Text>
                </TouchableOpacity>
              </View>
            </View>


            {/* Question 3: Functional Stress Check */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Lately, how has your work or school been affecting you?</Text>
              <View style={styles.conditionsGrid}>
                {STRESS_LEVEL_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.conditionChip,
                      {
                        width: '100%',
                        backgroundColor: data.work_stress_level === option ? colors.primary + '22' : '#121212',
                        borderColor: data.work_stress_level === option ? colors.primary : '#333'
                      }
                    ]}
                    onPress={() => handleInputChange('work_stress_level', option)}
                  >
                    <Text style={[
                      styles.conditionChipText,
                      { color: data.work_stress_level === option ? colors.primary : colors.textMuted }
                    ]}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* New Question: Health Problems (Free Text) */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Common health problems encountered due to this work?</Text>
              <TextInput
                style={[styles.textarea, { backgroundColor: '#121212', borderColor: '#333', color: colors.text, height: 80 }]}
                placeholder="E.g. Back pain, eye strain, anxiety..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
                value={data.work_related_health_issues}
                onChangeText={(text) => handleInputChange('work_related_health_issues', text)}
              />
            </View>

          </View>
        );

      case 3: // Renumbered from 2
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>Height</Text>
                  <View style={{ flexDirection: 'row', backgroundColor: '#222', borderRadius: 8, padding: 2 }}>
                    <TouchableOpacity
                      onPress={() => handleHeightUnitChange('cm')}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                        backgroundColor: heightUnit === 'cm' ? colors.primary : 'transparent'
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: heightUnit === 'cm' ? '#000' : '#666' }}>CM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleHeightUnitChange('ft')}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                        backgroundColor: heightUnit === 'ft' ? colors.primary : 'transparent'
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: heightUnit === 'ft' ? '#000' : '#666' }}>FT</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {heightUnit === 'cm' ? (
                  <TextInput
                    style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                    placeholder="170"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={data.height_cm}
                    onChangeText={(text) => handleInputChange('height_cm', text)}
                  />
                ) : (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text, paddingHorizontal: 8 }]}
                        placeholder="5'"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={feet}
                        onChangeText={(text) => updateHeightFromImperial(text, inches)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text, paddingHorizontal: 8 }]}
                        placeholder="10''"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={inches}
                        onChangeText={(text) => updateHeightFromImperial(feet, text)}
                      />
                    </View>
                  </View>
                )}
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

              <View style={{ marginTop: 16 }}>
                <Text style={[styles.label, { color: colors.text }]}>Other (Optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                  placeholder="E.g. Vaping, specific diets..."
                  placeholderTextColor="#666"
                  value={data.other_behavioral_factors}
                  onChangeText={(text) => handleInputChange('other_behavioral_factors', text)}
                />
              </View>
            </View>
          </View>
        );

      case 4: // Renumbered from 3
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Medical History</Text>
              <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>Document diagnosed chronic conditions</Text>
            </View>
// ... continued in next replacement chunk because this file is large ...

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

            {data.chronic_conditions.includes('Other') && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Specify Other Condition(s)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                  placeholder="E.g. Sickle Cell, Arthritis..."
                  placeholderTextColor="#666"
                  value={data.other_chronic_conditions}
                  onChangeText={(text) => handleInputChange('other_chronic_conditions', text)}
                />
              </View>
            )}

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

      case 5: // Renumbered from 4
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

            {data.family_history.includes('Other') && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Specify Other Family History</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: '#121212', borderColor: '#333', color: colors.text }]}
                  placeholder="E.g. Autoimmune diseases, Rare conditions..."
                  placeholderTextColor="#666"
                  value={data.other_family_history}
                  onChangeText={(text) => handleInputChange('other_family_history', text)}
                />
              </View>
            )}

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
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  content: {
    padding: 24,
  },
  progressHeader: {
    marginBottom: 32,
  },
  progressText: {
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    flexDirection: 'row',
    height: 4,
    gap: 4,
  },
  progressSegment: {
    flex: 1,
    borderRadius: 2,
  },
  stepContainer: {
    gap: 24,
  },
  stepHeader: {
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textarea: {
    height: 100,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  halfWidth: {
    flex: 1,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionCard: {
    flex: 1,
    minWidth: '30%',
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  bloodGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bloodGroupButton: {
    width: '22%',
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloodGroupText: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conditionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  conditionChip: {
    paddingHorizontal: 16,
    paddingVertical: 12, // Increased slightly for better touch target
    borderRadius: 12, // Less rounded, more button-like
    borderWidth: 1,
    flexGrow: 1, // Allow chips to expand to fill row
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2, // Tiny margin to prevent border overlap visual issues if any
  },
  conditionChipText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center', // Center text within the expanded chip
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 16,
  },
  primaryButton: {
    height: 56,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 56,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
