export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  // In a real app, verify user session/auth token here before returning key.
  // For this local-first app, we assume the environment is secure or user-owned.
  
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const key = process.env.GEMINI_API_KEY;
  
  if (!key) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500 });
  }

  return new Response(JSON.stringify({ key }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
