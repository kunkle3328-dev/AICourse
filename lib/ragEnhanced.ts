import { Source, VectorChunk } from '../types';
import { dbOps } from './db';

const CHUNK_SIZE = 1000;
const OVERLAP = 200;

function splitTextEnhanced(text: string, sourceId: string, workspaceId: string): VectorChunk[] {
  const chunks: VectorChunk[] = [];
  let i = 0;
  while (i < text.length) {
    const slice = text.slice(i, i + CHUNK_SIZE);
    chunks.push({
      chunkId: `${sourceId}-${i}`,
      sourceId,
      workspaceId,
      text: slice,
      startChar: i,
      endChar: i + slice.length,
      vector: [] // To be filled by embedding step
    });
    i += CHUNK_SIZE - OVERLAP;
  }
  return chunks;
}

// Basic cosine similarity
function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

// Hybrid retrieval
export const ragV2 = {
  async indexSource(source: Source) {
    // 1. Chunk
    const chunks = splitTextEnhanced(source.contentText, source.id, source.workspaceId);
    
    // 2. Embed (Batch API call)
    // We only embed the first 10 chunks for this demo to save quota/time if many sources
    const batchTexts = chunks.slice(0, 10).map(c => c.text);
    
    try {
      const res = await fetch('/api/rag/embed', {
        method: 'POST',
        body: JSON.stringify({ texts: batchTexts })
      });
      const data = await res.json();
      if (data.embeddings) {
        data.embeddings.forEach((emb: number[], idx: number) => {
          chunks[idx].vector = emb;
        });
      }
    } catch (e) {
      console.error("Embedding failed", e);
    }

    // 3. Save
    await dbOps.saveVectors(chunks);
    return chunks.length;
  },

  async retrieve(workspaceId: string, query: string, topK = 5) {
    // 1. Get query embedding
    let queryVector: number[] = [];
    try {
      const res = await fetch('/api/rag/embed', {
        method: 'POST',
        body: JSON.stringify({ texts: [query] })
      });
      const data = await res.json();
      if (data.embeddings) queryVector = data.embeddings[0];
    } catch (e) {
      console.error("Query embed failed", e);
    }

    // 2. Get all vectors for workspace (Naive scan for IDB)
    const allVectors = await dbOps.getVectors(workspaceId);
    
    // 3. Score (Hybrid: Keyword + Vector)
    const scored = allVectors.map(v => {
      let score = 0;
      
      // Vector score
      if (v.vector.length > 0 && queryVector.length > 0) {
        score += cosineSimilarity(v.vector, queryVector) * 0.7;
      }
      
      // Lexical bonus
      const qTerms = query.toLowerCase().split(' ');
      const matches = qTerms.filter(t => v.text.toLowerCase().includes(t)).length;
      score += matches * 0.1;

      return { ...v, score };
    });

    // 4. Sort and return
    scored.sort((a, b) => b.score - a.score);
    const candidates = scored.slice(0, topK * 2); // Get more for reranking

    // 5. Rerank (Optional step)
    try {
        const rerankRes = await fetch('/api/rag/rerank', {
            method: 'POST',
            body: JSON.stringify({ query, candidates: candidates.map(c => ({ id: c.chunkId, text: c.text })) })
        });
        const rerankData = await rerankRes.json();
        if (rerankData.rankedIds) {
            // Sort candidates based on returned IDs
            const rankMap = new Map<string, number>(rerankData.rankedIds.map((id: string, i: number) => [id, i]));
            candidates.sort((a, b) => (rankMap.get(a.chunkId) ?? 999) - (rankMap.get(b.chunkId) ?? 999));
        }
    } catch (e) {
        console.warn("Rerank failed, using raw scores");
    }

    return candidates.slice(0, topK);
  }
};