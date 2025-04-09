import { Resend } from 'resend';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

async function testResend() {
  try {
    console.log('Testing Resend email sending...');
    
    // Use your actual email address here
    const yourEmail = 'your-real-email@example.com'; 
    
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev', // Using Resend's sandbox domain
      to: [yourEmail], // Make sure to use your actual email
      subject: 'CodeConnect Test Email',
      html: '<p>This is a test email from CodeConnect using Resend.</p>'
    });
    
    if (error) {
      console.error('Resend error:', error);
      return;
    }
    
    console.log('Test email sent successfully!');
    console.log('Email ID:', data?.id);
  } catch (error) {
    console.error('Exception during test:', error);
  }
}

// Run the test
testResend();