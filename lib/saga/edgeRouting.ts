import { EdgeAnchorOverride, NodeAnchorSide, Point, SagaEdge, SagaNode } from './types';

export interface RectBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoutedCatchAnchor {
  side: NodeAnchorSide;
  ratio: number;
  borderPoint: Point;
  isCustom: boolean;
}

export interface RoutedEdge {
  edge: SagaEdge;
  path: string;
  start: Point;
  end: Point;
  control: Point | null;
  waypoints?: Point[];
  labelText: string;
  labelPos: Point;
  labelBox: RectBox | null;
  catchAnchor?: RoutedCatchAnchor;
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

function isCircularNode(node: SagaNode): boolean {
  return (
    node.type === 'StartState' ||
    node.type === 'Succeed' ||
    node.type === 'Fail' ||
    node.type === 'CompensationTrigger'
  );
}

export function getNodeBoundaryPoint(node: SagaNode, toward: Point): Point {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;

  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  if (isCircularNode(node)) {
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

function clampAnchorRatio(side: NodeAnchorSide, ratio: number): number {
  const safe = Number.isFinite(ratio) ? ratio : 0.5;
  if (side === 'top' || side === 'bottom') {
    return Math.min(0.86, Math.max(0.14, safe));
  }
  return Math.min(0.8, Math.max(0.2, safe));
}

export function getSideOutwardNormal(side: NodeAnchorSide): Point {
  switch (side) {
    case 'top':
      return { x: 0, y: -1 };
    case 'right':
      return { x: 1, y: 0 };
    case 'bottom':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
  }
}

/**
 * Projects an arbitrary canvas point onto the nearest point on a node's
 * perimeter, returning a normalized side + ratio suitable for BPMN boundary
 * event dragging.
 */
export function projectPointToNodePerimeter(
  node: SagaNode,
  pt: Point
): EdgeAnchorOverride {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const dx = pt.x - cx;
  const dy = pt.y - cy;

  const hw = Math.max(1, node.width / 2);
  const hh = Math.max(1, node.height / 2);
  const normX = Math.abs(dx) / hw;
  const normY = Math.abs(dy) / hh;

  let side: NodeAnchorSide;
  if (normX > normY) {
    side = dx >= 0 ? 'right' : 'left';
  } else {
    side = dy >= 0 ? 'bottom' : 'top';
  }

  let rawRatio: number;
  if (side === 'top' || side === 'bottom') {
    rawRatio = (pt.x - node.x) / Math.max(1, node.width);
  } else {
    rawRatio = (pt.y - node.y) / Math.max(1, node.height);
  }

  return {
    side,
    ratio: Number(clampAnchorRatio(side, rawRatio).toFixed(3)),
  };
}

/**
 * Resolves a side + normalized ratio into exact border coordinates (for the
 * BPMN boundary marker) and slightly outward wire start coordinates.
 */
export function resolveAnchorPointOnNode(
  node: SagaNode,
  anchor: EdgeAnchorOverride,
  outwardOffset = 2
): { borderPoint: Point; wireStart: Point; ratio: number } {
  const ratio = clampAnchorRatio(anchor.side, anchor.ratio);
  const normal = getSideOutwardNormal(anchor.side);

  let borderPoint: Point;
  if (isCircularNode(node)) {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const r = Math.min(node.width, node.height) / 2;
    // Map side + ratio onto an arc along the circle perimeter
    const spread = (ratio - 0.5) * (Math.PI * 0.45);
    const baseAngle =
      anchor.side === 'right'
        ? 0
        : anchor.side === 'bottom'
          ? Math.PI / 2
          : anchor.side === 'left'
            ? Math.PI
            : -Math.PI / 2;
    const angle =
      anchor.side === 'top' || anchor.side === 'right'
        ? baseAngle + spread
        : baseAngle - spread;
    borderPoint = {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    };
    const wireStart = {
      x: cx + Math.cos(angle) * (r + outwardOffset),
      y: cy + Math.sin(angle) * (r + outwardOffset),
    };
    return { borderPoint, wireStart, ratio };
  }

  if (anchor.side === 'top') {
    borderPoint = { x: node.x + node.width * ratio, y: node.y };
  } else if (anchor.side === 'bottom') {
    borderPoint = { x: node.x + node.width * ratio, y: node.y + node.height };
  } else if (anchor.side === 'left') {
    borderPoint = { x: node.x, y: node.y + node.height * ratio };
  } else {
    borderPoint = { x: node.x + node.width, y: node.y + node.height * ratio };
  }

  const wireStart = {
    x: borderPoint.x + normal.x * outwardOffset,
    y: borderPoint.y + normal.y * outwardOffset,
  };

  return { borderPoint, wireStart, ratio };
}

function getEdgeExitSideAndRatio(
  source: SagaNode,
  target: SagaNode,
  edge: SagaEdge
): { side: NodeAnchorSide; ratio: number } {
  const srcCenter = getNodeCenter(source);
  const tgtCenter = getNodeCenter(target);
  const dx = tgtCenter.x - srcCenter.x;
  const dy = tgtCenter.y - srcCenter.y;

  if (edge.type === 'Compensation' && Math.abs(dy) >= Math.abs(dx) * 0.7) {
    return { side: dy >= 0 ? 'bottom' : 'top', ratio: 0.5 };
  }

  const hw = Math.max(1, source.width / 2);
  const hh = Math.max(1, source.height / 2);
  const normX = Math.abs(dx) / hw;
  const normY = Math.abs(dy) / hh;

  if (normX > normY) {
    const side: NodeAnchorSide = dx >= 0 ? 'right' : 'left';
    const intersectY = srcCenter.y + dy * (hw / Math.max(1, Math.abs(dx)));
    const ratio = clampAnchorRatio(side, (intersectY - source.y) / Math.max(1, source.height));
    return { side, ratio };
  }

  const side: NodeAnchorSide = dy >= 0 ? 'bottom' : 'top';
  const intersectX = srcCenter.x + dx * (hh / Math.max(1, Math.abs(dy)));
  const ratio = clampAnchorRatio(side, (intersectX - source.x) / Math.max(1, source.width));
  return { side, ratio };
}

/**
 * Dynamically selects the optimal 360° perimeter side and offset for a Catch
 * edge facing its target node while avoiding collisions with sibling outgoing
 * Compensation or Transition wires on the same border.
 */
export function computeAutoCatchAnchor(
  source: SagaNode,
  target: SagaNode,
  siblingOutgoing: Array<{ edge: SagaEdge; target: SagaNode }>
): EdgeAnchorOverride {
  const srcCenter = getNodeCenter(source);
  const tgtCenter = getNodeCenter(target);
  const dx = tgtCenter.x - srcCenter.x;
  const dy = tgtCenter.y - srcCenter.y;

  const hw = Math.max(1, source.width / 2);
  const hh = Math.max(1, source.height / 2);
  const normX = Math.abs(dx) / hw;
  const normY = Math.abs(dy) / hh;

  let side: NodeAnchorSide;
  let ratio: number;

  if (normX > normY) {
    side = dx >= 0 ? 'right' : 'left';
    const intersectY = srcCenter.y + dy * (hw / Math.max(1, Math.abs(dx)));
    ratio = clampAnchorRatio(side, (intersectY - source.y) / Math.max(1, source.height));
  } else {
    side = dy >= 0 ? 'bottom' : 'top';
    const intersectX = srcCenter.x + dx * (hh / Math.max(1, Math.abs(dy)));
    ratio = clampAnchorRatio(side, (intersectX - source.x) / Math.max(1, source.width));
  }

  // Avoid colliding with non-Catch outgoing wires (e.g. Compensation on bottom-center
  // or primary Transition on right-center)
  const occupiedOnSameSide = siblingOutgoing
    .filter((s) => s.edge.type !== 'Catch')
    .map((s) => getEdgeExitSideAndRatio(source, s.target, s.edge))
    .filter((exit) => exit.side === side);

  if (occupiedOnSameSide.length > 0) {
    const conflicts = occupiedOnSameSide.some(
      (exit) => Math.abs(exit.ratio - ratio) < 0.24
    );
    if (conflicts) {
      if (side === 'top' || side === 'bottom') {
        const preferred = dx < -12 ? 0.16 : dx > 12 ? 0.84 : 0.84;
        const alt = preferred < 0.5 ? 0.84 : 0.16;
        const preferredClear = occupiedOnSameSide.every(
          (exit) => Math.abs(exit.ratio - preferred) >= 0.2
        );
        ratio = preferredClear ? preferred : alt;
      } else {
        const preferred = dy < -12 ? 0.22 : dy > 12 ? 0.78 : 0.78;
        const alt = preferred < 0.5 ? 0.78 : 0.22;
        const preferredClear = occupiedOnSameSide.every(
          (exit) => Math.abs(exit.ratio - preferred) >= 0.2
        );
        ratio = preferredClear ? preferred : alt;
      }
    }
  }

  return { side, ratio: Number(clampAnchorRatio(side, ratio).toFixed(3)) };
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
  obstacles: RectBox[],
  selfInteriorObstacle?: RectBox
): number {
  if (obstacles.length === 0 && !selfInteriorObstacle) return 0;
  const samples = 16;
  let hits = 0;
  let prev = start;
  for (let i = 1; i <= samples; i += 1) {
    const curr = evalQuadratic(start, control, end, i / samples);
    for (const rect of obstacles) {
      if (segmentIntersectsRect(prev, curr, rect, 8)) {
        hits += 1;
      }
    }
    if (selfInteriorObstacle && i >= 2 && segmentIntersectsRect(prev, curr, selfInteriorObstacle, 0)) {
      hits += 2;
    }
    prev = curr;
  }
  return hits;
}

function resolveAllCatchAnchors(
  nodes: SagaNode[],
  edges: SagaEdge[]
): Map<string, RoutedCatchAnchor> {
  const nodeMap = new Map<string, SagaNode>(nodes.map((n) => [n.id, n]));
  const outgoingBySource = new Map<string, Array<{ edge: SagaEdge; target: SagaNode }>>();
  for (const edge of edges) {
    const target = nodeMap.get(edge.target);
    if (!target) continue;
    const list = outgoingBySource.get(edge.source) ?? [];
    list.push({ edge, target });
    outgoingBySource.set(edge.source, list);
  }

  // Initial anchor assignment per Catch edge
  const draft = new Map<
    string,
    {
      edge: SagaEdge;
      source: SagaNode;
      target: SagaNode;
      side: NodeAnchorSide;
      ratio: number;
      isCustom: boolean;
    }
  >();

  for (const edge of edges) {
    if (edge.type !== 'Catch') continue;
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;

    if (edge.sourceAnchor) {
      draft.set(edge.id, {
        edge,
        source,
        target,
        side: edge.sourceAnchor.side,
        ratio: clampAnchorRatio(edge.sourceAnchor.side, edge.sourceAnchor.ratio),
        isCustom: true,
      });
    } else {
      const siblings = outgoingBySource.get(edge.source) ?? [];
      const auto = computeAutoCatchAnchor(source, target, siblings);
      draft.set(edge.id, {
        edge,
        source,
        target,
        side: auto.side,
        ratio: auto.ratio,
        isCustom: false,
      });
    }
  }

  // Spread multiple auto-anchored Catch edges that crowd the same border side
  const groups = new Map<string, Array<{ edgeId: string; side: NodeAnchorSide }>>();
  draft.forEach((item, edgeId) => {
    if (item.isCustom) return;
    const key = `${item.source.id}::${item.side}`;
    const list = groups.get(key) ?? [];
    list.push({ edgeId, side: item.side });
    groups.set(key, list);
  });

  groups.forEach((entries) => {
    if (entries.length < 2) return;
    const items = entries.map((e) => ({ edgeId: e.edgeId, data: draft.get(e.edgeId)! }));
    const isHorizontal = items[0].data.side === 'top' || items[0].data.side === 'bottom';

    // Order left-to-right (or top-to-bottom) by target center so wires don't cross
    items.sort((a, b) => {
      const ca = getNodeCenter(a.data.target);
      const cb = getNodeCenter(b.data.target);
      return isHorizontal ? ca.x - cb.x : ca.y - cb.y;
    });

    const tooClose = items.some(
      (it, idx) =>
        idx > 0 && Math.abs(it.data.ratio - items[idx - 1].data.ratio) < 0.24
    );
    if (tooClose) {
      const minR = isHorizontal ? 0.18 : 0.22;
      const maxR = isHorizontal ? 0.82 : 0.78;
      const step = (maxR - minR) / Math.max(1, items.length - 1);
      items.forEach((it, idx) => {
        it.data.ratio = Number((minR + idx * step).toFixed(3));
      });
    }
  });

  const resolved = new Map<string, RoutedCatchAnchor>();
  draft.forEach((item, edgeId) => {
    const { borderPoint, ratio } = resolveAnchorPointOnNode(item.source, {
      side: item.side,
      ratio: item.ratio,
    });
    resolved.set(edgeId, {
      side: item.side,
      ratio,
      borderPoint,
      isCustom: item.isCustom,
    });
  });

  return resolved;
}

function buildSmartEndpoints(
  source: SagaNode,
  target: SagaNode,
  edge: SagaEdge,
  catchAnchor?: RoutedCatchAnchor
): { start: Point; end: Point; catchAnchor?: RoutedCatchAnchor } {
  const srcCenter = getNodeCenter(source);
  const tgtCenter = getNodeCenter(target);

  let start: Point;
  let resolvedCatchAnchor = catchAnchor;
  if (edge.type === 'Catch') {
    if (!resolvedCatchAnchor) {
      const fallback = edge.sourceAnchor ?? computeAutoCatchAnchor(source, target, []);
      const pts = resolveAnchorPointOnNode(source, fallback);
      resolvedCatchAnchor = {
        side: fallback.side,
        ratio: pts.ratio,
        borderPoint: pts.borderPoint,
        isCustom: Boolean(edge.sourceAnchor),
      };
      start = pts.wireStart;
    } else {
      const pts = resolveAnchorPointOnNode(source, {
        side: resolvedCatchAnchor.side,
        ratio: resolvedCatchAnchor.ratio,
      });
      start = pts.wireStart;
    }
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
  return { start, end, catchAnchor: resolvedCatchAnchor };
}

/**
 * Computes candidate horizontal routing corridors (open gutters between
 * horizontal swimlane bands + outer top/bottom bypass channels).
 */
function computeOpenHorizontalCorridors(nodes: SagaNode[]): number[] {
  if (nodes.length === 0) return [];
  const intervals = nodes
    .map((n) => {
      const hasExtLabel =
        n.type === 'Choice' ||
        n.type === 'StartState' ||
        n.type === 'Succeed' ||
        n.type === 'Fail' ||
        n.type === 'CompensationTrigger';
      return {
        top: n.y,
        bottom: n.y + n.height + (hasExtLabel ? 20 : 0),
      };
    })
    .sort((a, b) => a.top - b.top);

  const merged: Array<{ top: number; bottom: number }> = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (!last || iv.top > last.bottom + 14) {
      merged.push({ ...iv });
    } else if (iv.bottom > last.bottom) {
      last.bottom = iv.bottom;
    }
  }

  const corridors: number[] = [];
  const globalTop = merged[0].top;
  const globalBottom = merged[merged.length - 1].bottom;

  corridors.push(Math.round(globalTop - 36));
  corridors.push(Math.round(globalTop - 68));

  for (let i = 0; i < merged.length - 1; i += 1) {
    const gapTop = merged[i].bottom;
    const gapBottom = merged[i + 1].top;
    if (gapBottom - gapTop >= 22) {
      corridors.push(Math.round((gapTop + gapBottom) / 2));
    }
  }

  corridors.push(Math.round(globalBottom + 36));
  corridors.push(Math.round(globalBottom + 68));
  return corridors;
}

function countPolylineNodeHits(
  points: Point[],
  obstacles: RectBox[],
  selfInterior?: RectBox
): number {
  let hits = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    for (const obs of obstacles) {
      if (segmentIntersectsRect(a, b, obs, 5)) {
        hits += 1;
      }
    }
    if (selfInterior && segmentIntersectsRect(a, b, selfInterior, 0)) {
      hits += 1;
    }
  }
  return hits;
}

function polylineLength(points: Point[]): number {
  let len = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    len += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  return len;
}

/**
 * Converts a polyline into a crisp SVG path with rounded quadratic corners.
 */
function buildRoundedPolylinePath(points: Point[], radius = 14): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  const cmds: string[] = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];

  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const d1 = Math.hypot(v1x, v1y);
    const d2 = Math.hypot(v2x, v2y);

    if (d1 < 2 || d2 < 2) {
      cmds.push(`L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`);
      continue;
    }

    const r = Math.min(radius, d1 * 0.42, d2 * 0.42);
    const p1x = curr.x + (v1x / d1) * r;
    const p1y = curr.y + (v1y / d1) * r;
    const p2x = curr.x + (v2x / d2) * r;
    const p2y = curr.y + (v2y / d2) * r;

    cmds.push(`L ${p1x.toFixed(1)} ${p1y.toFixed(1)}`);
    cmds.push(
      `Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)} ${p2x.toFixed(1)} ${p2y.toFixed(1)}`
    );
  }

  const last = points[points.length - 1];
  cmds.push(`L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`);
  return cmds.join(' ');
}

function evalPolylineAt(points: Point[], t: number): { pt: Point; tangent: Point } {
  const total = polylineLength(points);
  if (points.length < 2 || total < 1e-3) {
    return {
      pt: points[0] ?? { x: 0, y: 0 },
      tangent: { x: 1, y: 0 },
    };
  }
  const targetDist = Math.min(1, Math.max(0, t)) * total;
  let accum = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (accum + segLen >= targetDist || i === points.length - 2) {
      const localT = segLen > 1e-3 ? (targetDist - accum) / segLen : 0;
      return {
        pt: {
          x: a.x + (b.x - a.x) * localT,
          y: a.y + (b.y - a.y) * localT,
        },
        tangent: {
          x: b.x - a.x,
          y: b.y - a.y,
        },
      };
    }
    accum += segLen;
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return { pt: last, tangent: { x: last.x - prev.x, y: last.y - prev.y } };
}

/**
 * Finds an obstacle-free horizontal corridor polyline when straight and
 * quadratic Bezier arcs still intersect intermediate node boxes.
 */
function routeObstacleFreeCorridor(
  source: SagaNode,
  target: SagaNode,
  edge: SagaEdge,
  baseStart: Point,
  catchAnchor: RoutedCatchAnchor | undefined,
  corridors: number[],
  intermediateObstacles: RectBox[],
  selfInteriorObstacle: RectBox | undefined,
  corridorSlotIndex: number
): { waypoints: Point[]; start: Point; end: Point; path: string } | null {
  if (corridors.length === 0) return null;

  const srcCenter = getNodeCenter(source);
  const tgtCenter = getNodeCenter(target);
  const avgY = (srcCenter.y + tgtCenter.y) / 2;
  const slotShift = ((corridorSlotIndex % 5) - 2) * 10;

  let bestWaypoints: Point[] | null = null;
  let bestScore = Infinity;

  const isGoingRight = tgtCenter.x >= srcCenter.x;
  const exitHorizontalOffsets = isGoingRight ? [0, 26, -26] : [0, -26, 26];
  const entryHorizontalOffsets = isGoingRight ? [0, -26, 26] : [0, 26, -26];

  for (const rawChannelY of corridors) {
    const channelY = Math.round(rawChannelY + slotShift);
    const channelAboveSrc = channelY < srcCenter.y;
    const channelAboveTgt = channelY < tgtCenter.y;

    for (const exitDx of exitHorizontalOffsets) {
      let startPt: Point;
      let firstElbow: Point;

      if (edge.type === 'Catch' && catchAnchor) {
        startPt = baseStart;
        if (catchAnchor.side === 'left' || catchAnchor.side === 'right') {
          const outDir = catchAnchor.side === 'right' ? 1 : -1;
          const stubX = startPt.x + outDir * 24;
          firstElbow = { x: stubX, y: channelY };
        } else {
          firstElbow = { x: startPt.x, y: channelY };
        }
      } else if (exitDx === 0) {
        startPt = {
          x: srcCenter.x,
          y: channelAboveSrc ? source.y - 2 : source.y + source.height + 2,
        };
        firstElbow = { x: startPt.x, y: channelY };
      } else {
        const exitRight = exitDx > 0;
        startPt = {
          x: exitRight ? source.x + source.width + 2 : source.x - 2,
          y: srcCenter.y,
        };
        firstElbow = { x: startPt.x + exitDx, y: channelY };
      }

      for (const entryDx of entryHorizontalOffsets) {
        let endPt: Point;
        let lastElbow: Point;

        if (entryDx === 0) {
          endPt = {
            x: tgtCenter.x,
            y: channelAboveTgt ? target.y - 2 : target.y + target.height + 2,
          };
          lastElbow = { x: endPt.x, y: channelY };
        } else {
          const enterLeft = entryDx < 0;
          endPt = {
            x: enterLeft ? target.x - 2 : target.x + target.width + 2,
            y: tgtCenter.y,
          };
          lastElbow = { x: endPt.x + entryDx, y: channelY };
        }

        const pts: Point[] =
          exitDx !== 0 || (catchAnchor && (catchAnchor.side === 'left' || catchAnchor.side === 'right'))
            ? [
                startPt,
                { x: firstElbow.x, y: startPt.y },
                firstElbow,
                lastElbow,
                ...(entryDx !== 0 ? [{ x: lastElbow.x, y: endPt.y }] : []),
                endPt,
              ]
            : [
                startPt,
                firstElbow,
                lastElbow,
                ...(entryDx !== 0 ? [{ x: lastElbow.x, y: endPt.y }] : []),
                endPt,
              ];

        // Deduplicate tiny adjacent identical points
        const cleanPts: Point[] = [pts[0]];
        for (let k = 1; k < pts.length; k += 1) {
          const prev = cleanPts[cleanPts.length - 1];
          if (Math.hypot(pts[k].x - prev.x, pts[k].y - prev.y) > 2) {
            cleanPts.push(pts[k]);
          }
        }
        if (cleanPts.length < 2) continue;

        const hits = countPolylineNodeHits(
          cleanPts,
          intermediateObstacles,
          selfInteriorObstacle
        );
        if (hits > 0 && bestScore < 10000) continue;

        const len = polylineLength(cleanPts);
        const verticalDrift = Math.abs(channelY - avgY);
        const score = hits * 10000 + len + verticalDrift * 1.15;

        if (score < bestScore) {
          bestScore = score;
          bestWaypoints = cleanPts;
        }
      }
    }
  }

  if (!bestWaypoints || bestScore >= 10000) return null;

  return {
    waypoints: bestWaypoints,
    start: bestWaypoints[0],
    end: bestWaypoints[bestWaypoints.length - 1],
    path: buildRoundedPolylinePath(bestWaypoints, 14),
  };
}

/**
 * Computes obstacle-aware SVG paths and collision-free label placements for all
 * edges in a Seata Saga graph. Guarantees Catch edges dynamically anchor around
 * all 4 sides of the source node (or honor user-dragged perimeter pins), long
 * skip edges route cleanly along open horizontal corridors, and edge labels
 * avoid covering nodes and other edge labels.
 */
export function computeGraphEdgeRoutes(
  nodes: SagaNode[],
  edges: SagaEdge[]
): Map<string, RoutedEdge> {
  const nodeMap = new Map<string, SagaNode>(nodes.map((n) => [n.id, n]));
  const result = new Map<string, RoutedEdge>();
  const catchAnchors = resolveAllCatchAnchors(nodes, edges);
  const openCorridors = computeOpenHorizontalCorridors(nodes);

  // Sibling edge grouping for parallel pairs
  const pairEdges = new Map<string, SagaEdge[]>();
  const edgeIndices = new Map<string, number>();
  for (const edge of edges) {
    const key = [edge.source, edge.target].sort().join('::');
    const list = pairEdges.get(key) ?? [];
    edgeIndices.set(edge.id, list.length);
    list.push(edge);
    pairEdges.set(key, list);
  }

  const allNodeBoxes: Array<{ id: string; body: RectBox; full: RectBox }> =
    nodes.map((n) => ({
      id: n.id,
      body: { x: n.x, y: n.y, width: n.width, height: n.height },
      full: getNodeObstacleRect(n, true),
    }));

  // Phase 1: Route every edge smoothly, bending around any intermediate node box
  // (or stepping into an open horizontal corridor when long skip edges span multiple columns)
  const prelim: Array<{
    edge: SagaEdge;
    source: SagaNode;
    target: SagaNode;
    path: string;
    start: Point;
    end: Point;
    control: Point | null;
    waypoints?: Point[];
    labelText: string;
    catchAnchor?: RoutedCatchAnchor;
  }> = [];

  let corridorUsageCount = 0;

  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;

    const { start: initialStart, end: initialEnd, catchAnchor } = buildSmartEndpoints(
      source,
      target,
      edge,
      catchAnchors.get(edge.id)
    );
    let start = initialStart;
    let end = initialEnd;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;

    const pairKey = [edge.source, edge.target].sort().join('::');
    const siblings = pairEdges.get(pairKey) ?? [edge];
    const siblingTotal = siblings.length;
    const siblingIndex = edgeIndices.get(edge.id) ?? 0;

    // Special parallel-pair handling: when a source->target pair has BOTH a
    // Transition and a Catch edge, keep the primary Transition straight (0)
    // and bow the Catch edge cleanly outward!
    const hasTransitionCatchPair =
      siblingTotal === 2 &&
      siblings.some((s) => s.type === 'Transition') &&
      siblings.some((s) => s.type === 'Catch');

    let baseOffset = 0;
    if (hasTransitionCatchPair) {
      if (edge.type === 'Transition') {
        baseOffset = 0;
      } else {
        // Bow Catch downward when horizontal left-to-right (or outward toward anchor side)
        const bowSign =
          catchAnchor?.side === 'top'
            ? -1
            : catchAnchor?.side === 'bottom'
              ? 1
              : ny >= 0
                ? 1
                : -1;
        baseOffset = bowSign * 46;
      }
    } else if (siblingTotal > 1) {
      baseOffset = (siblingIndex - (siblingTotal - 1) / 2) * 38;
    }

    const intermediateObstacles = allNodeBoxes
      .filter((b) => b.id !== edge.source && b.id !== edge.target)
      .map((b) => b.body);

    // Detect if a pinned Catch anchor points away from its target
    let selfInteriorObstacle: RectBox | undefined;
    const candidateControls: Array<{ control: Point | null; penalty: number }> = [];

    if (catchAnchor) {
      const out = getSideOutwardNormal(catchAnchor.side);
      const outwardDot = dx * out.x + dy * out.y;
      if (outwardDot < 12) {
        selfInteriorObstacle = {
          x: source.x + 6,
          y: source.y + 6,
          width: Math.max(4, source.width - 12),
          height: Math.max(4, source.height - 12),
        };
        const isHorizAnchor = catchAnchor.side === 'top' || catchAnchor.side === 'bottom';
        const wrapSpan = (isHorizAnchor ? source.width : source.height) * 0.72 + 54;
        const outReach = Math.max(64, Math.min(130, dist * 0.35 + 48));
        for (const sign of [1, -1]) {
          for (const mult of [1, 1.45]) {
            const ctrl: Point = isHorizAnchor
              ? {
                  x: start.x + sign * wrapSpan * mult,
                  y: start.y + out.y * outReach * mult,
                }
              : {
                  x: start.x + out.x * outReach * mult,
                  y: start.y + sign * wrapSpan * mult,
                };
            candidateControls.push({
              control: ctrl,
              penalty: 40 + (mult - 1) * 80,
            });
          }
        }
      }
    }

    const candidateOffsets: number[] =
      Math.abs(baseOffset) >= 1
        ? [baseOffset, baseOffset * 1.6, -baseOffset * 1.6]
        : [0, 34, -34, 68, -68, 108, -108, 152, -152];

    for (const offset of candidateOffsets) {
      candidateControls.push({
        control:
          Math.abs(offset) < 1
            ? null
            : {
                x: (start.x + end.x) / 2 + nx * offset,
                y: (start.y + end.y) / 2 + ny * offset,
              },
        penalty: Math.abs(offset) * 1.2,
      });
    }

    let bestControl: Point | null = null;
    let bestScore = Infinity;
    let bestHits = Infinity;

    for (const cand of candidateControls) {
      const hits = countCurveNodeHits(
        start,
        cand.control,
        end,
        intermediateObstacles,
        selfInteriorObstacle
      );
      const score = hits * 10000 + cand.penalty;
      if (score < bestScore) {
        bestScore = score;
        bestHits = hits;
        bestControl = cand.control;
        if (hits === 0 && !selfInteriorObstacle && cand.penalty <= Math.abs(baseOffset) * 1.2 + 1.5) {
          break;
        }
      }
    }

    let waypoints: Point[] | undefined;
    let path: string;

    // If every standard Bezier arc still slices through an unrelated node,
    // upgrade to an obstacle-free rounded horizontal corridor route!
    if (bestHits > 0 && intermediateObstacles.length > 0) {
      const corridorRoute = routeObstacleFreeCorridor(
        source,
        target,
        edge,
        start,
        catchAnchor,
        openCorridors,
        intermediateObstacles,
        selfInteriorObstacle,
        corridorUsageCount
      );
      if (corridorRoute) {
        corridorUsageCount += 1;
        waypoints = corridorRoute.waypoints;
        start = corridorRoute.start;
        end = corridorRoute.end;
        bestControl = null;
        path = corridorRoute.path;
      } else {
        if (bestControl && selfInteriorObstacle) {
          end = getNodeBoundaryPoint(target, bestControl);
        }
        path = bestControl
          ? `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${bestControl.x.toFixed(1)} ${bestControl.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
          : `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
      }
    } else {
      if (bestControl && selfInteriorObstacle) {
        end = getNodeBoundaryPoint(target, bestControl);
      }
      path = bestControl
        ? `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${bestControl.x.toFixed(1)} ${bestControl.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
        : `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
    }

    prelim.push({
      edge,
      source,
      target,
      path,
      start,
      end,
      control: bestControl,
      waypoints,
      labelText: getEdgeLabelText(edge),
      catchAnchor,
    });
  }

  // Phase 2: Collision-free label placement (longest labels first so tight
  // Choice expressions claim clean open space before short badges like Catch)
  const placedLabels: RectBox[] = [];
  const labelOrder = [...prelim].sort(
    (a, b) => b.labelText.length - a.labelText.length
  );

  const labelByEdgeId = new Map<string, { pos: Point; box: RectBox | null }>();

  const evalEdgePointAndTangent = (
    item: (typeof prelim)[number],
    t: number
  ): { pt: Point; tangent: Point } => {
    if (item.waypoints && item.waypoints.length >= 2) {
      return evalPolylineAt(item.waypoints, t);
    }
    return {
      pt: evalQuadratic(item.start, item.control, item.end, t),
      tangent: evalQuadraticTangent(item.start, item.control, item.end, t),
    };
  };

  for (const item of labelOrder) {
    if (!item.labelText) {
      const mid = evalEdgePointAndTangent(item, 0.5).pt;
      labelByEdgeId.set(item.edge.id, { pos: mid, box: null });
      continue;
    }

    const { width, height } = estimateEdgeLabelSize(item.labelText);
    const isHorizontal =
      Math.abs(item.end.x - item.start.x) > Math.abs(item.end.y - item.start.y) * 1.4;

    const tCandidates =
      item.edge.type === 'Compensation'
        ? [0.5, 0.44, 0.56, 0.38, 0.62]
        : item.waypoints
          ? [0.22, 0.32, 0.5, 0.16, 0.68, 0.8, 0.42, 0.58]
          : [0.5, 0.42, 0.58, 0.34, 0.66, 0.27, 0.73, 0.2, 0.8, 0.14, 0.86];

    const normalOffsets =
      item.edge.type === 'Choice' && isHorizontal && !item.waypoints
        ? [-20, -34, -48, -64, -78, 20, 34, 48, 64, 78, 0, -96, 96]
        : item.edge.type === 'Compensation'
          ? [0, -18, 18, -34, 34, -52, 52]
          : [0, -18, 18, -34, 34, -52, 52, -70, 70, -88, 88, -108, 108];

    const initialSample = evalEdgePointAndTangent(item, item.waypoints ? 0.25 : 0.5).pt;
    let bestPos: Point = initialSample;
    let bestBox: RectBox = {
      x: bestPos.x - width / 2,
      y: bestPos.y - height / 2,
      width,
      height,
    };
    let bestCost = Infinity;

    const preferredT = item.waypoints ? 0.25 : 0.5;

    for (const t of tCandidates) {
      const { pt: basePt, tangent: tan } = evalEdgePointAndTangent(item, t);
      const tanLen = Math.hypot(tan.x, tan.y) || 1;
      let ux = -tan.y / tanLen;
      let uy = tan.x / tanLen;
      if (isHorizontal && uy > 0) {
        ux = -ux;
        uy = -uy;
      }

      for (const offset of normalOffsets) {
        const cx =
          isHorizontal && item.edge.type === 'Choice' && !item.waypoints
            ? basePt.x
            : basePt.x + ux * offset;
        const cy =
          isHorizontal && item.edge.type === 'Choice' && !item.waypoints
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

        const driftPenalty = Math.abs(t - preferredT) * 140 + Math.abs(offset) * 2.2;
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
      ...(item.waypoints ? { waypoints: item.waypoints } : {}),
      labelText: item.labelText,
      labelPos: placed?.pos ?? evalEdgePointAndTangent(item, 0.5).pt,
      labelBox: placed?.box ?? null,
      catchAnchor: item.catchAnchor,
    });
  }

  return result;
}

/**
 * Counts how many non-incident edges' direct chords slice through unrelated
 * node bounding boxes (used as a layout quality heuristic).
 */
export function countEdgesPassingThroughNodes(
  nodes: SagaNode[],
  edges: SagaEdge[]
): number {
  const nodeMap = new Map<string, SagaNode>(nodes.map((n) => [n.id, n]));
  const catchAnchors = resolveAllCatchAnchors(nodes, edges);
  let count = 0;
  for (const edge of edges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;
    const { start, end } = buildSmartEndpoints(src, tgt, edge, catchAnchors.get(edge.id));
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

/**
 * Counts how many ACTUAL routed SVG wires still intersect any unrelated node
 * bounding box after obstacle-avoidance & corridor routing.
 */
export function countRoutedEdgeNodeHits(
  nodes: SagaNode[],
  edges: SagaEdge[]
): number {
  const routes = computeGraphEdgeRoutes(nodes, edges);
  let totalHits = 0;
  for (const edge of edges) {
    const route = routes.get(edge.id);
    if (!route) continue;
    const obstacles = nodes
      .filter((n) => n.id !== edge.source && n.id !== edge.target)
      .map((n) => ({ x: n.x, y: n.y, width: n.width, height: n.height }));

    if (route.waypoints && route.waypoints.length >= 2) {
      totalHits += countPolylineNodeHits(route.waypoints, obstacles);
    } else {
      totalHits += countCurveNodeHits(route.start, route.control, route.end, obstacles);
    }
  }
  return totalHits;
}
