
import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Mic, MicOff, Loader2, MessageSquare, Zap, Play, StopCircle, RefreshCw } from 'lucide-react';
import { createChatSession, getLiveClient } from '../services/geminiService';
import { GenerateContentResponse, LiveServerMessage, Modality } from '@google/genai';

// --- SIMPLE MARKDOWN RENDERER ---
const FormattedMessage: React.FC<{ content: string; isUser: boolean }> = ({ content, isUser }) => {
  // Split by newlines to handle paragraphs and lists
  const lines = content.split('\n');

  return (
    <div className={`space-y-1 ${isUser ? 'text-white' : 'text-gray-800'}`}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />; // Spacer for double newlines

        // Handle Bullet Points
        const isList = trimmed.startsWith('* ') || trimmed.startsWith('- ');
        const cleanLine = isList ? trimmed.substring(2) : line;

        // Parse Bold Text: **text**
        const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
        const renderedParts = parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className={isUser ? 'font-extrabold text-white' : 'font-bold text-gray-900'}>{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        if (isList) {
          return (
            <div key={i} className="flex gap-2 ml-1">
              <span className={isUser ? 'text-white/70' : 'text-rose-600'}>•</span>
              <span className="flex-1">{renderedParts}</span>
            </div>
          );
        }

        return <div key={i}>{renderedParts}</div>;
      })}
    </div>
  );
};

// --- AI CHATBOT COMPONENT ---
export const AiChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatSessionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const initChat = () => {
    try {
      chatSessionRef.current = createChatSession();
      setMessages([{ 
        role: 'model', 
        text: "Hi! I'm **ScholarBot**.\n\nI'm here to support your **mental well-being** and help you navigate the **ScholarSync** system.\n\nHow are you feeling today, or do you need help with an assignment?" 
      }]);
    } catch (e: any) {
      console.error(e);
      setMessages([{ role: 'model', text: `Error: ${e.message || "API Key missing."}` }]);
    }
  };

  useEffect(() => {
    if (isOpen && !chatSessionRef.current) {
      initChat();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !chatSessionRef.current) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const result: GenerateContentResponse = await chatSessionRef.current.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, { role: 'model', text: result.text || "I'm having trouble thinking right now." }]);
    } catch (e: any) {
      console.error("Chat Error:", e);
      let errorMsg = e.message || "Lost connection.";
      
      // Handle Rate Limits specific to Free Tier
      if (errorMsg.includes('429')) {
        errorMsg = "I'm receiving too many messages right now (Rate Limit Exceeded). Please wait a moment and try again.";
      }

      setMessages(prev => [...prev, { role: 'model', text: `⚠️ ${errorMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    chatSessionRef.current = null;
    initChat();
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 md:right-8 z-40 p-4 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-full shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
        <span className="hidden md:inline font-bold">ScholarBot</span>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 md:right-8 z-40 w-[90vw] md:w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          <div className="bg-rose-900 p-4 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <h3 className="font-bold">ScholarBot</h3>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={handleReset} className="p-1 hover:bg-white/20 rounded-full" title="Reset Chat">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-rose-600 text-white rounded-br-none' 
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                }`}>
                  <FormattedMessage content={m.text} isUser={m.role === 'user'} />
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-none shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
            />
            <button 
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="p-2 bg-rose-600 text-white rounded-full hover:bg-rose-700 disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// --- LIVE INTERVIEW COACH COMPONENT ---
export const LiveInterviewCoach: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState("Ready to start");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Connect to Live API
  const connect = async () => {
    setStatus("Connecting...");
    try {
        const liveClient = getLiveClient();
        
        // 1. Audio Contexts
        const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = outputAudioContext;

        const outputNode = outputAudioContext.createGain();
        outputNode.connect(outputAudioContext.destination);

        // 2. Get Mic Stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // 3. Connect to Gemini Live
        let nextStartTime = 0;
        const sessionPromise = liveClient.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => {
                    setStatus("Connected! Speak now.");
                    setIsActive(true);

                    // Setup Input Stream
                    const source = inputAudioContext.createMediaStreamSource(stream);
                    const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessor.onaudioprocess = (e) => {
                        const inputData = e.inputBuffer.getChannelData(0);
                        const pcmBlob = createPcmBlob(inputData);
                        sessionPromise.then(session => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                },
                onmessage: async (msg: LiveServerMessage) => {
                    // Handle Audio Output
                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData) {
                        nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                        const audioBuffer = await decodeAudioData(audioData, outputAudioContext);
                        
                        const source = outputAudioContext.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputNode);
                        source.start(nextStartTime);
                        nextStartTime += audioBuffer.duration;
                    }
                    
                    if (msg.serverContent?.interrupted) {
                        nextStartTime = 0;
                    }
                },
                onclose: () => {
                    setStatus("Session ended.");
                    setIsActive(false);
                },
                onerror: (e) => {
                    console.error(e);
                    setStatus("Connection error.");
                    setIsActive(false);
                }
            },
            config: {
                responseModalities: [Modality.AUDIO],
                systemInstruction: "You are an expert scholarship interview coach. Conduct a mock interview with the user. Ask them about their academic goals, leadership experience, and why they deserve the scholarship. Give brief feedback after their answers.",
            }
        });

    } catch (e) {
        console.error(e);
        setStatus("Failed to access microphone or API.");
    }
  };

  const disconnect = () => {
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
    setIsActive(false);
    setStatus("Ready to start");
    // Ideally close session via client if method available, or just cut stream
  };

  // Helper: Create PCM Blob
  function createPcmBlob(data: Float32Array): { data: string, mimeType: string } {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return {
        data: btoa(binary),
        mimeType: 'audio/pcm;rate=16000'
    };
  }

  // Helper: Decode Audio
  async function decodeAudioData(base64: string, ctx: AudioContext): Promise<AudioBuffer> {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Manual decoding for raw PCM if needed, but the example suggests using helper or raw
    // The Gemini API returns raw PCM 24kHz. Browser decodeAudioData needs headers or manual buffer filling.
    // Implementing manual float conversion as per prompt example:
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full bg-white border border-rose-100 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-rose-300 transition-all text-left flex items-center gap-4 group"
      >
        <div className="p-3 bg-rose-100 text-rose-700 rounded-full group-hover:scale-110 transition-transform">
          <Mic className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">Interview Coach</h3>
          <p className="text-sm text-gray-500">Practice with Gemini Live</p>
        </div>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-center relative">
            <button onClick={() => { disconnect(); setIsOpen(false); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
            </button>
            
            <div className="p-8">
               <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-6 transition-colors ${
                 isActive ? 'bg-rose-100 animate-pulse' : 'bg-gray-100'
               }`}>
                 <Mic className={`w-16 h-16 ${isActive ? 'text-rose-600' : 'text-gray-400'}`} />
               </div>
               
               <h2 className="text-2xl font-bold text-gray-900 mb-2">Live Interview Practice</h2>
               <p className="text-gray-500 mb-8 min-h-[20px]">{status}</p>
               
               {!isActive ? (
                 <button 
                   onClick={connect}
                   className="w-full py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 flex items-center justify-center gap-2"
                 >
                   <Zap className="w-5 h-5" /> Start Session
                 </button>
               ) : (
                 <button 
                   onClick={disconnect}
                   className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-900 flex items-center justify-center gap-2"
                 >
                   <StopCircle className="w-5 h-5" /> End Session
                 </button>
               )}
            </div>
            <div className="bg-gray-50 p-4 text-xs text-gray-500 border-t border-gray-100">
                Powered by Gemini 2.5 Flash Native Audio
            </div>
          </div>
        </div>
      )}
    </>
  );
}
