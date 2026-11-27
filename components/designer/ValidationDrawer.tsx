'use client';

import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { ValidationIssue } from '@/lib/saga/types';
import { Locale, UI_COPY } from '@/lib/saga/i18n';

interface ValidationDrawerProps {
  issues: ValidationIssue[];
  locale: Locale;
  onFocusNode: (nodeId: string) => void;
  onFocusEdge: (edgeId: string) => void;
  onClose: () => void;
}

export default function ValidationDrawer({
  issues,
  locale,
  onFocusNode,
  onFocusEdge,
  onClose,
}: ValidationDrawerProps) {
  const t = UI_COPY[locale];

  return (
    <section
      aria-label={t.validationTitle}
      className="h-44 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col shrink-0 z-20"
    >
      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90">
        <div className="flex items-center gap-3 text-xs">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            {t.validationTitle}
          </h3>
          <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {issues.filter((i) => i.severity === 'error').length} errors ·{' '}
            {issues.filter((i) => i.severity === 'warning').length} warnings
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close diagnostics"
          className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {issues.length === 0 ? (
          <div className="h-full flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{t.validationClean}</span>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {issues.map((issue) => (
              <li key={issue.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (issue.nodeId) onFocusNode(issue.nodeId);
                    else if (issue.edgeId) onFocusEdge(issue.edgeId);
                  }}
                  className="w-full py-2 flex items-center gap-2.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1.5 cursor-pointer"
                >
                  {issue.severity === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    {issue.code}
                  </span>
                  <span className="text-slate-800 dark:text-slate-200 truncate">
                    {locale === 'zh-TW' ? issue.message : issue.messageEn}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
