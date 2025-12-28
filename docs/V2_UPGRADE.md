# LCC V2 Upgrade: Gemini Live & RAG

## Overview
This upgrade introduces real-time duplex voice streaming using the Gemini Live API, vector-based RAG for better grounding, and monetization primitives (Course Packs).

## Setup
1. **Environment Variables**:
   Ensure `GEMINI_API_KEY` is set in your Vercel project or local `.env`.
   ```bash
   GEMINI_API_KEY=your_key_here
   ```

2. **Dependencies**:
   Run `npm install` to ensure `@google/genai` is at the latest version.

## Testing Checklist

### 1. Audio & Live API
- [ ] Go to a Workspace > Live Session.
- [ ] Toggle **Gemini Live** ON.
- [ ] Wait for "CONNECTED".
- [ ] Speak into mic. Verify:
  - [ ] Visualizer moves.
  - [ ] Assistant responds with audio.
  - [ ] Transcript updates in real-time (partial text).
- [ ] **Barge-in**: Speak *while* assistant is talking. Assistant should stop immediately.

### 2. RAG V2
- [ ] Add a new Text source in Library.
- [ ] Verify "Indexing..." completes.
- [ ] In Session, ask a question specific to that text.
- [ ] Verify accurate answer.

### 3. Course Packs
- [ ] Go to Settings.
- [ ] Click "Export Pack" (Stub should alert).
- [ ] Verify "Pro Features" toggle exists.

## Troubleshooting
- **WebSocket Error**: Check API Key valid permissions for Gemini API.
- **Mic not working**: Check browser permissions. Chrome requires https or localhost.
