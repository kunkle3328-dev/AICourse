import { Source } from '../types';

export interface Chunk {
  sourceId: string;
  sourceTitle: string;
  text: string;
  score: number;
}

const CHUNK_SIZE = 1000;
const OVERLAP = 200;

function splitText(text: string): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
    i += CHUNK_SIZE - OVERLAP;
  }
  return chunks;
}

function calculateScore(query: string, text: string): number {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 3);
  const textLower = text.toLowerCase();
  let score = 0;
  
  queryTerms.forEach(term => {
    // Simple term frequency check
    const count = textLower.split(term).length - 1;
    score += count;
  });

  return score;
}

export function retrieveRelevantChunks(query: string, sources: Source[], topK = 5): Chunk[] {
  let allChunks: Chunk[] = [];

  sources.forEach(source => {
    if (source.status !== 'ready') return;
    const textChunks = splitText(source.contentText);
    textChunks.forEach(text => {
      allChunks.push({
        sourceId: source.id,
        sourceTitle: source.title,
        text,
        score: calculateScore(query, text)
      });
    });
  });

  // Sort by score descending
  allChunks.sort((a, b) => b.score - a.score);

  return allChunks.slice(0, topK);
}
