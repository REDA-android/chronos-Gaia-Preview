import React from 'react';
import { motion } from 'framer-motion';
import { CapturedImage, ChatMessage } from '../types';
import CameraFeed from './CameraFeed';
import Timeline from './Timeline';
import Markdown from 'react-markdown';
import { 
  Leaf, Play, Square, MessageSquare, MapPin, Globe, BrainCircuit, Volume2,
  Clock, Eye, FileText, PlayCircle, EyeOff, Trash2, AlertTriangle, Activity,
  Terminal, Settings, Camera, FastForward, Cpu, Sun, Power, LogOut, X, Droplet, Zap
} from 'lucide-react';

export const HomeTab = ({ images, active, setActive }: any) => {
  const healthyCount = images.filter((img: any) => img.healthStatus === 'HEALTHY').length;
  const totalWithStatus = images.filter((img: any) => img.healthStatus).length;
  const healthScore = totalWithStatus > 0 ? Math.round((healthyCount / totalWithStatus) * 100) : 100;
  const stressedPlants = images.filter((img: any) => img.healthStatus === 'STRESSED' || img.healthStatus === 'CRITICAL');
  
  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary to-primary-container p-8 text-on-primary shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="font-label text-xs uppercase tracking-[0.1em] opacity-80">Overall Ecosystem Health</span>
            <h1 className="font-headline text-4xl font-extrabold tracking-tight">Your Garden is {healthScore}% Healthy</h1>
            <p className="font-body text-on-primary/70 max-w-xs pt-2">
              {healthScore === 100 ? 'All specimens are thriving in optimal conditions.' : `Maintenance required for ${stressedPlants.length} botanical specimens.`}
            </p>
          </div>
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90">
              <circle className="text-white/10" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeWidth="8"></circle>
              <circle 
                className="text-white transition-all duration-1000" 
                cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" 
                strokeDasharray="364.4" 
                strokeDashoffset={364.4 - (364.4 * healthScore / 100)} 
                strokeWidth="8"
              ></circle>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-2xl font-bold font-headline">{healthScore}%</span>
            </div>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 opacity-20 pointer-events-none">
          <Leaf size={160} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-2xl font-bold tracking-tight text-primary">Action Required</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-bold font-label ${stressedPlants.length > 0 ? 'bg-error/20 text-error' : 'bg-primary/20 text-primary'}`}>
            {stressedPlants.length} Tasks
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stressedPlants.length > 0 ? stressedPlants.slice(0, 2).map((img: any, i: number) => (
            <div key={i} className="bg-surface-container-low p-5 rounded-3xl flex items-center gap-4 hover:bg-surface-container transition-colors group cursor-pointer border border-white/5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-active:scale-95 transition-transform ${img.healthStatus === 'CRITICAL' ? 'bg-error/10 text-error' : 'bg-tertiary/10 text-tertiary'}`}>
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1">
                <p className="font-label text-xs uppercase tracking-wider text-secondary opacity-70">{img.healthStatus} ALERT</p>
                <h3 className="font-headline font-bold text-on-surface truncate max-w-[200px]">{img.advice || 'Check plant health immediately'}</h3>
              </div>
            </div>
          )) : (
            <div className="col-span-full bg-surface-container-low p-8 rounded-3xl border border-white/5 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
                <Leaf size={32} />
              </div>
              <p className="font-headline text-lg font-bold text-on-surface">No immediate actions required</p>
              <p className="text-secondary text-sm">Your neural garden is currently in perfect balance.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export const ScanTab = ({ 
  cameraRef, isCameraEnabled, liveMode, setLiveMode, settings, setSettings, 
  active, setActive, handleManualCapture, flash, images 
}: any) => (
  <div className="flex flex-col items-center relative overflow-hidden animate-in fade-in duration-500">
    <div className="w-full max-w-md flex-grow flex flex-col items-center">
      <div className="relative w-full aspect-[3/4] rounded-[2.5rem] overflow-hidden border-4 border-surface-container-highest shadow-2xl bg-black">
        <div className={`absolute inset-0 bg-white z-[60] pointer-events-none transition-opacity duration-200 ease-out ${flash ? 'opacity-80' : 'opacity-0'}`}></div>
        <CameraFeed 
          ref={cameraRef} 
          active={isCameraEnabled && !liveMode} 
          facingMode={settings.facingMode} 
          resolution={settings.resolution}
          onResolutionChange={(res: any) => setSettings({...settings, resolution: res})}
        />
        
        {/* Live Mode Toggle Overlay */}
        <div className="absolute top-24 right-6">
          <button 
            onClick={() => setLiveMode(!liveMode)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${liveMode ? 'bg-error text-white animate-pulse' : 'bg-black/60 text-white hover:bg-black/80'}`}
          >
            <div className={`w-2 h-2 rounded-full ${liveMode ? 'bg-white animate-ping' : 'bg-error'}`}></div>
            {liveMode ? 'Live Active' : 'Go Live'}
          </button>
        </div>
      </div>
      <div className="mt-8 flex gap-6 items-center">
        <button 
          onClick={() => setActive(!active)} 
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${active ? 'bg-error text-white' : 'bg-surface-container-high text-primary'}`}
        >
          {active ? <Square size={20} fill="currentColor"/> : <Play size={20} fill="currentColor"/>}
        </button>
        <button 
          onClick={handleManualCapture} 
          className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-container p-1 shadow-xl hover:scale-105 active:scale-95 transition-transform"
        >
          <div className="w-full h-full rounded-full border-4 border-white/30 flex items-center justify-center">
            <Camera className="text-white" size={32} />
          </div>
        </button>
      </div>
    </div>
  </div>
);

export const PlantsTab = ({ images, setSelectedImage, setPlaybackMode, deleteSnapshot }: any) => (
  <div className="space-y-6 animate-in fade-in duration-500">
    <div className="flex justify-between items-end mb-6">
      <div className="space-y-1">
        <span className="font-label text-[10px] uppercase tracking-widest text-secondary font-semibold">Botanical Archives</span>
        <h2 className="font-headline text-3xl font-extrabold text-primary">Timeline</h2>
      </div>
    </div>
    <div className="bg-surface-container-low p-5 rounded-3xl border border-white/5">
      <Timeline 
        images={images} 
        onSelect={(img: any) => { setPlaybackMode(false); setSelectedImage(img); }} 
        onDelete={deleteSnapshot}
      />
    </div>
  </div>
);

export const ScheduleTab = ({ 
  chatMessages, userInput, setUserInput, handleChatSubmit, handleGenerateImage, 
  isProcessing, useThinking, setUseThinking, useSearch, setUseSearch, useMaps, setUseMaps,
  handleSpeak, speakingMessageId, generateGrowthReport, images
}: any) => (
  <div className="flex flex-col min-h-[500px] animate-in fade-in duration-500 h-[calc(100vh-200px)]">
    <div className="flex-1 bg-surface-container-low border border-white/5 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
      <div className="p-4 bg-black/30 border-b border-white/5 font-label text-[10px] flex justify-between items-center uppercase tracking-[0.1em]">
        <span className="text-gray-400 flex items-center gap-2"><Terminal size={12}/> Console // Gemma v3.1</span>
        <button 
          onClick={() => images.length > 0 && generateGrowthReport(images.map((i: any) => i.analysis || ""))} 
          className="text-primary hover:text-primary-fixed flex items-center gap-1.5 transition-colors font-bold"
        >
          <FileText size={12}/> Gen Report
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar text-justify leading-relaxed">
        {chatMessages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-40">
            <BrainCircuit size={48} className="mb-4 text-primary/20" />
            <p className="text-[10px] font-label text-center tracking-widest uppercase">Awaiting Neural Input...</p>
          </div>
        )}
        {chatMessages.map((m: any) => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`p-4 rounded-2xl text-sm max-w-[95%] shadow-sm ${m.role === 'user' ? 'bg-primary/20 text-white border border-primary/30 rounded-br-sm' : 'bg-surface-container-high border border-white/5 text-gray-200 rounded-bl-sm'}`}>
              <div className="flex justify-between items-start gap-4 mb-2">
                <span className={`text-[9px] font-label uppercase tracking-widest font-bold ${m.role === 'user' ? 'text-primary' : 'text-secondary'}`}>
                  {m.role === 'user' ? 'Neural Entity' : 'Gemma Core'}
                </span>
                {m.role === 'model' && (
                  <button 
                    onClick={() => handleSpeak(m.text, m.id)}
                    className={`p-1 rounded hover:bg-white/5 transition-colors ${speakingMessageId === m.id ? 'text-primary' : 'text-gray-500'}`}
                  >
                    <Volume2 size={14} className={speakingMessageId === m.id ? 'animate-pulse' : ''} />
                  </button>
                )}
              </div>
              <div className="markdown-body">
                <Markdown>{m.text}</Markdown>
              </div>
              {m.imageUrl && (
                <img src={m.imageUrl} alt="Generated" className="mt-3 rounded-xl border border-white/10 max-w-full" referrerPolicy="no-referrer" />
              )}
              {m.groundingUrls && m.groundingUrls.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
                  <p className="text-[9px] font-label text-gray-500 uppercase tracking-widest">Sources:</p>
                  {m.groundingUrls.map((url: any, i: number) => (
                    <a key={i} href={url.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                      <Globe size={10} /> {url.title || url.uri}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[8px] mt-1 text-gray-600 font-label px-1">{new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
          </div>
        ))}
        {isProcessing && (
          <div className="flex items-center gap-2 text-[10px] font-label text-primary/60 animate-pulse bg-primary/5 px-4 py-2 rounded-full border border-primary/10 w-fit">
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
            className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-white transition-all placeholder:text-gray-500"
          />
          <div className="absolute right-3 top-2.5 flex items-center gap-2">
            <button 
              type="button" 
              onClick={handleGenerateImage}
              disabled={isProcessing} 
              className="text-gray-500 hover:text-primary transition-colors disabled:opacity-20"
              title="Generate Image"
            >
              <Sun size={18}/>
            </button>
            <button type="submit" disabled={isProcessing} className="text-primary/50 hover:text-primary transition-colors disabled:opacity-20">
              <MessageSquare size={18}/>
            </button>
          </div>
         </div>
         <div className="flex gap-4 mt-3 px-1">
            <button 
              type="button"
              onClick={() => setUseThinking(!useThinking)}
              className={`flex items-center gap-2 transition-colors ${useThinking ? 'text-primary' : 'text-gray-600 hover:text-gray-400'}`}
            >
              <BrainCircuit size={12}/><span className="text-[9px] font-label font-bold">THINK</span>
            </button>
            <button 
              type="button"
              onClick={() => setUseSearch(!useSearch)}
              className={`flex items-center gap-2 transition-colors ${useSearch ? 'text-primary' : 'text-gray-600 hover:text-gray-400'}`}
            >
              <Globe size={12}/><span className="text-[9px] font-label font-bold">SEARCH</span>
            </button>
            <button 
              type="button"
              onClick={() => setUseMaps(!useMaps)}
              className={`flex items-center gap-2 transition-colors ${useMaps ? 'text-primary' : 'text-gray-600 hover:text-gray-400'}`}
            >
              <MapPin size={12}/><span className="text-[9px] font-label font-bold">MAPS</span>
            </button>
         </div>
      </form>
    </div>
  </div>
);
