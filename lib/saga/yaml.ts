import {
  Document,
  Pair,
  YAMLMap,
  YAMLSeq,
  isMap,
  isNode,
  isPair,
  isScalar,
  isSeq,
  parseDocument,
} from 'yaml';
import { SagaGraph, SeataStateMachineJson } from './types';
import {
  parseSeataJsonToGraph,
  serializeGraphToSeataJson,
} from './serializer';

const YAML_STRINGIFY_OPTIONS = {
  indent: 2,
  lineWidth: 100,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getPairKeyString(pair: Pair): string {
  if (isScalar(pair.key)) {
    return String(pair.key.value ?? '');
  }
  return String(pair.key ?? '');
}

function reconcileSeq(
  doc: Document,
  seq: YAMLSeq,
  nextArr: unknown[]
): void {
  // Reconcile overlapping indices in place to preserve item-level comments
  const commonLen = Math.min(seq.items.length, nextArr.length);
  for (let i = 0; i < commonLen; i += 1) {
    const existingItem = seq.items[i];
    const nextVal = nextArr[i];
    if (isPlainObject(nextVal) && isMap(existingItem)) {
      reconcileMap(doc, existingItem, nextVal);
    } else if (Array.isArray(nextVal) && isSeq(existingItem)) {
      reconcileSeq(doc, existingItem, nextVal);
    } else if (
      !isPlainObject(nextVal) &&
      !Array.isArray(nextVal) &&
      isScalar(existingItem)
    ) {
      existingItem.value = nextVal;
    } else {
      const replacement = doc.createNode(nextVal);
      if (isNode(existingItem)) {
        if (existingItem.commentBefore) {
          replacement.commentBefore = existingItem.commentBefore;
        }
        if (existingItem.comment) {
          replacement.comment = existingItem.comment;
        }
      }
      seq.items[i] = replacement;
    }
  }

  if (seq.items.length > nextArr.length) {
    seq.items.splice(nextArr.length);
  } else if (nextArr.length > seq.items.length) {
    for (let i = seq.items.length; i < nextArr.length; i += 1) {
      seq.items.push(doc.createNode(nextArr[i]));
    }
  }
}

function reconcileMap(
  doc: Document,
  map: YAMLMap,
  nextObj: Record<string, unknown>
): void {
  const nextKeys = Object.keys(nextObj);
  const nextKeySet = new Set(nextKeys);

  // Remove deleted keys while preserving remaining pairs and their comments
  map.items = map.items.filter((item) => {
    if (!isPair(item)) return false;
    return nextKeySet.has(getPairKeyString(item));
  });

  const existingByKey = new Map<string, Pair>();
  for (const item of map.items) {
    if (isPair(item)) {
      existingByKey.set(getPairKeyString(item), item);
    }
  }

  for (const key of nextKeys) {
    const nextVal = nextObj[key];
    const existingPair = existingByKey.get(key);

    if (!existingPair) {
      map.add(doc.createPair(key, nextVal));
      continue;
    }

    const existingVal = existingPair.value;

    if (isPlainObject(nextVal)) {
      if (isMap(existingVal)) {
        reconcileMap(doc, existingVal, nextVal);
      } else {
        const replacement = doc.createNode(nextVal);
        if (isNode(existingVal)) {
          if (existingVal.commentBefore) {
            replacement.commentBefore = existingVal.commentBefore;
          }
          if (existingVal.comment) {
            replacement.comment = existingVal.comment;
          }
        }
        existingPair.value = replacement;
      }
    } else if (Array.isArray(nextVal)) {
      if (isSeq(existingVal)) {
        reconcileSeq(doc, existingVal, nextVal);
      } else {
        const replacement = doc.createNode(nextVal);
        if (isNode(existingVal)) {
          if (existingVal.commentBefore) {
            replacement.commentBefore = existingVal.commentBefore;
          }
          if (existingVal.comment) {
            replacement.comment = existingVal.comment;
          }
        }
        existingPair.value = replacement;
      }
    } else if (isScalar(existingVal)) {
      // Mutate scalar value in place so inline `#` comments stay attached
      existingVal.value = nextVal;
    } else {
      const replacement = doc.createNode(nextVal);
      if (isNode(existingVal)) {
        if (existingVal.commentBefore) {
          replacement.commentBefore = existingVal.commentBefore;
        }
        if (existingVal.comment) {
          replacement.comment = existingVal.comment;
        }
      }
      existingPair.value = replacement;
    }
  }
}

export function renameStateInYamlTemplate(
  rawYaml: string | undefined,
  oldName: string,
  newName: string
): string | undefined {
  if (!rawYaml) return rawYaml;
  try {
    const doc = parseDocument(rawYaml);
    if (doc.errors.length > 0 || !isMap(doc.contents)) {
      return rawYaml;
    }
    const statesNode = doc.contents.get('States', true);
    if (isMap(statesNode)) {
      for (const item of statesNode.items) {
        if (isPair(item) && getPairKeyString(item) === oldName) {
          if (isScalar(item.key)) {
            item.key.value = newName;
          } else {
            item.key = doc.createNode(newName);
          }
          break;
        }
      }
    }
    return doc.toString(YAML_STRINGIFY_OPTIONS);
  } catch {
    return rawYaml;
  }
}

export function serializeGraphToSeataYaml(
  graph: SagaGraph,
  options: { includeLayout?: boolean } = { includeLayout: true }
): string {
  const jsonObj = serializeGraphToSeataJson(graph, options);
  const cleaned = JSON.parse(JSON.stringify(jsonObj)) as Record<string, unknown>;

  if (graph.yamlTemplate) {
    try {
      const doc = parseDocument(graph.yamlTemplate);
      if (doc.errors.length === 0 && isMap(doc.contents)) {
        reconcileMap(doc, doc.contents, cleaned);
        return doc.toString(YAML_STRINGIFY_OPTIONS);
      }
    } catch {
      // Fallback to fresh document if template somehow became unparseable
    }
  }

  const freshDoc = new Document(cleaned);
  return freshDoc.toString(YAML_STRINGIFY_OPTIONS);
}

export function parseSeataYamlToObject(rawYaml: string): SeataStateMachineJson {
  const doc = parseDocument(rawYaml);
  if (doc.errors.length > 0) {
    throw new Error(doc.errors[0].message);
  }
  const parsed = doc.toJS() as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      'YAML must represent a Seata StateMachine object containing "States".'
    );
  }
  const obj = parsed as Partial<SeataStateMachineJson>;
  if (!obj.States || typeof obj.States !== 'object' || Array.isArray(obj.States)) {
    throw new Error(
      'Invalid Seata StateMachine YAML: missing required "States" mapping.'
    );
  }
  return obj as SeataStateMachineJson;
}

export function parseSeataYamlToGraph(rawYaml: string): SagaGraph {
  const obj = parseSeataYamlToObject(rawYaml);
  const graph = parseSeataJsonToGraph(obj);
  return {
    ...graph,
    yamlTemplate: rawYaml,
  };
}

export function parseSeataSourceToGraph(
  rawText: string,
  hint?: 'json' | 'yaml'
): { graph: SagaGraph; detectedFormat: 'json' | 'yaml' } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Input content is empty.');
  }

  const looksJson = trimmed.startsWith('{');
  if (hint === 'json' || (!hint && looksJson)) {
    const parsed = JSON.parse(trimmed) as Partial<SeataStateMachineJson>;
    if (!parsed || typeof parsed !== 'object' || !parsed.States) {
      throw new Error(
        'JSON must be a valid Seata StateMachine object containing "States".'
      );
    }
    return {
      graph: parseSeataJsonToGraph(parsed as SeataStateMachineJson),
      detectedFormat: 'json',
    };
  }

  const graph = parseSeataYamlToGraph(rawText);
  return { graph, detectedFormat: 'yaml' };
}

export function formatSeataYaml(rawYaml: string): string {
  // Validate structure while preserving every `#` comment node in the AST
  parseSeataYamlToObject(rawYaml);
  const doc = parseDocument(rawYaml);
  return doc.toString(YAML_STRINGIFY_OPTIONS);
}
