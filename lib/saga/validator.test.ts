import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REDUCE_INVENTORY_AND_BALANCE_JSON,
  ORDER_FULFILLMENT_SUBMACHINE_JSON,
} from './templates';
import { parseSeataJsonToGraph } from './serializer';
import { validateSagaGraph } from './validator';

test('official Seata templates pass validation with zero errors', () => {
  const graph1 = parseSeataJsonToGraph(REDUCE_INVENTORY_AND_BALANCE_JSON);
  const issues1 = validateSagaGraph(graph1);
  assert.equal(
    issues1.filter((i) => i.severity === 'error').length,
    0,
    `Unexpected errors: ${JSON.stringify(issues1)}`
  );

  const graph2 = parseSeataJsonToGraph(ORDER_FULFILLMENT_SUBMACHINE_JSON);
  const issues2 = validateSagaGraph(graph2);
  assert.equal(
    issues2.filter((i) => i.severity === 'error').length,
    0,
    `Unexpected errors: ${JSON.stringify(issues2)}`
  );
});

test('validator detects missing ServiceName, missing StartState edge, and unreachable nodes', () => {
  const graph = parseSeataJsonToGraph(REDUCE_INVENTORY_AND_BALANCE_JSON);
  // Remove start transition and break a service task
  graph.edges = graph.edges.filter((e) => e.source !== '__START__');
  const reduceInv = graph.nodes.find((n) => n.id === 'ReduceInventory')!;
  reduceInv.serviceName = '';
  reduceInv.inputJson = '{ not valid json array';

  const issues = validateSagaGraph(graph);
  const codes = new Set(issues.map((i) => i.code));
  assert.ok(codes.has('MISSING_START_TRANSITION'));
  assert.ok(codes.has('INCOMPLETE_SERVICE_TASK'));
  assert.ok(codes.has('INVALID_INPUT_JSON'));
});
