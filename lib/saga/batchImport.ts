import { parseAllDocuments } from 'yaml';
import { SagaGraph, SeataStateMachineJson } from './types';
import { parseSeataJsonToGraph } from './serializer';
import { SubMachineWorkspaceState } from './subMachines';

export interface ImportedSourceFile {
  filename: string;
  content: string;
}

export interface ImportedMachineEntry {
  graph: SagaGraph;
  filename: string;
  detectedFormat: 'json' | 'yaml';
  references: string[];
  autoLaidOut: boolean;
}

export interface MissingSubMachineRef {
  parentMachine: string;
  stateName: string;
  missingSubMachine: string;
}

export interface DuplicateMachineWarning {
  machineName: string;
  filenames: string[];
}

export interface ImportFileError {
  filename: string;
  error: string;
}

export interface ImportedBundleResult {
  machines: ImportedMachineEntry[];
  rootMachineName: string | null;
  linkedChildNames: string[];
  additionalRootNames: string[];
  parentToChildren: Record<string, string[]>;
  missingReferences: MissingSubMachineRef[];
  duplicateNames: DuplicateMachineWarning[];
  errors: ImportFileError[];
  primaryFormat: 'json' | 'yaml';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSeataMachineObject(value: unknown): value is SeataStateMachineJson {
  if (!isPlainObject(value)) return false;
  return isPlainObject(value.States);
}

function hasAnyExplicitLayoutBounds(raw: SeataStateMachineJson): boolean {
  if (raw.style?.bounds) return true;
  const states = raw.States ?? {};
  return Object.values(states).some((st) => Boolean(st?.style?.bounds));
}

function deriveFallbackMachineName(filename: string, index: number): string {
  const stem = filename
    .replace(/^.*[\\/]/, '')
    .replace(/\.(json|ya?ml)$/i, '')
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .trim();
  if (!stem) return index === 0 ? 'importedStateMachine' : `importedStateMachine_${index + 1}`;
  return index === 0 ? stem : `${stem}_${index + 1}`;
}

function extractSubMachineReferences(graph: SagaGraph): string[] {
  const refs = new Set<string>();
  for (const node of graph.nodes) {
    if (node.type === 'SubStateMachine') {
      const target = (node.stateMachineName ?? '').trim();
      if (target) refs.add(target);
    }
  }
  return Array.from(refs);
}

function splitRawYamlDocuments(rawYaml: string): string[] {
  // Split on standard YAML document separator lines (`---`) while preserving
  // each document's leading/inline `#` comments cleanly.
  const lines = rawYaml.split(/\r?\n/);
  const chunks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (/^\s*---\s*(#.*)?$/.test(line)) {
      if (current.some((l) => l.trim() && !l.trim().startsWith('#'))) {
        chunks.push(current);
        current = [];
      } else {
        // Keep leading comments before the first `---` attached to document 1
        current.push(line);
      }
    } else if (/^\s*\.\.\.\s*(#.*)?$/.test(line)) {
      if (current.some((l) => l.trim() && !l.trim().startsWith('#'))) {
        chunks.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }

  if (current.some((l) => l.trim() && !l.trim().startsWith('#'))) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks.map((c) => c.join('\n')) : [rawYaml];
}

function buildGraphFromParsedObject(
  rawObj: SeataStateMachineJson,
  filename: string,
  docIndex: number,
  yamlTemplate?: string
): { graph: SagaGraph; autoLaidOut: boolean } {
  const normalized: SeataStateMachineJson = {
    ...rawObj,
    Name:
      typeof rawObj.Name === 'string' && rawObj.Name.trim()
        ? rawObj.Name.trim()
        : deriveFallbackMachineName(filename, docIndex),
  };

  const hadExplicitLayout = hasAnyExplicitLayoutBounds(normalized);
  let graph = parseSeataJsonToGraph(normalized);
  const autoLaidOut = !hadExplicitLayout && graph.nodes.length > 1;

  if (yamlTemplate !== undefined) {
    graph = {
      ...graph,
      yamlTemplate,
    };
  }

  return { graph, autoLaidOut };
}

function parseSingleSourceFile(
  file: ImportedSourceFile
): { entries: ImportedMachineEntry[]; error?: string } {
  const trimmed = file.content.trim();
  if (!trimmed) {
    return { entries: [], error: 'File is empty.' };
  }

  const lower = file.filename.toLowerCase();
  const isJsonExt = lower.endsWith('.json');
  const isYamlExt = lower.endsWith('.yaml') || lower.endsWith('.yml');
  const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[');

  if (isJsonExt || (!isYamlExt && looksJson)) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      let rawList: SeataStateMachineJson[] = [];

      if (isSeataMachineObject(parsed)) {
        rawList = [parsed];
      } else if (Array.isArray(parsed)) {
        const valid = parsed.filter(isSeataMachineObject);
        if (valid.length === 0) {
          return {
            entries: [],
            error: 'JSON array does not contain any valid Seata StateMachine object with "States".',
          };
        }
        rawList = valid;
      } else if (
        isPlainObject(parsed) &&
        Array.isArray(parsed.stateMachines)
      ) {
        const valid = parsed.stateMachines.filter(isSeataMachineObject);
        if (valid.length === 0) {
          return {
            entries: [],
            error: '"stateMachines" array contains no valid Seata StateMachine objects.',
          };
        }
        rawList = valid;
      } else {
        return {
          entries: [],
          error: 'JSON must be a valid Seata StateMachine object (or array of machines) containing "States".',
        };
      }

      const entries: ImportedMachineEntry[] = rawList.map((rawObj, idx) => {
        const { graph, autoLaidOut } = buildGraphFromParsedObject(
          rawObj,
          file.filename,
          idx
        );
        return {
          graph,
          filename: file.filename,
          detectedFormat: 'json',
          references: extractSubMachineReferences(graph),
          autoLaidOut,
        };
      });

      return { entries };
    } catch (err) {
      return {
        entries: [],
        error: err instanceof Error ? err.message : 'Invalid JSON syntax.',
      };
    }
  }

  // YAML path (supports both single-document and multi-document `---` YAML)
  try {
    const docs = parseAllDocuments(file.content);
    const nonEmptyDocs = docs.filter((doc) => {
      if (doc.errors.length > 0) return true;
      const js = doc.toJS();
      return js !== null && js !== undefined;
    });

    if (nonEmptyDocs.length === 0) {
      return { entries: [], error: 'YAML contains no state machine definitions.' };
    }

    const rawChunks = splitRawYamlDocuments(file.content);
    const entries: ImportedMachineEntry[] = [];

    for (let i = 0; i < nonEmptyDocs.length; i += 1) {
      const doc = nonEmptyDocs[i];
      if (doc.errors.length > 0) {
        return {
          entries: [],
          error: doc.errors[0].message,
        };
      }
      const js = doc.toJS() as unknown;
      if (!isSeataMachineObject(js)) {
        return {
          entries: [],
          error:
            'Invalid Seata StateMachine YAML: missing required "States" mapping.',
        };
      }

      const templateSlice =
        nonEmptyDocs.length === 1
          ? file.content
          : rawChunks[i] ?? doc.toString();

      const { graph, autoLaidOut } = buildGraphFromParsedObject(
        js,
        file.filename,
        i,
        templateSlice
      );

      entries.push({
        graph,
        filename: file.filename,
        detectedFormat: 'yaml',
        references: extractSubMachineReferences(graph),
        autoLaidOut,
      });
    }

    return { entries };
  } catch (err) {
    return {
      entries: [],
      error: err instanceof Error ? err.message : 'Invalid YAML syntax.',
    };
  }
}

function countReachableDescendants(
  startName: string,
  adjacency: Record<string, string[]>
): number {
  const visited = new Set<string>([startName]);
  const queue: string[] = [...(adjacency[startName] ?? [])];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    for (const next of adjacency[curr] ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return visited.size - 1;
}

/**
 * Parses one or multiple Seata Saga JSON/YAML files (including multi-document
 * YAML `---` and JSON arrays), resolves parent → child `SubStateMachine`
 * references regardless of file selection order, and identifies the top-level
 * root state machine automatically.
 */
export function parseSeataImportBundle(
  files: ImportedSourceFile[],
  existingMachineNames?: ReadonlySet<string>
): ImportedBundleResult {
  const allEntries: ImportedMachineEntry[] = [];
  const errors: ImportFileError[] = [];

  for (const file of files) {
    const parsed = parseSingleSourceFile(file);
    if (parsed.error) {
      errors.push({ filename: file.filename, error: parsed.error });
    } else {
      allEntries.push(...parsed.entries);
    }
  }

  // Deduplicate by machine Name (last-wins, while recording duplicate warnings)
  const filesByName = new Map<string, string[]>();
  const dedupedMap = new Map<string, ImportedMachineEntry>();
  const insertionOrder: string[] = [];

  for (const entry of allEntries) {
    const name = entry.graph.meta.name;
    const seen = filesByName.get(name) ?? [];
    seen.push(entry.filename);
    filesByName.set(name, seen);

    if (!dedupedMap.has(name)) {
      insertionOrder.push(name);
    }
    dedupedMap.set(name, entry);
  }

  const duplicateNames: DuplicateMachineWarning[] = [];
  filesByName.forEach((filenames, machineName) => {
    if (filenames.length > 1) {
      duplicateNames.push({ machineName, filenames });
    }
  });

  const machines = insertionOrder.map((name) => dedupedMap.get(name)!);
  if (machines.length === 0) {
    return {
      machines: [],
      rootMachineName: null,
      linkedChildNames: [],
      additionalRootNames: [],
      parentToChildren: {},
      missingReferences: [],
      duplicateNames,
      errors,
      primaryFormat: 'json',
    };
  }

  const importedNameSet = new Set(machines.map((m) => m.graph.meta.name));
  const inDegree = new Map<string, number>();
  const parentToChildren: Record<string, string[]> = {};
  const missingReferences: MissingSubMachineRef[] = [];

  for (const m of machines) {
    const mName = m.graph.meta.name;
    inDegree.set(mName, 0);
    parentToChildren[mName] = [];
  }

  for (const m of machines) {
    const parentName = m.graph.meta.name;
    for (const node of m.graph.nodes) {
      if (node.type !== 'SubStateMachine') continue;
      const target = (node.stateMachineName ?? '').trim();
      if (!target) continue;

      if (importedNameSet.has(target) && target !== parentName) {
        if (!parentToChildren[parentName].includes(target)) {
          parentToChildren[parentName].push(target);
          inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
        }
      } else if (
        target !== parentName &&
        !(existingMachineNames && existingMachineNames.has(target))
      ) {
        missingReferences.push({
          parentMachine: parentName,
          stateName: node.name,
          missingSubMachine: target,
        });
      }
    }
  }

  // Pick the optimal root machine:
  // 1. Prefer inDegree === 0 (true top-level parent, never referenced as a child)
  // 2. Prefer highest total reachable imported descendants
  // 3. Prefer highest direct child count
  // 4. Preserve original selection order as tie-breaker
  const ranked = [...machines].sort((a, b) => {
    const aName = a.graph.meta.name;
    const bName = b.graph.meta.name;
    const aIn = inDegree.get(aName) ?? 0;
    const bIn = inDegree.get(bName) ?? 0;
    if ((aIn === 0) !== (bIn === 0)) {
      return aIn === 0 ? -1 : 1;
    }
    if (aIn !== bIn) return aIn - bIn;

    const aDesc = countReachableDescendants(aName, parentToChildren);
    const bDesc = countReachableDescendants(bName, parentToChildren);
    if (aDesc !== bDesc) return bDesc - aDesc;

    const aOut = parentToChildren[aName]?.length ?? 0;
    const bOut = parentToChildren[bName]?.length ?? 0;
    if (aOut !== bOut) return bOut - aOut;

    return insertionOrder.indexOf(aName) - insertionOrder.indexOf(bName);
  });

  const rootEntry = ranked[0];
  const rootMachineName = rootEntry.graph.meta.name;

  // Order machines top-down: root first, then reachable children in BFS depth order,
  // then any remaining linked/standalone machines.
  const orderedNames: string[] = [];
  const visitedOrder = new Set<string>();
  const bfsQueue: string[] = [rootMachineName];
  while (bfsQueue.length > 0) {
    const curr = bfsQueue.shift()!;
    if (visitedOrder.has(curr)) continue;
    visitedOrder.add(curr);
    orderedNames.push(curr);
    for (const child of parentToChildren[curr] ?? []) {
      if (!visitedOrder.has(child)) bfsQueue.push(child);
    }
  }
  for (const m of ranked) {
    const name = m.graph.meta.name;
    if (!visitedOrder.has(name)) {
      visitedOrder.add(name);
      orderedNames.push(name);
    }
  }
  const orderedMachines = orderedNames.map((name) => dedupedMap.get(name)!);

  const linkedChildNames = orderedNames.filter(
    (name) => name !== rootMachineName && (inDegree.get(name) ?? 0) > 0
  );

  const additionalRootNames = orderedNames.filter(
    (name) => name !== rootMachineName && (inDegree.get(name) ?? 0) === 0
  );

  return {
    machines: orderedMachines,
    rootMachineName,
    linkedChildNames,
    additionalRootNames,
    parentToChildren,
    missingReferences,
    duplicateNames,
    errors,
    primaryFormat: rootEntry.detectedFormat,
  };
}

/**
 * Applies a parsed multi-file / multi-document import bundle to the workspace
 * registry so all parent and child machines are immediately navigable via
 * double-click drill-down and recursive simulation.
 */
export function applyImportedBundleToWorkspace(
  ws: SubMachineWorkspaceState,
  bundle: ImportedBundleResult
): SubMachineWorkspaceState {
  if (bundle.machines.length === 0 || !bundle.rootMachineName) {
    return ws;
  }

  const nextRegistry: Record<string, SagaGraph> = { ...ws.registry };
  const nextHistory = { ...ws.historyByMachine };

  for (const entry of bundle.machines) {
    const name = entry.graph.meta.name;
    const prev = nextRegistry[name];
    nextRegistry[name] = entry.graph;

    if (prev) {
      const prevHist = nextHistory[name] ?? { past: [], future: [] };
      nextHistory[name] = {
        past: [...prevHist.past.slice(-39), prev],
        future: [],
      };
    }
  }

  return {
    registry: nextRegistry,
    historyByMachine: nextHistory,
    navStack: [{ machineName: bundle.rootMachineName }],
  };
}
