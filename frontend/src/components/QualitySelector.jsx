import React from 'react';
import { CheckCircle2, Sparkles, Monitor } from 'lucide-react';

export default function QualitySelector({ 
  quality, 
  setQuality, 
  disabled 
}) {
  const options = [
    {
      id: '720p',
      label: '720p HD',
      resolution: '1280 × 720',
      description: 'Faster download, great quality for phones & laptops',
    },
    {
      id: '1080p',
      label: '1080p Full HD',
      resolution: '1920 × 1080',
      badge: 'Best Quality',
      description: 'Crystal clear definition for larger screens & TVs',
    },
  ];

  return (
    <div className={`w-full space-y-3 transition-opacity duration-300 ${disabled ? 'opacity-50 cursor-not-allowed' : 'opacity-100'}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
          <Monitor className="w-3.5 h-3.5 text-indigo-400" />
          Select Quality
        </label>
        {disabled && (
          <span className="text-xs text-slate-500 italic">
            Fetch a video first to choose quality
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((opt) => {
          const isSelected = quality === opt.id;

          return (
            <label
              key={opt.id}
              className={`relative flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                disabled ? 'pointer-events-none' : ''
              } ${
                isSelected && !disabled
                  ? 'bg-indigo-950/40 border-indigo-500/80 shadow-lg shadow-indigo-950/50 ring-1 ring-indigo-500/30'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <input
                type="radio"
                name="videoQuality"
                value={opt.id}
                checked={isSelected}
                disabled={disabled}
                onChange={() => setQuality(opt.id)}
                className="sr-only"
              />

              <div className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                    isSelected && !disabled
                      ? 'border-indigo-400 bg-indigo-600'
                      : 'border-slate-600 bg-slate-800'
                  }`}
                >
                  {isSelected && !disabled && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-100">
                      {opt.label}
                    </span>
                    {opt.badge && !disabled && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20">
                        <Sparkles className="w-2.5 h-2.5" />
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 block mt-0.5">
                    {opt.resolution}
                  </span>
                </div>
              </div>

              {isSelected && !disabled && (
                <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 ml-2" />
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
