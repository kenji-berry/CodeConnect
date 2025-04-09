import { supabase } from '@/supabaseClient';
import { getHybridRecommendations } from './recommendation-service';
import { sendRecommendationEmail } from './email-service';

export async function processEmailSchedule(): Promise<{ success: boolean; error?: any }> {
  console.log('📧 Processing email schedule...');
  
  try {
    // Get current date information
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Determine which frequency we're processing today
    const frequencies = ['daily'];
    
    // If it's Sunday, also process weekly emails
    if (currentDay === 0) {
      frequencies.push('weekly');
    }
    
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
        // Get the user's email address
        const { data: userData, error: userError } = await supabase
          .from('profiles') // Make sure this matches your profiles table name
          .select('email')
          .eq('id', user.user_id)
          .single();
        
        if (userError || !userData || !userData.email) {
          console.log(`📧 No email found for user ${user.user_id}, skipping`);
          skipCount++;
          continue;
        }
        
        const userEmail = userData.email;
        
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
    return { success: false, error };
  }
}