export type TeachingState = 
  | 'IDLE' 
  | 'INGESTING_SOURCES' 
  | 'OUTLINE_READY' 
  | 'TEACHING' 
  | 'QUIZZING' 
  | 'REVIEWING' 
  | 'EXPORTING' 
  | 'ERROR';

export type TeachingMode = 'Explain' | 'Simplify' | 'Example' | 'Quiz' | 'Review';

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  settings: {
    difficulty: number; // 1-5
    pace: number; // 1-5
    grounding: boolean;
    handsFree: boolean;
    voiceURI?: string;
    proEnabled?: boolean; // V2
    license?: CourseLicense; // V2
  };
}

// V2: License Model
export interface CourseLicense {
  type: 'PERSONAL' | 'PLR' | 'MRR' | 'ENTERPRISE';
  seatsAllowed: number;
  attributionRequired: boolean;
  notes?: string;
}

export type SourceType = 'pdf' | 'text' | 'url' | 'youtube';

export interface Source {
  id: string;
  workspaceId: string;
  type: SourceType;
  title: string;
  contentText: string;
  createdAt: number;
  status: 'processing' | 'ready' | 'error';
  meta?: {
    url?: string;
    originalName?: string;
  };
}

export interface OutlineNode {
  id: string;
  title: string;
  children?: OutlineNode[];
}

export interface Outline {
  id: string;
  workspaceId: string;
  jsonOutline: OutlineNode[];
  updatedAt: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  citations?: Citation[];
  isPartial?: boolean; // V2 for streaming
}

export interface Session {
  id: string;
  workspaceId: string;
  lessonId?: string;
  transcript: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface Citation {
  sourceId: string;
  title: string;
  snippet: string;
  chunkId?: string; // V2
}

// V2: Vector Store Entity
export interface VectorChunk {
  chunkId: string;
  sourceId: string;
  workspaceId: string;
  text: string;
  vector: number[]; // Embedding
  startChar: number;
  endChar: number;
}

// V2: Spaced Repetition Entity
export interface SRSItem {
  id: string;
  workspaceId: string;
  concept: string;
  nextReviewAt: number; // Timestamp
  intervalDays: number;
  easeFactor: number;
}

export type LiveConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
