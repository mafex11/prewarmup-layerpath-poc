import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const maxDuration = 30;

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(req: Request) {
  console.log('Calendly webhook received');

  try {
    const payload = await req.json();
    console.log('Webhook payload:', JSON.stringify(payload, null, 2));

    // Extract event type
    const eventType = payload.event;
    
    // Only handle invitee.created events
    if (eventType !== 'invitee.created') {
      console.log('Ignoring event type:', eventType);
      return NextResponse.json({ message: 'Event type not handled' });
    }

    // Extract invitee data
    const invitee = payload.payload?.invitee;
    const event = payload.payload?.event;
    
    if (!invitee || !event) {
      console.error('Missing invitee or event data');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const name = invitee.name || 'Guest';
    const email = invitee.email;
    const eventStartTime = event.start_time;
    const eventName = event.name || '30 Minute Meeting';
    
    // Extract custom question answers
    const questions = invitee.questions_and_answers || [];
    const challenge = questions.find((q: any) => 
      q.question.toLowerCase().includes('challenge') || 
      q.question.toLowerCase().includes('biggest challenge')
    )?.answer || 'Not specified';
    
    const demoType = questions.find((q: any) => 
      q.question.toLowerCase().includes('enhance') || 
      q.question.toLowerCase().includes('looking to')
    )?.answer || 'Not specified';

    console.log('Invitee details:', { name, email, challenge, demoType });

    // Generate custom chat link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const chatLink = `${appUrl}/?invitee_full_name=${encodeURIComponent(name)}&invitee_email=${encodeURIComponent(email)}&answer_1=${encodeURIComponent(challenge)}&answer_2=${encodeURIComponent(demoType)}&event_start_time=${encodeURIComponent(eventStartTime)}&event_type_name=${encodeURIComponent(eventName)}`;

    console.log('Generated chat link:', chatLink);

    // Format meeting time
    const meetingDate = new Date(eventStartTime);
    const formattedDate = meetingDate.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    // Email HTML template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              padding: 30px 0;
            }
            .header h1 {
              color: #1a1a1a;
              margin: 0;
            }
            .content {
              background: #f9f9f9;
              padding: 30px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .button {
              display: inline-block;
              background: #41E1C4;
              color: white !important;
              padding: 14px 28px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin: 20px 0;
            }
            .button:hover {
              background: #2ec4ac;
            }
            .meeting-details {
              background: white;
              padding: 20px;
              border-radius: 6px;
              margin: 20px 0;
              border-left: 4px solid #41E1C4;
            }
            .footer {
              text-align: center;
              color: #666;
              font-size: 14px;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Hi ${name}!</h1>
          </div>
          
          <div class="content">
            <p>Thanks for booking a meeting with us at Layerpath!</p>
            
            <div class="meeting-details">
              <strong>Your Meeting:</strong><br>
              ${formattedDate}<br>
              with Vinay (CEO)
            </div>
            
            <p>To make the most of your time together, I'd love to learn more about your demo challenges before the meeting.</p>
            
            <p><strong>Could you spare 2-3 minutes for a quick chat?</strong></p>
            
            <p>This will help Vinay come fully prepared to address your specific needs.</p>
            
            <div style="text-align: center;">
              <a href="${chatLink}" class="button">Start Pre-Meeting Chat →</a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              Don't worry - it's super quick! Just a few questions to understand your current process and challenges.
            </p>
          </div>
          
          <div class="footer">
            <p>Looking forward to chatting with you!</p>
            <p><strong>Path AI</strong><br>Layerpath</p>
          </div>
        </body>
      </html>
    `;

    // Plain text version
    const emailText = `
Hi ${name}!

Thanks for booking a meeting with us at Layerpath!

Your Meeting:
${formattedDate}
with Vinay (CEO)

To make the most of your time together, I'd love to learn more about your demo challenges before the meeting.

Could you spare 2-3 minutes for a quick chat?

Start Pre-Meeting Chat: ${chatLink}

This will help Vinay come fully prepared to address your specific needs.

Looking forward to chatting with you!

Path AI
Layerpath
    `;

    // Send email
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Layerpath'}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Quick Pre-Meeting Chat Before Your ${eventName}`,
      text: emailText,
      html: emailHtml,
    });

    console.log('Email sent successfully:', info.messageId);

    return NextResponse.json({ 
      success: true, 
      message: 'Email sent',
      messageId: info.messageId,
      chatLink: chatLink 
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// Optional: GET endpoint to test the webhook
export async function GET() {
  return NextResponse.json({ 
    message: 'Calendly webhook endpoint is running',
    status: 'OK' 
  });
}

