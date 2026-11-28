'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Undo2,
  Redo2,
  Upload,
  FileCode2,
  ImageDown,
  LayoutGrid,
  ChevronDown,
  Check,
  Wand2,
  ShieldCheck,
  AlertTriangle,
  Sun,
  Moon,
  Languages,
  Blocks,
} from 'lucide-react';
import { SAGA_TEMPLATES } from '@/lib/saga/templates';
import { Locale, UI_COPY } from '@/lib/saga/i18n';
import { ImportedSourceFile } from '@/lib/saga/batchImport';
import type { AiLayoutStyle } from '@/lib/saga/aiLayout';

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
  autoLayoutStyle?: AiLayoutStyle;
  onAutoLayout: (style?: AiLayoutStyle) => void;
  onOpenAiLayout: () => void;
  onImportFiles: (files: ImportedSourceFile[]) => void;
  onExportYaml: () => void;
  onExportSvg: () => void;
  errorCount: number;
  warningCount: number;
  validationOpen: boolean;
  onToggleValidation: () => void;
  locale: Locale;
  onToggleLocale: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  embeddedFileName?: string | null;
  onOpenVsCodeModal?: () => void;
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
  autoLayoutStyle = 'horizontal-swimlane',
  onAutoLayout,
  onOpenAiLayout,
  onImportFiles,
  onExportYaml,
  onExportSvg,
  errorCount,
  warningCount,
  validationOpen,
  onToggleValidation,
  locale,
  onToggleLocale,
  darkMode,
  onToggleDarkMode,
  embeddedFileName = null,
  onOpenVsCodeModal,
}: WorkspaceToolbarProps) {
  const t = UI_COPY[locale];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);

  useEffect(() => {
    if (!layoutMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        layoutMenuRef.current &&
        !layoutMenuRef.current.contains(event.target as Node)
      ) {
        setLayoutMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLayoutMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [layoutMenuOpen]);

  const layoutStyleOptions: Array<{
    value: AiLayoutStyle;
    labelZh: string;
    labelEn: string;
    descZh: string;
    descEn: string;
  }> = [
    {
      value: 'horizontal-swimlane',
      labelZh: '橫向主幹泳道（預設）',
      labelEn: 'Horizontal Swimlane (Default)',
      descZh: '主流程置中、補償與異常分層無遮擋通道',
      descEn: 'Centered happy spine with upper/lower side lanes',
    },
    {
      value: 'compact-executive',
      labelZh: '精簡簡報排版',
      labelEn: 'Compact Presentation',
      descZh: '緊湊間距，適合大型流程全覽與文件截圖',
      descEn: 'Tighter spacing for large production flows',
    },
    {
      value: 'vertical-flowchart',
      labelZh: '縱向泳道流程',
      labelEn: 'Vertical Top-Down',
      descZh: '由上而下主軸展開，適合直向螢幕閱讀',
      descEn: 'Top-to-bottom progression across parallel lanes',
    },
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const MAX_FILES = 30;
    const MAX_BYTES_PER_FILE = 5 * 1024 * 1024;
    const selected = Array.from(fileList).slice(0, MAX_FILES);
    e.target.value = '';

    const entries: ImportedSourceFile[] = await Promise.all(
      selected.map(async (file) => {
        if (file.size > MAX_BYTES_PER_FILE) {
          return {
            filename: file.name,
            content: '',
          };
        }
        const content = await file.text();
        return {
          filename: file.name,
          content,
        };
      })
    );

    if (entries.length > 0) {
      onImportFiles(entries);
    }
  };

  return (
    <div className="min-h-11 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shrink-0">
      {/* Left: Template switcher (standalone) or VS Code file badge (embedded) */}
      <div className="flex items-center gap-2.5 min-w-0">
        {embeddedFileName ? (
          <div
            data-testid="vscode-embedded-file-badge"
            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-700 dark:text-blue-300"
          >
            <Blocks className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[200px]">{embeddedFileName}</span>
            <span className="font-sans font-normal text-[11px] text-slate-500 dark:text-slate-400">
              VS Code
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
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
              className="h-8 max-w-[152px] px-2 text-xs font-medium bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 truncate"
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
        )}

        <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
          <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[126px]">
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
      <div className="flex items-center gap-1 flex-wrap">
        <div className="flex items-center border-r border-slate-200 dark:border-slate-700 pr-1.5 mr-0.5 gap-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label={t.undo}
            title={`${t.undo} (Ctrl+Z)`}
            className="inline-flex items-center justify-center w-7 h-8 rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label={t.redo}
            title={`${t.redo} (Ctrl+Y)`}
            className="inline-flex items-center justify-center w-7 h-8 rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div ref={layoutMenuRef} className="relative inline-flex items-center">
          <button
            type="button"
            data-testid="btn-auto-layout"
            onClick={() => {
              setLayoutMenuOpen(false);
              onAutoLayout(autoLayoutStyle);
            }}
            className="inline-flex items-center gap-1 h-8 pl-2 pr-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-l-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>{t.autoLayout}</span>
          </button>
          <button
            type="button"
            data-testid="btn-auto-layout-menu"
            aria-label={
              locale === 'zh-TW' ? '選擇自動排版模式' : 'Choose auto-layout style'
            }
            aria-expanded={layoutMenuOpen}
            aria-haspopup="menu"
            onClick={() => setLayoutMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-center w-5 h-8 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-r-md border-l border-slate-200/80 dark:border-slate-700/80 transition-colors cursor-pointer"
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {layoutMenuOpen && (
            <div
              role="menu"
              data-testid="auto-layout-style-menu"
              className="absolute right-0 top-full mt-1.5 z-40 w-64 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg py-1"
            >
              {layoutStyleOptions.map((opt) => {
                const isSelected = autoLayoutStyle === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isSelected}
                    data-testid={`auto-layout-option-${opt.value}`}
                    onClick={() => {
                      setLayoutMenuOpen(false);
                      onAutoLayout(opt.value);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/70 dark:bg-blue-950/40' : ''
                    }`}
                  >
                    <span className="mt-0.5 w-3.5 h-3.5 shrink-0 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {locale === 'zh-TW' ? opt.labelZh : opt.labelEn}
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {locale === 'zh-TW' ? opt.descZh : opt.descEn}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          data-testid="btn-ai-layout"
          onClick={onOpenAiLayout}
          title={t.aiLayoutModalTitle}
          className="inline-flex items-center gap-1 h-8 px-2 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/70 hover:bg-blue-100/80 dark:hover:bg-blue-900/60 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>{t.aiLayout}</span>
        </button>

        <input
          ref={fileInputRef}
          data-testid="file-import-input"
          type="file"
          multiple
          accept=".json,.yaml,.yml,application/json,application/x-yaml,text/yaml"
          onChange={handleFileChange}
          className="hidden"
          aria-label={t.importFile}
        />
        <button
          type="button"
          data-testid="btn-import-files"
          title={
            locale === 'zh-TW'
              ? '支援一次選取多個父子流程 JSON / YAML 檔案（亦支援多文件 YAML ---）'
              : 'Select one or multiple parent/child JSON or YAML files (also supports multi-doc YAML ---)'
          }
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1 h-8 px-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{t.importFile}</span>
        </button>

        <button
          type="button"
          onClick={onExportYaml}
          className="inline-flex items-center gap-1 h-8 px-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FileCode2 className="w-3.5 h-3.5" />
          <span>{t.exportYaml}</span>
        </button>

        <button
          type="button"
          onClick={onExportSvg}
          className="inline-flex items-center gap-1 h-8 px-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ImageDown className="w-3.5 h-3.5" />
          <span>{t.exportSvg}</span>
        </button>

        <button
          type="button"
          onClick={onToggleValidation}
          aria-expanded={validationOpen}
          className={`inline-flex items-center gap-1 h-8 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
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

        {!embeddedFileName && onOpenVsCodeModal && (
          <button
            type="button"
            data-testid="btn-open-vscode-modal"
            onClick={onOpenVsCodeModal}
            title={t.vscodeModalTitle}
            className="inline-flex items-center gap-1 h-8 px-2 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Blocks className="w-3.5 h-3.5" />
            <span>{t.vscodeExtension}</span>
          </button>
        )}

        <div className="flex items-center border-l border-slate-200 dark:border-slate-700 pl-1.5 ml-0.5 gap-0.5">
          <button
            type="button"
            onClick={onToggleLocale}
            aria-label={locale === 'zh-TW' ? 'Switch to English' : '切換至繁體中文'}
            title={locale === 'zh-TW' ? 'Switch to English' : '切換至繁體中文'}
            className="inline-flex items-center gap-1 h-8 px-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{locale === 'zh-TW' ? 'EN' : '繁中'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Light mode' : 'Dark mode'}
            title={darkMode ? 'Light mode' : 'Dark mode'}
            className="inline-flex items-center justify-center w-7 h-8 rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
