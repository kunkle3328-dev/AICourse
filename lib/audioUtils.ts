// Convert base64 string to Uint8Array
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Convert Float32Array (AudioBuffer data) to PCM16 Int16Array
export function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const buffer = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return buffer;
}

// Create a blob for the API from PCM data
export function createAudioBlob(data: Float32Array, sampleRate = 16000): { data: string, mimeType: string } {
  // Resample if needed (naive decimation for simple demo, ideally use proper resampling)
  // For this demo, we assume input is already decent or rely on API to handle standard rates.
  // Gemini Live expects 16kHz PCM ideally.
  
  const pcm16 = floatTo16BitPCM(data);
  const uint8 = new Uint8Array(pcm16.buffer);
  
  let binary = '';
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  const base64 = btoa(binary);

  return {
    data: base64,
    mimeType: `audio/pcm;rate=${sampleRate}`
  };
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000
): Promise<AudioBuffer> {
  // Manually decode PCM16 to AudioBuffer
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}
