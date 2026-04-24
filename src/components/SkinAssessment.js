import React from 'react';

const SkinAssessment = ({ value = {}, onChange }) => {
  const metrics = [
    { id: 'moisture', label: 'Moisture / Hydration', icon: '💧' },
    { id: 'oil', label: 'Oil / Sebum Control', icon: '🛢️' },
    { id: 'elasticity', label: 'Elasticity / Tightness', icon: '🧬' },
    { id: 'pigmentation', label: 'Pigmentation Level', icon: '✨' },
  ];

  const updateMetric = (id, val) => {
    onChange({ ...value, [id]: val });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5">
        {metrics.map((m) => (
          <div key={m.id} className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-400">
              <span className="flex items-center gap-2">
                <span className="text-lg opacity-100 grayscale-[0.5]">{m.icon}</span> {m.label}
              </span>
              <span className="text-blue-400 font-mono text-sm">{value[m.id] || 0}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={value[m.id] || 0}
              onChange={(e) => updateMetric(m.id, parseInt(e.target.value))}
              className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        ))}
      </div>
      
      <div className="pt-4 border-t border-gray-800/50">
        <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest">Skin Type Analysis</label>
        <div className="flex gap-2">
          {['Dry', 'Oily', 'Normal', 'Sensitive', 'Combination'].map(type => (
            <button key={type} onClick={() => updateMetric('type', type)} className={`flex-1 py-2 rounded-xl text-[9px] font-bold border transition-all ${value.type === type ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-800 text-gray-500 hover:bg-gray-800'}`}>{type}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkinAssessment;