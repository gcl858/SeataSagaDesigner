import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REDUCE_INVENTORY_AND_BALANCE_JSON,
  ORDER_FULFILLMENT_SUBMACHINE_JSON,
} from './templates';
import { parseSeataJsonToGraph } from './serializer';
import { evaluateChoiceExpression, runSagaSimulation } from './simulator';

test('evaluateChoiceExpression handles bracket variables and comparison operators', () => {
  assert.equal(
    evaluateChoiceExpression('[reduceInventoryResult] == true', {
      reduceInventoryResult: true,
    }),
    true
  );
  assert.equal(
    evaluateChoiceExpression('[amount] > 100', { amount: 250 }),
    true
  );
  assert.equal(
    evaluateChoiceExpression('[amount] <= 100', { amount: 250 }),
    false
  );
});

test('simulates happy path of reduceInventoryAndBalance to Succeed', () => {
  const graph = parseSeataJsonToGraph(REDUCE_INVENTORY_AND_BALANCE_JSON);
  const result = runSagaSimulation(graph, {
    businessKey: 'BIZ-1',
    count: 2,
    amount: 100,
  });
  assert.equal(result.finalStatus, 'SU');
  assert.equal(result.compensatedStates.length, 0);
  assert.equal(result.steps[result.steps.length - 1].nodeName, 'Succeed');
});

test('simulates exception in ReduceBalance triggering Catch -> CompensationTrigger -> LIFO compensation -> Fail', () => {
  const graph = parseSeataJsonToGraph(REDUCE_INVENTORY_AND_BALANCE_JSON);
  const result = runSagaSimulation(
    graph,
    { businessKey: 'BIZ-2', count: 5, amount: 999 },
    {
      ReduceBalance: {
        outcome: 'EXCEPTION',
        exceptionClass: 'java.lang.RuntimeException',
      },
    }
  );

  assert.equal(result.finalStatus, 'COMPENSATED');
  assert.deepEqual(result.compensatedStates, ['CompensateReduceInventory']);
  assert.equal(result.steps[result.steps.length - 1].nodeName, 'Fail');
});

test('simulates ScriptTask risk threshold failure triggering CompensationTrigger in orderFulfillmentSaga', () => {
  const graph = parseSeataJsonToGraph(ORDER_FULFILLMENT_SUBMACHINE_JSON);
  const result = runSagaSimulation(graph, {
    orderId: 'ORD-999',
    userId: 'U-1',
    totalAmount: 90000, // exceeds 50000 in Groovy script
  });

  assert.equal(result.finalStatus, 'COMPENSATED');
  assert.deepEqual(result.compensatedStates, ['CancelOrder']);
  assert.equal(result.steps[result.steps.length - 1].nodeName, 'OrderFailed');
});
