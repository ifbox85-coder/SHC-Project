import React from 'react';

const AreaMapper = ({ value = [], onChange }) => {
  const handleMapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const newPoint = { x, y, id: Date.now() };
    onChange([...value, newPoint]);
  };

  const removePoint = (id) => {
    onChange(value.filter(p => p.id !== id));
  };

  return (
    <div className="w-full h-full flex justify-center items-center bg-gray-50/30">
      <div 
        className="relative h-full aspect-square cursor-crosshair overflow-hidden" 
        onClick={handleMapClick}
      >
        {/* Background Face Outline (Placeholder SVG) */}
        <svg viewBox="0 0 200 200" className="w-full h-full opacity-20 text-gray-400">
          <path d="M100,20 c-40,0 -70,30 -70,70 c0,40 30,90 70,90 s70,-50 70,-90 c0,-40 -30,-70 -70,-70" fill="none" stroke="currentColor" strokeWidth="2" />
          <ellipse cx="70" cy="80" rx="15" ry="10" fill="none" stroke="currentColor" />
          <ellipse cx="130" cy="80" rx="15" ry="10" fill="none" stroke="currentColor" />
          <path d="M85,120 q15,15 30,0" fill="none" stroke="currentColor" />
          <path d="M100,90 l0,20" fill="none" stroke="currentColor" />
        </svg>

        {/* Interactive Markers */}
        {value.map((point) => (
          <div
            key={point.id}
            className="absolute w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow-xl -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[10px] text-white font-bold hover:scale-125 transition-transform"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            onClick={(e) => {
              e.stopPropagation();
              removePoint(point.id);
            }}
          >
            !
          </div>
        ))}
      </div>
    </div>
  );
};

export default AreaMapper;