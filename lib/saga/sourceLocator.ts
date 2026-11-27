import { SeataEdgeType } from './types';
import { START_NODE_ID } from './serializer';

export interface SourceRange {
  startLine: number; // 1-indexed inclusive
  endLine: number; // 1-indexed inclusive
  label: string;
}

export type SourceLocateTarget =
  | { kind: 'node'; nodeId: string; nodeName: string }
  | {
      kind: 'edge';
      edgeId: string;
      source: string;
      target: string;
      edgeType: SeataEdgeType;
      expression?: string;
    };

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countBracesOutsideStrings(line: string): number {
  let delta = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') delta += 1;
      else if (ch === '}') delta -= 1;
    }
  }
  return delta;
}

function findJsonStateBlock(lines: string[], stateName: string): SourceRange | null {
  let statesLineIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*"States"\s*:\s*\{/.test(lines[i])) {
      statesLineIdx = i;
      break;
    }
  }
  if (statesLineIdx === -1) return null;

  const keyRegex = new RegExp(`^\\s*"${escapeRegExp(stateName)}"\\s*:\\s*\\{`);
  let depth = 0;
  for (let i = statesLineIdx; i < lines.length; i += 1) {
    const line = lines[i];
    // depth === 1 means direct child inside "States": { ... }
    if (i > statesLineIdx && depth === 1 && keyRegex.test(line)) {
      let blockDepth = countBracesOutsideStrings(line);
      let endIdx = i;
      for (let j = i + 1; j < lines.length && blockDepth > 0; j += 1) {
        blockDepth += countBracesOutsideStrings(lines[j]);
        endIdx = j;
      }
      return {
        startLine: i + 1,
        endLine: endIdx + 1,
        label: stateName,
      };
    }
    depth += countBracesOutsideStrings(line);
    if (i > statesLineIdx && depth <= 0) break;
  }
  return null;
}

function getIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function findYamlStateBlock(lines: string[], stateName: string): SourceRange | null {
  let statesIdx = -1;
  let statesIndent = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*States\s*:\s*(#.*)?$/.test(lines[i])) {
      statesIdx = i;
      statesIndent = getIndent(lines[i]);
      break;
    }
  }
  if (statesIdx === -1) return null;

  const escaped = escapeRegExp(stateName);
  const keyPattern = new RegExp(
    `^\\s*(?:${escaped}|"${escaped}"|'${escaped}')\\s*:\\s*(#.*)?$`
  );

  let stateStartIdx = -1;
  let stateIndent = -1;

  for (let i = statesIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = getIndent(line);
    if (indent <= statesIndent) break;

    if (stateIndent === -1) {
      stateIndent = indent;
    }
    if (indent === stateIndent && keyPattern.test(line)) {
      stateStartIdx = i;
      break;
    }
  }

  if (stateStartIdx === -1) return null;

  let endIdx = stateStartIdx;
  for (let j = stateStartIdx + 1; j < lines.length; j += 1) {
    const line = lines[j];
    const trimmed = line.trim();
    if (!trimmed) continue;
    const indent = getIndent(line);
    if (trimmed.startsWith('#')) {
      // Stop before a sibling-level comment that precedes the next state
      if (indent <= stateIndent) break;
      endIdx = j;
      continue;
    }
    if (indent <= stateIndent) break;
    endIdx = j;
  }

  return {
    startLine: stateStartIdx + 1,
    endLine: endIdx + 1,
    label: stateName,
  };
}

function findLineInRange(
  lines: string[],
  startLine: number,
  endLine: number,
  pattern: RegExp,
  label: string
): SourceRange | null {
  for (let i = startLine - 1; i < endLine && i < lines.length; i += 1) {
    if (pattern.test(lines[i])) {
      return { startLine: i + 1, endLine: i + 1, label };
    }
  }
  return null;
}

export function locateSelectionInSource(
  sourceText: string,
  format: 'json' | 'yaml',
  target: SourceLocateTarget
): SourceRange | null {
  if (!sourceText) return null;
  const lines = sourceText.split('\n');

  const findStartStateLine = (): SourceRange | null => {
    const regex =
      format === 'json'
        ? /^\s*"StartState"\s*:/
        : /^\s*StartState\s*:/;
    return findLineInRange(lines, 1, lines.length, regex, 'StartState');
  };

  if (target.kind === 'node') {
    if (target.nodeId === START_NODE_ID || target.nodeName === 'Start') {
      return findStartStateLine();
    }
    return format === 'json'
      ? findJsonStateBlock(lines, target.nodeName)
      : findYamlStateBlock(lines, target.nodeName);
  }

  // Edge target
  if (target.source === START_NODE_ID) {
    return findStartStateLine();
  }

  const block =
    format === 'json'
      ? findJsonStateBlock(lines, target.source)
      : findYamlStateBlock(lines, target.source);
  if (!block) return null;

  const targetEsc = escapeRegExp(target.target);
  const edgeLabel = `${target.source} → ${target.target}`;

  if (target.edgeType === 'Compensation') {
    const rx =
      format === 'json'
        ? new RegExp(`"CompensateState"\\s*:\\s*"${targetEsc}"`)
        : new RegExp(`CompensateState\\s*:\\s*['"]?${targetEsc}['"]?`);
    return (
      findLineInRange(lines, block.startLine, block.endLine, rx, edgeLabel) ??
      block
    );
  }

  if (target.edgeType === 'Default') {
    const rx =
      format === 'json'
        ? new RegExp(`"Default"\\s*:\\s*"${targetEsc}"`)
        : new RegExp(`Default\\s*:\\s*['"]?${targetEsc}['"]?`);
    return (
      findLineInRange(lines, block.startLine, block.endLine, rx, edgeLabel) ??
      block
    );
  }

  if (target.edgeType === 'Transition') {
    const rx =
      format === 'json'
        ? new RegExp(`"Next"\\s*:\\s*"${targetEsc}"`)
        : new RegExp(`Next\\s*:\\s*['"]?${targetEsc}['"]?`);
    return (
      findLineInRange(lines, block.startLine, block.endLine, rx, edgeLabel) ??
      block
    );
  }

  if (target.edgeType === 'Choice' || target.edgeType === 'Catch') {
    // Prefer matching the specific Next target line inside Choices / Catch array
    const rx =
      format === 'json'
        ? new RegExp(`"Next"\\s*:\\s*"${targetEsc}"`)
        : new RegExp(`Next\\s*:\\s*['"]?${targetEsc}['"]?`);
    const found = findLineInRange(
      lines,
      block.startLine,
      block.endLine,
      rx,
      edgeLabel
    );
    if (found) {
      // Expand by 1 line above if Expression / Exceptions sits immediately above
      const prevIdx = found.startLine - 2;
      if (
        prevIdx >= block.startLine - 1 &&
        /(Expression|Exceptions)/.test(lines[prevIdx])
      ) {
        return {
          startLine: found.startLine - 1,
          endLine: found.endLine,
          label: edgeLabel,
        };
      }
      return found;
    }
    return block;
  }

  return block;
}
