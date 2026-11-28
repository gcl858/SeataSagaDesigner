import {
  countEdgesPassingThroughNodes,
  estimateEdgeLabelSize,
  getEdgeLabelText,
} from './edgeRouting';
import { Locale } from './i18n';
import { SagaEdge, SagaGraph, SagaNode } from './types';

export type AiLayoutStyle =
  | 'horizontal-swimlane'
  | 'vertical-flowchart'
  | 'compensation-aligned'
  | 'compact-executive';

export interface AiLayoutNodePosition {
  id: string;
  x: number;
  y: number;
  lane?: string;
}

export interface AiLayoutPlan {
  style: AiLayoutStyle;
  positions: AiLayoutNodePosition[];
  summary: string;
  rationale: string[];
  suggestions: string[];
  model?: string;
}

export interface LayoutQualityMetrics {
  nodeCount: number;
  overlapCount: number;
  edgeCrossings: number;
  nodeThroughEdgeHits?: number;
  totalEdgeLength: number;
  boundsWidth: number;
  boundsHeight: number;
  aspectRatio: number;
}

export const DEFAULT_MINIMAX_MODEL = 'MiniMax-M3.1-Flash';

export interface MiniMaxModelOption {
  id: string;
  labelZh: string;
  labelEn: string;
}

export const MINIMAX_MODEL_OPTIONS: MiniMaxModelOption[] = [
  {
    id: 'MiniMax-M3.1-Flash',
    labelZh: 'MiniMax-M3.1-Flash（快速推理・推薦）',
    labelEn: 'MiniMax-M3.1-Flash (Fast · Recommended)',
  },
  {
    id: 'MiniMax-M3',
    labelZh: 'MiniMax-M3（旗艦深度推理）',
    labelEn: 'MiniMax-M3 (Flagship Reasoning)',
  },
  {
    id: 'MiniMax-M2.5',
    labelZh: 'MiniMax-M2.5（穩定相容）',
    labelEn: 'MiniMax-M2.5 (Compatible)',
  },
];

const ALLOWED_MINIMAX_HOSTS: ReadonlySet<string> = new Set([
  'api.minimax.io',
  'api.minimaxi.com',
]);

const ALLOWED_MINIMAX_MODELS: ReadonlySet<string> = new Set([
  'MiniMax-M3.1-Flash',
  'MiniMax-M3',
  'MiniMax-M2.7',
  'MiniMax-M2.5',
  'MiniMax-M2',
  'MiniMax-Text-01',
]);

export interface AiLayoutRequestPayload {
  graph: SagaGraph;
  style: AiLayoutStyle;
  customPrompt?: string;
  locale: Locale;
  model?: string;
}

export interface AiLayoutResponsePayload {
  ok: true;
  provider?: string;
  model: string;
  plan: AiLayoutPlan;
  metricsBefore: LayoutQualityMetrics;
  metricsAfter: LayoutQualityMetrics;
}

export interface AiLayoutStyleOption {
  id: AiLayoutStyle;
  labelZh: string;
  labelEn: string;
  descZh: string;
  descEn: string;
}

export const AI_LAYOUT_STYLES: AiLayoutStyleOption[] = [
  {
    id: 'horizontal-swimlane',
    labelZh: '橫向主幹泳道',
    labelEn: 'Horizontal Swimlane',
    descZh: '主成功路徑由左至右水平展開，補償與例外分支分層置於下方。',
    descEn: 'Left-to-right happy path with dedicated compensation and exception lanes below.',
  },
  {
    id: 'vertical-flowchart',
    labelZh: '縱向泳道流程',
    labelEn: 'Vertical Top-Down',
    descZh: '主流程由上而下推進，補償任務對齊右側欄，適合長流程閱讀。',
    descEn: 'Top-to-bottom progression with compensation actions aligned to the right.',
  },
  {
    id: 'compensation-aligned',
    labelZh: '補償配對優先',
    labelEn: 'Compensation-Paired',
    descZh: '強化正向服務與補償服務的垂直對齊，凸顯分散式交易回滾脈絡。',
    descEn: 'Emphasizes forward-to-compensation pairing and rollback rails for auditing.',
  },
  {
    id: 'compact-executive',
    labelZh: '精簡簡報排版',
    labelEn: 'Compact Presentation',
    descZh: '壓縮整體長寬比與連線距離，適合文件截圖與架構審查簡報。',
    descEn: 'Minimizes footprint and wire length for slides and documentation captures.',
  },
];

export const AI_LAYOUT_QUICK_PROMPTS: Array<{
  id: string;
  zh: string;
  en: string;
}> = [
  {
    id: 'straight-happy-path',
    zh: '主成功路徑水平拉直，例外與失敗集中在下方泳道',
    en: 'Align happy path on a clean horizontal line with errors in a bottom lane',
  },
  {
    id: 'pair-compensation',
    zh: '所有補償節點正對齊原任務正下方，方便檢視回滾對應',
    en: 'Place every compensation node directly beneath its paired forward task',
  },
  {
    id: 'reduce-crossings',
    zh: '優先減少 Choice 條件分支與 Catch 例外連線交叉',
    en: 'Prioritize minimizing Choice and Catch edge crossings',
  },
  {
    id: 'doc-aspect',
    zh: '保持 16:9 寬高比且留白均衡，適合架構文件展示',
    en: 'Optimize for a balanced 16:9 footprint suitable for architecture docs',
  },
];

export const VALID_AI_LAYOUT_STYLES: ReadonlySet<AiLayoutStyle> = new Set([
  'horizontal-swimlane',
  'vertical-flowchart',
  'compensation-aligned',
  'compact-executive',
]);

const GRID_STEP = 20;
const ORIGIN_MIN_X = 48;
const ORIGIN_MIN_Y = 56;
const DEFAULT_COLLISION_PADDING = 36;
const OVERLAP_METRIC_CLEARANCE = 12;

export function snapToGrid(value: number, step = GRID_STEP): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / step) * step;
}

function getCenter(node: SagaNode): { x: number; y: number } {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

function orientation(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): number {
  const val = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(val) < 1e-6) return 0;
  return val > 0 ? 1 : 2;
}

function segmentsProperlyIntersect(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number }
): boolean {
  const o1 = orientation(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y);
  const o2 = orientation(a1.x, a1.y, a2.x, a2.y, b2.x, b2.y);
  const o3 = orientation(b1.x, b1.y, b2.x, b2.y, a1.x, a1.y);
  const o4 = orientation(b1.x, b1.y, b2.x, b2.y, a2.x, a2.y);
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
}

/**
 * Computes objective geometric quality metrics for a Saga graph layout.
 */
export function computeLayoutMetrics(graph: SagaGraph): LayoutQualityMetrics {
  const { nodes, edges } = graph;
  if (nodes.length === 0) {
    return {
      nodeCount: 0,
      overlapCount: 0,
      edgeCrossings: 0,
      totalEdgeLength: 0,
      boundsWidth: 0,
      boundsHeight: 0,
      aspectRatio: 1,
    };
  }

  let overlapCount = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j += 1) {
      const b = nodes[j];
      const overlapsX =
        a.x < b.x + b.width + OVERLAP_METRIC_CLEARANCE &&
        a.x + a.width + OVERLAP_METRIC_CLEARANCE > b.x;
      const overlapsY =
        a.y < b.y + b.height + OVERLAP_METRIC_CLEARANCE &&
        a.y + a.height + OVERLAP_METRIC_CLEARANCE > b.y;
      if (overlapsX && overlapsY) {
        overlapCount += 1;
      }
    }
  }

  const nodeMap = new Map<string, SagaNode>(nodes.map((n) => [n.id, n]));
  const validSegments: Array<{
    edge: SagaEdge;
    p1: { x: number; y: number };
    p2: { x: number; y: number };
  }> = [];

  let totalEdgeLength = 0;
  for (const edge of edges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;
    const p1 = getCenter(src);
    const p2 = getCenter(tgt);
    totalEdgeLength += Math.hypot(p2.x - p1.x, p2.y - p1.y);
    validSegments.push({ edge, p1, p2 });
  }

  let edgeCrossings = 0;
  for (let i = 0; i < validSegments.length; i += 1) {
    const segA = validSegments[i];
    for (let j = i + 1; j < validSegments.length; j += 1) {
      const segB = validSegments[j];
      // Skip edges sharing an endpoint
      if (
        segA.edge.source === segB.edge.source ||
        segA.edge.source === segB.edge.target ||
        segA.edge.target === segB.edge.source ||
        segA.edge.target === segB.edge.target
      ) {
        continue;
      }
      if (segmentsProperlyIntersect(segA.p1, segA.p2, segB.p1, segB.p2)) {
        edgeCrossings += 1;
      }
    }
  }

  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.width));
  const maxY = Math.max(...nodes.map((n) => n.y + n.height));
  const boundsWidth = Math.max(0, Math.round(maxX - minX));
  const boundsHeight = Math.max(0, Math.round(maxY - minY));
  const aspectRatio = Number(
    (boundsWidth / Math.max(1, boundsHeight)).toFixed(2)
  );

  const nodeThroughEdgeHits = countEdgesPassingThroughNodes(nodes, edges);

  return {
    nodeCount: nodes.length,
    overlapCount,
    edgeCrossings,
    nodeThroughEdgeHits,
    totalEdgeLength: Math.round(totalEdgeLength),
    boundsWidth,
    boundsHeight,
    aspectRatio,
  };
}

/**
 * Deterministic AABB overlap resolver that separates overlapping or crowded
 * nodes while preserving horizontal/vertical center-axis alignment, then
 * normalizes top-left canvas padding uniformly.
 */
export function resolveNodeOverlaps(
  nodes: SagaNode[],
  options?: {
    padding?: number;
    preferVerticalSplit?: boolean;
  }
): SagaNode[] {
  if (nodes.length === 0) return [];
  const padding = options?.padding ?? DEFAULT_COLLISION_PADDING;
  const preferVerticalSplit = options?.preferVerticalSplit ?? false;

  const working = nodes.map((n) => ({
    ...n,
    x: Number.isFinite(n.x) ? Math.round(n.x) : 0,
    y: Number.isFinite(n.y) ? Math.round(n.y) : 0,
  }));

  const maxIterations = 80;
  for (let iter = 0; iter < maxIterations; iter += 1) {
    let movedAny = false;
    for (let i = 0; i < working.length; i += 1) {
      for (let j = i + 1; j < working.length; j += 1) {
        const a = working[i];
        const b = working[j];

        const aCx = a.x + a.width / 2;
        const aCy = a.y + a.height / 2;
        const bCx = b.x + b.width / 2;
        const bCy = b.y + b.height / 2;

        const requiredDx = (a.width + b.width) / 2 + padding;
        const requiredDy = (a.height + b.height) / 2 + padding;

        const dx = bCx - aCx;
        const dy = bCy - aCy;
        const overlapX = requiredDx - Math.abs(dx);
        const overlapY = requiredDy - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          movedAny = true;
          // Preserve aligned horizontal swimlanes: if two nodes share nearly the
          // same centerline Y (and are not identically stacked), push strictly on X.
          const sameHorizontalLane = !preferVerticalSplit && Math.abs(dy) <= 10 && Math.abs(dx) > 4;
          const sameVerticalLane = preferVerticalSplit && Math.abs(dx) <= 10 && Math.abs(dy) > 4;

          let pushAlongY: boolean;
          if (sameHorizontalLane) {
            pushAlongY = false;
          } else if (sameVerticalLane) {
            pushAlongY = true;
          } else {
            pushAlongY =
              Math.abs(overlapY - overlapX) < 1
                ? !preferVerticalSplit
                : overlapY < overlapX;
          }

          if (pushAlongY) {
            const dir = dy >= 0 ? 1 : -1;
            const shift = Math.ceil(overlapY / 2) + 2;
            a.y -= dir * shift;
            b.y += dir * shift;
          } else {
            const dir = dx >= 0 ? 1 : -1;
            const shift = Math.ceil(overlapX / 2) + 2;
            a.x -= dir * shift;
            b.x += dir * shift;
          }
        }
      }
    }
    if (!movedAny) break;
  }

  // Final micro-pass to guarantee strict visual clearance
  for (let pass = 0; pass < 16; pass += 1) {
    let adjusted = false;
    for (let i = 0; i < working.length; i += 1) {
      for (let j = i + 1; j < working.length; j += 1) {
        const a = working[i];
        const b = working[j];
        const overlapsX =
          a.x < b.x + b.width + OVERLAP_METRIC_CLEARANCE + 8 &&
          a.x + a.width + OVERLAP_METRIC_CLEARANCE + 8 > b.x;
        const overlapsY =
          a.y < b.y + b.height + OVERLAP_METRIC_CLEARANCE + 8 &&
          a.y + a.height + OVERLAP_METRIC_CLEARANCE + 8 > b.y;
        if (overlapsX && overlapsY) {
          adjusted = true;
          const aCy = a.y + a.height / 2;
          const bCy = b.y + b.height / 2;
          if (preferVerticalSplit || Math.abs(aCy - bCy) <= 10) {
            b.x += 28;
          } else {
            b.y += 28;
          }
        }
      }
    }
    if (!adjusted) break;
  }

  // Uniform origin translation preserves exact centerline alignment across all nodes
  const minX = Math.min(...working.map((n) => n.x));
  const minY = Math.min(...working.map((n) => n.y));
  const offsetX = ORIGIN_MIN_X - minX;
  const offsetY = ORIGIN_MIN_Y - minY;

  return working.map((n) => ({
    ...n,
    x: Math.round(n.x + offsetX),
    y: Math.round(n.y + offsetY),
  }));
}

/**
 * Aligns nodes on the same semantic swimlane to an exact shared center axis
 * (cy for horizontal flows, cx for vertical flows) and snaps paired
 * Compensation tasks directly onto their forward task's center axis.
 */
export function alignSwimlanesByCenter(
  nodes: SagaNode[],
  edges: SagaEdge[],
  style: AiLayoutStyle = 'horizontal-swimlane'
): SagaNode[] {
  if (nodes.length <= 1) return nodes.map((n) => ({ ...n }));
  const working = nodes.map((n) => ({ ...n }));
  const idxById = new Map<string, number>(working.map((n, idx) => [n.id, idx]));

  const parent = working.map((_, idx) => idx);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const isVertical = style === 'vertical-flowchart';

  if (!isVertical) {
    // 1. Union horizontally flowing forward edges (Transition / Choice) whose centers are reasonably close
    for (const edge of edges) {
      if (edge.type !== 'Transition' && edge.type !== 'Choice') continue;
      const ai = idxById.get(edge.source);
      const bi = idxById.get(edge.target);
      if (ai === undefined || bi === undefined) continue;
      const a = working[ai];
      const b = working[bi];
      const aCx = a.x + a.width / 2;
      const aCy = a.y + a.height / 2;
      const bCx = b.x + b.width / 2;
      const bCy = b.y + b.height / 2;
      if (Math.abs(bCx - aCx) >= 56 && Math.abs(bCy - aCy) <= 84) {
        union(ai, bi);
      }
    }

    // 2. Union nearby nodes already in the same horizontal band
    for (let i = 0; i < working.length; i += 1) {
      for (let j = i + 1; j < working.length; j += 1) {
        const a = working[i];
        const b = working[j];
        const aCx = a.x + a.width / 2;
        const aCy = a.y + a.height / 2;
        const bCx = b.x + b.width / 2;
        const bCy = b.y + b.height / 2;
        if (Math.abs(aCy - bCy) <= 44 && Math.abs(aCx - bCx) >= 72) {
          union(i, j);
        }
      }
    }

    // 3. Snap each horizontal swimlane cluster to one exact shared centerY
    const groups = new Map<number, number[]>();
    for (let i = 0; i < working.length; i += 1) {
      const r = find(i);
      const list = groups.get(r) ?? [];
      list.push(i);
      groups.set(r, list);
    }

    groups.forEach((indices) => {
      if (indices.length < 2) return;
      const avgCy =
        indices.reduce(
          (sum, idx) => sum + working[idx].y + working[idx].height / 2,
          0
        ) / indices.length;
      const canonicalCy = Math.round(avgCy);
      for (const idx of indices) {
        working[idx].y = Math.round(canonicalCy - working[idx].height / 2);
      }
    });

    // 4. Plumb-align Compensation tasks directly beneath their paired forward task
    for (const edge of edges) {
      if (edge.type !== 'Compensation') continue;
      const si = idxById.get(edge.source);
      const ti = idxById.get(edge.target);
      if (si === undefined || ti === undefined) continue;
      const src = working[si];
      const tgt = working[ti];
      const srcCx = src.x + src.width / 2;
      const tgtCy = tgt.y + tgt.height / 2;
      const srcCy = src.y + src.height / 2;
      if (tgtCy > srcCy + 40) {
        tgt.x = Math.round(srcCx - tgt.width / 2);
        // Ensure clean vertical gap for the "Compensate" label
        const minCompY = src.y + src.height + 88;
        if (tgt.y < minCompY) {
          tgt.y = minCompY;
        }
      }
    }
  } else {
    // Vertical flowchart mode: snap vertical spine nodes to exact shared centerX
    for (const edge of edges) {
      if (edge.type !== 'Transition' && edge.type !== 'Choice') continue;
      const ai = idxById.get(edge.source);
      const bi = idxById.get(edge.target);
      if (ai === undefined || bi === undefined) continue;
      const a = working[ai];
      const b = working[bi];
      const aCx = a.x + a.width / 2;
      const aCy = a.y + a.height / 2;
      const bCx = b.x + b.width / 2;
      const bCy = b.y + b.height / 2;
      if (Math.abs(bCy - aCy) >= 52 && Math.abs(bCx - aCx) <= 84) {
        union(ai, bi);
      }
    }

    const groups = new Map<number, number[]>();
    for (let i = 0; i < working.length; i += 1) {
      const r = find(i);
      const list = groups.get(r) ?? [];
      list.push(i);
      groups.set(r, list);
    }

    groups.forEach((indices) => {
      if (indices.length < 2) return;
      const avgCx =
        indices.reduce(
          (sum, idx) => sum + working[idx].x + working[idx].width / 2,
          0
        ) / indices.length;
      const canonicalCx = Math.round(avgCx);
      for (const idx of indices) {
        working[idx].x = Math.round(canonicalCx - working[idx].width / 2);
      }
    });

    // Align compensation tasks horizontally with their forward source on the right
    for (const edge of edges) {
      if (edge.type !== 'Compensation') continue;
      const si = idxById.get(edge.source);
      const ti = idxById.get(edge.target);
      if (si === undefined || ti === undefined) continue;
      const src = working[si];
      const tgt = working[ti];
      const srcCy = src.y + src.height / 2;
      tgt.y = Math.round(srcCy - tgt.height / 2);
      const minCompX = src.x + src.width + 96;
      if (tgt.x < minCompX) {
        tgt.x = minCompX;
      }
    }
  }

  return working;
}

/**
 * Ensures horizontal labeled edges (such as Choice condition expressions) have
 * enough open horizontal breathing space between source and target nodes so
 * labels never cover adjacent nodes.
 */
export function enforceEdgeLabelClearance(
  nodes: SagaNode[],
  edges: SagaEdge[],
  style: AiLayoutStyle = 'horizontal-swimlane'
): SagaNode[] {
  if (nodes.length <= 1 || style === 'vertical-flowchart') {
    return nodes.map((n) => ({ ...n }));
  }

  const working = nodes.map((n) => ({ ...n }));
  const byId = new Map<string, SagaNode>(working.map((n) => [n.id, n]));

  // Sort left-to-right so expanding an earlier gap cascades cleanly downstream
  const labeledForwardEdges = edges
    .filter((e) => e.type === 'Choice' || e.type === 'Default' || e.type === 'Transition')
    .map((e) => ({ edge: e, label: getEdgeLabelText(e) }))
    .filter((item) => item.label.length > 0)
    .sort((a, b) => {
      const sa = byId.get(a.edge.source);
      const sb = byId.get(b.edge.source);
      return (sa?.x ?? 0) - (sb?.x ?? 0);
    });

  for (const { edge, label } of labeledForwardEdges) {
    const src = byId.get(edge.source);
    const tgt = byId.get(edge.target);
    if (!src || !tgt) continue;

    const srcCy = src.y + src.height / 2;
    const tgtCy = tgt.y + tgt.height / 2;
    const srcRight = src.x + src.width;

    // Only expand gaps for same-lane left-to-right edges
    if (Math.abs(srcCy - tgtCy) <= 28 && tgt.x > src.x) {
      const { width: labelW } = estimateEdgeLabelSize(label);
      const requiredGap = Math.min(256, Math.max(92, labelW + 32));
      const actualGap = tgt.x - srcRight;
      if (actualGap < requiredGap) {
        const shiftX = Math.ceil(requiredGap - actualGap);
        const thresholdX = tgt.x - 24;
        for (const n of working) {
          if (n.x >= thresholdX) {
            n.x += shiftX;
          }
        }
      }
    }
  }

  return working;
}

/**
 * Local crossing-reduction pass for exception/rollback/terminal nodes
 * (CompensationTrigger, Fail, Catch/Default targets) so Catch and Default wires
 * avoid crossing each other or slicing across Compensation task boxes.
 */
export function reduceLayoutEdgeCrossings(
  nodes: SagaNode[],
  edges: SagaEdge[],
  meta: SagaGraph['meta'],
  style: AiLayoutStyle = 'horizontal-swimlane'
): SagaNode[] {
  if (nodes.length < 4 || style === 'vertical-flowchart') {
    return nodes.map((n) => ({ ...n }));
  }

  const scoreNodes = (candidate: SagaNode[]): number => {
    const m = computeLayoutMetrics({ meta, nodes: candidate, edges });
    const through = m.nodeThroughEdgeHits ?? 0;
    return (
      m.overlapCount * 100000 +
      through * 6000 +
      m.edgeCrossings * 1500 +
      m.totalEdgeLength * 0.15
    );
  };

  let bestNodes = nodes.map((n) => ({ ...n }));
  let bestScore = scoreNodes(bestNodes);

  const initialMetrics = computeLayoutMetrics({ meta, nodes: bestNodes, edges });
  if (
    initialMetrics.edgeCrossings === 0 &&
    (initialMetrics.nodeThroughEdgeHits ?? 0) === 0
  ) {
    return bestNodes;
  }

  // Identify exception/rollback terminal nodes eligible for clean corridor placement
  const movableIndices: number[] = [];
  bestNodes.forEach((n, idx) => {
    if (n.type === 'CompensationTrigger' || n.type === 'Fail') {
      movableIndices.push(idx);
    }
  });
  if (movableIndices.length === 0) return bestNodes;

  // Compute reference corridor X anchors and Y lanes from the fixed structure
  const fixedNodes = bestNodes.filter(
    (n) => n.type !== 'CompensationTrigger' && n.type !== 'Fail'
  );
  if (fixedNodes.length === 0) return bestNodes;

  const topLaneBottom = Math.min(
    ...fixedNodes.map((n) => n.y + n.height)
  );
  const compNodes = fixedNodes.filter((n) => n.isForCompensation);
  const compLaneCenterY =
    compNodes.length > 0
      ? Math.round(
          compNodes.reduce((s, n) => s + n.y + n.height / 2, 0) / compNodes.length
        )
      : topLaneBottom + 148;
  const maxFixedBottom = Math.max(...fixedNodes.map((n) => n.y + n.height));

  const candidateLaneCys = [
    compLaneCenterY,
    Math.round(maxFixedBottom + 96),
    Math.round(maxFixedBottom + 206),
  ];

  const getCandidateCxs = (node: SagaNode): number[] => {
    const incomingSources = edges
      .filter((e) => e.target === node.id)
      .map((e) => bestNodes.find((n) => n.id === e.source))
      .filter((n): n is SagaNode => Boolean(n));

    const cxs = new Set<number>();
    cxs.add(Math.round(node.x + node.width / 2));

    if (incomingSources.length > 0) {
      const avgSrcCx = Math.round(
        incomingSources.reduce((s, n) => s + n.x + n.width / 2, 0) /
          incomingSources.length
      );
      cxs.add(avgSrcCx);
      for (const s of incomingSources) {
        if (s.type === 'Choice' || s.type === 'CompensationTrigger') {
          cxs.add(Math.round(s.x + s.width / 2));
        }
      }
    }

    // Also include Choice node centerX as a prime central gutter anchor
    for (const n of fixedNodes) {
      if (n.type === 'Choice') {
        cxs.add(Math.round(n.x + n.width / 2));
      }
    }

    return Array.from(cxs);
  };

  // Joint coordinate-descent search across movable exception/terminal nodes (small set: typically 1-3 nodes)
  for (let pass = 0; pass < 2; pass += 1) {
    let improvedInPass = false;

    // 1. Try swapping centers of any pair of movable nodes (e.g. Fail <-> CompensationTrigger)
    for (let a = 0; a < movableIndices.length; a += 1) {
      for (let b = a + 1; b < movableIndices.length; b += 1) {
        const ia = movableIndices[a];
        const ib = movableIndices[b];
        const cand = bestNodes.map((n) => ({ ...n }));
        const aCx = cand[ia].x + cand[ia].width / 2;
        const aCy = cand[ia].y + cand[ia].height / 2;
        const bCx = cand[ib].x + cand[ib].width / 2;
        const bCy = cand[ib].y + cand[ib].height / 2;

        cand[ia].x = Math.round(bCx - cand[ia].width / 2);
        cand[ia].y = Math.round(bCy - cand[ia].height / 2);
        cand[ib].x = Math.round(aCx - cand[ib].width / 2);
        cand[ib].y = Math.round(aCy - cand[ib].height / 2);

        const s = scoreNodes(cand);
        if (s + 1 < bestScore) {
          bestScore = s;
          bestNodes = cand;
          improvedInPass = true;
        }
      }
    }

    // 2. Try single-node corridor anchors
    for (const idx of movableIndices) {
      const targetNode = bestNodes[idx];
      const cxOptions = getCandidateCxs(targetNode);
      for (const cx of cxOptions) {
        for (const cy of candidateLaneCys) {
          const cand = bestNodes.map((n) => ({ ...n }));
          cand[idx].x = Math.round(cx - cand[idx].width / 2);
          cand[idx].y = Math.round(cy - cand[idx].height / 2);
          const s = scoreNodes(cand);
          if (s + 1 < bestScore) {
            bestScore = s;
            bestNodes = cand;
            improvedInPass = true;
          }
        }
      }
    }

    // 3. Joint two-node placement (handles classic Choice->Fail + Catch->CompensationTrigger->Fail)
    if (movableIndices.length === 2) {
      const [i0, i1] = movableIndices;
      const cxs = Array.from(
        new Set([
          ...getCandidateCxs(bestNodes[i0]),
          ...getCandidateCxs(bestNodes[i1]),
        ])
      ).slice(0, 5);
      for (const cx0 of cxs) {
        for (const cy0 of candidateLaneCys) {
          for (const cx1 of cxs) {
            for (const cy1 of candidateLaneCys) {
              if (cx0 === cx1 && cy0 === cy1) continue;
              const cand = bestNodes.map((n) => ({ ...n }));
              cand[i0].x = Math.round(cx0 - cand[i0].width / 2);
              cand[i0].y = Math.round(cy0 - cand[i0].height / 2);
              cand[i1].x = Math.round(cx1 - cand[i1].width / 2);
              cand[i1].y = Math.round(cy1 - cand[i1].height / 2);
              const s = scoreNodes(cand);
              if (s + 1 < bestScore) {
                bestScore = s;
                bestNodes = cand;
                improvedInPass = true;
              }
            }
          }
        }
      }
    }

    if (!improvedInPass) break;
  }

  return bestNodes;
}

/**
 * Applies AI-suggested node coordinates to an existing SagaGraph while strictly
 * preserving every node's Seata properties, all edges, machine meta, and YAML
 * comments (`yamlTemplate`). Automatically fills omitted nodes and resolves any
 * AABB overlaps deterministically.
 */
export function applyAiLayoutToGraph(
  graph: SagaGraph,
  positions: AiLayoutNodePosition[],
  options?: {
    style?: AiLayoutStyle;
    resolveOverlaps?: boolean;
  }
): SagaGraph {
  const posMap = new Map<string, AiLayoutNodePosition>();
  for (const pos of positions) {
    if (
      pos &&
      typeof pos.id === 'string' &&
      Number.isFinite(pos.x) &&
      Number.isFinite(pos.y)
    ) {
      posMap.set(pos.id, {
        id: pos.id,
        x: Math.max(-5000, Math.min(20000, pos.x)),
        y: Math.max(-5000, Math.min(20000, pos.y)),
        lane: pos.lane,
      });
    }
  }

  // Compute safe fallback anchor for any node omitted by the model
  const placedCoords = Array.from(posMap.values());
  const maxPlacedX =
    placedCoords.length > 0 ? Math.max(...placedCoords.map((p) => p.x)) : 80;
  const minPlacedY =
    placedCoords.length > 0 ? Math.min(...placedCoords.map((p) => p.y)) : 120;

  let omittedIndex = 0;
  const positionedNodes: SagaNode[] = graph.nodes.map((node) => {
    const suggested = posMap.get(node.id);
    if (suggested) {
      return {
        ...node,
        x: snapToGrid(suggested.x, GRID_STEP),
        y: snapToGrid(suggested.y, GRID_STEP),
      };
    }

    // Try placing omitted node near a connected neighbor that *was* placed
    const neighborEdge = graph.edges.find(
      (e) =>
        (e.source === node.id && posMap.has(e.target)) ||
        (e.target === node.id && posMap.has(e.source))
    );
    if (neighborEdge) {
      const anchorId =
        neighborEdge.source === node.id
          ? neighborEdge.target
          : neighborEdge.source;
      const anchorPos = posMap.get(anchorId)!;
      const offsetY = neighborEdge.type === 'Compensation' ? 140 : 120;
      const offsetX = neighborEdge.source === node.id ? -220 : 220;
      return {
        ...node,
        x: snapToGrid(anchorPos.x + offsetX, GRID_STEP),
        y: snapToGrid(anchorPos.y + offsetY, GRID_STEP),
      };
    }

    omittedIndex += 1;
    return {
      ...node,
      x: snapToGrid(maxPlacedX + 240, GRID_STEP),
      y: snapToGrid(minPlacedY + omittedIndex * 120, GRID_STEP),
    };
  });

  const style = options?.style ?? 'horizontal-swimlane';
  const baseGraph: SagaGraph = {
    meta: { ...graph.meta },
    nodes: positionedNodes,
    edges: graph.edges.map((e) => ({ ...e })),
    ...(graph.yamlTemplate !== undefined
      ? { yamlTemplate: graph.yamlTemplate }
      : {}),
  };

  if (options?.resolveOverlaps === false) {
    return baseGraph;
  }

  return refineGraphLayout(baseGraph, style);
}

/**
 * Deterministic geometric post-processor shared by both AI Layout and local
 * Auto Layout: aligns horizontal/vertical swimlane centerlines to 0px drift,
 * ensures generous horizontal breathing room for Choice condition labels,
 * plumb-aligns Compensation tasks under their paired forward tasks, and
 * minimizes edge crossings and node-through hits.
 */
export function refineGraphLayout(
  graph: SagaGraph,
  style: AiLayoutStyle = 'horizontal-swimlane'
): SagaGraph {
  const padding = style === 'compact-executive' ? 28 : DEFAULT_COLLISION_PADDING;
  const preferVerticalSplit = style === 'vertical-flowchart';

  // 1. Align main spine swimlanes by exact center axis & plumb-align compensations
  let finalNodes = alignSwimlanesByCenter(graph.nodes, graph.edges, style);
  // 2. Ensure labeled horizontal edges (e.g. Choice expressions) have breathing room
  finalNodes = enforceEdgeLabelClearance(finalNodes, graph.edges, style);
  // 3. Resolve any node overlaps while preserving swimlane centerlines
  finalNodes = resolveNodeOverlaps(finalNodes, {
    padding,
    preferVerticalSplit,
  });
  // 4. Re-lock exact centerline & compensation plumb alignment after collision nudges
  finalNodes = alignSwimlanesByCenter(finalNodes, graph.edges, style);
  // 5. Optimize exception/terminal node positions to minimize edge crossings & node hits
  finalNodes = reduceLayoutEdgeCrossings(finalNodes, graph.edges, graph.meta, style);
  // 6. Final origin normalization & zero-overlap safety pass
  finalNodes = resolveNodeOverlaps(finalNodes, {
    padding,
    preferVerticalSplit,
  });

  return {
    meta: { ...graph.meta },
    nodes: finalNodes,
    edges: graph.edges.map((e) => ({ ...e })),
    ...(graph.yamlTemplate !== undefined
      ? { yamlTemplate: graph.yamlTemplate }
      : {}),
  };
}

export function resolveMiniMaxBaseUrl(raw?: string): string {
  const defaultUrl = 'https://api.minimax.io/v1';
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return defaultUrl;
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol !== 'https:' ||
      !ALLOWED_MINIMAX_HOSTS.has(parsed.hostname.toLowerCase())
    ) {
      return defaultUrl;
    }
    const cleanPath = parsed.pathname.replace(/\/+$/, '') || '/v1';
    return `${parsed.origin}${cleanPath}`;
  } catch {
    return defaultUrl;
  }
}

export function resolveMiniMaxModel(
  requestedModel?: string,
  envDefault?: string
): string {
  const reqTrimmed = (requestedModel ?? '').trim();
  if (reqTrimmed && ALLOWED_MINIMAX_MODELS.has(reqTrimmed)) {
    return reqTrimmed;
  }
  const envTrimmed = (envDefault ?? '').trim();
  if (envTrimmed && /^[A-Za-z0-9._-]{1,64}$/.test(envTrimmed)) {
    return envTrimmed;
  }
  return DEFAULT_MINIMAX_MODEL;
}

/**
 * Extracts a JSON object from LLM text output, safely stripping MiniMax
 * `<think>...</think>` blocks and Markdown ```json code fences.
 */
export function extractAiLayoutJsonFromText(
  rawText: string
): Record<string, unknown> | null {
  if (!rawText || typeof rawText !== 'string') return null;

  // Strip reasoning tags if a model includes inline <think> blocks
  let cleaned = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();

  // Strip markdown code fence wrapper if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  }

  const tryParseObject = (candidate: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
    return null;
  };

  const direct = tryParseObject(cleaned);
  if (direct) return direct;

  // Fallback: locate the outermost JSON object braces
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return tryParseObject(cleaned.slice(firstBrace, lastBrace + 1));
  }

  return null;
}

export function validateAiLayoutRequest(body: unknown):
  | {
      ok: true;
      data: {
        graph: SagaGraph;
        style: AiLayoutStyle;
        customPrompt: string;
        locale: Locale;
        model?: string;
      };
    }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }
  const obj = body as Record<string, unknown>;
  const graph = obj.graph as SagaGraph | undefined;
  if (
    !graph ||
    typeof graph !== 'object' ||
    !Array.isArray(graph.nodes) ||
    !Array.isArray(graph.edges) ||
    !graph.meta ||
    typeof graph.meta !== 'object'
  ) {
    return { ok: false, error: 'Valid Saga graph (meta, nodes, edges) is required.' };
  }
  if (graph.nodes.length === 0) {
    return { ok: false, error: 'Graph must contain at least one state node.' };
  }
  if (graph.nodes.length > 200) {
    return { ok: false, error: 'Graph exceeds maximum supported limit of 200 nodes.' };
  }
  if (graph.edges.length > 500) {
    return { ok: false, error: 'Graph exceeds maximum supported limit of 500 edges.' };
  }

  const rawStyle = typeof obj.style === 'string' ? obj.style : 'horizontal-swimlane';
  const style: AiLayoutStyle = VALID_AI_LAYOUT_STYLES.has(rawStyle as AiLayoutStyle)
    ? (rawStyle as AiLayoutStyle)
    : 'horizontal-swimlane';

  const customPrompt =
    typeof obj.customPrompt === 'string'
      ? obj.customPrompt.trim().slice(0, 400)
      : '';

  const locale: Locale = obj.locale === 'en' ? 'en' : 'zh-TW';

  const rawModel = typeof obj.model === 'string' ? obj.model.trim() : '';
  const model = ALLOWED_MINIMAX_MODELS.has(rawModel) ? rawModel : undefined;

  return {
    ok: true,
    data: {
      graph,
      style,
      customPrompt,
      locale,
      model,
    },
  };
}

/**
 * Builds compact semantic system + user prompts for MiniMax LLM layout synthesis.
 */
export function buildAiLayoutPrompts(
  graph: SagaGraph,
  style: AiLayoutStyle,
  customPrompt: string,
  locale: Locale
): { systemInstruction: string; userPrompt: string } {
  const languageDirective =
    locale === 'zh-TW'
      ? 'Write `summary`, `rationale`, and `suggestions` in concise, professional Traditional Chinese (繁體中文).'
      : 'Write `summary`, `rationale`, and `suggestions` in concise, professional English.';

  const styleRules: Record<AiLayoutStyle, string> = {
    'horizontal-swimlane':
      'Arrange the primary business happy path strictly LEFT-to-RIGHT along a primary horizontal swimlane (around y=180, x stepping by ~250px). Place Compensation targets (isForCompensation=true or Compensation edge targets) directly BELOW their paired forward task (around y=360). Place CompensationTrigger, Catch targets, and Fail terminals in a clean lower exception lane (around y=520) or right-hand terminal column so Catch/Compensation wires avoid crossing forward transitions.',
    'vertical-flowchart':
      'Arrange the primary business happy path TOP-to-BOTTOM along a primary vertical spine (around x=260, y stepping by ~150px). Place Choice branches symmetrically left and right of the spine. Align Compensation targets neatly in a right-hand companion column (around x=540) at the same y-level as their paired forward task. Place CompensationTrigger and Fail neatly at the bottom-right rollback lane.',
    'compensation-aligned':
      'Prioritize distributed-transaction auditability: arrange forward ServiceTasks/SubStateMachines in clean left-to-right columns (x stepping by ~260px, y=160), and place EVERY Compensation target at the EXACT same x-coordinate directly beneath its paired forward task (y=340). Place CompensationTrigger and Fail along a bottom rollback rail (y=500) so rollback order is crystal clear.',
    'compact-executive':
      'Optimize for a compact, balanced 16:9 presentation aspect ratio with minimal total wire length and minimal edge crossings. Keep horizontal spacing ~220px and vertical spacing ~130px while respecting node widths (up to 184px) and heights (up to 88px) so zero boxes overlap.',
  };

  const systemInstruction = [
    'You are an expert Apache Seata Saga distributed-transaction architect and graph-layout specialist.',
    'Compute clean, collision-free 2D (x, y) top-left coordinates for every node in a Seata Saga State Machine diagram based on business semantics, control flow, Catch exception routes, and Saga Compensation pairings.',
    'Hard geometric rules:',
    '- Return a position object for EVERY single node ID in the input list (exact string match, no missing IDs, no invented IDs).',
    '- Coordinates represent the TOP-LEFT corner of each node bounding box in pixels (x >= 60, y >= 60).',
    '- Align main spine nodes strictly by their VERTICAL CENTER (y + height/2 must be identical across StartState, ServiceTask, Choice, SubStateMachine, and Succeed on the same horizontal row—do NOT align their top edges).',
    '- Leave generous horizontal spacing (>= 220px clear gap) for edges carrying long Choice expressions so labels never collide with adjacent nodes.',
    '- Place paired Compensation tasks centered directly underneath their forward task (same x + width/2) with >= 100px vertical gap.',
    '- Minimize edge crossings strictly to ZERO whenever planar: route Choice Default and Catch edges into the open central corridor without slicing diagonally across Compensation boxes or each other (e.g. place Fail and CompensationTrigger cleanly in the central corridor beneath Choice).',
    `- Style directive (${style}): ${styleRules[style]}`,
    languageDirective,
    'Be concise: 1 sentence for `summary`, 2-3 short bullets for `rationale`, and 1-2 short actionable tips for `suggestions`.',
    'Output STRICT valid JSON only (no markdown code fences, no extra prose) matching this exact structure:',
    '{"positions":[{"id":"<exactNodeId>","x":160,"y":180,"lane":"main"}],"summary":"...","rationale":["..."],"suggestions":["..."]}',
  ].join('\n');

  const compactGraph = {
    machineName: graph.meta.name,
    comment: graph.meta.comment || undefined,
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      width: n.width,
      height: n.height,
      currentX: Math.round(n.x),
      currentY: Math.round(n.y),
      service:
        n.serviceName && n.serviceMethod
          ? `${n.serviceName}.${n.serviceMethod}`
          : undefined,
      subMachine: n.stateMachineName || undefined,
      isForCompensation: n.isForCompensation || undefined,
      comment: n.comment || undefined,
    })),
    edges: graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      type: e.type,
      expression: e.expression || undefined,
      exceptions: e.exceptions?.length ? e.exceptions : undefined,
      isDefault: e.isDefault || undefined,
    })),
  };

  const userPrompt = [
    `Layout Style: ${style}`,
    customPrompt
      ? `User Custom Layout Instruction: ${customPrompt}`
      : 'User Custom Layout Instruction: (none, apply best practices for this style)',
    'Seata Saga Graph JSON:',
    JSON.stringify(compactGraph),
  ].join('\n\n');

  return { systemInstruction, userPrompt };
}
