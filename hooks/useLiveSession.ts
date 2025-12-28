import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { AudioOrchestrator } from '../lib/audioOrchestrator';
import { createAudioBlob } from '../lib/audioUtils';
import { LiveConnectionState } from '../types';

export function useLiveSession(workspaceId: string | null) {
  const [connectionState, setConnectionState] = useState<LiveConnectionState>('DISCONNECTED');
  const [currentText, setCurrentText] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);

  const orchestrator = useRef<AudioOrchestrator>(new AudioOrchestrator());
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // VAD settings
  const VAD_THRESHOLD = 0.02;
  // Counters for debouncing
  const loudFrameCount = useRef(0);
  const REQUIRED_LOUD_FRAMES = 2; // ~100-150ms depending on buffer size

  // Setup audio processing using the provided stream
  const setupAudioProcessing = async (session: any, stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      // Reduced buffer size from 4096 to 2048 to improve latency (barge-in reaction time)
      // 2048 @ 16k is ~128ms
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate RMS for VAD / Visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        setVolume(rms);

        // Natural VAD: Debounce loud frames to avoid interrupting on clicks/pops
        if (rms > VAD_THRESHOLD) {
           loudFrameCount.current += 1;
           if (loudFrameCount.current >= REQUIRED_LOUD_FRAMES) {
               if (!isUserSpeaking) setIsUserSpeaking(true);
               orchestrator.current.stopAll(); // Interrupt AI
           }
        } else {
           loudFrameCount.current = 0;
           if (isUserSpeaking && rms < VAD_THRESHOLD / 2) setIsUserSpeaking(false);
        }

        // Send to Gemini
        // Check if session is actually open/usable
        if (session) {
            const blob = createAudioBlob(inputData);
            session.sendRealtimeInput({
            media: {
                mimeType: blob.mimeType,
                data: blob.data
            }
            });
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      scriptProcessorRef.current = processor;
      
    } catch (e) {
      console.error("Audio Processing Setup Error", e);
    }
  };

  const connectProper = useCallback(async () => {
    if (!workspaceId) return;
    setConnectionState('CONNECTING');
    try {
      // 1. Request Mic Permission & Get Stream FIRST
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000
        }
      });
      streamRef.current = stream;

      // 2. Initialize GenAI
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // 3. Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } }
          }
        },
        callbacks: {
          onopen: async () => {
            setConnectionState('CONNECTED');
            const session = await sessionPromise;
            setupAudioProcessing(session, stream);
          },
          onmessage: async (msg) => {
            // Audio Output
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              orchestrator.current.scheduleChunk(audioData);
            }
            
            // Text Output (Partial/Final)
            const textPart = msg.serverContent?.modelTurn?.parts?.[0]?.text;
            if (textPart) {
               setCurrentText(prev => prev + textPart);
            }

            // Handle Turn Complete - Archive text for SRS
            if (msg.serverContent?.turnComplete) {
                // We don't clear currentText immediately to let UI show it, 
                // but we update lastResponse so the UI knows this chunk is "done"
                setCurrentText(prev => {
                    setLastResponse(prev);
                    return ''; 
                });
            }
          },
          onclose: () => setConnectionState('DISCONNECTED'),
          onerror: (e) => {
            console.error("Session Error:", e);
            setConnectionState('ERROR');
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (e) {
      console.error("Connection Failed", e);
      setConnectionState('ERROR');
      
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
      }
    }
  }, [workspaceId]);

  const disconnect = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    sessionRef.current?.then((s: any) => s.close && s.close());
    setConnectionState('DISCONNECTED');
  }, []);

  return {
    connect: connectProper,
    disconnect,
    state: connectionState,
    currentText,
    lastResponse,
    volume,
    orchestrator: orchestrator.current
  };
}