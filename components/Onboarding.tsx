import React, { useState } from 'react';
import { 
  Leaf, 
  Camera, 
  BrainCircuit, 
  Activity, 
  CheckCircle, 
  ChevronRight, 
  ChevronLeft,
  X
} from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to Chronos Gemma",
      description: "Your intelligent plant growth companion. Let's get you started with monitoring your botanical friends.",
      icon: <Leaf className="text-cyber-accent" size={48} />,
      color: "from-cyber-accent/20 to-transparent"
    },
    {
      title: "Automated Monitoring",
      description: "Set a capture interval in the System Config. Chronos Gemma will automatically take snapshots and analyze them for you.",
      icon: <Camera className="text-cyber-success" size={48} />,
      color: "from-cyber-success/20 to-transparent"
    },
    {
      title: "AI Botanical Analysis",
      description: "Our neural engine identifies growth stages, health status, and provides tailored advice for your specific plant species.",
      icon: <BrainCircuit className="text-purple-400" size={48} />,
      color: "from-purple-400/20 to-transparent"
    },
    {
      title: "Interactive Timeline",
      description: "Review your plant's journey through time. Color-coded indicators show health status at a glance.",
      icon: <Activity className="text-cyber-warn" size={48} />,
      color: "from-cyber-warn/20 to-transparent"
    }
  ];

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-500">
      <div className="max-w-md w-full bg-cyber-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
        <button 
          onClick={onComplete}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className={`p-12 flex flex-col items-center text-center bg-gradient-to-b ${steps[step].color}`}>
          <div className="mb-8 p-6 bg-black/40 rounded-full border border-white/5 shadow-inner">
            {steps[step].icon}
          </div>
          <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            {steps[step].title}
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            {steps[step].description}
          </p>

          <div className="flex gap-2 mb-8">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`h-1 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-cyber-accent' : 'w-2 bg-white/10'}`}
              />
            ))}
          </div>

          <div className="flex w-full gap-3">
            {step > 0 && (
              <button 
                onClick={prevStep}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 font-bold text-xs uppercase tracking-widest hover:bg-white/5 transition-all flex items-center justify-center gap-2"
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}
            <button 
              onClick={nextStep}
              className="flex-1 py-3 rounded-xl bg-cyber-accent text-black font-bold text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(132,204,22,0.3)]"
            >
              {step === steps.length - 1 ? "Get Started" : "Next"} 
              {step !== steps.length - 1 && <ChevronRight size={16} />}
              {step === steps.length - 1 && <CheckCircle size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
