import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getApiKey, setApiKey, isValidKeyFormat } from '../apiKey.js';

interface ApiKeyModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ApiKeyModal({ open, onClose, onSaved }: ApiKeyModalProps) {
  const [value, setValue] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Pre-fill with the stored key (if any) each time the modal opens.
  useEffect(() => {
    if (open) {
      setValue(getApiKey() ?? '');
      setShowKey(false);
    }
  }, [open ]);

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const valid = isValidKeyFormat(value);

  const handleSave = () => {
    if (!valid) return;
    setApiKey(value);
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apikey-modal-title"
        className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        aria-hidden={false}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="apikey-modal-title" className="text-lg font-bold text-white">
              Gemini API Key
            </h2>
            <p className="mt-1 font-mono text-xs leading-relaxed text-zinc-400">
              Bring your own key — it stays in this tab only and is sent with
              every generation request.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label
          htmlFor="apikey-input"
          className="mt-5 block font-mono text-xs uppercase tracking-widest text-zinc-400"
        >
          API key
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="apikey-input"
            type={showKey ? 'text' : 'password'}
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') handleSave();
            }}
            placeholder="Paste your API key…"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 font-mono text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="shrink-0 rounded-lg border border-zinc-800 px-3 font-mono text-xs uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        {value.trim().length > 0 && !valid && (
          <p className="mt-2 font-mono text-xs text-red-400">
            Key must be at least 20 characters.
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={handleSave}
            disabled={!valid}
            className="flex-1 rounded-lg bg-white px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-zinc-950 hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            Simpan
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-zinc-800 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
          >
            Lewati
          </button>
        </div>

        <p className="mt-4 font-mono text-xs leading-relaxed text-zinc-500">
          Belum punya key? Buat gratis di{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zinc-300 transition-colors"
          >
            aistudio.google.com/app/apikey
          </a>
          .
        </p>
      </div>
    </div>
  );
}
