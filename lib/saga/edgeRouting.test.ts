import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGraphEdgeRoutes,
  getNodeObstacleRect,
  projectPointToNodePerimeter,
  rectsOverlapArea,
} from './edgeRouting';
import { parseSeataJsonToGraph } from './serializer';
import { SAGA_TEMPLATES } from './templates';
import { SagaGraph, SagaNode } from './types';

test('computeGraphEdgeRoutes places every label without overlapping any node or any other edge label', () => {
  for (const tpl of SAGA_TEMPLATES) {
    const graph = parseSeataJsonToGraph(tpl.json);
    const routes = computeGraphEdgeRoutes(graph.nodes, graph.edges);

    const nodeRects = graph.nodes.map((n) => ({
      id: n.id,
      rect: getNodeObstacleRect(n, true),
    }));

    const placedLabels: Array<{ edgeId: string; rect: NonNullable<ReturnType<typeof routes.get>>['labelBox'] }> = [];

    for (const edge of graph.edges) {
      const route = routes.get(edge.id);
      assert.ok(route, `Expected route for edge ${edge.id}`);
      if (!route.labelBox) continue;

      for (const nr of nodeRects) {
        const overlap = rectsOverlapArea(route.labelBox, nr.rect, 0);
        assert.equal(
          overlap,
          0,
          `Template "${tpl.id}" label "${route.labelText}" overlapped node "${nr.id}" by ${overlap}px²`
        );
      }

      for (const prev of placedLabels) {
        if (!prev.rect) continue;
        const overlap = rectsOverlapArea(route.labelBox, prev.rect, 0);
        assert.equal(
          overlap,
          0,
          `Template "${tpl.id}" label "${route.labelText}" overlapped edge label ${prev.edgeId} by ${overlap}px²`
        );
      }

      placedLabels.push({ edgeId: edge.id, rect: route.labelBox });
    }
  }
});

test('computeGraphEdgeRoutes dynamically anchors Catch edges toward the target side and bends around obstructing nodes', () => {
  const graph: SagaGraph = {
    meta: {
      name: 'catchRoutingDemo',
      comment: '',
      version: '0.0.1',
      persist: true,
      retryPersistModeUpdate: false,
      compensatePersistModeUpdate: false,
    },
    nodes: [
      { id: 'TaskLeft', name: 'TaskLeft', type: 'ServiceTask', x: 100, y: 100, width: 172, height: 74 },
      { id: 'TaskRight', name: 'TaskRight', type: 'ServiceTask', x: 640, y: 100, width: 172, height: 74 },
      { id: 'CompRight', name: 'CompRight', type: 'ServiceTask', x: 640, y: 260, width: 172, height: 74, isForCompensation: true },
      { id: 'Trigger', name: 'Trigger', type: 'CompensationTrigger', x: 420, y: 420, width: 56, height: 56 },
    ],
    edges: [
      { id: 'catchLeft', source: 'TaskLeft', target: 'Trigger', type: 'Catch', exceptions: ['java.lang.Throwable'] },
      { id: 'catchRight', source: 'TaskRight', target: 'Trigger', type: 'Catch', exceptions: ['java.lang.Throwable'] },
      { id: 'compRight', source: 'TaskRight', target: 'CompRight', type: 'Compensation' },
    ],
  };

  const routes = computeGraphEdgeRoutes(graph.nodes, graph.edges);
  const leftRoute = routes.get('catchLeft')!;
  const rightRoute = routes.get('catchRight')!;

  // TaskLeft's Catch exits bottom-right (toward Trigger on right)
  assert.ok(leftRoute.start.x > 100 + 172 * 0.5);
  // TaskRight's Catch exits bottom-left (toward Trigger on left), avoiding CompRight's vertical Compensation line!
  assert.ok(rightRoute.start.x < 640 + 172 * 0.5);
});

test('Catch anchor dynamically tracks target across all 4 borders (top, right, bottom, left) during dragging', () => {
  const source: SagaNode = {
    id: 'ProcessOrder',
    name: 'ProcessOrder',
    type: 'ServiceTask',
    x: 400,
    y: 300,
    width: 172,
    height: 74,
  };

  const scenarios: Array<{
    label: string;
    targetPos: { x: number; y: number };
    expectedSide: 'top' | 'right' | 'bottom' | 'left';
  }> = [
    { label: 'above', targetPos: { x: 400, y: 80 }, expectedSide: 'top' },
    { label: 'right', targetPos: { x: 740, y: 300 }, expectedSide: 'right' },
    { label: 'below', targetPos: { x: 400, y: 520 }, expectedSide: 'bottom' },
    { label: 'left', targetPos: { x: 80, y: 300 }, expectedSide: 'left' },
  ];

  for (const s of scenarios) {
    const target: SagaNode = {
      id: 'NotifyOpsIfNeeded',
      name: 'NotifyOpsIfNeeded',
      type: 'ServiceTask',
      x: s.targetPos.x,
      y: s.targetPos.y,
      width: 172,
      height: 74,
    };
    const routes = computeGraphEdgeRoutes(
      [source, target],
      [
        {
          id: 'catch_ops',
          source: 'ProcessOrder',
          target: 'NotifyOpsIfNeeded',
          type: 'Catch',
          exceptions: ['java.lang.Throwable'],
        },
      ]
    );
    const route = routes.get('catch_ops')!;
    assert.ok(route.catchAnchor, `Expected catchAnchor for ${s.label}`);
    assert.equal(
      route.catchAnchor.side,
      s.expectedSide,
      `Expected Catch anchor on "${s.expectedSide}" when target is ${s.label}`
    );
    assert.equal(route.catchAnchor.isCustom, false);

    if (s.expectedSide === 'top') {
      assert.equal(route.catchAnchor.borderPoint.y, source.y);
      assert.ok(route.start.y <= source.y);
    } else if (s.expectedSide === 'bottom') {
      assert.equal(route.catchAnchor.borderPoint.y, source.y + source.height);
      assert.ok(route.start.y >= source.y + source.height);
    } else if (s.expectedSide === 'right') {
      assert.equal(route.catchAnchor.borderPoint.x, source.x + source.width);
      assert.ok(route.start.x >= source.x + source.width);
    } else {
      assert.equal(route.catchAnchor.borderPoint.x, source.x);
      assert.ok(route.start.x <= source.x);
    }
  }
});

test('Catch anchor avoids sibling Transition/Compensation wires and spreads multiple Catch edges on the same side', () => {
  const source: SagaNode = {
    id: 'Charge',
    name: 'Charge',
    type: 'ServiceTask',
    x: 300,
    y: 200,
    width: 172,
    height: 74,
  };
  const nextTask: SagaNode = {
    id: 'Ship',
    name: 'Ship',
    type: 'ServiceTask',
    x: 620,
    y: 200,
    width: 172,
    height: 74,
  };
  const opsA: SagaNode = {
    id: 'NotifyOpsA',
    name: 'NotifyOpsA',
    type: 'ServiceTask',
    x: 200,
    y: 430,
    width: 172,
    height: 74,
  };
  const opsB: SagaNode = {
    id: 'NotifyOpsB',
    name: 'NotifyOpsB',
    type: 'ServiceTask',
    x: 420,
    y: 430,
    width: 172,
    height: 74,
  };

  // Multi-Catch on bottom border should separate cleanly along X
  const multiRoutes = computeGraphEdgeRoutes(
    [source, opsA, opsB],
    [
      { id: 'cA', source: 'Charge', target: 'NotifyOpsA', type: 'Catch', exceptions: ['java.lang.IllegalStateException'] },
      { id: 'cB', source: 'Charge', target: 'NotifyOpsB', type: 'Catch', exceptions: ['java.lang.Throwable'] },
    ]
  );
  const anchorA = multiRoutes.get('cA')!.catchAnchor!;
  const anchorB = multiRoutes.get('cB')!.catchAnchor!;
  assert.equal(anchorA.side, 'bottom');
  assert.equal(anchorB.side, 'bottom');
  assert.ok(
    Math.abs(anchorA.borderPoint.x - anchorB.borderPoint.x) >= 24,
    'Two Catch anchors on the same border should be visibly separated'
  );

  // Rightward Catch alongside a rightward Transition should step off right-center (ratio !== 0.5)
  const rightSiblingRoutes = computeGraphEdgeRoutes(
    [
      source,
      nextTask,
      { ...opsA, id: 'NotifyRight', name: 'NotifyRight', x: 620, y: 205 },
    ],
    [
      { id: 't1', source: 'Charge', target: 'Ship', type: 'Transition' },
      { id: 'cRight', source: 'Charge', target: 'NotifyRight', type: 'Catch', exceptions: ['java.lang.Throwable'] },
    ]
  );
  const rightCatch = rightSiblingRoutes.get('cRight')!.catchAnchor!;
  assert.equal(rightCatch.side, 'right');
  assert.notEqual(
    rightCatch.ratio,
    0.5,
    'Right-side Catch should offset away from sibling Transition at right-center'
  );
});

test('projectPointToNodePerimeter maps dragged cursor to all 4 sides and pinned Catch anchor wraps around source node', () => {
  const source: SagaNode = {
    id: 'Task',
    name: 'Task',
    type: 'ServiceTask',
    x: 300,
    y: 250,
    width: 172,
    height: 74,
  };

  assert.equal(projectPointToNodePerimeter(source, { x: 386, y: 200 }).side, 'top');
  assert.equal(projectPointToNodePerimeter(source, { x: 540, y: 287 }).side, 'right');
  assert.equal(projectPointToNodePerimeter(source, { x: 386, y: 380 }).side, 'bottom');
  assert.equal(projectPointToNodePerimeter(source, { x: 220, y: 287 }).side, 'left');

  // Pin Catch to left border while target sits to the right; path must remain curved around source node
  const target: SagaNode = {
    id: 'NotifyOpsIfNeeded',
    name: 'NotifyOpsIfNeeded',
    type: 'ServiceTask',
    x: 640,
    y: 250,
    width: 172,
    height: 74,
  };
  const routes = computeGraphEdgeRoutes(
    [source, target],
    [
      {
        id: 'pinned_catch',
        source: 'Task',
        target: 'NotifyOpsIfNeeded',
        type: 'Catch',
        exceptions: ['java.lang.Throwable'],
        sourceAnchor: { side: 'left', ratio: 0.5 },
      },
    ]
  );
  const route = routes.get('pinned_catch')!;
  assert.equal(route.catchAnchor?.side, 'left');
  assert.equal(route.catchAnchor?.isCustom, true);
  assert.ok(route.control, 'Opposite-side pinned Catch should bend with a non-null control point');
  assert.ok(route.path.includes('Q '), 'Opposite-side pinned Catch should use a smooth quadratic wrap-around curve');
  // Midpoint of wrap-around curve must stay outside the source node interior
  const midX = 0.25 * route.start.x + 0.5 * route.control.x + 0.25 * route.end.x;
  const midY = 0.25 * route.start.y + 0.5 * route.control.y + 0.25 * route.end.y;
  const insideSource =
    midX > source.x + 6 &&
    midX < source.x + source.width - 6 &&
    midY > source.y + 6 &&
    midY < source.y + source.height - 6;
  assert.equal(insideSource, false, 'Wrap-around curve must not cut through source node interior');
});
