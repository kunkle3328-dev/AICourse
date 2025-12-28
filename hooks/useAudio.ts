import { useState, useEffect, useRef, useCallback } from 'react';

// Interfaces for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition: { new (): SpeechRecognition };
    webkitSpeechRecognition: { new (): SpeechRecognition };
  }
}

export function useAudio(
  onTranscript: (text: string) => void,
  onSpeechEnd: () => void,
  handsFree: boolean,
  voiceURI?: string
) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const silenceTimerRef = useRef<any>(null);

  // Initialize Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // We manage flow manually for VAD simulation
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Reset silence timer on any input
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        
        // VAD Logic: If we stop hearing text for 1.5s, assume done
        if (handsFree) {
          silenceTimerRef.current = setTimeout(() => {
            recognition.stop();
          }, 2000);
        }

        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        
        // Only final results or long enough interim
        if (event.results[0].isFinal) {
           onTranscript(transcript);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // If it ended naturally, user might be done.
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // Ignore aborted errors which happen when we manually stop recognition
        if (event.error === 'aborted' || event.error === 'not-allowed') {
            setIsListening(false);
            return;
        }
        console.error("Speech Error", event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [handsFree, onTranscript]);

  const speak = useCallback((text: string) => {
    // Cancel any current speech
    synthesisRef.current.cancel();

    // Create Utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Select Voice
    if (voiceURI) {
      const voices = synthesisRef.current.getVoices();
      const selectedVoice = voices.find(v => v.voiceURI === voiceURI);
      if (selectedVoice) utterance.voice = selectedVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      onSpeechEnd();
      // Auto-listen if hands-free
      if (handsFree) {
        startListening();
      }
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    synthesisRef.current.speak(utterance);
  }, [voiceURI, handsFree, onSpeechEnd]);

  const stopSpeaking = useCallback(() => {
    synthesisRef.current.cancel();
    setIsSpeaking(false);
    // If we stop manually, we might want to start listening immediately to capture the "interruption"
    if (handsFree) {
      startListening();
    }
  }, [handsFree]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        // Already started
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch(e) { /* ignore */ }
      setIsListening(false);
    }
  }, []);

  return {
    isListening,
    isSpeaking,
    speak,
    stopSpeaking,
    startListening,
    stopListening
  };
}