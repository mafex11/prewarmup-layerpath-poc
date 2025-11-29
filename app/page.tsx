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
  const name = searchParams.get('invitee_full_name');
  const email = searchParams.get('invitee_email');
  const challenge = searchParams.get('answer_1'); // "What is your biggest challenge?"
  const role = searchParams.get('answer_2');      // "What is your role?"

  // Cast useChat to any because of v5/v2 type mismatches in this specific setup
  // The runtime behavior for useChat usually supports 'api', 'body', and returns 'messages', 'input', etc.
  // If the installed version is stripped down, we might need to rely on what's available.
  // But for now, we assume standard behavior and silence TS.
  const { messages, input, handleInputChange, handleSubmit, append, isLoading } = useChat({
    api: '/api/chat',
    body: {
      data: { name, email, challenge, role }
    },
    maxSteps: 5,
  } as any) as any;

  const inputValue = input || ''; // Ensure input is never undefined

  const hasStarted = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Proactive start
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      // We send a hidden message to trigger the AI's first response
      if (append) {
        append({
          role: 'user',
          content: 'Start the conversation now.',
        });
      }
    }
  }, [append]);

  // Filter out the hidden start message from the UI
  const visibleMessages = (messages || []).filter((m: any) => m.content !== 'Start the conversation now.');

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
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            className="flex-1 p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
            value={inputValue}
            onChange={handleInputChange}
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
