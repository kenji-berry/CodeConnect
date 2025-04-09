import { NextRequest, NextResponse } from 'next/server';
import { processEmailSchedule } from '@/services/email-scheduler';

// This endpoint will be called by a scheduled job
export async function POST(req: NextRequest) {
  try {
    // Authenticate the request (use a secure API key)
    const apiKey = req.headers.get('x-api-key');
    const validApiKey = process.env.CRON_API_KEY;
    
    if (!apiKey || apiKey !== validApiKey) {
      console.warn('Unauthorized attempt to trigger email sending');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Process the email schedule
    const result = await processEmailSchedule();
    
    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Email recommendations processed successfully' 
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to process emails' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing email recommendations:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}