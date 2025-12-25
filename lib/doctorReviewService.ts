// lib/doctorReviewService.ts
import { chatWithHealthAI } from '@/lib/openAIHealthService';

import { supabase } from '@/lib/supabaseClient';

// Import notification functions (they can be stubs if not implemented yet)
import {
  notifyDoctorNewJob,
  notifyPatientReviewCompleted
} from './doctorNotificationService';

export interface DoctorReviewRequest {
  userId: string;
  aiSummary: string;
  aiAlerts: any[];
  aiConfidence: number;
  chatHistory: any[];
  relevantMetrics: any;
  contextualQA: any[];
  learnedPatterns: any[];
  preferredDoctorId?: string;
}

export interface Doctor {
  id: string;
  full_name: string;
  specialty: string[];
  bio: string;
  profile_photo: string;
  rating: number;
  reviews_count: number;
  price_per_review: number;
  availability: any;
}

/**
 * Calculate priority score based on AI analysis
 */
const calculatePriority = (
  aiAlerts: any[],
  aiConfidence: number,
  userRequested: boolean = true
): number => {
  let priority = 0;

  // Base priority from AI confidence (0-40 points)
  priority += Math.floor(aiConfidence * 40);

  // Add points for urgent alerts (0-40 points)
  const urgentAlerts = aiAlerts.filter(a => a.type === 'urgent' || a.type === 'warning');
  priority += Math.min(urgentAlerts.length * 10, 40);

  // User-requested gets boost (20 points)
  if (userRequested) {
    priority += 20;
  }

  return Math.min(priority, 100); // Cap at 100
};

/**
 * Generate comprehensive AI summary for doctor
 */
export const generateDoctorSummary = async (
  userId: string,
  aiAlerts: any[],
  chatHistory: any[]
): Promise<string> => {
  try {
    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    const { data: onboarding } = await supabase
      .from('onboarding')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Get latest metrics
    const { data: metrics } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Build context
    let summary = `PATIENT SUMMARY:\n\n`;

    if (profile) {
      const age = onboarding?.date_of_birth
        ? new Date().getFullYear() - new Date(onboarding.date_of_birth).getFullYear()
        : 'Unknown';

      summary += `Demographics: ${age}y/o ${onboarding?.gender || 'Unknown'}, `;
      summary += `${profile.height_cm || '?'}cm, ${profile.weight_kg || '?'}kg\n`;
    }

    if (onboarding) {
      if (onboarding.chronic_conditions?.length > 0) {
        summary += `Conditions: ${onboarding.chronic_conditions.join(', ')}\n`;
      }
      if (onboarding.long_term_medications?.length > 0) {
        summary += `Medications: ${onboarding.long_term_medications.join(', ')}\n`;
      }
      if (onboarding.smoker) summary += `⚠️ Smoker\n`;
      if (onboarding.alcohol_drinker) summary += `⚠️ Alcohol use\n`;
    }

    summary += `\nCURRENT METRICS:\n`;
    if (metrics) {
      summary += `• Heart Rate: ${metrics.heart_rate || 'N/A'} bpm\n`;
      summary += `• Resting HR: ${metrics.resting_heart_rate || 'N/A'} bpm\n`;
      summary += `• HRV: ${metrics.heart_rate_variability || 'N/A'} ms\n`;
      summary += `• Sleep: ${metrics.sleep_hours ? parseFloat(metrics.sleep_hours).toFixed(1) : 'N/A'} hours\n`;
      summary += `• Steps: ${metrics.steps || 'N/A'}\n`;
      summary += `• BP: ${metrics.blood_pressure || 'N/A'}\n`;
    }

    summary += `\nAI ALERTS (${aiAlerts.length}):\n`;
    aiAlerts.forEach((alert, i) => {
      summary += `${i + 1}. [${alert.type.toUpperCase()}] ${alert.title}\n`;
      summary += `   ${alert.message}\n`;
    });

    // Use OpenAI to create concise clinical summary
    const clinicalSummary = await chatWithHealthAI(
      userId,
      `Create a 3-sentence clinical summary for a doctor reviewing this case. Focus on key concerns and suggested actions:\n\n${summary}`,
      []
    );

    return clinicalSummary;
  } catch (error) {
    console.error('Error generating doctor summary:', error);
    return 'Error generating summary. Please review raw data.';
  }
};

/**
 * Create a doctor review request
 */
export const createDoctorReview = async (
  request: DoctorReviewRequest
): Promise<{ success: boolean; jobId?: string; error?: string }> => {
  try {
    const {
      userId,
      aiSummary,
      aiAlerts,
      aiConfidence,
      chatHistory,
      relevantMetrics,
      contextualQA,
      learnedPatterns,
      preferredDoctorId,
    } = request;

    // Calculate priority
    const priority = calculatePriority(aiAlerts, aiConfidence, true);

    // Auto-assign doctor if preferred and available
    let assignedDoctorId = null;
    if (preferredDoctorId) {
      const { data: doctor } = await supabase
        .from('doctors')
        .select('id, verified, is_active')
        .eq('id', preferredDoctorId)
        .single();

      if (doctor?.verified && doctor?.is_active) {
        assignedDoctorId = preferredDoctorId;
      }
    }

    // If no specific doctor, try to auto-route based on specialty
    if (!assignedDoctorId) {
      // Extract required specialties from AI alerts
      const requiresCardiology = aiAlerts.some(a =>
        a.metric.includes('heart') || a.metric.includes('blood_pressure')
      );

      if (requiresCardiology) {
        const { data: cardiologist } = await supabase
          .from('doctors')
          .select('id')
          .contains('specialty', ['cardiology'])
          .eq('verified', true)
          .eq('is_active', true)
          .limit(1)
          .single();

        if (cardiologist) {
          assignedDoctorId = cardiologist.id;
        }
      }
    }

    // Generate comprehensive summary for doctor
    const doctorSummary = await generateDoctorSummary(userId, aiAlerts, chatHistory);

    // Create the job
    const { data: job, error: jobError } = await supabase
      .from('doctor_jobs')
      .insert({
        user_id: userId,
        assigned_doctor_id: assignedDoctorId,
        status: assignedDoctorId ? 'assigned' : 'pending',
        priority,
        ai_summary: doctorSummary,
        ai_alerts: aiAlerts,
        ai_confidence: aiConfidence,
        chat_history: chatHistory,
        relevant_metrics: relevantMetrics,
        contextual_qa: contextualQA,
        learned_patterns: learnedPatterns,
        audit_log: [
          {
            action: 'created',
            timestamp: new Date().toISOString(),
            by: 'system',
            details: `Priority: ${priority}, Auto-assigned: ${!!assignedDoctorId}`,
          },
        ],
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Send notification to doctor if assigned
    if (assignedDoctorId) {
      await notifyDoctor(assignedDoctorId, job.id);
    } else {
      // Notify available doctors about new job
      await notifyDoctorNewJob(job.id);
    }

    return { success: true, jobId: job.id };
  } catch (error: any) {
    console.error('Error creating doctor review:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get available doctors
 */
export const getAvailableDoctors = async (
  specialty?: string
): Promise<Doctor[]> => {
  try {
    let query = supabase
      .from('doctors')
      .select('*')
      .eq('verified', true)
      .eq('is_active', true)
      .order('rating', { ascending: false });

    if (specialty) {
      query = query.contains('specialty', [specialty]);
    }

    const { data: doctors } = await query;
    return doctors || [];
  } catch (error) {
    console.error('Error getting doctors:', error);
    return [];
  }
};

/**
 * Get review job status
 */
export const getReviewJobStatus = async (
  jobId: string
): Promise<any> => {
  try {
    const { data: job } = await supabase
      .from('doctor_jobs')
      .select(`
        *,
        doctor:doctors(full_name, profile_photo, specialty)
      `)
      .eq('id', jobId)
      .single();

    return job;
  } catch (error) {
    console.error('Error getting job status:', error);
    return null;
  }
};

/**
 * Get user's review history
 */
export const getUserReviewHistory = async (
  userId: string
): Promise<any[]> => {
  try {
    const { data: jobs } = await supabase
      .from('doctor_jobs')
      .select(`
        *,
        doctor:doctors(full_name, profile_photo, specialty)
      `)
      .eq('user_id', userId)
      .order('requested_at', { ascending: false });

    return jobs || [];
  } catch (error) {
    console.error('Error getting review history:', error);
    return [];
  }
};

/**
 * Cancel a review request
 */
export const cancelReviewRequest = async (
  jobId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if job belongs to user and is cancellable
    const { data: job } = await supabase
      .from('doctor_jobs')
      .select('status, user_id')
      .eq('id', jobId)
      .single();

    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    if (job.user_id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    if (job.status !== 'pending' && job.status !== 'assigned') {
      return { success: false, error: 'Cannot cancel job in progress or completed' };
    }

    // Update status to rejected
    await supabase
      .from('doctor_jobs')
      .update({
        status: 'rejected',
        audit_log: supabase.rpc('jsonb_append', {
          target: 'audit_log',
          new_item: {
            action: 'cancelled_by_user',
            timestamp: new Date().toISOString(),
            by: userId,
          },
        }),
      })
      .eq('id', jobId);

    return { success: true };
  } catch (error: any) {
    console.error('Error cancelling review:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Doctor accepts a job
 */
export const acceptJob = async (
  jobId: string,
  doctorId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('doctor_jobs')
      .update({
        doctor_id: doctorId,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
        audit_log: supabase.rpc('jsonb_append', {
          target: 'audit_log',
          new_item: {
            action: 'accepted_by_doctor',
            timestamp: new Date().toISOString(),
            by: doctorId,
          },
        }),
      })
      .eq('id', jobId)
      .eq('status', 'pending'); // Only accept if still pending

    if (error) throw error;

    // Log action
    await supabase.from('doctor_actions').insert({
      doctor_id: doctorId,
      job_id: jobId,
      action: 'accepted',
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error accepting job:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Doctor completes review
 */
export const completeReview = async (
  jobId: string,
  doctorId: string,
  diagnosis: string,
  recommendations?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('doctor_jobs')
      .update({
        status: 'completed',
        doctor_notes: diagnosis,
        doctor_recommendations: recommendations || null,
        completed_at: new Date().toISOString(),
        audit_log: supabase.rpc('jsonb_append', {
          target: 'audit_log',
          new_item: {
            action: 'completed_review',
            timestamp: new Date().toISOString(),
            by: doctorId,
            notes: `Diagnosis: ${diagnosis.slice(0, 100)}...`,
          },
        }),
      })
      .eq('id', jobId)
      .eq('doctor_id', doctorId);

    if (error) throw error;

    // Log action
    await supabase.from('doctor_actions').insert({
      doctor_id: doctorId,
      job_id: jobId,
      action: 'completed_review',
      notes: `Diagnosis: ${diagnosis.slice(0, 100)}...`,
    });

    // Notify patient that review is completed
    await notifyPatientReviewCompleted(jobId);

    return { success: true };
  } catch (error: any) {
    console.error('Error completing review:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify doctor of new job
 */
const notifyDoctor = async (doctorId: string, jobId: string): Promise<void> => {
  try {
    // Get doctor's user_id for push notification
    const { data: doctor } = await supabase
      .from('doctors')
      .select('user_id, email, full_name')
      .eq('id', doctorId)
      .single();

    if (!doctor) return;

    console.log(`📧 Notification: New review job ${jobId} assigned to Dr. ${doctor.full_name}`);

    // TODO: Implement actual push notification
    // This will use the imported notification service
  } catch (error) {
    console.error('Error notifying doctor:', error);
  }
};

/**
 * Prepare review data bundle for submission
 */
export const prepareReviewData = async (
  userId: string,
  aiAlerts: any[],
  chatHistory: any[]
): Promise<Partial<DoctorReviewRequest>> => {
  try {
    // Get relevant metrics (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: metrics } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    // Get contextual Q&A
    const { data: contextualQA } = await supabase
      .from('contextual_questions')
      .select('*')
      .eq('user_id', userId)
      .not('answer', 'is', null)
      .order('asked_at', { ascending: false })
      .limit(10);

    // Get learned patterns
    // TODO: Implement getUserPatterns function when pattern learning is ready
    const learnedPatterns: any[] = [];

    // Calculate AI confidence (weighted average of alert confidence scores)
    const avgConfidence = aiAlerts.length > 0
      ? aiAlerts.reduce((sum, a) => sum + (a.confidence || 0.7), 0) / aiAlerts.length
      : 0.5;

    return {
      relevantMetrics: metrics,
      contextualQA: contextualQA || [],
      learnedPatterns,
      aiConfidence: avgConfidence,
    };
  } catch (error) {
    console.error('Error preparing review data:', error);
    return {
      relevantMetrics: {},
      contextualQA: [],
      learnedPatterns: [],
      aiConfidence: 0.5,
    };
  }
};