'use client';

import React from 'react';
import { ArrowLeft, ChevronRight, Home, Layers } from 'lucide-react';
import { MachineNavFrame } from '@/lib/saga/subMachines';
import { Locale, UI_COPY } from '@/lib/saga/i18n';

interface SubMachineBreadcrumbProps {
  navStack: MachineNavFrame[];
  locale: Locale;
  onNavigateToIndex: (index: number) => void;
  onReturnToParent: () => void;
}

export default function SubMachineBreadcrumb({
  navStack,
  locale,
  onNavigateToIndex,
  onReturnToParent,
}: SubMachineBreadcrumbProps) {
  if (navStack.length <= 1) return null;

  const t = UI_COPY[locale];
  const depth = navStack.length;

  return (
    <div
      data-testid="submachine-breadcrumb-bar"
      className="min-h-10 px-4 py-1.5 flex items-center justify-between gap-3 bg-sky-50/85 dark:bg-sky-950/35 border-b border-sky-200/80 dark:border-sky-900/70 shrink-0"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          data-testid="btn-return-parent"
          onClick={onReturnToParent}
          title={`${t.backToParent} (Alt + ←)`}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-semibold text-sky-800 dark:text-sky-200 bg-white dark:bg-slate-900 hover:bg-sky-100/80 dark:hover:bg-sky-900/50 border border-sky-300 dark:border-sky-700 rounded-md shadow-2xs transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t.backToParent}</span>
        </button>

        <nav
          aria-label={
            locale === 'zh-TW' ? '狀態機階層路徑' : 'State machine hierarchy'
          }
          className="flex items-center gap-1 text-xs min-w-0 overflow-x-auto"
        >
          <Layers className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0 mr-1" />
          {navStack.map((frame, index) => {
            const isLast = index === navStack.length - 1;
            return (
              <React.Fragment key={`${frame.machineName}-${index}`}>
                {index > 0 && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                )}
                {isLast ? (
                  <span
                    aria-current="page"
                    className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap"
                  >
                    <span>{frame.machineName}</span>
                    {frame.viaNodeName && (
                      <span className="font-sans font-normal text-[11px] text-sky-700 dark:text-sky-300">
                        ({frame.viaNodeName})
                      </span>
                    )}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigateToIndex(index)}
                    className="font-mono text-slate-600 dark:text-slate-300 hover:text-sky-700 dark:hover:text-sky-300 hover:underline whitespace-nowrap cursor-pointer"
                  >
                    {frame.machineName}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3 shrink-0 text-xs">
        <span className="hidden sm:inline font-mono tabular-nums text-sky-700/85 dark:text-sky-300/85">
          {t.subMachineLevel} {depth}
        </span>
        {depth > 2 && (
          <button
            type="button"
            onClick={() => onNavigateToIndex(0)}
            className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline whitespace-nowrap cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>{t.backToRoot}</span>
          </button>
        )}
      </div>
    </div>
  );
}
