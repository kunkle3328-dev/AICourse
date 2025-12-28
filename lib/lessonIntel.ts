import { SRSItem } from '../types';
import { dbOps } from './db';

// SuperMemo-2 Algorithm implementation
export function calculateSRS(item: SRSItem, quality: number) {
  // quality: 0-5 (0=blackout, 5=perfect)
  
  let { intervalDays, easeFactor } = item;
  let nextReviewAt = item.nextReviewAt;

  if (quality >= 3) {
    if (intervalDays === 0) {
      intervalDays = 1;
    } else if (intervalDays === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;
  } else {
    intervalDays = 1; // Reset if failed
  }

  // Calculate next date (Days * 24h * 60m * 60s * 1000ms)
  // Ensure we add to NOW, not old review date
  nextReviewAt = Date.now() + (intervalDays * 24 * 60 * 60 * 1000);

  return {
    ...item,
    intervalDays,
    easeFactor,
    nextReviewAt
  };
}

export const lessonIntel = {
  async addItem(workspaceId: string, concept: string) {
    const item: SRSItem = {
      id: crypto.randomUUID(),
      workspaceId,
      concept,
      nextReviewAt: Date.now(), // Due immediately
      intervalDays: 0,
      easeFactor: 2.5
    };
    await dbOps.saveSRSItem(item);
  },

  async recordReview(itemId: string, quality: number) {
    const db = await import('./db').then(m => m.getDB());
    const item = await db.get('srs_items', itemId);
    if (!item) return;

    const updated = calculateSRS(item, quality);
    await dbOps.saveSRSItem(updated);
  }
};