
import { 
  GoogleGenAI, 
  Modality, 
  LiveServerMessage, 
  Type,
  FunctionDeclaration,
  ThinkingLevel
} from "@google/genai";

// --- Configuration Constants ---
const MODEL_CHAT_PRO = 'gemini-2.5-flash';
const MODEL_FAST_LITE = 'gemini-2.5-flash';
const MODEL_SEARCH = 'gemini-2.5-flash';
const MODEL_MAPS = 'gemini-2.5-flash';
const MODEL_VISION = 'gemini-2.5-flash';
const MODEL_LIVE = 'gemini-2.5-flash';
const MODEL_TTS = 'gemini-2.5-flash-preview-tts';
const MODEL_IMAGE = 'gemini-2.5-flash-image';

// --- Instance Helper ---
const getAI = () => {
  // Try Vite-style meta.env first (for local/Android builds), then platform-injected process.env
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("Gemini API Key is missing. Neither VITE_GEMINI_API_KEY nor process.env.GEMINI_API_KEY is defined.");
    throw new Error("Neural Link Offline: API Key not detected. Please check your system configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- Tool Declarations ---
const captureSnapshotTool: FunctionDeclaration = {
  name: 'captureSnapshot',
  description: 'Capture a photo or snapshot of the current plant/environment immediately when the user asks to take a picture, scan, or capture.',
};

// --- API Functions ---

export const sendMessage = async (
  history: { role: string; text: string }[], 
  newMessage: string,
  options: {
    useThinking?: boolean;
    useSearch?: boolean;
    useMaps?: boolean;
    location?: { lat: number; lng: number };
  } = {}
): Promise<{ text: string; candidates: any[] }> => {
  const ai = getAI();
  
  let modelName = MODEL_CHAT_PRO;
  let config: any = {};

  if (options.useThinking) {
    modelName = MODEL_CHAT_PRO;
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
  } else if (options.useSearch) {
    modelName = MODEL_SEARCH;
    config.tools = [{ googleSearch: {} }];
  } else if (options.useMaps) {
    modelName = MODEL_MAPS;
    config.tools = [{ googleMaps: {} }];
    if (options.location) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: options.location.lat,
            longitude: options.location.lng
          }
        }
      };
    }
  }

  const chat = ai.chats.create({
    model: modelName,
    config: {
      ...config,
      systemInstruction: "You are Gemma, an expert AI botanist. You monitor plant growth, diagnose health issues, and offer gardening advice. Be precise and helpful.",
    },
    history: history.map(h => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.text }]
    }))
  });

  try {
    const response = await chat.sendMessage({ message: newMessage });
    
    return {
      text: response.text,
      candidates: response.candidates
    };
  } catch (error: any) {
    console.error("Chat Error:", error);
    if (error.message?.includes('API_KEY_INVALID')) throw new Error("Invalid API Key. Please check your configuration.");
    if (error.message?.includes('quota')) throw new Error("API Quota Exceeded. Please try again later.");
    throw new Error("Neural Link Failed. Check your network connection.");
  }
};

export const generateImage = async (prompt: string, aspectRatio: string = "1:1"): Promise<{ imageUrl: string }> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: MODEL_IMAGE,
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
          imageSize: "1K"
        }
      }
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return { imageUrl: `data:image/png;base64,${part.inlineData.data}` };
      }
    }
    throw new Error("No image generated.");
  } catch (error: any) {
    console.error("Image Generation Error:", error);
    throw new Error("Visual synthesis failed. Check your API key or quota.");
  }
};

export const analyzeImage = async (base64Data: string, prompt: string, plantType?: string) => {
  const ai = getAI();
  try {
    const cleanBase64 = base64Data.split(',')[1];
    const finalPrompt = plantType ? `[PLANT SPECIES: ${plantType}] ${prompt}` : prompt;
    const response = await ai.models.generateContent({
      model: MODEL_VISION,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: finalPrompt }
        ]
      }
    });
    return response.text;
  } catch (error: any) {
    console.error("Analysis Error:", error);
    if (error.message?.includes('API_KEY_INVALID')) throw new Error("Invalid API Key. Please check your configuration.");
    if (error.message?.includes('quota')) throw new Error("API Quota Exceeded. Please try again later.");
    throw new Error("Optical Analysis Failed. Check your network connection.");
  }
};

export const generateGrowthReport = async (logs: string[]) => {
  const ai = getAI();
  const prompt = `
  SYSTEM: You are Gemma, an expert AI Botanist.
  TASK: Analyze the following plant observation logs and generate a concise growth progress report. Highlight health status, growth rate, and any care recommendations.
  TONE: Scientific, encouraging, precise.
  FORMAT: Plain text, no markdown symbols like ** or #.
  LOGS:
  ${logs.join('\n')}
  `;

  const response = await ai.models.generateContent({
    model: MODEL_CHAT_PRO,
    contents: prompt
  });

  return response.text;
};

export const getFastResponse = async (text: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: MODEL_FAST_LITE,
    contents: text
  });
  return response.text;
};

export const generateSpeech = async (text: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: MODEL_TTS,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Fenrir' }, // Fenrir has a deep, calm voice suitable for nature
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio;
};

// --- Live API Helpers ---

export function decodeAudio(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
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

export function encodeAudio(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function createPcmBlob(data: Float32Array): any {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encodeAudio(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// Convert blob to base64
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data url prefix
      resolve(result.split(',')[1]);
    };
    reader.readAsDataURL(blob);
  });
}

export const connectToLiveAPI = async (
  onAudioData: (base64: string) => void,
  onClose: () => void,
  onError: (err: any) => void,
  onTranscript: (text: string, isUser: boolean) => void,
  onCaptureTrigger?: () => void
) => {
  const ai = getAI();
  
  const sessionPromise = ai.live.connect({
    model: MODEL_LIVE,
    callbacks: {
      onopen: () => console.log('Live Session Opened'),
      onmessage: async (message: LiveServerMessage) => {
        // Handle Audio
        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          onAudioData(base64Audio);
        }

        // Handle Transcriptions
        if (message.serverContent?.outputTranscription?.text) {
           onTranscript(message.serverContent.outputTranscription.text, false);
        }
        if (message.serverContent?.inputTranscription?.text) {
           onTranscript(message.serverContent.inputTranscription.text, true);
        }

        // Handle Tool Calls
        if (message.toolCall) {
          for (const fc of message.toolCall.functionCalls) {
            if (fc.name === 'captureSnapshot') {
              console.log('Voice Command: Capture Snapshot Triggered');
              if (onCaptureTrigger) onCaptureTrigger();
              
              const session = await sessionPromise;
              session.sendToolResponse({
                functionResponses: [{
                  id: fc.id,
                  name: fc.name,
                  response: { result: "Snapshot captured successfully." }
                }]
              });
            }
          }
        }
      },
      onclose: () => onClose(),
      onerror: (e) => onError(e),
    },
    config: {
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } // Kore has a gentle voice
      },
      systemInstruction: "You are Gemma, an expert botanist AI assistant connected to a live video feed. Your job is to ANALYZE the plant life in the video in REAL-TIME. 1. Identify the plant and its current growth stage (germination, vegetative, flowering, etc.). 2. Detect any health issues like wilting, pests, or discoloration. 3. Provide immediate botanical advice to the user. Speak naturally and concisely. TRANSLATION: If the user speaks in a language other than English, translate your response to that language and provide a concise English summary in the transcription.",
      tools: [{ functionDeclarations: [captureSnapshotTool] }]
    }
  });

  return sessionPromise;
};
