import { NextResponse } from 'next/server';
import { processEmailSchedule } from '@/services/email-scheduler';

export const config = {
  runtime: 'edge',
};

export async function GET(request: Request) {
  // Get the URL to check if it's a cron request
  const url = new URL(request.url);
  const cronType = url.searchParams.get('cron');
  
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get('Authorization');
  
  // Security check
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('Unauthorized attempt to access cron job');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log(`🔄 Running scheduled email job (${cronType}) from Vercel cron`);
    const result = await processEmailSchedule();
    
    return NextResponse.json({
      success: true,
      message: `Email schedule (${cronType}) processed successfully`,
      result
    });
  } catch (error) {
    console.error('Error in cron job:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to process email schedule'
    }, { status: 500 });
  }
}