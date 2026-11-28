import { Point, SagaEdge, SagaNode } from './types';

export interface RectBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoutedEdge {
  edge: SagaEdge;
  path: string;
  start: Point;
  end: Point;
  control: Point | null;
  labelText: string;
  labelPos: Point;
  labelBox: RectBox | null;
  catchAnchorSide?: 'left' | 'right' | 'center';
}

export function getNodeCenter(node: SagaNode): Point {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

export function getEdgeLabelText(edge: SagaEdge): string {
  if (edge.type === 'Choice') {
    return edge.expression || '[expression]';
  }
  if (edge.type === 'Default') {
    return 'Default';
  }
  if (edge.type === 'Catch') {
    return (edge.exceptions?.[0] || 'Throwable').split('.').pop() || 'Catch';
  }
  if (edge.type === 'Compensation') {
    return 'Compensate';
  }
  return '';
}

export function estimateEdgeLabelSize(labelText: string): { width: number; height: number } {
  const display = labelText.length > 34 ? `${labelText.slice(0, 33)}…` : labelText;
  // Monospace ~10.5px text + horizontal padding (px-2 = 16px) + border
  const width = Math.max(46, Math.round(display.length * 6.6 + 18));
  const height = 22;
  return { width, height };
}

export function getNodeBoundaryPoint(node: SagaNode, toward: Point): Point {
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

export function rectsOverlapArea(a: RectBox, b: RectBox, pad = 0): number {
  const ax1 = a.x - pad;
  const ay1 = a.y - pad;
  const ax2 = a.x + a.width + pad;
  const ay2 = a.y + a.height + pad;

  const bx1 = b.x;
  const by1 = b.y;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;

  const ox = Math.min(ax2, bx2) - Math.max(ax1, bx1);
  const oy = Math.min(ay2, by2) - Math.max(ay1, by1);
  if (ox <= 0 || oy <= 0) return 0;
  return ox * oy;
}

export function pointInRect(p: Point, r: RectBox, pad = 0): boolean {
  return (
    p.x >= r.x - pad &&
    p.x <= r.x + r.width + pad &&
    p.y >= r.y - pad &&
    p.y <= r.y + r.height + pad
  );
}

/**
 * Liang-Barsky segment-rectangle intersection check.
 */
export function segmentIntersectsRect(
  p1: Point,
  p2: Point,
  rect: RectBox,
  pad = 0
): boolean {
  const minX = rect.x - pad;
  const minY = rect.y - pad;
  const maxX = rect.x + rect.width + pad;
  const maxY = rect.y + rect.height + pad;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  let t0 = 0;
  let t1 = 1;

  const checks: Array<[number, number]> = [
    [-dx, p1.x - minX],
    [dx, maxX - p1.x],
    [-dy, p1.y - minY],
    [dy, maxY - p1.y],
  ];

  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-8) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1;
}

function evalQuadratic(start: Point, control: Point | null, end: Point, t: number): Point {
  if (!control) {
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
    };
  }
  const u = 1 - t;
  return {
    x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
    y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
  };
}

function evalQuadraticTangent(start: Point, control: Point | null, end: Point, t: number): Point {
  if (!control) {
    return { x: end.x - start.x, y: end.y - start.y };
  }
  const u = 1 - t;
  return {
    x: 2 * u * (control.x - start.x) + 2 * t * (end.x - control.x),
    y: 2 * u * (control.y - start.y) + 2 * t * (end.y - control.y),
  };
}

/**
 * Returns the visual bounding box of a node, optionally including the external
 * caption rendered below circular/diamond states.
 */
export function getNodeObstacleRect(node: SagaNode, includeCaption = true): RectBox {
  const hasBottomCaption =
    node.type === 'StartState' ||
    node.type === 'Succeed' ||
    node.type === 'Fail' ||
    node.type === 'CompensationTrigger' ||
    node.type === 'Choice';

  if (!includeCaption || !hasBottomCaption) {
    return { x: node.x, y: node.y, width: node.width, height: node.height };
  }

  const captionWidth = Math.max(node.width, Math.round(node.name.length * 7.2 + 12));
  const cx = node.x + node.width / 2;
  return {
    x: Math.min(node.x, cx - captionWidth / 2),
    y: node.y,
    width: Math.max(node.width, captionWidth),
    height: node.height + 24,
  };
}

function countCurveNodeHits(
  start: Point,
  control: Point | null,
  end: Point,
  obstacles: RectBox[]
): number {
  if (obstacles.length === 0) return 0;
  const samples = 14;
  let hits = 0;
  let prev = start;
  for (let i = 1; i <= samples; i += 1) {
    const curr = evalQuadratic(start, control, end, i / samples);
    for (const rect of obstacles) {
      if (segmentIntersectsRect(prev, curr, rect, 8)) {
        hits += 1;
      }
    }
    prev = curr;
  }
  return hits;
}

function buildSmartEndpoints(
  source: SagaNode,
  target: SagaNode,
  edge: SagaEdge
): { start: Point; end: Point; catchAnchorSide?: 'left' | 'right' | 'center' } {
  const srcCenter = getNodeCenter(source);
  const tgtCenter = getNodeCenter(target);

  let start: Point;
  let catchAnchorSide: 'left' | 'right' | 'center' | undefined;
  if (edge.type === 'Catch') {
    // Dynamically pick the bottom Catch anchor facing the target so the wire
    // never crosses back across its own task's Compensation wire!
    const dx = tgtCenter.x - srcCenter.x;
    const anchorRatio = dx < -30 ? 0.16 : dx > 30 ? 0.84 : 0.5;
    catchAnchorSide = dx < -30 ? 'left' : dx > 30 ? 'right' : 'center';
    start = {
      x: source.x + source.width * anchorRatio,
      y: source.y + source.height + 2,
    };
  } else if (edge.type === 'Compensation') {
    const dx = tgtCenter.x - srcCenter.x;
    const dy = tgtCenter.y - srcCenter.y;
    if (Math.abs(dy) >= Math.abs(dx) * 0.7) {
      start = {
        x: srcCenter.x,
        y: dy >= 0 ? source.y + source.height + 2 : source.y - 2,
      };
    } else {
      start = getNodeBoundaryPoint(source, tgtCenter);
    }
  } else {
    start = getNodeBoundaryPoint(source, tgtCenter);
  }

  const end = getNodeBoundaryPoint(target, start);
  return { start, end, catchAnchorSide };
}

/**
 * Computes obstacle-aware SVG paths and collision-free label placements for all
 * edges in a Seata Saga graph. Guarantees edge labels avoid covering nodes and
 * avoid overlapping other edge labels.
 */
export function computeGraphEdgeRoutes(
  nodes: SagaNode[],
  edges: SagaEdge[]
): Map<string, RoutedEdge> {
  const nodeMap = new Map<string, SagaNode>(nodes.map((n) => [n.id, n]));
  const result = new Map<string, RoutedEdge>();

  // Sibling edge grouping for parallel pairs
  const pairCounts = new Map<string, number>();
  const edgeIndices = new Map<string, number>();
  for (const edge of edges) {
    const key = [edge.source, edge.target].sort().join('::');
    const idx = pairCounts.get(key) ?? 0;
    edgeIndices.set(edge.id, idx);
    pairCounts.set(key, idx + 1);
  }

  const allNodeBoxes: Array<{ id: string; body: RectBox; full: RectBox }> =
    nodes.map((n) => ({
      id: n.id,
      body: { x: n.x, y: n.y, width: n.width, height: n.height },
      full: getNodeObstacleRect(n, true),
    }));

  // Phase 1: Route every edge smoothly, bending around any intermediate node box
  const prelim: Array<{
    edge: SagaEdge;
    source: SagaNode;
    target: SagaNode;
    path: string;
    start: Point;
    end: Point;
    control: Point | null;
    labelText: string;
    catchAnchorSide?: 'left' | 'right' | 'center';
  }> = [];

  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;

    const { start, end, catchAnchorSide } = buildSmartEndpoints(source, target, edge);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;

    const pairKey = [edge.source, edge.target].sort().join('::');
    const siblingTotal = pairCounts.get(pairKey) ?? 1;
    const siblingIndex = edgeIndices.get(edge.id) ?? 0;

    const intermediateObstacles = allNodeBoxes
      .filter((b) => b.id !== edge.source && b.id !== edge.target)
      .map((b) => b.body);

    const baseOffset =
      siblingTotal > 1
        ? (siblingIndex - (siblingTotal - 1) / 2) * 38
        : 0;

    const candidateOffsets: number[] =
      Math.abs(baseOffset) >= 1
        ? [baseOffset, baseOffset * 1.6, -baseOffset * 1.6]
        : [0, 34, -34, 68, -68, 108, -108, 152, -152];

    let bestControl: Point | null = null;
    let bestScore = Infinity;

    for (const offset of candidateOffsets) {
      const control: Point | null =
        Math.abs(offset) < 1
          ? null
          : {
              x: (start.x + end.x) / 2 + nx * offset,
              y: (start.y + end.y) / 2 + ny * offset,
            };
      const hits = countCurveNodeHits(start, control, end, intermediateObstacles);
      // Strongly prefer zero obstacle hits, then minimal curvature
      const score = hits * 10000 + Math.abs(offset) * 1.2;
      if (score < bestScore) {
        bestScore = score;
        bestControl = control;
        if (hits === 0 && Math.abs(offset) <= Math.abs(baseOffset) + 1) {
          break;
        }
      }
    }

    const path = bestControl
      ? `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${bestControl.x.toFixed(1)} ${bestControl.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
      : `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;

    prelim.push({
      edge,
      source,
      target,
      path,
      start,
      end,
      control: bestControl,
      labelText: getEdgeLabelText(edge),
      catchAnchorSide,
    });
  }

  // Phase 2: Collision-free label placement (longest labels first so tight
  // Choice expressions claim clean open space before short badges like Catch)
  const placedLabels: RectBox[] = [];
  const labelOrder = [...prelim].sort(
    (a, b) => b.labelText.length - a.labelText.length
  );

  const labelByEdgeId = new Map<string, { pos: Point; box: RectBox | null }>();

  for (const item of labelOrder) {
    if (!item.labelText) {
      const mid = evalQuadratic(item.start, item.control, item.end, 0.5);
      labelByEdgeId.set(item.edge.id, { pos: mid, box: null });
      continue;
    }

    const { width, height } = estimateEdgeLabelSize(item.labelText);
    const isHorizontal =
      Math.abs(item.end.x - item.start.x) > Math.abs(item.end.y - item.start.y) * 1.4;

    const tCandidates =
      item.edge.type === 'Compensation'
        ? [0.5, 0.44, 0.56, 0.38, 0.62]
        : [0.5, 0.42, 0.58, 0.34, 0.66, 0.27, 0.73, 0.2, 0.8];

    // Prefer crisp placement directly above horizontal Choice edges; otherwise
    // test centered on line and perpendicular offsets on both sides, extending
    // out to ±84px if adjacent tall nodes crowd a narrow horizontal gap.
    const normalOffsets =
      item.edge.type === 'Choice' && isHorizontal
        ? [-20, -34, -48, -64, -78, 20, 34, 48, 64, 78, 0]
        : item.edge.type === 'Compensation'
          ? [0, -18, 18, -34, 34, -52, 52]
          : [0, -18, 18, -34, 34, -52, 52, -70, 70, -88, 88];

    let bestPos: Point = evalQuadratic(item.start, item.control, item.end, 0.5);
    let bestBox: RectBox = {
      x: bestPos.x - width / 2,
      y: bestPos.y - height / 2,
      width,
      height,
    };
    let bestCost = Infinity;

    for (const t of tCandidates) {
      const basePt = evalQuadratic(item.start, item.control, item.end, t);
      const tan = evalQuadraticTangent(item.start, item.control, item.end, t);
      const tanLen = Math.hypot(tan.x, tan.y) || 1;
      // Unit normal pointing generally upward when edge goes left->right
      let ux = -tan.y / tanLen;
      let uy = tan.x / tanLen;
      if (isHorizontal && uy > 0) {
        ux = -ux;
        uy = -uy;
      }

      for (const offset of normalOffsets) {
        const cx = isHorizontal && item.edge.type === 'Choice'
          ? basePt.x
          : basePt.x + ux * offset;
        const cy = isHorizontal && item.edge.type === 'Choice'
          ? basePt.y + offset
          : basePt.y + uy * offset;

        const box: RectBox = {
          x: cx - width / 2,
          y: cy - height / 2,
          width,
          height,
        };

        let nodePenalty = 0;
        for (const nb of allNodeBoxes) {
          const area = rectsOverlapArea(box, nb.full, 6);
          if (area > 0) {
            nodePenalty += 50000 + area * 120;
          }
        }

        let labelPenalty = 0;
        for (const other of placedLabels) {
          const area = rectsOverlapArea(box, other, 5);
          if (area > 0) {
            labelPenalty += 20000 + area * 80;
          }
        }

        const driftPenalty = Math.abs(t - 0.5) * 140 + Math.abs(offset) * 2.2;
        const totalCost = nodePenalty + labelPenalty + driftPenalty;

        if (totalCost < bestCost) {
          bestCost = totalCost;
          bestPos = { x: Math.round(cx), y: Math.round(cy) };
          bestBox = box;
        }
      }
    }

    placedLabels.push(bestBox);
    labelByEdgeId.set(item.edge.id, { pos: bestPos, box: bestBox });
  }

  for (const item of prelim) {
    const placed = labelByEdgeId.get(item.edge.id);
    result.set(item.edge.id, {
      edge: item.edge,
      path: item.path,
      start: item.start,
      end: item.end,
      control: item.control,
      labelText: item.labelText,
      labelPos: placed?.pos ?? evalQuadratic(item.start, item.control, item.end, 0.5),
      labelBox: placed?.box ?? null,
      catchAnchorSide: item.catchAnchorSide,
    });
  }

  return result;
}

/**
 * Counts how many non-incident edges slice through unrelated node bounding boxes.
 */
export function countEdgesPassingThroughNodes(
  nodes: SagaNode[],
  edges: SagaEdge[]
): number {
  const nodeMap = new Map<string, SagaNode>(nodes.map((n) => [n.id, n]));
  let count = 0;
  for (const edge of edges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;
    const { start, end } = buildSmartEndpoints(src, tgt, edge);
    for (const node of nodes) {
      if (node.id === edge.source || node.id === edge.target) continue;
      const box = { x: node.x, y: node.y, width: node.width, height: node.height };
      if (segmentIntersectsRect(start, end, box, 4)) {
        count += 1;
      }
    }
  }
  return count;
}
