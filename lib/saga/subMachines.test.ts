import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILTIN_SUB_MACHINES_JSON,
  FRAUD_VERIFICATION_SUBMACHINE_JSON,
  ORDER_FULFILLMENT_SUBMACHINE_JSON,
  PAYMENT_SETTLEMENT_SUBMACHINE_JSON,
  SAGA_TEMPLATES,
} from './templates';
import {
  commitActiveGraph,
  createWorkspaceFromTemplate,
  getActiveGraph,
  getActiveMachineName,
  getParentFrame,
  navigateToStackIndex,
  openSubStateMachine,
  redoActiveMachine,
  undoActiveMachine,
} from './subMachines';
import { validateSagaGraph } from './validator';
import { runSagaSimulation } from './simulator';
import { parseSeataJsonToGraph } from './serializer';

test('drills down 2 levels through orderFulfillmentSaga -> paymentSettlementSubSaga -> fraudVerificationSubSaga and returns cleanly', () => {
  const orderTemplate = SAGA_TEMPLATES.find((t) => t.id === 'orderFulfillmentSaga')!;
  let ws = createWorkspaceFromTemplate(
    orderTemplate.json,
    orderTemplate.subMachines,
    BUILTIN_SUB_MACHINES_JSON
  );

  assert.equal(getActiveMachineName(ws), 'orderFulfillmentSaga');
  assert.equal(getParentFrame(ws), null);

  // Drill into Level 2
  const res1 = openSubStateMachine(ws, 'PaymentSubMachine');
  assert.equal(res1.ok, true);
  if (!res1.ok) return;
  assert.equal(res1.created, false);
  assert.equal(res1.targetName, 'paymentSettlementSubSaga');
  ws = res1.workspace;
  assert.equal(getActiveMachineName(ws), 'paymentSettlementSubSaga');
  assert.equal(getParentFrame(ws)?.parentMachineName, 'orderFulfillmentSaga');
  assert.equal(getParentFrame(ws)?.viaNodeId, 'PaymentSubMachine');

  // Drill into Level 3
  const res2 = openSubStateMachine(ws, 'FraudSubCheck');
  assert.equal(res2.ok, true);
  if (!res2.ok) return;
  assert.equal(res2.created, false);
  assert.equal(res2.targetName, 'fraudVerificationSubSaga');
  ws = res2.workspace;
  assert.equal(ws.navStack.length, 3);
  assert.equal(getActiveMachineName(ws), 'fraudVerificationSubSaga');

  // Return 1 level -> restores FraudSubCheck selection
  const backOne = navigateToStackIndex(ws, ws.navStack.length - 2);
  ws = backOne.workspace;
  assert.equal(getActiveMachineName(ws), 'paymentSettlementSubSaga');
  assert.equal(backOne.restoredNodeId, 'FraudSubCheck');

  // Jump straight to root -> restores PaymentSubMachine selection
  const backRoot = navigateToStackIndex(ws, 0);
  ws = backRoot.workspace;
  assert.equal(getActiveMachineName(ws), 'orderFulfillmentSaga');
  assert.equal(backRoot.restoredNodeId, 'PaymentSubMachine');
  assert.equal(ws.navStack.length, 1);
});

test('auto-scaffolds missing sub-state machine and isolates per-machine undo/redo history', () => {
  const orderTemplate = SAGA_TEMPLATES.find((t) => t.id === 'orderFulfillmentSaga')!;
  let ws = createWorkspaceFromTemplate(orderTemplate.json, orderTemplate.subMachines);

  // Add a custom SubStateMachine node with blank StateMachineName
  ws = commitActiveGraph(ws, (prev) => ({
    ...prev,
    nodes: [
      ...prev.nodes,
      {
        id: 'ShippingSub',
        name: 'ShippingSub',
        type: 'SubStateMachine',
        x: 900,
        y: 300,
        width: 184,
        height: 78,
        stateMachineName: '',
      },
    ],
  }));

  const opened = openSubStateMachine(ws, 'ShippingSub');
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  assert.equal(opened.created, true);
  assert.equal(opened.targetName, 'ShippingSubSubSaga');
  ws = opened.workspace;

  // Parent node should now have StateMachineName populated
  const parentNode = ws.registry.orderFulfillmentSaga.nodes.find(
    (n) => n.id === 'ShippingSub'
  );
  assert.equal(parentNode?.stateMachineName, 'ShippingSubSubSaga');

  // Edit inside child, undo inside child, verify child history doesn't touch parent
  ws = commitActiveGraph(ws, (prev) => ({
    ...prev,
    meta: { ...prev.meta, comment: 'Updated child comment' },
  }));
  assert.equal(getActiveGraph(ws).meta.comment, 'Updated child comment');

  ws = undoActiveMachine(ws);
  assert.notEqual(getActiveGraph(ws).meta.comment, 'Updated child comment');
  ws = redoActiveMachine(ws);
  assert.equal(getActiveGraph(ws).meta.comment, 'Updated child comment');
});

test('blocks circular SubStateMachine recursion and syncs child machine rename back to parent node', () => {
  const orderTemplate = SAGA_TEMPLATES.find((t) => t.id === 'orderFulfillmentSaga')!;
  let ws = createWorkspaceFromTemplate(orderTemplate.json, orderTemplate.subMachines);

  const res1 = openSubStateMachine(ws, 'PaymentSubMachine');
  assert.equal(res1.ok, true);
  if (!res1.ok) return;
  ws = res1.workspace;

  // Point FraudSubCheck back to parent orderFulfillmentSaga to test cycle block
  ws = commitActiveGraph(ws, (prev) => ({
    ...prev,
    nodes: prev.nodes.map((n) =>
      n.id === 'FraudSubCheck'
        ? { ...n, stateMachineName: 'orderFulfillmentSaga' }
        : n
    ),
  }));

  const cycleRes = openSubStateMachine(ws, 'FraudSubCheck');
  assert.equal(cycleRes.ok, false);
  if (!cycleRes.ok) {
    assert.equal(cycleRes.reason, 'cycle');
  }

  // Rename active sub-machine and verify parent SubStateMachine node updates automatically
  ws = commitActiveGraph(ws, (prev) => ({
    ...prev,
    meta: { ...prev.meta, name: 'paymentSettlementV2' },
  }));
  assert.equal(getActiveMachineName(ws), 'paymentSettlementV2');
  const parentPaymentNode = ws.registry.orderFulfillmentSaga.nodes.find(
    (n) => n.id === 'PaymentSubMachine'
  );
  assert.equal(parentPaymentNode?.stateMachineName, 'paymentSettlementV2');
});

test('built-in Level-2 and Level-3 sub-state machines pass validation with zero errors and detect self-recursion/unresolved refs', () => {
  const available = new Set([
    ORDER_FULFILLMENT_SUBMACHINE_JSON.Name,
    PAYMENT_SETTLEMENT_SUBMACHINE_JSON.Name,
    FRAUD_VERIFICATION_SUBMACHINE_JSON.Name,
  ]);

  for (const json of [
    ORDER_FULFILLMENT_SUBMACHINE_JSON,
    PAYMENT_SETTLEMENT_SUBMACHINE_JSON,
    FRAUD_VERIFICATION_SUBMACHINE_JSON,
  ]) {
    const graph = parseSeataJsonToGraph(json);
    const issues = validateSagaGraph(graph, { availableMachineNames: available });
    assert.equal(
      issues.length,
      0,
      `Expected zero issues for ${json.Name}, got: ${JSON.stringify(issues)}`
    );
  }

  // Self-recursion error & unresolved warning
  const broken = parseSeataJsonToGraph(ORDER_FULFILLMENT_SUBMACHINE_JSON);
  const subNode = broken.nodes.find((n) => n.id === 'PaymentSubMachine')!;
  subNode.stateMachineName = broken.meta.name;
  const selfIssues = validateSagaGraph(broken, { availableMachineNames: available });
  assert.ok(selfIssues.some((i) => i.code === 'SELF_RECURSIVE_SUBMACHINE'));

  subNode.stateMachineName = 'missingExternalSubSaga';
  const unresolvedIssues = validateSagaGraph(broken, {
    availableMachineNames: available,
  });
  assert.ok(unresolvedIssues.some((i) => i.code === 'UNRESOLVED_SUB_STATEMACHINE'));
});

test('recursively simulates 3-level orderFulfillmentSaga -> paymentSettlementSubSaga -> fraudVerificationSubSaga', () => {
  const orderTemplate = SAGA_TEMPLATES.find((t) => t.id === 'orderFulfillmentSaga')!;
  const ws = createWorkspaceFromTemplate(orderTemplate.json, orderTemplate.subMachines);
  const rootGraph = ws.registry.orderFulfillmentSaga;

  // Happy path: totalAmount = 12800 (passes both Risk <= 50000 and Fraud <= 30000)
  const okResult = runSagaSimulation(
    rootGraph,
    { orderId: 'ORD-1', userId: 'USR-1', totalAmount: 12800 },
    {},
    { subMachineGraphs: ws.registry }
  );
  assert.equal(okResult.finalStatus, 'SU');
  assert.ok(
    okResult.steps.some((s) => s.subMachineName === 'paymentSettlementSubSaga'),
    'Should include Level-2 sub-machine trace steps'
  );
  assert.ok(
    okResult.steps.some((s) => s.subMachineName === 'fraudVerificationSubSaga'),
    'Should include Level-3 sub-machine trace steps'
  );

  // Fraud rejection path: totalAmount = 42000 (passes Level-1 Risk <= 50000, fails Level-3 Fraud <= 30000 -> rolls back Level-2 FreezePaymentChannel -> parent Catch -> RollbackAll -> CancelOrder)
  const fraudRejectResult = runSagaSimulation(
    rootGraph,
    { orderId: 'ORD-2', userId: 'USR-2', totalAmount: 42000 },
    {},
    { subMachineGraphs: ws.registry }
  );
  assert.equal(fraudRejectResult.finalStatus, 'COMPENSATED');
  assert.deepEqual(fraudRejectResult.compensatedStates, ['CancelOrder']);
  assert.ok(
    fraudRejectResult.steps.some(
      (s) =>
        s.subMachineName === 'paymentSettlementSubSaga' &&
        s.nodeName === 'UnfreezePaymentChannel' &&
        s.status === 'COMPENSATED'
    ),
    'Should compensate FreezePaymentChannel inside Level-2 sub-machine'
  );
});
