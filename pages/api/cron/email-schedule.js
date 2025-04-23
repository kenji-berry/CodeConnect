import { processEmailSchedule } from '@/services/email-scheduler';

export default async function handler(req, res) {
  console.log('[CRON HANDLER /api/cron/email-schedule] Received request.');

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    console.log('[CRON HANDLER /api/cron/email-schedule] Calling processEmailSchedule...');
    const result = await processEmailSchedule();

    if (result.success) {
      console.log('[CRON HANDLER /api/cron/email-schedule] processEmailSchedule succeeded.');
      return res.status(200).json({ success: true, message: 'Email schedule processed successfully.' });
    } else {
      console.error('[CRON HANDLER /api/cron/email-schedule] processEmailSchedule failed:', result.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process email schedule.',
        details: result.error
      });
    }
  } catch (error) {
    console.error('[CRON HANDLER /api/cron/email-schedule] Unhandled error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error in cron handler.'
    });
  }
}