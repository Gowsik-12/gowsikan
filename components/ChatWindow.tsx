import React, { useState, useRef, useEffect } from 'react';
import { Message, CompanyConfig } from '../types';
import { getChatResponse, getSpeechResponse, connectLiveSession } from '../services/geminiService';
import { Button } from './Button';

// Manual PCM Decoding Logic as per guidelines
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const SUGGESTIONS = [
  "How many leave days do I get?",
  "What's the Friday dress code?",
  "Upcoming office holidays",
  "How do I contact IT helpdesk?"
];

interface ChatWindowProps {
  company: CompanyConfig;
  triggerMessage: string | null;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ company, triggerMessage }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `👋 Welcome to ${company.name}! I'm your smart onboarding assistant. I've been configured with your company's latest knowledge base. How can I help you settle in?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isPlayingAudioId, setIsPlayingAudioId] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const liveSessionRef = useRef<any>(null);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Listen for triggers from Quick Actions
  useEffect(() => {
    if (triggerMessage) {
      handleSend(triggerMessage);
    }
  }, [triggerMessage]);

  // Initial greeting when company changes
  useEffect(() => {
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      content: `I am now updated with the knowledge base for **${company.name}**. You can ask me about policies, holidays, or use the quick action buttons.`,
      timestamp: new Date()
    }]);
  }, [company.name]);

  const getAudioContext = (rate: number) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: rate });
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const toggleLiveMode = async () => {
    if (isLive) {
      setIsLive(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.then((s: any) => s.close());
      }
      return;
    }

    const outputAudioContext = getAudioContext(24000);
    const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    setIsLive(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const sessionPromise = connectLiveSession(company, {
        onopen: () => {
          const source = inputAudioContext.createMediaStreamSource(stream);
          const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const l = inputData.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
            const pcmBlob = {
              data: encode(new Uint8Array(int16.buffer)),
              mimeType: 'audio/pcm;rate=16000',
            };
            sessionPromise.then((session: any) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContext.destination);
        },
        onmessage: async (message) => {
          const base64 = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64) {
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
            const buffer = await decodeAudioData(decode(base64), outputAudioContext, 24000, 1);
            const source = outputAudioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(outputAudioContext.destination);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            audioSourcesRef.current.add(source);
            source.onended = () => audioSourcesRef.current.delete(source);
          }
          if (message.serverContent?.interrupted) {
            audioSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
            audioSourcesRef.current.clear();
            nextStartTimeRef.current = 0;
          }
        },
        onerror: (e) => {
          console.error("Live Error:", e);
          setIsLive(false);
        },
        onclose: () => setIsLive(false)
      });
      liveSessionRef.current = sessionPromise;
    } catch (err) {
      console.error("Failed to start live session:", err);
      setIsLive(false);
    }
  };

  const playAudio = async (text: string, messageId: string) => {
    if (isPlayingAudioId) return;
    const ctx = getAudioContext(24000);
    setIsPlayingAudioId(messageId);
    
    try {
      const base64 = await getSpeechResponse(text.substring(0, 500));
      if (base64) {
        const audioBuffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsPlayingAudioId(null);
        source.start();
      } else {
        setIsPlayingAudioId(null);
      }
    } catch (e) {
      setIsPlayingAudioId(null);
    }
  };

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || isTyping) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: textToSend, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    const { text, groundingLinks } = await getChatResponse(textToSend, company);
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: text,
      timestamp: new Date(),
      groundingLinks: groundingLinks.length > 0 ? groundingLinks : undefined
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsTyping(false);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden relative">
      {/* Live Voice Overlay */}
      {isLive && (
        <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-md z-40 flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-blue-100 flex flex-col items-center gap-6 max-w-sm text-center">
            <div className="relative flex items-center justify-center w-20 h-20">
               <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
               <div className="relative w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-200">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white">
                    <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                    <path d="M6 10.5a.75.75 0 01.75.75 5.25 5.25 0 1010.5 0 .75.75 0 011.5 0 6.75 6.75 0 11-13.5 0 .75.75 0 01.75-.75z" />
                  </svg>
               </div>
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 mb-1">Live Mode Active</h3>
              <p className="text-sm text-gray-500 font-medium px-4">Speak clearly. I'm listening to your questions about {company.name}.</p>
            </div>
            <Button variant="outline" size="lg" onClick={toggleLiveMode} className="rounded-2xl w-full text-red-500 border-red-100 hover:bg-red-50 font-bold uppercase tracking-widest text-xs">
              End Session
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-8 py-5 bg-white border-b border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900 leading-tight">{company.name} AI Assistant</h2>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Active RAG Engine</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={toggleLiveMode} className={`rounded-lg px-3 transition-all ${isLive ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-blue-50 hover:text-blue-600'}`}>
           <span className="text-[10px] font-black uppercase tracking-wider">{isLive ? 'Voice Active' : 'Enable Voice'}</span>
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/10 custom-scrollbar">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex flex-col gap-2 max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`p-5 rounded-2xl shadow-sm ${
                m.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
              }`}>
                <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium prose prose-slate">
                  {m.content}
                </div>
                {m.role === 'assistant' && (
                  <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                    <button 
                      disabled={!!isPlayingAudioId}
                      onClick={() => playAudio(m.content, m.id)}
                      className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${isPlayingAudioId === m.id ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M10 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zM15 8a1 1 0 10-2 0v4a1 1 0 102 0V8zM5 8a1 1 0 10-2 0v4a1 1 0 102 0V8z" /></svg>
                      {isPlayingAudioId === m.id ? 'Speaking...' : 'Play Audio'}
                    </button>
                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">
                      {company.name.toUpperCase()} DATA SOURCE
                    </span>
                  </div>
                )}
              </div>
              {m.groundingLinks && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {m.groundingLinks.map((link, i) => (
                    <a key={i} href={link.uri} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-white border border-gray-100 rounded-full text-[9px] text-blue-500 font-bold hover:bg-blue-50 transition-colors shadow-sm">
                      {link.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3">
             <div className="bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.1s]"></span>
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
             </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 bg-white border-t border-gray-100 shrink-0">
        <div className="flex flex-wrap gap-1.5 mb-4">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => handleSend(s)} className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 text-[10px] font-bold uppercase tracking-tight rounded-lg border border-gray-100 transition-all">
              {s}
            </button>
          ))}
        </div>
        <div className="relative flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-gray-100 focus-within:border-blue-300 focus-within:bg-white transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder={`Ask ${company.name} AI about your first week...`}
            className="flex-1 bg-transparent border-none focus:ring-0 px-3 py-2 text-sm max-h-32 min-h-[44px] resize-none font-medium text-gray-700 placeholder:text-gray-400"
            rows={1}
          />
          <Button onClick={() => handleSend()} size="sm" isLoading={isTyping} className="w-11 h-11 shrink-0 rounded-xl shadow-lg shadow-blue-100 p-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
          </Button>
        </div>
      </div>
    </div>
  );
};