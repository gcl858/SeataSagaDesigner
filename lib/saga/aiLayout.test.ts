import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAiLayoutToGraph,
  buildAiLayoutPrompts,
  computeLayoutMetrics,
  extractAiLayoutJsonFromText,
  resolveMiniMaxBaseUrl,
  resolveMiniMaxModel,
  resolveNodeOverlaps,
  validateAiLayoutRequest,
} from './aiLayout';
import { parseSeataJsonToGraph } from './serializer';
import { SAGA_TEMPLATES } from './templates';
import { SagaGraph } from './types';

function makeSampleGraph(): SagaGraph {
  const base = parseSeataJsonToGraph(SAGA_TEMPLATES[0].json);
  return {
    ...base,
    yamlTemplate: '# Top-level Saga header comment\nName: demo\n',
  };
}

test('computeLayoutMetrics detects overlapping nodes and edge crossings accurately', () => {
  const crossedGraph: SagaGraph = {
    meta: {
      name: 'crossedDemo',
      comment: '',
      version: '0.0.1',
      persist: true,
      retryPersistModeUpdate: false,
      compensatePersistModeUpdate: false,
    },
    nodes: [
      { id: 'A', name: 'A', type: 'ServiceTask', x: 100, y: 100, width: 172, height: 74 },
      { id: 'B', name: 'B', type: 'ServiceTask', x: 120, y: 110, width: 172, height: 74 }, // overlaps A
      { id: 'C', name: 'C', type: 'ServiceTask', x: 500, y: 100, width: 172, height: 74 },
      { id: 'D', name: 'D', type: 'ServiceTask', x: 100, y: 360, width: 172, height: 74 },
      { id: 'E', name: 'E', type: 'ServiceTask', x: 500, y: 360, width: 172, height: 74 },
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'E', type: 'Transition' },
      { id: 'e2', source: 'D', target: 'C', type: 'Transition' },
    ],
  };

  const metrics = computeLayoutMetrics(crossedGraph);
  assert.equal(metrics.nodeCount, 5);
  assert.equal(metrics.overlapCount, 1);
  assert.equal(metrics.edgeCrossings, 1);
  assert.ok(metrics.totalEdgeLength > 0);
  assert.ok(metrics.boundsWidth > 0);
  assert.ok(metrics.boundsHeight > 0);
});

test('resolveNodeOverlaps eliminates all AABB collisions and normalizes origin', () => {
  const stacked = makeSampleGraph().nodes.map((n) => ({
    ...n,
    x: 200,
    y: 200,
  }));

  const resolved = resolveNodeOverlaps(stacked, { padding: 36 });
  assert.equal(resolved.length, stacked.length);

  const metrics = computeLayoutMetrics({
    ...makeSampleGraph(),
    nodes: resolved,
  });
  assert.equal(metrics.overlapCount, 0);

  const minX = Math.min(...resolved.map((n) => n.x));
  const minY = Math.min(...resolved.map((n) => n.y));
  assert.equal(minX, 48);
  assert.equal(minY, 56);
});

test('applyAiLayoutToGraph preserves all Seata semantics, edges, and yamlTemplate comments even with partial AI positions', () => {
  const original = makeSampleGraph();
  const subsetPositions = original.nodes.slice(0, 4).map((n, idx) => ({
    id: n.id,
    x: 100 + idx * 240,
    y: 160,
  }));
  // Include an unknown node ID to confirm it is safely ignored
  subsetPositions.push({ id: 'NonExistentGhostNode', x: 999, y: 999 });

  const applied = applyAiLayoutToGraph(original, subsetPositions, {
    style: 'horizontal-swimlane',
  });

  assert.equal(applied.nodes.length, original.nodes.length);
  assert.equal(applied.edges.length, original.edges.length);
  assert.equal(applied.yamlTemplate, original.yamlTemplate);
  assert.deepEqual(
    applied.nodes.map((n) => n.id),
    original.nodes.map((n) => n.id)
  );
  assert.equal(computeLayoutMetrics(applied).overlapCount, 0);
});

test('validateAiLayoutRequest rejects invalid graphs and sanitizes style, prompt, and MiniMax model', () => {
  assert.equal(validateAiLayoutRequest(null).ok, false);
  assert.equal(
    validateAiLayoutRequest({ graph: { meta: {}, nodes: [], edges: [] } }).ok,
    false
  );

  const sample = makeSampleGraph();
  const valid = validateAiLayoutRequest({
    graph: sample,
    style: 'compensation-aligned',
    customPrompt: '  Align compensation below tasks  ',
    locale: 'en',
    model: 'MiniMax-M3',
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.data.style, 'compensation-aligned');
    assert.equal(valid.data.customPrompt, 'Align compensation below tasks');
    assert.equal(valid.data.locale, 'en');
    assert.equal(valid.data.model, 'MiniMax-M3');
  }

  const fallbackStyle = validateAiLayoutRequest({
    graph: sample,
    style: 'unknown-style',
    model: 'not-allowed-model; rm -rf',
  });
  assert.equal(fallbackStyle.ok, true);
  if (fallbackStyle.ok) {
    assert.equal(fallbackStyle.data.style, 'horizontal-swimlane');
    assert.equal(fallbackStyle.data.locale, 'zh-TW');
    assert.equal(fallbackStyle.data.model, undefined);
  }
});

test('buildAiLayoutPrompts includes style directive, locale directive, JSON schema contract, and all node IDs', () => {
  const sample = makeSampleGraph();
  const { systemInstruction, userPrompt } = buildAiLayoutPrompts(
    sample,
    'vertical-flowchart',
    'Keep error path separated',
    'zh-TW'
  );

  assert.match(systemInstruction, /繁體中文/);
  assert.match(systemInstruction, /vertical-flowchart/);
  assert.match(systemInstruction, /STRICT valid JSON/);
  assert.match(userPrompt, /Keep error path separated/);
  for (const node of sample.nodes) {
    assert.ok(userPrompt.includes(`"id":"${node.id}"`));
  }
});

test('extractAiLayoutJsonFromText parses raw JSON, markdown fenced JSON, and MiniMax <think> tagged output', () => {
  const raw = '{"positions":[{"id":"A","x":80,"y":120}],"summary":"ok","rationale":["r1"]}';
  assert.equal(extractAiLayoutJsonFromText(raw)?.summary, 'ok');

  const fenced = '```json\n{"positions":[{"id":"A","x":80,"y":120}],"summary":"fenced"}\n```';
  assert.equal(extractAiLayoutJsonFromText(fenced)?.summary, 'fenced');

  const withThink =
    '<think>Let me align the swimlanes carefully...</think>\n```json\n{"positions":[{"id":"A","x":100,"y":160}],"summary":"thought"}\n```';
  assert.equal(extractAiLayoutJsonFromText(withThink)?.summary, 'thought');

  const withProse = 'Here is the layout:\n{"positions":[],"summary":"prose"}\nDone.';
  assert.equal(extractAiLayoutJsonFromText(withProse)?.summary, 'prose');

  assert.equal(extractAiLayoutJsonFromText('not json at all'), null);
});

test('resolveMiniMaxBaseUrl enforces HTTPS allowlist and resolveMiniMaxModel falls back cleanly', () => {
  assert.equal(resolveMiniMaxBaseUrl('https://api.minimax.io/v1/'), 'https://api.minimax.io/v1');
  assert.equal(resolveMiniMaxBaseUrl('https://api.minimaxi.com/v1'), 'https://api.minimaxi.com/v1');
  // Untrusted hosts and non-HTTPS schemes fall back to official MiniMax endpoint
  assert.equal(resolveMiniMaxBaseUrl('http://127.0.0.1:8080/v1'), 'https://api.minimax.io/v1');
  assert.equal(resolveMiniMaxBaseUrl('https://169.254.169.254/latest'), 'https://api.minimax.io/v1');
  assert.equal(resolveMiniMaxBaseUrl('https://evil.example.com/v1'), 'https://api.minimax.io/v1');

  assert.equal(resolveMiniMaxModel('MiniMax-M3', undefined), 'MiniMax-M3');
  assert.equal(resolveMiniMaxModel('invalid-model', 'MiniMax-M2.5'), 'MiniMax-M2.5');
  assert.equal(resolveMiniMaxModel(undefined, undefined), 'MiniMax-M3.1-Flash');
});

test('applyAiLayoutToGraph fixes unaligned spine, tight Choice gap, and bottom-right Fail crossings to 0px drift and 0 crossings', () => {
  const original = makeSampleGraph();
  const startId = original.nodes.find((n) => n.type === 'StartState')!.id;
  // Reproduce the exact flawed coordinates visible in the user screenshot:
  // - Main spine nodes misaligned vertically (Start lower, Choice higher, ReduceBalance lower)
  // - Tight gap between ChoiceState and ReduceBalance causing label overlap
  // - Fail placed at bottom-right causing ChoiceState->Fail to cross Catch & CompensateReduceBalance
  const flawedAiPositions = [
    { id: startId, x: 60, y: 120 },
    { id: 'ReduceInventory', x: 160, y: 100 },
    { id: 'ChoiceState', x: 380, y: 80 },
    { id: 'ReduceBalance', x: 520, y: 100 },
    { id: 'Succeed', x: 740, y: 120 },
    { id: 'CompensateReduceInventory', x: 160, y: 260 },
    { id: 'CompensateReduceBalance', x: 520, y: 260 },
    { id: 'CompensationTrigger', x: 380, y: 420 },
    { id: 'Fail', x: 740, y: 420 },
  ];

  const refined = applyAiLayoutToGraph(original, flawedAiPositions, {
    style: 'horizontal-swimlane',
  });

  const byId = new Map(refined.nodes.map((n) => [n.id, n]));
  const spineIds = [
    startId,
    'ReduceInventory',
    'ChoiceState',
    'ReduceBalance',
    'Succeed',
  ];
  const spineCenters = spineIds.map((id) => {
    const n = byId.get(id)!;
    return Math.round(n.y + n.height / 2);
  });
  const maxDrift = Math.max(...spineCenters) - Math.min(...spineCenters);
  assert.equal(maxDrift, 0, `Expected 0px spine centerline drift, got centers: ${spineCenters.join(', ')}`);

  // ChoiceState -> ReduceBalance gap must comfortably fit "[reduceInventoryResult] == true"
  const choice = byId.get('ChoiceState')!;
  const reduceBal = byId.get('ReduceBalance')!;
  assert.ok(
    reduceBal.x - (choice.x + choice.width) >= 180,
    `Expected generous Choice->ReduceBalance gap, got ${reduceBal.x - (choice.x + choice.width)}`
  );

  // Paired compensation nodes must be plumb-aligned horizontally under their forward tasks
  const reduceInv = byId.get('ReduceInventory')!;
  const compInv = byId.get('CompensateReduceInventory')!;
  const compBal = byId.get('CompensateReduceBalance')!;
  assert.equal(
    Math.round(compInv.x + compInv.width / 2),
    Math.round(reduceInv.x + reduceInv.width / 2)
  );
  assert.equal(
    Math.round(compBal.x + compBal.width / 2),
    Math.round(reduceBal.x + reduceBal.width / 2)
  );

  // Zero overlaps, zero crossings, zero edges slicing through unrelated nodes!
  const metrics = computeLayoutMetrics(refined);
  assert.equal(metrics.overlapCount, 0);
  assert.equal(metrics.edgeCrossings, 0);
  assert.equal(metrics.nodeThroughEdgeHits, 0);
});
