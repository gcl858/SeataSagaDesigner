'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, RefreshCw, Sparkles } from 'lucide-react';
import { Locale, UI_COPY } from '@/lib/saga/i18n';
import { formatSeataYaml } from '@/lib/saga/yaml';
import {
  locateSelectionInSource,
  SourceLocateTarget,
} from '@/lib/saga/sourceLocator';

export type SourceFormat = 'json' | 'yaml';

const LINE_HEIGHT_PX = 22;
const EDITOR_PAD_TOP_PX = 16;

interface JsonEditorPanelProps {
  format: SourceFormat;
  onChangeFormat: (format: SourceFormat) => void;
  sourceText: string;
  includeLayout: boolean;
  onToggleIncludeLayout: (val: boolean) => void;
  onApplySource: (raw: string, format: SourceFormat) => { ok: boolean; error?: string };
  onExportCurrent: () => void;
  locateTarget?: SourceLocateTarget | null;
  locateNonce?: number;
  locale: Locale;
}

export default function JsonEditorPanel({
  format,
  onChangeFormat,
  sourceText,
  includeLayout,
  onToggleIncludeLayout,
  onApplySource,
  onExportCurrent,
  locateTarget = null,
  locateNonce = 0,
  locale,
}: JsonEditorPanelProps) {
  const t = UI_COPY[locale];
  const baseKey = `${format}::${sourceText}`;

  const [editState, setEditState] = useState<{
    baseKey: string;
    value: string;
    error: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterInnerRef = useRef<HTMLDivElement>(null);
  const highlightInnerRef = useRef<HTMLDivElement>(null);

  const isActiveEdit = editState !== null && editState.baseKey === baseKey;
  const draft = isActiveEdit ? editState.value : sourceText;
  const dirty = isActiveEdit && editState.value !== sourceText;
  const error = isActiveEdit ? editState.error : null;

  const lineCount = useMemo(() => draft.split('\n').length, [draft]);

  const highlightedRange = useMemo(() => {
    if (!locateTarget) return null;
    return locateSelectionInSource(draft, format, locateTarget);
  }, [draft, format, locateTarget]);

  const syncScrollOverlays = (scrollTop: number) => {
    if (gutterInnerRef.current) {
      gutterInnerRef.current.style.transform = `translateY(-${scrollTop}px)`;
    }
    if (highlightInnerRef.current) {
      highlightInnerRef.current.style.transform = `translateY(-${scrollTop}px)`;
    }
  };

  // Auto-scroll editor crisply to the located block whenever selection or format changes
  const startLine = highlightedRange?.startLine ?? null;
  const endLine = highlightedRange?.endLine ?? null;
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || startLine === null || endLine === null) return;

    const blockTop = EDITOR_PAD_TOP_PX + (startLine - 1) * LINE_HEIGHT_PX;
    const blockHeight = (endLine - startLine + 1) * LINE_HEIGHT_PX;
    const viewportH = el.clientHeight || 400;
    const maxScrollTop = Math.max(0, el.scrollHeight - viewportH);

    // Position the target block comfortably near the upper third of the editor
    const rawDesiredTop =
      blockHeight < viewportH * 0.65
        ? Math.max(0, blockTop - Math.round(viewportH * 0.22))
        : Math.max(0, blockTop - 24);
    const targetTop = Math.min(rawDesiredTop, maxScrollTop);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const fromTop = el.scrollTop;
    const distance = targetTop - fromTop;

    if (prefersReducedMotion || Math.abs(distance) < 2) {
      el.scrollTop = targetTop;
      syncScrollOverlays(el.scrollTop);
      return;
    }

    const durationMs = 240;
    const startTime = performance.now();
    let rafId = 0;

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.scrollTop = fromTop + distance * eased;
      syncScrollOverlays(el.scrollTop);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [startLine, endLine, locateNonce, format]);

  const handleApply = () => {
    const res = onApplySource(draft, format);
    if (!res.ok) {
      setEditState({
        baseKey,
        value: draft,
        error:
          res.error ||
          (format === 'yaml'
            ? 'Invalid Seata State Machine YAML'
            : 'Invalid Seata State Machine JSON'),
      });
    } else {
      setEditState(null);
    }
  };

  const handleFormat = () => {
    try {
      const formatted =
        format === 'yaml'
          ? formatSeataYaml(draft)
          : JSON.stringify(JSON.parse(draft), null, 2);
      setEditState({
        baseKey,
        value: formatted,
        error: null,
      });
    } catch (err) {
      setEditState({
        baseKey,
        value: draft,
        error: err instanceof Error ? err.message : `Invalid ${format.toUpperCase()}`,
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

  const highlightTopPx = highlightedRange
    ? EDITOR_PAD_TOP_PX + (highlightedRange.startLine - 1) * LINE_HEIGHT_PX
    : 0;
  const highlightHeightPx = highlightedRange
    ? (highlightedRange.endLine - highlightedRange.startLine + 1) * LINE_HEIGHT_PX
    : 0;

  return (
    <section
      aria-label="Seata State Language Source Editor"
      data-testid="source-editor-panel"
      data-highlight-lines={
        highlightedRange
          ? `${highlightedRange.startLine}-${highlightedRange.endLine}`
          : ''
      }
      className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 min-w-0"
    >
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          {/* JSON / YAML Segmented Control */}
          <div
            role="group"
            aria-label="Source format"
            className="inline-flex items-center p-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800"
          >
            <button
              type="button"
              onClick={() => onChangeFormat('json')}
              aria-pressed={format === 'json'}
              className={`px-2.5 py-1 text-xs font-mono font-semibold rounded transition-colors cursor-pointer ${
                format === 'json'
                  ? 'bg-white dark:bg-slate-950 text-blue-700 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              JSON
            </button>
            <button
              type="button"
              onClick={() => onChangeFormat('yaml')}
              aria-pressed={format === 'yaml'}
              className={`px-2.5 py-1 text-xs font-mono font-semibold rounded transition-colors cursor-pointer ${
                format === 'yaml'
                  ? 'bg-white dark:bg-slate-950 text-blue-700 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              YAML
            </button>
          </div>

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer whitespace-nowrap">
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
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-md cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.formatSource}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-md cursor-pointer whitespace-nowrap"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? t.copied : t.copySource}</span>
          </button>

          <button
            type="button"
            onClick={onExportCurrent}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-md cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{format === 'yaml' ? t.exportYaml : t.exportJson}</span>
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={!dirty}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-45 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t.applySource}</span>
          </button>
        </div>
      </div>

      {/* Subtle located block readout when a canvas item is highlighted */}
      {highlightedRange && (
        <div className="px-4 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-blue-50/60 dark:bg-blue-950/30 flex items-center justify-between text-[11px] font-mono text-blue-700 dark:text-blue-300">
          <span className="truncate">{highlightedRange.label}</span>
          <span className="tabular-nums shrink-0 ml-2 text-blue-600/80 dark:text-blue-400/80">
            L{highlightedRange.startLine}
            {highlightedRange.endLine > highlightedRange.startLine
              ? `–${highlightedRange.endLine}`
              : ''}
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="px-4 py-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border-b border-red-200 dark:border-red-900 font-mono"
        >
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 flex relative overflow-hidden bg-slate-50/40 dark:bg-slate-950">
        {/* Synchronized Line-Number Gutter */}
        <div
          aria-hidden="true"
          className="w-11 shrink-0 overflow-hidden select-none border-r border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-900/60 text-right font-mono text-[11px] tabular-nums"
        >
          <div
            ref={gutterInnerRef}
            style={{ paddingTop: EDITOR_PAD_TOP_PX, paddingBottom: EDITOR_PAD_TOP_PX }}
          >
            {Array.from({ length: lineCount }, (_, idx) => {
              const lineNum = idx + 1;
              const isHighlighted =
                highlightedRange !== null &&
                lineNum >= highlightedRange.startLine &&
                lineNum <= highlightedRange.endLine;
              return (
                <div
                  key={lineNum}
                  style={{ height: LINE_HEIGHT_PX, lineHeight: `${LINE_HEIGHT_PX}px` }}
                  className={`pr-2.5 ${
                    isHighlighted
                      ? 'text-blue-700 dark:text-blue-400 font-semibold bg-blue-500/10'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {lineNum}
                </div>
              );
            })}
          </div>
        </div>

        {/* Code Area: Synchronized Flash Backdrop + Editable Textarea */}
        <div className="flex-1 min-w-0 relative overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none overflow-hidden"
          >
            <div ref={highlightInnerRef} className="relative w-full">
              {highlightedRange && (
                <div
                  key={`${locateNonce}-${format}-${highlightedRange.startLine}-${highlightedRange.endLine}`}
                  data-testid="source-highlight-block"
                  style={{
                    top: highlightTopPx,
                    height: highlightHeightPx,
                  }}
                  className="absolute left-0 right-0 saga-code-flash"
                />
              )}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            aria-label={
              format === 'yaml'
                ? 'Seata Saga State Machine YAML'
                : 'Seata Saga State Machine JSON'
            }
            spellCheck={false}
            wrap="off"
            value={draft}
            onScroll={(e) => syncScrollOverlays(e.currentTarget.scrollTop)}
            onChange={(e) => {
              setEditState({
                baseKey,
                value: e.target.value,
                error: null,
              });
            }}
            style={{
              lineHeight: `${LINE_HEIGHT_PX}px`,
              paddingTop: EDITOR_PAD_TOP_PX,
              paddingBottom: EDITOR_PAD_TOP_PX,
            }}
            className="relative z-10 w-full h-full px-3.5 font-mono text-xs bg-transparent text-slate-800 dark:text-slate-200 resize-none focus:outline-none whitespace-pre overflow-auto"
          />
        </div>
      </div>
    </section>
  );
}
