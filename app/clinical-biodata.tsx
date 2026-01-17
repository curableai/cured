import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface Biodata {
    full_name: string;
    date_of_birth: string;
    gender: string;
    weight_kg: number;
    height_cm: number;
    blood_group: string;
    location: string;
    chronic_conditions: string[];
    long_term_medications: string[];
}

export default function ClinicalBiodataScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const [editing, setEditing] = useState(false);
    const [data, setData] = useState<Biodata | null>(null);
    const [tempData, setTempData] = useState<Biodata | null>(null);

    useEffect(() => {
        authenticate();
    }, []);

    const authenticate = async () => {
        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (!hasHardware || !isEnrolled) {
                // Fallback or alert
                Alert.alert('Security', 'Biometric security not available or not set up. Falling back to simple access.');
                setAuthenticated(true);
                fetchData();
                return;
            }

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Authenticate to view your Clinical Biodata',
                cancelLabel: 'Cancel',
                disableDeviceFallback: false,
            });

            if (result.success) {
                setAuthenticated(true);
                fetchData();
            } else {
                router.back();
            }
        } catch (error) {
            console.error('Authentication error:', error);
            router.back();
        }
    };

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: onboarding, error } = await supabase
                .from('onboarding')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error) throw error;

            const bio: Biodata = {
                full_name: onboarding.full_name,
                date_of_birth: onboarding.date_of_birth,
                gender: onboarding.gender,
                weight_kg: onboarding.weight_kg,
                height_cm: onboarding.height_cm,
                blood_group: onboarding.blood_group,
                location: onboarding.location,
                chronic_conditions: onboarding.chronic_conditions || [],
                long_term_medications: onboarding.long_term_medications || [],
            };

            setData(bio);
            setTempData(bio);
        } catch (error) {
            console.error('Error fetching biodata:', error);
            Alert.alert('Error', 'Failed to load your health profile.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!tempData) return;
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('onboarding')
                .update({
                    full_name: tempData.full_name,
                    date_of_birth: tempData.date_of_birth,
                    gender: tempData.gender,
                    weight_kg: tempData.weight_kg,
                    height_cm: tempData.height_cm,
                    blood_group: tempData.blood_group,
                    location: tempData.location,
                    chronic_conditions: tempData.chronic_conditions,
                    long_term_medications: tempData.long_term_medications,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.id);

            if (error) throw error;

            setData(tempData);
            setEditing(false);
            Alert.alert('Success', 'Profile updated successfully.');
        } catch (error) {
            console.error('Error saving biodata:', error);
            Alert.alert('Error', 'Failed to save changes.');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !authenticated) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!authenticated) return null;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>Clinical Biodata</Text>
                <TouchableOpacity
                    onPress={() => editing ? handleSave() : setEditing(true)}
                    style={[styles.editButton, { backgroundColor: editing ? colors.primary : '#121212' }]}
                >
                    <Text style={{ color: editing ? '#fff' : colors.primary, fontWeight: '700' }}>
                        {editing ? 'Save' : 'Edit'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={[styles.section, { backgroundColor: '#0D0D0D' }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>CORE IDENTITY</Text>

                    <View style={styles.field}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Full Name</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderBottomColor: editing ? colors.primary : 'transparent' }]}
                            value={tempData?.full_name}
                            editable={editing}
                            onChangeText={(val) => setTempData(prev => ({ ...prev!, full_name: val }))}
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Date of Birth</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderBottomColor: editing ? colors.primary : 'transparent' }]}
                            value={tempData?.date_of_birth}
                            editable={editing}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={colors.textMuted}
                            onChangeText={(val) => setTempData(prev => ({ ...prev!, date_of_birth: val }))}
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Biological Sex</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderBottomColor: editing ? colors.primary : 'transparent' }]}
                            value={tempData?.gender}
                            editable={editing}
                            onChangeText={(val) => setTempData(prev => ({ ...prev!, gender: val }))}
                        />
                    </View>
                </View>

                <View style={[styles.section, { backgroundColor: '#0D0D0D' }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>PHYSIOLOGY</Text>

                    <View style={styles.field}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Blood Group</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderBottomColor: editing ? colors.primary : 'transparent' }]}
                            value={tempData?.blood_group}
                            editable={editing}
                            onChangeText={(val) => setTempData(prev => ({ ...prev!, blood_group: val }))}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.field, { flex: 1 }]}>
                            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Weight (kg)</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderBottomColor: editing ? colors.primary : 'transparent' }]}
                                value={tempData?.weight_kg.toString()}
                                keyboardType="numeric"
                                editable={editing}
                                onChangeText={(val) => setTempData(prev => ({ ...prev!, weight_kg: parseFloat(val) || 0 }))}
                            />
                        </View>
                        <View style={[styles.field, { flex: 1 }]}>
                            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Height (cm)</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderBottomColor: editing ? colors.primary : 'transparent' }]}
                                value={tempData?.height_cm.toString()}
                                keyboardType="numeric"
                                editable={editing}
                                onChangeText={(val) => setTempData(prev => ({ ...prev!, height_cm: parseFloat(val) || 0 }))}
                            />
                        </View>
                    </View>

                    <View style={styles.field}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Body Mass Index (BMI)</Text>
                        <View style={[styles.input, { borderBottomColor: 'transparent', justifyContent: 'center' }]}>
                            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '800' }}>
                                {tempData?.weight_kg && tempData?.height_cm
                                    ? (tempData.weight_kg / ((tempData.height_cm / 100) * (tempData.height_cm / 100))).toFixed(1)
                                    : '--'
                                }
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={[styles.section, { backgroundColor: '#0D0D0D' }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>MEDICAL HISTORY</Text>

                    <View style={styles.field}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Chronic Conditions</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderBottomColor: editing ? colors.primary : 'transparent' }]}
                            value={tempData?.chronic_conditions.join(', ')}
                            editable={editing}
                            multiline
                            onChangeText={(val) => setTempData(prev => ({ ...prev!, chronic_conditions: val.split(',').map(s => s.trim()) }))}
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Long-term Medications</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderBottomColor: editing ? colors.primary : 'transparent' }]}
                            value={tempData?.long_term_medications.join(', ')}
                            editable={editing}
                            multiline
                            onChangeText={(val) => setTempData(prev => ({ ...prev!, long_term_medications: val.split(',').map(s => s.trim()) }))}
                        />
                    </View>
                </View>

                {editing && (
                    <TouchableOpacity
                        onPress={() => {
                            setTempData(data);
                            setEditing(false);
                        }}
                        style={styles.cancelButton}
                    >
                        <Text style={{ color: '#FF5252' }}>Cancel Changes</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
    backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#121212' },
    title: { flex: 1, fontSize: 24, fontWeight: '800', letterSpacing: -1 },
    editButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    scrollContent: { padding: 24, paddingBottom: 100 },
    section: { borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,107,0,0.05)' },
    sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 16 },
    field: { marginBottom: 16 },
    fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
    input: { fontSize: 16, fontWeight: '500', paddingVertical: 8, borderBottomWidth: 1 },
    row: { flexDirection: 'row', gap: 16 },
    cancelButton: { alignSelf: 'center', marginTop: 8 },
});
