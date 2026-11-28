import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyImportedBundleToWorkspace,
  parseSeataImportBundle,
} from './batchImport';
import {
  createWorkspaceFromTemplate,
  getActiveMachineName,
  openSubStateMachine,
} from './subMachines';
import { SAGA_TEMPLATES } from './templates';

const GRANDCHILD_YAML = `# Level 3 Fraud Verification Sub-Flow
Name: customFraudCheckSubSaga
Comment: Fraud verification grandchild flow
StartState: RunFraudCheck
Version: 1.0.0
Type: STATE_LANG
States:
  RunFraudCheck:
    Type: ServiceTask
    ServiceName: fraudService
    ServiceMethod: verify
    Next: FraudPass
  FraudPass:
    Type: Succeed
`;

const CHILD_JSON = JSON.stringify(
  {
    Name: 'customPaymentSubSaga',
    Comment: 'Level 2 Payment child flow',
    StartState: 'CallFraudCheck',
    Version: '1.0.0',
    Type: 'STATE_LANG',
    States: {
      CallFraudCheck: {
        Type: 'SubStateMachine',
        StateMachineName: 'customFraudCheckSubSaga',
        Next: 'ChargeCard',
      },
      ChargeCard: {
        Type: 'ServiceTask',
        ServiceName: 'paymentService',
        ServiceMethod: 'charge',
        Next: 'PaymentDone',
      },
      PaymentDone: {
        Type: 'Succeed',
      },
    },
  },
  null,
  2
);

const PARENT_YAML = `# Top-level Order Parent Flow
Name: customOrderParentSaga
Comment: Parent flow referencing payment child
StartState: CreateOrder
Version: 2.0.0
Type: STATE_LANG
States:
  CreateOrder:
    Type: ServiceTask
    ServiceName: orderService
    ServiceMethod: create
    Next: ExecutePayment
  ExecutePayment:
    Type: SubStateMachine
    StateMachineName: customPaymentSubSaga
    Next: OrderDone
  OrderDone:
    Type: Succeed
`;

test('parseSeataImportBundle resolves 3-level parent-child hierarchy regardless of file selection order', () => {
  // Intentionally pass grandchild first, child second, parent last (mixed YAML + JSON)
  const bundle = parseSeataImportBundle([
    { filename: '01_fraud.yaml', content: GRANDCHILD_YAML },
    { filename: '02_payment.json', content: CHILD_JSON },
    { filename: '03_order_parent.yaml', content: PARENT_YAML },
  ]);

  assert.equal(bundle.errors.length, 0);
  assert.equal(bundle.machines.length, 3);
  assert.equal(bundle.rootMachineName, 'customOrderParentSaga');
  assert.deepEqual(
    bundle.machines.map((m) => m.graph.meta.name),
    ['customOrderParentSaga', 'customPaymentSubSaga', 'customFraudCheckSubSaga']
  );
  assert.deepEqual(bundle.linkedChildNames, [
    'customPaymentSubSaga',
    'customFraudCheckSubSaga',
  ]);
  assert.equal(bundle.additionalRootNames.length, 0);
  assert.equal(bundle.missingReferences.length, 0);
  assert.equal(bundle.primaryFormat, 'yaml');

  // Verify YAML comments preserved and missing style.bounds auto-laid-out cleanly
  const parentEntry = bundle.machines.find(
    (m) => m.graph.meta.name === 'customOrderParentSaga'
  )!;
  assert.ok(parentEntry.graph.yamlTemplate?.includes('# Top-level Order Parent Flow'));
  assert.equal(parentEntry.autoLaidOut, true);

  // Apply to workspace and drill down 2 levels cleanly
  const initialWs = createWorkspaceFromTemplate(SAGA_TEMPLATES[0].json);
  const nextWs = applyImportedBundleToWorkspace(initialWs, bundle);
  assert.equal(getActiveMachineName(nextWs), 'customOrderParentSaga');

  const drill1 = openSubStateMachine(nextWs, 'ExecutePayment');
  assert.equal(drill1.ok, true);
  if (drill1.ok) {
    assert.equal(drill1.created, false);
    assert.equal(drill1.targetName, 'customPaymentSubSaga');

    const drill2 = openSubStateMachine(drill1.workspace, 'CallFraudCheck');
    assert.equal(drill2.ok, true);
    if (drill2.ok) {
      assert.equal(drill2.created, false);
      assert.equal(drill2.targetName, 'customFraudCheckSubSaga');
      assert.ok(
        drill2.workspace.registry.customFraudCheckSubSaga.yamlTemplate?.includes(
          '# Level 3 Fraud Verification Sub-Flow'
        )
      );
    }
  }
});

test('parseSeataImportBundle supports multi-document YAML (---) and JSON array bundles', () => {
  const multiDocYaml = `${GRANDCHILD_YAML}\n---\n${PARENT_YAML.replace(
    'customPaymentSubSaga',
    'customFraudCheckSubSaga'
  )}`;
  const yamlBundle = parseSeataImportBundle([
    { filename: 'combined-flows.yaml', content: multiDocYaml },
  ]);

  assert.equal(yamlBundle.errors.length, 0);
  assert.equal(yamlBundle.machines.length, 2);
  assert.equal(yamlBundle.rootMachineName, 'customOrderParentSaga');
  assert.deepEqual(yamlBundle.linkedChildNames, ['customFraudCheckSubSaga']);

  const jsonArray = JSON.stringify([
    JSON.parse(CHILD_JSON),
    {
      Name: 'bundleParent',
      StartState: 'PayStep',
      States: {
        PayStep: {
          Type: 'SubStateMachine',
          StateMachineName: 'customPaymentSubSaga',
          Next: 'Done',
        },
        Done: { Type: 'Succeed' },
      },
    },
  ]);

  const jsonBundle = parseSeataImportBundle([
    { filename: 'bundle.json', content: jsonArray },
  ]);
  assert.equal(jsonBundle.errors.length, 0);
  assert.equal(jsonBundle.machines.length, 2);
  assert.equal(jsonBundle.rootMachineName, 'bundleParent');
  assert.deepEqual(jsonBundle.linkedChildNames, ['customPaymentSubSaga']);
});

test('parseSeataImportBundle reports partial syntax errors, missing child refs, and duplicate machine names', () => {
  const bundle = parseSeataImportBundle([
    { filename: 'parent.yaml', content: PARENT_YAML },
    { filename: 'broken.json', content: '{ not valid json' },
    { filename: 'parent-copy.yaml', content: PARENT_YAML },
  ]);

  assert.equal(bundle.machines.length, 1);
  assert.equal(bundle.errors.length, 1);
  assert.equal(bundle.errors[0].filename, 'broken.json');
  assert.equal(bundle.duplicateNames.length, 1);
  assert.equal(bundle.duplicateNames[0].machineName, 'customOrderParentSaga');
  assert.equal(bundle.missingReferences.length, 1);
  assert.equal(bundle.missingReferences[0].missingSubMachine, 'customPaymentSubSaga');
});
