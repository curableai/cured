// app/(tabs)/doctors/status/[id].tsx
import { cancelReviewRequest, getReviewJobStatus } from '@/lib/doctorReviewService';
import { supabase } from '@/lib/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

interface JobStatus {
  id: string;
  status: string;
  priority: number;
  requested_at: string;
  started_at?: string;
  completed_at?: string;
  ai_summary: string;
  ai_alerts: any[];
  doctor_notes?: string;
  doctor_diagnosis?: any;
  doctor_recommendations?: string;
  doctor?: {
    full_name: string;
    profile_photo?: string;
    specialty: string[];
  };
  audit_log: any[];
}

export default function ReviewStatusScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [job, setJob] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      await loadJobStatus();
    }
  };

  const loadJobStatus = async () => {
    try {
      setLoading(true);
      const jobData = await getReviewJobStatus(id as string);
      setJob(jobData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading job status:', error);
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadJobStatus();
    setRefreshing(false);
  };

  const handleCancelReview = async () => {
    if (!job) return;

    const result = await cancelReviewRequest(job.id, userId);
    
    if (result.success) {
      alert('Review request cancelled');
      router.back();
    } else {
      alert(result.error || 'Failed to cancel request');
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: 'time' as const,
          color: '#f59e0b',
          bg: '#fef3c7',
          title: 'Pending Review',
          message: 'Your request is in the queue. A doctor will be assigned soon.',
        };
      case 'assigned':
        return {
          icon: 'person-add' as const,
          color: '#38bdf8',
          bg: '#dbeafe',
          title: 'Doctor Assigned',
          message: 'A doctor has been assigned to review your case.',
        };
      case 'in_progress':
        return {
          icon: 'search' as const,
          color: '#8b5cf6',
          bg: '#ede9fe',
          title: 'Under Review',
          message: 'The doctor is currently reviewing your health data.',
        };
      case 'completed':
        return {
          icon: 'checkmark-circle' as const,
          color: '#10b981',
          bg: '#d1fae5',
          title: 'Review Complete',
          message: 'Your review is complete. See the results below.',
        };
      case 'rejected':
        return {
          icon: 'close-circle' as const,
          color: '#ef4444',
          bg: '#fee2e2',
          title: 'Request Cancelled',
          message: 'This review request was cancelled.',
        };
      default:
        return {
          icon: 'help-circle' as const,
          color: '#94a3b8',
          bg: '#f1f5f9',
          title: 'Unknown Status',
          message: 'Status information unavailable.',
        };
    }
  };

  const getEstimatedTime = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Typically 15-30 minutes';
      case 'assigned':
        return 'Typically 10-20 minutes';
      case 'in_progress':
        return 'Almost done!';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Loading status...</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Review Not Found</Text>
        <Text style={styles.errorText}>This review request could not be found.</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const statusInfo = getStatusInfo(job.status);
  const estimatedTime = getEstimatedTime(job.status);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#f0f9ff', '#e0f2fe']} style={styles.header}>
        <Pressable style={styles.headerBackButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0c4a6e" />
        </Pressable>
        <Text style={styles.headerTitle}>Review Status</Text>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: statusInfo.bg }]}>
          <View style={[styles.statusIcon, { backgroundColor: statusInfo.color }]}>
            <Ionicons name={statusInfo.icon} size={40} color="#ffffff" />
          </View>
          <Text style={styles.statusTitle}>{statusInfo.title}</Text>
          <Text style={styles.statusMessage}>{statusInfo.message}</Text>
          {estimatedTime && (
            <View style={styles.timeEstimate}>
              <Ionicons name="time-outline" size={16} color={statusInfo.color} />
              <Text style={[styles.timeEstimateText, { color: statusInfo.color }]}>
                {estimatedTime}
              </Text>
            </View>
          )}
        </View>

        {/* Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          
          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, styles.timelineDotActive]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>Request Submitted</Text>
              <Text style={styles.timelineTime}>
                {new Date(job.requested_at).toLocaleString()}
              </Text>
            </View>
          </View>

          {job.started_at && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, styles.timelineDotActive]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Review Started</Text>
                <Text style={styles.timelineTime}>
                  {new Date(job.started_at).toLocaleString()}
                </Text>
              </View>
            </View>
          )}

          {job.completed_at && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, styles.timelineDotActive]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Review Completed</Text>
                <Text style={styles.timelineTime}>
                  {new Date(job.completed_at).toLocaleString()}
                </Text>
              </View>
            </View>
          )}

          {!job.completed_at && (
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, styles.timelineTitleInactive]}>
                  Completion
                </Text>
                <Text style={[styles.timelineTime, styles.timelineTimeInactive]}>
                  Pending
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Doctor Info */}
        {job.doctor && (
          <View style={styles.doctorCard}>
            <Text style={styles.sectionTitle}>Your Doctor</Text>
            <View style={styles.doctorInfo}>
              <View style={styles.doctorAvatar}>
                {job.doctor.profile_photo ? (
                  <Image source={{ uri: job.doctor.profile_photo }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={32} color="#64748b" />
                )}
              </View>
              <View style={styles.doctorDetails}>
                <Text style={styles.doctorName}>Dr. {job.doctor.full_name}</Text>
                <View style={styles.specialtyTags}>
                  {job.doctor.specialty.slice(0, 2).map((spec, idx) => (
                    <View key={idx} style={styles.specialtyTag}>
                      <Text style={styles.specialtyTagText}>{spec}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* AI Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>AI Summary Sent to Doctor</Text>
          <View style={styles.summaryContent}>
            <Ionicons name="document-text" size={20} color="#38bdf8" />
            <Text style={styles.summaryText}>{job.ai_summary}</Text>
          </View>
        </View>

        {/* AI Alerts */}
        {job.ai_alerts.length > 0 && (
          <View style={styles.alertsCard}>
            <Text style={styles.sectionTitle}>Key Health Alerts ({job.ai_alerts.length})</Text>
            {job.ai_alerts.slice(0, 3).map((alert, idx) => (
              <View key={idx} style={styles.alertItem}>
                <Ionicons 
                  name="alert-circle" 
                  size={20} 
                  color={alert.type === 'urgent' ? '#ef4444' : '#f59e0b'} 
                />
                <Text style={styles.alertText}>{alert.title}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Doctor's Diagnosis (if completed) */}
        {job.status === 'completed' && job.doctor_notes && (
          <View style={styles.diagnosisCard}>
            <Text style={styles.sectionTitle}>Doctor's Review</Text>
            
            {job.doctor_notes && (
              <View style={styles.notesSection}>
                <Text style={styles.notesLabel}>Notes:</Text>
                <Text style={styles.notesText}>{job.doctor_notes}</Text>
              </View>
            )}

            {job.doctor_recommendations && (
              <View style={styles.notesSection}>
                <Text style={styles.notesLabel}>Recommendations:</Text>
                <Text style={styles.notesText}>{job.doctor_recommendations}</Text>
              </View>
            )}
          </View>
        )}

        {/* Cancel Button (if pending or assigned) */}
        {(job.status === 'pending' || job.status === 'assigned') && (
          <Pressable style={styles.cancelButton} onPress={handleCancelReview}>
            <Ionicons name="close-circle" size={20} color="#ef4444" />
            <Text style={styles.cancelButtonText}>Cancel Request</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f8fafc',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0c4a6e',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0c4a6e',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  statusCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  statusIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0c4a6e',
    marginBottom: 8,
  },
  statusMessage: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 12,
  },
  timeEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  timeEstimateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0c4a6e',
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    marginRight: 16,
    marginTop: 4,
  },
  timelineDotActive: {
    backgroundColor: '#38bdf8',
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0c4a6e',
    marginBottom: 4,
  },
  timelineTitleInactive: {
    color: '#94a3b8',
  },
  timelineTime: {
    fontSize: 14,
    color: '#64748b',
  },
  timelineTimeInactive: {
    color: '#cbd5e1',
  },
  doctorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
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
  doctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  doctorDetails: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0c4a6e',
    marginBottom: 6,
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
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
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
  summaryContent: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryText: {
    flex: 1,
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  alertsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
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
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  alertText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#475569',
  },
  diagnosisCard: {
    backgroundColor: '#d1fae5',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#10b981',
  },
  notesSection: {
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 15,
    color: '#047857',
    lineHeight: 22,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#fee2e2',
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  backButton: {
    backgroundColor: '#38bdf8',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});