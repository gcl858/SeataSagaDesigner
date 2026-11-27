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
});
