import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  signOut, 
  onAuthStateChanged 
} from './firebase';
import { GoogleAuthProvider } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
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
  deleteDoc,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import CameraFeed, { CameraHandle } from './components/CameraFeed';
import LiveAudio, { LiveAudioHandle } from './components/LiveAudio';
import Timeline from './components/Timeline';
import Onboarding from './components/Onboarding';
import { HomeTab, ScanTab, PlantsTab, ScheduleTab } from './components/NewUI';
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
  ChevronRight,
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
  LogOut,
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
  const [activeTab, setActiveTab] = useState<'home' | 'plants' | 'scan' | 'schedule'>('home');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedImage, setSelectedImage] = useState<CapturedImage | null>(null);
  const [liveMode, setLiveMode] = useState(false);
  const [playbackMode, setPlaybackMode] = useState(false);
  const [stealthMode, setStealthMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [flash, setFlash] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Chat Options
  const [useThinking, setUseThinking] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [useMaps, setUseMaps] = useState(false);

  const cameraRef = useRef<CameraHandle>(null);
  const liveAudioRef = useRef<LiveAudioHandle>(null);
  const intervalRef = useRef<any>(null);
  const playbackRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    // Check for redirect result when app loads
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          console.log("Redirect login successful for:", result.user.email);
        }
      } catch (error: any) {
        console.error("Redirect login error:", error);
        setGlobalError("Login failed: " + (error.message || "Unknown error"));
      }
    };
    checkRedirect();

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
        await processCapturedImage(dataUrl);
      }
    }
  };

  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const deleteSnapshot = async (id: string) => {
    if (!user) {
      setImages(prev => prev.filter(img => img.id !== id));
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'snapshots', id));
      // onSnapshot will update the UI
    } catch (e) {
      console.error("Delete failed:", e);
      setGlobalError("Failed to delete snapshot.");
    }
  };

  const purgeSnapshots = async () => {
    if (!user) {
      setImages([]);
      return;
    }
    
    setShowPurgeConfirm(true);
  };

  const confirmPurge = async () => {
    if (!user) return;
    setShowPurgeConfirm(false);
    
    try {
      const q = query(collection(db, 'users', user.uid, 'snapshots'));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'users', user.uid, 'snapshots', d.id)));
      await Promise.all(deletePromises);
      setImages([]);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ef4444', '#991b1b']
      });
    } catch (e) {
      console.error("Purge failed:", e);
      setGlobalError("Neural purge failed. Check connection.");
    }
  };

  const handleManualCapture = async () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
    
    if (liveMode && liveAudioRef.current) {
      const dataUrl = liveAudioRef.current.capture();
      if (dataUrl) {
        await processCapturedImage(dataUrl);
      }
    } else {
      await captureAndProcess();
    }
  };

  const processCapturedImage = async (dataUrl: string) => {
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
          const snap = await getDocs(q);
          if (!snap.empty) {
            await setDoc(doc(db, 'users', user.uid, 'snapshots', snap.docs[0].id), {
              analysis,
              healthStatus: metadata.healthStatus,
              growthStage: metadata.growthStage,
              confidence: metadata.confidence
            }, { merge: true });
          }
        }
      } catch (e) {
        console.error("AI Analysis failed:", e);
      }
    }
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
      if (Capacitor.isNativePlatform()) {
        // Use native Google Sign-In for Android/iOS
        const result = await FirebaseAuthentication.signInWithGoogle();
        if (result.credential?.idToken) {
          const credential = GoogleAuthProvider.credential(result.credential.idToken);
          await signInWithCredential(auth, credential);
        } else {
          throw new Error("No ID token returned from Google Sign-In");
        }
      } else {
        // Fallback to popup for web
        await signInWithPopup(auth, googleProvider);
      }
    } catch (e: any) {
      console.error("Login Error:", e);
      setGlobalError("Login failed: " + (e.message || "Unknown error"));
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
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
          onClick={() => setStealthMode(false)}
        >
          <button 
            onClick={(e) => { e.stopPropagation(); setStealthMode(false); }}
            className="absolute top-8 right-8 text-white/20 hover:text-white/60 transition-colors"
          >
            <X size={32} />
          </button>
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
          <p className="text-white/5 text-[9px] absolute bottom-12 font-mono">CLICK ANYWHERE TO RECALL SYSTEM</p>
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 w-full rounded-b-[2.5rem] bg-[#04110c]/80 backdrop-blur-3xl z-50 shadow-[0_20px_40px_rgba(0,0,0,0.3)] flex justify-between items-center px-6 pb-4 pt-[max(env(safe-area-inset-top),2rem)] border-b border-primary/10">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleLogout}
            className="w-10 h-10 rounded-full overflow-hidden border border-primary/30 bg-surface-container-highest flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-500 cursor-pointer shadow-[0_0_15px_rgba(192,254,113,0.2)]"
          >
            {user.photoURL ? <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" /> : <Activity size={18} className="text-primary" />}
          </button>
          <span className="text-xl font-extrabold tracking-tighter text-primary font-headline italic">Lumina Gemma</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setStealthMode(!stealthMode)} 
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-500 ${stealthMode ? 'bg-primary/20 text-primary' : 'text-primary/60 hover:bg-primary/10'}`}
          >
            {stealthMode ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-500 ${showSettings ? 'bg-primary/20 text-primary' : 'text-primary/60 hover:bg-primary/10'}`}
          >
            <Settings size={20}/>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar pt-[calc(6rem+max(env(safe-area-inset-top),2rem))] pb-[calc(8rem+max(env(safe-area-inset-bottom),2rem))] max-w-7xl mx-auto w-full">
          {activeTab === 'home' && <HomeTab images={images} active={active} setActive={setActive} />}
          {activeTab === 'scan' && (
            <ScanTab 
              cameraRef={cameraRef} 
              isCameraEnabled={isCameraEnabled} 
              liveMode={liveMode} 
              setLiveMode={setLiveMode}
              settings={settings} 
              setSettings={setSettings} 
              active={active} 
              setActive={setActive} 
              handleManualCapture={handleManualCapture} 
              flash={flash} 
              images={images} 
            />
          )}
          {activeTab === 'plants' && (
            <PlantsTab 
              images={images} 
              setSelectedImage={setSelectedImage} 
              setPlaybackMode={setPlaybackMode} 
              deleteSnapshot={deleteSnapshot} 
            />
          )}
          {activeTab === 'schedule' && (
            <ScheduleTab 
              chatMessages={chatMessages} 
              userInput={userInput} 
              setUserInput={setUserInput} 
              handleChatSubmit={handleChatSubmit} 
              handleGenerateImage={handleGenerateImage} 
              isProcessing={isProcessing} 
              useThinking={useThinking} 
              setUseThinking={setUseThinking} 
              useSearch={useSearch} 
              setUseSearch={setUseSearch} 
              useMaps={useMaps} 
              setUseMaps={setUseMaps} 
              handleSpeak={handleSpeak} 
              speakingMessageId={speakingMessageId} 
              generateGrowthReport={generateGrowthReport} 
              images={images} 
            />
          )}
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
                  onClick={purgeSnapshots}
                  className="w-full py-2.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={14}/> Purge Neural Core
                </button>
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
              ref={liveAudioRef}
              onClose={() => setLiveMode(false)} 
              onCapture={handleManualCapture} 
              onTranscript={(t, u) => setChatMessages(p => [...p, {id: Date.now().toString(), role: u ? 'user' : 'model', text: t, timestamp: Date.now()}])} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#04110c] border border-primary/30 p-6 rounded-3xl max-w-sm w-full shadow-[0_0_50px_rgba(192,254,113,0.1)] space-y-6"
            >
              <div className="flex items-center gap-4 text-primary">
                <div className="p-3 bg-primary/10 rounded-full">
                  <LogOut size={24} />
                </div>
                <h3 className="text-lg font-bold font-headline tracking-tight">Disconnect Neural Link?</h3>
              </div>
              
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Are you sure you want to disconnect from the Lumina Ecosystem? Your monitoring session will be suspended.
              </p>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-3 bg-white/5 border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all font-label"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmLogout}
                  className="flex-1 py-3 bg-primary text-[#04110c] rounded-full text-xs font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-[0_0_20px_rgba(192,254,113,0.3)] font-label"
                >
                  Disconnect
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Purge Confirmation Modal */}
      <AnimatePresence>
        {showPurgeConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-cyber-900 border border-red-500/50 p-6 rounded-xl max-w-sm w-full shadow-[0_0_50px_rgba(239,68,68,0.2)] space-y-6"
            >
              <div className="flex items-center gap-4 text-red-500">
                <div className="p-3 bg-red-500/10 rounded-full">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="text-lg font-bold font-mono uppercase tracking-tighter">Critical Purge</h3>
              </div>
              
              <p className="text-sm text-gray-400 leading-relaxed">
                You are about to permanently delete all monitoring data from the neural core. This action is <span className="text-red-400 font-bold">irreversible</span> and will wipe all snapshots and analysis.
              </p>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowPurgeConfirm(false)}
                  className="flex-1 py-3 bg-white/5 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Abort
                </button>
                <button 
                  onClick={confirmPurge}
                  className="flex-1 py-3 bg-red-500 text-black rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-red-600 transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                >
                  Confirm Purge
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 w-full z-50 px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] flex justify-center items-center bg-gradient-to-t from-[#04110c] via-[#04110c]/80 to-transparent pt-8 pointer-events-none">
        <div className="w-full max-w-md rounded-full border border-white/5 bg-[#04110c]/60 backdrop-blur-[64px] shadow-2xl shadow-black/40 flex justify-around items-center px-2 py-2 pointer-events-auto">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center p-3 rounded-full transition-all duration-300 ${activeTab === 'home' ? 'bg-primary text-[#04110c] shadow-[0_0_20px_rgba(192,254,113,0.4)] scale-110' : 'text-primary/60 hover:text-primary active:scale-95'}`}
          >
            <Activity size={24} />
            <span className="font-label text-[9px] uppercase tracking-widest mt-1 hidden sm:block">Home</span>
          </button>
          <button 
            onClick={() => setActiveTab('plants')}
            className={`flex flex-col items-center justify-center p-3 rounded-full transition-all duration-300 ${activeTab === 'plants' ? 'bg-primary text-[#04110c] shadow-[0_0_20px_rgba(192,254,113,0.4)] scale-110' : 'text-primary/60 hover:text-primary active:scale-95'}`}
          >
            <Leaf size={24} />
            <span className="font-label text-[9px] uppercase tracking-widest mt-1 hidden sm:block">Flora</span>
          </button>
          <button 
            onClick={() => setActiveTab('scan')}
            className={`flex flex-col items-center justify-center p-3 rounded-full transition-all duration-300 ${activeTab === 'scan' ? 'bg-primary text-[#04110c] shadow-[0_0_20px_rgba(192,254,113,0.4)] scale-110' : 'text-primary/60 hover:text-primary active:scale-95'}`}
          >
            <Camera size={24} />
            <span className="font-label text-[9px] uppercase tracking-widest mt-1 hidden sm:block">Scan</span>
          </button>
          <button 
            onClick={() => setActiveTab('schedule')}
            className={`flex flex-col items-center justify-center p-3 rounded-full transition-all duration-300 ${activeTab === 'schedule' ? 'bg-primary text-[#04110c] shadow-[0_0_20px_rgba(192,254,113,0.4)] scale-110' : 'text-primary/60 hover:text-primary active:scale-95'}`}
          >
            <Terminal size={24} />
            <span className="font-label text-[9px] uppercase tracking-widest mt-1 hidden sm:block">Console</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;