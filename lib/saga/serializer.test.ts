import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REDUCE_INVENTORY_AND_BALANCE_JSON,
  ORDER_FULFILLMENT_SUBMACHINE_JSON,
} from './templates';
import {
  parseSeataJsonToGraph,
  serializeGraphToSeataJson,
  renameStateInGraph,
  autoLayoutGraph,
  exportGraphToSvg,
} from './serializer';

test('round-trips official reduceInventoryAndBalance Seata JSON without losing semantics', () => {
  const graph = parseSeataJsonToGraph(REDUCE_INVENTORY_AND_BALANCE_JSON);
  assert.equal(graph.meta.name, 'reduceInventoryAndBalance');
  assert.equal(graph.nodes.length, 9); // Start + 8 states

  const serialized = serializeGraphToSeataJson(graph, { includeLayout: true });
  assert.equal(serialized.Name, 'reduceInventoryAndBalance');
  assert.equal(serialized.StartState, 'ReduceInventory');
  assert.equal(serialized.States.ReduceInventory.ServiceName, 'inventoryAction');
  assert.equal(
    serialized.States.ReduceInventory.CompensateState,
    'CompensateReduceInventory'
  );
  assert.equal(serialized.States.ReduceInventory.Catch?.length, 1);
  assert.equal(
    serialized.States.ReduceInventory.Catch?.[0].Next,
    'CompensationTrigger'
  );
  assert.equal(serialized.States.ChoiceState.Choices?.length, 1);
  assert.equal(serialized.States.ChoiceState.Default, 'Fail');
  assert.equal(serialized.States.CompensateReduceInventory.IsForCompensation, true);
  assert.ok(serialized.States.ReduceInventory.style?.bounds);
});

test('omits layout bounds when includeLayout is false', () => {
  const graph = parseSeataJsonToGraph(ORDER_FULFILLMENT_SUBMACHINE_JSON);
  const engineOnly = serializeGraphToSeataJson(graph, { includeLayout: false });
  assert.equal(engineOnly.style, undefined);
  assert.equal(engineOnly.States.CreateOrder.style, undefined);
  assert.equal(engineOnly.States.PaymentSubMachine.StateMachineName, 'paymentSettlementSubSaga');
});

test('renameStateInGraph updates StartState, Next, Choice, Catch, and CompensateState references', () => {
  const graph = parseSeataJsonToGraph(REDUCE_INVENTORY_AND_BALANCE_JSON);
  const renamed = renameStateInGraph(graph, 'ReduceInventory', 'DeductStock');
  const serialized = serializeGraphToSeataJson(renamed);

  assert.equal(serialized.StartState, 'DeductStock');
  assert.ok(serialized.States.DeductStock);
  assert.equal(serialized.States.ReduceInventory, undefined);
  assert.equal(
    serialized.States.DeductStock.CompensateState,
    'CompensateReduceInventory'
  );
});

test('autoLayoutGraph positions compensation tasks below their source tasks and exports valid SVG', () => {
  const graph = parseSeataJsonToGraph(REDUCE_INVENTORY_AND_BALANCE_JSON);
  const laidOut = autoLayoutGraph(graph);
  const forward = laidOut.nodes.find((n) => n.id === 'ReduceInventory')!;
  const comp = laidOut.nodes.find((n) => n.id === 'CompensateReduceInventory')!;
  assert.ok(comp.y > forward.y);

  const svg = exportGraphToSvg(laidOut);
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('ReduceInventory'));
  assert.ok(svg.includes('CompensateReduceInventory'));
  assert.ok(svg.includes('data-catch-marker='));
});

test('autoLayoutGraph places Catch-only ServiceTask (NotifyOpsIfNeeded) cleanly in the Catch lane and round-trips pinned sourceAnchor', () => {
  const graph = parseSeataJsonToGraph({
    Name: 'opsAlertDemo',
    StartState: 'ProcessOrder',
    Version: '0.0.1',
    States: {
      ProcessOrder: {
        Type: 'ServiceTask',
        ServiceName: 'orderService',
        ServiceMethod: 'process',
        Next: 'Succeed',
        Catch: [
          {
            Exceptions: ['java.lang.Throwable'],
            Next: 'NotifyOpsIfNeeded',
          },
        ],
      },
      NotifyOpsIfNeeded: {
        Type: 'ServiceTask',
        ServiceName: 'opsAlertService',
        ServiceMethod: 'notify',
        Next: 'Fail',
      },
      Succeed: { Type: 'Succeed' },
      Fail: { Type: 'Fail', ErrorCode: 'OPS_ALERT', Message: 'Notified ops' },
    },
  });

  const processNode = graph.nodes.find((n) => n.id === 'ProcessOrder')!;
  const notifyNode = graph.nodes.find((n) => n.id === 'NotifyOpsIfNeeded')!;
  const succeedNode = graph.nodes.find((n) => n.id === 'Succeed')!;

  // NotifyOpsIfNeeded should be placed below ProcessOrder in the exception corridor, NOT stranded to the right of Succeed
  assert.ok(notifyNode.y > processNode.y + processNode.height);
  assert.ok(notifyNode.x < succeedNode.x + succeedNode.width);

  // Pinning a custom Catch anchor persists when includeLayout=true and omits when includeLayout=false
  const catchEdge = graph.edges.find((e) => e.type === 'Catch')!;
  const pinnedGraph = {
    ...graph,
    edges: graph.edges.map((e) =>
      e.id === catchEdge.id
        ? { ...e, sourceAnchor: { side: 'top' as const, ratio: 0.4 } }
        : e
    ),
  };

  const withLayout = serializeGraphToSeataJson(pinnedGraph, { includeLayout: true });
  assert.deepEqual(
    withLayout.States.ProcessOrder.edge?.NotifyOpsIfNeeded?.style?.sourceAnchor,
    { side: 'top', ratio: 0.4 }
  );

  const restored = parseSeataJsonToGraph(withLayout);
  const restoredCatch = restored.edges.find((e) => e.type === 'Catch')!;
  assert.deepEqual(restoredCatch.sourceAnchor, { side: 'top', ratio: 0.4 });

  const withoutLayout = serializeGraphToSeataJson(pinnedGraph, { includeLayout: false });
  assert.equal(withoutLayout.States.ProcessOrder.edge, undefined);

  // SVG export includes the Catch boundary marker on the pinned top side
  const svg = exportGraphToSvg(restored);
  assert.ok(svg.includes('data-catch-side="top"'));

  // Full autoLayoutGraph clears stale manual anchor pins so Catch returns to auto 360° tracking
  const relaidOut = autoLayoutGraph(restored);
  const relaidCatch = relaidOut.edges.find((e) => e.type === 'Catch')!;
  assert.equal(relaidCatch.sourceAnchor, undefined);
});
