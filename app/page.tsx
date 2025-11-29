'use client';

import { useChat } from '@ai-sdk/react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, Suspense, useState, FormEvent } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/app/lib/utils';

// Define a local interface to satisfy TS for our usage, 
// even if the SDK types are being difficult.
interface Message {
  id: string;
  role: string;
  content: string;
  toolInvocations?: any[];
}

function ChatInterface() {
  const searchParams = useSearchParams();
  
  // Extract Calendly parameters
  const name = searchParams.get('invitee_full_name') || 'Guest';
  const email = searchParams.get('invitee_email');
  const challenge = searchParams.get('answer_1'); // "What's your biggest challenge with product demos today?"
  const demoType = searchParams.get('answer_2');  // "Are you looking to enhance your demos, sales team demos or both?"

  const chatHelpers = useChat({
    api: '/api/chat',
    maxSteps: 5,
  } as any) as any;

  const { messages, sendMessage, status, setMessages } = chatHelpers;
  const isLoading = status === 'submitted' || status === 'streaming';
  
  const [inputValue, setInputValue] = useState('');
  const hasStarted = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize system message and trigger AI on first load
  useEffect(() => {
    if (!hasStarted.current && setMessages && sendMessage && messages.length === 0 && (name || challenge)) {
      hasStarted.current = true;
      
      // Add system message with Calendly context
      setMessages([
        {
          id: 'system-context',
          role: 'system',
          content: `CONTEXT OVERRIDE: You are now talking to ${name} (${email || "no email"}).

Their Calendly form responses:
- Biggest challenge with product demos: "${challenge || "not specified"}"
- Looking to enhance: "${demoType || "not specified"}"

CRITICAL INSTRUCTIONS:
1. Do NOT greet them generically
2. Do NOT ask for their name (you already have it: ${name})
3. IMMEDIATELY start by acknowledging their specific challenge about: "${challenge}"
4. Ask ONE focused follow-up question to dig deeper into their challenge
5. Keep your response to 1-3 sentences maximum

Start now with a personalized opening.`
        }
      ]);
      
      // Trigger AI response
      setTimeout(() => {
        sendMessage({ text: 'Hi, I\'m ready to chat.' });
      }, 100);
    }
  }, [setMessages, sendMessage, messages, name, email, challenge, demoType]);

  // Filter out system and trigger messages, extract text from parts
  const visibleMessages = (messages || [])
    .filter((m: any) => {
      // Hide system messages
      if (m.role === 'system') return false;
      
      // Filter by content if it exists
      if (m.content) {
        return m.content !== 'Hi, I\'m ready to chat.';
      }
      // Filter by parts if content doesn't exist
      if (m.parts) {
        const textContent = m.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('');
        return textContent !== 'Hi, I\'m ready to chat.';
      }
      return true;
    })
    .map((m: any) => {
      // If message has parts, extract text
      if (m.parts && !m.content) {
        const textContent = m.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('');
        return { ...m, content: textContent };
      }
      return m;
    });

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white shadow-xl border-x border-gray-100">
      {/* Header */}
      <header className="p-4 border-b bg-white z-10 sticky top-0 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
          <Bot size={24} />
        </div>
        <div>
          <h1 className="font-semibold text-lg">Path</h1>
          <p className="text-xs text-gray-500">Layerpath AI Demo Agent</p>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {visibleMessages.length === 0 && isLoading && (
           <div className="flex justify-center py-10">
             <Loader2 className="animate-spin text-gray-400" />
           </div>
        )}
        
        {visibleMessages.map((m: any) => (
          <div
            key={m.id}
            className={cn(
              "flex gap-3 max-w-[85%]",
              m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              m.role === 'user' ? "bg-gray-200" : "bg-blue-600 text-white"
            )}>
              {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            
            <div className={cn(
              "p-3 rounded-2xl text-sm leading-relaxed",
              m.role === 'user' 
                ? "bg-blue-600 text-white rounded-tr-sm" 
                : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
            )}>
              {m.content}
              {m.toolInvocations?.map((toolInvocation: any) => {
                 const { toolName, toolCallId, state } = toolInvocation;
                 if (state === 'result') {
                   return (
                     <div key={toolCallId} className="mt-2 text-xs bg-gray-100 p-2 rounded border border-gray-200 font-mono text-gray-500">
                       {'result' in toolInvocation ? (
                         <>Called {toolName}...</>
                       ) : null}
                     </div>
                   );
                 } 
                 return (
                    <div key={toolCallId} className="mt-2 text-xs text-gray-400 animate-pulse">
                        Calling {toolName}...
                    </div>
                 );
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t">
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!inputValue.trim()) return;
          
          const message = inputValue;
          setInputValue('');
          
          if (sendMessage) {
            sendMessage({ text: message });
          }
        }} className="flex gap-2">
          <input
            className="flex-1 p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message..."
            autoFocus
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading chat...</div>}>
      <ChatInterface />
    </Suspense>
  );
}
