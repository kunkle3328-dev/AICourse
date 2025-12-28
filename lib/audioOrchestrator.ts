import { decodeAudioData, base64ToUint8Array } from './audioUtils';

export class AudioOrchestrator {
  private ctx: AudioContext;
  private nextStartTime: number = 0;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private gainNode: GainNode;
  
  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass({ sampleRate: 24000 });
    this.gainNode = this.ctx.createGain();
    this.gainNode.connect(this.ctx.destination);
  }

  get currentTime() {
    return this.ctx.currentTime;
  }

  suspend() {
    return this.ctx.suspend();
  }

  resume() {
    return this.ctx.resume();
  }

  // Queue a chunk of audio (base64 PCM) to be played
  async scheduleChunk(base64Data: string) {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    const uint8 = base64ToUint8Array(base64Data);
    const audioBuffer = await decodeAudioData(uint8, this.ctx, 24000);
    
    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    // Schedule to play immediately after the last chunk finishes
    // or now if the queue is empty/lagged
    this.nextStartTime = Math.max(this.nextStartTime, this.ctx.currentTime);
    source.start(this.nextStartTime);
    
    this.nextStartTime += audioBuffer.duration;
    
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
    };
  }

  // Barge-in: Stop all currently playing audio immediately
  stopAll() {
    this.sources.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // ignore already stopped
      }
    });
    this.sources.clear();
    // Reset cursor to "now" so next speech starts immediately
    this.nextStartTime = this.ctx.currentTime;
  }
}
