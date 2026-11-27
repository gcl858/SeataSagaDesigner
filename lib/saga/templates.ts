import { SeataStateMachineJson } from './types';

export interface SagaTemplate {
  id: string;
  labelZh: string;
  labelEn: string;
  descriptionZh: string;
  descriptionEn: string;
  defaultInputContext: Record<string, unknown>;
  json: SeataStateMachineJson;
}

export const REDUCE_INVENTORY_AND_BALANCE_JSON: SeataStateMachineJson = {
  Name: 'reduceInventoryAndBalance',
  Comment: 'Reduce inventory then reduce balance in a Saga distributed transaction',
  StartState: 'ReduceInventory',
  Version: '0.0.1',
  Type: 'STATE_LANG',
  Persist: true,
  RetryPersistModeUpdate: false,
  CompensatePersistModeUpdate: false,
  style: {
    bounds: { x: 24, y: 120, width: 48, height: 48 },
  },
  States: {
    ReduceInventory: {
      Type: 'ServiceTask',
      Comment: 'Deduct SKU inventory quantity',
      ServiceName: 'inventoryAction',
      ServiceMethod: 'reduce',
      ServiceType: 'SpringBean',
      ParameterTypes: ['java.lang.String', 'java.lang.Integer'],
      CompensateState: 'CompensateReduceInventory',
      Next: 'ChoiceState',
      Input: ['$.[businessKey]', '$.[count]'],
      Output: {
        reduceInventoryResult: '$.#root',
      },
      Status: {
        '#root == true': 'SU',
        '#root == false': 'FA',
        '$Exception{java.lang.Throwable}': 'UN',
      },
      Retry: [
        {
          Exceptions: ['java.net.SocketTimeoutException'],
          IntervalSeconds: 2,
          MaxAttempts: 3,
          BackoffRate: 1.5,
        },
      ],
      Catch: [
        {
          Exceptions: ['java.lang.Throwable'],
          Next: 'CompensationTrigger',
        },
      ],
      style: {
        bounds: { x: 124, y: 107, width: 196, height: 74 },
      },
    },
    ChoiceState: {
      Type: 'Choice',
      Comment: 'Check if inventory reduction succeeded',
      Choices: [
        {
          Expression: '[reduceInventoryResult] == true',
          Next: 'ReduceBalance',
        },
      ],
      Default: 'Fail',
      style: {
        bounds: { x: 376, y: 100, width: 88, height: 88 },
      },
    },
    ReduceBalance: {
      Type: 'ServiceTask',
      Comment: 'Deduct customer account balance',
      ServiceName: 'balanceAction',
      ServiceMethod: 'reduce',
      ServiceType: 'SpringBean',
      ParameterTypes: ['java.lang.String', 'java.math.BigDecimal'],
      CompensateState: 'CompensateReduceBalance',
      Input: ['$.[businessKey]', '$.[amount]'],
      Output: {
        reduceBalanceResult: '$.#root',
      },
      Status: {
        '#root == true': 'SU',
        '#root == false': 'FA',
        '$Exception{java.lang.Throwable}': 'UN',
      },
      Catch: [
        {
          Exceptions: ['java.lang.Throwable'],
          Next: 'CompensationTrigger',
        },
      ],
      Next: 'Succeed',
      style: {
        bounds: { x: 604, y: 107, width: 196, height: 74 },
      },
    },
    CompensateReduceInventory: {
      Type: 'ServiceTask',
      Comment: 'Restore deducted SKU inventory',
      ServiceName: 'inventoryAction',
      ServiceMethod: 'compensateReduce',
      ServiceType: 'SpringBean',
      IsForCompensation: true,
      Input: ['$.[businessKey]', '$.[count]'],
      style: {
        bounds: { x: 124, y: 294, width: 196, height: 74 },
      },
    },
    CompensateReduceBalance: {
      Type: 'ServiceTask',
      Comment: 'Refund deducted account balance',
      ServiceName: 'balanceAction',
      ServiceMethod: 'compensateReduce',
      ServiceType: 'SpringBean',
      IsForCompensation: true,
      Input: ['$.[businessKey]', '$.[amount]'],
      style: {
        bounds: { x: 604, y: 294, width: 196, height: 74 },
      },
    },
    CompensationTrigger: {
      Type: 'CompensationTrigger',
      Comment: 'Unwind all completed compensable tasks in reverse order',
      Next: 'Fail',
      style: {
        bounds: { x: 472, y: 303, width: 56, height: 56 },
      },
    },
    Succeed: {
      Type: 'Succeed',
      Comment: 'Distributed transaction committed',
      style: {
        bounds: { x: 862, y: 120, width: 48, height: 48 },
      },
    },
    Fail: {
      Type: 'Fail',
      Comment: 'Distributed transaction aborted',
      ErrorCode: 'PURCHASE_FAILED',
      Message: 'Purchase failed and compensation completed',
      style: {
        bounds: { x: 396, y: 438, width: 48, height: 48 },
      },
    },
  },
};

export const ORDER_FULFILLMENT_SUBMACHINE_JSON: SeataStateMachineJson = {
  Name: 'orderFulfillmentSaga',
  Comment: 'End-to-end e-commerce fulfillment with Groovy script risk check and SubStateMachine payment',
  StartState: 'CreateOrder',
  Version: '1.2.0',
  Type: 'STATE_LANG',
  Persist: true,
  RetryPersistModeUpdate: true,
  CompensatePersistModeUpdate: false,
  style: {
    bounds: { x: 56, y: 164, width: 48, height: 48 },
  },
  States: {
    CreateOrder: {
      Type: 'ServiceTask',
      Comment: 'Create pending order record',
      ServiceName: 'orderService',
      ServiceMethod: 'create',
      ServiceType: 'SpringBean',
      CompensateState: 'CancelOrder',
      Input: ['$.[orderId]', '$.[userId]', '$.[totalAmount]'],
      Output: {
        orderCreated: '$.#root',
      },
      Catch: [
        {
          Exceptions: ['java.lang.Exception'],
          Next: 'RollbackAll',
        },
      ],
      Next: 'EvaluateRiskScript',
      style: {
        bounds: { x: 168, y: 151, width: 172, height: 74 },
      },
    },
    CancelOrder: {
      Type: 'ServiceTask',
      Comment: 'Mark order as cancelled',
      ServiceName: 'orderService',
      ServiceMethod: 'cancel',
      ServiceType: 'SpringBean',
      IsForCompensation: true,
      Input: ['$.[orderId]'],
      style: {
        bounds: { x: 168, y: 310, width: 172, height: 74 },
      },
    },
    EvaluateRiskScript: {
      Type: 'ScriptTask',
      Comment: 'Evaluate order amount threshold via Groovy',
      ScriptType: 'groovy',
      ScriptContent: 'riskPassed = totalAmount <= 50000; return riskPassed',
      Input: ['$.[totalAmount]'],
      Output: {
        riskPassed: '$.#root',
      },
      Next: 'RiskGateway',
      style: {
        bounds: { x: 400, y: 151, width: 172, height: 74 },
      },
    },
    RiskGateway: {
      Type: 'Choice',
      Comment: 'Route based on risk evaluation',
      Choices: [
        {
          Expression: '[riskPassed] == true',
          Next: 'PaymentSubMachine',
        },
      ],
      Default: 'RollbackAll',
      style: {
        bounds: { x: 632, y: 144, width: 88, height: 88 },
      },
    },
    PaymentSubMachine: {
      Type: 'SubStateMachine',
      Comment: 'Delegate settlement to payment sub-workflow',
      StateMachineName: 'paymentSettlementSubSaga',
      CompensateState: 'RefundSubPayment',
      Input: ['$.[orderId]', '$.[totalAmount]'],
      Output: {
        paymentResult: '$.#root',
      },
      Catch: [
        {
          Exceptions: ['java.lang.Throwable'],
          Next: 'RollbackAll',
        },
      ],
      Next: 'OrderSucceed',
      style: {
        bounds: { x: 786, y: 149, width: 184, height: 78 },
      },
    },
    RefundSubPayment: {
      Type: 'ServiceTask',
      Comment: 'Issue payment settlement reversal',
      ServiceName: 'paymentService',
      ServiceMethod: 'refund',
      ServiceType: 'SpringBean',
      IsForCompensation: true,
      Input: ['$.[orderId]'],
      style: {
        bounds: { x: 792, y: 310, width: 172, height: 74 },
      },
    },
    RollbackAll: {
      Type: 'CompensationTrigger',
      Comment: 'Trigger Saga compensation stack',
      Next: 'OrderFailed',
      style: {
        bounds: { x: 458, y: 320, width: 56, height: 56 },
      },
    },
    OrderSucceed: {
      Type: 'Succeed',
      Comment: 'Fulfillment complete',
      style: {
        bounds: { x: 1038, y: 164, width: 48, height: 48 },
      },
    },
    OrderFailed: {
      Type: 'Fail',
      Comment: 'Order rejected or failed',
      ErrorCode: 'ORDER_FULFILLMENT_FAILED',
      Message: 'Order could not be fulfilled and compensations ran',
      style: {
        bounds: { x: 462, y: 444, width: 48, height: 48 },
      },
    },
  },
};

export const BLANK_STATE_MACHINE_JSON: SeataStateMachineJson = {
  Name: 'customSagaWorkflow',
  Comment: 'Minimal Seata Saga state machine starter',
  StartState: 'FirstServiceTask',
  Version: '0.0.1',
  Type: 'STATE_LANG',
  Persist: true,
  RetryPersistModeUpdate: false,
  CompensatePersistModeUpdate: false,
  style: {
    bounds: { x: 100, y: 200, width: 48, height: 48 },
  },
  States: {
    FirstServiceTask: {
      Type: 'ServiceTask',
      Comment: 'Initial service call',
      ServiceName: 'demoService',
      ServiceMethod: 'execute',
      ServiceType: 'SpringBean',
      Input: ['$.[businessKey]'],
      Output: {
        result: '$.#root',
      },
      Next: 'Succeed',
      style: {
        bounds: { x: 240, y: 187, width: 172, height: 74 },
      },
    },
    Succeed: {
      Type: 'Succeed',
      Comment: 'Done',
      style: {
        bounds: { x: 520, y: 200, width: 48, height: 48 },
      },
    },
  },
};

export const SAGA_TEMPLATES: SagaTemplate[] = [
  {
    id: 'reduceInventoryAndBalance',
    labelZh: '庫存與餘額扣減 (官方範例)',
    labelEn: 'Reduce Inventory & Balance (Official)',
    descriptionZh: 'Apache Seata 官方標準 Saga 狀態機，含正向服務、Choice 分支、Catch 例外捕獲與補償鏈。',
    descriptionEn: 'Official Apache Seata Saga demo with forward tasks, Choice gateway, Catch handlers, and compensation chain.',
    defaultInputContext: {
      businessKey: 'BIZ-2026-8801',
      count: 2,
      amount: 199.5,
    },
    json: REDUCE_INVENTORY_AND_BALANCE_JSON,
  },
  {
    id: 'orderFulfillmentSaga',
    labelZh: '訂單履約與子狀態機',
    labelEn: 'Order Fulfillment + SubStateMachine',
    descriptionZh: '展示 ScriptTask 風控腳本、Choice 路由、SubStateMachine 支付子狀態機與全域補償觸發。',
    descriptionEn: 'Demonstrates ScriptTask risk evaluation, Choice routing, SubStateMachine settlement, and rollback.',
    defaultInputContext: {
      orderId: 'ORD-90421',
      userId: 'USR-1024',
      totalAmount: 12800,
    },
    json: ORDER_FULFILLMENT_SUBMACHINE_JSON,
  },
  {
    id: 'blank',
    labelZh: '空白起始範本',
    labelEn: 'Minimal Starter',
    descriptionZh: '包含 Start、單一 ServiceTask 與 Succeed 的精簡畫布。',
    descriptionEn: 'Clean starter with Start, a single ServiceTask, and Succeed.',
    defaultInputContext: {
      businessKey: 'BIZ-0001',
    },
    json: BLANK_STATE_MACHINE_JSON,
  },
];
