'use client';

import React, { useRef } from 'react';
import {
  Undo2,
  Redo2,
  Upload,
  ImageDown,
  LayoutGrid,
  ShieldCheck,
  AlertTriangle,
  Sun,
  Moon,
  Languages,
} from 'lucide-react';
import { SAGA_TEMPLATES } from '@/lib/saga/templates';
import { Locale, UI_COPY } from '@/lib/saga/i18n';

interface WorkspaceToolbarProps {
  machineName: string;
  machineVersion: string;
  nodeCount: number;
  edgeCount: number;
  selectedTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAutoLayout: () => void;
  onImportJsonFile: (text: string) => void;
  onExportSvg: () => void;
  errorCount: number;
  warningCount: number;
  validationOpen: boolean;
  onToggleValidation: () => void;
  locale: Locale;
  onToggleLocale: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function WorkspaceToolbar({
  machineName,
  machineVersion,
  nodeCount,
  edgeCount,
  selectedTemplateId,
  onSelectTemplate,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAutoLayout,
  onImportJsonFile,
  onExportSvg,
  errorCount,
  warningCount,
  validationOpen,
  onToggleValidation,
  locale,
  onToggleLocale,
  darkMode,
  onToggleDarkMode,
}: WorkspaceToolbarProps) {
  const t = UI_COPY[locale];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImportJsonFile(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-11 px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shrink-0">
      {/* Left: Template switcher & quiet unboxed metadata */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-2">
          <label
            htmlFor="template-selector"
            className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap"
          >
            {t.templateLabel}
          </label>
          <select
            id="template-selector"
            value={selectedTemplateId}
            onChange={(e) => onSelectTemplate(e.target.value)}
            className="h-8 px-2.5 text-xs font-medium bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {SAGA_TEMPLATES.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {locale === 'zh-TW' ? tpl.labelZh : tpl.labelEn}
              </option>
            ))}
            <option value="custom">
              {locale === 'zh-TW' ? '自訂狀態機' : 'Custom State Machine'}
            </option>
          </select>
        </div>

        <div className="hidden xl:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
          <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">
            {machineName}
          </span>
          <span aria-hidden="true">·</span>
          <span>v{machineVersion}</span>
          <span aria-hidden="true">·</span>
          <span>
            {nodeCount} {locale === 'zh-TW' ? '節點' : 'states'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {edgeCount} {locale === 'zh-TW' ? '連線' : 'edges'}
          </span>
        </div>
      </div>

      {/* Right: Designer utility actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center border-r border-slate-200 dark:border-slate-700 pr-2 mr-0.5 gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label={t.undo}
            title={`${t.undo} (Ctrl+Z)`}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label={t.redo}
            title={`${t.redo} (Ctrl+Y)`}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onAutoLayout}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>{t.autoLayout}</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
          aria-label={t.importJson}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{t.importJson}</span>
        </button>

        <button
          type="button"
          onClick={onExportSvg}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ImageDown className="w-3.5 h-3.5" />
          <span>{t.exportSvg}</span>
        </button>

        <button
          type="button"
          onClick={onToggleValidation}
          aria-expanded={validationOpen}
          className={`inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
            validationOpen
              ? 'bg-slate-200/80 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100'
              : 'border-transparent hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
          }`}
        >
          {errorCount > 0 ? (
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
          ) : warningCount > 0 ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          )}
          <span>{t.validate}</span>
          <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
            ({errorCount}/{warningCount})
          </span>
        </button>

        <div className="flex items-center border-l border-slate-200 dark:border-slate-700 pl-2 ml-0.5 gap-1">
          <button
            type="button"
            onClick={onToggleLocale}
            aria-label={locale === 'zh-TW' ? 'Switch to English' : '切換至繁體中文'}
            title={locale === 'zh-TW' ? 'Switch to English' : '切換至繁體中文'}
            className="inline-flex items-center gap-1 h-8 px-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{locale === 'zh-TW' ? 'EN' : '繁中'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Light mode' : 'Dark mode'}
            title={darkMode ? 'Light mode' : 'Dark mode'}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
