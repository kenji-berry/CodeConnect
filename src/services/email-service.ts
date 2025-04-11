import { supabase } from '@/supabaseClient';
import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);
// Get the sender email from environment or use default
const emailFrom = process.env.EMAIL_FROM || 'CodeConnect <onboarding@resend.dev>';

interface EmailResult {
  success: boolean;
  error?: string | object;
}

interface Recommendation {
  repo_name: string;
  repo_owner: string;
  difficulty_level?: string;
  custom_description?: string;
  tags?: string[];
  recommendationReason?: string[];
}

export async function sendRecommendationEmail(
  userId: string,
  userEmail: string,
  recommendations: Recommendation[]
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
      return { success: false, error: error as string | object };
    }
    
    console.log(`[EMAIL SERVICE] Sent recommendation email to ${userEmail} with ID: ${data?.id}`);
    
    // Record the email in our logs
    await recordEmailSent(userId);
    
    return { success: true };
  } catch (error) {
    console.error('Error sending recommendation email:', error);
    return { success: false, error: error as string | object };
  }
}

// Format the email content with recommendations
function formatRecommendationEmail(recommendations: Recommendation[]): string {
  const domainUrl = process.env.NEXT_PUBLIC_DOMAIN_URL || 'https://codeconnect.open.site';
  
  const logoUrl = `${domainUrl}/CodeConnectTitle.png`;
  
  let emailContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CodeConnect Recommendations</title>
      <style>
        body {
          font-family: "Inter", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #f5f5f5;
          max-width: 600px;
          margin: 0 auto;
          padding: 0;
          background-color: #2f2c34;
        }
        .wrapper {
          background: radial-gradient(#3c353d, #2f2c34);
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
          margin: 20px 0;
        }
        .header {
          background-color: #222024;
          padding: 20px;
          text-align: center;
          border-bottom: 1px solid rgba(245, 245, 245, 0.1);
        }
        .header img {
          max-height: 45px;
          width: auto;
        }
        .content {
          padding: 30px 20px;
        }
        h1 {
          color: #f9b028;
          font-size: 24px;
          margin-top: 0;
          margin-bottom: 20px;
          font-weight: 700;
          font-family: "Inria Sans", sans-serif;
        }
        .intro {
          margin-bottom: 30px;
          color: #ffffff;
          opacity: 1;
        }
        .project-card {
          margin-bottom: 25px;
          border: 1px solid rgba(245, 245, 245, 0.2);
          border-radius: 6px;
          padding: 18px;
          transition: all 0.2s;
          background-color: rgba(60, 53, 61, 0.5);
        }
        .project-card:hover {
          border-color: rgba(249, 176, 40, 0.4);
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .project-title {
          font-size: 18px;
          font-weight: 600;
          margin-top: 0;
          margin-bottom: 10px;
          color: #ff8585;
          font-family: "Inria Sans", sans-serif;
        }
        .project-meta {
          font-size: 14px;
          color: #ffffff;
          margin-bottom: 14px;
          opacity: 0.9;
        }
        .project-meta strong {
          color: #ffffff;
          opacity: 1;
        }
        .project-desc {
          margin-bottom: 16px;
          color: #f5f5f5;
        }
        .tag {
          display: inline-block;
          background-color: rgba(249, 176, 40, 0.15);
          color: #f9b028;
          font-size: 12px;
          padding: 4px 10px;
          border-radius: 12px;
          margin-right: 6px;
          margin-bottom: 6px;
          border: 1px solid rgba(249, 176, 40, 0.3);
        }
        .tags-container {
          margin-bottom: 16px;
        }
        .reason {
          font-size: 13px;
          color: #f5f5f5;
          font-style: italic;
          margin: 12px 0;
          padding-left: 10px;
          border-left: 3px solid #f9b028;
          opacity: 0.8;
        }
        .button {
          display: inline-block;
          padding: 8px 16px;
          background-color: #f9b028;
          color: #2f2c34;
          text-decoration: none;
          border-radius: 4px;
          font-weight: 600;
          font-size: 14px;
          margin-top: 8px;
          text-align: center;
        }
        .button:hover {
          background-color: #fac052;
        }
        .footer {
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #f5f5f5;
          background-color: rgba(47, 44, 52, 0.8);
          border-top: 1px solid rgba(245, 245, 245, 0.1);
          opacity: 0.7;
        }
        .footer a {
          color: #f9b028;
          text-decoration: none;
        }
        .emoji {
          font-size: 1.2em;
          margin-right: 4px;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <img src="${logoUrl}" alt="CodeConnect" />
        </div>
        <div class="content">
          <h1>Your Personalized Project Recommendations</h1>
          <p class="intro">Here are some open source projects we think you'll be interested in based on your preferences and activity:</p>
          
          <div class="projects-container">
  `;
  
  // Add each recommended project to the email with improved card design
  recommendations.forEach(project => {
    // Format tags for display
    const tagsHtml = project.tags && project.tags.length > 0
      ? project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')
      : '<span class="tag">No tags</span>';
    
    // Limit description length
    const description = project.custom_description 
      ? (project.custom_description.length > 150 
          ? project.custom_description.substring(0, 150) + '...' 
          : project.custom_description)
      : 'No description available';
    
    emailContent += `
      <div class="project-card">
        <h3 class="project-title">${project.repo_name}</h3>
        
        <div class="project-meta">
          <strong>👤 Owner:</strong> ${project.repo_owner} &nbsp;|&nbsp; 
          <strong>Difficulty:</strong> ${project.difficulty_level || 'Not specified'}
        </div>
        
        <p class="project-desc">${description}</p>
        
        <div class="tags-container">
          ${tagsHtml}
        </div>
        
        <p class="reason">
          💬 ${project.recommendationReason?.[0] || 'Based on your preferences'}
        </p>
        
        <a href="${domainUrl}/projects/${project.repo_name}" class="button">👀 View Project</a>
      </div>
    `;
  });
  
  // Close the email with footer and preference management link
  emailContent += `
          </div>
        </div>
        <div class="footer">
          <p>🌐 Visit <a href="${domainUrl}">CodeConnect</a> to discover more open source projects to contribute to!</p>
          <p>
            📧 You received this email because you're subscribed to project recommendations.
            <br>⚙️ You can change your email preferences in your <a href="${domainUrl}/settings">account settings</a>.
          </p>
        </div>
      </div>
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