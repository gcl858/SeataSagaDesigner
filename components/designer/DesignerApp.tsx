'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  MockOutcome,
  NODE_DIMENSIONS,
  NodeSimulationOverride,
  SagaEdge,
  SagaGraph,
  SagaMachineMeta,
  SagaNode,
  SeataEdgeType,
  SeataStateType,
  SimulationResult,
} from '@/lib/saga/types';
import { BUILTIN_SUB_MACHINES_JSON, SAGA_TEMPLATES } from '@/lib/saga/templates';
import {
  autoLayoutGraph,
  exportGraphToSvg,
  renameStateInGraph,
  serializeGraphToSeataJson,
  START_NODE_ID,
} from '@/lib/saga/serializer';
import {
  parseSeataSourceToGraph,
  renameStateInYamlTemplate,
  serializeGraphToSeataYaml,
} from '@/lib/saga/yaml';
import {
  commitActiveGraph,
  createWorkspaceFromTemplate,
  getActiveGraph,
  getActiveHistory,
  getActiveMachineName,
  getParentFrame,
  navigateToStackIndex,
  openSubStateMachine,
  redoActiveMachine,
  SubMachineWorkspaceState,
  undoActiveMachine,
  updateActiveGraphTransient,
} from '@/lib/saga/subMachines';
import { validateSagaGraph } from '@/lib/saga/validator';
import { runSagaSimulation } from '@/lib/saga/simulator';
import { Locale, UI_COPY } from '@/lib/saga/i18n';
import { SourceLocateTarget } from '@/lib/saga/sourceLocator';
import TopHeader, { WorkspaceView } from './TopHeader';
import WorkspaceToolbar from './WorkspaceToolbar';
import SubMachineBreadcrumb from './SubMachineBreadcrumb';
import ElementPalette, { InteractionMode } from './ElementPalette';
import SagaCanvas from './SagaCanvas';
import PropertiesPanel from './PropertiesPanel';
import JsonEditorPanel, { SourceFormat } from './JsonEditorPanel';
import SimulationPanel from './SimulationPanel';
import ValidationDrawer from './ValidationDrawer';

function generateUniqueStateName(
  nodes: SagaNode[],
  base: string
): string {
  const existing = new Set(nodes.map((n) => n.name));
  if (!existing.has(base)) return base;
  let counter = 1;
  while (existing.has(`${base}${counter}`)) {
    counter += 1;
  }
  return `${base}${counter}`;
}

function createDefaultNode(
  type: SeataStateType,
  nodes: SagaNode[],
  x: number,
  y: number,
  asCompensation = false
): SagaNode {
  const dim = NODE_DIMENSIONS[type];
  if (type === 'StartState') {
    return {
      id: START_NODE_ID,
      name: 'Start',
      type: 'StartState',
      x,
      y,
      width: dim.width,
      height: dim.height,
    };
  }

  const baseName = asCompensation
    ? 'CompensateTask'
    : type === 'ServiceTask'
      ? 'ServiceTask'
      : type === 'ScriptTask'
        ? 'ScriptTask'
        : type === 'Choice'
          ? 'ChoiceState'
          : type === 'SubStateMachine'
            ? 'SubMachine'
            : type === 'CompensationTrigger'
              ? 'CompensationTrigger'
              : type;

  const name = generateUniqueStateName(nodes, baseName);

  const node: SagaNode = {
    id: name,
    name,
    type,
    x,
    y,
    width: dim.width,
    height: dim.height,
  };

  if (type === 'ServiceTask') {
    node.serviceType = 'SpringBean';
    node.serviceName = asCompensation ? 'demoAction' : 'demoService';
    node.serviceMethod = asCompensation ? 'compensate' : 'execute';
    node.isForCompensation = asCompensation;
    node.inputJson = JSON.stringify(['$.[businessKey]'], null, 2);
    if (!asCompensation) {
      node.outputJson = JSON.stringify({ [`${name}Result`]: '$.#root' }, null, 2);
    }
  } else if (type === 'ScriptTask') {
    node.scriptType = 'groovy';
    node.scriptContent = 'return true';
    node.outputJson = JSON.stringify({ scriptResult: '$.#root' }, null, 2);
  } else if (type === 'SubStateMachine') {
    node.stateMachineName = 'subWorkflowSaga';
  } else if (type === 'Fail') {
    node.errorCode = 'SAGA_ERROR';
    node.message = 'State machine execution failed';
  }

  return node;
}

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DesignerApp() {
  const initialTemplate = SAGA_TEMPLATES[0];
  const [workspace, setWorkspace] = useState<SubMachineWorkspaceState>(() =>
    createWorkspaceFromTemplate(
      initialTemplate.json,
      initialTemplate.subMachines,
      BUILTIN_SUB_MACHINES_JSON
    )
  );
  const graph = getActiveGraph(workspace);
  const activeMachineName = getActiveMachineName(workspace);
  const { past, future } = getActiveHistory(workspace);
  const parentFrame = getParentFrame(workspace);

  const availableMachineNames = useMemo(
    () => new Set(Object.keys(workspace.registry)),
    [workspace.registry]
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialTemplate.id
  );
  const [activeView, setActiveView] = useState<WorkspaceView>('canvas');
  const [mode, setMode] = useState<InteractionMode>('select');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectionNonce, setSelectionNonce] = useState<number>(0);
  const [sourceFormat, setSourceFormat] = useState<SourceFormat>('json');
  const [includeLayoutInJson, setIncludeLayoutInJson] = useState<boolean>(true);
  const [paletteCollapsed, setPaletteCollapsed] = useState<boolean>(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState<boolean>(false);
  const [validationOpen, setValidationOpen] = useState<boolean>(false);
  const [locale, setLocale] = useState<Locale>('zh-TW');
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Simulation state
  const [simInputText, setSimInputText] = useState<string>(() =>
    JSON.stringify(initialTemplate.defaultInputContext, null, 2)
  );
  const [simInputError, setSimInputError] = useState<string | null>(null);
  const [simOverrides, setSimOverrides] = useState<
    Record<string, NodeSimulationOverride>
  >({});
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [activeSimStepIdx, setActiveSimStepIdx] = useState<number | null>(null);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  const showNotice = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((curr) => (curr === msg ? null : curr));
    }, 2800);
  }, []);

  const commitGraph = useCallback(
    (updater: (prev: SagaGraph) => SagaGraph) => {
      setWorkspace((prev) => commitActiveGraph(prev, updater));
      setSimResult(null);
      setActiveSimStepIdx(null);
    },
    []
  );

  const handleUndo = useCallback(() => {
    setWorkspace((prev) => undoActiveMachine(prev));
    setSimResult(null);
    setActiveSimStepIdx(null);
  }, []);

  const handleRedo = useCallback(() => {
    setWorkspace((prev) => redoActiveMachine(prev));
    setSimResult(null);
    setActiveSimStepIdx(null);
  }, []);

  const handleOpenSubStateMachine = useCallback(
    (nodeId: string) => {
      const result = openSubStateMachine(workspace, nodeId);
      if (!result.ok) {
        if (result.reason === 'cycle') {
          showNotice(
            locale === 'zh-TW'
              ? `偵測到循環參考：不可遞迴進入「${result.targetName}」。`
              : `Circular reference blocked: cannot recursively open "${result.targetName}".`
          );
        }
        return;
      }

      setWorkspace(result.workspace);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSimResult(null);
      setActiveSimStepIdx(null);
      setMode('select');

      showNotice(
        result.created
          ? locale === 'zh-TW'
            ? `已自動建立並進入子狀態機「${result.targetName}」`
            : `Created and opened sub-state machine "${result.targetName}"`
          : locale === 'zh-TW'
            ? `已進入子狀態機「${result.targetName}」`
            : `Opened sub-state machine "${result.targetName}"`
      );
    },
    [workspace, locale, showNotice]
  );

  const handleNavigateToStackIndex = useCallback(
    (targetIndex: number) => {
      const { workspace: nextWs, restoredNodeId } = navigateToStackIndex(
        workspace,
        targetIndex
      );
      if (nextWs === workspace) return;
      setWorkspace(nextWs);
      setSelectedNodeId(restoredNodeId);
      setSelectedEdgeId(null);
      if (restoredNodeId) {
        setSelectionNonce((n) => n + 1);
      }
      setSimResult(null);
      setActiveSimStepIdx(null);
      setMode('select');
    },
    [workspace]
  );

  const handleReturnToParent = useCallback(() => {
    if (workspace.navStack.length <= 1) return;
    handleNavigateToStackIndex(workspace.navStack.length - 2);
  }, [workspace.navStack.length, handleNavigateToStackIndex]);

  // Keyboard shortcuts (Undo / Redo / Escape / Alt+Left to return to parent)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isEditingInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.altKey && e.key === 'ArrowLeft') {
        if (workspace.navStack.length > 1) {
          e.preventDefault();
          handleReturnToParent();
        }
      } else if (e.key === 'Escape') {
        setMode('select');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, handleReturnToParent, workspace.navStack.length]);

  const validationIssues = useMemo(
    () => validateSagaGraph(graph, { availableMachineNames }),
    [graph, availableMachineNames]
  );
  const errorCount = useMemo(
    () => validationIssues.filter((i) => i.severity === 'error').length,
    [validationIssues]
  );
  const warningCount = useMemo(
    () => validationIssues.filter((i) => i.severity === 'warning').length,
    [validationIssues]
  );

  const serializedJsonText = useMemo(() => {
    const obj = serializeGraphToSeataJson(graph, {
      includeLayout: includeLayoutInJson,
    });
    return JSON.stringify(obj, null, 2);
  }, [graph, includeLayoutInJson]);

  const serializedYamlText = useMemo(() => {
    return serializeGraphToSeataYaml(graph, {
      includeLayout: includeLayoutInJson,
    });
  }, [graph, includeLayoutInJson]);

  const handleSelectTemplate = (templateId: string) => {
    const tpl = SAGA_TEMPLATES.find((item) => item.id === templateId);
    if (!tpl) return;
    setSelectedTemplateId(templateId);
    setWorkspace(
      createWorkspaceFromTemplate(
        tpl.json,
        tpl.subMachines,
        BUILTIN_SUB_MACHINES_JSON
      )
    );
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSimInputText(JSON.stringify(tpl.defaultInputContext, null, 2));
    setSimOverrides({});
    setSimResult(null);
    setActiveSimStepIdx(null);
  };

  const handleAddNode = useCallback(
    (type: SeataStateType, x?: number, y?: number) => {
      if (type === 'StartState' && graph.nodes.some((n) => n.type === 'StartState')) {
        showNotice(
          locale === 'zh-TW'
            ? '畫布上已存在 StartState 起始節點。'
            : 'A StartState node already exists on the canvas.'
        );
        return;
      }

      const posX = x ?? 180 + ((graph.nodes.length * 40) % 440);
      const posY = y ?? 100 + ((graph.nodes.length * 30) % 260);
      const newNode = createDefaultNode(type, graph.nodes, posX, posY);

      commitGraph((prev) => ({
        ...prev,
        nodes: [...prev.nodes, newNode],
      }));
      setSelectedNodeId(newNode.id);
      setSelectedEdgeId(null);
      setSelectedTemplateId('custom');
    },
    [graph.nodes, commitGraph, locale, showNotice]
  );

  const handleMoveNode = useCallback(
    (nodeId: string, x: number, y: number, commit: boolean) => {
      if (commit) {
        commitGraph((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
        }));
      } else {
        setWorkspace((prev) =>
          updateActiveGraphTransient(prev, (g) => ({
            ...g,
            nodes: g.nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
          }))
        );
      }
    },
    [commitGraph]
  );

  const handleConnectNodes = useCallback(
    (sourceId: string, targetId: string, forcedType?: SeataEdgeType) => {
      if (sourceId === targetId) return;
      commitGraph((prev) => {
        const src = prev.nodes.find((n) => n.id === sourceId);
        const tgt = prev.nodes.find((n) => n.id === targetId);
        if (!src || !tgt) return prev;
        if (tgt.type === 'StartState') return prev;

        let edgeType: SeataEdgeType = forcedType ?? 'Transition';
        if (!forcedType && src.type === 'Choice') {
          edgeType = 'Choice';
        }

        // Prevent exact duplicate edge
        if (
          prev.edges.some(
            (e) =>
              e.source === sourceId &&
              e.target === targetId &&
              e.type === edgeType
          )
        ) {
          return prev;
        }

        let nextEdges = [...prev.edges];
        // Transition / Compensation / Default are single-target per source
        if (
          edgeType === 'Transition' ||
          edgeType === 'Compensation' ||
          edgeType === 'Default'
        ) {
          nextEdges = nextEdges.filter(
            (e) => !(e.source === sourceId && e.type === edgeType)
          );
        }

        const newEdge: SagaEdge = {
          id: `edge_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          source: sourceId,
          target: targetId,
          type: edgeType,
          expression:
            edgeType === 'Choice' ? '[result] == true' : undefined,
          isDefault: edgeType === 'Default',
          exceptions:
            edgeType === 'Catch' ? ['java.lang.Throwable'] : undefined,
        };

        // Automatically flag compensation target as IsForCompensation
        const nextNodes =
          edgeType === 'Compensation'
            ? prev.nodes.map((n) =>
                n.id === targetId ? { ...n, isForCompensation: true } : n
              )
            : prev.nodes;

        return {
          ...prev,
          nodes: nextNodes,
          edges: [...nextEdges, newEdge],
        };
      });
      setSelectedTemplateId('custom');
    },
    [commitGraph]
  );

  const handleQuickAppendNode = useCallback(
    (sourceId: string, targetType: SeataStateType, asCompensation = false) => {
      commitGraph((prev) => {
        const src = prev.nodes.find((n) => n.id === sourceId);
        if (!src) return prev;
        const posX = asCompensation ? src.x : src.x + src.width + 84;
        const posY = asCompensation ? src.y + 148 : src.y;
        const newNode = createDefaultNode(
          targetType,
          prev.nodes,
          posX,
          posY,
          asCompensation
        );
        const edgeType: SeataEdgeType = asCompensation
          ? 'Compensation'
          : src.type === 'Choice'
            ? 'Choice'
            : 'Transition';

        let nextEdges = [...prev.edges];
        if (edgeType === 'Transition' || edgeType === 'Compensation') {
          nextEdges = nextEdges.filter(
            (e) => !(e.source === sourceId && e.type === edgeType)
          );
        }

        const newEdge: SagaEdge = {
          id: `edge_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          source: sourceId,
          target: newNode.id,
          type: edgeType,
          expression: edgeType === 'Choice' ? '[result] == true' : undefined,
        };

        setSelectedNodeId(newNode.id);
        setSelectedEdgeId(null);

        return {
          ...prev,
          nodes: [...prev.nodes, newNode],
          edges: [...nextEdges, newEdge],
        };
      });
      setSelectedTemplateId('custom');
    },
    [commitGraph]
  );

  const handleUpdateMeta = useCallback(
    (patch: Partial<SagaMachineMeta>) => {
      commitGraph((prev) => ({
        ...prev,
        meta: { ...prev.meta, ...patch },
      }));
    },
    [commitGraph]
  );

  const handleUpdateNode = useCallback(
    (nodeId: string, patch: Partial<SagaNode>) => {
      commitGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
      }));
    },
    [commitGraph]
  );

  const handleRenameNode = useCallback(
    (nodeId: string, newName: string) => {
      const trimmed = newName.trim();
      commitGraph((prev) => {
        const renamed = renameStateInGraph(prev, nodeId, trimmed);
        if (renamed === prev) return prev;
        return {
          ...renamed,
          yamlTemplate: renameStateInYamlTemplate(
            prev.yamlTemplate,
            nodeId,
            trimmed
          ),
        };
      });
      if (trimmed) setSelectedNodeId(trimmed);
    },
    [commitGraph]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      commitGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.filter((n) => n.id !== nodeId),
        edges: prev.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        ),
      }));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [commitGraph, selectedNodeId]
  );

  const handleUpdateEdge = useCallback(
    (edgeId: string, patch: Partial<SagaEdge>) => {
      commitGraph((prev) => ({
        ...prev,
        edges: prev.edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)),
      }));
    },
    [commitGraph]
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      commitGraph((prev) => ({
        ...prev,
        edges: prev.edges.filter((e) => e.id !== edgeId),
      }));
      if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
    },
    [commitGraph, selectedEdgeId]
  );

  const handleSetCompensateState = useCallback(
    (sourceNodeId: string, targetNodeId: string) => {
      commitGraph((prev) => {
        const filtered = prev.edges.filter(
          (e) => !(e.source === sourceNodeId && e.type === 'Compensation')
        );
        if (!targetNodeId) {
          return { ...prev, edges: filtered };
        }
        const newEdge: SagaEdge = {
          id: `edge_comp_${Date.now()}`,
          source: sourceNodeId,
          target: targetNodeId,
          type: 'Compensation',
        };
        return {
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === targetNodeId ? { ...n, isForCompensation: true } : n
          ),
          edges: [...filtered, newEdge],
        };
      });
    },
    [commitGraph]
  );

  const handleAutoLayout = useCallback(() => {
    commitGraph((prev) => autoLayoutGraph(prev));
    showNotice(
      locale === 'zh-TW' ? '已完成自動拓樸排版。' : 'Applied automatic layout.'
    );
  }, [commitGraph, locale, showNotice]);

  const handleApplySource = useCallback(
    (
      raw: string,
      hint?: SourceFormat
    ): { ok: boolean; error?: string; detectedFormat?: SourceFormat } => {
      try {
        const { graph: nextGraph, detectedFormat } = parseSeataSourceToGraph(
          raw,
          hint
        );
        commitGraph((prev) => ({
          ...nextGraph,
          yamlTemplate:
            detectedFormat === 'yaml'
              ? nextGraph.yamlTemplate
              : prev.yamlTemplate,
        }));
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setSelectedTemplateId('custom');
        showNotice(
          locale === 'zh-TW'
            ? `已成功同步 ${detectedFormat.toUpperCase()} 至視覺畫布。`
            : `Synced ${detectedFormat.toUpperCase()} to visual canvas.`
        );
        return { ok: true, detectedFormat };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Invalid syntax',
        };
      }
    },
    [commitGraph, locale, showNotice]
  );

  const handleImportFile = useCallback(
    (text: string, filename: string) => {
      const lower = filename.toLowerCase();
      const hint: SourceFormat | undefined =
        lower.endsWith('.yaml') || lower.endsWith('.yml')
          ? 'yaml'
          : lower.endsWith('.json')
            ? 'json'
            : undefined;
      const res = handleApplySource(text, hint);
      if (res.ok && res.detectedFormat) {
        setSourceFormat(res.detectedFormat);
      } else if (!res.ok) {
        showNotice(`Import failed: ${res.error}`);
      }
    },
    [handleApplySource, showNotice]
  );

  const handleExportJson = useCallback(() => {
    const filename = `${graph.meta.name || 'seata-saga-statemachine'}.json`;
    downloadBlob(filename, serializedJsonText, 'application/json');
    showNotice(
      locale === 'zh-TW' ? `已匯出 ${filename}` : `Exported ${filename}`
    );
  }, [graph.meta.name, serializedJsonText, locale, showNotice]);

  const handleExportYaml = useCallback(() => {
    const filename = `${graph.meta.name || 'seata-saga-statemachine'}.yaml`;
    downloadBlob(filename, serializedYamlText, 'application/x-yaml;charset=utf-8');
    showNotice(
      locale === 'zh-TW' ? `已匯出 ${filename}` : `Exported ${filename}`
    );
  }, [graph.meta.name, serializedYamlText, locale, showNotice]);

  const handleExportSvg = useCallback(() => {
    const svg = exportGraphToSvg(graph);
    const filename = `${graph.meta.name || 'seata-saga-statemachine'}.svg`;
    downloadBlob(filename, svg, 'image/svg+xml');
    showNotice(
      locale === 'zh-TW'
        ? `已匯出向量圖 ${filename}`
        : `Exported diagram ${filename}`
    );
  }, [graph, locale, showNotice]);

  // Simulation runners
  const parseSimContext = (): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(simInputText || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setSimInputError('Initial context must be a JSON object.');
        return null;
      }
      setSimInputError(null);
      return parsed as Record<string, unknown>;
    } catch (err) {
      setSimInputError(err instanceof Error ? err.message : 'Invalid JSON');
      return null;
    }
  };

  const handleRunSimulation = () => {
    const ctx = parseSimContext();
    if (!ctx) return;
    const res = runSagaSimulation(graph, ctx, simOverrides, {
      subMachineGraphs: workspace.registry,
    });
    setSimResult(res);
    setActiveSimStepIdx(res.steps.length - 1);
  };

  const handleStepSimulation = () => {
    if (!simResult) {
      const ctx = parseSimContext();
      if (!ctx) return;
      const res = runSagaSimulation(graph, ctx, simOverrides, {
        subMachineGraphs: workspace.registry,
      });
      setSimResult(res);
      setActiveSimStepIdx(0);
      return;
    }
    setActiveSimStepIdx((prev) => {
      const curr = prev ?? -1;
      return Math.min(simResult.steps.length - 1, curr + 1);
    });
  };

  const handleResetSimulation = () => {
    setSimResult(null);
    setActiveSimStepIdx(null);
  };

  const handleChangeOverride = (nodeId: string, outcome: MockOutcome) => {
    setSimOverrides((prev) => ({
      ...prev,
      [nodeId]: {
        outcome,
        exceptionClass:
          outcome === 'EXCEPTION' ? 'java.lang.RuntimeException' : undefined,
      },
    }));
  };

  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId]
  );

  const selectedEdge = useMemo(
    () => graph.edges.find((e) => e.id === selectedEdgeId) ?? null,
    [graph.edges, selectedEdgeId]
  );

  const sourceLocateTarget = useMemo<SourceLocateTarget | null>(() => {
    if (selectedNode) {
      return {
        kind: 'node',
        nodeId: selectedNode.id,
        nodeName: selectedNode.name,
      };
    }
    if (selectedEdge) {
      return {
        kind: 'edge',
        edgeId: selectedEdge.id,
        source: selectedEdge.source,
        target: selectedEdge.target,
        edgeType: selectedEdge.type,
        expression: selectedEdge.expression,
      };
    }
    return null;
  }, [selectedNode, selectedEdge]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <TopHeader
        activeView={activeView}
        onChangeView={(view) => {
          setActiveView(view);
          if (view !== 'simulate') {
            setSimResult(null);
            setActiveSimStepIdx(null);
          }
        }}
        onExportJson={handleExportJson}
        locale={locale}
      />

      <WorkspaceToolbar
        machineName={graph.meta.name}
        machineVersion={graph.meta.version}
        nodeCount={graph.nodes.filter((n) => n.type !== 'StartState').length}
        edgeCount={graph.edges.length}
        selectedTemplateId={selectedTemplateId}
        onSelectTemplate={handleSelectTemplate}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onAutoLayout={handleAutoLayout}
        onImportFile={handleImportFile}
        onExportYaml={handleExportYaml}
        onExportSvg={handleExportSvg}
        errorCount={errorCount}
        warningCount={warningCount}
        validationOpen={validationOpen}
        onToggleValidation={() => setValidationOpen((o) => !o)}
        locale={locale}
        onToggleLocale={() =>
          setLocale((prev) => (prev === 'zh-TW' ? 'en' : 'zh-TW'))
        }
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
      />

      <SubMachineBreadcrumb
        navStack={workspace.navStack}
        locale={locale}
        onNavigateToIndex={handleNavigateToStackIndex}
        onReturnToParent={handleReturnToParent}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Element Palette (visible in canvas, split, simulate) */}
        {activeView !== 'json' && (
          <ElementPalette
            mode={mode}
            collapsed={paletteCollapsed}
            onToggleCollapse={() => setPaletteCollapsed((prev) => !prev)}
            onChangeMode={setMode}
            onAddNode={(type) => handleAddNode(type)}
            locale={locale}
          />
        )}

        {/* Center Canvas (visible in canvas, split, simulate) */}
        {activeView !== 'json' && (
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <SagaCanvas
              graph={graph}
              activeMachineKey={`${workspace.navStack.length}:${activeMachineName}`}
              availableMachineNames={availableMachineNames}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              mode={mode}
              validationIssues={validationIssues}
              simulationResult={activeView === 'simulate' ? simResult : null}
              activeSimStepIndex={
                activeView === 'simulate' ? activeSimStepIdx : null
              }
              locale={locale}
              onSelectNode={(id) => {
                setSelectedNodeId(id);
                setSelectedEdgeId(null);
                if (id) setSelectionNonce((n) => n + 1);
              }}
              onSelectEdge={(id) => {
                setSelectedEdgeId(id);
                setSelectedNodeId(null);
                if (id) setSelectionNonce((n) => n + 1);
              }}
              onMoveNode={handleMoveNode}
              onDropNewNode={(type, x, y) => handleAddNode(type, x, y)}
              onConnectNodes={handleConnectNodes}
              onQuickAppendNode={handleQuickAppendNode}
              onDeleteNode={handleDeleteNode}
              onChangeMode={setMode}
              onOpenSubStateMachine={handleOpenSubStateMachine}
            />

            {validationOpen && (
              <ValidationDrawer
                issues={validationIssues}
                locale={locale}
                onFocusNode={(nodeId) => {
                  setSelectedNodeId(nodeId);
                  setSelectedEdgeId(null);
                }}
                onFocusEdge={(edgeId) => {
                  setSelectedEdgeId(edgeId);
                  setSelectedNodeId(null);
                }}
                onClose={() => setValidationOpen(false)}
              />
            )}
          </div>
        )}

        {/* Right Panel per active view (collapsible via left-edge handle) */}
        {activeView !== 'json' && (
          <div className="relative flex shrink-0 h-full z-20">
            <button
              type="button"
              onClick={() => setRightPanelCollapsed((prev) => !prev)}
              aria-controls="saga-right-panel"
              aria-expanded={!rightPanelCollapsed}
              aria-label={
                rightPanelCollapsed
                  ? UI_COPY[locale].expandRightPanel
                  : UI_COPY[locale].collapseRightPanel
              }
              title={
                rightPanelCollapsed
                  ? UI_COPY[locale].expandRightPanel
                  : UI_COPY[locale].collapseRightPanel
              }
              className="absolute top-1/2 right-full -translate-y-1/2 z-30 w-6 h-14 flex items-center justify-center rounded-l-lg bg-white dark:bg-slate-900 border border-r-0 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {rightPanelCollapsed ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            <div
              id="saga-right-panel"
              aria-hidden={rightPanelCollapsed}
              className={`h-full overflow-hidden flex transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                rightPanelCollapsed
                  ? 'w-0 pointer-events-none'
                  : activeView === 'canvas'
                    ? 'w-80'
                    : activeView === 'split'
                      ? 'w-[460px]'
                      : 'w-96'
              }`}
            >
              {activeView === 'canvas' && (
                <PropertiesPanel
                  graph={graph}
                  selectedNode={selectedNode}
                  selectedEdge={selectedEdge}
                  locale={locale}
                  machineRegistry={workspace.registry}
                  parentContext={parentFrame}
                  onUpdateMeta={handleUpdateMeta}
                  onUpdateNode={handleUpdateNode}
                  onRenameNode={handleRenameNode}
                  onDeleteNode={handleDeleteNode}
                  onUpdateEdge={handleUpdateEdge}
                  onDeleteEdge={handleDeleteEdge}
                  onSetCompensateState={handleSetCompensateState}
                  onOpenSubStateMachine={handleOpenSubStateMachine}
                  onReturnToParent={handleReturnToParent}
                />
              )}

              {activeView === 'split' && (
                <div className="w-[460px] shrink-0 h-full">
                  <JsonEditorPanel
                    format={sourceFormat}
                    onChangeFormat={setSourceFormat}
                    sourceText={
                      sourceFormat === 'yaml'
                        ? serializedYamlText
                        : serializedJsonText
                    }
                    includeLayout={includeLayoutInJson}
                    onToggleIncludeLayout={setIncludeLayoutInJson}
                    onApplySource={handleApplySource}
                    onExportCurrent={
                      sourceFormat === 'yaml'
                        ? handleExportYaml
                        : handleExportJson
                    }
                    locateTarget={sourceLocateTarget}
                    locateNonce={selectionNonce}
                    locale={locale}
                  />
                </div>
              )}

              {activeView === 'simulate' && (
                <SimulationPanel
                  graph={graph}
                  inputContextText={simInputText}
                  inputContextError={simInputError}
                  overrides={simOverrides}
                  result={simResult}
                  activeStepIndex={activeSimStepIdx}
                  locale={locale}
                  onChangeInputContext={setSimInputText}
                  onChangeOverride={handleChangeOverride}
                  onRunAll={handleRunSimulation}
                  onStepNext={handleStepSimulation}
                  onReset={handleResetSimulation}
                  onSelectStep={(idx) => setActiveSimStepIdx(idx)}
                />
              )}
            </div>
          </div>
        )}

        {activeView === 'json' && (
          <div className="flex-1 h-full">
            <JsonEditorPanel
              format={sourceFormat}
              onChangeFormat={setSourceFormat}
              sourceText={
                sourceFormat === 'yaml'
                  ? serializedYamlText
                  : serializedJsonText
              }
              includeLayout={includeLayoutInJson}
              onToggleIncludeLayout={setIncludeLayoutInJson}
              onApplySource={handleApplySource}
              onExportCurrent={
                sourceFormat === 'yaml' ? handleExportYaml : handleExportJson
              }
              locale={locale}
            />
          </div>
        )}

        {/* Transient subtle toast feedback */}
        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              role="status"
              className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium shadow-lg"
            >
              {statusMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
