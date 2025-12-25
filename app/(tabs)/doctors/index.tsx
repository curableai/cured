// app/(tabs)/doctors/index.tsx
import { createDoctorReview, getAvailableDoctors, type Doctor } from '@/lib/doctorReviewService';
import { supabase } from '@/lib/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function DoctorsMarketplace() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [submitting, setSubmitting] = useState(false);
  const [reviewData, setReviewData] = useState<any>(null);

  const specialties = ['all', 'general', 'cardiology', 'endocrinology', 'sleep medicine', 'psychiatry'];

  useEffect(() => {
    loadDoctors();

    // Parse review data from params
    if (params.reviewData) {
      try {
        const parsed = JSON.parse(params.reviewData as string);
        setReviewData(parsed);
      } catch (error) {
        console.error('Error parsing review data:', error);
      }
    }
  }, []);

  useEffect(() => {
    filterDoctors();
  }, [doctors, searchQuery, selectedSpecialty]);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const doctorsList = await getAvailableDoctors();
      setDoctors(doctorsList);
      setLoading(false);
    } catch (error) {
      console.error('Error loading doctors:', error);
      Alert.alert('Error', 'Failed to load doctors');
      setLoading(false);
    }
  };

  const filterDoctors = () => {
    let filtered = doctors;

    // Filter by specialty
    if (selectedSpecialty !== 'all') {
      filtered = filtered.filter(d =>
        d.specialty.includes(selectedSpecialty)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.full_name.toLowerCase().includes(query) ||
        d.specialty.some(s => s.toLowerCase().includes(query)) ||
        d.bio?.toLowerCase().includes(query)
      );
    }

    setFilteredDoctors(filtered);
  };

  const handleSelectDoctor = async (doctor?: Doctor) => {
    if (!reviewData) {
      Alert.alert('Error', 'No review data available');
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const result = await createDoctorReview({
        userId: user.id,
        aiSummary: reviewData.aiSummary || '',
        aiAlerts: reviewData.aiAlerts || [],
        aiConfidence: reviewData.aiConfidence || 0.7,
        chatHistory: reviewData.chatHistory || [],
        relevantMetrics: reviewData.relevantMetrics || {},
        contextualQA: reviewData.contextualQA || [],
        learnedPatterns: reviewData.learnedPatterns || [],
        preferredDoctorId: doctor?.id,
      });

      if (result.success) {
        Alert.alert(
          'Review Request Submitted! 🎉',
          doctor
            ? `Dr. ${doctor.full_name} will review your case soon. You'll receive a notification when they respond.`
            : 'Your request has been added to the queue. A doctor will review your case soon.',
          [
            {
              text: 'View Status',
              onPress: () => router.push(`/(tabs)/doctors/status/${result.jobId}`),
            },
          ]
        );
      } else {
        throw new Error(result.error || 'Failed to create review');
      }
    } catch (error: any) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', error.message || 'Failed to submit review request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#f0f9ff', '#e0f2fe']} style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0c4a6e" />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Choose a Doctor</Text>
          <Text style={styles.headerSubtitle}>Select a specialist to review your health</Text>
        </View>
      </LinearGradient>

      {/* Search & Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or specialty..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.specialtyFilters}
        >
          {specialties.map(spec => (
            <Pressable
              key={spec}
              style={[
                styles.specialtyChip,
                selectedSpecialty === spec && styles.specialtyChipActive,
              ]}
              onPress={() => setSelectedSpecialty(spec)}
            >
              <Text
                style={[
                  styles.specialtyChipText,
                  selectedSpecialty === spec && styles.specialtyChipTextActive,
                ]}
              >
                {spec.charAt(0).toUpperCase() + spec.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Doctors List */}
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>


        {/* Any Doctor Option */}
        <Pressable
          style={styles.anyDoctorCard}
          onPress={() => handleSelectDoctor()}
          disabled={submitting}
        >
          <LinearGradient
            colors={['#dbeafe', '#e0f2fe']}
            style={styles.anyDoctorGradient}
          >
            <View style={styles.anyDoctorIcon}>
              <Ionicons name="people" size={32} color="#38bdf8" />
            </View>
            <View style={styles.anyDoctorContent}>
              <Text style={styles.anyDoctorTitle}>Any Available Doctor</Text>
              <Text style={styles.anyDoctorSubtitle}>
                Get the next available doctor to review your case
              </Text>
              <View style={styles.anyDoctorBadge}>
                <Ionicons name="flash" size={14} color="#f59e0b" />
                <Text style={styles.anyDoctorBadgeText}>Fastest Response</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#38bdf8" />
          </LinearGradient>
        </Pressable>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.loadingText}>Loading doctors...</Text>
          </View>
        ) : filteredDoctors.length > 0 ? (
          filteredDoctors.map(doctor => (
            <Pressable
              key={doctor.id}
              style={styles.doctorCard}
              onPress={() => handleSelectDoctor(doctor)}
              disabled={submitting}
            >
              <View style={styles.doctorHeader}>
                <View style={styles.doctorAvatar}>
                  {doctor.profile_photo ? (
                    <Image source={{ uri: doctor.profile_photo }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person" size={32} color="#64748b" />
                  )}
                </View>
                <View style={styles.doctorInfo}>
                  <Text style={styles.doctorName}>Dr. {doctor.full_name}</Text>
                  <View style={styles.specialtyTags}>
                    {doctor.specialty.slice(0, 2).map((spec, idx) => (
                      <View key={idx} style={styles.specialtyTag}>
                        <Text style={styles.specialtyTagText}>{spec}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              {doctor.bio && (
                <Text style={styles.doctorBio} numberOfLines={2}>
                  {doctor.bio}
                </Text>
              )}

              <View style={styles.doctorFooter}>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={16} color="#f59e0b" />
                  <Text style={styles.ratingText}>
                    {doctor.rating.toFixed(1)} ({doctor.reviews_count} reviews)
                  </Text>
                </View>

                {doctor.price_per_review > 0 && (
                  <Text style={styles.priceText}>${doctor.price_per_review}</Text>
                )}
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Doctors Found</Text>
            <Text style={styles.emptyText}>
              Try adjusting your search or filter criteria
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Submitting Overlay */}
      {submitting && (
        <View style={styles.submittingOverlay}>
          <View style={styles.submittingCard}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.submittingText}>Submitting your request...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0c4a6e',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#0369a1',
  },
  filtersContainer: {
    paddingVertical: 16,
    backgroundColor: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    height: 48,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#0c4a6e',
  },
  specialtyFilters: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  specialtyChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  specialtyChipActive: {
    backgroundColor: '#38bdf8',
  },
  specialtyChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  specialtyChipTextActive: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  anyDoctorCard: {
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#38bdf8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  anyDoctorGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  anyDoctorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  anyDoctorContent: {
    flex: 1,
  },
  anyDoctorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0c4a6e',
    marginBottom: 4,
  },
  anyDoctorSubtitle: {
    fontSize: 14,
    color: '#0369a1',
    marginBottom: 8,
  },
  anyDoctorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fffbeb',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  anyDoctorBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  doctorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  doctorHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  doctorAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0c4a6e',
    marginBottom: 8,
  },
  specialtyTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  specialtyTag: {
    backgroundColor: '#dbeafe',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  specialtyTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369a1',
    textTransform: 'capitalize',
  },
  doctorBio: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 12,
  },
  doctorFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#38bdf8',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0c4a6e',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
  },
  submittingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submittingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  submittingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#0c4a6e',
  },
});