import React, { useMemo, useEffect, useState } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  Node,
  Edge,
  MarkerType,
  useNodesState,
  useEdgesState
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Sprout, Droplet, Sun, Flower, CheckCircle, Activity, Zap } from 'lucide-react';
import { CapturedImage } from '../types';

interface AppFlowProps {
  images: CapturedImage[];
}

const AppFlow: React.FC<AppFlowProps> = ({ images }) => {
  const latestStage = useMemo(() => {
    const lastWithStage = [...images].reverse().find(img => img.growthStage);
    return lastWithStage?.growthStage?.toLowerCase() || '';
  }, [images]);

  const initialNodes: Node[] = [
    {
      id: 'germination',
      type: 'input',
      data: { label: <div className="flex flex-col items-center gap-1"><Sprout size={16} className="text-green-400" /> <span>Germination</span></div> },
      position: { x: 250, y: 0 },
      style: { background: '#1a2333', color: '#fff', border: '1px solid #22d3ee', borderRadius: '8px', padding: '10px', width: 120 },
    },
    {
      id: 'seedling',
      data: { label: <div className="flex flex-col items-center gap-1"><Droplet size={16} className="text-blue-400" /> <span>Seedling</span></div> },
      position: { x: 250, y: 100 },
      style: { background: '#1a2333', color: '#fff', border: '1px solid #22d3ee', borderRadius: '8px', padding: '10px', width: 120 },
    },
    {
      id: 'vegetative',
      data: { label: <div className="flex flex-col items-center gap-1"><Sun size={16} className="text-yellow-400" /> <span>Vegetative</span></div> },
      position: { x: 250, y: 200 },
      style: { background: '#1a2333', color: '#fff', border: '1px solid #22d3ee', borderRadius: '8px', padding: '10px', width: 120 },
    },
    {
      id: 'flowering',
      data: { label: <div className="flex flex-col items-center gap-1"><Flower size={16} className="text-pink-400" /> <span>Flowering</span></div> },
      position: { x: 250, y: 300 },
      style: { background: '#1a2333', color: '#fff', border: '1px solid #22d3ee', borderRadius: '8px', padding: '10px', width: 120 },
    },
    {
      id: 'harvest',
      type: 'output',
      data: { label: <div className="flex flex-col items-center gap-1"><CheckCircle size={16} className="text-cyber-success" /> <span>Harvest</span></div> },
      position: { x: 250, y: 400 },
      style: { background: '#1a2333', color: '#fff', border: '1px solid #22d3ee', borderRadius: '8px', padding: '10px', width: 120 },
    },
  ];

  const initialEdges: Edge[] = [
    { id: 'e1-2', source: 'germination', target: 'seedling', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#22d3ee' }, style: { stroke: '#22d3ee', strokeWidth: 2, filter: 'drop-shadow(0 0 5px rgba(34, 211, 238, 0.5))' } },
    { id: 'e2-3', source: 'seedling', target: 'vegetative', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#22d3ee' }, style: { stroke: '#22d3ee', strokeWidth: 2, filter: 'drop-shadow(0 0 5px rgba(34, 211, 238, 0.5))' } },
    { id: 'e3-4', source: 'vegetative', target: 'flowering', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#22d3ee' }, style: { stroke: '#22d3ee', strokeWidth: 2, filter: 'drop-shadow(0 0 5px rgba(34, 211, 238, 0.5))' } },
    { id: 'e4-5', source: 'flowering', target: 'harvest', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#22d3ee' }, style: { stroke: '#22d3ee', strokeWidth: 2, filter: 'drop-shadow(0 0 5px rgba(34, 211, 238, 0.5))' } },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const isActive = latestStage.includes(node.id) || (node.id === 'harvest' && latestStage.includes('mature'));
        return {
          ...node,
          style: {
            ...node.style,
            background: isActive ? '#22d3ee' : '#1a2333',
            color: isActive ? '#000' : '#fff',
            boxShadow: isActive ? '0 0 20px rgba(34, 211, 238, 0.6)' : 'none',
            border: isActive ? '2px solid #fff' : '1px solid #22d3ee',
            transform: isActive ? 'scale(1.1)' : 'scale(1)',
            transition: 'all 0.5s ease-in-out'
          },
        };
      })
    );
  }, [latestStage, setNodes]);

  return (
    <div className="h-full w-full bg-[#0a0f1a]/80 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden relative shadow-2xl">
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-1">
        <h3 className="text-[14px] font-mono font-bold text-cyber-accent uppercase tracking-[0.2em] flex items-center gap-2">
          <Activity size={16} className="animate-pulse" /> Neural Growth Architecture
        </h3>
        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
          Active Node: <span className="text-white">{latestStage || 'Awaiting Analysis'}</span>
        </p>
      </div>
      
      <div className="absolute top-6 right-6 z-10">
        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
          <Zap size={12} className="text-yellow-400" />
          <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">Real-time Sync Active</span>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        style={{ background: 'transparent' }}
      >
        <Background color="#1e293b" gap={20} size={1} />
        <div className="absolute inset-0 pointer-events-none opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyber-accent/20 via-transparent to-transparent animate-pulse"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(132,204,22,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(132,204,22,0.05)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        </div>
        <Controls className="bg-black/40 border-white/10 fill-white" />
        <MiniMap 
          nodeColor={(n) => (n.style?.background === '#22d3ee' ? '#22d3ee' : '#1a2333')} 
          maskColor="rgba(0, 0, 0, 0.7)" 
          className="bg-black/40 border-white/10"
        />
      </ReactFlow>
      
      {/* Bottom Readout */}
      <div className="absolute bottom-6 left-6 right-6 z-10 flex justify-between items-end pointer-events-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyber-accent animate-ping" />
            <span className="text-[9px] font-mono text-cyber-accent uppercase tracking-widest">Neural Link: Stable</span>
          </div>
          <p className="text-[8px] font-mono text-gray-600 uppercase tracking-[0.3em]">Processing botanical telemetry...</p>
        </div>
        <div className="text-right">
          <p className="text-[24px] font-mono font-bold text-white/10 tracking-tighter leading-none">GEMMA_OS</p>
          <p className="text-[8px] font-mono text-gray-700 uppercase tracking-widest">v3.1.4-LATEST</p>
        </div>
      </div>
    </div>
  );
};

export default AppFlow;
