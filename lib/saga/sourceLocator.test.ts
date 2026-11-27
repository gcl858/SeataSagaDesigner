import test from 'node:test';
import assert from 'node:assert/strict';
import { REDUCE_INVENTORY_AND_BALANCE_JSON } from './templates';
import {
  parseSeataJsonToGraph,
  serializeGraphToSeataJson,
  START_NODE_ID,
} from './serializer';
import { parseSeataYamlToGraph, serializeGraphToSeataYaml } from './yaml';
import { locateSelectionInSource } from './sourceLocator';

test('locates exact state blocks and edges in JSON source', () => {
  const graph = parseSeataJsonToGraph(REDUCE_INVENTORY_AND_BALANCE_JSON);
  const jsonText = JSON.stringify(
    serializeGraphToSeataJson(graph, { includeLayout: true }),
    null,
    2
  );
  const lines = jsonText.split('\n');

  const startRange = locateSelectionInSource(jsonText, 'json', {
    kind: 'node',
    nodeId: START_NODE_ID,
    nodeName: 'Start',
  });
  assert.ok(startRange);
  assert.ok(lines[startRange.startLine - 1].includes('"StartState"'));

  const failRange = locateSelectionInSource(jsonText, 'json', {
    kind: 'node',
    nodeId: 'Fail',
    nodeName: 'Fail',
  });
  assert.ok(failRange);
  assert.ok(lines[failRange.startLine - 1].includes('"Fail": {'));
  assert.ok(lines[failRange.endLine - 1].trim().startsWith('}'));
  assert.ok(failRange.endLine > failRange.startLine);

  const compEdgeRange = locateSelectionInSource(jsonText, 'json', {
    kind: 'edge',
    edgeId: 'e1',
    source: 'ReduceInventory',
    target: 'CompensateReduceInventory',
    edgeType: 'Compensation',
  });
  assert.ok(compEdgeRange);
  assert.ok(
    lines[compEdgeRange.startLine - 1].includes(
      '"CompensateState": "CompensateReduceInventory"'
    )
  );
});

test('locates exact state blocks and edges in commented YAML source', () => {
  const commentedYaml = `# Header comment
Name: commentedDemo
StartState: StepOne
Version: 1.0.0
States:
  # First task comment
  StepOne:
    Type: ServiceTask
    ServiceName: svc # inline comment
    ServiceMethod: run
    CompensateState: UndoOne
    Next: Done
  # Compensation task
  UndoOne:
    Type: ServiceTask
    ServiceName: svc
    ServiceMethod: undo
    IsForCompensation: true
  # Terminal
  Done:
    Type: Succeed
`;
  const graph = parseSeataYamlToGraph(commentedYaml);
  const yamlText = serializeGraphToSeataYaml(graph, { includeLayout: false });
  const lines = yamlText.split('\n');

  const undoRange = locateSelectionInSource(yamlText, 'yaml', {
    kind: 'node',
    nodeId: 'UndoOne',
    nodeName: 'UndoOne',
  });
  assert.ok(undoRange);
  assert.ok(lines[undoRange.startLine - 1].trim().startsWith('UndoOne:'));
  assert.ok(lines[undoRange.endLine - 1].includes('IsForCompensation: true'));
  assert.ok(!lines[undoRange.endLine - 1].includes('Done:'));

  const nextEdgeRange = locateSelectionInSource(yamlText, 'yaml', {
    kind: 'edge',
    edgeId: 'e2',
    source: 'StepOne',
    target: 'Done',
    edgeType: 'Transition',
  });
  assert.ok(nextEdgeRange);
  assert.ok(lines[nextEdgeRange.startLine - 1].includes('Next: Done'));
});
