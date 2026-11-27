export type SeataStateType =
  | 'StartState'
  | 'ServiceTask'
  | 'ScriptTask'
  | 'Choice'
  | 'SubStateMachine'
  | 'CompensationTrigger'
  | 'Succeed'
  | 'Fail';

export type SeataEdgeType =
  | 'Transition'
  | 'Choice'
  | 'Default'
  | 'Catch'
  | 'Compensation';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface RetryConfig {
  Exceptions: string[];
  IntervalSeconds: number;
  MaxAttempts: number;
  BackoffRate: number;
}

export interface CatchConfig {
  Exceptions: string[];
  Next: string;
}

export interface ChoiceRule {
  Expression: string;
  Next: string;
}

export interface LoopConfig {
  Parallel?: number;
  Collection?: string;
  ElementVariableName?: string;
  ElementIndexName?: string;
  CompletionCondition?: string;
}

export interface SeataStateStyle {
  bounds?: Bounds;
}

export interface SeataEdgeStyle {
  waypoints?: Point[];
}

export interface SeataStateDefinition {
  Type: Exclude<SeataStateType, 'StartState'>;
  Comment?: string;
  ServiceName?: string;
  ServiceMethod?: string;
  ServiceType?: string;
  ParameterTypes?: string[];
  IsAsync?: boolean;
  IsPersist?: boolean;
  IsForCompensation?: boolean;
  IsForUpdate?: boolean;
  CompensateState?: string;
  Input?: unknown[];
  Output?: Record<string, unknown>;
  Status?: Record<string, 'SU' | 'FA' | 'UN'>;
  Retry?: RetryConfig[];
  Catch?: CatchConfig[];
  Loop?: LoopConfig;
  ScriptType?: string;
  ScriptContent?: string;
  Choices?: ChoiceRule[];
  Default?: string;
  StateMachineName?: string;
  ErrorCode?: string;
  Message?: string;
  Next?: string;
  style?: SeataStateStyle;
  edge?: Record<string, { style?: SeataEdgeStyle }>;
}

export interface SeataStateMachineJson {
  Name: string;
  Comment?: string;
  StartState: string;
  Version: string;
  Type?: string;
  Persist?: boolean;
  RetryPersistModeUpdate?: boolean;
  CompensatePersistModeUpdate?: boolean;
  style?: SeataStateStyle;
  edge?: Record<string, { style?: SeataEdgeStyle }>;
  States: Record<string, SeataStateDefinition>;
}

export interface SagaNode {
  id: string;
  name: string;
  type: SeataStateType;
  x: number;
  y: number;
  width: number;
  height: number;
  comment?: string;
  // ServiceTask / SubStateMachine
  serviceType?: string;
  serviceName?: string;
  serviceMethod?: string;
  parameterTypes?: string[];
  isAsync?: boolean;
  isPersist?: boolean;
  isForCompensation?: boolean;
  isForUpdate?: boolean;
  inputJson?: string;
  outputJson?: string;
  statusMap?: Array<{ key: string; value: 'SU' | 'FA' | 'UN' }>;
  retry?: RetryConfig[];
  loop?: LoopConfig;
  // ScriptTask
  scriptType?: string;
  scriptContent?: string;
  // SubStateMachine
  stateMachineName?: string;
  // Fail
  errorCode?: string;
  message?: string;
}

export interface SagaEdge {
  id: string;
  source: string;
  target: string;
  type: SeataEdgeType;
  expression?: string;
  exceptions?: string[];
  isDefault?: boolean;
}

export interface SagaMachineMeta {
  name: string;
  comment: string;
  version: string;
  persist: boolean;
  retryPersistModeUpdate: boolean;
  compensatePersistModeUpdate: boolean;
}

export interface SagaGraph {
  meta: SagaMachineMeta;
  nodes: SagaNode[];
  edges: SagaEdge[];
  yamlTemplate?: string;
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  code: string;
  message: string;
  messageEn: string;
  nodeId?: string;
  edgeId?: string;
}

export type MockOutcome = 'SU' | 'FA' | 'EXCEPTION';

export interface NodeSimulationOverride {
  outcome: MockOutcome;
  exceptionClass?: string;
  outputPatch?: Record<string, unknown>;
}

export interface SimulationStep {
  stepNumber: number;
  nodeId: string;
  nodeName: string;
  nodeType: SeataStateType;
  phase: 'forward' | 'compensation' | 'terminal';
  status: 'SU' | 'FA' | 'UN' | 'COMPENSATED' | 'SKIPPED';
  detail: string;
  detailEn: string;
  edgeId?: string;
  subMachineName?: string;
  depth?: number;
  contextSnapshot: Record<string, unknown>;
}

export interface SimulationResult {
  finalStatus: 'SU' | 'FA' | 'COMPENSATED' | 'UN';
  steps: SimulationStep[];
  finalContext: Record<string, unknown>;
  compensatedStates: string[];
  visitedNodeIds: string[];
  visitedEdgeIds: string[];
  error?: string;
}

export const NODE_DIMENSIONS: Record<SeataStateType, { width: number; height: number }> = {
  StartState: { width: 48, height: 48 },
  ServiceTask: { width: 172, height: 74 },
  ScriptTask: { width: 172, height: 74 },
  SubStateMachine: { width: 184, height: 78 },
  Choice: { width: 88, height: 88 },
  CompensationTrigger: { width: 56, height: 56 },
  Succeed: { width: 48, height: 48 },
  Fail: { width: 48, height: 48 },
};
