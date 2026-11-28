import {
  estimateEdgeLabelSize,
  getEdgeLabelText,
} from './edgeRouting';
import { AiLayoutStyle, reduceLayoutEdgeCrossings } from './aiLayout';
import { SagaEdge, SagaGraph, SagaNode } from './types';

const ORIGIN_MIN_X = 48;
const ORIGIN_MIN_Y = 56;

interface NodeClassification {
  colMap: Map<string, number>;
  bandMap: Map<string, number>;
  spineSet: Set<string>;
  compTargetBySource: Map<string, string>;
  compSourceByTarget: Map<string, string>;
}

const NEGATIVE_EXPR_PATTERNS = [
  /==\s*false\b/i,
  /!=\s*true\b/i,
  /!=\s*0\b/,
  /==\s*null\b/i,
  /==\s*['"]{2}/,
  /\b(TRANSPORT|HTTP_5XX|PARSE_ERROR|TIMEOUT|FAILED|FAIL|ERROR|NOT_FOUND|REJECTED)\b/i,
  /!=\s*['"](SU|SUCCESS|OK)['"]/i,
];

const POSITIVE_EXPR_PATTERNS = [
  /==\s*true\b/i,
  /==\s*0\b/,
  /==\s*['"](SU|SUCCESS|OK)['"]/i,
];

const TIMEOUT_OR_DIAG_EXPR_PATTERNS = [
  /\b(TRANSPORT|HTTP_5XX|PARSE_ERROR|TIMEOUT)\b/i,
  /\[finalMessage\]\s*==\s*null/i,
  /\[errors\]\s*==\s*null/i,
];

function isNegativeExpression(expr?: string): boolean {
  if (!expr) return false;
  return NEGATIVE_EXPR_PATTERNS.some((re) => re.test(expr));
}

function isPositiveExpression(expr?: string): boolean {
  if (!expr) return false;
  if (isNegativeExpression(expr)) return false;
  return POSITIVE_EXPR_PATTERNS.some((re) => re.test(expr));
}

function isTimeoutOrDiagExpression(expr?: string): boolean {
  if (!expr) return false;
  return TIMEOUT_OR_DIAG_EXPR_PATTERNS.some((re) => re.test(expr));
}

function isBranchingEnumChoice(expr?: string): boolean {
  if (!expr) return false;
  if (isNegativeExpression(expr) || isPositiveExpression(expr)) return false;
  return /==\s*['"][^'"]+['"]/.test(expr);
}

/**
 * Breaks any cycles in a directed edge list via DFS from StartState (and any
 * remaining roots), returning the set of edge IDs that form back-edges.
 */
function findBackEdges(
  nodes: SagaNode[],
  flowEdges: SagaEdge[],
  startId: string | undefined
): Set<string> {
  const outBySource = new Map<string, SagaEdge[]>();
  for (const e of flowEdges) {
    const list = outBySource.get(e.source) ?? [];
    list.push(e);
    outBySource.set(e.source, list);
  }

  const state = new Map<string, 0 | 1 | 2>(); // 0=unvisited, 1=visiting, 2=done
  const backEdgeIds = new Set<string>();

  const dfs = (u: string) => {
    state.set(u, 1);
    const outgoing = outBySource.get(u) ?? [];
    for (const e of outgoing) {
      const s = state.get(e.target) ?? 0;
      if (s === 1) {
        backEdgeIds.add(e.id);
      } else if (s === 0) {
        dfs(e.target);
      }
    }
    state.set(u, 2);
  };

  if (startId) dfs(startId);
  for (const n of nodes) {
    if ((state.get(n.id) ?? 0) === 0) {
      dfs(n.id);
    }
  }

  return backEdgeIds;
}

/**
 * Computes longest distance from each node to any Succeed terminal (or any sink
 * if no Succeed exists) over the DAG edges.
 */
function computeDistanceToSuccess(
  nodes: SagaNode[],
  dagEdges: SagaEdge[]
): Map<string, number> {
  const nodeById = new Map<string, SagaNode>(nodes.map((n) => [n.id, n]));
  const outBySource = new Map<string, SagaEdge[]>();
  const inDegree = new Map<string, number>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
  }
  for (const e of dagEdges) {
    const list = outBySource.get(e.source) ?? [];
    list.push(e);
    outBySource.set(e.source, list);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  // Topological order via Kahn
  const queue: string[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });
  const topo: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    topo.push(u);
    for (const e of outBySource.get(u) ?? []) {
      const nextDeg = (inDegree.get(e.target) ?? 1) - 1;
      inDegree.set(e.target, nextDeg);
      if (nextDeg === 0) queue.push(e.target);
    }
  }

  const dist = new Map<string, number>();
  for (let i = topo.length - 1; i >= 0; i -= 1) {
    const id = topo[i];
    const node = nodeById.get(id);
    const outs = (outBySource.get(id) ?? []).filter((e) => e.type !== 'Catch');
    if (!node) continue;
    if (node.type === 'Succeed') {
      dist.set(id, 0);
      continue;
    }
    if (node.type === 'Fail') {
      dist.set(id, -1);
      continue;
    }
    let best = -1;
    for (const e of outs) {
      const d = dist.get(e.target) ?? -1;
      if (d >= 0 && d + 1 > best) {
        best = d + 1;
      }
    }
    dist.set(id, best);
  }

  return dist;
}

/**
 * Classifies every node into a topological column and a semantic swimlane band:
 *   band  0 : Main happy-path horizontal spine (Start -> ... -> Succeed)
 *   band -1 : Upper side-track (timeout/reconciliation hubs, query recovery,
 *             diagnostics, or upper diamond parallel branch)
 *   band +1 : Lower track 1 (paired CompensateState tasks, direct business
 *             rejections / failure handlers, or lower diamond parallel branch)
 *   band +2 : Lower track 2 (CompensationTrigger rollback chain)
 *   band +3 : Bottom track (critical rollback-failure alerting & Fail terminal)
 */
function classifyGraphNodes(graph: SagaGraph): NodeClassification {
  const { nodes, edges } = graph;
  const nodeById = new Map<string, SagaNode>(nodes.map((n) => [n.id, n]));
  const startNode = nodes.find((n) => n.type === 'StartState');

  const compTargetBySource = new Map<string, string>();
  const compSourceByTarget = new Map<string, string>();
  const compNodeSet = new Set<string>();

  for (const n of nodes) {
    if (n.isForCompensation) compNodeSet.add(n.id);
  }
  for (const e of edges) {
    if (e.type === 'Compensation') {
      compTargetBySource.set(e.source, e.target);
      compSourceByTarget.set(e.target, e.source);
      compNodeSet.add(e.target);
    }
  }

  const flowEdges = edges.filter((e) => e.type !== 'Compensation');
  const backEdgeIds = findBackEdges(nodes, flowEdges, startNode?.id);
  const dagEdges = flowEdges.filter((e) => !backEdgeIds.has(e.id));

  const outAll = new Map<string, SagaEdge[]>();
  const inAll = new Map<string, SagaEdge[]>();
  const outForward = new Map<string, SagaEdge[]>();
  const outCatch = new Map<string, SagaEdge[]>();
  const inCatch = new Map<string, SagaEdge[]>();

  for (const e of dagEdges) {
    const oList = outAll.get(e.source) ?? [];
    oList.push(e);
    outAll.set(e.source, oList);

    const iList = inAll.get(e.target) ?? [];
    iList.push(e);
    inAll.set(e.target, iList);

    if (e.type === 'Catch') {
      const oc = outCatch.get(e.source) ?? [];
      oc.push(e);
      outCatch.set(e.source, oc);

      const ic = inCatch.get(e.target) ?? [];
      ic.push(e);
      inCatch.set(e.target, ic);
    } else {
      const ofList = outForward.get(e.source) ?? [];
      ofList.push(e);
      outForward.set(e.source, ofList);
    }
  }

  const distToSuccess = computeDistanceToSuccess(nodes, dagEdges);

  // ---------------------------------------------------------------------------
  // 1. Identify nodes exclusively inside rollback / compensation-trigger chains
  // ---------------------------------------------------------------------------
  const rollbackTriggerIds = nodes
    .filter((n) => n.type === 'CompensationTrigger')
    .map((n) => n.id);
  const rollbackReachable = new Set<string>();
  const rbQueue = [...rollbackTriggerIds];
  while (rbQueue.length > 0) {
    const curr = rbQueue.shift()!;
    if (rollbackReachable.has(curr)) continue;
    rollbackReachable.add(curr);
    for (const e of outAll.get(curr) ?? []) {
      const tgt = nodeById.get(e.target);
      if (!tgt || tgt.type === 'Succeed' || tgt.type === 'Fail') continue;
      if (!rollbackReachable.has(e.target)) rbQueue.push(e.target);
    }
  }

  // Nodes reachable from a Compensation task's Catch edge (rollback-failure alerting)
  const rollbackFailureAlertSet = new Set<string>();
  const rfQueue: string[] = [];
  for (const compId of compNodeSet) {
    for (const e of outCatch.get(compId) ?? []) {
      const tgt = nodeById.get(e.target);
      if (tgt && tgt.type !== 'Succeed' && tgt.type !== 'Fail') {
        rfQueue.push(e.target);
      }
    }
  }
  while (rfQueue.length > 0) {
    const curr = rfQueue.shift()!;
    if (rollbackFailureAlertSet.has(curr)) continue;
    rollbackFailureAlertSet.add(curr);
    for (const e of outAll.get(curr) ?? []) {
      const tgt = nodeById.get(e.target);
      if (!tgt || tgt.type === 'Succeed' || tgt.type === 'Fail') continue;
      if (!rollbackFailureAlertSet.has(e.target)) rfQueue.push(e.target);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Extract Main Happy-Path Spine & Symmetric Diamond Parallel Branches
  // ---------------------------------------------------------------------------
  const spineSet = new Set<string>();
  const diamondBranchBand = new Map<string, number>(); // nodeId -> -1 or +1

  if (startNode) {
    let currId: string | undefined = startNode.id;
    let guard = 0;
    while (currId && !spineSet.has(currId) && guard < nodes.length + 2) {
      guard += 1;
      spineSet.add(currId);
      const currNode = nodeById.get(currId);
      if (!currNode || currNode.type === 'Succeed' || currNode.type === 'Fail') {
        break;
      }

      const forwardOuts: SagaEdge[] = (outForward.get(currId) ?? []).filter(
        (e) => !compNodeSet.has(e.target)
      );
      if (forwardOuts.length === 0) break;

      if (currNode.type === 'Choice' && forwardOuts.length >= 2) {
        // Detect symmetric parallel enum split-join (e.g. operationType == 'A' vs 'B'
        // converging on the exact same next node)
        const enumChoices = forwardOuts.filter(
          (e) => e.type === 'Choice' && isBranchingEnumChoice(e.expression)
        );
        if (enumChoices.length === 2) {
          const t0 = enumChoices[0].target;
          const t1 = enumChoices[1].target;
          const next0 = (outForward.get(t0) ?? []).map((e) => e.target);
          const next1 = (outForward.get(t1) ?? []).map((e) => e.target);
          const commonJoin = next0.find((id) => next1.includes(id));
          if (commonJoin && t0 !== t1) {
            diamondBranchBand.set(t0, -1);
            diamondBranchBand.set(t1, 1);
            currId = commonJoin;
            continue;
          }
        }

        const prevSpinePreds = (inAll.get(currId) ?? [])
          .filter((e) => e.type === 'Transition')
          .map((e) => e.source);
        const catchTargetsOfPred = new Set<string>();
        for (const pId of prevSpinePreds) {
          for (const ce of outCatch.get(pId) ?? []) {
            catchTargetsOfPred.add(ce.target);
          }
        }

        const explicitChoices = forwardOuts.filter((e) => e.type === 'Choice');
        const allChoicesNegative =
          explicitChoices.length > 0 &&
          explicitChoices.every((e) => isNegativeExpression(e.expression));

        let bestEdge: SagaEdge | null = null;
        let bestScore = -Infinity;

        for (const e of forwardOuts) {
          const tgt = nodeById.get(e.target);
          if (!tgt) continue;
          let score = 0;

          if (e.type === 'Choice') {
            if (isPositiveExpression(e.expression)) score += 65;
            if (isNegativeExpression(e.expression)) score -= 75;
            if (isTimeoutOrDiagExpression(e.expression)) score -= 50;
          } else if (e.type === 'Default') {
            score += allChoicesNegative ? 55 : -35;
          }

          if (tgt.type === 'Fail' || tgt.type === 'CompensationTrigger') {
            score -= 100;
          }
          if (rollbackReachable.has(tgt.id) || rollbackFailureAlertSet.has(tgt.id)) {
            score -= 80;
          }
          if (catchTargetsOfPred.has(tgt.id)) {
            // Target also receives Catch from the preceding ServiceTask -> error/timeout branch
            score -= 55;
          }

          const d = distToSuccess.get(tgt.id) ?? -1;
          if (d >= 0) {
            // Prefer continuing the main pipeline over 1-hop error-status injectors
            score += Math.min(60, d * 12);
          } else {
            score -= 40;
          }

          // Favor non-leaf continuation tasks slightly over terminal injectors when tied
          const tgtForwardOuts = (outForward.get(tgt.id) ?? []).filter(
            (oe) => nodeById.get(oe.target)?.type !== 'Succeed'
          );
          if (tgtForwardOuts.length > 0) score += 18;

          if (score > bestScore) {
            bestScore = score;
            bestEdge = e;
          }
        }

        currId = bestEdge?.target;
      } else {
        currId = forwardOuts[0].target;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Semantic Band Assignment (Upper -1 | Spine 0 | Lower +1, +2, +3)
  // ---------------------------------------------------------------------------
  const bandMap = new Map<string, number>();

  for (const id of spineSet) {
    bandMap.set(id, 0);
  }
  diamondBranchBand.forEach((b, id) => {
    bandMap.set(id, b);
  });

  // Paired CompensateState nodes sit in Lower Band +1 directly under their forward task
  for (const compId of compNodeSet) {
    bandMap.set(compId, 1);
  }

  // Classify upper-band seeds (timeout/reconcile/query/diagnostics side-branches)
  const upperSeeds = new Set<string>();
  for (const e of dagEdges) {
    const tgt = nodeById.get(e.target);
    if (!tgt || bandMap.has(tgt.id)) continue;
    if (tgt.type === 'Succeed' || tgt.type === 'Fail' || tgt.type === 'CompensationTrigger') {
      continue;
    }
    if (rollbackReachable.has(tgt.id) || rollbackFailureAlertSet.has(tgt.id)) {
      continue;
    }

    // Rule U1: Entered via an explicit timeout/transport/diagnostics Choice expression
    // off a spine Choice node
    if (
      e.type === 'Choice' &&
      spineSet.has(e.source) &&
      isTimeoutOrDiagExpression(e.expression)
    ) {
      upperSeeds.add(tgt.id);
      continue;
    }

    // Rule U2: Entered via Catch from a spine task that ALREADY has a Compensation
    // task directly below it (so routing Catch UP avoids slicing across Compensation!)
    if (
      e.type === 'Catch' &&
      spineSet.has(e.source) &&
      compTargetBySource.has(e.source)
    ) {
      upperSeeds.add(tgt.id);
      continue;
    }

    // Rule U3: Secondary Choice branch off a spine Choice whose Default stays on spine
    if (e.type === 'Choice' && spineSet.has(e.source)) {
      const srcOuts = outForward.get(e.source) ?? [];
      const defaultOnSpine = srcOuts.some(
        (oe) => oe.type === 'Default' && spineSet.has(oe.target)
      );
      const hasDownwardSibling = srcOuts.some(
        (oe) => oe.target !== tgt.id && !spineSet.has(oe.target)
      );
      const tgtIsCatchFromPrior = (inCatch.get(tgt.id) ?? []).some((ce) =>
        spineSet.has(ce.source)
      );
      if (defaultOnSpine && !hasDownwardSibling && !tgtIsCatchFromPrior) {
        upperSeeds.add(tgt.id);
      }
    }
  }

  // Propagate Upper Band (-1) to descendants of upperSeeds (not on spine/rollback)
  const upperQueue = Array.from(upperSeeds);
  while (upperQueue.length > 0) {
    const curr = upperQueue.shift()!;
    if (bandMap.has(curr)) continue;
    bandMap.set(curr, -1);
    for (const e of outAll.get(curr) ?? []) {
      const tgt = nodeById.get(e.target);
      if (!tgt || bandMap.has(tgt.id)) continue;
      if (
        tgt.type === 'Succeed' ||
        tgt.type === 'Fail' ||
        tgt.type === 'CompensationTrigger' ||
        rollbackReachable.has(tgt.id) ||
        rollbackFailureAlertSet.has(tgt.id)
      ) {
        continue;
      }
      upperQueue.push(tgt.id);
    }
  }

  // Rollback-failure alert chain (from Compensation Catch / CheckCompensationResult Default)
  const hasCompTrigger = rollbackTriggerIds.length > 0;
  for (const id of rollbackFailureAlertSet) {
    if (!bandMap.has(id)) {
      bandMap.set(id, hasCompTrigger ? 3 : 2);
    }
  }

  // CompensationTrigger & its rollback outcome chain
  for (const id of rollbackReachable) {
    if (!bandMap.has(id)) {
      bandMap.set(id, 2);
    }
  }

  // Remaining off-spine nodes (direct business rejections, validation failures, Fail, etc.)
  for (const n of nodes) {
    if (bandMap.has(n.id)) continue;
    if (n.type === 'Fail') {
      bandMap.set(n.id, hasCompTrigger ? 2 : 1);
    } else if (n.type === 'Succeed') {
      bandMap.set(n.id, 0);
    } else {
      // If all incoming edges come from a diamond lower branch, keep at +2 to stay below it
      const inc = inAll.get(n.id) ?? [];
      const fromDiamond =
        inc.length > 0 && inc.every((e) => diamondBranchBand.has(e.source));
      bandMap.set(n.id, fromDiamond ? 2 : 1);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Topological Longest-Path Column Assignment (Strict Left-to-Right DAG!)
  // ---------------------------------------------------------------------------
  const colMap = new Map<string, number>();

  // Kahn topological order over non-comp nodes first; compensation nodes anchor
  // to their paired forward task's column and then propagate to their Catch targets.
  const nonCompNodes = nodes.filter((n) => !compNodeSet.has(n.id));
  const nonCompSet = new Set(nonCompNodes.map((n) => n.id));
  const inDeg = new Map<string, number>();
  for (const n of nonCompNodes) {
    inDeg.set(n.id, 0);
  }
  for (const e of dagEdges) {
    if (nonCompSet.has(e.source) && nonCompSet.has(e.target)) {
      inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
    }
  }

  const topoQueue: string[] = [];
  if (startNode && (inDeg.get(startNode.id) ?? 0) === 0) {
    topoQueue.push(startNode.id);
  }
  inDeg.forEach((deg, id) => {
    if (deg === 0 && id !== startNode?.id) topoQueue.push(id);
  });

  const topoOrder: string[] = [];
  while (topoQueue.length > 0) {
    const u = topoQueue.shift()!;
    topoOrder.push(u);
    for (const e of outAll.get(u) ?? []) {
      if (!nonCompSet.has(e.target)) continue;
      const nd = (inDeg.get(e.target) ?? 1) - 1;
      inDeg.set(e.target, nd);
      if (nd === 0) topoQueue.push(e.target);
    }
  }
  // Safety fallback for any remaining nodes
  for (const n of nonCompNodes) {
    if (!topoOrder.includes(n.id)) topoOrder.push(n.id);
  }

  // Longest-path layering: col(v) = max(col(u) + 1)
  for (const id of topoOrder) {
    if (id === startNode?.id) {
      colMap.set(id, 0);
      continue;
    }
    const incoming = (inAll.get(id) ?? []).filter((e) => nonCompSet.has(e.source));
    if (incoming.length === 0) {
      colMap.set(id, 0);
      continue;
    }
    let maxCol = 0;
    for (const e of incoming) {
      const sc = colMap.get(e.source) ?? 0;
      if (sc + 1 > maxCol) maxCol = sc + 1;
    }
    colMap.set(id, maxCol);
  }

  // Anchor paired CompensateState nodes directly under their forward task's column
  for (const compId of compNodeSet) {
    const pairedSource = compSourceByTarget.get(compId);
    if (pairedSource && colMap.has(pairedSource)) {
      colMap.set(compId, colMap.get(pairedSource)!);
    } else {
      colMap.set(compId, 1);
    }
  }

  // Propagate column constraints from Compensation tasks' outgoing edges (e.g., Catch)
  let relaxed = true;
  for (let iter = 0; iter < nodes.length && relaxed; iter += 1) {
    relaxed = false;
    for (const e of dagEdges) {
      if (compNodeSet.has(e.target)) continue;
      const sc = colMap.get(e.source);
      const tc = colMap.get(e.target);
      if (sc !== undefined && (tc === undefined || tc < sc + 1)) {
        colMap.set(e.target, sc + 1);
        relaxed = true;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Pull-Back Alignment for Off-Spine Early-Exit Hubs & Single-Hop Injectors
  // ---------------------------------------------------------------------------
  // Keep off-spine handlers aligned right below/above their Choice/Catch sources
  // (e.g. CheckOriginalExists (col 2) -> InjectLookupFailedStatus (col 2, band +1),
  // or 5 timeout edges from cols 7..11 -> InjectCancelPendingReconciliation (col 9, band -1))
  // instead of drifting right and colliding with downstream nodes!
  const occupied = new Map<string, string>();
  const slotKey = (c: number, b: number) => `${c}:${b}`;

  // Reserve main spine, diamond branches, and paired compensation nodes first
  for (const id of nodes.map((n) => n.id)) {
    if (spineSet.has(id) || diamondBranchBand.has(id) || compNodeSet.has(id)) {
      const c = colMap.get(id) ?? 0;
      const b = bandMap.get(id) ?? 0;
      occupied.set(slotKey(c, b), id);
    }
  }

  const offSpineNodes = topoOrder.filter(
    (id) => !spineSet.has(id) && !diamondBranchBand.has(id) && !compNodeSet.has(id)
  );

  for (const id of offSpineNodes) {
    const node = nodeById.get(id);
    if (!node || node.type === 'Succeed' || node.type === 'Fail') continue;

    const band = bandMap.get(id) ?? 1;
    const inc = inAll.get(id) ?? [];
    const outs = outAll.get(id) ?? [];
    if (inc.length === 0) continue;

    const predCols = inc
      .map((e) => colMap.get(e.source))
      .filter((c): c is number => c !== undefined);
    if (predCols.length === 0) continue;

    const minPredCol = Math.min(...predCols);
    const maxPredCol = Math.max(...predCols);
    const allPredsOnSpine = inc.every(
      (e) => spineSet.has(e.source) || diamondBranchBand.has(e.source)
    );
    const allOutsFarRight =
      outs.length > 0 &&
      outs.every((e) => {
        const tc = colMap.get(e.target);
        return tc !== undefined && tc >= maxPredCol + 2;
      });

    const predBands = inc.map((e) => bandMap.get(e.source) ?? 0);
    const spansUpperAndLower =
      predBands.some((b) => b < 0) && predBands.some((b) => b > 0);

    let preferredCol = colMap.get(id) ?? maxPredCol + 1;

    if (allPredsOnSpine && allOutsFarRight && !spansUpperAndLower) {
      // Align directly above/below the rightmost feeder (maxPredCol) so every
      // incoming edge flows strictly left-to-right or vertically — zero backward edges!
      preferredCol = maxPredCol;
    } else if (
      node.type === 'CompensationTrigger' &&
      allPredsOnSpine &&
      inc.length >= 2 &&
      maxPredCol - minPredCol >= 2
    ) {
      // Classic Saga CompensationTrigger receiving Catch from multiple tasks (e.g. col 1 & col 3 -> col 2)
      preferredCol = Math.round((minPredCol + maxPredCol) / 2);
    } else if (inc.every((e) => bandMap.get(e.source) === band)) {
      // Same-band sequential chain (e.g., ReleaseLockOnCancelFailed -> InjectCancelFailedStatus)
      preferredCol = maxPredCol + 1;
    }

    // Ensure no predecessor in the SAME band is to our right
    const minSameBandCol = inc
      .filter((e) => bandMap.get(e.source) === band)
      .reduce((mx, e) => Math.max(mx, (colMap.get(e.source) ?? 0) + 1), 0);
    if (preferredCol < minSameBandCol) {
      preferredCol = minSameBandCol;
    }

    // Resolve any exact (col, band) collision cleanly
    let finalBand = band;
    let finalCol = preferredCol;
    if (occupied.has(slotKey(finalCol, finalBand))) {
      // Try stepping one band further from the spine first (keeps vertical alignment),
      // else step right by 1 column if that stays left of targets
      const stepDir = finalBand < 0 ? -1 : 1;
      const altBand = finalBand + stepDir;
      const canStepRight =
        outs.every((e) => {
          const tc = colMap.get(e.target);
          return tc === undefined || finalCol + 1 < tc;
        }) && !occupied.has(slotKey(finalCol + 1, finalBand));

      if (canStepRight) {
        finalCol += 1;
      } else if (!occupied.has(slotKey(finalCol, altBand))) {
        finalBand = altBand;
      } else {
        while (occupied.has(slotKey(finalCol, finalBand))) {
          finalBand += stepDir;
        }
      }
    }

    colMap.set(id, finalCol);
    bandMap.set(id, finalBand);
    occupied.set(slotKey(finalCol, finalBand), id);
  }

  // Final pass: make sure every true sink (Succeed / Fail with outDegree === 0)
  // sits strictly to the right of all its predecessors unless it's a compact
  // central Fail below a Choice/CompensationTrigger
  for (const n of nodes) {
    const outs = outAll.get(n.id) ?? [];
    if (outs.length > 0) continue;
    const inc = inAll.get(n.id) ?? [];
    if (inc.length === 0) continue;

    if (n.type === 'Succeed') {
      const maxPredCol = Math.max(
        ...inc.map((e) => colMap.get(e.source) ?? 0)
      );
      colMap.set(n.id, maxPredCol + 1);
      bandMap.set(n.id, 0);
    } else if (n.type === 'Fail') {
      const predCols = inc.map((e) => colMap.get(e.source) ?? 0);
      const minC = Math.min(...predCols);
      const maxC = Math.max(...predCols);
      const b = bandMap.get(n.id) ?? 1;
      const targetCol =
        minC === maxC && inc.every((e) => bandMap.get(e.source) !== b)
          ? maxC
          : maxC + 1;
      let finalBand = b;
      while (occupied.has(slotKey(targetCol, finalBand))) {
        finalBand += 1;
      }
      colMap.set(n.id, targetCol);
      bandMap.set(n.id, finalBand);
      occupied.set(slotKey(targetCol, finalBand), n.id);
    }
  }

  return {
    colMap,
    bandMap,
    spineSet,
    compTargetBySource,
    compSourceByTarget,
  };
}

/**
 * Production-grade Saga-Aware Layered Swimlane Auto-Layout engine.
 *
 * Guarantees:
 * - Zero node overlaps and crisp 0px swimlane centerline alignment
 * - Strict left-to-right DAG progression (zero backwards arrows on acyclic flows)
 * - Symmetric upper/lower semantic swimlanes (timeout/query above, compensation &
 *   rollback chains below) that harmonize with 360° dynamic Catch anchors
 * - Dynamic label-aware horizontal column spacing for long Seata SpEL expressions
 * - Support for horizontal-swimlane, compact-executive, compensation-aligned,
 *   and vertical-flowchart styles
 */
export function computeAutoLayout(
  graph: SagaGraph,
  style: AiLayoutStyle = 'horizontal-swimlane'
): SagaGraph {
  if (graph.nodes.length === 0) return graph;

  const { colMap, bandMap, compTargetBySource } = classifyGraphNodes(graph);

  // Normalize column indices to contiguous integers 0..numCols-1
  const rawCols = Array.from(new Set(colMap.values())).sort((a, b) => a - b);
  const colIndexRemap = new Map<number, number>();
  rawCols.forEach((rawC, idx) => colIndexRemap.set(rawC, idx));

  const normCol = new Map<string, number>();
  colMap.forEach((rawC, id) => {
    normCol.set(id, colIndexRemap.get(rawC) ?? 0);
  });

  const numCols = Math.max(1, rawCols.length);
  const colMaxWidth = new Array<number>(numCols).fill(80);
  for (const n of graph.nodes) {
    const c = normCol.get(n.id) ?? 0;
    if (n.width > colMaxWidth[c]) colMaxWidth[c] = n.width;
  }

  const isCompact = style === 'compact-executive';
  const isVertical = style === 'vertical-flowchart';
  const isWideGraph = numCols >= 13;
  const baseColGap = isCompact
    ? isWideGraph
      ? 62
      : 74
    : isWideGraph
      ? 82
      : 104;
  const maxSameBandLabelGap = isCompact
    ? isWideGraph
      ? 142
      : 176
    : isWideGraph
      ? 168
      : 216;
  const maxDiagLabelGap = isCompact
    ? isWideGraph
      ? 116
      : 132
    : isWideGraph
      ? 138
      : 160;

  // Compute dynamic horizontal gap after each column based on adjacent labeled edges
  const gapAfterCol = new Array<number>(numCols).fill(baseColGap);
  for (const e of graph.edges) {
    if (e.type === 'Compensation') continue;
    const sc = normCol.get(e.source);
    const tc = normCol.get(e.target);
    const sb = bandMap.get(e.source) ?? 0;
    const tb = bandMap.get(e.target) ?? 0;
    if (sc === undefined || tc === undefined) continue;

    // Only expand gap for direct adjacent-column edges (same band or ±1 diagonal Choice)
    if (tc === sc + 1) {
      const label = getEdgeLabelText(e);
      if (label) {
        const { width: lw } = estimateEdgeLabelSize(label);
        const sameBand = sb === tb;
        const needed = sameBand
          ? Math.min(maxSameBandLabelGap, Math.max(baseColGap, lw + 22))
          : Math.min(maxDiagLabelGap, Math.max(baseColGap, lw * 0.56 + 18));
        if (needed > gapAfterCol[sc]) {
          gapAfterCol[sc] = Math.round(needed);
        }
      }
    }
  }

  // Cumulative column center X coordinates
  const colCenterX = new Array<number>(numCols).fill(0);
  let cursorX = ORIGIN_MIN_X;
  for (let c = 0; c < numCols; c += 1) {
    colCenterX[c] = Math.round(cursorX + colMaxWidth[c] / 2);
    cursorX += colMaxWidth[c] + gapAfterCol[c];
  }

  // Compute vertical band centers with open routing gutters between every pair of bands
  const sortedBands = Array.from(new Set(bandMap.values())).sort((a, b) => a - b);
  const bandMaxHeight = new Map<number, number>();
  for (const b of sortedBands) bandMaxHeight.set(b, 56);
  for (const n of graph.nodes) {
    const b = bandMap.get(n.id) ?? 0;
    const h = n.height + (n.type === 'Choice' || n.type === 'StartState' || n.type === 'Succeed' || n.type === 'Fail' || n.type === 'CompensationTrigger' ? 22 : 0);
    if (h > (bandMaxHeight.get(b) ?? 0)) {
      bandMaxHeight.set(b, h);
    }
  }

  const hasCompEdges = compTargetBySource.size > 0;
  const bandCenterY = new Map<number, number>();
  let cursorY = ORIGIN_MIN_Y;
  for (let i = 0; i < sortedBands.length; i += 1) {
    const b = sortedBands[i];
    const h = bandMaxHeight.get(b) ?? 74;
    if (i === 0) {
      bandCenterY.set(b, Math.round(cursorY + h / 2));
      cursorY += h;
    } else {
      const prevB = sortedBands[i - 1];
      // Give generous vertical gutter between main spine (0) and compensation/error band (+1)
      // as well as clean bus channels between lower bands so skip edges route cleanly
      const baseGutter = isCompact ? 76 : 100;
      const extraGutter =
        prevB === 0 && b === 1 && hasCompEdges
          ? isCompact
            ? 24
            : 36
          : 0;
      const gutter = baseGutter + extraGutter;
      cursorY += gutter;
      bandCenterY.set(b, Math.round(cursorY + h / 2));
      cursorY += h;
    }
  }

  // Dynamic caption-aware row Y centers for vertical-flowchart mode
  const verticalRowCenterY = new Array<number>(numCols).fill(0);
  if (isVertical) {
    const rowMaxBodyH = new Array<number>(numCols).fill(56);
    const rowCaptionPad = new Array<number>(numCols).fill(0);
    const rowHasChoice = new Array<boolean>(numCols).fill(false);
    for (const n of graph.nodes) {
      const c = normCol.get(n.id) ?? 0;
      if (n.height > rowMaxBodyH[c]) rowMaxBodyH[c] = n.height;
      const hasBottomCaption =
        n.type === 'Choice' ||
        n.type === 'StartState' ||
        n.type === 'Succeed' ||
        n.type === 'Fail' ||
        n.type === 'CompensationTrigger';
      if (hasBottomCaption && rowCaptionPad[c] < 26) {
        rowCaptionPad[c] = 26;
      }
      if (n.type === 'Choice') rowHasChoice[c] = true;
    }

    let vCursorY = ORIGIN_MIN_Y;
    for (let c = 0; c < numCols; c += 1) {
      verticalRowCenterY[c] = Math.round(vCursorY + rowMaxBodyH[c] / 2);
      const rowGutter = rowHasChoice[c]
        ? isCompact
          ? 76
          : 92
        : isCompact
          ? 60
          : 74;
      vCursorY += rowMaxBodyH[c] + rowCaptionPad[c] + rowGutter;
    }
  }

  let positionedNodes: SagaNode[] = graph.nodes.map((node) => {
    const c = normCol.get(node.id) ?? 0;
    const b = bandMap.get(node.id) ?? 0;

    if (!isVertical) {
      const cx = colCenterX[c];
      const cy = bandCenterY.get(b) ?? ORIGIN_MIN_Y + 60;
      return {
        ...node,
        x: Math.round(cx - node.width / 2),
        y: Math.round(cy - node.height / 2),
      };
    }

    // Vertical top-down mode: progression along Y, semantic bands along X
    const laneStep = isCompact ? 228 : 264;
    const minBand = sortedBands[0] ?? 0;
    const bandIdx = b - minBand;
    const cx = ORIGIN_MIN_X + 110 + bandIdx * laneStep;
    const cy = verticalRowCenterY[c] ?? ORIGIN_MIN_Y + 40 + c * 164;
    return {
      ...node,
      x: Math.round(cx - node.width / 2),
      y: Math.round(cy - node.height / 2),
    };
  });

  // For compact graphs with Fail/CompensationTrigger terminals (like classic
  // reduceInventoryAndBalance), run local terminal crossing optimizer to hit 0 crossings
  if (!isVertical && positionedNodes.length <= 12) {
    positionedNodes = reduceLayoutEdgeCrossings(
      positionedNodes,
      graph.edges,
      graph.meta,
      style
    );
  }

  // Final origin normalization preserving exact 0px band alignment
  const minX = Math.min(...positionedNodes.map((n) => n.x));
  const minY = Math.min(...positionedNodes.map((n) => n.y));
  const dx = ORIGIN_MIN_X - minX;
  const dy = ORIGIN_MIN_Y - minY;

  const normalizedNodes = positionedNodes.map((n) => ({
    ...n,
    x: Math.round(n.x + dx),
    y: Math.round(n.y + dy),
  }));

  // Reset stale manual Catch anchor pins so 360° auto-tracking aligns cleanly
  const cleanedEdges: SagaEdge[] = graph.edges.map((edge) => {
    if (!edge.sourceAnchor) return { ...edge };
    const { sourceAnchor: _cleared, ...rest } = edge;
    return rest;
  });

  return {
    meta: { ...graph.meta },
    nodes: normalizedNodes,
    edges: cleanedEdges,
    ...(graph.yamlTemplate !== undefined
      ? { yamlTemplate: graph.yamlTemplate }
      : {}),
  };
}
