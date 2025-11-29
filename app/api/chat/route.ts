import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { LAYERPATH_AI_AGENT_PROMPT } from '@/app/lib/prompts';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, data } = await req.json();

  const { name, email, challenge, role } = data || {};

  // Construct the specific context instruction
  let contextInstruction = "";
  if (name || challenge || role) {
    contextInstruction = `\n\nSYSTEM INSTRUCTION: You are talking to ${name || "a user"}. They are facing "${challenge || "unknown challenge"}" and work in "${role || "unknown role"}". Do NOT ask them who they are. Start the conversation by immediately offering help with "${challenge}".`;
  }

  const systemPrompt = LAYERPATH_AI_AGENT_PROMPT + contextInstruction;

  // Use provided key if env var is missing (Note: strictly for this demo setup)
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
  }

  const result = streamText({
    model: google('gemini-1.5-flash', {
        apiKey: apiKey,
    }),
    messages,
    tools: {
        search_knowledge_base: tool({
            description: 'Search the knowledge base for information about Layerpath, pricing, features, etc.',
            parameters: z.object({
                query: z.string().describe('The search query'),
            }),
            execute: async ({ query }) => {
                return `[Mock Knowledge Base Result for: ${query}]\nLayerpath is an AI-powered interactive demo platform. \nPricing: Creator (Free), Professional ($49/mo), Growth ($99/mo).\nFeatures: AI agents, interactive video demos, analytics.`;
            },
        }),
        fetch_product_capabilities: tool({
            description: 'Get relevant product capabilities based on user needs',
            parameters: z.object({
                context: z.string().describe('User context and needs'),
            }),
            execute: async ({ context }) => {
                return `[Capabilities]\n- Personalized AI demos\n- Interactive overlays\n- CRM integration\n- Analytics dashboard`;
            },
        }),
        check_demo_availability: tool({
            description: 'Check available demo slots',
            parameters: z.object({}),
            execute: async () => {
                return "Available slots: Tomorrow at 10am, 2pm, or 4pm.";
            },
        }),
        book_demo: tool({
            description: 'Book a demo slot',
            parameters: z.object({
                email: z.string(),
                slot: z.string(),
            }),
            execute: async ({ email, slot }) => {
                return `Demo booked for ${email} at ${slot}.`;
            },
        }),
        search_live_demo_knowledge_base: tool({
            description: 'Search for live interactive demos',
            parameters: z.object({ query: z.string() }),
            execute: async ({ query }) => {
                return `Found demo: "Interactive Product Tour" (ID: 123)`;
            },
        }),
        navigate_to_nth_step_in_demo: tool({
            description: 'Navigate to a specific step in the demo',
            parameters: z.object({ step: z.number() }),
            execute: async ({ step }) => {
                return `Navigated to step ${step}. Showing feature details.`;
            },
        }),
        end_session: tool({
            description: 'End the conversation session',
            parameters: z.object({}),
            execute: async () => {
                return "Session ended.";
            },
        }),
    },
    maxSteps: 5, // Allow multi-step tool calls (e.g. search then answer)
  });

  return result.toDataStreamResponse();
}

