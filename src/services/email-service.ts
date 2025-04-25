import { supabaseAdmin } from '@/supabaseAdmin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const emailFrom = process.env.EMAIL_FROM || 'CodeConnect <notifications@codeconnect.cc>';

interface EmailResult {
  success: boolean;
  error?: string | object;
}

interface Recommendation {
  id: number;
  repo_name: string;
  repo_owner: string;
  difficulty_level?: string;
  custom_description?: string;
  tags?: { name: string; colour?: string; is_highlighted?: boolean }[];
  recommendationReason?: string[];
}

export async function sendRecommendationEmail(
  userId: string,
  userEmail: string,
  recommendations: Recommendation[]
): Promise<EmailResult> {
  try {
    console.log(`[EMAIL SERVICE] Preparing recommendation email for ${userEmail}`);

    const emailSubject = "Your CodeConnect Project Recommendations";
    const emailContent = formatRecommendationEmail(recommendations);

    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [userEmail],
      subject: emailSubject,
      html: emailContent,
    });

    if (error) {
      console.error('[EMAIL SERVICE] Error sending email with Resend:', error);
      return { success: false, error: error as string | object };
    }

    console.log(`[EMAIL SERVICE] Sent recommendation email to ${userEmail} with ID: ${data?.id}`);

    if (recommendations.length > 0) {
      const now = new Date().toISOString();
      const rows = recommendations.map(project => ({
        user_id: userId,
        project_id: project.id,
        sent_at: now,
        context: 'recommendation_email'
      }));
      const { error: recHistError } = await supabaseAdmin
        .from('user_recommendation_history')
        .insert(rows);
      if (recHistError) {
        console.error('[EMAIL SERVICE] Error inserting into user_recommendation_history:', recHistError);
      } else {
        console.log(`[EMAIL SERVICE] Logged ${rows.length} recommendations for user ${userId}`);
      }
    }
    return { success: true };
  } catch (error) {
    console.error('[EMAIL SERVICE] Error sending recommendation email:', error);
    return { success: false, error: error as string | object };
  }
}

function formatRecommendationEmail(recommendations: Recommendation[]): string {
  const domainUrl = process.env.NEXT_PUBLIC_DOMAIN_URL || 'https://codeconnect.cc';
  const logoUrl = `https://i.imgur.com/0GT99ZB.png`;
  let emailContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CodeConnect Recommendations</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inria+Sans:wght@400;700&family=Inter:wght@400;600;700&display=swap');
        body {
          font-family: "Inter", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #f5f5f5;
          max-width: 600px;
          margin: 0 auto;
          padding: 0;
          background-color: #18181b;
        }
        .wrapper {
          background: linear-gradient(135deg, #18181b 0%, #232323 60%, #1a1a1a 100%);
          border-radius: 12px;
          overflow: hidden;
          margin: 20px 0;
          border: 1px solid #EC7373;
        }
        .header {
          background-color: #232323; 
          padding: 25px 20px;
          text-align: center;
          border-bottom: 1px solid #EC7373;
        }
        .header img {
          max-height: 60px;
          width: auto;
        }
        .content {
          padding: 30px 25px;
        }
        h1 {
          color: #f5f5f5;
          font-size: 26px;
          margin-top: 0;
          margin-bottom: 20px;
          font-weight: 700;
          font-family: "Inria Sans", sans-serif;
        }
        .intro {
          margin-bottom: 30px;
          color: #e4e4e7;
        }
        .project-card {
          margin-bottom: 25px;
          border: 1px solid #EC7373;
          border-radius: 12px;
          padding: 20px;
          background-color: rgba(35, 35, 35, 0.7);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .project-title {
          font-size: 20px;
          font-weight: 700;
          margin-top: 0;
          margin-bottom: 10px;
          color: #f5f5f5;
          font-family: "Inria Sans", sans-serif;
        }
        .project-meta {
          font-size: 14px;
          color: #e4e4e7;
          margin-bottom: 14px;
        }
        .project-meta strong {
          color: #f5f5f5;
          font-weight: 600;
        }
        .project-desc {
          margin-bottom: 16px;
          color: #f0f0f0;
        }
        .tag {
          display: inline-block;
          font-size: 12px;
          padding: 4px 12px;
          border-radius: 16px;
          margin-right: 6px;
          margin-bottom: 6px;
          border: 1px solid transparent;
        }
        .tag-highlighted {
          background-color: rgba(254, 138, 24, 0.15); /* Orange/Red tint */
          color: #FE8A18; /* Orange/Red text */
          border-color: rgba(254, 138, 24, 0.4);
        }
        .tag-normal {
          background-color: #3f3f46; /* Darker gray bg (Tailwind zinc-700) */
          color: #f0f0f0; /* Lighter gray text */
          border-color: #52525b; /* zinc-600 */
        }
        .tags-container {
          margin-bottom: 16px;
        }
        .highlighted-tech {
          margin: 16px 0;
          padding: 10px 15px;
          background-color: rgba(254, 138, 24, 0.1);
          border-radius: 8px;
          border-left: 3px solid #FE8A18;
        }
        .highlighted-tech-title {
          font-weight: 600;
          color: #FE8A18;
          margin-bottom: 8px;
        }
        .tech-tag {
          display: inline-block;
          font-size: 12px;
          padding: 3px 10px;
          border-radius: 12px;
          margin-right: 5px;
          margin-bottom: 5px;
          background-color: rgba(254, 138, 24, 0.2);
          color: #FE8A18;
          border: 1px solid rgba(254, 138, 24, 0.3);
        }
        .reason {
          font-size: 13px;
          color: #e4e4e7;
          font-style: italic;
          margin: 16px 0 12px 0;
          padding-left: 12px;
          border-left: 3px solid #FE8A18;
        }
        .button {
          display: inline-block;
          padding: 10px 20px;
          background-color: #FE8A18;
          color: #ffffff;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 700;
          font-size: 14px;
          margin-top: 12px;
          text-align: center;
          transition: background-color 0.2s;
        }
        .button:hover {
          background-color: #F9B02F;
        }
        .footer {
          padding: 25px 20px;
          text-align: center;
          font-size: 12px;
          color: #e4e4e7;
          background-color: #232323;
          border-top: 1px solid #EC7373;
        }
        .footer a {
          color: #FE8A18;
          text-decoration: none;
          font-weight: 600;
        }
        .footer a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <img src="${logoUrl}" alt="CodeConnect" />
        </div>
        <div class="content">
          <h1>Your Personalised Project Recommendations</h1>
          <p class="intro">Here are some open source projects we think you'll be interested in based on your preferences and activity:</p>

          <div class="projects-container">
  `;

  recommendations.forEach(project => {
    // Fix for tags: ensure we safely handle undefined values and empty arrays
    const tagsHtml = project.tags && Array.isArray(project.tags) && project.tags.length > 0
      ? project.tags.map(tag => 
          `<span class="tag ${tag.is_highlighted ? 'tag-highlighted' : 'tag-normal'}">${tag.name || 'Unknown'}</span>`
        ).join('')
      : '<span class="tag tag-normal">No tags</span>';
    
    // Extract highlighted technologies from tags
    const highlightedTags = project.tags && Array.isArray(project.tags) 
      ? project.tags.filter(tag => tag.is_highlighted)
      : [];
    
    const highlightedTechHtml = highlightedTags.length > 0 
      ? `<div class="highlighted-tech">
           <div class="highlighted-tech-title">Highlighted Technologies:</div>
           ${highlightedTags.map(tag => `<span class="tech-tag">${tag.name || 'Unknown'}</span>`).join('')}
         </div>`
      : '';

    const description = project.custom_description
      ? (project.custom_description.length > 150
          ? project.custom_description.substring(0, 150) + '...'
          : project.custom_description)
      : 'No description available';

    emailContent += `
      <div class="project-card">
        <h3 class="project-title">${project.repo_name}</h3>

        <div class="project-meta">
          <strong>Owner:</strong> ${project.repo_owner} &nbsp;|&nbsp;
          <strong>Difficulty:</strong> ${project.difficulty_level || 'Not specified'}
        </div>

        <p class="project-desc">${description}</p>

        <div class="tags-container">
          ${tagsHtml}
        </div>
        
        ${highlightedTechHtml}

        <p class="reason">
          ${project.recommendationReason && Array.isArray(project.recommendationReason) && project.recommendationReason.length > 0 
            ? project.recommendationReason[0] 
            : 'Based on your preferences'}
        </p>

        <a href="${domainUrl}/projects/${project.id}" class="button">View Project</a>
      </div>
    `;
  });

  emailContent += `
          </div>
        </div>
        <div class="footer">
          <p>Visit <a href="${domainUrl}">CodeConnect</a> to discover more open source projects!</p>
          <p>
            You received this email because you're subscribed to project recommendations.
            <br>You can change your email preferences in your <a href="${domainUrl}/settings">account settings</a>.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return emailContent;
}