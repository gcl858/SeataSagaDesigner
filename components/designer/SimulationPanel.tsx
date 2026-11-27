'use client';

import React from 'react';
import { Play, StepForward, RotateCcw, CheckCircle2, AlertTriangle, Undo2 } from 'lucide-react';
import {
  MockOutcome,
  NodeSimulationOverride,
  SagaGraph,
  SimulationResult,
} from '@/lib/saga/types';
import { Locale, UI_COPY } from '@/lib/saga/i18n';

interface SimulationPanelProps {
  graph: SagaGraph;
  inputContextText: string;
  inputContextError: string | null;
  overrides: Record<string, NodeSimulationOverride>;
  result: SimulationResult | null;
  activeStepIndex: number | null;
  locale: Locale;
  onChangeInputContext: (text: string) => void;
  onChangeOverride: (nodeId: string, outcome: MockOutcome) => void;
  onRunAll: () => void;
  onStepNext: () => void;
  onReset: () => void;
  onSelectStep: (idx: number) => void;
}

export default function SimulationPanel({
  graph,
  inputContextText,
  inputContextError,
  overrides,
  result,
  activeStepIndex,
  locale,
  onChangeInputContext,
  onChangeOverride,
  onRunAll,
  onStepNext,
  onReset,
  onSelectStep,
}: SimulationPanelProps) {
  const t = UI_COPY[locale];

  const controllableTasks = graph.nodes.filter(
    (n) =>
      (n.type === 'ServiceTask' ||
        n.type === 'SubStateMachine' ||
        n.type === 'ScriptTask') &&
      !n.isForCompensation
  );

  const visibleSteps = result
    ? activeStepIndex !== null
      ? result.steps.slice(0, activeStepIndex + 1)
      : result.steps
    : [];

  return (
    <aside
      aria-label={t.simulationTitle}
      className="w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-hidden"
    >
      {/* Header & Action Controls */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t.simulationTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {locale === 'zh-TW'
              ? '設定各任務回傳狀態，即時驗證正向流程、Catch 捕獲與 LIFO 補償鏈。'
              : 'Configure task outcomes to trace forward flow, Catch routing, and LIFO compensation.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRunAll}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{t.simulationRun}</span>
          </button>

          <button
            type="button"
            onClick={onStepNext}
            className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <StepForward className="w-3.5 h-3.5" />
            <span>{t.simulationStep}</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            aria-label={t.simulationReset}
            title={t.simulationReset}
            className="inline-flex items-center justify-center p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Initial Context Input */}
        <div>
          <label
            htmlFor="sim-context-input"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            {t.simulationInput}
          </label>
          <textarea
            id="sim-context-input"
            rows={4}
            spellCheck={false}
            value={inputContextText}
            onChange={(e) => onChangeInputContext(e.target.value)}
            className="w-full p-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          {inputContextError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-mono">
              {inputContextError}
            </p>
          )}
        </div>

        {/* Per-Task Outcome Overrides */}
        <div>
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {t.simulationOverrides}
          </h3>
          {controllableTasks.length === 0 ? (
            <p className="text-xs text-slate-500">
              {locale === 'zh-TW' ? '畫布尚無正向執行任務。' : 'No forward tasks on canvas.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              {controllableTasks.map((task) => {
                const outcome = overrides[task.id]?.outcome ?? 'SU';
                return (
                  <div
                    key={task.id}
                    className="px-3 py-2 flex items-center justify-between gap-2 bg-white dark:bg-slate-900"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold font-mono text-slate-800 dark:text-slate-100 truncate">
                        {task.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {task.type}
                      </div>
                    </div>
                    <select
                      aria-label={`Outcome for ${task.name}`}
                      value={outcome}
                      onChange={(e) =>
                        onChangeOverride(task.id, e.target.value as MockOutcome)
                      }
                      className="h-7 px-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="SU">SU (Success)</option>
                      <option value="FA">FA (Return false)</option>
                      <option value="EXCEPTION">Throw Exception</option>
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Execution Trace */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.simulationTrace}
            </h3>
            {result && (
              <span
                data-testid="sim-final-status"
                className={`text-xs font-semibold font-mono ${
                  result.finalStatus === 'SU'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : result.finalStatus === 'COMPENSATED'
                      ? 'text-indigo-700 dark:text-indigo-400'
                      : 'text-red-700 dark:text-red-400'
                }`}
              >
                {result.finalStatus === 'SU'
                  ? 'COMMITTED (SU)'
                  : result.finalStatus === 'COMPENSATED'
                    ? 'COMPENSATED'
                    : 'FAILED (FA)'}
              </span>
            )}
          </div>

          {!result ? (
            <div className="p-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 text-center">
              {locale === 'zh-TW'
                ? '點擊上方「執行完整模擬」或「單步前進」檢視 Saga 執行軌跡。'
                : 'Click "Run Simulation" or "Step Next" to inspect the Saga trace.'}
            </div>
          ) : (
            <ol
              data-testid="sim-trace-list"
              className="space-y-2"
            >
              {visibleSteps.map((step, idx) => {
                const isSelected = activeStepIndex === idx;
                return (
                  <li key={step.stepNumber}>
                    <button
                      type="button"
                      onClick={() => onSelectStep(idx)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600'
                          : 'bg-slate-50/70 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold font-mono text-slate-900 dark:text-slate-100">
                          {step.status === 'COMPENSATED' ? (
                            <Undo2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          ) : step.status === 'SU' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          )}
                          <span className="tabular-nums">{step.stepNumber}.</span>
                          <span>{step.nodeName}</span>
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {step.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {locale === 'zh-TW' ? step.detail : step.detailEn}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </aside>
  );
}
