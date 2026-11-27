'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Trash2,
  Plus,
  GitBranch,
  CheckCircle2,
  ArrowUpRight,
  Undo2,
  AlertOctagon,
  Cpu,
  Code2,
  Layers,
  XCircle,
  Play,
} from 'lucide-react';
import {
  SagaEdge,
  SagaGraph,
  SagaNode,
  SeataEdgeType,
  SeataStateType,
  SimulationResult,
  ValidationIssue,
} from '@/lib/saga/types';
import { InteractionMode } from './ElementPalette';
import { Locale, UI_COPY } from '@/lib/saga/i18n';

interface SagaCanvasProps {
  graph: SagaGraph;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  mode: InteractionMode;
  validationIssues: ValidationIssue[];
  simulationResult: SimulationResult | null;
  activeSimStepIndex: number | null;
  locale: Locale;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onMoveNode: (nodeId: string, x: number, y: number, commit: boolean) => void;
  onDropNewNode: (type: SeataStateType, x: number, y: number) => void;
  onConnectNodes: (sourceId: string, targetId: string, edgeType?: SeataEdgeType) => void;
  onQuickAppendNode: (sourceId: string, targetType: SeataStateType, asCompensation?: boolean) => void;
  onDeleteNode: (nodeId: string) => void;
  onChangeMode: (mode: InteractionMode) => void;
}

interface Point {
  x: number;
  y: number;
}

function getNodeCenter(node: SagaNode): Point {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

function getBoundaryPoint(node: SagaNode, toward: Point): Point {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;

  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  if (
    node.type === 'StartState' ||
    node.type === 'Succeed' ||
    node.type === 'Fail' ||
    node.type === 'CompensationTrigger'
  ) {
    const r = Math.min(node.width, node.height) / 2 + 2;
    const len = Math.hypot(dx, dy);
    return { x: cx + (dx / len) * r, y: cy + (dy / len) * r };
  }

  if (node.type === 'Choice') {
    const rx = node.width / 2 + 2;
    const ry = node.height / 2 + 2;
    const scale = 1 / (Math.abs(dx) / rx + Math.abs(dy) / ry);
    return { x: cx + dx * scale, y: cy + dy * scale };
  }

  const hw = node.width / 2 + 2;
  const hh = node.height / 2 + 2;
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const scale = Math.min(sx, sy);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

function buildEdgePath(
  source: SagaNode,
  target: SagaNode,
  edge: SagaEdge,
  siblingIndex: number,
  siblingTotal: number
): { path: string; labelPos: Point; start: Point; end: Point } {
  const srcCenter = getNodeCenter(source);
  const tgtCenter = getNodeCenter(target);

  // Offset Catch edges slightly from bottom-right of source task
  let start: Point;
  if (edge.type === 'Catch') {
    start = { x: source.x + source.width * 0.72, y: source.y + source.height + 2 };
  } else if (edge.type === 'Compensation') {
    start = { x: source.x + source.width * 0.5, y: source.y + source.height + 2 };
  } else {
    start = getBoundaryPoint(source, tgtCenter);
  }

  const end = getBoundaryPoint(target, start);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy) || 1;

  // Compute gentle curve offset for parallel edges or Catch/Compensation clarity
  let curveOffset = 0;
  if (siblingTotal > 1) {
    curveOffset = (siblingIndex - (siblingTotal - 1) / 2) * 34;
  } else if (edge.type === 'Catch') {
    curveOffset = 22;
  }

  const nx = -dy / dist;
  const ny = dx / dist;
  const midX = (start.x + end.x) / 2 + nx * curveOffset;
  const midY = (start.y + end.y) / 2 + ny * curveOffset;

  const path =
    Math.abs(curveOffset) < 1
      ? `M ${start.x} ${start.y} L ${end.x} ${end.y}`
      : `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;

  const labelPos = {
    x: 0.25 * start.x + 0.5 * midX + 0.25 * end.x,
    y:
      0.25 * start.y +
      0.5 * midY +
      0.25 * end.y -
      (edge.type === 'Choice' ? 18 : 10),
  };

  return { path, labelPos, start, end };
}

export default function SagaCanvas({
  graph,
  selectedNodeId,
  selectedEdgeId,
  mode,
  validationIssues,
  simulationResult,
  activeSimStepIndex,
  locale,
  onSelectNode,
  onSelectEdge,
  onMoveNode,
  onDropNewNode,
  onConnectNodes,
  onQuickAppendNode,
  onDeleteNode,
  onChangeMode,
}: SagaCanvasProps) {
  const t = UI_COPY[locale];
  const containerRef = useRef<HTMLDivElement>(null);

  const [pan, setPan] = useState<Point>({ x: 32, y: 24 });
  const [zoom, setZoom] = useState<number>(1);

  const [draggingNode, setDraggingNode] = useState<{
    id: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  const [panning, setPanning] = useState<{
    startClientX: number;
    startClientY: number;
    origPanX: number;
    origPanY: number;
  } | null>(null);

  const [connectingFrom, setConnectingFrom] = useState<{
    sourceId: string;
    edgeType?: SeataEdgeType;
    cursor: Point;
  } | null>(null);

  const nodeMap = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n])),
    [graph.nodes]
  );

  const nodeIssueSeverity = useMemo(() => {
    const map = new Map<string, 'error' | 'warning'>();
    validationIssues.forEach((issue) => {
      if (!issue.nodeId) return;
      const existing = map.get(issue.nodeId);
      if (issue.severity === 'error' || !existing) {
        map.set(issue.nodeId, issue.severity);
      }
    });
    return map;
  }, [validationIssues]);

  const nodesWithCatch = useMemo(() => {
    const set = new Set<string>();
    graph.edges.forEach((e) => {
      if (e.type === 'Catch') set.add(e.source);
    });
    return set;
  }, [graph.edges]);

  // Simulation highlights up to activeSimStepIndex
  const simHighlights = useMemo(() => {
    if (!simulationResult) {
      return {
        visitedNodes: new Set<string>(),
        visitedEdges: new Set<string>(),
        compensatedNodes: new Set<string>(),
        activeNodeId: null as string | null,
      };
    }
    const maxIdx =
      activeSimStepIndex !== null
        ? Math.min(activeSimStepIndex, simulationResult.steps.length - 1)
        : simulationResult.steps.length - 1;
    const sliced = simulationResult.steps.slice(0, maxIdx + 1);
    const visitedNodes = new Set<string>();
    const visitedEdges = new Set<string>();
    const compensatedNodes = new Set<string>();
    sliced.forEach((step) => {
      visitedNodes.add(step.nodeId);
      if (step.edgeId) visitedEdges.add(step.edgeId);
      if (step.status === 'COMPENSATED') compensatedNodes.add(step.nodeId);
    });
    const activeNodeId =
      sliced.length > 0 ? sliced[sliced.length - 1].nodeId : null;
    return { visitedNodes, visitedEdges, compensatedNodes, activeNodeId };
  }, [simulationResult, activeSimStepIndex]);

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  const handleFitView = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || graph.nodes.length === 0) return;
    const minX = Math.min(...graph.nodes.map((n) => n.x));
    const minY = Math.min(...graph.nodes.map((n) => n.y));
    const maxX = Math.max(...graph.nodes.map((n) => n.x + n.width));
    const maxY = Math.max(...graph.nodes.map((n) => n.y + n.height));
    const contentW = Math.max(200, maxX - minX + 100);
    const contentH = Math.max(200, maxY - minY + 110);
    const nextZoom = Math.min(
      1.05,
      Math.max(0.45, Math.min(rect.width / contentW, rect.height / contentH))
    );
    const nextPanX = (rect.width - (maxX - minX) * nextZoom) / 2 - minX * nextZoom;
    const nextPanY = (rect.height - (maxY - minY) * nextZoom) / 2 - minY * nextZoom;
    setZoom(Number(nextZoom.toFixed(2)));
    setPan({ x: Math.round(nextPanX), y: Math.round(nextPanY) });
  }, [graph.nodes]);

  const didAutoFitRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${graph.meta.name}:${graph.meta.version}`;
    if (didAutoFitRef.current !== key) {
      didAutoFitRef.current = key;
      const timer = requestAnimationFrame(() => {
        handleFitView();
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [graph.meta.name, graph.meta.version, handleFitView]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setZoom((prev) => Math.min(2, Math.max(0.4, Number((prev + delta).toFixed(2)))));
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX * 0.6,
        y: prev.y - e.deltaY * 0.6,
      }));
    }
  };

  useEffect(() => {
    if (!draggingNode && !panning && !connectingFrom) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (draggingNode) {
        const dx = (e.clientX - draggingNode.startClientX) / zoom;
        const dy = (e.clientY - draggingNode.startClientY) / zoom;
        if (!draggingNode.moved && Math.hypot(dx, dy) > 3) {
          setDraggingNode((prev) => (prev ? { ...prev, moved: true } : null));
        }
        const snappedX = Math.round((draggingNode.origX + dx) / 10) * 10;
        const snappedY = Math.round((draggingNode.origY + dy) / 10) * 10;
        onMoveNode(draggingNode.id, snappedX, snappedY, false);
      } else if (panning) {
        setPan({
          x: panning.origPanX + (e.clientX - panning.startClientX),
          y: panning.origPanY + (e.clientY - panning.startClientY),
        });
      } else if (connectingFrom) {
        const pt = screenToCanvas(e.clientX, e.clientY);
        setConnectingFrom((prev) => (prev ? { ...prev, cursor: pt } : null));
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (draggingNode) {
        if (draggingNode.moved) {
          const dx = (e.clientX - draggingNode.startClientX) / zoom;
          const dy = (e.clientY - draggingNode.startClientY) / zoom;
          const snappedX = Math.round((draggingNode.origX + dx) / 10) * 10;
          const snappedY = Math.round((draggingNode.origY + dy) / 10) * 10;
          onMoveNode(draggingNode.id, snappedX, snappedY, true);
        }
        setDraggingNode(null);
      }
      if (panning) {
        setPanning(null);
      }
      if (connectingFrom) {
        // Check if released over a node
        const pt = screenToCanvas(e.clientX, e.clientY);
        const hit = graph.nodes.find(
          (n) =>
            n.id !== connectingFrom.sourceId &&
            pt.x >= n.x - 10 &&
            pt.x <= n.x + n.width + 10 &&
            pt.y >= n.y - 10 &&
            pt.y <= n.y + n.height + 10
        );
        if (hit) {
          onConnectNodes(connectingFrom.sourceId, hit.id, connectingFrom.edgeType);
          onChangeMode('select');
        }
        setConnectingFrom(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    draggingNode,
    panning,
    connectingFrom,
    zoom,
    graph.nodes,
    onMoveNode,
    onConnectNodes,
    onChangeMode,
    screenToCanvas,
  ]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasBg === 'true') {
      onSelectNode(null);
      onSelectEdge(null);
      setConnectingFrom(null);
      setPanning({
        startClientX: e.clientX,
        startClientY: e.clientY,
        origPanX: pan.x,
        origPanY: pan.y,
      });
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const stateType = e.dataTransfer.getData(
      'application/x-seata-state-type'
    ) as SeataStateType;
    if (!stateType) return;
    const pt = screenToCanvas(e.clientX, e.clientY);
    onDropNewNode(stateType, Math.round(pt.x / 10) * 10, Math.round(pt.y / 10) * 10);
  };

  const handleNodeMouseDown = (
    e: React.MouseEvent,
    node: SagaNode
  ) => {
    e.stopPropagation();

    if (mode !== 'select') {
      const edgeType: SeataEdgeType | undefined =
        mode === 'compensate'
          ? 'Compensation'
          : mode === 'catch'
            ? 'Catch'
            : undefined;
      if (!connectingFrom) {
        setConnectingFrom({
          sourceId: node.id,
          edgeType,
          cursor: getNodeCenter(node),
        });
      } else if (connectingFrom.sourceId !== node.id) {
        onConnectNodes(connectingFrom.sourceId, node.id, edgeType);
        setConnectingFrom(null);
        onChangeMode('select');
      }
      return;
    }

    onSelectNode(node.id);
    setDraggingNode({
      id: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: node.x,
      origY: node.y,
      moved: false,
    });
  };

  const startPortConnection = (
    e: React.MouseEvent,
    node: SagaNode,
    edgeType?: SeataEdgeType
  ) => {
    e.stopPropagation();
    const pt = screenToCanvas(e.clientX, e.clientY);
    setConnectingFrom({
      sourceId: node.id,
      edgeType,
      cursor: pt,
    });
  };

  // Group parallel edges between same node pairs for curved separation
  const siblingGroups = useMemo(() => {
    const counts = new Map<string, number>();
    const indices = new Map<string, number>();
    graph.edges.forEach((e) => {
      const key = [e.source, e.target].sort().join('::');
      const idx = counts.get(key) ?? 0;
      indices.set(e.id, idx);
      counts.set(key, idx + 1);
    });
    return { counts, indices };
  }, [graph.edges]);

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) ?? null : null;

  const renderNodeIcon = (node: SagaNode) => {
    switch (node.type) {
      case 'StartState':
        return <Play className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-current" />;
      case 'ServiceTask':
        return (
          <Cpu
            className={`w-3.5 h-3.5 shrink-0 ${
              node.isForCompensation
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-blue-600 dark:text-blue-400'
            }`}
          />
        );
      case 'ScriptTask':
        return <Code2 className="w-3.5 h-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" />;
      case 'SubStateMachine':
        return <Layers className="w-3.5 h-3.5 shrink-0 text-sky-600 dark:text-sky-400" />;
      case 'CompensationTrigger':
        return <Undo2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'Succeed':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'Fail':
        return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      default:
        return <GitBranch className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="saga-canvas"
      onMouseDown={handleCanvasMouseDown}
      onWheel={handleWheel}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`relative flex-1 h-full overflow-hidden saga-canvas-grid bg-slate-50 dark:bg-slate-950 select-none ${
        panning
          ? 'cursor-grabbing'
          : mode !== 'select'
            ? 'cursor-crosshair'
            : 'cursor-default'
      }`}
    >
      {/* Active connection mode banner */}
      {mode !== 'select' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium shadow-md flex items-center gap-3">
          <span>
            {mode === 'connect' &&
              (locale === 'zh-TW'
                ? '連線模式：點選或拖曳來源節點至目標節點'
                : 'Connect mode: click or drag from source to target state')}
            {mode === 'compensate' &&
              (locale === 'zh-TW'
                ? '補償綁定模式：從正向任務連線至補償任務'
                : 'Compensation mode: link a forward task to its CompensateState')}
            {mode === 'catch' &&
              (locale === 'zh-TW'
                ? '例外捕獲模式：從任務連線至異常處理節點 (Catch)'
                : 'Catch mode: link a task to its exception handler state')}
          </span>
          <button
            type="button"
            onClick={() => {
              setConnectingFrom(null);
              onChangeMode('select');
            }}
            className="underline text-blue-300 dark:text-blue-700 cursor-pointer"
          >
            {locale === 'zh-TW' ? '取消' : 'Cancel'}
          </button>
        </div>
      )}

      {/* Transform Viewport */}
      <div
        data-canvas-bg="true"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
        className="absolute inset-0 w-full h-full"
      >
        {/* SVG Edges Layer */}
        <svg
          data-canvas-bg="true"
          className="absolute inset-0 overflow-visible pointer-events-none"
          width="1"
          height="1"
        >
          <defs>
            <marker
              id="arrow-default"
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748B" />
            </marker>
            <marker
              id="arrow-selected"
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563EB" />
            </marker>
            <marker
              id="arrow-catch"
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#D97706" />
            </marker>
            <marker
              id="arrow-comp"
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#4F46E5" />
            </marker>
            <marker
              id="arrow-sim"
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669" />
            </marker>
          </defs>

          {graph.edges.map((edge) => {
            const src = nodeMap.get(edge.source);
            const tgt = nodeMap.get(edge.target);
            if (!src || !tgt) return null;

            const pairKey = [edge.source, edge.target].sort().join('::');
            const total = siblingGroups.counts.get(pairKey) ?? 1;
            const idx = siblingGroups.indices.get(edge.id) ?? 0;

            const { path, start } = buildEdgePath(
              src,
              tgt,
              edge,
              idx,
              total
            );

            const isSelected = selectedEdgeId === edge.id;
            const isSimVisited = simHighlights.visitedEdges.has(edge.id);

            const stroke = isSelected
              ? '#2563EB'
              : isSimVisited
                ? edge.type === 'Compensation'
                  ? '#4F46E5'
                  : edge.type === 'Catch'
                    ? '#D97706'
                    : '#059669'
                : edge.type === 'Compensation'
                  ? '#6366F1'
                  : edge.type === 'Catch'
                    ? '#D97706'
                    : '#64748B';

            const markerEnd = isSelected
              ? 'url(#arrow-selected)'
              : isSimVisited
                ? edge.type === 'Compensation'
                  ? 'url(#arrow-comp)'
                  : edge.type === 'Catch'
                    ? 'url(#arrow-catch)'
                    : 'url(#arrow-sim)'
                : edge.type === 'Compensation'
                  ? 'url(#arrow-comp)'
                  : edge.type === 'Catch'
                    ? 'url(#arrow-catch)'
                    : 'url(#arrow-default)';

            const strokeDasharray =
              edge.type === 'Compensation'
                ? '6 4'
                : edge.type === 'Catch'
                  ? '4 3'
                  : undefined;

            return (
              <g key={edge.id} className="pointer-events-auto">
                {/* Invisible wider hit target */}
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  className="cursor-pointer"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onSelectEdge(edge.id);
                  }}
                />
                <path
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={isSelected || isSimVisited ? 2.5 : 1.75}
                  strokeDasharray={strokeDasharray}
                  markerEnd={markerEnd}
                  className="cursor-pointer transition-colors"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onSelectEdge(edge.id);
                  }}
                />
                {/* Default branch BPMN slash marker */}
                {edge.type === 'Default' && (
                  <line
                    x1={start.x + 8}
                    y1={start.y - 6}
                    x2={start.x + 14}
                    y2={start.y + 6}
                    stroke={stroke}
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}

          {/* Live rubber-band line while dragging a connection */}
          {connectingFrom && nodeMap.has(connectingFrom.sourceId) && (
            <line
              x1={getNodeCenter(nodeMap.get(connectingFrom.sourceId)!).x}
              y1={getNodeCenter(nodeMap.get(connectingFrom.sourceId)!).y}
              x2={connectingFrom.cursor.x}
              y2={connectingFrom.cursor.y}
              stroke={
                connectingFrom.edgeType === 'Compensation'
                  ? '#4F46E5'
                  : connectingFrom.edgeType === 'Catch'
                    ? '#D97706'
                    : '#2563EB'
              }
              strokeWidth={2}
              strokeDasharray="5 4"
            />
          )}
        </svg>

        {/* HTML Interactive Nodes Layer (accessible, crisp typography, crisp focus rings) */}
        {graph.nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const severity = nodeIssueSeverity.get(node.id);
          const hasCatch = nodesWithCatch.has(node.id);
          const isSimActive = simHighlights.activeNodeId === node.id;
          const isSimVisited = simHighlights.visitedNodes.has(node.id);
          const isSimCompensated = simHighlights.compensatedNodes.has(node.id);

          const simRingClass = isSimActive
            ? 'ring-3 ring-blue-500 ring-offset-2 dark:ring-offset-slate-950'
            : isSimCompensated
              ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-950'
              : isSimVisited
                ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-slate-950'
                : '';

          const isCircle =
            node.type === 'StartState' ||
            node.type === 'Succeed' ||
            node.type === 'Fail' ||
            node.type === 'CompensationTrigger';

          const isDiamond = node.type === 'Choice';

          return (
            <div
              key={node.id}
              data-testid={`saga-node-${node.id}`}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
              }}
              className="absolute group"
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
            >
              {/* Circle Event Nodes */}
              {isCircle && (
                <button
                  type="button"
                  aria-label={`${node.name} (${node.type})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (mode === 'select') onSelectNode(node.id);
                  }}
                  className={`w-full h-full rounded-full flex items-center justify-center bg-white dark:bg-slate-900 shadow-xs transition-shadow cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    node.type === 'StartState'
                      ? 'border-2 border-emerald-600 dark:border-emerald-400'
                      : node.type === 'Succeed'
                        ? 'border-[3px] border-emerald-600 dark:border-emerald-400'
                        : node.type === 'Fail'
                          ? 'border-[3px] border-red-600 dark:border-red-400'
                          : 'border-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40'
                  } ${
                    isSelected
                      ? 'ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-slate-950'
                      : simRingClass
                  }`}
                >
                  {renderNodeIcon(node)}
                </button>
              )}

              {/* Circle external label below */}
              {isCircle && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 text-center pointer-events-none">
                  <span className="text-[11px] font-semibold font-mono text-slate-700 dark:text-slate-200 whitespace-nowrap bg-slate-50/85 dark:bg-slate-950/85 px-1.5 py-0.5 rounded">
                    {node.name}
                  </span>
                </div>
              )}

              {/* Diamond Choice Gateway */}
              {isDiamond && (
                <button
                  type="button"
                  aria-label={`${node.name} (Choice)`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (mode === 'select') onSelectNode(node.id);
                  }}
                  className="w-full h-full flex items-center justify-center relative cursor-grab active:cursor-grabbing focus-visible:outline-none"
                >
                  <div
                    className={`w-[62px] h-[62px] rotate-45 rounded-md bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-600 dark:border-amber-400 shadow-xs transition-shadow ${
                      isSelected
                        ? 'ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-slate-950'
                        : simRingClass
                    }`}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-1">
                    <GitBranch className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 text-center pointer-events-none">
                    <span className="text-[11px] font-semibold font-mono text-slate-700 dark:text-slate-200 whitespace-nowrap bg-slate-50/85 dark:bg-slate-950/85 px-1.5 py-0.5 rounded">
                      {node.name}
                    </span>
                  </div>
                </button>
              )}

              {/* Rectangular Task Nodes: ServiceTask, ScriptTask, SubStateMachine */}
              {!isCircle && !isDiamond && (
                <button
                  type="button"
                  aria-label={`${node.name} (${node.type})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (mode === 'select') onSelectNode(node.id);
                  }}
                  className={`w-full h-full rounded-xl px-3 py-2 text-left flex flex-col justify-between shadow-xs transition-shadow cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    node.isForCompensation
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-2 border-dashed border-indigo-500 dark:border-indigo-400'
                      : node.type === 'ScriptTask'
                        ? 'bg-white dark:bg-slate-900 border border-cyan-500 dark:border-cyan-500'
                        : node.type === 'SubStateMachine'
                          ? 'bg-white dark:bg-slate-900 border-2 border-sky-600 dark:border-sky-400'
                          : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500'
                  } ${
                    isSelected
                      ? 'ring-2 ring-blue-600 border-blue-600 dark:border-blue-400'
                      : simRingClass
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 w-full">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {renderNodeIcon(node)}
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                        {node.isForCompensation ? 'Compensate' : node.type}
                      </span>
                    </div>
                    {node.isAsync && (
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        async
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 w-full">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate font-mono">
                      {node.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono mt-0.5">
                      {node.type === 'ServiceTask'
                        ? `${node.serviceName || 'service'}.${node.serviceMethod || 'method'}`
                        : node.type === 'ScriptTask'
                          ? `${node.scriptType || 'groovy'}`
                          : node.stateMachineName || 'subMachine'}
                    </div>
                  </div>
                </button>
              )}

              {/* Attached Catch Boundary Marker (BPMN / Seata style) */}
              {hasCatch && (
                <div
                  title="Exception Catch Boundary"
                  className="absolute -bottom-2.5 right-4 w-5 h-5 rounded-full bg-amber-50 dark:bg-amber-950 border-2 border-amber-600 dark:border-amber-400 flex items-center justify-center pointer-events-none"
                >
                  <AlertOctagon className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                </div>
              )}

              {/* Validation Error/Warning Marker */}
              {severity && (
                <div
                  title={
                    severity === 'error'
                      ? 'Validation Error'
                      : 'Validation Warning'
                  }
                  className={`absolute -top-2 -right-2 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white pointer-events-none ${
                    severity === 'error' ? 'bg-red-600' : 'bg-amber-500'
                  }`}
                >
                  !
                </div>
              )}

              {/* Right-side interactive connection port on hover/selection */}
              {node.type !== 'Succeed' && node.type !== 'Fail' && (
                <button
                  type="button"
                  aria-label={`Connect from ${node.name}`}
                  title={
                    locale === 'zh-TW'
                      ? '拖曳以建立連線'
                      : 'Drag to connect'
                  }
                  onMouseDown={(e) => startPortConnection(e, node)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute top-1/2 -right-2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 shadow-xs cursor-crosshair transition-opacity"
                />
              )}
            </div>
          );
        })}

        {/* Top Edge Label Overlay Layer (always readable above nodes) */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {graph.edges.map((edge) => {
            const src = nodeMap.get(edge.source);
            const tgt = nodeMap.get(edge.target);
            if (!src || !tgt) return null;

            const labelText =
              edge.type === 'Choice'
                ? edge.expression || '[expression]'
                : edge.type === 'Default'
                  ? 'Default'
                  : edge.type === 'Catch'
                    ? (edge.exceptions?.[0] || 'Throwable').split('.').pop() || 'Catch'
                    : edge.type === 'Compensation'
                      ? 'Compensate'
                      : '';
            if (!labelText) return null;

            const pairKey = [edge.source, edge.target].sort().join('::');
            const total = siblingGroups.counts.get(pairKey) ?? 1;
            const idx = siblingGroups.indices.get(edge.id) ?? 0;
            const { labelPos } = buildEdgePath(src, tgt, edge, idx, total);
            const isSelected = selectedEdgeId === edge.id;

            const colorCls = isSelected
              ? 'text-blue-700 dark:text-blue-300 border-blue-400 dark:border-blue-500'
              : edge.type === 'Compensation'
                ? 'text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                : edge.type === 'Catch'
                  ? 'text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  : 'text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700';

            return (
              <button
                key={`lbl_${edge.id}`}
                type="button"
                aria-label={`Transition ${labelText}`}
                style={{
                  left: labelPos.x,
                  top: labelPos.y,
                  transform: 'translate(-50%, -50%)',
                }}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectEdge(edge.id);
                }}
                className={`pointer-events-auto absolute px-2 py-0.5 rounded bg-white/95 dark:bg-slate-900/95 border text-[10.5px] font-mono font-medium whitespace-nowrap shadow-2xs cursor-pointer hover:border-blue-500 transition-colors ${colorCls}`}
              >
                {labelText.length > 34 ? `${labelText.slice(0, 33)}…` : labelText}
              </button>
            );
          })}
        </div>

        {/* Floating Context Pad (diagram-js / refactor_designer signature UX) */}
        {selectedNode && mode === 'select' && (
          <div
            style={{
              left: selectedNode.x + selectedNode.width + 12,
              top: selectedNode.y - 4,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute z-20 flex flex-col gap-1 p-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-md"
          >
            {selectedNode.type !== 'Succeed' && selectedNode.type !== 'Fail' && (
              <>
                <button
                  type="button"
                  title={locale === 'zh-TW' ? '連接至其他節點' : 'Connect to state'}
                  aria-label={`Connect ${selectedNode.name} to another state`}
                  onClick={() => {
                    onChangeMode('connect');
                    setConnectingFrom({
                      sourceId: selectedNode.id,
                      cursor: getNodeCenter(selectedNode),
                    });
                  }}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title={locale === 'zh-TW' ? '附加 ServiceTask' : 'Append ServiceTask'}
                  aria-label={`Append ServiceTask after ${selectedNode.name}`}
                  onClick={() => onQuickAppendNode(selectedNode.id, 'ServiceTask')}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title={locale === 'zh-TW' ? '附加 Choice 分支' : 'Append Choice'}
                  aria-label={`Append Choice after ${selectedNode.name}`}
                  onClick={() => onQuickAppendNode(selectedNode.id, 'Choice')}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 cursor-pointer"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                </button>
                {(selectedNode.type === 'ServiceTask' ||
                  selectedNode.type === 'SubStateMachine') &&
                  !selectedNode.isForCompensation && (
                    <button
                      type="button"
                      title={
                        locale === 'zh-TW'
                          ? '附加補償任務 (CompensateState)'
                          : 'Append Compensation Task'
                      }
                      aria-label={`Append compensation task for ${selectedNode.name}`}
                      onClick={() =>
                        onQuickAppendNode(selectedNode.id, 'ServiceTask', true)
                      }
                      className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                <button
                  type="button"
                  title={locale === 'zh-TW' ? '附加 Succeed 結束' : 'Append Succeed'}
                  aria-label={`Append Succeed after ${selectedNode.name}`}
                  onClick={() => onQuickAppendNode(selectedNode.id, 'Succeed')}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {selectedNode.type !== 'StartState' && (
              <button
                type="button"
                title={locale === 'zh-TW' ? '刪除節點' : 'Delete state'}
                aria-label={`Delete ${selectedNode.name}`}
                onClick={() => onDeleteNode(selectedNode.id)}
                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/60 text-red-600 dark:text-red-400 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom-left Legend & Hint */}
      <div className="absolute bottom-3 left-3 z-10 hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 backdrop-blur-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-slate-500 inline-block" />
          Next / Choice
        </span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0 border-t-2 border-dashed border-indigo-500 inline-block" />
          CompensateState
        </span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0 border-t-2 border-dotted border-amber-500 inline-block" />
          Catch
        </span>
      </div>

      {/* Bottom-right Zoom Controls */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 p-1 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-xs">
        <button
          type="button"
          onClick={() =>
            setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))
          }
          aria-label="Zoom out"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="px-1.5 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 min-w-[44px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() =>
            setZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2))))
          }
          aria-label="Zoom in"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleFitView}
          aria-label={t.zoomFit}
          title={t.zoomFit}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setZoom(1);
            setPan({ x: 32, y: 24 });
          }}
          aria-label={t.zoomReset}
          title={t.zoomReset}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
