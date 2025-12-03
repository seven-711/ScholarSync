
import { GoogleGenAI, Modality } from "@google/genai";

// Safe access for API Key
const getApiKey = () => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      return process.env.API_KEY;
    }
  } catch (e) {}
  
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env.API_KEY || import.meta.env.VITE_API_KEY;
    }
  } catch (e) {}
  
  return '';
};

const apiKey = getApiKey();
const ai = new GoogleGenAI({ apiKey });

export const generateAnnouncementDraft = async (topic: string): Promise<string> => {
  if (!apiKey) return "Gemini API Key is missing.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Write a professional, encouraging announcement for a scholarship program about: ${topic}. Keep it under 100 words.`,
    });
    return response.text || "Could not generate content.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating content.";
  }
};

// 1. FAST AI RESPONSES (gemini-2.0-flash-lite)
export const generateFastReply = async (inquiryMessage: string, context: string): Promise<string> => {
  if (!apiKey) return "API Key missing.";
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-lite-preview-02-05', 
      contents: `You are a helpful scholarship administrator. 
      Context about the student: ${context}
      Student Inquiry: "${inquiryMessage}"
      
      Draft a polite, concise, and helpful reply (under 50 words).`,
    });
    return response.text || "";
  } catch (error) {
    console.error("Fast Reply Error:", error);
    return "Error generating reply.";
  }
};

// 2. IMAGE GENERATION (Hybrid: Gemini -> Fallback to Pollinations.ai)
export const generateImage = async (prompt: string, aspectRatio: string = "16:9"): Promise<string | null> => {
  
  // Helper to get dimensions based on aspect ratio
  const getDimensions = (ar: string) => {
    switch (ar) {
      case "16:9": return { w: 1280, h: 720 };
      case "9:16": return { w: 720, h: 1280 };
      case "3:4": return { w: 768, h: 1024 };
      case "4:3": return { w: 1024, h: 768 };
      default: return { w: 1024, h: 1024 }; // 1:1
    }
  };

  // --- STRATEGY A: Try Gemini (High Quality) ---
  if (apiKey) {
    try {
      console.log("Attempting Gemini Image Gen...");
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any, 
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    } catch (error: any) {
      console.warn("Gemini Image Gen failed (likely quota). Switching to fallback.", error.message);
      // Fall through to Strategy B
    }
  }

  // --- STRATEGY B: Pollinations.ai (Free, Unlimited Fallback) ---
  try {
    console.log("Using Pollinations.ai Fallback...");
    const { w, h } = getDimensions(aspectRatio);
    // Encode prompt and ensure it's not too long for a URL
    const safePrompt = encodeURIComponent(prompt.substring(0, 150));
    // Add seed to make it deterministic if needed, or random (default)
    const randomSeed = Math.floor(Math.random() * 10000);
    
    // Construct URL
    const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=${w}&height=${h}&seed=${randomSeed}&nologo=true&model=flux`;
    
    return imageUrl; 
  } catch (e) {
    console.error("All image generation strategies failed.", e);
    return null;
  }
};

// 3. GENERATE SPEECH (gemini-2.5-flash-preview-tts)
export const generateSpeech = async (text: string): Promise<string | null> => {
  if (!apiKey) return null;
  try {
    // Add timeout to prevent hanging
    const fetchPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Request timed out")), 15000)
    );

    const response: any = await Promise.race([fetchPromise, timeoutPromise]);
    
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
};

// 4. CHATBOT (gemini-2.5-flash)
export const createChatSession = () => {
  if (!apiKey) throw new Error("API Key missing");
  // Use gemini-2.5-flash for stability instead of gemini-3-pro-preview
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `You are ScholarBot, a specialized AI assistant for the ScholarSync platform.

      YOUR CORE PURPOSE:
      1. **Mental Well-being Support:** Prioritize the student's mental health. If they sound stressed, anxious, or overwhelmed, offer empathy, stress management tips (breathing, breaks), and encouragement. Be a supportive listener.
      2. **System Navigation (ScholarSync):** Assist with platform-specific tasks: viewing **Assignments**, checking **Announcements**, or sending **Inquiries** to the admin.
      
      BOUNDARIES (STRICT):
      - **DO NOT** answer general trivia, history questions, or solve math problems.
      - **DO NOT** write essays or do homework for the student.
      - If a user asks off-topic questions (e.g., "Who is the president?"), politely redirect them to their well-being or the platform (e.g., "I can't help with that, but I can help you organize your study schedule or relax!").
      
      TONE:
      - Warm, empathetic, calm, and encouraging.
      - If the user indicates a severe crisis (self-harm), strictly suggest seeking professional help immediately.

      FORMATTING RULES:
      - Use **bold** for important terms (e.g., **Assignments**, **Admin**).
      - Use bullet points for steps or tips.
      - Keep paragraphs short and easy to read.`,
    },
  });
};

export const getLiveClient = () => {
    return ai.live;
};
