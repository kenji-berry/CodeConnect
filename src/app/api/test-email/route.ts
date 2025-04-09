import { NextRequest, NextResponse } from 'next/server';
import { getHybridRecommendations } from '@/services/recommendation-service';
import { sendRecommendationEmail } from '@/services/email-service';

// WARNING: Only use in development/testing environments
export async function POST(req: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Not available in production' },
        { status: 403 }
      );
    }
    
    // Get the test parameters from the request body
    const { userId, email } = await req.json();
    
    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId, email' },
        { status: 400 }
      );
    }
    
    console.log(`🧪 Testing email for user ${userId} to address ${email}`);
    
    // Get recommendations for this user
    const recommendations = await getHybridRecommendations(userId, 5);
    
    if (!recommendations || recommendations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No recommendations available for this user' },
        { status: 404 }
      );
    }
    
    // Send the email
    const result = await sendRecommendationEmail(userId, email, recommendations);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${email}`
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}