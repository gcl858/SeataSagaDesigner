import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseSeataSourceToGraph } from './yaml';
import { autoLayoutGraph, parseSeataJsonToGraph } from './serializer';
import { computeLayoutMetrics, AiLayoutStyle } from './aiLayout';
import {
  computeGraphEdgeRoutes,
  countRoutedEdgeNodeHits,
  getNodeObstacleRect,
  rectsOverlapArea,
} from './edgeRouting';
import { parseSeataImportBundle } from './batchImport';
import { SAGA_TEMPLATES } from './templates';
import { SagaGraph } from './types';

const EXAMPLE_DIR = path.resolve(process.cwd(), 'examples/omni-cash-transaction');
const EXAMPLE_FILES = [
  'omni_cash_transaction.saga.yaml',
  'repayment_cash_deposit.saga.yaml',
  'repayment_cash_cancellation.saga.yaml',
];

const STYLES: AiLayoutStyle[] = [
  'horizontal-swimlane',
  'compact-executive',
  'vertical-flowchart',
];

function countCenterBackwardEdges(
  graph: SagaGraph,
  style: AiLayoutStyle
): number {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  let count = 0;
  for (const edge of graph.edges) {
    if (edge.type === 'Compensation') continue;
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;
    if (style === 'vertical-flowchart') {
      if (src.y + src.height / 2 > tgt.y + tgt.height / 2 + 5) count += 1;
    } else {
      if (src.x + src.width / 2 > tgt.x + tgt.width / 2 + 5) count += 1;
    }
  }
  return count;
}

function countLabelCollisions(graph: SagaGraph): {
  labelNodeOverlaps: number;
  labelLabelOverlaps: number;
} {
  const routes = computeGraphEdgeRoutes(graph.nodes, graph.edges);
  const nodeBoxes = graph.nodes.map((n) => getNodeObstacleRect(n, false));
  const labelRects = Array.from(routes.values())
    .map((r) => r.labelRect)
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  let labelNodeOverlaps = 0;
  for (const lr of labelRects) {
    for (const nb of nodeBoxes) {
      if (rectsOverlapArea(lr, nb, 0) > 0) {
        labelNodeOverlaps += 1;
      }
    }
  }

  let labelLabelOverlaps = 0;
  for (let i = 0; i < labelRects.length; i += 1) {
    for (let j = i + 1; j < labelRects.length; j += 1) {
      if (rectsOverlapArea(labelRects[i], labelRects[j], 0) > 0) {
        labelLabelOverlaps += 1;
      }
    }
  }

  return { labelNodeOverlaps, labelLabelOverlaps };
}

test('autoLayoutGraph achieves 0 overlaps, 0 routed node hits, 0 label collisions, and 0 backward edges on all 3 production omni-cash-transaction YAMLs', () => {
  for (const filename of EXAMPLE_FILES) {
    const raw = fs.readFileSync(path.join(EXAMPLE_DIR, filename), 'utf8');
    const parsed = parseSeataSourceToGraph(raw);

    for (const style of STYLES) {
      const laidOut = autoLayoutGraph(parsed.graph, style);
      const metrics = computeLayoutMetrics(laidOut);
      const routedHits = countRoutedEdgeNodeHits(laidOut.nodes, laidOut.edges);
      const backward = countCenterBackwardEdges(laidOut, style);
      const { labelNodeOverlaps, labelLabelOverlaps } =
        countLabelCollisions(laidOut);

      assert.equal(
        metrics.overlapCount,
        0,
        `${filename} [${style}] should have 0 node overlaps`
      );
      assert.equal(
        routedHits,
        0,
        `${filename} [${style}] should have 0 rendered edges slicing through unrelated nodes`
      );
      assert.equal(
        labelNodeOverlaps,
        0,
        `${filename} [${style}] should have 0 label-node overlaps`
      );
      assert.equal(
        labelLabelOverlaps,
        0,
        `${filename} [${style}] should have 0 label-label overlaps`
      );
      assert.equal(
        backward,
        0,
        `${filename} [${style}] should have 0 backward-flowing edges`
      );

      // Verify Succeed terminal is strictly the final node along the main progression axis
      const succeedNode = laidOut.nodes.find((n) => n.type === 'Succeed');
      assert.ok(succeedNode, `${filename} should include a Succeed state`);
      if (style === 'vertical-flowchart') {
        const maxOtherY = Math.max(
          ...laidOut.nodes
            .filter((n) => n.id !== succeedNode.id)
            .map((n) => n.y + n.height / 2)
        );
        assert.ok(
          succeedNode.y + succeedNode.height / 2 > maxOtherY,
          `${filename} [${style}] Succeed should be strictly bottommost`
        );
      } else {
        const maxOtherX = Math.max(
          ...laidOut.nodes
            .filter((n) => n.id !== succeedNode.id)
            .map((n) => n.x + n.width / 2)
        );
        assert.ok(
          succeedNode.x + succeedNode.width / 2 > maxOtherX,
          `${filename} [${style}] Succeed should be strictly rightmost`
        );
      }
    }
  }
});

test('autoLayoutGraph plumb-aligns paired CompensateState tasks directly beneath their forward tasks on deposit and cancellation flows', () => {
  const pairs: Array<[string, string, string]> = [
    ['repayment_cash_deposit.saga.yaml', 'CallCoreForward', 'RollbackCore'],
    ['repayment_cash_cancellation.saga.yaml', 'CancelCore', 'RollbackCancelCore'],
  ];

  for (const [filename, forwardId, compId] of pairs) {
    const raw = fs.readFileSync(path.join(EXAMPLE_DIR, filename), 'utf8');
    const laidOut = autoLayoutGraph(
      parseSeataSourceToGraph(raw).graph,
      'horizontal-swimlane'
    );
    const forward = laidOut.nodes.find((n) => n.id === forwardId);
    const comp = laidOut.nodes.find((n) => n.id === compId);
    assert.ok(forward && comp, `${filename} should contain ${forwardId} and ${compId}`);

    const fwdCx = forward.x + forward.width / 2;
    const compCx = comp.x + comp.width / 2;
    assert.ok(
      Math.abs(fwdCx - compCx) <= 2,
      `${filename}: ${compId} should be plumb-aligned beneath ${forwardId} (got delta ${Math.abs(fwdCx - compCx)})`
    );
    assert.ok(
      comp.y > forward.y + forward.height + 60,
      `${filename}: ${compId} should sit in the lower compensation swimlane below ${forwardId}`
    );
  }
});

test('autoLayoutGraph symmetrically splits parallel SubStateMachine branches in omni_cash_transaction above and below the main spine', () => {
  const raw = fs.readFileSync(
    path.join(EXAMPLE_DIR, 'omni_cash_transaction.saga.yaml'),
    'utf8'
  );
  const laidOut = autoLayoutGraph(
    parseSeataSourceToGraph(raw).graph,
    'horizontal-swimlane'
  );

  const dispatch = laidOut.nodes.find((n) => n.id === 'DispatchOperation')!;
  const deposit = laidOut.nodes.find((n) => n.id === 'InvokeDepositSubflow')!;
  const cancel = laidOut.nodes.find((n) => n.id === 'InvokeCancellationSubflow')!;
  const diag = laidOut.nodes.find((n) => n.id === 'CheckNeedDiagnostics')!;

  const dispatchCy = dispatch.y + dispatch.height / 2;
  const depositCy = deposit.y + deposit.height / 2;
  const cancelCy = cancel.y + cancel.height / 2;
  const diagCy = diag.y + diag.height / 2;

  assert.equal(dispatchCy, diagCy, 'Main spine Choice nodes should share exact 0px centerline');
  assert.ok(depositCy < dispatchCy - 80, 'Upper parallel SubStateMachine should sit above spine');
  assert.ok(cancelCy > dispatchCy + 80, 'Lower parallel SubStateMachine should sit below spine');
  assert.ok(
    Math.abs(deposit.x - cancel.x) <= 2,
    'Parallel SubStateMachine branches should align in the same column'
  );
});

test('batch importing all 3 omni-cash-transaction YAML files resolves parent-child links and produces clean layouts', () => {
  const files = EXAMPLE_FILES.map((filename) => ({
    filename,
    content: fs.readFileSync(path.join(EXAMPLE_DIR, filename), 'utf8'),
  }));

  const bundle = parseSeataImportBundle(files);
  assert.equal(bundle.errors.length, 0);
  assert.equal(bundle.rootMachineName, 'omni_cash_transaction');
  assert.deepEqual(
    [...bundle.linkedChildNames].sort(),
    ['repayment_cash_cancellation', 'repayment_cash_deposit']
  );
  assert.equal(bundle.missingReferences.length, 0);

  for (const entry of bundle.machines) {
    assert.equal(entry.autoLaidOut, true);
    assert.equal(countRoutedEdgeNodeHits(entry.graph.nodes, entry.graph.edges), 0);
  }
});

test('autoLayoutGraph keeps all built-in templates clean with 0 overlaps, 0 routed node hits, and 0 label collisions', () => {
  for (const tpl of SAGA_TEMPLATES) {
    const parsed = parseSeataJsonToGraph(tpl.json);
    for (const style of STYLES) {
      const laidOut = autoLayoutGraph(parsed, style);
      const metrics = computeLayoutMetrics(laidOut);
      const routedHits = countRoutedEdgeNodeHits(laidOut.nodes, laidOut.edges);
      const { labelNodeOverlaps, labelLabelOverlaps } =
        countLabelCollisions(laidOut);
      assert.equal(metrics.overlapCount, 0, `${tpl.id} [${style}] overlapCount`);
      assert.equal(routedHits, 0, `${tpl.id} [${style}] routedHits`);
      assert.equal(labelNodeOverlaps, 0, `${tpl.id} [${style}] labelNodeOverlaps`);
      assert.equal(labelLabelOverlaps, 0, `${tpl.id} [${style}] labelLabelOverlaps`);
    }
  }
});
