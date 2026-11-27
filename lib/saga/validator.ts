import { SagaGraph, ValidationIssue } from './types';

export interface ValidateSagaOptions {
  availableMachineNames?: ReadonlySet<string>;
}

export function validateSagaGraph(
  graph: SagaGraph,
  options?: ValidateSagaOptions
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let issueSeq = 1;

  const pushIssue = (
    severity: 'error' | 'warning',
    code: string,
    message: string,
    messageEn: string,
    refs?: { nodeId?: string; edgeId?: string }
  ) => {
    issues.push({
      id: `val_${issueSeq++}`,
      severity,
      code,
      message,
      messageEn,
      nodeId: refs?.nodeId,
      edgeId: refs?.edgeId,
    });
  };

  if (!graph.meta.name.trim()) {
    pushIssue(
      'error',
      'MISSING_MACHINE_NAME',
      '狀態機名稱 (Name) 不可為空。',
      'State machine Name cannot be empty.'
    );
  }

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const nameCounts = new Map<string, number>();

  for (const node of graph.nodes) {
    if (node.type === 'StartState') continue;
    nameCounts.set(node.name, (nameCounts.get(node.name) ?? 0) + 1);
  }

  nameCounts.forEach((count, name) => {
    if (count > 1) {
      pushIssue(
        'error',
        'DUPLICATE_STATE_NAME',
        `狀態名稱「${name}」重複出現 ${count} 次。`,
        `Duplicate state name "${name}" found ${count} times.`
      );
    }
  });

  // StartState verification
  const startNode = graph.nodes.find((n) => n.type === 'StartState');
  if (!startNode) {
    pushIssue(
      'error',
      'MISSING_START_NODE',
      '缺少起始節點 (StartState)。',
      'Missing StartState entry node.'
    );
  } else {
    const startEdges = graph.edges.filter(
      (e) => e.source === startNode.id && e.type === 'Transition'
    );
    if (startEdges.length === 0) {
      pushIssue(
        'error',
        'MISSING_START_TRANSITION',
        '起始節點尚未連接至任何初始執行狀態 (StartState)。',
        'Start node is not connected to any initial state (StartState).',
        { nodeId: startNode.id }
      );
    } else if (startEdges.length > 1) {
      pushIssue(
        'warning',
        'MULTIPLE_START_TRANSITIONS',
        '起始節點有多條輸出連線，Seata 僅會採用第一條作為 StartState。',
        'Start node has multiple outgoing transitions; only the first is serialized as StartState.',
        { nodeId: startNode.id }
      );
    }
  }

  // Terminal states check
  const hasTerminal = graph.nodes.some(
    (n) => n.type === 'Succeed' || n.type === 'Fail'
  );
  if (!hasTerminal) {
    pushIssue(
      'warning',
      'NO_TERMINAL_STATE',
      '狀態機未包含任何終止節點 (Succeed 或 Fail)。',
      'State machine has no terminal Succeed or Fail state.'
    );
  }

  // Edge integrity
  for (const edge of graph.edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
      pushIssue(
        'error',
        'BROKEN_EDGE',
        `連線 ${edge.id} 指向不存在的節點。`,
        `Edge ${edge.id} references a non-existent node.`,
        { edgeId: edge.id }
      );
    }
    if (edge.type === 'Choice' && !edge.expression?.trim()) {
      pushIssue(
        'warning',
        'EMPTY_CHOICE_EXPRESSION',
        `Choice 條件分支（指向 ${edge.target}）尚未填寫條件運算式 (Expression)。`,
        `Choice branch to "${edge.target}" is missing an Expression.`,
        { edgeId: edge.id, nodeId: edge.source }
      );
    }
  }

  // Reachability BFS from StartState (following Transition, Choice, Default, Catch, Compensation)
  const reachable = new Set<string>();
  if (startNode) {
    const queue = [startNode.id];
    reachable.add(startNode.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of graph.edges) {
        if (edge.source === current && !reachable.has(edge.target)) {
          reachable.add(edge.target);
          queue.push(edge.target);
        }
      }
    }
  }

  // Per-node semantic checks
  for (const node of graph.nodes) {
    if (node.type === 'StartState') continue;

    const outgoing = graph.edges.filter((e) => e.source === node.id);

    if (startNode && !reachable.has(node.id)) {
      pushIssue(
        'warning',
        'UNREACHABLE_STATE',
        `狀態「${node.name}」無法從起始節點到達（孤立節點）。`,
        `State "${node.name}" is unreachable from StartState.`,
        { nodeId: node.id }
      );
    }

    if (node.type === 'ServiceTask') {
      if (!node.serviceName?.trim() || !node.serviceMethod?.trim()) {
        pushIssue(
          'error',
          'INCOMPLETE_SERVICE_TASK',
          `ServiceTask「${node.name}」必須設定 ServiceName 與 ServiceMethod。`,
          `ServiceTask "${node.name}" must specify both ServiceName and ServiceMethod.`,
          { nodeId: node.id }
        );
      }

      if (node.inputJson && node.inputJson.trim()) {
        try {
          const parsed = JSON.parse(node.inputJson);
          if (!Array.isArray(parsed)) {
            pushIssue(
              'error',
              'INVALID_INPUT_JSON',
              `狀態「${node.name}」的 Input 必須是 JSON 陣列。`,
              `State "${node.name}" Input must be a valid JSON array.`,
              { nodeId: node.id }
            );
          }
        } catch {
          pushIssue(
            'error',
            'INVALID_INPUT_JSON',
            `狀態「${node.name}」的 Input JSON 格式錯誤。`,
            `State "${node.name}" has invalid JSON syntax in Input.`,
            { nodeId: node.id }
          );
        }
      }

      if (node.outputJson && node.outputJson.trim()) {
        try {
          const parsed = JSON.parse(node.outputJson);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            pushIssue(
              'error',
              'INVALID_OUTPUT_JSON',
              `狀態「${node.name}」的 Output 必須是 JSON 物件。`,
              `State "${node.name}" Output must be a valid JSON object.`,
              { nodeId: node.id }
            );
          }
        } catch {
          pushIssue(
            'error',
            'INVALID_OUTPUT_JSON',
            `狀態「${node.name}」的 Output JSON 格式錯誤。`,
            `State "${node.name}" has invalid JSON syntax in Output.`,
            { nodeId: node.id }
          );
        }
      }

      // Check compensation target validity
      const compEdge = outgoing.find((e) => e.type === 'Compensation');
      if (compEdge) {
        const compTarget = nodeMap.get(compEdge.target);
        if (compTarget && compTarget.type !== 'ServiceTask' && compTarget.type !== 'ScriptTask' && compTarget.type !== 'SubStateMachine') {
          pushIssue(
            'error',
            'INVALID_COMPENSATION_TARGET',
            `「${node.name}」的補償目標「${compTarget.name}」必須是 ServiceTask、ScriptTask 或 SubStateMachine。`,
            `Compensation target "${compTarget.name}" for "${node.name}" must be a ServiceTask, ScriptTask, or SubStateMachine.`,
            { nodeId: node.id, edgeId: compEdge.id }
          );
        }
      }

      // Non-compensation ServiceTask without Next
      const hasNext = outgoing.some((e) => e.type === 'Transition');
      if (!node.isForCompensation && !hasNext) {
        pushIssue(
          'warning',
          'DANGLING_SERVICE_TASK',
          `正向 ServiceTask「${node.name}」未連接下一個狀態 (Next)。`,
          `Forward ServiceTask "${node.name}" has no outgoing Next transition.`,
          { nodeId: node.id }
        );
      }
    }

    if (node.type === 'ScriptTask') {
      if (!node.scriptContent?.trim()) {
        pushIssue(
          'error',
          'EMPTY_SCRIPT_CONTENT',
          `ScriptTask「${node.name}」缺少腳本內容 (ScriptContent)。`,
          `ScriptTask "${node.name}" requires ScriptContent.`,
          { nodeId: node.id }
        );
      }
    }

    if (node.type === 'SubStateMachine') {
      const subName = node.stateMachineName?.trim() || '';
      if (!subName) {
        pushIssue(
          'error',
          'MISSING_SUB_STATEMACHINE_NAME',
          `SubStateMachine「${node.name}」必須指定子狀態機名稱 (StateMachineName)。`,
          `SubStateMachine "${node.name}" requires StateMachineName.`,
          { nodeId: node.id }
        );
      } else if (subName === graph.meta.name.trim()) {
        pushIssue(
          'error',
          'SELF_RECURSIVE_SUBMACHINE',
          `SubStateMachine「${node.name}」不可直接遞迴呼叫自身狀態機「${subName}」。`,
          `SubStateMachine "${node.name}" cannot recursively invoke its own state machine "${subName}".`,
          { nodeId: node.id }
        );
      } else if (
        options?.availableMachineNames &&
        !options.availableMachineNames.has(subName)
      ) {
        pushIssue(
          'warning',
          'UNRESOLVED_SUB_STATEMACHINE',
          `子狀態機「${subName}」尚未在工作區定義，雙擊節點「${node.name}」可自動建立。`,
          `SubStateMachine "${subName}" is not defined in this workspace yet; double-click "${node.name}" to scaffold it.`,
          { nodeId: node.id }
        );
      }
    }

    if (node.type === 'Choice') {
      const choiceEdges = outgoing.filter((e) => e.type === 'Choice');
      const defaultEdge = outgoing.find((e) => e.type === 'Default');
      if (choiceEdges.length === 0 && !defaultEdge) {
        pushIssue(
          'error',
          'EMPTY_CHOICE_NODE',
          `Choice 節點「${node.name}」至少需要一條條件分支或預設分支 (Default)。`,
          `Choice state "${node.name}" needs at least one Choice branch or Default branch.`,
          { nodeId: node.id }
        );
      } else if (!defaultEdge) {
        pushIssue(
          'warning',
          'MISSING_CHOICE_DEFAULT',
          `Choice 節點「${node.name}」建議設定預設分支 (Default) 以避免條件皆不成立時中止。`,
          `Choice state "${node.name}" should define a Default branch as a fallback.`,
          { nodeId: node.id }
        );
      }
    }

    if (node.type === 'CompensationTrigger') {
      const hasNext = outgoing.some((e) => e.type === 'Transition');
      if (!hasNext) {
        pushIssue(
          'warning',
          'COMPENSATION_TRIGGER_NO_NEXT',
          `CompensationTrigger「${node.name}」建議連接至 Fail 終止狀態。`,
          `CompensationTrigger "${node.name}" should connect to a Fail terminal state.`,
          { nodeId: node.id }
        );
      }
    }
  }

  return issues;
}
