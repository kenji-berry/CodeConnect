import { supabase } from '@/supabaseClient';
import { supabaseAdmin } from '@/supabaseAdmin'; // Add this import
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
    
    // --- TEMP: Add 'every5min' frequency for testing the 5 min cron job ---
    const frequencies = ['daily', 'every5min'];
    
    // If it's Sunday, also process weekly emails

    
    console.log(`📧 Processing emails for frequencies: ${frequencies.join(', ')}`);
    
    // Find users who should receive emails today based on their preferences
    const { data: usersToEmail, error } = await supabase
      .from('user_email_preferences')
      .select(`
        user_id,
        email_frequency
      `)
      .in('email_frequency', frequencies);
    
    if (error) {
      throw error;
    }
    
    console.log(`📧 Found ${usersToEmail?.length || 0} users to potentially email`);
    
    // Track successful and failed emails
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    // Process each user
    for (const user of (usersToEmail || [])) {
      try {
        const { data: userData, error: userError } = await supabaseAdmin.auth
          .admin.getUserById(user.user_id);
    
        const userEmail = userData?.user?.email;
        
        if (!userEmail) {
          console.log(`📧 No email found for user ${user.user_id}, skipping`);
          skipCount++;
          continue;
        }
        
        // Check if we already sent an email to this user today
        const { data: recentEmails } = await supabase
          .from('user_email_logs')
          .select('sent_at')
          .eq('user_id', user.user_id)
          .eq('email_type', 'recommendations')
          .gte('sent_at', `${today}T00:00:00`)
          .order('sent_at', { ascending: false });
        
        if (recentEmails && recentEmails.length > 0) {
          console.log(`📧 Already sent email to user ${user.user_id} today, skipping`);
          skipCount++;
          continue;
        }
        
        // Get personalized recommendations for this user
        console.log(`📧 Fetching recommendations for user ${user.user_id}`);
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
          successCount++;
        } else {
          console.error(`📧 Failed to send email to ${userEmail}:`, result.error);
          errorCount++;
        }
      } catch (userError) {
        console.error(`📧 Error processing user ${user.user_id}:`, userError);
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