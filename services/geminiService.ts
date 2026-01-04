import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { CompanyConfig } from "../types";

function buildSystemInstruction(config: CompanyConfig) {
  return `
You are HireHelp AI, a premium, professional smart onboarding assistant for employees at ${config.name}.
Your objective is to provide immediate, accurate answers based EXCLUSIVELY on the provided internal knowledge base for ${config.name}.

INTERNAL DATA SOURCES:
1. HANDBOOK SECTIONS:
---
${config.handbookSections.map(s => `SECTION: ${s.title}\nCONTENT: ${s.content}`).join('\n\n')}
---

2. OFFICE HOLIDAYS:
---
${config.holidays.map(h => `- ${h.date}: ${h.name}`).join('\n')}
---

BEHAVIORAL RULES:
- Identify yourself as the assistant for ${config.name}.
- If information is in the handbook, start with "According to our company handbook...".
- If information is in the holiday schedule, start with "Based on our office calendar...".
- Use professional, warm, and encouraging language.
- Format responses with Markdown for clarity.
- If information is NOT available in the sources above, use the 'googleSearch' tool to find external help but prioritize internal data.
- Keep responses concise yet comprehensive.
`;
}

export async function getChatResponse(userMessage: string, config: CompanyConfig) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userMessage,
      config: {
        systemInstruction: buildSystemInstruction(config),
        tools: [{ googleSearch: {} }],
        temperature: 0.3,
      }
    });

    const text = response.text || "I'm sorry, I couldn't find that information in our records. Let me know if there's anything else I can help with.";
    const groundingLinks = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null)
      .filter(Boolean) || [];

    return { text, groundingLinks };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { 
      text: "I encountered a technical issue reaching the knowledge base. Please try asking again.", 
      groundingLinks: [] 
    };
  }
}

export async function getSpeechResponse(text: string) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}

export function connectLiveSession(config: CompanyConfig, callbacks: {
  onopen: () => void;
  onmessage: (message: LiveServerMessage) => void;
  onerror: (e: any) => void;
  onclose: (e: any) => void;
}) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
      },
      systemInstruction: buildSystemInstruction(config) + "\nYou are now in a real-time voice conversation. Keep answers extremely short.",
    },
  });
}