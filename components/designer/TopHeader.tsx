'use client';

import React from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { Locale, UI_COPY } from '@/lib/saga/i18n';

export type WorkspaceView = 'canvas' | 'split' | 'json' | 'simulate';

interface TopHeaderProps {
  activeView: WorkspaceView;
  onChangeView: (view: WorkspaceView) => void;
  onExportJson: () => void;
  locale: Locale;
}

export default function TopHeader({
  activeView,
  onChangeView,
  onExportJson,
  locale,
}: TopHeaderProps) {
  const t = UI_COPY[locale];

  const navItems: Array<{ id: WorkspaceView; label: string }> = [
    { id: 'canvas', label: t.navCanvas },
    { id: 'split', label: t.navSplit },
    { id: 'json', label: t.navJson },
    { id: 'simulate', label: t.navSimulate },
  ];

  return (
    <header className="h-14 px-5 flex items-center justify-between gap-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 z-30">
      {/* Zone 1: Single text element wordmark */}
      <button
        type="button"
        onClick={() => onChangeView('canvas')}
        className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
      >
        {t.brand}
      </button>

      {/* Zone 2: 5 clean single-line navigation links */}
      <nav
        aria-label="Workspace views"
        className="flex items-center gap-6 overflow-x-auto"
      >
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeView(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative py-4 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                isActive
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {item.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-700 dark:bg-blue-400" />
              )}
            </button>
          );
        })}
        <Link
          href="/docs"
          data-testid="nav-docs-link"
          className="relative py-4 text-sm font-medium whitespace-nowrap shrink-0 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {t.navDocs}
        </Link>
      </nav>

      {/* Zone 3: Single Primary Action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onExportJson}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t.exportJson}</span>
        </button>
      </div>
    </header>
  );
}
