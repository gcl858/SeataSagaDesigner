import { SagaGraph, SeataStateMachineJson } from './types';
import { parseSeataJsonToGraph } from './serializer';

export interface MachineNavFrame {
  machineName: string;
  viaNodeId?: string;
  viaNodeName?: string;
}

export interface MachineHistory {
  past: SagaGraph[];
  future: SagaGraph[];
}

export interface SubMachineWorkspaceState {
  registry: Record<string, SagaGraph>;
  historyByMachine: Record<string, MachineHistory>;
  navStack: MachineNavFrame[];
}

export type OpenSubMachineResult =
  | {
      ok: true;
      workspace: SubMachineWorkspaceState;
      targetName: string;
      created: boolean;
    }
  | {
      ok: false;
      reason: 'not_found' | 'not_sub_machine' | 'cycle';
      targetName?: string;
      workspace: SubMachineWorkspaceState;
    };

export function createStarterSubMachineGraph(
  machineName: string,
  comment?: string
): SagaGraph {
  const cleanName = machineName.trim() || 'subWorkflowSaga';
  const starterJson: SeataStateMachineJson = {
    Name: cleanName,
    Comment: comment || `Sub-state machine workflow for ${cleanName}`,
    StartState: 'SubServiceTask',
    Version: '0.0.1',
    Type: 'STATE_LANG',
    Persist: true,
    RetryPersistModeUpdate: false,
    CompensatePersistModeUpdate: false,
    style: {
      bounds: { x: 64, y: 152, width: 48, height: 48 },
    },
    States: {
      SubServiceTask: {
        Type: 'ServiceTask',
        Comment: 'Primary sub-workflow action',
        ServiceName: `${cleanName}Service`,
        ServiceMethod: 'execute',
        ServiceType: 'SpringBean',
        CompensateState: 'CompensateSubTask',
        Input: ['$.[businessKey]'],
        Output: {
          subTaskResult: '$.#root',
        },
        Next: 'SubSucceed',
        style: {
          bounds: { x: 184, y: 139, width: 188, height: 74 },
        },
      },
      CompensateSubTask: {
        Type: 'ServiceTask',
        Comment: 'Compensation action for sub-workflow',
        ServiceName: `${cleanName}Service`,
        ServiceMethod: 'compensate',
        ServiceType: 'SpringBean',
        IsForCompensation: true,
        Input: ['$.[businessKey]'],
        style: {
          bounds: { x: 184, y: 300, width: 188, height: 74 },
        },
      },
      SubSucceed: {
        Type: 'Succeed',
        Comment: 'Sub-state machine completed',
        style: {
          bounds: { x: 456, y: 152, width: 48, height: 48 },
        },
      },
    },
  };

  return parseSeataJsonToGraph(starterJson);
}

export function createWorkspaceFromTemplate(
  rootJson: SeataStateMachineJson,
  subMachinesJson: SeataStateMachineJson[] = [],
  extraBuiltins: SeataStateMachineJson[] = []
): SubMachineWorkspaceState {
  const registry: Record<string, SagaGraph> = {};

  for (const extra of extraBuiltins) {
    const g = parseSeataJsonToGraph(extra);
    registry[g.meta.name] = g;
  }
  for (const sub of subMachinesJson) {
    const g = parseSeataJsonToGraph(sub);
    registry[g.meta.name] = g;
  }

  const rootGraph = parseSeataJsonToGraph(rootJson);
  registry[rootGraph.meta.name] = rootGraph;

  return {
    registry,
    historyByMachine: {},
    navStack: [{ machineName: rootGraph.meta.name }],
  };
}

export function getActiveMachineName(ws: SubMachineWorkspaceState): string {
  const top = ws.navStack[ws.navStack.length - 1];
  return top?.machineName ?? Object.keys(ws.registry)[0] ?? '';
}

export function getActiveGraph(ws: SubMachineWorkspaceState): SagaGraph {
  const name = getActiveMachineName(ws);
  return ws.registry[name] ?? Object.values(ws.registry)[0];
}

export function getActiveHistory(ws: SubMachineWorkspaceState): MachineHistory {
  const name = getActiveMachineName(ws);
  return ws.historyByMachine[name] ?? { past: [], future: [] };
}

export function getParentFrame(
  ws: SubMachineWorkspaceState
): { parentMachineName: string; viaNodeId?: string; viaNodeName?: string } | null {
  if (ws.navStack.length <= 1) return null;
  const parent = ws.navStack[ws.navStack.length - 2];
  const current = ws.navStack[ws.navStack.length - 1];
  return {
    parentMachineName: parent.machineName,
    viaNodeId: current.viaNodeId,
    viaNodeName: current.viaNodeName,
  };
}

/**
 * Drill into a SubStateMachine node from the active state machine.
 * - Guards against circular self/ancestor recursion.
 * - Auto-assigns StateMachineName if left blank on the node.
 * - Auto-scaffolds a clean starter sub-state machine if not yet defined in registry.
 */
export function openSubStateMachine(
  ws: SubMachineWorkspaceState,
  nodeId: string
): OpenSubMachineResult {
  const activeName = getActiveMachineName(ws);
  const activeGraph = ws.registry[activeName];
  if (!activeGraph) {
    return { ok: false, reason: 'not_found', workspace: ws };
  }

  const node = activeGraph.nodes.find((n) => n.id === nodeId);
  if (!node) {
    return { ok: false, reason: 'not_found', workspace: ws };
  }
  if (node.type !== 'SubStateMachine') {
    return { ok: false, reason: 'not_sub_machine', workspace: ws };
  }

  let targetName = (node.stateMachineName ?? '').trim();
  let nextRegistry = ws.registry;

  if (!targetName) {
    targetName = `${node.name}SubSaga`;
    nextRegistry = {
      ...nextRegistry,
      [activeName]: {
        ...activeGraph,
        nodes: activeGraph.nodes.map((n) =>
          n.id === node.id ? { ...n, stateMachineName: targetName } : n
        ),
      },
    };
  }

  // Prevent circular recursion into any machine already active on the stack
  if (ws.navStack.some((frame) => frame.machineName === targetName)) {
    return {
      ok: false,
      reason: 'cycle',
      targetName,
      workspace: ws,
    };
  }

  let created = false;
  if (!nextRegistry[targetName]) {
    const scaffold = createStarterSubMachineGraph(targetName, node.comment);
    nextRegistry = {
      ...nextRegistry,
      [targetName]: scaffold,
    };
    created = true;
  }

  return {
    ok: true,
    targetName,
    created,
    workspace: {
      ...ws,
      registry: nextRegistry,
      navStack: [
        ...ws.navStack,
        {
          machineName: targetName,
          viaNodeId: node.id,
          viaNodeName: node.name,
        },
      ],
    },
  };
}

/**
 * Navigate back to a specific ancestor index in navStack (e.g. navStack.length - 2 for parent, 0 for root).
 * Returns the calling SubStateMachine node id on the target frame so the UI can restore selection cleanly.
 */
export function navigateToStackIndex(
  ws: SubMachineWorkspaceState,
  targetIndex: number
): { workspace: SubMachineWorkspaceState; restoredNodeId: string | null } {
  if (targetIndex < 0 || targetIndex >= ws.navStack.length - 1) {
    return { workspace: ws, restoredNodeId: null };
  }

  const poppedChild = ws.navStack[targetIndex + 1];
  const nextStack = ws.navStack.slice(0, targetIndex + 1);
  return {
    workspace: {
      ...ws,
      navStack: nextStack,
    },
    restoredNodeId: poppedChild?.viaNodeId ?? null,
  };
}

function applyRenamedMachineReferences(
  ws: SubMachineWorkspaceState,
  oldName: string,
  nextGraph: SagaGraph
): {
  registry: Record<string, SagaGraph>;
  historyByMachine: Record<string, MachineHistory>;
  navStack: MachineNavFrame[];
} {
  const newName = nextGraph.meta.name.trim() || oldName;
  const registry: Record<string, SagaGraph> = { ...ws.registry };
  const historyByMachine: Record<string, MachineHistory> = {
    ...ws.historyByMachine,
  };
  let navStack = ws.navStack;

  if (newName !== oldName && !registry[newName]) {
    delete registry[oldName];
    registry[newName] = nextGraph;

    if (historyByMachine[oldName]) {
      historyByMachine[newName] = historyByMachine[oldName];
      delete historyByMachine[oldName];
    }

    navStack = ws.navStack.map((frame) =>
      frame.machineName === oldName
        ? { ...frame, machineName: newName }
        : frame
    );

    // Keep parent SubStateMachine node reference in sync when child machine is renamed
    if (ws.navStack.length > 1) {
      const currentFrame = ws.navStack[ws.navStack.length - 1];
      const parentFrame = ws.navStack[ws.navStack.length - 2];
      const parentGraph = registry[parentFrame.machineName];
      if (parentGraph && currentFrame.viaNodeId) {
        registry[parentFrame.machineName] = {
          ...parentGraph,
          nodes: parentGraph.nodes.map((n) =>
            n.id === currentFrame.viaNodeId && n.type === 'SubStateMachine'
              ? { ...n, stateMachineName: newName }
              : n
          ),
        };
      }
    }
  } else {
    registry[oldName] = nextGraph;
  }

  return { registry, historyByMachine, navStack };
}

export function commitActiveGraph(
  ws: SubMachineWorkspaceState,
  updater: (prev: SagaGraph) => SagaGraph
): SubMachineWorkspaceState {
  const activeName = getActiveMachineName(ws);
  const prev = ws.registry[activeName];
  if (!prev) return ws;

  const next = updater(prev);
  if (next === prev) return ws;

  const prevHistory = ws.historyByMachine[activeName] ?? {
    past: [],
    future: [],
  };
  const updatedHistory: MachineHistory = {
    past: [...prevHistory.past.slice(-39), prev],
    future: [],
  };

  const withHistory: SubMachineWorkspaceState = {
    ...ws,
    historyByMachine: {
      ...ws.historyByMachine,
      [activeName]: updatedHistory,
    },
  };

  const synced = applyRenamedMachineReferences(withHistory, activeName, next);
  return {
    registry: synced.registry,
    historyByMachine: synced.historyByMachine,
    navStack: synced.navStack,
  };
}

export function updateActiveGraphTransient(
  ws: SubMachineWorkspaceState,
  updater: (prev: SagaGraph) => SagaGraph
): SubMachineWorkspaceState {
  const activeName = getActiveMachineName(ws);
  const prev = ws.registry[activeName];
  if (!prev) return ws;
  const next = updater(prev);
  if (next === prev) return ws;
  return {
    ...ws,
    registry: {
      ...ws.registry,
      [activeName]: next,
    },
  };
}

export function undoActiveMachine(
  ws: SubMachineWorkspaceState
): SubMachineWorkspaceState {
  const activeName = getActiveMachineName(ws);
  const current = ws.registry[activeName];
  const history = ws.historyByMachine[activeName];
  if (!current || !history || history.past.length === 0) return ws;

  const previous = history.past[history.past.length - 1];
  const nextHistory: MachineHistory = {
    past: history.past.slice(0, -1),
    future: [current, ...history.future.slice(0, 39)],
  };

  return {
    ...ws,
    registry: {
      ...ws.registry,
      [activeName]: previous,
    },
    historyByMachine: {
      ...ws.historyByMachine,
      [activeName]: nextHistory,
    },
  };
}

export function redoActiveMachine(
  ws: SubMachineWorkspaceState
): SubMachineWorkspaceState {
  const activeName = getActiveMachineName(ws);
  const current = ws.registry[activeName];
  const history = ws.historyByMachine[activeName];
  if (!current || !history || history.future.length === 0) return ws;

  const next = history.future[0];
  const nextHistory: MachineHistory = {
    past: [...history.past.slice(-39), current],
    future: history.future.slice(1),
  };

  return {
    ...ws,
    registry: {
      ...ws.registry,
      [activeName]: next,
    },
    historyByMachine: {
      ...ws.historyByMachine,
      [activeName]: nextHistory,
    },
  };
}
