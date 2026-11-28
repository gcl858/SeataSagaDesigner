import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGraphEdgeRoutes,
  getNodeObstacleRect,
  rectsOverlapArea,
} from './edgeRouting';
import { parseSeataJsonToGraph } from './serializer';
import { SAGA_TEMPLATES } from './templates';
import { SagaGraph } from './types';

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
