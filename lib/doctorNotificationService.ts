// lib/doctorNotificationService.ts
import { supabase } from './supabaseClient';

/**
 * Send push notification to doctor when new job is created
 */
export async function notifyDoctorNewJob(jobId: string) {
  try {
    const { data: job } = await supabase
      .from('doctor_jobs')
      .select('*, users:user_id(email)')
      .eq('id', jobId)
      .single();

    if (!job) return;

    // Get all active doctors with matching specialty
    const { data: doctors } = await supabase
      .from('doctors')
      .select('*')
      .eq('is_active', true)
      .eq('verified', true);

    if (!doctors || doctors.length === 0) return;

    // Filter doctors by specialty match
    const matchingDoctors = doctors.filter((doctor) =>
      job.specialty_needed.some((spec: string) =>
        doctor.specialty?.includes(spec)
      ) || job.specialty_needed.includes('general')
    );

    // Send push notifications to all matching doctors
    const notifications = matchingDoctors
      .filter((doctor) => doctor.push_token)
      .map((doctor) => ({
        to: doctor.push_token,
        sound: 'default',
        title: '🏥 New Review Request',
        body: `Priority ${job.priority} • ${job.specialty_needed.join(', ')}`,
        data: {
          type: 'new_job',
          jobId: job.id,
          priority: job.priority,
        },
        badge: 1,
      }));

    // Send via Expo Push Notifications
    if (notifications.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notifications),
      });
    }

    console.log(`Sent ${notifications.length} notifications for job ${jobId}`);
  } catch (error) {
    console.error('Error sending doctor notifications:', error);
  }
}

/**
 * Notify patient when doctor starts review
 */
export async function notifyPatientReviewStarted(jobId: string) {
  try {
    const { data: job } = await supabase
      .from('doctor_jobs')
      .select(`
        *,
        doctors:doctor_id(full_name),
        users:user_id(push_token)
      `)
      .eq('id', jobId)
      .single();

    if (!job || !job.users?.push_token) return;

    const notification = {
      to: job.users.push_token,
      sound: 'default',
      title: '👨‍⚕️ Doctor Reviewing Your Case',
      body: `Dr. ${job.doctors?.full_name || 'Your doctor'} is now reviewing your health data`,
      data: {
        type: 'review_started',
        jobId: job.id,
      },
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notification),
    });
  } catch (error) {
    console.error('Error notifying patient:', error);
  }
}

/**
 * Notify patient when doctor completes review
 */
export async function notifyPatientReviewCompleted(jobId: string) {
  try {
    const { data: job } = await supabase
      .from('doctor_jobs')
      .select(`
        *,
        doctors:doctor_id(full_name),
        users:user_id(push_token)
      `)
      .eq('id', jobId)
      .single();

    if (!job || !job.users?.push_token) return;

    const notification = {
      to: job.users.push_token,
      sound: 'default',
      title: '✅ Review Complete',
      body: 'Your doctor has completed the review. Tap to see results.',
      data: {
        type: 'review_completed',
        jobId: job.id,
      },
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notification),
    });
  } catch (error) {
    console.error('Error notifying patient:', error);
  }
}

/**
 * Send reminder to doctor if job unassigned for > 30 minutes
 */
export async function sendJobReminderNotifications() {
  try {
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    // Get pending high-priority jobs older than 30 minutes
    const { data: urgentJobs } = await supabase
      .from('doctor_jobs')
      .select('*')
      .eq('status', 'pending')
      .gte('priority', 70)
      .lte('created_at', thirtyMinutesAgo.toISOString());

    if (!urgentJobs || urgentJobs.length === 0) return;

    // Get all active doctors
    const { data: doctors } = await supabase
      .from('doctors')
      .select('*')
      .eq('is_active', true)
      .eq('verified', true);

    if (!doctors || doctors.length === 0) return;

    // Send reminder to all doctors
    const notifications = doctors
      .filter((doctor) => doctor.push_token)
      .map((doctor) => ({
        to: doctor.push_token,
        sound: 'default',
        title: '⚠️ Urgent Cases Waiting',
        body: `${urgentJobs.length} high-priority case${urgentJobs.length > 1 ? 's' : ''} need review`,
        data: {
          type: 'urgent_reminder',
          count: urgentJobs.length,
        },
      }));

    if (notifications.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notifications),
      });
    }

    console.log(`Sent ${notifications.length} urgent reminders`);
  } catch (error) {
    console.error('Error sending reminders:', error);
  }
}