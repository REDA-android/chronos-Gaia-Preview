import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from './firebase';
import { 
  collection, 
  addDoc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import CameraFeed, { CameraHandle } from './components/CameraFeed';
import LiveAudio from './components/LiveAudio';
import Timeline from './components/Timeline';
import Onboarding from './components/Onboarding';
import confetti from 'canvas-confetti';
import { CapturedImage, MonitorSettings, ChatMessage, UserProfile } from './types';
import { 
  analyzeImage, 
  sendMessage, 
  generateSpeech, 
  getFastResponse, 
  generateGrowthReport,
  decodeAudio,
  decodeAudioData,
  generateImage
} from './services/geminiService';
import { 
  Leaf, 
  Play, 
  Square, 
  MessageSquare, 
  MapPin, 
  Globe, 
  BrainCircuit, 
  Volume2,
  Clock, 
  Eye,
  FileText,
  PlayCircle,
  EyeOff,
  Trash2,
  AlertTriangle,
  Activity,
  Terminal,
  Settings,
  Camera,
  FastForward,
  Cpu,
  ChevronDown,
  ChevronUp,
  Tag,
  Calendar,
  Sprout,
  Droplet,
  Sun,
  Flower,
  AlertCircle,
  Repeat,
  Power,
  HelpCircle,
  Lightbulb,
  X
} from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [active, setActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'STABLE' | 'SYNCING' | 'ERROR'>('STABLE');
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [settings, setSettings] = useState<MonitorSettings>({
    intervalHours: 1.5,
    autoAnalyze: false,
    wakeLockActive: true,
    facingMode: 'environment',
    resolution: 'med',
    playbackFps: 1,
    timestampPrecision: 'both',
    minConfidenceThreshold: 70,
    autoAdvance: true,
    plantType: '',
    hasCompletedOnboarding: false
  });
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedImage, setSelectedImage] = useState<CapturedImage | null>(null);
  const [liveMode, setLiveMode] = useState(false);
  const [playbackMode, setPlaybackMode] = useState(false);
  const [stealthMode, setStealthMode] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [flash, setFlash] = useState(false);

  // Chat Options
  const [useThinking, setUseThinking] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [useMaps, setUseMaps] = useState(false);

  const cameraRef = useRef<CameraHandle>(null);
  const intervalRef = useRef<any>(null);
  const playbackRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (u) {
        // Load user profile and settings
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          if (data.settings) setSettings(data.settings);
          if (data.hasCompletedOnboarding !== undefined) {
            if (!data.hasCompletedOnboarding) setShowOnboarding(true);
          }
        } else {
          // Create initial profile
          await setDoc(doc(db, 'users', u.uid), {
            uid: u.uid,
            email: u.email || '',
            displayName: u.displayName || '',
            hasCompletedOnboarding: false,
            settings: settings
          });
          setShowOnboarding(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, 'users', user.uid, 'snapshots'),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedImages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CapturedImage[];
        setImages(loadedImages.reverse());
      }, (error) => {
        console.error("Firestore Error: ", error);
        setGlobalError("Failed to sync snapshots.");
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    if (user && isAuthReady) {
      setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email || '',
        settings: settings,
        hasCompletedOnboarding: true // Assuming if they are using the app, they've seen it or skipped it
      }, { merge: true }).catch(e => console.error("Failed to sync settings:", e));
    }
  }, [settings, user, isAuthReady]);

  useEffect(() => {
    timerRef.current = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (active) {
      const intervalMs = settings.intervalHours * 60 * 60 * 1000;
      if (images.length === 0) setTimeout(captureAndProcess, 1000);
      intervalRef.current = setInterval(captureAndProcess, intervalMs);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [active, settings.intervalHours]);

  useEffect(() => {
    if (playbackMode && images.length > 0 && settings.autoAdvance) {
      let idx = selectedImage ? images.findIndex(img => img.id === selectedImage.id) : 0;
      if (idx === -1) idx = 0;
      const interval = 1000 / settings.playbackFps;
      playbackRef.current = setInterval(() => {
        setSelectedImage(images[idx]);
        idx = (idx + 1) % images.length;
      }, interval);
    } else {
      clearInterval(playbackRef.current);
    }
    return () => clearInterval(playbackRef.current);
  }, [playbackMode, images, settings.playbackFps, settings.autoAdvance]);

  const captureAndProcess = async () => {
    if (cameraRef.current) {
      const dataUrl = cameraRef.current.capture();
      if (dataUrl) {
        const newImage: CapturedImage = { 
          id: Date.now().toString(), 
          uid: user?.uid || 'anonymous',
          timestamp: Date.now(), 
          dataUrl 
        };
        
        if (user) {
          try {
            await addDoc(collection(db, 'users', user.uid, 'snapshots'), newImage);
          } catch (e: any) {
            console.error("Failed to save snapshot to Firestore:", e);
          }
        } else {
          setImages(prev => [...prev, newImage]);
        }

        if (settings.autoAnalyze) {
          try {
            const prompt = `Analyze plant snapshot. [HEALTH: STATUS][STAGE: stage][TAGS: tag1][ADVICE: text][CONFIDENCE: X%]`;
            const analysis = await analyzeImage(dataUrl, prompt, settings.plantType);
            const metadata = parseMetaData(analysis);
            
            if (user) {
              const q = query(
                collection(db, 'users', user.uid, 'snapshots'),
                where('timestamp', '==', newImage.timestamp),
                limit(1)
              );
              const snapshot = await getDocs(q);
              if (!snapshot.empty) {
                await setDoc(doc(db, 'users', user.uid, 'snapshots', snapshot.docs[0].id), {
                  ...newImage,
                  analysis,
                  ...metadata
                });
              }
            } else {
              setImages(prev => prev.map(img => img.id === newImage.id ? { ...img, analysis, ...metadata } : img));
            }

            if (metadata.healthStatus === 'HEALTHY') {
              confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#84cc16', '#22d3ee', '#ffffff']
              });
            }
          } catch (e: any) { 
            console.error(e);
            setGlobalError(e.message || "Neural analysis failed.");
            setTimeout(() => setGlobalError(null), 5000);
          }
        }
      }
    }
  };

  const handleManualCapture = async () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
    await captureAndProcess();
  };

  const parseMetaData = (text: string) => {
    const confidence = text.match(/\[CONFIDENCE:\s*(\d+)%?\]/i);
    const health = text.match(/\[HEALTH:\s*(HEALTHY|STRESSED|CRITICAL)\]/i);
    const stage = text.match(/\[STAGE:\s*([^\]]+)\]/i);
    return {
      confidence: confidence ? parseInt(confidence[1]) : undefined,
      healthStatus: health ? (health[1].toUpperCase() as any) : undefined,
      growthStage: stage ? stage[1].trim() : undefined
    };
  };

  const exportData = (format: 'json' | 'csv') => {
    if (images.length === 0) return;
    
    let content = '';
    let fileName = `gemma_export_${Date.now()}`;
    let mimeType = '';

    if (format === 'json') {
      content = JSON.stringify(images, null, 2);
      fileName += '.json';
      mimeType = 'application/json';
    } else {
      const headers = ['ID', 'Timestamp', 'Health', 'Stage', 'Confidence', 'Analysis'];
      const rows = images.map(img => [
        img.id,
        new Date(img.timestamp).toISOString(),
        img.healthStatus || 'N/A',
        img.growthStage || 'N/A',
        img.confidence || 'N/A',
        `"${(img.analysis || '').replace(/"/g, '""')}"`
      ]);
      content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      fileName += '.csv';
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    const newMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: userInput, timestamp: Date.now() };
    setChatMessages(prev => [...prev, newMsg]);
    setUserInput('');
    setIsProcessing(true);
    try {
      const result = await sendMessage(chatMessages, newMsg.text, {
        useThinking,
        useSearch,
        useMaps,
        location
      });
      setChatMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        text: result.text || "", 
        timestamp: Date.now(),
        groundingUrls: result.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({
          title: c.web?.title || c.maps?.title,
          uri: c.web?.uri || c.maps?.uri
        }))
      }]);
    } catch (e: any) { 
      console.error(e);
      setGlobalError(e.message || "Neural link failed.");
      setTimeout(() => setGlobalError(null), 5000);
    } finally { setIsProcessing(false); }
  };

  const handleGenerateImage = async () => {
    if (!userInput.trim()) {
      setGlobalError("Please enter a prompt first.");
      return;
    }
    setIsProcessing(true);
    try {
      const result = await generateImage(userInput);
      if (result.imageUrl) {
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'model',
          text: "Generated image based on your prompt:",
          timestamp: Date.now(),
          imageUrl: result.imageUrl
        }]);
        setUserInput('');
      }
    } catch (e: any) {
      setGlobalError(e.message || "Image generation failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      setGlobalError("Login failed: " + e.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setImages([]);
      setChatMessages([]);
    } catch (e: any) {
      setGlobalError("Logout failed: " + e.message);
    }
  };

  const handleSpeak = async (text: string, messageId: string) => {
    if (speakingMessageId === messageId) {
      setSpeakingMessageId(null);
      return;
    }
    
    try {
      setSpeakingMessageId(messageId);
      const base64Audio = await generateSpeech(text);
      if (base64Audio) {
        const audioBytes = decodeAudio(base64Audio);
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass({ sampleRate: 24000 });
        const buffer = await decodeAudioData(audioBytes, ctx);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => setSpeakingMessageId(null);
        source.start(0);
      }
    } catch (error) {
      console.error("Speech Error:", error);
      setSpeakingMessageId(null);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-cyber-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Leaf className="text-cyber-accent animate-pulse" size={48} />
          <p className="text-cyber-accent font-mono text-xs tracking-widest uppercase">INITIALIZING GEMMA...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-cyber-900 text-gray-200 font-sans flex flex-col items-center justify-center p-4 sm:p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyber-800/20 via-cyber-900 to-black">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-black/40 backdrop-blur-xl border border-white/5 p-10 rounded-3xl shadow-2xl text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="p-4 bg-cyber-accent/10 rounded-full ring-1 ring-cyber-accent/30 shadow-[0_0_30px_rgba(132,204,22,0.2)]">
              <Leaf className="text-cyber-accent" size={48} />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-mono font-bold tracking-tighter">CHRONOS <span className="text-cyber-accent">GEMMA</span></h1>
            <p className="text-gray-500 text-sm font-mono tracking-widest uppercase">Neural Plant Monitoring System</p>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Connect your neural profile to begin monitoring your botanical assets with AI-driven growth analysis and real-time health tracking.
          </p>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-cyber-accent text-black font-bold rounded-xl hover:bg-white transition-all shadow-lg shadow-cyber-accent/20 flex items-center justify-center gap-3 group"
          >
            <Globe size={20} className="group-hover:rotate-12 transition-transform" />
            CONNECT WITH GOOGLE
          </button>
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">Secure Neural Link Required</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyber-900 text-gray-200 font-sans flex flex-col selection:bg-cyber-accent selection:text-black relative overflow-hidden">
      
      {/* Global Error Toast */}
      {globalError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-top duration-300">
          <div className="bg-red-900/90 backdrop-blur-md border border-red-500/50 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3">
            <AlertTriangle className="text-red-400" size={20} />
            <span className="text-sm font-medium">{globalError}</span>
            <button onClick={() => setGlobalError(null)} className="ml-2 text-white/50 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Stealth Mode Overlay - Better Visuals */}
      {stealthMode && (
        <div 
          className="fixed inset-0 bg-black z-[100] cursor-pointer flex flex-col items-center justify-center animate-in fade-in duration-500"
          onDoubleClick={() => setStealthMode(false)}
        >
          <div className="relative">
             <div className="absolute inset-0 blur-2xl opacity-20 bg-cyber-accent animate-pulse"></div>
             <Leaf className="text-cyber-accent/30 relative" size={64} />
          </div>
          <div className="text-[18vw] sm:text-[120px] font-mono font-thin text-white/5 tracking-tighter tabular-nums leading-none mt-8">
              {currentTime.getHours().toString().padStart(2, '0')}
              <span className="animate-pulse">:</span>
              {currentTime.getMinutes().toString().padStart(2, '0')}
          </div>
          <p className="text-cyber-accent/10 font-mono text-[10px] tracking-[0.5em] mt-8 uppercase">Gemma Passive Monitoring Active</p>
          <p className="text-white/5 text-[9px] absolute bottom-12 font-mono">DOUBLE CLICK TO RECALL SYSTEM</p>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-lg p-3 sticky top-0 z-30 flex justify-between items-center px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Leaf className="text-cyber-accent w-6 h-6 drop-shadow-[0_0_8px_rgba(132,204,22,0.4)]"/>
          <h1 className="font-mono font-bold tracking-tighter text-lg bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">CHRONOS <span className="text-cyber-accent">GEMMA</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">{user.displayName || 'Neural Entity'}</span>
            <button onClick={handleLogout} className="text-[8px] font-mono text-cyber-accent hover:text-white uppercase tracking-widest">Disconnect</button>
          </div>
          <div className="w-8 h-8 rounded-full border border-cyber-accent/30 overflow-hidden bg-cyber-accent/10 flex items-center justify-center">
            {user.photoURL ? <img src={user.photoURL} alt="Profile" /> : <Activity size={16} className="text-cyber-accent" />}
          </div>
          <button 
            onClick={() => setStealthMode(!stealthMode)} 
            className={`p-2 rounded-lg transition-all border ${stealthMode ? 'bg-cyber-accent/20 text-cyber-accent border-cyber-accent/30' : 'text-gray-500 border-white/5 hover:bg-white/5'}`}
            title="Stealth Mode (Black Screen/Clock)"
          >
            {stealthMode ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className={`p-2 rounded-lg transition-all border ${showSettings ? 'bg-cyber-accent/20 text-cyber-accent border-cyber-accent/30' : 'text-gray-400 border-white/5 hover:bg-white/5'}`}
            title="Toggle Settings"
          >
            <Settings size={18}/>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar">
            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-6">
                <div className="aspect-square sm:aspect-video bg-black rounded-xl overflow-hidden border border-cyber-700/50 relative shadow-2xl group ring-1 ring-white/5">
                  {/* Visual Flash Effect */}
                  <div className={`absolute inset-0 bg-white z-[60] pointer-events-none transition-opacity duration-200 ease-out ${flash ? 'opacity-80' : 'opacity-0'}`}></div>

                  {playbackMode && selectedImage ? (
                    <img src={selectedImage.dataUrl} className="w-full h-full object-cover" alt="Selected Frame" />
                  ) : (
                    <>
                      <CameraFeed 
                        ref={cameraRef} 
                        active={isCameraEnabled && !liveMode} 
                        facingMode={settings.facingMode} 
                        resolution={settings.resolution}
                        onResolutionChange={(res) => setSettings({...settings, resolution: res})}
                      />
                    </>
                  )}
                
                {/* Bottom Left Feed Controls */}
                <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 flex gap-2 sm:gap-3 pointer-events-auto">
                  <button 
                    onClick={() => setActive(!active)} 
                    className={`flex items-center gap-2 px-4 sm:px-8 py-2 sm:py-3 rounded-lg font-bold transition-all shadow-lg text-[10px] sm:text-xs tracking-widest uppercase ${active ? 'bg-cyber-warn text-white shadow-cyber-warn/20 ring-1 ring-red-400/50' : 'bg-cyber-accent text-black shadow-cyber-accent/20 ring-1 ring-lime-400/50'}`}
                  >
                    {active ? <Square size={12} fill="currentColor"/> : <Play size={12} fill="currentColor"/>}
                    {active ? 'Stop' : 'Start'}
                  </button>
                  <button 
                    onClick={() => images.length > 0 && setPlaybackMode(!playbackMode)} 
                    disabled={images.length === 0} 
                    className={`flex items-center gap-2 px-3 sm:px-6 py-2 sm:py-3 bg-black/80 border border-cyber-700/50 rounded-lg font-bold transition-all hover:bg-black text-[10px] sm:text-xs uppercase tracking-widest ${playbackMode ? 'text-cyber-accent border-cyber-accent shadow-[0_0_10px_rgba(132,204,22,0.2)]' : 'text-white disabled:opacity-30 disabled:grayscale'}`}
                  >
                    <PlayCircle size={14}/> Playback
                  </button>
                </div>

                {/* Bottom Right Feed Controls */}
                <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex gap-2 sm:gap-3 pointer-events-auto">
                  <button 
                    onClick={() => setIsCameraEnabled(!isCameraEnabled)} 
                    className={`p-2.5 sm:p-3 rounded-full transition-all border shadow-lg ${isCameraEnabled ? 'bg-cyber-success/10 text-cyber-success border-cyber-success/40' : 'bg-gray-800/50 text-gray-500 border-gray-700'}`}
                  >
                    <Power size={18}/>
                  </button>
                  <button 
                    onClick={handleManualCapture} 
                    className="p-2.5 sm:p-3 bg-white/5 border border-white/10 text-white rounded-full hover:bg-cyber-accent hover:text-black transition-all shadow-lg backdrop-blur-md group"
                    title="Capture Snapshot"
                  >
                    <Camera size={18} className="group-hover:scale-110 transition-transform duration-200"/>
                  </button>
                </div>
              </div>

              {/* Timeline Display */}
              <div className="bg-cyber-800/20 p-3 sm:p-5 rounded-xl border border-white/5 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[10px] font-mono text-gray-500 flex items-center gap-3 uppercase tracking-[0.2em]">
                    <Clock size={12} className="text-cyber-accent"/> Timeline 
                    <span className="text-white bg-white/5 px-2 py-0.5 rounded ml-2">{images.length} FRAMES</span>
                  </h3>
                  <button 
                    onClick={() => { if(confirm("Purge all monitoring data?")) setImages([]); }} 
                    className="text-[9px] text-gray-500 hover:text-red-500 flex items-center gap-1 uppercase tracking-widest transition-colors"
                  >
                    <Trash2 size={10}/> Purge Data
                  </button>
                </div>
                <Timeline images={images} onSelect={(img) => { setPlaybackMode(false); setSelectedImage(img); }} />
              </div>
            </div>

            {/* AI Console Sidebar - Mid-page layout */}
            <div className="lg:col-span-4 flex flex-col min-h-[300px] sm:min-h-[500px]">
              <div className="flex-1 bg-cyber-800/10 border border-white/5 rounded-xl flex flex-col overflow-hidden backdrop-blur-md shadow-inner">
                <div className="p-4 bg-black/30 border-b border-white/5 font-mono text-[10px] flex justify-between items-center uppercase tracking-[0.1em]">
                  <span className="text-gray-400 flex items-center gap-2"><Terminal size={12}/> Console // Gemma v3.1</span>
                  <button 
                    onClick={() => images.length > 0 && generateGrowthReport(images.map(i => i.analysis || ""))} 
                    className="text-cyber-accent hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <FileText size={12}/> Gen Report
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar text-justify leading-relaxed">
                  {chatMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-40">
                      <BrainCircuit size={48} className="mb-4 text-cyber-accent/20" />
                      <p className="text-[10px] font-mono text-center tracking-widest uppercase">Awaiting Neural Input...</p>
                    </div>
                  )}
                  {chatMessages.map(m => (
                    <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`p-3.5 rounded-xl text-xs sm:text-sm max-w-[95%] shadow-sm ${m.role === 'user' ? 'bg-cyber-700/80 text-white border border-cyber-accent/20' : 'bg-black/50 border border-white/5 text-gray-300'}`}>
                        <div className="flex justify-between items-start gap-4 mb-2">
                          <span className={`text-[9px] font-mono uppercase tracking-widest ${m.role === 'user' ? 'text-cyber-accent' : 'text-blue-400'}`}>
                            {m.role === 'user' ? 'Neural Entity' : 'Gemma Core'}
                          </span>
                          {m.role === 'model' && (
                            <button 
                              onClick={() => handleSpeak(m.text, m.id)}
                              className={`p-1 rounded hover:bg-white/5 transition-colors ${speakingMessageId === m.id ? 'text-cyber-accent' : 'text-gray-500'}`}
                            >
                              <Volume2 size={14} className={speakingMessageId === m.id ? 'animate-pulse' : ''} />
                            </button>
                          )}
                        </div>
                        <div className="markdown-body">
                          <Markdown>{m.text}</Markdown>
                        </div>
                        {m.imageUrl && (
                          <img src={m.imageUrl} alt="Generated" className="mt-3 rounded-lg border border-white/10 max-w-full" referrerPolicy="no-referrer" />
                        )}
                        {m.groundingUrls && m.groundingUrls.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
                            <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Sources:</p>
                            {m.groundingUrls.map((url, i) => (
                              <a key={i} href={url.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyber-accent hover:underline flex items-center gap-1">
                                <Globe size={10} /> {url.title || url.uri}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[8px] mt-1 text-gray-600 font-mono px-1">{new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="flex items-center gap-2 text-[10px] font-mono text-cyber-accent/60 animate-pulse bg-cyber-accent/5 px-3 py-1.5 rounded-full border border-cyber-accent/10">
                      <Cpu size={12} className="animate-spin" /> {useThinking ? 'Deep Neural Processing Engine Running...' : 'Neural Processing Engine Running...'}
                    </div>
                  )}
                </div>
                <form onSubmit={handleChatSubmit} className="p-4 bg-black/40 border-t border-white/5">
                   <div className="relative group">
                    <input 
                      type="text" 
                      value={userInput} 
                      onChange={e => setUserInput(e.target.value)} 
                      placeholder="Query the Gemma network..." 
                      className="w-full bg-black/50 border border-white/10 rounded-lg py-3 px-4 text-sm focus:outline-none focus:border-cyber-accent/50 focus:ring-1 focus:ring-cyber-accent/20 text-white transition-all placeholder:text-gray-600"
                    />
                    <div className="absolute right-3 top-2.5 flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={handleGenerateImage}
                        disabled={isProcessing} 
                        className="text-gray-500 hover:text-cyber-accent transition-colors disabled:opacity-20"
                        title="Generate Image"
                      >
                        <Sun size={18}/>
                      </button>
                      <button type="submit" disabled={isProcessing} className="text-cyber-accent/50 hover:text-cyber-accent transition-colors disabled:opacity-20">
                        <MessageSquare size={18}/>
                      </button>
                    </div>
                   </div>
                   <div className="flex gap-4 mt-3 px-1">
                      <button 
                        type="button"
                        onClick={() => setUseThinking(!useThinking)}
                        className={`flex items-center gap-2 transition-colors ${useThinking ? 'text-cyber-accent' : 'text-gray-600 hover:text-gray-400'}`}
                      >
                        <BrainCircuit size={12}/><span className="text-[9px] font-mono">THINK</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setUseSearch(!useSearch)}
                        className={`flex items-center gap-2 transition-colors ${useSearch ? 'text-cyber-accent' : 'text-gray-600 hover:text-gray-400'}`}
                      >
                        <Globe size={12}/><span className="text-[9px] font-mono">SEARCH</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setUseMaps(!useMaps)}
                        className={`flex items-center gap-2 transition-colors ${useMaps ? 'text-cyber-accent' : 'text-gray-600 hover:text-gray-400'}`}
                      >
                        <MapPin size={12}/><span className="text-[9px] font-mono">MAPS</span>
                      </button>
                   </div>
                </form>
              </div>
            </div>
          </div>
        </main>

        {/* System Config Sidebar - Styled exactly as requested */}
        <AnimatePresence>
          {showSettings && (
            <>
              {/* Mobile Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSettings(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
              />
              <motion.aside 
                initial={{ x: 320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 320, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-[300px] sm:w-[320px] fixed lg:relative inset-y-0 right-0 lg:inset-auto border-l border-white/10 bg-[#0a0f1a] p-5 sm:p-6 overflow-y-auto custom-scrollbar shadow-2xl z-40"
              >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-[13px] font-mono font-bold text-cyber-accent flex items-center gap-2 uppercase tracking-[0.1em]"><Settings size={16}/> System Config</h2>
                <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white transition-colors"><X size={18}/></button>
              </div>

            <div className="space-y-10">
              {/* Capture Frequency Section */}
              <section className="space-y-4">
                <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-[0.1em]">
                  <span className="text-gray-500 flex items-center gap-2 font-bold"><Clock size={12}/> Capture Frequency</span>
                  <span className="text-cyber-accent font-bold">{settings.intervalHours}h</span>
                </div>
                <div className="relative py-2">
                  <input 
                    type="range" 
                    min="0.1" max="24" step="0.1" 
                    value={settings.intervalHours} 
                    onChange={e => setSettings({...settings, intervalHours: parseFloat(e.target.value)})} 
                    className="w-full h-1 bg-[#1a2333] rounded-lg appearance-none cursor-pointer accent-cyber-accent"
                  />
                  <div className="flex justify-between mt-2 text-[8px] text-gray-600 font-mono">
                    <span>0.1</span>
                    <span>24.0</span>
                  </div>
                </div>
              </section>

              {/* Min Confidence Section */}
              <section className="space-y-4">
                <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-[0.1em]">
                  <span className="text-gray-500 flex items-center gap-2 font-bold"><Activity size={12}/> Min. Confidence</span>
                  <span className="text-cyber-accent font-bold">{settings.minConfidenceThreshold}%</span>
                </div>
                <div className="relative py-2">
                  <input 
                    type="range" 
                    min="1" max="100" step="1" 
                    value={settings.minConfidenceThreshold} 
                    onChange={e => setSettings({...settings, minConfidenceThreshold: parseInt(e.target.value)})} 
                    className="w-full h-1 bg-[#1a2333] rounded-lg appearance-none cursor-pointer accent-cyber-accent"
                  />
                </div>
              </section>

              {/* Timestamp Overlay Section */}
              <section className="space-y-3">
                <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-2 font-bold"><Calendar size={12}/> T-Stamp Overlay</label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-black/40 rounded border border-white/5">
                  {(['DATE', 'TIME', 'BOTH'] as const).map(p => (
                    <button 
                      key={p} 
                      onClick={() => setSettings({...settings, timestampPrecision: p.toLowerCase() as any})} 
                      className={`py-1.5 text-[10px] rounded uppercase font-bold transition-all ${settings.timestampPrecision === p.toLowerCase() ? 'bg-cyber-accent text-black shadow-lg shadow-cyber-accent/20' : 'text-gray-500 hover:text-white'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </section>

              {/* Growth Engine Section */}
              <section className="space-y-3">
                <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-2 font-bold"><Cpu size={12}/> Growth Engine</label>
                <div className="flex items-center justify-between p-3.5 bg-black/40 rounded border border-white/5 transition-colors hover:border-white/10 group">
                  <span className="text-[11px] font-bold text-gray-300">Auto-Analyze Snapshots</span>
                  <button 
                    onClick={() => setSettings({...settings, autoAnalyze: !settings.autoAnalyze})} 
                    className={`w-9 h-5 rounded-full relative transition-all duration-300 ${settings.autoAnalyze ? 'bg-cyber-accent shadow-[0_0_12px_rgba(132,204,22,0.4)]' : 'bg-gray-700'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 ${settings.autoAnalyze ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
              </section>

              {/* Optics Control Section */}
              <section className="space-y-4">
                <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-2 font-bold"><Camera size={12}/> Optics Control</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button 
                    onClick={() => setSettings({...settings, facingMode: 'environment'})} 
                    className={`py-2.5 text-[10px] rounded uppercase font-bold transition-all border ${settings.facingMode === 'environment' ? 'bg-cyber-accent text-black border-transparent shadow-lg shadow-cyber-accent/20' : 'bg-black/20 text-gray-500 border-white/5 hover:border-white/20'}`}
                  >
                    Macro (Rear)
                  </button>
                  <button 
                    onClick={() => setSettings({...settings, facingMode: 'user'})} 
                    className={`py-2.5 text-[10px] rounded uppercase font-bold transition-all border ${settings.facingMode === 'user' ? 'bg-cyber-accent text-black border-transparent shadow-lg shadow-cyber-accent/20' : 'bg-black/20 text-gray-500 border-white/5 hover:border-white/20'}`}
                  >
                    Selfie (Front)
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(['low', 'med', 'high'] as const).map(r => (
                    <button 
                      key={r} 
                      onClick={() => setSettings({...settings, resolution: r})} 
                      className={`py-1.5 text-[9px] rounded uppercase font-bold border transition-all ${settings.resolution === r ? 'bg-cyber-success text-black border-transparent shadow-[0_0_12px_rgba(34,211,238,0.3)]' : 'border-white/5 text-gray-500 hover:text-white'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </section>

              {/* Playback Speed Section */}
              <section className="space-y-4">
                <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-[0.1em]">
                  <span className="text-gray-500 flex items-center gap-2 font-bold"><FastForward size={12}/> Playback Speed</span>
                  <span className="text-cyber-success font-bold">{settings.playbackFps} FPS</span>
                </div>
                <input 
                  type="range" 
                  min="1" max="60" step="1" 
                  value={settings.playbackFps} 
                  onChange={e => setSettings({...settings, playbackFps: parseInt(e.target.value)})} 
                  className="w-full h-1 bg-[#1a2333] rounded-lg appearance-none cursor-pointer accent-cyber-success"
                />
                <div className="flex items-center justify-between p-3.5 bg-black/40 rounded border border-white/5 group">
                  <span className="text-[11px] font-bold text-gray-300">Auto-Advance Slideshow</span>
                  <button 
                    onClick={() => setSettings({...settings, autoAdvance: !settings.autoAdvance})} 
                    className={`w-9 h-5 rounded-full relative transition-all duration-300 ${settings.autoAdvance ? 'bg-cyber-success shadow-[0_0_12px_rgba(34,211,238,0.4)]' : 'bg-gray-700'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 ${settings.autoAdvance ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
              </section>

              {/* Data Management Section */}
              <section className="space-y-4">
                <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-2 font-bold"><FileText size={12}/> Data Management</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => exportData('json')}
                    disabled={images.length === 0}
                    className="py-2.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-20 flex items-center justify-center gap-2"
                  >
                    Export JSON
                  </button>
                  <button 
                    onClick={() => exportData('csv')}
                    disabled={images.length === 0}
                    className="py-2.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-20 flex items-center justify-center gap-2"
                  >
                    Export CSV
                  </button>
                </div>
                <button 
                  onClick={() => setShowOnboarding(true)}
                  className="w-full py-2.5 bg-cyber-accent/10 border border-cyber-accent/20 text-cyber-accent rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-cyber-accent/20 transition-all flex items-center justify-center gap-2"
                >
                  <HelpCircle size={14}/> Replay Tutorial
                </button>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  </div>

      {/* Background Monitoring Indicator */}
      {active && !stealthMode && (
        <div className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-20 pointer-events-none">
          <div className="flex items-center gap-3 bg-black/80 backdrop-blur-md px-3 sm:px-4 py-2 rounded-full border border-cyber-accent/30 shadow-2xl">
             <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-cyber-accent animate-ping absolute"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-cyber-accent relative"></div>
             </div>
             <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-cyber-accent">SYSTEM ACTIVE // MONITORING CYCLE {settings.intervalHours}H</span>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showOnboarding && (
          <Onboarding onComplete={() => {
            setShowOnboarding(false);
            localStorage.setItem('gemma_onboarding_complete', 'true');
            if (user) {
              setDoc(doc(db, 'users', user.uid), { hasCompletedOnboarding: true }, { merge: true });
            }
          }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {liveMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <LiveAudio 
              onClose={() => setLiveMode(false)} 
              onCapture={handleManualCapture} 
              onTranscript={(t, u) => setChatMessages(p => [...p, {id: Date.now().toString(), role: u ? 'user' : 'model', text: t, timestamp: Date.now()}])} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;