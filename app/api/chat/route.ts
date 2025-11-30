import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { LAYERPATH_PRE_MEETING_AGENT_PROMPT } from '@/app/lib/prompts';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json();
  const { messages } = body;

  // Convert UIMessage format to standard message format if needed
  const processedMessages = messages.map((msg: any) => {
    if (msg.parts) {
      // UIMessage format - extract text from parts
      const textContent = msg.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('');
      return {
        role: msg.role,
        content: textContent
      };
    }
    return msg;
  });

  const result = streamText({
    model: openai('gpt-4o'),
    system: LAYERPATH_PRE_MEETING_AGENT_PROMPT,
    messages: processedMessages,
  } as any);

  const res = result as any;
  return res.toDataStreamResponse ? res.toDataStreamResponse() : res.toUIMessageStreamResponse();
}

