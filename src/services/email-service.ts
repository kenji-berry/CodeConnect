import { supabase } from '@/supabaseClient';
import { getHybridRecommendations } from './recommendation-service';
import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);
// Get the sender email from environment or use default
const emailFrom = process.env.EMAIL_FROM || 'CodeConnect <onboarding@resend.dev>';

interface EmailResult {
  success: boolean;
  error?: any;
}

export async function sendRecommendationEmail(
  userId: string,
  userEmail: string,
  recommendations: any[]
): Promise<EmailResult> {
  try {
    console.log(`Preparing recommendation email for ${userEmail}`);
    
    // Format the recommendations for the email
    const emailSubject = "Your CodeConnect Project Recommendations";
    const emailContent = formatRecommendationEmail(recommendations);
    
    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [userEmail],
      subject: emailSubject,
      html: emailContent,
    });
    
    if (error) {
      console.error('Error sending email with Resend:', error);
      return { success: false, error };
    }
    
    console.log(`[EMAIL SERVICE] Sent recommendation email to ${userEmail} with ID: ${data?.id}`);
    
    // Record the email in our logs
    await recordEmailSent(userId);
    
    return { success: true };
  } catch (error) {
    console.error('Error sending recommendation email:', error);
    return { success: false, error };
  }
}

// Format the email content with recommendations
function formatRecommendationEmail(recommendations: any[]): string {
  // Use the domain from env vars or default to codeconnect.open.site
  const domainUrl = process.env.NEXT_PUBLIC_DOMAIN_URL || 'https://codeconnect.open.site';
  
  let emailContent = `
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Your CodeConnect Project Recommendations</h2>
      <p>Here are some projects we thought you might be interested in:</p>
  `;
  
  // Add each recommended project to the email
  recommendations.forEach(project => {
    emailContent += `
      <div style="margin-bottom: 20px; padding: 15px; border-radius: 8px; background-color: #f9f9f9;">
        <h3 style="margin-top: 0; color: #0066cc;">${project.repo_name}</h3>
        <p><strong>Owner:</strong> ${project.repo_owner}</p>
        <p>${project.custom_description || 'No description available'}</p>
        <p><strong>Difficulty:</strong> ${project.difficulty_level || 'Not specified'}</p>
        <p><strong>Tags:</strong> ${project.tags?.join(', ') || 'None'}</p>
        <p><strong>Why we recommended this:</strong> ${project.recommendationReason?.[0] || 'Based on your preferences'}</p>
        <a href="${domainUrl}/projects/${project.repo_name}" 
           style="display: inline-block; padding: 8px 16px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px;">
          View Project
        </a>
      </div>
    `;
  });
  
  // Close the email
  emailContent += `
      <p>Visit <a href="${domainUrl}">CodeConnect</a> to discover more projects!</p>
      <p style="font-size: 12px; color: #999;">
        You received this email because you're subscribed to ${recommendations.length > 1 ? 'daily' : 'weekly'} recommendations.
        <br>You can change your preferences in your <a href="${domainUrl}/settings">account settings</a>.
      </p>
    </body>
    </html>
  `;
  
  return emailContent;
}

// Record that we sent an email
async function recordEmailSent(userId: string): Promise<void> {
  try {
    await supabase
      .from('user_email_logs') 
      .insert({
        user_id: userId,
        email_type: 'recommendations',
        sent_at: new Date().toISOString()
      });
    
    console.log(`[EMAIL SERVICE] Logged email sent to user ${userId}`);
  } catch (error) {
    console.error('Error logging email:', error);
  }
}