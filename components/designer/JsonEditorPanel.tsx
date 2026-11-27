'use client';

import React, { useState } from 'react';
import { Check, Copy, RefreshCw, Sparkles } from 'lucide-react';
import { Locale, UI_COPY } from '@/lib/saga/i18n';

interface JsonEditorPanelProps {
  jsonText: string;
  includeLayout: boolean;
  onToggleIncludeLayout: (val: boolean) => void;
  onApplyJson: (raw: string) => { ok: boolean; error?: string };
  locale: Locale;
}

export default function JsonEditorPanel({
  jsonText,
  includeLayout,
  onToggleIncludeLayout,
  onApplyJson,
  locale,
}: JsonEditorPanelProps) {
  const t = UI_COPY[locale];
  const [editState, setEditState] = useState<{
    base: string;
    value: string;
    error: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const isActiveEdit = editState !== null && editState.base === jsonText;
  const draft = isActiveEdit ? editState.value : jsonText;
  const dirty = isActiveEdit && editState.value !== jsonText;
  const error = isActiveEdit ? editState.error : null;

  const handleApply = () => {
    const res = onApplyJson(draft);
    if (!res.ok) {
      setEditState({
        base: jsonText,
        value: draft,
        error: res.error || 'Invalid Seata State Machine JSON',
      });
    } else {
      setEditState(null);
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(draft);
      setEditState({
        base: jsonText,
        value: JSON.stringify(parsed, null, 2),
        error: null,
      });
    } catch (err) {
      setEditState({
        base: jsonText,
        value: draft,
        error: err instanceof Error ? err.message : 'Invalid JSON',
      });
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API fallback ignored cleanly
    }
  };

  return (
    <section
      aria-label="Seata State Language JSON Editor"
      className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 min-w-0"
    >
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 font-mono">
            StateMachine JSON
          </span>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={includeLayout}
              onChange={(e) => onToggleIncludeLayout(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span>{t.includeLayout}</span>
          </label>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleFormat}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-md cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.formatJson}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-md cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? t.copied : t.copyJson}</span>
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={!dirty}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-45 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t.applyJson}</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="px-4 py-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border-b border-red-200 dark:border-red-900 font-mono"
        >
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        <textarea
          aria-label="Seata Saga State Machine JSON"
          spellCheck={false}
          value={draft}
          onChange={(e) => {
            setEditState({
              base: jsonText,
              value: e.target.value,
              error: null,
            });
          }}
          className="w-full h-full p-4 font-mono text-xs leading-relaxed bg-slate-50/40 dark:bg-slate-950 text-slate-800 dark:text-slate-200 resize-none focus:outline-none"
        />
      </div>
    </section>
  );
}
