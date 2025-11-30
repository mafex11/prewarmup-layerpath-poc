'use client';

import { useChat } from '@ai-sdk/react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, Suspense, useState } from 'react';
import { Send, User, Bot, Loader2, ArrowUp, Brain } from 'lucide-react';
import { cn } from '@/app/lib/utils';

function ChatInterface() {
  const searchParams = useSearchParams();
  
  // Extract Calendly parameters
  const name = searchParams.get('invitee_full_name') || 'Guest';
  const email = searchParams.get('invitee_email');
  const challenge = searchParams.get('answer_1'); 
  const demoType = searchParams.get('answer_2');  
  const eventStartTime = searchParams.get('event_start_time');
  const eventName = searchParams.get('event_type_name');
  
  const formatMeetingTime = (isoString: string | null) => {
    if (!isoString) return 'soon';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return 'soon';
    }
  };
  
  const meetingTime = formatMeetingTime(eventStartTime);

  const chatHelpers = useChat({
    api: '/api/chat',
    maxSteps: 5,
  } as any) as any;

  const { messages, sendMessage, status, setMessages } = chatHelpers;
  const isLoading = status === 'submitted' || status === 'streaming';
  
  const [inputValue, setInputValue] = useState('');
  const [conversationEnded, setConversationEnded] = useState(false);
  const hasStarted = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input after AI responds
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    
    // If last message is from AI and loading is done, focus input
    if (lastMessage.role === 'assistant' && !isLoading && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [messages, isLoading]);

  // Detect [END_SESSION] marker with robust checking
  useEffect(() => {
    if (messages.length === 0 || conversationEnded) return;
    
    const lastMessage = messages[messages.length - 1];
    
    // Only check AI messages
    if (lastMessage.role !== 'assistant') return;
    
    // Get message content
    let content = lastMessage.content || '';
    if (!content && lastMessage.parts) {
      content = lastMessage.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('');
    }
    
    // Check for [END_SESSION] marker (case-insensitive, flexible spacing)
    const hasEndMarker = /\[END_?SESSION\]/i.test(content);
    
    console.log('🔍 Checking for end marker:', {
      hasMarker: hasEndMarker,
      lastChars: content.substring(Math.max(0, content.length - 100)),
      messageId: lastMessage.id,
    });
    
    if (hasEndMarker) {
      console.log('✅ [END_SESSION] marker detected! Ending conversation.');
      triggerConversationEnd();
    }
    
  }, [messages, conversationEnded, name, email, meetingTime, challenge]);
  
  const triggerConversationEnd = () => {
    fetch('/api/slack-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages,
        customerInfo: { name, email, meetingTime, challenge },
      }),
    }).then(() => console.log('✅ Slack summary sent'))
      .catch((e) => console.error('❌ Slack summary failed:', e));
    
    setConversationEnded(true);
  };

  // Initialize system message and trigger AI on first load
  useEffect(() => {
    if (!hasStarted.current && setMessages && sendMessage && messages.length === 0 && (name || challenge)) {
      hasStarted.current = true;
      
      setMessages([
        {
          id: 'system-context',
          role: 'system',
          content: `# Customer Context & Meeting Goal

## Context
- **User**: ${name}
- **Email**: ${email || "not provided"}
- **Challenge**: "${challenge || "not specified"}"
- **Goal**: "${demoType || "not specified"}"
- **Meeting**: ${eventName || '30 Minute Meeting'} on ${meetingTime} with Vinay (CEO)

## Your Immediate Instruction
You are already Path (defined in your system prompt).
1. Acknowledge the user's challenge ("${challenge}") immediately.
2. Do NOT welcome them generally; jump straight into helping them with this specific challenge to prepare for the meeting.
3. Keep it brief (1-2 sentences).

Start the conversation now.`
        }
      ]);
      
      setTimeout(() => {
        sendMessage({ text: 'Hi, I\'m ready to chat.' });
      }, 100);
    }
  }, [setMessages, sendMessage, messages, name, email, challenge, demoType, meetingTime, eventName]);

  // Filter out system and trigger messages
  const visibleMessages = (messages || [])
    .map((m: any) => {
      let content = m.content;
      
      // Extract text from parts if needed
      if (m.parts && !content) {
        content = m.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('');
      }
      
      // Remove [END_SESSION] marker from display (case-insensitive, flexible)
      if (content && typeof content === 'string') {
        content = content.replace(/\s*\[END_?SESSION\]\s*/gi, '').trim();
      }
      
      return { ...m, content };
    })
    .filter((m: any) => {
      // Filter out system messages
      if (m.role === 'system') return false;
      
      // Filter out trigger messages
      if (m.content === 'Hi, I\'m ready to chat.') return false;
      
      // Filter out empty messages (including those that only had [END_SESSION])
      if (!m.content || m.content.trim() === '') return false;
      
      return true;
    })
    .filter((m: any, index: number, arr: any[]) => {
      // Remove duplicate consecutive messages with same content
      if (index === 0) return true;
      const prev = arr[index - 1];
      if (prev.role === m.role && prev.content === m.content) {
        return false;
      }
      return true;
    });

  // Completion Screen
  if (conversationEnded) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-50 font-sans p-6">
        <div className="max-w-md w-full text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Success Icon */}
          <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: 'linear-gradient(to bottom right, #41E1C4, #2ec4ac)', boxShadow: '0 8px 32px rgba(65, 225, 196, 0.3)' }}>
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-zinc-50">All Set!</h1>
          
          {/* Description */}
          <p className="text-zinc-400 leading-relaxed">
            Thanks for sharing those details, <span className="text-zinc-200 font-semibold">{name}</span>. 
            Our CEO <span className="text-zinc-200 font-semibold">Vinay</span> will be fully briefed before your meeting.
          </p>

          {/* Meeting Info Card */}
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#41E1C4' }}></span>
              <span className="text-zinc-400">Your meeting is scheduled for</span>
            </div>
            <p className="text-lg font-semibold" style={{ color: '#41E1C4' }}>{meetingTime}</p>
            <p className="text-sm text-zinc-500">{eventName || '30 Minute Meeting'}</p>
          </div>

          {/* Additional Info */}
          <div className="text-sm text-zinc-500 space-y-2 pt-4">
            <p>You'll receive a calendar invite at <span className="text-zinc-400">{email}</span></p>
            <p>We're looking forward to helping you with your demo challenges!</p>
          </div>

          {/* Footer */}
          <div className="pt-6 border-t border-zinc-800">
            <p className="text-xs text-zinc-600">Powered by Layerpath AI</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-50 font-sans overflow-hidden">
      {/* Modern Header */}
      <header className="px-6 py-4 flex items-center justify-between bg-zinc-950/80 backdrop-blur-lg sticky top-0 z-20 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          {/* <div className="w-10 h-10 rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20 flex items-center justify-center text-white ring-2 ring-blue-100">
             <span className="font-bold">AI</span>
           </div> */}
            <div>
             <h1 className="font-bold text-lg leading-tight tracking-tight text-zinc-50">Path AI Pre-Meeting Warm-Up POC</h1>
             <p className="text-xs font-medium text-zinc-400">Layerpath</p>
           </div>
        </div>
        
        {/* Meeting Badge */}
          {eventStartTime && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border" style={{ backgroundColor: 'rgba(65, 225, 196, 0.1)', color: '#41E1C4', borderColor: 'rgba(65, 225, 196, 0.2)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#41E1C4' }}/>
              Meeting: {meetingTime}
            </div>
          )}
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 scroll-smooth overflow-x-hidden">
        <div className="max-w-3xl mx-auto space-y-6">
          
          {/* Welcome/Loading State */}
          {visibleMessages.length === 0 && isLoading && (
            <div className="flex flex-col items-center justify-center py-20 opacity-0 animate-in fade-in duration-700 slide-in-from-bottom-4 fill-mode-forwards">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 border border-zinc-700">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#41E1C4' }} />
              </div>
              <p className="text-zinc-400 text-sm font-medium">Preparing your session...</p>
            </div>
          )}

          {visibleMessages.map((m: any) => (
            <div
              key={m.id}
              className={cn(
                "flex gap-4 w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                m.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              {/* Bot Avatar */}
              {m.role !== 'user' && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-1" style={{ background: 'linear-gradient(to bottom right, #41E1C4, #2ec4ac)', boxShadow: '0 1px 3px rgba(65, 225, 196, 0.3)' }}>
                  {/* <span className="text-white text-xs font-bold tracking-tight">P</span> */}
                  <Brain size={18} className="text-white" />
                </div>
              )}

              {/* Message Bubble */}
              <div 
                className={cn(
                  "relative px-5 py-3.5 max-w-[85%] sm:max-w-[75%] shadow-sm rounded-3xl",
                  m.role === 'user'
                    ? "text-white rounded-tr-sm"
                    : "bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-tl-sm shadow-black/20"
                )}
                style={m.role === 'user' ? { backgroundColor: '#41E1C4', boxShadow: '0 1px 3px rgba(65, 225, 196, 0.3)' } : {}}
              >
                <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                  {m.content}
                </div>
              </div>

              {/* User Avatar (Optional, currently hidden for cleaner look or can be added) */}
              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 mt-1">
                  <User size={14} className="text-zinc-300" />
                </div>
              )}
            </div>
          ))}
          
          {/* Typing Indicator */}
          {isLoading && visibleMessages.length > 0 && visibleMessages[visibleMessages.length - 1].role === 'user' && (
            <div className="flex gap-4 justify-start animate-in fade-in">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-1" style={{ background: 'linear-gradient(to bottom right, #41E1C4, #2ec4ac)', boxShadow: '0 1px 3px rgba(65, 225, 196, 0.3)' }}>
                 <Loader2 size={14} className="text-white animate-spin" />
              </div>
              <div className="bg-zinc-800 border border-zinc-700 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex gap-1 items-center h-10">
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 sm:p-6 bg-zinc-950/80 backdrop-blur-lg border-t border-zinc-800 sticky bottom-0 z-20 pb-safe">
        <div className="max-w-3xl mx-auto relative">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (!inputValue.trim() || isLoading) return;
              const message = inputValue;
              setInputValue('');
              // Reset height
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
              }
              sendMessage({ text: message });
            }} 
            className="relative flex items-end gap-2"
          >
            <div 
              className="relative flex-1 bg-zinc-800/50 hover:bg-zinc-800 transition-colors rounded-3xl border border-zinc-700 focus-within:ring-2 focus-within:bg-zinc-800 overflow-hidden"
              style={{ '--tw-ring-color': 'rgba(65, 225, 196, 0.2)' } as any}
              onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(65, 225, 196, 0.5)'}
              onBlur={(e) => e.currentTarget.style.borderColor = ''}
            >
              <textarea
                ref={textareaRef}
                className="w-full px-4 py-[15px] bg-transparent border-none focus:outline-none text-[15px] text-zinc-100 placeholder:text-zinc-500 resize-none max-h-32 min-h-[52px] leading-normal scrollbar-hide block"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  // Auto-expand height
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!inputValue.trim() || isLoading) return;
                    const message = inputValue;
                    setInputValue('');
                    // Reset height
                    if (textareaRef.current) {
                      textareaRef.current.style.height = 'auto';
                    }
                    sendMessage({ text: message });
                  }
                }}
                placeholder="Type your message..."
                autoFocus
                disabled={isLoading}
                rows={1}
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="h-[52px] w-[52px] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-md hover:shadow-lg disabled:shadow-none shrink-0"
              style={{ 
                backgroundColor: '#41E1C4', 
                boxShadow: '0 4px 6px rgba(65, 225, 196, 0.3)',
              }}
              onMouseEnter={(e) => !isLoading && !inputValue.trim() ? null : e.currentTarget.style.backgroundColor = '#2ec4ac'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#41E1C4'}
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <ArrowUp size={22} strokeWidth={2.5} />
              )}
            </button>
          </form>
          <div className="text-center mt-2">
            <p className="text-[10px] text-zinc-500">Powered by Layerpath AI</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#41E1C4' }} />
      </div>
    }>
      <ChatInterface />
    </Suspense>
  );
}