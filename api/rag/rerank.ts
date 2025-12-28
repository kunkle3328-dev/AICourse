import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { query, candidates } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing API Key");

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
    Query: "${query}"
    
    Candidates:
    ${candidates.map((c: any, i: number) => `[${i}] ID: ${c.id} Text: ${c.text.substring(0, 150)}...`).join('\n')}
    
    Task: Rank the candidates by relevance to the query. Return a JSON array of IDs in order of relevance.
    Example: ["id-1", "id-5"]
    `;

    const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: { parts: [{ text: prompt }] },
        config: {
            responseMimeType: "application/json"
        }
    });

    const rankedIds = JSON.parse(result.text || "[]");

    return new Response(JSON.stringify({ rankedIds }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
