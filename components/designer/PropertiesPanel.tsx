'use client';

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  RetryConfig,
  SagaEdge,
  SagaGraph,
  SagaMachineMeta,
  SagaNode,
  SeataEdgeType,
} from '@/lib/saga/types';
import { Locale, UI_COPY } from '@/lib/saga/i18n';

interface PropertiesPanelProps {
  graph: SagaGraph;
  selectedNode: SagaNode | null;
  selectedEdge: SagaEdge | null;
  locale: Locale;
  onUpdateMeta: (patch: Partial<SagaMachineMeta>) => void;
  onUpdateNode: (nodeId: string, patch: Partial<SagaNode>) => void;
  onRenameNode: (nodeId: string, newName: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onUpdateEdge: (edgeId: string, patch: Partial<SagaEdge>) => void;
  onDeleteEdge: (edgeId: string) => void;
  onSetCompensateState: (sourceNodeId: string, targetNodeId: string) => void;
}

const inputCls =
  'w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono';

const labelCls =
  'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1';

export default function PropertiesPanel({
  graph,
  selectedNode,
  selectedEdge,
  locale,
  onUpdateMeta,
  onUpdateNode,
  onRenameNode,
  onDeleteNode,
  onUpdateEdge,
  onDeleteEdge,
  onSetCompensateState,
}: PropertiesPanelProps) {
  const t = UI_COPY[locale];
  const [nameEdit, setNameEdit] = useState<{
    nodeId: string;
    value: string;
  } | null>(null);

  const nameDraft =
    selectedNode && nameEdit?.nodeId === selectedNode.id
      ? nameEdit.value
      : selectedNode?.name ?? '';

  const commitRename = () => {
    if (!selectedNode) return;
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== selectedNode.name) {
      onRenameNode(selectedNode.id, trimmed);
    }
    setNameEdit(null);
  };

  // Edge Properties Inspector
  if (selectedEdge) {
    return (
      <aside
        aria-label={t.propertiesEdge}
        className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-y-auto"
      >
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t.propertiesEdge}
          </h2>
          <button
            type="button"
            onClick={() => onDeleteEdge(selectedEdge.id)}
            aria-label={t.deleteSelected}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{locale === 'zh-TW' ? '刪除' : 'Delete'}</span>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">
            {selectedEdge.source} → {selectedEdge.target}
          </div>

          <div>
            <label htmlFor="edge-type-select" className={labelCls}>
              {locale === 'zh-TW' ? '連線語意類型' : 'Transition Type'}
            </label>
            <select
              id="edge-type-select"
              value={selectedEdge.type}
              onChange={(e) =>
                onUpdateEdge(selectedEdge.id, {
                  type: e.target.value as SeataEdgeType,
                  isDefault: e.target.value === 'Default',
                })
              }
              className={inputCls}
            >
              <option value="Transition">Transition (Next)</option>
              <option value="Choice">Choice (Conditional)</option>
              <option value="Default">Default (Choice Fallback)</option>
              <option value="Catch">Catch (Exception Handler)</option>
              <option value="Compensation">Compensation (CompensateState)</option>
            </select>
          </div>

          {selectedEdge.type === 'Choice' && (
            <div>
              <label htmlFor="edge-expression" className={labelCls}>
                Expression (SpEL / Seata)
              </label>
              <input
                id="edge-expression"
                type="text"
                value={selectedEdge.expression ?? ''}
                onChange={(e) =>
                  onUpdateEdge(selectedEdge.id, { expression: e.target.value })
                }
                placeholder="[reduceInventoryResult] == true"
                className={inputCls}
              />
            </div>
          )}

          {selectedEdge.type === 'Catch' && (
            <div>
              <label htmlFor="edge-exceptions" className={labelCls}>
                Exceptions (one per line)
              </label>
              <textarea
                id="edge-exceptions"
                rows={4}
                value={(selectedEdge.exceptions ?? ['java.lang.Throwable']).join('\n')}
                onChange={(e) =>
                  onUpdateEdge(selectedEdge.id, {
                    exceptions: e.target.value
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className={inputCls}
              />
            </div>
          )}
        </div>
      </aside>
    );
  }

  // State Node Properties Inspector
  if (selectedNode) {
    const currentCompEdge = graph.edges.find(
      (e) => e.source === selectedNode.id && e.type === 'Compensation'
    );
    const compensableCandidates = graph.nodes.filter(
      (n) =>
        n.id !== selectedNode.id &&
        (n.type === 'ServiceTask' ||
          n.type === 'ScriptTask' ||
          n.type === 'SubStateMachine')
    );

    const statusRows = selectedNode.statusMap ?? [];
    const retryRows = selectedNode.retry ?? [];

    return (
      <aside
        aria-label={t.propertiesNode}
        className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-y-auto"
      >
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {selectedNode.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {selectedNode.type}
            </p>
          </div>
          {selectedNode.type !== 'StartState' && (
            <button
              type="button"
              onClick={() => onDeleteNode(selectedNode.id)}
              aria-label={`Delete ${selectedNode.name}`}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{locale === 'zh-TW' ? '刪除' : 'Delete'}</span>
            </button>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* State Name */}
          {selectedNode.type !== 'StartState' && (
            <div>
              <label htmlFor="node-name-input" className={labelCls}>
                State Name
              </label>
              <input
                id="node-name-input"
                type="text"
                value={nameDraft}
                onChange={(e) =>
                  setNameEdit({
                    nodeId: selectedNode.id,
                    value: e.target.value,
                  })
                }
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                }}
                className={inputCls}
              />
            </div>
          )}

          {/* Comment */}
          {selectedNode.type !== 'StartState' && (
            <div>
              <label htmlFor="node-comment-input" className={labelCls}>
                Comment
              </label>
              <input
                id="node-comment-input"
                type="text"
                value={selectedNode.comment ?? ''}
                onChange={(e) =>
                  onUpdateNode(selectedNode.id, { comment: e.target.value })
                }
                placeholder={
                  locale === 'zh-TW' ? '節點用途說明' : 'State description'
                }
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          )}

          {/* ServiceTask Fields */}
          {selectedNode.type === 'ServiceTask' && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label htmlFor="service-type-select" className={labelCls}>
                  ServiceType
                </label>
                <select
                  id="service-type-select"
                  value={selectedNode.serviceType || 'SpringBean'}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, { serviceType: e.target.value })
                  }
                  className={inputCls}
                >
                  <option value="SpringBean">SpringBean</option>
                  <option value="Dubbo">Dubbo</option>
                  <option value="Hessian">Hessian</option>
                  <option value="HTTP">HTTP</option>
                </select>
              </div>

              <div>
                <label htmlFor="service-name-input" className={labelCls}>
                  ServiceName
                </label>
                <input
                  id="service-name-input"
                  type="text"
                  value={selectedNode.serviceName ?? ''}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, { serviceName: e.target.value })
                  }
                  placeholder="inventoryAction"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="service-method-input" className={labelCls}>
                  ServiceMethod
                </label>
                <input
                  id="service-method-input"
                  type="text"
                  value={selectedNode.serviceMethod ?? ''}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, {
                      serviceMethod: e.target.value,
                    })
                  }
                  placeholder="reduce"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="param-types-input" className={labelCls}>
                  ParameterTypes (comma-separated)
                </label>
                <input
                  id="param-types-input"
                  type="text"
                  value={(selectedNode.parameterTypes ?? []).join(', ')}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, {
                      parameterTypes: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="java.lang.String, java.math.BigDecimal"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="compensate-state-select" className={labelCls}>
                  CompensateState
                </label>
                <select
                  id="compensate-state-select"
                  value={currentCompEdge?.target ?? ''}
                  onChange={(e) =>
                    onSetCompensateState(selectedNode.id, e.target.value)
                  }
                  className={inputCls}
                >
                  <option value="">
                    {locale === 'zh-TW' ? '（無補償任務）' : '(None)'}
                  </option>
                  {compensableCandidates.map((cand) => (
                    <option key={cand.id} value={cand.id}>
                      {cand.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedNode.isForCompensation)}
                    onChange={(e) =>
                      onUpdateNode(selectedNode.id, {
                        isForCompensation: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span>IsForCompensation</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedNode.isAsync)}
                    onChange={(e) =>
                      onUpdateNode(selectedNode.id, { isAsync: e.target.checked })
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span>IsAsync</span>
                </label>
              </div>
            </div>
          )}

          {/* ScriptTask Fields */}
          {selectedNode.type === 'ScriptTask' && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label htmlFor="script-type-select" className={labelCls}>
                  ScriptType
                </label>
                <select
                  id="script-type-select"
                  value={selectedNode.scriptType || 'groovy'}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, { scriptType: e.target.value })
                  }
                  className={inputCls}
                >
                  <option value="groovy">groovy</option>
                  <option value="javascript">javascript</option>
                  <option value="spel">spel</option>
                </select>
              </div>
              <div>
                <label htmlFor="script-content-input" className={labelCls}>
                  ScriptContent
                </label>
                <textarea
                  id="script-content-input"
                  rows={4}
                  value={selectedNode.scriptContent ?? ''}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, {
                      scriptContent: e.target.value,
                    })
                  }
                  placeholder="return [ok: true]"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* SubStateMachine Fields */}
          {selectedNode.type === 'SubStateMachine' && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label htmlFor="sub-machine-name" className={labelCls}>
                  StateMachineName
                </label>
                <input
                  id="sub-machine-name"
                  type="text"
                  value={selectedNode.stateMachineName ?? ''}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, {
                      stateMachineName: e.target.value,
                    })
                  }
                  placeholder="paymentSettlementSubSaga"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="sub-comp-select" className={labelCls}>
                  CompensateState
                </label>
                <select
                  id="sub-comp-select"
                  value={currentCompEdge?.target ?? ''}
                  onChange={(e) =>
                    onSetCompensateState(selectedNode.id, e.target.value)
                  }
                  className={inputCls}
                >
                  <option value="">
                    {locale === 'zh-TW' ? '（無補償任務）' : '(None)'}
                  </option>
                  {compensableCandidates.map((cand) => (
                    <option key={cand.id} value={cand.id}>
                      {cand.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Fail Fields */}
          {selectedNode.type === 'Fail' && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label htmlFor="fail-error-code" className={labelCls}>
                  ErrorCode
                </label>
                <input
                  id="fail-error-code"
                  type="text"
                  value={selectedNode.errorCode ?? ''}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, { errorCode: e.target.value })
                  }
                  placeholder="PURCHASE_FAILED"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="fail-message" className={labelCls}>
                  Message
                </label>
                <textarea
                  id="fail-message"
                  rows={2}
                  value={selectedNode.message ?? ''}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, { message: e.target.value })
                  }
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* Input & Output JSON for executable tasks */}
          {(selectedNode.type === 'ServiceTask' ||
            selectedNode.type === 'ScriptTask' ||
            selectedNode.type === 'SubStateMachine') && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label htmlFor="node-input-json" className={labelCls}>
                  Input (JSON Array)
                </label>
                <textarea
                  id="node-input-json"
                  rows={3}
                  value={selectedNode.inputJson ?? ''}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, { inputJson: e.target.value })
                  }
                  placeholder='["$.[businessKey]"]'
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="node-output-json" className={labelCls}>
                  Output (JSON Object)
                </label>
                <textarea
                  id="node-output-json"
                  rows={3}
                  value={selectedNode.outputJson ?? ''}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, { outputJson: e.target.value })
                  }
                  placeholder='{ "result": "$.#root" }'
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* Status Mapping for ServiceTask / SubStateMachine */}
          {(selectedNode.type === 'ServiceTask' ||
            selectedNode.type === 'SubStateMachine') && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Status Mapping
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateNode(selectedNode.id, {
                      statusMap: [
                        ...statusRows,
                        { key: '#root == true', value: 'SU' },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{locale === 'zh-TW' ? '新增' : 'Add'}</span>
                </button>
              </div>
              {statusRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    aria-label={`Status expression ${idx + 1}`}
                    value={row.key}
                    onChange={(e) => {
                      const next = [...statusRows];
                      next[idx] = { ...row, key: e.target.value };
                      onUpdateNode(selectedNode.id, { statusMap: next });
                    }}
                    className={`${inputCls} flex-1`}
                  />
                  <select
                    aria-label={`Status code ${idx + 1}`}
                    value={row.value}
                    onChange={(e) => {
                      const next = [...statusRows];
                      next[idx] = {
                        ...row,
                        value: e.target.value as 'SU' | 'FA' | 'UN',
                      };
                      onUpdateNode(selectedNode.id, { statusMap: next });
                    }}
                    className="px-1.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md"
                  >
                    <option value="SU">SU</option>
                    <option value="FA">FA</option>
                    <option value="UN">UN</option>
                  </select>
                  <button
                    type="button"
                    aria-label={`Remove status row ${idx + 1}`}
                    onClick={() =>
                      onUpdateNode(selectedNode.id, {
                        statusMap: statusRows.filter((_, i) => i !== idx),
                      })
                    }
                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Retry Policy for ServiceTask / SubStateMachine */}
          {(selectedNode.type === 'ServiceTask' ||
            selectedNode.type === 'SubStateMachine') && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Retry Policies
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextRetry: RetryConfig = {
                      Exceptions: ['java.net.SocketTimeoutException'],
                      IntervalSeconds: 2,
                      MaxAttempts: 3,
                      BackoffRate: 1.5,
                    };
                    onUpdateNode(selectedNode.id, {
                      retry: [...retryRows, nextRetry],
                    });
                  }}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{locale === 'zh-TW' ? '新增重試' : 'Add Retry'}</span>
                </button>
              </div>
              {retryRows.map((policy, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-500">
                      Retry #{idx + 1}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove retry policy ${idx + 1}`}
                      onClick={() =>
                        onUpdateNode(selectedNode.id, {
                          retry: retryRows.filter((_, i) => i !== idx),
                        })
                      }
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    aria-label={`Retry exceptions ${idx + 1}`}
                    value={policy.Exceptions.join(', ')}
                    onChange={(e) => {
                      const next = [...retryRows];
                      next[idx] = {
                        ...policy,
                        Exceptions: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      };
                      onUpdateNode(selectedNode.id, { retry: next });
                    }}
                    className={inputCls}
                  />
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <span className="block text-[10px] text-slate-500 mb-0.5">
                        Interval(s)
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={policy.IntervalSeconds}
                        onChange={(e) => {
                          const next = [...retryRows];
                          next[idx] = {
                            ...policy,
                            IntervalSeconds: Number(e.target.value),
                          };
                          onUpdateNode(selectedNode.id, { retry: next });
                        }}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 mb-0.5">
                        MaxAttempts
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={policy.MaxAttempts}
                        onChange={(e) => {
                          const next = [...retryRows];
                          next[idx] = {
                            ...policy,
                            MaxAttempts: Number(e.target.value),
                          };
                          onUpdateNode(selectedNode.id, { retry: next });
                        }}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 mb-0.5">
                        Backoff
                      </span>
                      <input
                        type="number"
                        step={0.5}
                        min={1}
                        value={policy.BackoffRate}
                        onChange={(e) => {
                          const next = [...retryRows];
                          next[idx] = {
                            ...policy,
                            BackoffRate: Number(e.target.value),
                          };
                          onUpdateNode(selectedNode.id, { retry: next });
                        }}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Coordinates summary */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            x: {Math.round(selectedNode.x)} · y: {Math.round(selectedNode.y)} ·{' '}
            {selectedNode.width}×{selectedNode.height}
          </div>
        </div>
      </aside>
    );
  }

  // Global State Machine Properties (when nothing selected)
  return (
    <aside
      aria-label={t.propertiesMachine}
      className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-y-auto"
    >
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t.propertiesMachine}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {locale === 'zh-TW'
            ? '點選畫布上的任意節點或連線以檢視其屬性'
            : 'Select any state or transition on canvas to inspect'}
        </p>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label htmlFor="machine-name-input" className={labelCls}>
            Name
          </label>
          <input
            id="machine-name-input"
            type="text"
            value={graph.meta.name}
            onChange={(e) => onUpdateMeta({ name: e.target.value })}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="machine-version-input" className={labelCls}>
            Version
          </label>
          <input
            id="machine-version-input"
            type="text"
            value={graph.meta.version}
            onChange={(e) => onUpdateMeta({ version: e.target.value })}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="machine-comment-input" className={labelCls}>
            Comment
          </label>
          <textarea
            id="machine-comment-input"
            rows={3}
            value={graph.meta.comment}
            onChange={(e) => onUpdateMeta({ comment: e.target.value })}
            className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={graph.meta.persist}
              onChange={(e) => onUpdateMeta({ persist: e.target.checked })}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span>Persist (Transaction Log Persistence)</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={graph.meta.retryPersistModeUpdate}
              onChange={(e) =>
                onUpdateMeta({ retryPersistModeUpdate: e.target.checked })
              }
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span>RetryPersistModeUpdate</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={graph.meta.compensatePersistModeUpdate}
              onChange={(e) =>
                onUpdateMeta({ compensatePersistModeUpdate: e.target.checked })
              }
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span>CompensatePersistModeUpdate</span>
          </label>
        </div>
      </div>
    </aside>
  );
}
