import {
  EdgeAnchorOverride,
  NODE_DIMENSIONS,
  NodeAnchorSide,
  SagaEdge,
  SagaGraph,
  SagaNode,
  SeataStateDefinition,
  SeataStateMachineJson,
  SeataStateType,
} from './types';
import { computeGraphEdgeRoutes, estimateEdgeLabelSize } from './edgeRouting';
import { AiLayoutStyle } from './aiLayout';
import { computeAutoLayout } from './autoLayout';

export const START_NODE_ID = '__START__';

function safeStringify(value: unknown): string {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

function safeParseJson<T>(raw: string | undefined): T | undefined {
  if (!raw || !raw.trim()) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

const VALID_ANCHOR_SIDES = new Set<NodeAnchorSide>([
  'top',
  'right',
  'bottom',
  'left',
]);

function parseEdgeAnchorOverride(raw: unknown): EdgeAnchorOverride | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as { side?: unknown; ratio?: unknown };
  if (
    typeof candidate.side !== 'string' ||
    !VALID_ANCHOR_SIDES.has(candidate.side as NodeAnchorSide)
  ) {
    return undefined;
  }
  const ratio =
    typeof candidate.ratio === 'number' && Number.isFinite(candidate.ratio)
      ? Math.min(0.95, Math.max(0.05, candidate.ratio))
      : 0.5;
  return {
    side: candidate.side as NodeAnchorSide,
    ratio,
  };
}

export function parseSeataJsonToGraph(raw: SeataStateMachineJson): SagaGraph {
  const nodes: SagaNode[] = [];
  const edges: SagaEdge[] = [];

  const startBounds = raw.style?.bounds ?? {
    x: 60,
    y: 176,
    ...NODE_DIMENSIONS.StartState,
  };

  nodes.push({
    id: START_NODE_ID,
    name: 'Start',
    type: 'StartState',
    x: startBounds.x,
    y: startBounds.y,
    width: startBounds.width || NODE_DIMENSIONS.StartState.width,
    height: startBounds.height || NODE_DIMENSIONS.StartState.height,
  });

  const states = raw.States ?? {};
  const stateNames = Object.keys(states);
  let hasAnyLayout = Boolean(raw.style?.bounds);

  stateNames.forEach((stateName, index) => {
    const def = states[stateName];
    const type: SeataStateType = def.Type ?? 'ServiceTask';
    const dim = NODE_DIMENSIONS[type] ?? NODE_DIMENSIONS.ServiceTask;
    if (def.style?.bounds) {
      hasAnyLayout = true;
    }
    const bounds = def.style?.bounds ?? {
      x: 200 + (index % 4) * 230,
      y: 120 + Math.floor(index / 4) * 160,
      width: dim.width,
      height: dim.height,
    };

    const statusMap = def.Status
      ? Object.entries(def.Status).map(([key, value]) => ({
          key,
          value,
        }))
      : undefined;

    nodes.push({
      id: stateName,
      name: stateName,
      type,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width || dim.width,
      height: bounds.height || dim.height,
      comment: def.Comment,
      serviceType: def.ServiceType,
      serviceName: def.ServiceName,
      serviceMethod: def.ServiceMethod,
      parameterTypes: def.ParameterTypes ? [...def.ParameterTypes] : undefined,
      isAsync: def.IsAsync,
      isPersist: def.IsPersist,
      isForCompensation: def.IsForCompensation,
      isForUpdate: def.IsForUpdate,
      inputJson: def.Input !== undefined ? safeStringify(def.Input) : undefined,
      outputJson: def.Output !== undefined ? safeStringify(def.Output) : undefined,
      statusMap,
      retry: def.Retry ? def.Retry.map((r) => ({ ...r, Exceptions: [...r.Exceptions] })) : undefined,
      loop: def.Loop ? { ...def.Loop } : undefined,
      scriptType: def.ScriptType,
      scriptContent: def.ScriptContent,
      stateMachineName: def.StateMachineName,
      errorCode: def.ErrorCode,
      message: def.Message,
    });
  });

  const nodeIdSet = new Set(nodes.map((n) => n.id));
  let edgeSeq = 1;

  if (raw.StartState && nodeIdSet.has(raw.StartState)) {
    edges.push({
      id: `edge_${edgeSeq++}`,
      source: START_NODE_ID,
      target: raw.StartState,
      type: 'Transition',
    });
  }

  for (const stateName of stateNames) {
    const def = states[stateName];

    if (def.Type === 'Choice') {
      if (Array.isArray(def.Choices)) {
        def.Choices.forEach((choice) => {
          if (choice.Next && nodeIdSet.has(choice.Next)) {
            edges.push({
              id: `edge_${edgeSeq++}`,
              source: stateName,
              target: choice.Next,
              type: 'Choice',
              expression: choice.Expression ?? '',
            });
          }
        });
      }
      if (def.Default && nodeIdSet.has(def.Default)) {
        edges.push({
          id: `edge_${edgeSeq++}`,
          source: stateName,
          target: def.Default,
          type: 'Default',
          isDefault: true,
        });
      }
    } else if (def.Next && nodeIdSet.has(def.Next)) {
      edges.push({
        id: `edge_${edgeSeq++}`,
        source: stateName,
        target: def.Next,
        type: 'Transition',
      });
    }

    if (def.CompensateState && nodeIdSet.has(def.CompensateState)) {
      edges.push({
        id: `edge_${edgeSeq++}`,
        source: stateName,
        target: def.CompensateState,
        type: 'Compensation',
      });
    }

    if (Array.isArray(def.Catch)) {
      def.Catch.forEach((catchItem) => {
        if (catchItem.Next && nodeIdSet.has(catchItem.Next)) {
          const sourceAnchor = parseEdgeAnchorOverride(
            def.edge?.[catchItem.Next]?.style?.sourceAnchor
          );
          edges.push({
            id: `edge_${edgeSeq++}`,
            source: stateName,
            target: catchItem.Next,
            type: 'Catch',
            exceptions: Array.isArray(catchItem.Exceptions)
              ? [...catchItem.Exceptions]
              : ['java.lang.Throwable'],
            ...(sourceAnchor ? { sourceAnchor } : {}),
          });
        }
      });
    }
  }

  const graph: SagaGraph = {
    meta: {
      name: raw.Name || 'untitledStateMachine',
      comment: raw.Comment ?? '',
      version: raw.Version || '0.0.1',
      persist: raw.Persist ?? true,
      retryPersistModeUpdate: raw.RetryPersistModeUpdate ?? false,
      compensatePersistModeUpdate: raw.CompensatePersistModeUpdate ?? false,
    },
    nodes,
    edges,
  };

  return hasAnyLayout ? graph : autoLayoutGraph(graph);
}

export function serializeGraphToSeataJson(
  graph: SagaGraph,
  options: { includeLayout?: boolean } = { includeLayout: true }
): SeataStateMachineJson {
  const includeLayout = options.includeLayout ?? true;
  const startNode = graph.nodes.find((n) => n.type === 'StartState');
  const startEdge = startNode
    ? graph.edges.find((e) => e.source === startNode.id && e.type === 'Transition')
    : undefined;

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const startStateName =
    startEdge && nodeById.has(startEdge.target)
      ? nodeById.get(startEdge.target)!.name
      : graph.nodes.find((n) => n.type !== 'StartState' && !n.isForCompensation)?.name ?? '';

  const states: Record<string, SeataStateDefinition> = {};

  for (const node of graph.nodes) {
    if (node.type === 'StartState') continue;

    const outgoing = graph.edges.filter((e) => e.source === node.id);
    const def: SeataStateDefinition = {
      Type: node.type,
    };

    if (node.comment?.trim()) def.Comment = node.comment.trim();

    if (node.type === 'ServiceTask') {
      if (node.serviceName !== undefined && node.serviceName !== '') {
        def.ServiceName = node.serviceName;
      }
      if (node.serviceMethod !== undefined && node.serviceMethod !== '') {
        def.ServiceMethod = node.serviceMethod;
      }
      if (node.serviceType) def.ServiceType = node.serviceType;
      if (node.parameterTypes && node.parameterTypes.length > 0) {
        def.ParameterTypes = node.parameterTypes.filter((p) => p.trim().length > 0);
      }
      if (node.isAsync) def.IsAsync = true;
      if (node.isPersist === false) def.IsPersist = false;
      if (node.isForCompensation) def.IsForCompensation = true;
      if (node.isForUpdate) def.IsForUpdate = true;
    }

    if (node.type === 'ScriptTask') {
      def.ScriptType = node.scriptType || 'groovy';
      if (node.scriptContent !== undefined) def.ScriptContent = node.scriptContent;
    }

    if (node.type === 'SubStateMachine') {
      if (node.stateMachineName) def.StateMachineName = node.stateMachineName;
      if (node.isAsync) def.IsAsync = true;
      if (node.isForCompensation) def.IsForCompensation = true;
    }

    if (node.type === 'Fail') {
      if (node.errorCode) def.ErrorCode = node.errorCode;
      if (node.message) def.Message = node.message;
    }

    // Compensation association edge
    const compEdge = outgoing.find((e) => e.type === 'Compensation');
    if (compEdge && nodeById.has(compEdge.target)) {
      def.CompensateState = nodeById.get(compEdge.target)!.name;
    }

    // Input / Output / Status / Retry / Loop
    const parsedInput = safeParseJson<unknown[]>(node.inputJson);
    if (Array.isArray(parsedInput)) {
      def.Input = parsedInput;
    }

    const parsedOutput = safeParseJson<Record<string, unknown>>(node.outputJson);
    if (parsedOutput && typeof parsedOutput === 'object' && !Array.isArray(parsedOutput)) {
      def.Output = parsedOutput;
    }

    if (node.statusMap && node.statusMap.length > 0) {
      const statusObj: Record<string, 'SU' | 'FA' | 'UN'> = {};
      node.statusMap.forEach((entry) => {
        if (entry.key.trim()) {
          statusObj[entry.key.trim()] = entry.value;
        }
      });
      if (Object.keys(statusObj).length > 0) {
        def.Status = statusObj;
      }
    }

    if (node.retry && node.retry.length > 0) {
      def.Retry = node.retry.map((r) => ({
        Exceptions: r.Exceptions.filter(Boolean),
        IntervalSeconds: Number(r.IntervalSeconds) || 1,
        MaxAttempts: Number(r.MaxAttempts) || 3,
        BackoffRate: Number(r.BackoffRate) || 1,
      }));
    }

    if (node.loop && node.loop.Collection) {
      def.Loop = { ...node.loop };
    }

    // Catch edges
    const catchEdges = outgoing.filter((e) => e.type === 'Catch');
    if (catchEdges.length > 0) {
      def.Catch = catchEdges
        .filter((e) => nodeById.has(e.target))
        .map((e) => ({
          Exceptions:
            e.exceptions && e.exceptions.length > 0
              ? e.exceptions
              : ['java.lang.Throwable'],
          Next: nodeById.get(e.target)!.name,
        }));
    }

    // Choice vs Next
    if (node.type === 'Choice') {
      const choiceEdges = outgoing.filter((e) => e.type === 'Choice');
      def.Choices = choiceEdges
        .filter((e) => nodeById.has(e.target))
        .map((e) => ({
          Expression: e.expression ?? '',
          Next: nodeById.get(e.target)!.name,
        }));
      const defaultEdge = outgoing.find((e) => e.type === 'Default');
      if (defaultEdge && nodeById.has(defaultEdge.target)) {
        def.Default = nodeById.get(defaultEdge.target)!.name;
      }
    } else if (node.type !== 'Succeed' && node.type !== 'Fail') {
      const nextEdge = outgoing.find((e) => e.type === 'Transition');
      if (nextEdge && nodeById.has(nextEdge.target)) {
        def.Next = nodeById.get(nextEdge.target)!.name;
      }
    }

    if (includeLayout) {
      def.style = {
        bounds: {
          x: Math.round(node.x),
          y: Math.round(node.y),
          width: Math.round(node.width),
          height: Math.round(node.height),
        },
      };

      const anchoredCatchEdges = catchEdges.filter(
        (e) => e.sourceAnchor && nodeById.has(e.target)
      );
      if (anchoredCatchEdges.length > 0) {
        const edgeStyleMap: Record<
          string,
          { style?: { sourceAnchor?: EdgeAnchorOverride } }
        > = {};
        anchoredCatchEdges.forEach((e) => {
          const targetName = nodeById.get(e.target)!.name;
          if (!e.sourceAnchor) return;
          edgeStyleMap[targetName] = {
            style: {
              sourceAnchor: {
                side: e.sourceAnchor.side,
                ratio: Number(e.sourceAnchor.ratio.toFixed(3)),
              },
            },
          };
        });
        def.edge = edgeStyleMap;
      }
    }

    states[node.name] = def;
  }

  const output: SeataStateMachineJson = {
    Name: graph.meta.name || 'untitledStateMachine',
    Comment: graph.meta.comment || undefined,
    StartState: startStateName,
    Version: graph.meta.version || '0.0.1',
    Type: 'STATE_LANG',
    Persist: graph.meta.persist,
    RetryPersistModeUpdate: graph.meta.retryPersistModeUpdate,
    CompensatePersistModeUpdate: graph.meta.compensatePersistModeUpdate,
    States: states,
  };

  if (includeLayout && startNode) {
    output.style = {
      bounds: {
        x: Math.round(startNode.x),
        y: Math.round(startNode.y),
        width: Math.round(startNode.width),
        height: Math.round(startNode.height),
      },
    };
  }

  return output;
}

export function renameStateInGraph(
  graph: SagaGraph,
  nodeId: string,
  newName: string
): SagaGraph {
  const trimmed = newName.trim();
  if (!trimmed) return graph;
  const target = graph.nodes.find((n) => n.id === nodeId);
  if (!target || target.type === 'StartState') return graph;
  if (trimmed === target.name) return graph;
  if (graph.nodes.some((n) => n.id !== nodeId && n.name === trimmed)) {
    return graph;
  }

  return {
    ...graph,
    nodes: graph.nodes.map((n) =>
      n.id === nodeId ? { ...n, id: trimmed, name: trimmed } : n
    ),
    edges: graph.edges.map((e) => ({
      ...e,
      source: e.source === nodeId ? trimmed : e.source,
      target: e.target === nodeId ? trimmed : e.target,
    })),
  };
}

export function autoLayoutGraph(
  graph: SagaGraph,
  style: AiLayoutStyle = 'horizontal-swimlane'
): SagaGraph {
  return computeAutoLayout(graph, style);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportGraphToSvg(graph: SagaGraph): string {
  if (graph.nodes.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"></svg>';
  }
  const minX = Math.min(...graph.nodes.map((n) => n.x)) - 60;
  const minY = Math.min(...graph.nodes.map((n) => n.y)) - 60;
  const maxX = Math.max(...graph.nodes.map((n) => n.x + n.width)) + 80;
  const maxY = Math.max(...graph.nodes.map((n) => n.y + n.height)) + 80;
  const width = Math.max(600, maxX - minX);
  const height = Math.max(360, maxY - minY);

  const routedEdges = computeGraphEdgeRoutes(graph.nodes, graph.edges);

  const edgesSvg = graph.edges
    .map((e) => {
      const route = routedEdges.get(e.id);
      if (!route) return '';
      const stroke =
        e.type === 'Compensation'
          ? '#4F46E5'
          : e.type === 'Catch'
            ? '#D97706'
            : '#475569';
      const dash =
        e.type === 'Compensation'
          ? ' stroke-dasharray="6,4"'
          : e.type === 'Catch'
            ? ' stroke-dasharray="4,3"'
            : '';
      return `<path d="${route.path}" fill="none" stroke="${stroke}" stroke-width="2"${dash} marker-end="url(#arrow)" />`;
    })
    .join('\n  ');

  const edgeLabelsSvg = graph.edges
    .map((e) => {
      const route = routedEdges.get(e.id);
      if (!route || !route.labelText) return '';
      const display =
        route.labelText.length > 34
          ? `${route.labelText.slice(0, 33)}…`
          : route.labelText;
      const { width: lw, height: lh } = estimateEdgeLabelSize(display);
      const stroke =
        e.type === 'Compensation'
          ? '#4F46E5'
          : e.type === 'Catch'
            ? '#B45309'
            : '#334155';
      const rx = Math.round(route.labelPos.x - lw / 2);
      const ry = Math.round(route.labelPos.y - lh / 2);
      return `<g><rect x="${rx}" y="${ry}" width="${lw}" height="${lh}" rx="4" fill="#FFFFFF" fill-opacity="0.95" stroke="#CBD5E1" stroke-width="1" /><text x="${route.labelPos.x}" y="${route.labelPos.y + 4}" font-family="ui-monospace, monospace" font-size="10.5" font-weight="500" fill="${stroke}" text-anchor="middle">${escapeXml(display)}</text></g>`;
    })
    .join('\n  ');

  const nodesSvg = graph.nodes
    .map((n) => {
      const cx = n.x + n.width / 2;
      const cy = n.y + n.height / 2;
      if (n.type === 'StartState' || n.type === 'Succeed' || n.type === 'Fail' || n.type === 'CompensationTrigger') {
        const r = Math.min(n.width, n.height) / 2;
        const stroke =
          n.type === 'Succeed' || n.type === 'StartState'
            ? '#059669'
            : n.type === 'Fail'
              ? '#DC2626'
              : '#4F46E5';
        const sw = n.type === 'Succeed' || n.type === 'Fail' ? 3 : 2;
        return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF" stroke="${stroke}" stroke-width="${sw}" /><text x="${cx}" y="${cy + r + 16}" font-family="sans-serif" font-size="12" font-weight="600" fill="#0F172A" text-anchor="middle">${escapeXml(n.name)}</text></g>`;
      }
      if (n.type === 'Choice') {
        const pts = `${cx},${n.y} ${n.x + n.width},${cy} ${cx},${n.y + n.height} ${n.x},${cy}`;
        return `<g><polygon points="${pts}" fill="#FFFBEB" stroke="#D97706" stroke-width="2" /><text x="${cx}" y="${n.y + n.height + 16}" font-family="sans-serif" font-size="11" font-weight="600" fill="#92400E" text-anchor="middle">${escapeXml(n.name)}</text></g>`;
      }
      const stroke = n.isForCompensation ? '#4F46E5' : '#2563EB';
      const fill = n.isForCompensation ? '#EEF2FF' : '#FFFFFF';
      const sub =
        n.type === 'ServiceTask'
          ? `${n.serviceName || ''}.${n.serviceMethod || ''}`
          : n.type === 'ScriptTask'
            ? `${n.scriptType || 'groovy'} script`
            : n.stateMachineName || 'SubStateMachine';
      return `<g><rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="2" /><text x="${cx}" y="${cy - 4}" font-family="sans-serif" font-size="12" font-weight="600" fill="#0F172A" text-anchor="middle">${escapeXml(n.name)}</text><text x="${cx}" y="${cy + 14}" font-family="monospace" font-size="10" fill="#475569" text-anchor="middle">${escapeXml(sub)}</text></g>`;
    })
    .join('\n  ');

  const catchMarkersSvg = graph.edges
    .map((e) => {
      const route = routedEdges.get(e.id);
      if (!route || !route.catchAnchor) return '';
      const { x, y } = route.catchAnchor.borderPoint;
      return `<g data-catch-marker="${escapeXml(e.id)}" data-catch-side="${route.catchAnchor.side}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="#FFFBEB" stroke="#D97706" stroke-width="2" /><text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" font-family="sans-serif" font-size="10" font-weight="700" fill="#B45309" text-anchor="middle">!</text></g>`;
    })
    .filter(Boolean)
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}" style="background:#F8FAFC">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
    </marker>
  </defs>
  ${edgesSvg}
  ${nodesSvg}
  ${catchMarkersSvg}
  ${edgeLabelsSvg}
</svg>`;
}
