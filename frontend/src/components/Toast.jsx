import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isError = toast.type === 'error';
  const isSuccess = toast.type === 'success';

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full">
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all ${
          isError
            ? 'bg-red-950/90 border-red-800/80 text-red-200 shadow-red-950/40'
            : isSuccess
            ? 'bg-emerald-950/90 border-emerald-800/80 text-emerald-200 shadow-emerald-950/40'
            : 'bg-slate-900/90 border-slate-700 text-slate-200 shadow-black/40'
        }`}
      >
        <div className="shrink-0 mt-0.5">
          {isError && <AlertCircle className="w-5 h-5 text-red-400" />}
          {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {!isError && !isSuccess && <Info className="w-5 h-5 text-indigo-400" />}
        </div>

        <div className="flex-1 text-sm leading-relaxed font-medium">
          {toast.message}
        </div>

        <button
          onClick={onClose}
          className="shrink-0 text-slate-400 hover:text-white p-0.5 rounded-md hover:bg-white/10 transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

