import {
  NodeSimulationOverride,
  SagaGraph,
  SagaNode,
  SimulationResult,
  SimulationStep,
} from './types';

function resolveContextValue(
  expr: string,
  context: Record<string, unknown>
): unknown {
  const trimmed = expr.trim();
  // Match Seata bracket syntax: [varName] or $.varName
  const bracketMatch = trimmed.match(/^\[([a-zA-Z0-9_.-]+)\]$/);
  if (bracketMatch) {
    return context[bracketMatch[1]];
  }
  const jsonPathMatch = trimmed.match(/^\$\.\[?([a-zA-Z0-9_.-]+)\]?$/);
  if (jsonPathMatch) {
    return context[jsonPathMatch[1]];
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed in context) return context[trimmed];
  return trimmed;
}

export function evaluateChoiceExpression(
  expression: string,
  context: Record<string, unknown>
): boolean {
  const clean = expression.trim();
  if (!clean) return false;

  const operators = ['==', '!=', '>=', '<=', '>', '<'] as const;
  for (const op of operators) {
    const idx = clean.indexOf(op);
    if (idx !== -1) {
      const left = resolveContextValue(clean.slice(0, idx), context);
      const right = resolveContextValue(clean.slice(idx + op.length), context);
      switch (op) {
        case '==':
          return left === right || String(left) === String(right);
        case '!=':
          return left !== right && String(left) !== String(right);
        case '>=':
          return Number(left) >= Number(right);
        case '<=':
          return Number(left) <= Number(right);
        case '>':
          return Number(left) > Number(right);
        case '<':
          return Number(left) < Number(right);
      }
    }
  }

  // Truthy lookup
  return Boolean(resolveContextValue(clean, context));
}

function applyOutputMapping(
  node: SagaNode,
  rootResult: unknown,
  context: Record<string, unknown>
) {
  if (!node.outputJson) return;
  try {
    const mapping = JSON.parse(node.outputJson) as Record<string, unknown>;
    if (mapping && typeof mapping === 'object' && !Array.isArray(mapping)) {
      for (const [key, expr] of Object.entries(mapping)) {
        if (expr === '$.#root' || expr === '#root') {
          context[key] = rootResult;
        } else if (typeof expr === 'string') {
          context[key] = resolveContextValue(expr, context);
        } else {
          context[key] = expr;
        }
      }
    }
  } catch {
    // Ignore malformed JSON during simulation
  }
}

export interface SimulationOptions {
  subMachineGraphs?: Record<string, SagaGraph>;
  maxDepth?: number;
}

export function runSagaSimulation(
  graph: SagaGraph,
  initialContext: Record<string, unknown>,
  overrides: Record<string, NodeSimulationOverride> = {},
  options?: SimulationOptions
): SimulationResult {
  return runSagaSimulationInternal(
    graph,
    initialContext,
    overrides,
    options,
    0,
    new Set([graph.meta.name])
  );
}

function runSagaSimulationInternal(
  graph: SagaGraph,
  initialContext: Record<string, unknown>,
  overrides: Record<string, NodeSimulationOverride>,
  options: SimulationOptions | undefined,
  depth: number,
  activeChain: Set<string>
): SimulationResult {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const context: Record<string, unknown> = { ...initialContext };
  const steps: SimulationStep[] = [];
  const visitedNodeIds: string[] = [];
  const visitedEdgeIds: string[] = [];
  const compensatedStates: string[] = [];
  const compensationStack: Array<{ sourceNode: SagaNode; compNode: SagaNode; edgeId: string }> = [];
  const maxDepth = options?.maxDepth ?? 5;

  const startNode = graph.nodes.find((n) => n.type === 'StartState');
  if (!startNode) {
    return {
      finalStatus: 'FA',
      steps,
      finalContext: context,
      compensatedStates,
      visitedNodeIds,
      visitedEdgeIds,
      error: 'Missing StartState node.',
    };
  }

  visitedNodeIds.push(startNode.id);
  const startEdge = graph.edges.find(
    (e) => e.source === startNode.id && e.type === 'Transition'
  );
  if (!startEdge || !nodeMap.has(startEdge.target)) {
    return {
      finalStatus: 'FA',
      steps,
      finalContext: context,
      compensatedStates,
      visitedNodeIds,
      visitedEdgeIds,
      error: 'Start node is not connected to any initial state.',
    };
  }

  visitedEdgeIds.push(startEdge.id);
  steps.push({
    stepNumber: 1,
    nodeId: startNode.id,
    nodeName: 'Start',
    nodeType: 'StartState',
    phase: 'forward',
    status: 'SU',
    detail: `啟動狀態機「${graph.meta.name}」，進入初始狀態 ${startEdge.target}`,
    detailEn: `Started "${graph.meta.name}", transitioning to ${startEdge.target}`,
    edgeId: startEdge.id,
    contextSnapshot: { ...context },
  });

  let currentId: string | undefined = startEdge.target;
  let guard = 0;
  const maxSteps = 50;
  let hasCompensated = false;

  while (currentId && guard < maxSteps) {
    guard += 1;
    const node = nodeMap.get(currentId);
    if (!node) break;

    visitedNodeIds.push(node.id);
    const outgoing = graph.edges.filter((e) => e.source === node.id);

    if (node.type === 'Succeed') {
      steps.push({
        stepNumber: steps.length + 1,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        phase: 'terminal',
        status: 'SU',
        detail: `到達終止節點 ${node.name}，分散式事務執行成功 (SU)。`,
        detailEn: `Reached terminal ${node.name}. Distributed Saga succeeded (SU).`,
        contextSnapshot: { ...context },
      });
      return {
        finalStatus: 'SU',
        steps,
        finalContext: context,
        compensatedStates,
        visitedNodeIds,
        visitedEdgeIds,
      };
    }

    if (node.type === 'Fail') {
      const code = node.errorCode || 'SAGA_FAILED';
      steps.push({
        stepNumber: steps.length + 1,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        phase: 'terminal',
        status: hasCompensated ? 'COMPENSATED' : 'FA',
        detail: `到達失敗終止節點 ${node.name}（ErrorCode: ${code}）。${hasCompensated ? '已完成所有正向任務補償。' : ''}`,
        detailEn: `Reached terminal Fail state ${node.name} (ErrorCode: ${code}).${hasCompensated ? ' Compensation stack unwound.' : ''}`,
        contextSnapshot: { ...context },
      });
      return {
        finalStatus: hasCompensated ? 'COMPENSATED' : 'FA',
        steps,
        finalContext: context,
        compensatedStates,
        visitedNodeIds,
        visitedEdgeIds,
      };
    }

    if (node.type === 'CompensationTrigger') {
      steps.push({
        stepNumber: steps.length + 1,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        phase: 'compensation',
        status: 'COMPENSATED',
        detail: `觸發 CompensationTrigger：開始以 LIFO 逆序執行 ${compensationStack.length} 個補償任務。`,
        detailEn: `CompensationTrigger fired: unwinding ${compensationStack.length} compensable task(s) in reverse LIFO order.`,
        contextSnapshot: { ...context },
      });

      while (compensationStack.length > 0) {
        const entry = compensationStack.pop()!;
        visitedEdgeIds.push(entry.edgeId);
        visitedNodeIds.push(entry.compNode.id);
        compensatedStates.push(entry.compNode.name);
        hasCompensated = true;

        steps.push({
          stepNumber: steps.length + 1,
          nodeId: entry.compNode.id,
          nodeName: entry.compNode.name,
          nodeType: entry.compNode.type,
          phase: 'compensation',
          status: 'COMPENSATED',
          detail: `補償「${entry.sourceNode.name}」→ 呼叫 ${entry.compNode.serviceName || entry.compNode.name}.${entry.compNode.serviceMethod || 'compensate'}() 完成回滾。`,
          detailEn: `Compensating "${entry.sourceNode.name}" -> executed ${entry.compNode.serviceName || entry.compNode.name}.${entry.compNode.serviceMethod || 'compensate'}().`,
          edgeId: entry.edgeId,
          contextSnapshot: { ...context },
        });
      }

      const nextEdge = outgoing.find((e) => e.type === 'Transition');
      if (nextEdge) {
        visitedEdgeIds.push(nextEdge.id);
        currentId = nextEdge.target;
      } else {
        return {
          finalStatus: 'COMPENSATED',
          steps,
          finalContext: context,
          compensatedStates,
          visitedNodeIds,
          visitedEdgeIds,
        };
      }
      continue;
    }

    if (node.type === 'Choice') {
      const choiceEdges = outgoing.filter((e) => e.type === 'Choice');
      let matchedEdge = choiceEdges.find((e) =>
        evaluateChoiceExpression(e.expression || '', context)
      );
      let usedDefault = false;
      if (!matchedEdge) {
        matchedEdge = outgoing.find((e) => e.type === 'Default');
        usedDefault = true;
      }

      if (!matchedEdge) {
        steps.push({
          stepNumber: steps.length + 1,
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          phase: 'forward',
          status: 'FA',
          detail: `Choice「${node.name}」無符合分支且未定義 Default，狀態機中止。`,
          detailEn: `Choice "${node.name}" matched no branch and has no Default fallback.`,
          contextSnapshot: { ...context },
        });
        return {
          finalStatus: 'FA',
          steps,
          finalContext: context,
          compensatedStates,
          visitedNodeIds,
          visitedEdgeIds,
          error: `Choice "${node.name}" matched no branch.`,
        };
      }

      visitedEdgeIds.push(matchedEdge.id);
      steps.push({
        stepNumber: steps.length + 1,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        phase: 'forward',
        status: 'SU',
        detail: usedDefault
          ? `Choice「${node.name}」條件皆不成立 → 走 Default 分支前往 ${matchedEdge.target}。`
          : `Choice「${node.name}」條件 (${matchedEdge.expression}) 成立 → 前往 ${matchedEdge.target}。`,
        detailEn: usedDefault
          ? `Choice "${node.name}" fell through to Default -> ${matchedEdge.target}.`
          : `Choice "${node.name}" matched (${matchedEdge.expression}) -> ${matchedEdge.target}.`,
        edgeId: matchedEdge.id,
        contextSnapshot: { ...context },
      });
      currentId = matchedEdge.target;
      continue;
    }

    if (node.type === 'ScriptTask') {
      const override = overrides[node.id];
      let scriptResult: unknown = true;
      if (override?.outcome === 'FA') {
        scriptResult = false;
      } else if (node.scriptContent) {
        // Lightweight safe evaluation of simple comparisons like "totalAmount <= 50000"
        const cmpMatch = node.scriptContent.match(
          /([a-zA-Z0-9_]+)\s*(<=|>=|==|!=|<|>)\s*(\d+(?:\.\d+)?)/
        );
        if (cmpMatch) {
          scriptResult = evaluateChoiceExpression(
            `[${cmpMatch[1]}] ${cmpMatch[2]} ${cmpMatch[3]}`,
            context
          );
        }
      }
      applyOutputMapping(node, scriptResult, context);
      const nextEdge = outgoing.find((e) => e.type === 'Transition');
      if (nextEdge) visitedEdgeIds.push(nextEdge.id);

      steps.push({
        stepNumber: steps.length + 1,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        phase: 'forward',
        status: 'SU',
        detail: `執行 ${node.scriptType || 'groovy'} 腳本「${node.name}」，回傳結果：${String(scriptResult)}。`,
        detailEn: `Executed ${node.scriptType || 'groovy'} script "${node.name}" -> result: ${String(scriptResult)}.`,
        edgeId: nextEdge?.id,
        contextSnapshot: { ...context },
      });
      currentId = nextEdge?.target;
      continue;
    }

    // ServiceTask or SubStateMachine
    const override = overrides[node.id] ?? { outcome: 'SU' };
    const compEdge = outgoing.find((e) => e.type === 'Compensation');
    const compNode = compEdge ? nodeMap.get(compEdge.target) : undefined;

    // If this is a SubStateMachine with a registered graph and no forced FA/EXCEPTION override,
    // recursively execute the sub-machine and bubble its trace steps & outcome back!
    const subMachineTargetName =
      node.type === 'SubStateMachine' ? node.stateMachineName?.trim() : undefined;
    const subMachineGraph =
      subMachineTargetName && options?.subMachineGraphs
        ? options.subMachineGraphs[subMachineTargetName]
        : undefined;

    if (
      node.type === 'SubStateMachine' &&
      subMachineGraph &&
      override.outcome === 'SU' &&
      depth < maxDepth &&
      !activeChain.has(subMachineGraph.meta.name)
    ) {
      steps.push({
        stepNumber: steps.length + 1,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        phase: 'forward',
        status: 'SU',
        detail: `進入子狀態機「${subMachineGraph.meta.name}」執行巢狀 Saga 流程。`,
        detailEn: `Entering nested SubStateMachine "${subMachineGraph.meta.name}".`,
        depth,
        contextSnapshot: { ...context },
      });

      const nextChain = new Set(activeChain);
      nextChain.add(subMachineGraph.meta.name);
      const subResult = runSagaSimulationInternal(
        subMachineGraph,
        { ...context },
        {},
        options,
        depth + 1,
        nextChain
      );

      for (const subStep of subResult.steps) {
        steps.push({
          ...subStep,
          stepNumber: steps.length + 1,
          nodeId: node.id,
          subMachineName: subStep.subMachineName ?? subMachineGraph.meta.name,
          depth: subStep.depth ?? depth + 1,
        });
      }

      const subSucceeded = subResult.finalStatus === 'SU';
      applyOutputMapping(node, subSucceeded, context);

      if (subSucceeded) {
        if (compEdge && compNode) {
          compensationStack.push({
            sourceNode: node,
            compNode,
            edgeId: compEdge.id,
          });
        }
        const nextEdge = outgoing.find((e) => e.type === 'Transition');
        if (nextEdge) visitedEdgeIds.push(nextEdge.id);
        steps.push({
          stepNumber: steps.length + 1,
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          phase: 'forward',
          status: 'SU',
          detail: `子狀態機「${subMachineGraph.meta.name}」執行成功 (SU)${compNode ? `，已註冊補償任務 ${compNode.name}` : ''}。`,
          detailEn: `SubStateMachine "${subMachineGraph.meta.name}" committed (SU)${compNode ? ` (registered compensation ${compNode.name})` : ''}.`,
          edgeId: nextEdge?.id,
          depth,
          contextSnapshot: { ...context },
        });
        currentId = nextEdge?.target;
        continue;
      }

      // Sub-machine failed or compensated -> check parent Catch boundary, else continue with FA output
      const catchEdges = outgoing.filter((e) => e.type === 'Catch');
      const matchedCatch = catchEdges[0];
      if (matchedCatch) {
        visitedEdgeIds.push(matchedCatch.id);
        steps.push({
          stepNumber: steps.length + 1,
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          phase: 'forward',
          status: 'UN',
          detail: `子狀態機「${subMachineGraph.meta.name}」以 ${subResult.finalStatus} 結束，觸發父層 Catch 並路由至 ${matchedCatch.target}。`,
          detailEn: `SubStateMachine "${subMachineGraph.meta.name}" ended with ${subResult.finalStatus}; routed via parent Catch -> ${matchedCatch.target}.`,
          edgeId: matchedCatch.id,
          depth,
          contextSnapshot: { ...context },
        });
        currentId = matchedCatch.target;
        continue;
      }

      const nextEdge = outgoing.find((e) => e.type === 'Transition');
      if (nextEdge) visitedEdgeIds.push(nextEdge.id);
      steps.push({
        stepNumber: steps.length + 1,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        phase: 'forward',
        status: 'FA',
        detail: `子狀態機「${subMachineGraph.meta.name}」回傳 ${subResult.finalStatus} (false)。`,
        detailEn: `SubStateMachine "${subMachineGraph.meta.name}" returned ${subResult.finalStatus} (false).`,
        edgeId: nextEdge?.id,
        depth,
        contextSnapshot: { ...context },
      });
      currentId = nextEdge?.target;
      continue;
    }

    if (override.outcome === 'EXCEPTION') {
      const exName = override.exceptionClass || 'java.lang.RuntimeException';
      const catchEdges = outgoing.filter((e) => e.type === 'Catch');
      const matchedCatch =
        catchEdges.find((e) =>
          (e.exceptions || []).some(
            (ex) =>
              ex === exName ||
              ex === 'java.lang.Throwable' ||
              ex === 'java.lang.Exception'
          )
        ) ?? catchEdges[0];

      if (matchedCatch) {
        visitedEdgeIds.push(matchedCatch.id);
        steps.push({
          stepNumber: steps.length + 1,
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          phase: 'forward',
          status: 'UN',
          detail: `任務「${node.name}」拋出例外 ${exName}，由 Catch 捕獲並路由至 ${matchedCatch.target}。`,
          detailEn: `Task "${node.name}" threw ${exName}; caught by Catch boundary -> routing to ${matchedCatch.target}.`,
          edgeId: matchedCatch.id,
          contextSnapshot: { ...context },
        });
        currentId = matchedCatch.target;
        continue;
      }

      steps.push({
        stepNumber: steps.length + 1,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        phase: 'forward',
        status: 'FA',
        detail: `任務「${node.name}」拋出未捕獲例外 ${exName}，狀態機異常中止。`,
        detailEn: `Task "${node.name}" threw uncaught exception ${exName}. State machine aborted.`,
        contextSnapshot: { ...context },
      });
      return {
        finalStatus: 'FA',
        steps,
        finalContext: context,
        compensatedStates,
        visitedNodeIds,
        visitedEdgeIds,
        error: `Uncaught ${exName} in ${node.name}`,
      };
    }

    const isSuccess = override.outcome === 'SU';
    applyOutputMapping(node, isSuccess, context);
    if (override.outputPatch) {
      Object.assign(context, override.outputPatch);
    }

    // Register compensation on forward execution success
    if (isSuccess && compEdge && compNode) {
      compensationStack.push({
        sourceNode: node,
        compNode,
        edgeId: compEdge.id,
      });
    }

    const nextEdge = outgoing.find((e) => e.type === 'Transition');
    if (nextEdge) visitedEdgeIds.push(nextEdge.id);

    const svcDesc =
      node.type === 'SubStateMachine'
        ? `SubStateMachine(${node.stateMachineName || node.name})`
        : `${node.serviceName || node.name}.${node.serviceMethod || 'execute'}()`;

    steps.push({
      stepNumber: steps.length + 1,
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      phase: 'forward',
      status: isSuccess ? 'SU' : 'FA',
      detail: `呼叫 ${svcDesc} 回傳 ${isSuccess ? 'true (SU)' : 'false (FA)'}${isSuccess && compNode ? `，已註冊補償任務 ${compNode.name}` : ''}。`,
      detailEn: `Invoked ${svcDesc} -> ${isSuccess ? 'true (SU)' : 'false (FA)'}${isSuccess && compNode ? ` (registered compensation ${compNode.name})` : ''}.`,
      edgeId: nextEdge?.id,
      contextSnapshot: { ...context },
    });

    currentId = nextEdge?.target;
  }

  return {
    finalStatus: guard >= maxSteps ? 'UN' : 'SU',
    steps,
    finalContext: context,
    compensatedStates,
    visitedNodeIds,
    visitedEdgeIds,
    error: guard >= maxSteps ? 'Maximum execution steps exceeded (possible cycle).' : undefined,
  };
}
