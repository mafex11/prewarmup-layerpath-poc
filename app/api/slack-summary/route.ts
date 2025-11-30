import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 30;

export async function POST(req: Request) {
  console.log('Slack summary endpoint called');
  
  try {
    const body = await req.json();
    const { messages, customerInfo } = body;

    console.log('Request data:', {
      messageCount: messages?.length || 0,
      customerName: customerInfo?.name,
      customerEmail: customerInfo?.email,
    });

    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!slackWebhookUrl) {
      console.warn('SLACK_WEBHOOK_URL not set');
      return NextResponse.json({ success: false, message: 'Webhook not configured' }, { status: 500 });
    }

    // Filter and extract conversation text
    const conversationMessages = messages
      .filter((m: any) => m.role !== 'system' && m.content !== "Hi, I'm ready to chat.")
      .map((m: any) => {
        // Extract content from either content field or parts array
        let text = m.content || '';
        if (!text && m.parts) {
          text = m.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('');
        }
        // Remove [END_SESSION] marker (case-insensitive)
        text = text.replace(/\s*\[END_?SESSION\]\s*/gi, '').trim();
        return {
          role: m.role,
          text: text,
        };
      })
      .filter((m: any) => m.text && m.text !== "Hi, I'm ready to chat.");

    console.log('Conversation messages to summarize:', conversationMessages.length);
    console.log('Sample messages:', conversationMessages.slice(0, 3).map((m: { role: string; text: string }) => ({ role: m.role, preview: m.text.substring(0, 50) })));

    if (conversationMessages.length === 0) {
      console.error('No conversation messages to summarize');
      return NextResponse.json({ success: false, message: 'No conversation to summarize' }, { status: 400 });
    }

    console.log('Generating AI summary...');
    
    // Generate AI summary
    const conversationText = conversationMessages
      .map((m: any) => `${m.role === 'user' ? 'Customer' : 'AI'}: ${m.text}`)
      .join('\n\n');

    const summaryPrompt = `Summarize this pre-meeting conversation for CEO Vinay. Extract key information in a concise, point-wise format.

IMPORTANT FORMATTING RULES:
- NO asterisks (*), NO dashes (-), NO bold formatting (**)
- Keep each point SHORT (2 line maximum)
- Only include information that was ACTUALLY discussed
- Be specific and actionable

Extract these if mentioned:
1. Key Pain Points
2. Current Process/Tools
3. Team & Stakeholders
4. Desired Outcomes
5. Timeline/Urgency
6. Specific Use Cases

Conversation:
${conversationText}

Return ONLY the numbered points. If nothing substantial was discussed, write: "No detailed information shared in the chat."`;

    const summaryResult = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: summaryPrompt },
      ],
    });

    const summary = summaryResult.choices[0]?.message?.content || 'Summary generation failed.';
    console.log('AI Summary generated:', summary.substring(0, 200) + '...');

    // Format Slack message - clean and plain
    const slackMessage = {
      text: `New Pre-Meeting Chat Summary

Customer: ${customerInfo.name || 'Unknown'}
Email: ${customerInfo.email || 'Unknown'}
Meeting: ${customerInfo.meetingTime || 'Unknown'}

Calendly Form Answers:
Biggest Challenge: ${customerInfo.challenge || 'Not provided'}
Demo Type: ${customerInfo.demoType || 'Not provided'}

Chat Summary:
${summary}

Completed: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`
    };

    // Send to Slack
    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }

    console.log('Slack summary sent successfully');
    return NextResponse.json({ success: true, message: 'Summary sent to Slack' });

  } catch (error: any) {
    console.error('Failed to send Slack summary:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

