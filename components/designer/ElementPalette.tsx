'use client';

import React from 'react';
import {
  MousePointer2,
  ArrowUpRight,
  RotateCcw,
  AlertOctagon,
  PlayCircle,
  Cpu,
  Code2,
  GitBranch,
  Layers,
  Undo2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { SeataStateType } from '@/lib/saga/types';
import { Locale, UI_COPY } from '@/lib/saga/i18n';

export type InteractionMode = 'select' | 'connect' | 'compensate' | 'catch';

interface ElementPaletteProps {
  mode: InteractionMode;
  onChangeMode: (mode: InteractionMode) => void;
  onAddNode: (type: SeataStateType) => void;
  locale: Locale;
}

interface PaletteItem {
  type: SeataStateType;
  label: string;
  subZh: string;
  subEn: string;
  accentClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'StartState',
    label: 'StartState',
    subZh: '起始事件',
    subEn: 'Entry point',
    accentClass: 'text-emerald-600 dark:text-emerald-400',
    icon: PlayCircle,
  },
  {
    type: 'ServiceTask',
    label: 'ServiceTask',
    subZh: '微服務任務',
    subEn: 'Service call',
    accentClass: 'text-blue-600 dark:text-blue-400',
    icon: Cpu,
  },
  {
    type: 'ScriptTask',
    label: 'ScriptTask',
    subZh: '內嵌腳本',
    subEn: 'Groovy / JS',
    accentClass: 'text-cyan-600 dark:text-cyan-400',
    icon: Code2,
  },
  {
    type: 'Choice',
    label: 'Choice',
    subZh: '條件閘道',
    subEn: 'Branch gateway',
    accentClass: 'text-amber-600 dark:text-amber-400',
    icon: GitBranch,
  },
  {
    type: 'SubStateMachine',
    label: 'SubStateMachine',
    subZh: '子狀態機',
    subEn: 'Nested Saga',
    accentClass: 'text-sky-600 dark:text-sky-400',
    icon: Layers,
  },
  {
    type: 'CompensationTrigger',
    label: 'CompensationTrigger',
    subZh: '觸發補償',
    subEn: 'Rollback stack',
    accentClass: 'text-indigo-600 dark:text-indigo-400',
    icon: Undo2,
  },
  {
    type: 'Succeed',
    label: 'Succeed',
    subZh: '成功終止',
    subEn: 'End success',
    accentClass: 'text-emerald-600 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  {
    type: 'Fail',
    label: 'Fail',
    subZh: '失敗終止',
    subEn: 'End error',
    accentClass: 'text-red-600 dark:text-red-400',
    icon: XCircle,
  },
];

export default function ElementPalette({
  mode,
  onChangeMode,
  onAddNode,
  locale,
}: ElementPaletteProps) {
  const t = UI_COPY[locale];

  const tools: Array<{
    id: InteractionMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'select', label: t.toolSelect, icon: MousePointer2 },
    { id: 'connect', label: t.toolConnect, icon: ArrowUpRight },
    { id: 'compensate', label: t.toolCompensate, icon: RotateCcw },
    { id: 'catch', label: t.toolCatch, icon: AlertOctagon },
  ];

  const handleDragStart = (
    e: React.DragEvent<HTMLButtonElement>,
    type: SeataStateType
  ) => {
    e.dataTransfer.setData('application/x-seata-state-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <aside
      aria-label={t.paletteTitle}
      className="w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-y-auto select-none"
    >
      {/* Tools Section */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-1">
          {t.toolsTitle}
        </h2>
        <div className="grid grid-cols-1 gap-1">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const active = mode === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onChangeMode(tool.id)}
                aria-pressed={active}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{tool.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* State Node Palette */}
      <div className="p-3 flex-1">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t.paletteTitle}
          </h2>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {locale === 'zh-TW' ? '點擊或拖曳' : 'Click / Drag'}
          </span>
        </div>

        <div className="space-y-1">
          {PALETTE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                type="button"
                draggable
                onDragStart={(e) => handleDragStart(e, item.type)}
                onClick={() => onAddNode(item.type)}
                aria-label={`Add ${item.label}`}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-grab active:cursor-grabbing text-left"
              >
                <Icon className={`w-4 h-4 shrink-0 ${item.accentClass}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate font-mono">
                    {item.label}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {locale === 'zh-TW' ? item.subZh : item.subEn}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
