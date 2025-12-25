import { interpretClinicalDocument } from '@/lib/openAIHealthService';
import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface AnalysisResult {
    summary: string;
    keyFindings: string[];
    recommendations: string[];
    urgency: 'low' | 'medium' | 'high';
}

export default function ClinicalDocumentsScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'image/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setSelectedImage(asset.uri);
                setAnalysis(null);
            }
        } catch (error) {
            console.error('Error picking document:', error);
            Alert.alert('Error', 'Failed to pick document.');
        }
    };

    const handleAnalyze = async () => {
        if (!selectedImage) return;

        setAnalyzing(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            // Convert image to base64
            const base64 = await readAsStringAsync(selectedImage, {
                encoding: 'base64',
            });

            const fileName = selectedImage.split('/').pop() || 'document.jpg';
            const result = await interpretClinicalDocument(user.id, base64, fileName);

            if (result) {
                setAnalysis(result);
            } else {
                Alert.alert('Analysis Failed', 'AI was unable to interpret this document. Please ensure the image is clear.');
            }
        } catch (error) {
            console.error('Error analyzing document:', error);
            Alert.alert('Error', 'Failed to interpret document. Please try again.');
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>Clinical Documents</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={[styles.card, { backgroundColor: '#0D0D0D' }]}>
                    <Text style={[styles.cardLabel, { color: colors.textMuted }]}>UPLOAD PORTAL</Text>

                    <TouchableOpacity
                        onPress={pickDocument}
                        style={[styles.uploadBox, { borderColor: colors.primary, backgroundColor: 'rgba(255,107,0,0.03)' }]}
                    >
                        {selectedImage ? (
                            <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />
                        ) : (
                            <View style={styles.uploadPlaceholder}>
                                <Ionicons name="cloud-upload-outline" size={48} color={colors.primary} />
                                <Text style={[styles.uploadText, { color: colors.text }]}>Select Lab Result or Report</Text>
                                <Text style={[styles.uploadSubtext, { color: colors.textMuted }]}>Supports JPG, PNG (Clinical interpretation available)</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {selectedImage && !analysis && (
                        <TouchableOpacity
                            onPress={handleAnalyze}
                            disabled={analyzing}
                            style={[styles.analyzeButton, { backgroundColor: colors.primary }]}
                        >
                            {analyzing ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="sparkles" size={20} color="#fff" />
                                    <Text style={styles.analyzeButtonText}>Start AI Interpretation</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {selectedImage && (
                        <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.clearButton}>
                            <Text style={{ color: '#FF5252' }}>Clear Selection</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {analysis && (
                    <View style={styles.results}>
                        <View style={[styles.resultCard, { backgroundColor: '#0D0D0D' }]}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="document-text" size={20} color={colors.primary} />
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>Executive Summary</Text>
                            </View>
                            <Text style={[styles.resultText, { color: colors.text }]}>{analysis.summary}</Text>
                        </View>

                        <View style={[styles.resultCard, { backgroundColor: '#0D0D0D' }]}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="list" size={20} color="#FFD600" />
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>Key Findings</Text>
                            </View>
                            {analysis.keyFindings.map((finding, i) => (
                                <View key={i} style={styles.listItem}>
                                    <Ionicons name="alert-circle" size={16} color="#FFD600" />
                                    <Text style={[styles.listItemText, { color: colors.textMuted }]}>{finding}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={[styles.resultCard, { backgroundColor: '#0D0D0D' }]}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="medkit" size={20} color="#00E676" />
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommendations</Text>
                            </View>
                            {analysis.recommendations.map((rec, i) => (
                                <View key={i} style={styles.listItem}>
                                    <Ionicons name="checkmark-circle" size={16} color="#00E676" />
                                    <Text style={[styles.listItemText, { color: colors.textMuted }]}>{rec}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={[styles.urgencyBadge, { backgroundColor: analysis.urgency === 'high' ? 'rgba(255, 82, 82, 0.1)' : 'rgba(255, 107, 0, 0.1)' }]}>
                            <Text style={[styles.urgencyText, { color: analysis.urgency === 'high' ? '#FF5252' : colors.primary }]}>
                                Urgency Level: {analysis.urgency.toUpperCase()}
                            </Text>
                        </View>

                        <Text style={styles.disclaimer}>
                            ⚠️ This AI interpretation is advisory only and not a medical diagnosis. Please consult your physician to discuss these results.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
    backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#121212' },
    title: { fontSize: 24, fontWeight: '800', letterSpacing: -1 },
    scrollContent: { padding: 24, paddingBottom: 100 },
    card: { borderRadius: 32, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,107,0,0.05)' },
    cardLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 20 },
    uploadBox: { height: 260, borderRadius: 24, borderStyle: 'dashed', borderWidth: 2, overflow: 'hidden' },
    uploadPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
    uploadText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
    uploadSubtext: { fontSize: 12, textAlign: 'center', opacity: 0.6 },
    previewImage: { width: '100%', height: '100%' },
    analyzeButton: { height: 68, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 24 },
    analyzeButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    clearButton: { marginTop: 16, alignSelf: 'center' },
    results: { gap: 16 },
    resultCard: { padding: 24, borderRadius: 24, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    sectionTitle: { fontSize: 16, fontWeight: '700' },
    resultText: { fontSize: 15, lineHeight: 24, opacity: 0.9 },
    listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    listItemText: { flex: 1, fontSize: 14, lineHeight: 22 },
    urgencyBadge: { padding: 16, borderRadius: 16, alignItems: 'center' },
    urgencyText: { fontWeight: '800', fontSize: 14, letterSpacing: 1 },
    disclaimer: { fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 16, lineHeight: 18 }
});
