import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { texts } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing API Key");

    const ai = new GoogleGenAI({ apiKey });
    
    // Embed content
    // Note: models.embedContent supports batching in some versions, or we loop.
    // For V2 SDK check:
    const embeddings = [];
    for (const text of texts) {
        const result = await ai.models.embedContent({
            model: "text-embedding-004",
            content: { parts: [{ text }] }
        });
        embeddings.push(result.embedding.values);
    }

    return new Response(JSON.stringify({ embeddings }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
