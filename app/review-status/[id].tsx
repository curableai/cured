// app/review-status/[id].tsx
import { supabase } from '@/lib/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from 'react-native';

interface ReviewJob {
  id: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  priority: number;
  ai_summary: string;
  ai_alerts: any[];
  doctor_notes?: string;
  doctor_recommendations?: string;
  created_at: string;
  assigned_at?: string;
  completed_at?: string;
  doctors?: {
    full_name: string;
    specialty: string[];
    rating: number;
    profile_photo_url?: string;
  };
}

export default function ReviewStatusScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [job, setJob] = useState<ReviewJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobStatus();
    subscribeToUpdates();
  }, [id]);

  const loadJobStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('doctor_jobs')
        .select(`
          *,
          doctors:doctor_id(full_name, specialty, rating, profile_photo_url)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setJob(data);
    } catch (error) {
      console.error('Error loading job status:', error);
      Alert.alert('Error', 'Failed to load review status');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToUpdates = () => {
    const subscription = supabase
      .channel(`job_status_${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'doctor_jobs',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          console.log('Job updated:', payload);
          loadJobStatus();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const handleCancelReview = () => {
    Alert.alert(
      'Cancel Review',
      'Are you sure you want to cancel this review request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('doctor_jobs')
                .update({ status: 'cancelled' })
                .eq('id', id);

              if (error) throw error;
              
              Alert.alert('Cancelled', 'Review request has been cancelled', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel review');
            }
          },
        },
      ]
    );
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Finding Doctor',
          color: 'bg-amber-500',
          icon: 'hourglass',
          message: 'Looking for an available doctor to review your case...',
        };
      case 'assigned':
        return {
          label: 'Doctor Assigned',
          color: 'bg-blue-500',
          icon: 'person-add',
          message: 'A doctor has been assigned and will start reviewing shortly',
        };
      case 'in_progress':
        return {
          label: 'Under Review',
          color: 'bg-purple-500',
          icon: 'medical',
          message: 'Your doctor is currently reviewing your case',
        };
      case 'completed':
        return {
          label: 'Review Complete',
          color: 'bg-emerald-500',
          icon: 'checkmark-circle',
          message: 'Your doctor has completed the review',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          color: 'bg-red-500',
          icon: 'close-circle',
          message: 'This review request was cancelled',
        };
      default:
        return {
          label: 'Unknown',
          color: 'bg-slate-500',
          icon: 'help-circle',
          message: 'Status unknown',
        };
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50">
        <ActivityIndicator size="large" color="#10b981" />
        <Text className="mt-4 text-slate-600">Loading status...</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50 p-10">
        <Ionicons name="alert-circle" size={64} color="#ef4444" />
        <Text className="mt-4 text-xl font-bold text-slate-900">Review not found</Text>
        <Pressable
          className="mt-6 bg-emerald-500 px-6 py-3 rounded-xl"
          onPress={() => router.back()}
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const statusInfo = getStatusInfo(job.status);
  const canCancel = job.status === 'pending' || job.status === 'assigned';

  return (
    <View className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="bg-emerald-500 pt-14 pb-6 px-5 rounded-b-3xl">
        <View className="flex-row items-center">
          <Pressable
            className="w-10 h-10 rounded-full bg-white/20 justify-center items-center mr-3"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </Pressable>
          <Text className="text-2xl font-bold text-white">Review Status</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadJobStatus} />
        }
      >
        <View className="p-5">
          {/* Status Card */}
          <View className={`${statusInfo.color} rounded-2xl p-6 items-center mb-5`}>
            <View className="w-20 h-20 bg-white/20 rounded-full justify-center items-center mb-4">
              <Ionicons name={statusInfo.icon as any} size={40} color="#ffffff" />
            </View>
            <Text className="text-2xl font-bold text-white mb-2">{statusInfo.label}</Text>
            <Text className="text-white/90 text-center">{statusInfo.message}</Text>
          </View>

          {/* Timeline */}
          <View className="bg-white rounded-2xl p-5 mb-5">
            <Text className="text-lg font-bold text-slate-900 mb-4">Timeline</Text>

            {/* Created */}
            <View className="flex-row mb-4">
              <View className="items-center mr-3">
                <View className="w-3 h-3 bg-emerald-500 rounded-full" />
                <View className="w-0.5 h-full bg-slate-200 mt-1" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-slate-900">Request Created</Text>
                <Text className="text-sm text-slate-500">
                  {new Date(job.created_at).toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Assigned */}
            {job.assigned_at && (
              <View className="flex-row mb-4">
                <View className="items-center mr-3">
                  <View className="w-3 h-3 bg-blue-500 rounded-full" />
                  <View className="w-0.5 h-full bg-slate-200 mt-1" />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-slate-900">Doctor Assigned</Text>
                  <Text className="text-sm text-slate-500">
                    {new Date(job.assigned_at).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}

            {/* Completed */}
            {job.completed_at && (
              <View className="flex-row">
                <View className="items-center mr-3">
                  <View className="w-3 h-3 bg-emerald-500 rounded-full" />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-slate-900">Review Completed</Text>
                  <Text className="text-sm text-slate-500">
                    {new Date(job.completed_at).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Doctor Info */}
          {job.doctors && (
            <View className="bg-white rounded-2xl p-5 mb-5">
              <Text className="text-lg font-bold text-slate-900 mb-3">Your Doctor</Text>
              <View className="flex-row items-center">
                <View className="w-14 h-14 bg-emerald-100 rounded-full justify-center items-center">
                  <Ionicons name="person" size={28} color="#10b981" />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-lg font-bold text-slate-900">
                    {job.doctors.full_name}
                  </Text>
                  <View className="flex-row flex-wrap gap-1 mt-1">
                    {job.doctors.specialty.map((spec, idx) => (
                      <View key={idx} className="bg-emerald-50 px-2 py-0.5 rounded">
                        <Text className="text-xs text-emerald-700 capitalize">
                          {spec.replace('_', ' ')}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View className="items-center">
                  <View className="flex-row items-center">
                    <Ionicons name="star" size={16} color="#f59e0b" />
                    <Text className="ml-1 font-bold text-slate-900">
                      {job.doctors.rating.toFixed(1)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* AI Summary */}
          <View className="bg-white rounded-2xl p-5 mb-5">
            <View className="flex-row items-center mb-3">
              <Ionicons name="document-text" size={24} color="#10b981" />
              <Text className="ml-2 text-lg font-bold text-slate-900">AI Summary</Text>
            </View>
            <Text className="text-slate-600 leading-6">{job.ai_summary}</Text>
          </View>

          {/* Health Alerts */}
          {job.ai_alerts.length > 0 && (
            <View className="bg-white rounded-2xl p-5 mb-5">
              <Text className="text-lg font-bold text-slate-900 mb-3">
                Health Alerts ({job.ai_alerts.length})
              </Text>
              {job.ai_alerts.map((alert, idx) => (
                <View key={idx} className="flex-row items-start mb-3 pb-3 border-b border-slate-100">
                  <Ionicons
                    name="alert-circle"
                    size={20}
                    color={alert.type === 'urgent' ? '#ef4444' : '#f59e0b'}
                  />
                  <View className="flex-1 ml-3">
                    <Text className="font-semibold text-slate-900">{alert.title}</Text>
                    <Text className="text-sm text-slate-600 mt-1">{alert.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Doctor's Diagnosis */}
          {job.status === 'completed' && job.doctor_notes && (
            <View className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-5 mb-5">
              <View className="flex-row items-center mb-3">
                <Ionicons name="medical" size={24} color="#10b981" />
                <Text className="ml-2 text-lg font-bold text-emerald-900">Doctor's Review</Text>
              </View>

              <View className="mb-3">
                <Text className="text-sm font-bold text-emerald-900 mb-1">Diagnosis:</Text>
                <Text className="text-emerald-800 leading-6">{job.doctor_notes}</Text>
              </View>

              {job.doctor_recommendations && (
                <View>
                  <Text className="text-sm font-bold text-emerald-900 mb-1">Recommendations:</Text>
                  <Text className="text-emerald-800 leading-6">{job.doctor_recommendations}</Text>
                </View>
              )}
            </View>
          )}

          {/* Cancel Button */}
          {canCancel && (
            <Pressable
              className="bg-white border-2 border-red-200 rounded-xl py-3 items-center"
              onPress={handleCancelReview}
            >
              <Text className="text-red-600 font-semibold">Cancel Request</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}