const { Resend } = require('resend');
require('dotenv').config({ path: '.env.local' });

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

//test email
const yourEmail = 'kenjiberry321@gmail.com';

async function testResendEmail() {
  try {
    console.log('Testing Resend email sending...');
    console.log(`API Key exists: ${Boolean(process.env.RESEND_API_KEY)}`);
    
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev', // Using Resend's sandbox domain
      to: [yourEmail],
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
testResendEmail();