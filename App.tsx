import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Layers, BookOpen, Settings, Mic, LayoutDashboard, Plus, Play, Pause, ChevronRight, Loader2, RefreshCw, Zap, Download, Upload, ArrowLeft, AlertTriangle, BrainCircuit, CheckCircle, X } from 'lucide-react';
import { dbOps } from './lib/db';
import { Workspace, Source, TeachingState, SRSItem } from './types';
import { useAudio } from './hooks/useAudio';
import { useLiveSession } from './hooks/useLiveSession';
import { retrieveRelevantChunks } from './lib/rag'; // Legacy fallback
import { ragV2 } from './lib/ragEnhanced'; // V2
import { lessonIntel } from './lib/lessonIntel';
import ReactMarkdown from 'react-markdown';

// --- COMPONENTS ---

const Sidebar = ({ workspace }: { workspace: Workspace | null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    if (workspace) {
        dbOps.getDueReviews(workspace.id).then(items => setReviewCount(items.length));
    }
  }, [workspace, location.pathname]); // Refresh on nav changes
  
  const NavItem = ({ to, icon: Icon, label }: any) => (
    <button
      onClick={() => navigate(to)}
      className={`flex items-center w-full px-4 py-3 gap-3 transition-colors ${
        location.pathname === to ? 'text-cyan-400 bg-white/5 border-r-2 border-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );

  return (
    <div className="w-64 h-screen bg-onyx-950 border-r border-white/10 flex flex-col hidden md:flex">
      <div className="p-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          LCC AI Tutor <span className="text-xs border border-cyan-500/50 px-1 rounded ml-2">V2</span>
        </h1>
        {workspace && <div className="text-xs text-slate-500 mt-1">{workspace.name}</div>}
      </div>
      
      {workspace ? (
        <nav className="flex-1">
          <NavItem to={`/workspace/${workspace.id}/dashboard`} icon={LayoutDashboard} label="Dashboard" />
          <NavItem to={`/workspace/${workspace.id}/sources`} icon={Layers} label="Sources" />
          <NavItem to={`/workspace/${workspace.id}/outline`} icon={BookOpen} label="Course Outline" />
          <NavItem to={`/workspace/${workspace.id}/session`} icon={Mic} label="Live Session" />
          <div className="mt-6 px-4">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Review Queue</div>
             <button 
               onClick={() => navigate(`/workspace/${workspace.id}/review`)}
               className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 text-sm w-full py-2 group"
             >
               <RefreshCw size={16} className={reviewCount > 0 ? "text-cyan-500" : ""} /> 
               <span className={reviewCount > 0 ? "text-cyan-100" : ""}>
                 Start Review ({reviewCount})
               </span>
             </button>
          </div>
        </nav>
      ) : (
        <div className="px-6 text-sm text-slate-500">Select a workspace</div>
      )}

      <div className="p-4 border-t border-white/10">
        <button onClick={() => workspace && navigate(`/workspace/${workspace.id}/settings`)} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm">
          <Settings size={16} /> Settings
        </button>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { workspaceId } = useParamsWorkspace();
  const [stats, setStats] = useState({ sources: 0, due: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    if (!workspaceId) return;
    Promise.all([
        dbOps.getSources(workspaceId),
        dbOps.getDueReviews(workspaceId)
    ]).then(([s, r]) => setStats({ sources: s.length, due: r.length }));
  }, [workspaceId]);

  return (
    <div className="p-8">
      <h2 className="text-3xl font-light text-white mb-6">Welcome Back</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div onClick={() => navigate(`../session`)} className="bg-onyx-800 p-6 rounded-2xl border border-white/5 hover:border-cyan-500/30 cursor-pointer">
          <div className="p-3 bg-cyan-500/10 rounded-lg text-cyan-400 w-fit mb-4"><Mic size={24} /></div>
          <h3 className="text-lg font-medium text-white">Start Live Session</h3>
          <p className="text-sm text-slate-400 mt-2">Voice-first teaching with Gemini Live.</p>
        </div>
        <div onClick={() => navigate(`../sources`)} className="bg-onyx-800 p-6 rounded-2xl border border-white/5 hover:border-purple-500/30 cursor-pointer">
          <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400 w-fit mb-4"><Layers size={24} /></div>
          <h3 className="text-lg font-medium text-white">{stats.sources} Sources</h3>
          <p className="text-sm text-slate-400 mt-2">Manage PDFs and text.</p>
        </div>
        <div onClick={() => navigate(`../review`)} className="bg-onyx-800 p-6 rounded-2xl border border-white/5 hover:border-green-500/30 cursor-pointer">
          <div className="p-3 bg-green-500/10 rounded-lg text-green-400 w-fit mb-4"><RefreshCw size={24} /></div>
          <h3 className="text-lg font-medium text-white">Spaced Repetition</h3>
          <p className="text-sm text-slate-400 mt-2">{stats.due} items due for review.</p>
        </div>
      </div>
    </div>
  );
};

const ReviewSession = () => {
  const { workspaceId } = useParamsWorkspace();
  const [items, setItems] = useState<SRSItem[]>([]);
  const [currentItem, setCurrentItem] = useState<SRSItem | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (workspaceId) {
      dbOps.getDueReviews(workspaceId).then(list => {
        setItems(list);
        if (list.length > 0) setCurrentItem(list[0]);
      });
    }
  }, [workspaceId]);

  const handleGrade = async (grade: number) => { // 0-5
     if (!currentItem || !workspaceId) return;
     await lessonIntel.recordReview(currentItem.id, grade);
     
     // Remove current, show next
     const remaining = items.slice(1);
     setItems(remaining);
     setCurrentItem(remaining[0] || null);
     setIsRevealed(false);
  };

  if (!currentItem) {
      return (
          <div className="p-8 flex flex-col items-center justify-center h-full text-center">
              <div className="bg-green-500/10 p-4 rounded-full text-green-400 mb-6"><CheckCircle size={64} /></div>
              <h2 className="text-3xl font-light text-white mb-2">All Caught Up!</h2>
              <p className="text-slate-400 mb-8 max-w-md">You've reviewed all pending items for now. Great job keeping your memory sharp.</p>
              <button onClick={() => navigate('../dashboard')} className="px-6 py-3 bg-onyx-800 border border-white/10 rounded-xl text-white hover:bg-onyx-700 transition-colors">
                  Back to Dashboard
              </button>
          </div>
      )
  }

  return (
      <div className="p-8 h-full flex flex-col max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white"><ArrowLeft /></button>
            <h2 className="text-2xl text-white">Review Session <span className="text-slate-500 text-lg ml-2">({items.length} remaining)</span></h2>
          </div>
          
          <div className="flex-1 flex flex-col justify-center pb-10">
             <div className="bg-gradient-to-b from-onyx-800 to-onyx-900 border border-white/10 p-10 rounded-3xl min-h-[400px] flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-6 left-6 text-xs text-cyan-500 uppercase tracking-widest font-bold">Concept to Recall</div>
                 
                 <h3 className="text-2xl md:text-3xl text-slate-100 font-medium leading-relaxed max-w-2xl">
                    {currentItem.concept}
                 </h3>
                 
                 {!isRevealed ? (
                     <div className="absolute inset-0 bg-onyx-950/80 backdrop-blur-sm flex items-center justify-center z-10 cursor-pointer transition-all hover:bg-onyx-950/70" onClick={() => setIsRevealed(true)}>
                         <div className="flex flex-col items-center gap-3 animate-pulse">
                             <BrainCircuit size={48} className="text-cyan-500" />
                             <span className="text-cyan-400 font-medium text-lg">Tap to Reveal Answer / Grade</span>
                         </div>
                     </div>
                 ) : (
                     <div className="mt-12 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                         <div className="h-px w-full bg-white/10 mb-8"></div>
                         <div className="text-slate-400 mb-4 text-sm">How well did you recall this?</div>
                         <div className="grid grid-cols-4 gap-4">
                             <button onClick={() => handleGrade(1)} className="py-4 px-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:scale-105 transition-all">
                                 <div className="font-bold text-lg mb-1">Forgot</div>
                                 <div className="text-xs opacity-70">Review soon</div>
                             </button>
                             <button onClick={() => handleGrade(3)} className="py-4 px-2 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 hover:scale-105 transition-all">
                                 <div className="font-bold text-lg mb-1">Hard</div>
                                 <div className="text-xs opacity-70">Struggled</div>
                             </button>
                             <button onClick={() => handleGrade(4)} className="py-4 px-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:scale-105 transition-all">
                                 <div className="font-bold text-lg mb-1">Good</div>
                                 <div className="text-xs opacity-70">Recalled ok</div>
                             </button>
                             <button onClick={() => handleGrade(5)} className="py-4 px-2 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 hover:scale-105 transition-all">
                                 <div className="font-bold text-lg mb-1">Easy</div>
                                 <div className="text-xs opacity-70">Perfect</div>
                             </button>
                         </div>
                     </div>
                 )}
             </div>
          </div>
      </div>
  )
};

const SourceLibrary = () => {
  const { workspaceId } = useParamsWorkspace();
  const navigate = useNavigate();
  const [sources, setSources] = useState<Source[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inputContent, setInputContent] = useState('');
  const [inputTitle, setInputTitle] = useState('');

  useEffect(() => {
    if(workspaceId) loadSources();
  }, [workspaceId]);

  const loadSources = async () => {
    if (workspaceId) setSources(await dbOps.getSources(workspaceId));
  };

  const handleSave = async (title: string, content: string, type: Source['type']) => {
    if (!workspaceId) return;
    setLoading(true);
    const source: Source = {
      id: crypto.randomUUID(),
      workspaceId,
      type,
      title,
      contentText: content,
      createdAt: Date.now(),
      status: 'ready'
    };
    await dbOps.addSource(source);
    
    // Trigger V2 Indexing
    ragV2.indexSource(source).catch(console.error);

    setLoading(false);
    setIsAdding(false);
    loadSources();
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl text-white">Library</h2>
        </div>
        <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg">
          <Plus size={18} /> Add Source
        </button>
      </div>
      <div className="grid gap-4">
        {sources.map(s => (
          <div key={s.id} className="bg-onyx-800 p-4 rounded-xl border border-white/5 flex justify-between">
             <span className="text-slate-200">{s.title}</span>
             <span className="text-xs bg-black/30 px-2 py-1 rounded text-slate-500">{s.type}</span>
          </div>
        ))}
      </div>
      {isAdding && (
         <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-onyx-900 p-6 rounded-2xl w-full max-w-md border border-white/10">
               <h3 className="text-white mb-4">Add Text Source</h3>
               <input className="w-full bg-black/50 border border-white/10 p-2 rounded mb-2 text-white" placeholder="Title" value={inputTitle} onChange={e => setInputTitle(e.target.value)} />
               <textarea className="w-full bg-black/50 border border-white/10 p-2 rounded mb-4 h-32 text-white" placeholder="Content" value={inputContent} onChange={e => setInputContent(e.target.value)} />
               <div className="flex gap-2">
                 <button onClick={() => handleSave(inputTitle, inputContent, 'text')} disabled={loading} className="bg-cyan-600 px-4 py-2 rounded text-white flex-1">{loading ? 'Indexing...' : 'Save'}</button>
                 <button onClick={() => setIsAdding(false)} className="bg-slate-700 px-4 py-2 rounded text-white">Cancel</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

const SettingsPanel = () => {
    const { workspaceId } = useParamsWorkspace();
    const navigate = useNavigate();

    const handleExport = () => {
        alert("Course Pack Export: Not implemented in demo UI (would zip JSONs).");
    };

    return (
        <div className="p-8">
            <div className="flex items-center gap-4 mb-6">
                 <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
                    <ArrowLeft size={24} />
                 </button>
                <h2 className="text-2xl text-white">Settings</h2>
            </div>
            <div className="bg-onyx-800 p-6 rounded-2xl border border-white/5 space-y-6">
                <div>
                    <h3 className="text-lg text-white mb-2">Course Pack</h3>
                    <div className="flex gap-4">
                        <button onClick={handleExport} className="flex items-center gap-2 bg-purple-600/20 text-purple-300 border border-purple-500/30 px-4 py-2 rounded-lg hover:bg-purple-600/30">
                            <Download size={18} /> Export Pack
                        </button>
                        <button className="flex items-center gap-2 bg-slate-700/50 text-slate-300 border border-white/10 px-4 py-2 rounded-lg">
                            <Upload size={18} /> Import Pack
                        </button>
                    </div>
                </div>
                <div>
                    <h3 className="text-lg text-white mb-2">Pro Features</h3>
                    <label className="flex items-center gap-3 text-slate-300 cursor-pointer">
                        <input type="checkbox" className="w-5 h-5 rounded border-slate-600 bg-black/50" defaultChecked />
                        <span>Enable Reranking (Higher Accuracy)</span>
                    </label>
                </div>
            </div>
        </div>
    );
};

const LiveSession = () => {
  const { workspaceId } = useParamsWorkspace();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<{role: string, text: string}[]>([]);
  const [liveMode, setLiveMode] = useState(false);
  const [state, setState] = useState<TeachingState>('IDLE');
  const [notification, setNotification] = useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Hook 1: Legacy Audio (WebSpeech)
  const legacyAudio = useAudio(
    (text) => handleLegacyMessage(text),
    () => {},
    true
  );

  // Hook 2: V2 Gemini Live
  const liveSession = useLiveSession(workspaceId);

  useEffect(() => {
    if (liveMode) {
       legacyAudio.stopListening();
       liveSession.connect();
    } else {
       liveSession.disconnect();
       legacyAudio.startListening();
    }
    return () => liveSession.disconnect();
  }, [liveMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLegacyMessage = async (text: string) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    legacyAudio.speak("I heard you. Switch to Live Mode for the new V2 experience.");
  };

  const toggleSession = () => {
    if (state === 'IDLE') {
       setState('TEACHING');
       if(!liveMode) legacyAudio.speak("Session started.");
    } else {
       setState('IDLE');
       legacyAudio.stopSpeaking();
    }
  };

  const saveToSRS = async () => {
    // Prefer current streaming text if significant, else last AI message from context
    let textToSave = liveSession.currentText;
    // If current text is empty or very short, try to get the previous completed turn
    if ((!textToSave || textToSave.length < 5) && liveSession.lastResponse) {
        textToSave = liveSession.lastResponse;
    }
    
    if (textToSave && workspaceId) {
        // Truncate for concept title, or use full text
        const concept = textToSave.length > 200 ? textToSave.substring(0, 197) + "..." : textToSave;
        await lessonIntel.addItem(workspaceId, concept);
        setNotification("Added to Recall Queue");
        setTimeout(() => setNotification(null), 2500);
    }
  };

  return (
    <div className="flex flex-col h-full relative bg-onyx-950">
      {/* Notification Toast */}
      {notification && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-cyan-900/90 text-cyan-100 px-4 py-2 rounded-lg border border-cyan-500/30 z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle size={16} /> {notification}
        </div>
      )}

      {/* Header */}
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-onyx-900/50 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white transition-colors md:hidden">
              <ArrowLeft size={20} />
          </button>
          <div className={`w-3 h-3 rounded-full ${state !== 'IDLE' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
          <span className="font-mono text-sm text-slate-300">{state}</span>
          {liveMode && (
             <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                 liveSession.state === 'CONNECTED' ? 'border-cyan-500 text-cyan-400' : 
                 liveSession.state === 'ERROR' ? 'border-red-500 text-red-400 bg-red-500/10' :
                 'border-slate-500 text-slate-400'
             }`}>
                LIVE: {liveSession.state}
             </span>
          )}
        </div>
        <div className="flex items-center gap-4">
           <button 
             onClick={() => setLiveMode(!liveMode)}
             className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
               liveMode ? 'bg-cyan-500 text-black' : 'bg-onyx-700 text-slate-400'
             }`}
           >
             <Zap size={14} fill={liveMode ? "currentColor" : "none"} />
             GEMINI LIVE
           </button>
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-48">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 ${m.role === 'user' ? 'bg-cyan-900/20 text-cyan-50' : 'bg-onyx-800 text-slate-200'}`}>
              <ReactMarkdown className="prose prose-invert prose-sm">{m.text}</ReactMarkdown>
            </div>
          </div>
        ))}
        {/* Live Partial Transcript */}
        {liveMode && (liveSession.currentText || liveSession.lastResponse) && (
           <div className="flex justify-start items-end gap-2 group">
              <div className="max-w-[85%] rounded-2xl p-4 bg-onyx-800/50 border border-cyan-500/20 text-cyan-200 italic">
                 {liveSession.currentText || liveSession.lastResponse} <span className="animate-pulse">|</span>
              </div>
              <button 
                onClick={saveToSRS}
                className="mb-2 p-2 bg-onyx-800 rounded-full border border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all opacity-0 group-hover:opacity-100"
                title="Recall Later (SRS)"
              >
                  <BrainCircuit size={18} />
              </button>
           </div>
        )}
        
        {/* Error State Message */}
        {liveSession.state === 'ERROR' && (
            <div className="flex justify-center my-4">
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl flex items-center gap-3 max-w-sm">
                    <AlertTriangle className="shrink-0" size={20} />
                    <div className="text-sm">
                        <p className="font-bold">Connection Failed</p>
                        <p>Check if GEMINI_API_KEY is set in your Vercel/environment variables.</p>
                    </div>
                </div>
            </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 w-full bg-onyx-900/80 backdrop-blur border-t border-white/10 p-6 flex flex-col items-center gap-4">
        {/* Visualizer */}
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden flex justify-center">
            {/* Simple Volume Meter */}
           <div 
             className="h-full bg-cyan-500 transition-all duration-75 ease-out rounded-full" 
             style={{ width: `${Math.min(100, (liveMode ? liveSession.volume : 0) * 500)}%` }}
           ></div>
        </div>

        <div className="flex items-center gap-6">
           <button onClick={toggleSession} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ${state === 'IDLE' ? 'bg-cyan-500 hover:bg-cyan-400 text-black' : 'bg-red-500 hover:bg-red-400 text-white'}`}>
             {state === 'IDLE' ? <Play fill="currentColor" /> : <Pause fill="currentColor" />}
           </button>
           
           {liveMode && (
               <button 
                  onClick={saveToSRS} 
                  className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-2 rounded-lg bg-onyx-800 border border-white/10 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors text-sm"
               >
                   <BrainCircuit size={18} /> Recall Later
               </button>
           )}
        </div>
      </div>
    </div>
  );
};

// --- HELPERS & ROUTING ---
const useParamsWorkspace = () => {
  const { id } = useParams();
  // Fallback for non-routed components if ever needed, but simplified to direct params usage
  return { workspaceId: id };
};

const WorkspaceLayout = () => {
  const { workspaceId } = useParamsWorkspace();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!workspaceId) return;

    setLoading(true);
    dbOps.getWorkspaces().then(l => {
        const found = l.find(w => w.id === workspaceId);
        if (found) {
            setWorkspace(found);
        } else {
            console.warn(`Workspace ${workspaceId} not found`);
            navigate('/');
        }
    }).catch(e => {
        console.error("Failed to load workspace", e);
    }).finally(() => {
        setLoading(false);
    });
  }, [workspaceId, navigate]);

  if (loading) {
      return (
        <div className="bg-onyx-950 min-h-screen text-white flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-cyan-500" size={32} />
            <span className="text-slate-400 animate-pulse">Loading Workspace...</span>
        </div>
      );
  }

  if (!workspace) return null; // Redirect logic in useEffect should handle this

  return (
    <div className="flex h-screen bg-onyx-950 text-white font-sans">
      <Sidebar workspace={workspace} />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <main className="flex-1 overflow-hidden">
          <Routes>
             <Route path="dashboard" element={<Dashboard />} />
             <Route path="sources" element={<SourceLibrary />} />
             <Route path="session" element={<LiveSession />} />
             <Route path="review" element={<ReviewSession />} />
             <Route path="settings" element={<SettingsPanel />} />
             <Route path="*" element={<Navigate to="dashboard" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

const Home = () => {
    const navigate = useNavigate();
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  
    useEffect(() => {
      dbOps.getWorkspaces().then(setWorkspaces);
    }, []);
  
    const createWorkspace = async () => {
      const id = crypto.randomUUID();
      await dbOps.createWorkspace({
        id,
        name: 'New V2 Course',
        createdAt: Date.now(),
        settings: { difficulty: 3, pace: 3, grounding: true, handsFree: true, proEnabled: true }
      });
      navigate(`/workspace/${id}/dashboard`);
    };
  
    return (
      <div className="min-h-screen bg-onyx-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">Live Course Companion</h1>
          <p className="text-slate-400 mb-10">AI-powered voice tutor (V2 with Gemini Live)</p>
          <div className="space-y-4">
            {workspaces.map(ws => (
               <button key={ws.id} onClick={() => navigate(`/workspace/${ws.id}/dashboard`)} className="w-full bg-onyx-800 p-4 rounded-xl border border-white/5 hover:border-cyan-500/50 flex justify-between items-center group">
                 <span>{ws.name}</span>
                 <ChevronRight className="text-slate-600 group-hover:text-cyan-400" />
               </button>
            ))}
            <button onClick={createWorkspace} className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 p-4 rounded-xl font-medium text-white hover:brightness-110 flex items-center justify-center gap-2">
              <Plus size={20} /> Create New Workspace
            </button>
          </div>
        </div>
      </div>
    );
  }

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/workspace/:id/*" element={<WorkspaceLayout />} />
      </Routes>
    </HashRouter>
  );
}