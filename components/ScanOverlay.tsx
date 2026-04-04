import React from 'react';
import { motion } from 'framer-motion';

const ScanOverlay: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {/* Scanning Line */}
      <motion.div 
        initial={{ top: '-10%' }}
        animate={{ top: '110%' }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
        className="absolute left-0 right-0 h-[2px] bg-cyber-accent shadow-[0_0_20px_rgba(132,204,22,1)] z-50"
      />
      
      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(132,204,22,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(132,204,22,0.05)_1px,transparent_1px)] bg-[size:30px_30px] opacity-20"></div>
      
      {/* Scanning HUD Elements */}
      <div className="absolute inset-0 border-[20px] border-transparent border-t-cyber-accent/10 border-b-cyber-accent/10 pointer-events-none"></div>
      
      {/* Corner Brackets */}
      <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-cyber-accent rounded-tl-xl shadow-[0_0_10px_rgba(132,204,22,0.3)]"></div>
      <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-cyber-accent rounded-tr-xl shadow-[0_0_10px_rgba(132,204,22,0.3)]"></div>
      <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-cyber-accent rounded-bl-xl shadow-[0_0_10px_rgba(132,204,22,0.3)]"></div>
      <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-cyber-accent rounded-br-xl shadow-[0_0_10px_rgba(132,204,22,0.3)]"></div>
      
      {/* Dynamic Data Points */}
      <motion.div 
        animate={{ opacity: [0.2, 0.8, 0.2] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute top-1/4 left-1/4 w-2 h-2 bg-cyber-accent rounded-full shadow-[0_0_10px_rgba(132,204,22,0.8)]"
      />
      <motion.div 
        animate={{ opacity: [0.2, 0.8, 0.2] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
        className="absolute top-1/3 right-1/4 w-2 h-2 bg-cyber-accent rounded-full shadow-[0_0_10px_rgba(132,204,22,0.8)]"
      />
      <motion.div 
        animate={{ opacity: [0.2, 0.8, 0.2] }}
        transition={{ duration: 3, repeat: Infinity, delay: 1 }}
        className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-cyber-accent rounded-full shadow-[0_0_10px_rgba(132,204,22,0.8)]"
      />

      {/* Data Readout */}
      <div className="absolute top-10 left-24 font-mono text-[9px] text-cyber-accent uppercase tracking-[0.2em] space-y-2 drop-shadow-md">
        <div className="flex items-center gap-2 animate-pulse"><div className="w-1.5 h-1.5 bg-cyber-accent rounded-full"></div> NEURAL_SCAN_ACTIVE</div>
        <p className="text-white/40">RESOLVING_BOTANICAL_ID: <span className="text-white">GEMMA_X_092</span></p>
        <p className="text-white/40">SIGNAL_STRENGTH: <span className="text-white">98.4%</span></p>
      </div>
      
      <div className="absolute bottom-10 right-24 font-mono text-[9px] text-cyber-accent uppercase tracking-[0.2em] text-right space-y-2 drop-shadow-md">
        <p className="text-white/40">ENCRYPTION: <span className="text-white">QUANTUM_SECURE</span></p>
        <p className="text-white/40">LATENCY: <span className="text-white">1.2MS</span></p>
        <p className="flex items-center justify-end gap-2 text-white/40">STATUS: <span className="text-cyber-accent animate-pulse">STABLE_LINK</span></p>
      </div>

      {/* Center Reticle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-cyber-accent/20 rounded-full flex items-center justify-center">
        <div className="w-24 h-24 border border-cyber-accent/40 rounded-full animate-spin-slow border-dashed"></div>
        <div className="absolute w-1 h-1 bg-cyber-accent rounded-full"></div>
      </div>
    </div>
  );
};

export default ScanOverlay;
