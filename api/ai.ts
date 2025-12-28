import { GoogleGenAI, Type } from "@google/genai";
import { Citation, TeachingState } from "../types";

// Helper to sanitize text
function cleanText(text: string) {
  return text.replace(/<[^>]*>/g, '');
}

export const config = {
  runtime: 'edge',
};

// Response schema for structured output
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    assistantResponseText: { type: Type.STRING, description: "Text to be spoken by TTS. Keep it conversational and concise." },
    displayResponseMarkdown: { type: Type.STRING, description: "Markdown text to display in the UI. Can include tables, lists, bolding." },
    citations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sourceId: { type: Type.STRING },
          title: { type: Type.STRING },
          snippet: { type: Type.STRING }
        }
      }
    },
    suggestedNextActions: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    nextState: { type: Type.STRING, description: "The next state of the teaching machine, e.g., 'TEACHING', 'QUIZZING', 'IDLE'" }
  },
  required: ["assistantResponseText", "displayResponseMarkdown"]
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const body = await req.json();
    const { 
      workspaceSettings, 
      lessonContext, 
      recentTranscript, 
      retrievedChunks,
      currentState 
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing API Key' }), { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Construct System Instruction
    const systemInstruction = `
You are an expert AI Tutor in the "Live Course Companion" app.
Your Goal: Teach the user based on the provided source material (RAG context).

**Teaching Contract:**
1. **Brevity**: Speak in short chunks (max 3 sentences for TTS). The 'assistantResponseText' must be short.
2. **Check-ins**: Frequently check for understanding (e.g., "Does that make sense?").
3. **Grounding**: 
   - If Grounding is ON (${workspaceSettings.grounding}): You MUST cite sources. If sources don't support the answer, say so.
   - If Grounding is OFF: You can generalize but mention it's general knowledge.
4. **State Machine**:
   - Current State: ${currentState}
   - Mode: ${workspaceSettings.mode} (Explain, Simplify, Example, Quiz, Review)
   - Difficulty: ${workspaceSettings.difficulty}/5
   - Pace: ${workspaceSettings.pace}/5

**Specific Behaviors**:
- If user says "stop" or "pause", set nextState to 'IDLE'.
- If user says "quiz me", set nextState to 'QUIZZING' and generate a question.
- If in 'QUIZZING' state, evaluate the user's last answer, provide feedback, and ask the next question or return to 'TEACHING'.
- Always return 'displayResponseMarkdown' formatted nicely (bullets, bold).
- 'citations' array should be populated if you used the retrieved chunks.

**Source Context**:
${JSON.stringify(retrievedChunks.map((c: any) => ({ title: c.sourceTitle, text: c.text })))}

**Lesson Context**:
${JSON.stringify(lessonContext)}
    `;

    // Construct Chat History for the model
    // Last 10 messages max
    const contents = recentTranscript.slice(-10).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    // Add a dummy user prompt if history is empty to start conversation or if state change is needed
    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: "Start the lesson based on the outline." }] });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash', 
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    return new Response(response.text, {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
