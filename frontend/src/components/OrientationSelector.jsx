import React from 'react';
import { Monitor, Smartphone } from 'lucide-react';

const OPTIONS = [
  {
    value: 'landscape',
    label: 'Landscape',
    ratio: '16:9',
    Icon: Monitor,
    desc: 'Standard widescreen — YouTube, Facebook',
    color: 'indigo',
    preview: (
      // 16:9 rectangle preview
      <div className="flex items-center justify-center">
        <div className="w-10 h-[22px] rounded-sm border-2 border-current opacity-80" />
      </div>
    ),
  },
  {
    value: 'portrait',
    label: 'Portrait',
    ratio: '9:16',
    Icon: Smartphone,
    desc: 'Vertical — Shorts, Reels, TikTok',
    color: 'pink',
    preview: (
      // 9:16 rectangle preview
      <div className="flex items-center justify-center">
        <div className="w-[14px] h-[25px] rounded-sm border-2 border-current opacity-80" />
      </div>
    ),
  },
];

const colorMap = {
  indigo: {
    active: 'border-indigo-500 bg-indigo-500/10 text-indigo-300',
    radio: 'accent-indigo-500',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  },
  pink: {
    active: 'border-pink-500 bg-pink-500/10 text-pink-300',
    radio: 'accent-pink-500',
    badge: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  },
};

export default function OrientationSelector({ orientation, setOrientation, disabled }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Orientation
        </span>
        <span className="text-[11px] text-slate-500 font-medium">
          {orientation === 'portrait' ? '9:16 vertical' : '16:9 widescreen'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map(({ value, label, ratio, Icon, desc, color, preview }) => {
          const isActive = orientation === value;
          const colors = colorMap[color];
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => setOrientation(value)}
              className={`relative flex flex-col items-center gap-2.5 p-3.5 rounded-xl border-2 transition-all text-center group
                ${isActive
                  ? colors.active + ' shadow-md'
                  : 'border-slate-700/60 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:bg-slate-800/40 hover:text-slate-300'
                }
                disabled:opacity-40 disabled:pointer-events-none`}
            >
              {/* Aspect ratio visual preview */}
              <div
                className={`transition-colors ${isActive ? `text-${color}-400` : 'text-slate-500 group-hover:text-slate-400'}`}
              >
                {preview}
              </div>

              {/* Icon + Label row */}
              <div className="flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 ${isActive ? `text-${color}-400` : 'text-slate-500'}`} />
                <span className="text-sm font-bold leading-none">{label}</span>
              </div>

              {/* Ratio badge */}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isActive ? colors.badge : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}
              >
                {ratio}
              </span>

              {/* Description */}
              <p className="text-[10px] leading-tight text-slate-500 group-hover:text-slate-400 transition-colors">
                {desc}
              </p>

              {/* Active indicator dot */}
              {isActive && (
                <span
                  className={`absolute top-2 right-2 w-2 h-2 rounded-full bg-${color}-400 shadow-sm shadow-${color}-400/50`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Portrait info note */}
      {orientation === 'portrait' && (
        <p className="text-[11px] text-slate-500 leading-snug pt-0.5 pl-1">
          <span className="text-pink-400 font-semibold">Portrait</span> selects the best vertical format available.
          Works natively with Shorts &amp; Reels — landscape videos fall back to best available.
        </p>
      )}
    </div>
  );
}

