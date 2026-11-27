import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDER_FULFILLMENT_SUBMACHINE_JSON,
  REDUCE_INVENTORY_AND_BALANCE_JSON,
} from './templates';
import {
  parseSeataJsonToGraph,
  renameStateInGraph,
  serializeGraphToSeataJson,
} from './serializer';
import {
  formatSeataYaml,
  parseSeataSourceToGraph,
  parseSeataYamlToGraph,
  renameStateInYamlTemplate,
  serializeGraphToSeataYaml,
} from './yaml';

test('round-trips official reduceInventoryAndBalance through YAML without losing semantics or layout', () => {
  const originalGraph = parseSeataJsonToGraph(REDUCE_INVENTORY_AND_BALANCE_JSON);
  const yamlText = serializeGraphToSeataYaml(originalGraph, {
    includeLayout: true,
  });

  assert.ok(yamlText.includes('Name: reduceInventoryAndBalance'));
  assert.ok(yamlText.includes('StartState: ReduceInventory'));
  assert.ok(yamlText.includes('CompensateState: CompensateReduceInventory'));

  const reparsedGraph = parseSeataYamlToGraph(yamlText);
  const originalJson = serializeGraphToSeataJson(originalGraph, {
    includeLayout: true,
  });
  const reparsedJson = serializeGraphToSeataJson(reparsedGraph, {
    includeLayout: true,
  });

  assert.deepEqual(reparsedJson, originalJson);
});

test('omits style bounds in YAML when includeLayout is false and preserves ScriptTask & SubStateMachine', () => {
  const graph = parseSeataJsonToGraph(ORDER_FULFILLMENT_SUBMACHINE_JSON);
  const yamlText = serializeGraphToSeataYaml(graph, { includeLayout: false });

  assert.ok(!yamlText.includes('bounds:'));
  assert.ok(yamlText.includes('StateMachineName: paymentSettlementSubSaga'));
  assert.ok(yamlText.includes('ScriptType: groovy'));

  const { graph: imported, detectedFormat } = parseSeataSourceToGraph(yamlText);
  assert.equal(detectedFormat, 'yaml');
  assert.equal(imported.meta.name, 'orderFulfillmentSaga');
  assert.ok(imported.nodes.some((n) => n.name === 'PaymentSubMachine'));
});

test('rejects invalid YAML or YAML missing States mapping', () => {
  assert.throws(
    () => parseSeataYamlToGraph('Name: broken\nVersion: 1.0.0\n'),
    /States/
  );
  assert.throws(() => parseSeataYamlToGraph(':\n  - : [invalid'), Error);
});

test('formats valid Seata YAML cleanly while preserving all # comments', () => {
  const commentedYaml = `# 檔案標頭註解：庫存與餘額扣減
Name:   demoYaml # 狀態機名稱註解
StartState: S1
Version: "1.0"
# 狀態集合說明
States:
  # 成功節點說明
  S1:
    Type: Succeed # 終止類型
# 檔案結尾註解
`;
  const formatted = formatSeataYaml(commentedYaml);
  assert.ok(formatted.includes('# 檔案標頭註解：庫存與餘額扣減'));
  assert.ok(formatted.includes('# 狀態機名稱註解'));
  assert.ok(formatted.includes('# 狀態集合說明'));
  assert.ok(formatted.includes('# 成功節點說明'));
  assert.ok(formatted.includes('# 終止類型'));
  assert.ok(formatted.includes('# 檔案結尾註解'));
});

test('preserves header, block, inline, array, and trailing YAML # comments across canvas edits and export', () => {
  const sourceYaml = `# ====================================
# 訂單履約 Saga 狀態機定義 (YAML 註解測試)
# ====================================
Name: commentedOrderSaga # 主流程名稱
Comment: 保留所有 YAML 註解
StartState: ReserveStock
Version: 1.0.0 # 版本號
Persist: true
States:
  # 第一步：預扣庫存服務
  ReserveStock:
    Type: ServiceTask
    ServiceName: stockService # 庫存微服務 Bean
    ServiceMethod: reserve # 扣減庫存方法
    ServiceType: SpringBean
    CompensateState: CompensateStock
    Input:
      # 傳入訂單編號
      - "$.[orderId]" # 訂單主鍵
    Next: Done
  # 補償步驟：釋放已預扣庫存
  CompensateStock:
    Type: ServiceTask
    ServiceName: stockService
    ServiceMethod: release # 釋放庫存
    ServiceType: SpringBean
    IsForCompensation: true
  # 終止成功節點
  Done:
    Type: Succeed
# 檔案尾端備註
`;

  const graph = parseSeataYamlToGraph(sourceYaml);

  // Simulate visual edits: change Version, change ServiceMethod, move node position
  const editedGraph = {
    ...graph,
    meta: { ...graph.meta, version: '2.5.0' },
    nodes: graph.nodes.map((n) =>
      n.id === 'ReserveStock'
        ? { ...n, serviceMethod: 'reserveV2', x: 240, y: 180 }
        : n
    ),
  };

  // Export with layout included
  const exportedWithLayout = serializeGraphToSeataYaml(editedGraph, {
    includeLayout: true,
  });

  assert.ok(exportedWithLayout.includes('# 訂單履約 Saga 狀態機定義 (YAML 註解測試)'));
  assert.ok(exportedWithLayout.includes('# 主流程名稱'));
  assert.ok(exportedWithLayout.includes('Version: 2.5.0 # 版本號'));
  assert.ok(exportedWithLayout.includes('# 第一步：預扣庫存服務'));
  assert.ok(exportedWithLayout.includes('ServiceName: stockService # 庫存微服務 Bean'));
  assert.ok(exportedWithLayout.includes('ServiceMethod: reserveV2 # 扣減庫存方法'));
  assert.ok(exportedWithLayout.includes('# 傳入訂單編號'));
  assert.ok(exportedWithLayout.includes('# 訂單主鍵'));
  assert.ok(exportedWithLayout.includes('# 補償步驟：釋放已預扣庫存'));
  assert.ok(exportedWithLayout.includes('# 終止成功節點'));
  assert.ok(exportedWithLayout.includes('# 檔案尾端備註'));

  // Export without layout bounds still preserves all comments
  const exportedNoLayout = serializeGraphToSeataYaml(editedGraph, {
    includeLayout: false,
  });
  assert.ok(!exportedNoLayout.includes('bounds:'));
  assert.ok(exportedNoLayout.includes('ServiceMethod: reserveV2 # 扣減庫存方法'));
  assert.ok(exportedNoLayout.includes('# 第一步：預扣庫存服務'));

  // Rename state and verify its comments move with the renamed state key
  const renamed = renameStateInGraph(editedGraph, 'ReserveStock', 'LockInventory');
  const renamedWithTemplate = {
    ...renamed,
    yamlTemplate: renameStateInYamlTemplate(
      editedGraph.yamlTemplate,
      'ReserveStock',
      'LockInventory'
    ),
  };
  const exportedRenamed = serializeGraphToSeataYaml(renamedWithTemplate, {
    includeLayout: false,
  });
  assert.ok(exportedRenamed.includes('StartState: LockInventory'));
  assert.ok(exportedRenamed.includes('# 第一步：預扣庫存服務'));
  assert.ok(exportedRenamed.includes('LockInventory:'));
  assert.ok(exportedRenamed.includes('ServiceMethod: reserveV2 # 扣減庫存方法'));
});
