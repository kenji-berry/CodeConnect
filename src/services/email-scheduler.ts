import { supabaseAdmin } from '@/supabaseAdmin';
import { getHybridRecommendations } from './recommendation-service';
import { sendRecommendationEmail } from './email-service';

interface EmailScheduleResult {
  success: boolean;
  error?: string | object;
}

export async function processEmailSchedule(): Promise<EmailScheduleResult> {
  console.log('📧 Processing email schedule...');

  try {
    // Get current date information
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Determine which frequency we are processing today
    const frequencies = ['daily'];

    // If its Sunday, also process weekly emails
    if (currentDay === 0) {
      frequencies.push('weekly');
    }

    console.log(`📧 Processing emails for frequencies: ${frequencies.join(', ')}`);

    // Find users who should receive emails today based on their preferences using supabaseAdmin
    const { data: usersToEmail, error: preferencesError } = await supabaseAdmin
      .from('user_email_preferences')
      .select(`
        user_id,
        email_frequency
      `)
      .in('email_frequency', frequencies);

    if (preferencesError) {
      throw preferencesError;
    }

    console.log(`📧 Found ${usersToEmail?.length || 0} users to potentially email`);

    // Track successful and failed emails
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Process each user
    for (const user of (usersToEmail || [])) {
      try {
        // Get user email using supabaseAdmin
        const { data: userData, error: userError } = await supabaseAdmin.auth
          .admin.getUserById(user.user_id);

        const userEmail = userData?.user?.email;

        if (!userEmail) {
          console.log(`📧 No email found for user ${user.user_id}, skipping`);
          skipCount++;
          continue;
        }

        // Check if we already sent an email to this user today using supabaseAdmin
        const { data: recentEmails, error: logError } = await supabaseAdmin
          .from('user_email_logs')
          .select('sent_at')
          .eq('user_id', user.user_id)
          .eq('email_type', 'recommendations')
          .gte('sent_at', `${today}T00:00:00`)
          .order('sent_at', { ascending: false });

        if (logError) {
          console.error(`📧 Error checking email logs for user ${user.user_id}:`, logError);
          errorCount++;
          continue;
        }

        if (recentEmails && recentEmails.length > 0) {
          console.log(`📧 Already sent email to user ${user.user_id} today, skipping`);
          skipCount++;
          continue;
        }

        // Get personalized recommendations for this user
        console.log(`📧 Fetching recommendations for user ${user.user_id}`);
        // Assuming getHybridRecommendations is safe or uses admin client where needed
        const recommendations = await getHybridRecommendations(user.user_id, 5);

        if (!recommendations || recommendations.length === 0) {
          console.log(`📧 No recommendations available for user ${user.user_id}, skipping`);
          skipCount++;
          continue;
        }

        // Send the email with recommendations
        const result = await sendRecommendationEmail(user.user_id, userEmail, recommendations);

        if (result.success) {
          console.log(`📧 Successfully sent recommendation email to ${userEmail}`);
          // Log the successful email send using supabaseAdmin
          const { error: insertLogError } = await supabaseAdmin
            .from('user_email_logs')
            .insert({
              user_id: user.user_id,
              email_type: 'recommendations',
              sent_at: new Date().toISOString()
            });
          if (insertLogError) {
            console.error(`📧 Failed to log successful email for ${userEmail}:`, insertLogError);
          }
          successCount++;
        } else {
          console.error(`📧 Failed to send email to ${userEmail}:`, result.error);
          errorCount++;
        }
      } catch (userProcessingError) {
        console.error(`📧 Error processing user ${user.user_id}:`, userProcessingError);
        errorCount++;
      }
    }

    console.log(`📧 Email processing complete. Success: ${successCount}, Skipped: ${skipCount}, Errors: ${errorCount}`);
    return { success: true };

  } catch (error) {
    console.error('📧 Error in email scheduler:', error);
    return { success: false, error: error as string | object };
  }
}