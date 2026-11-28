'use client';

import React from 'react';
import { ArchitectureDiagramId } from '@/lib/docs/docsCatalog';
import { Locale } from '@/lib/saga/i18n';

interface ArchitectureDiagramProps {
  id: ArchitectureDiagramId;
  locale: Locale;
}

export default function ArchitectureDiagram({
  id,
  locale,
}: ArchitectureDiagramProps) {
  const isZh = locale === 'zh-TW';

  if (id === 'layout-routing-pipeline') {
    return (
      <svg
        viewBox="0 0 840 240"
        className="w-full h-auto block text-slate-800 dark:text-slate-100"
        role="img"
        aria-label={
          isZh
            ? '多層語意自動排版與無遮擋通道繞道管線架構圖'
            : 'Saga-aware multi-band auto-layout and obstacle-free corridor routing pipeline'
        }
      >
        <defs>
          <marker
            id="lay-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" className="fill-blue-600 dark:fill-blue-400" />
          </marker>
        </defs>

        {/* Stage 1 */}
        <rect x="14" y="34" width="182" height="172" rx="10" className="fill-white dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-700" strokeWidth="1.5" />
        <text x="105" y="62" textAnchor="middle" className="fill-blue-700 dark:fill-blue-400 text-[11px] font-mono font-semibold">
          STAGE 1 · DAG
        </text>
        <text x="105" y="84" textAnchor="middle" className="fill-slate-900 dark:fill-slate-100 text-[13px] font-semibold">
          {isZh ? '語意角色與泳道分類' : 'Semantic Swimlanes'}
        </text>
        <text x="28" y="114" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
          {isZh ? '• 上層 -1：逾時 / 對帳 / 診斷' : '• Band -1: Timeout / Query'}
        </text>
        <text x="28" y="136" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
          {isZh ? '• 主幹  0：正向主流程置中' : '• Band  0: 0px Happy Spine'}
        </text>
        <text x="28" y="158" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
          {isZh ? '• 下層 +1：配對補償與拒單' : '• Band +1: Compensate / Reject'}
        </text>
        <text x="28" y="180" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
          {isZh ? '• 底層 +2/+3：回滾鏈與告警' : '• Band +2/+3: Rollback & Alert'}
        </text>

        <line x1="196" y1="120" x2="220" y2="120" className="stroke-blue-600 dark:stroke-blue-400" strokeWidth="1.75" markerEnd="url(#lay-arrow)" />

        {/* Stage 2 */}
        <rect x="226" y="34" width="182" height="172" rx="10" className="fill-white dark:fill-slate-900 stroke-blue-500 dark:stroke-blue-400" strokeWidth="1.5" />
        <text x="317" y="62" textAnchor="middle" className="fill-blue-700 dark:fill-blue-400 text-[11px] font-mono font-semibold">
          STAGE 2 · LAYER
        </text>
        <text x="317" y="84" textAnchor="middle" className="fill-slate-900 dark:fill-slate-100 text-[13px] font-semibold">
          {isZh ? '最長路徑分欄與間距' : 'Longest-Path Columns'}
        </text>
        <text x="240" y="114" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
          {isZh ? '• Kahn DAG 嚴格順向展開' : '• Strict DAG Left-to-Right'}
        </text>
        <text x="240" y="136" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
          {isZh ? '• Succeed 恆定置於最末端' : '• Succeed Strictly Rightmost'}
        </text>
        <text x="240" y="158" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
          {isZh ? '• 補償任務垂直對齊原任務' : '• Plumb-Aligned Compensate'}
        </text>
        <text x="240" y="180" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
          {isZh ? '• 依 SpEL 標籤動態調距' : '• SpEL Label-Aware Gaps'}
        </text>

        <line x1="408" y1="120" x2="432" y2="120" className="stroke-blue-600 dark:stroke-blue-400" strokeWidth="1.75" markerEnd="url(#lay-arrow)" />

        {/* Stage 3 */}
        <rect x="438" y="34" width="182" height="172" rx="10" className="fill-white dark:fill-slate-900 stroke-amber-500 dark:stroke-amber-400" strokeWidth="1.5" />
        <text x="529" y="62" textAnchor="middle" className="fill-amber-700 dark:fill-amber-400 text-[11px] font-mono font-semibold">
          STAGE 3 · ROUTE
        </text>
        <text x="529" y="84" textAnchor="middle" className="fill-slate-900 dark:fill-slate-100 text-[13px] font-semibold">
          {isZh ? '360° 錨點與通道繞道' : '360° Catch & Corridors'}
        </text>
        <text x="452" y="114" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
          {isZh ? '• Catch 四邊動態追蹤目標' : '• 4-Border Auto Catch Tracking'}
        </text>
        <text x="452" y="136" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
          {isZh ? '• 可拖曳釘選 sourceAnchor' : '• Draggable Pinned Anchor'}
        </text>
        <text x="452" y="158" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
          {isZh ? '• 同起終點平行弧線分離' : '• Parallel Transition/Catch'}
        </text>
        <text x="452" y="180" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
          {isZh ? '• 長距跨欄圓角通道匯流排' : '• Rounded Corridor Bus (0 Hits)'}
        </text>

        <line x1="620" y1="120" x2="644" y2="120" className="stroke-blue-600 dark:stroke-blue-400" strokeWidth="1.75" markerEnd="url(#lay-arrow)" />

        {/* Stage 4 */}
        <rect x="650" y="34" width="176" height="172" rx="10" className="fill-emerald-50/70 dark:fill-emerald-950/30 stroke-emerald-600 dark:stroke-emerald-500" strokeWidth="1.75" />
        <text x="738" y="62" textAnchor="middle" className="fill-emerald-700 dark:fill-emerald-400 text-[11px] font-mono font-semibold">
          STAGE 4 · VERIFY
        </text>
        <text x="738" y="84" textAnchor="middle" className="fill-slate-900 dark:fill-slate-100 text-[13px] font-semibold">
          {isZh ? '零重疊品質保證' : 'Zero-Collision Output'}
        </text>
        <text x="664" y="114" className="fill-slate-700 dark:fill-slate-200 text-[11px]">
          {isZh ? '✓ 0 節點重疊' : '✓ 0 Node Overlaps'}
        </text>
        <text x="664" y="136" className="fill-slate-700 dark:fill-slate-200 text-[11px]">
          {isZh ? '✓ 0 連線穿過無關節點' : '✓ 0 Routed Node Hits'}
        </text>
        <text x="664" y="158" className="fill-slate-700 dark:fill-slate-200 text-[11px]">
          {isZh ? '✓ 0 標籤互相或節點遮擋' : '✓ 0 Label Collisions'}
        </text>
        <text x="664" y="180" className="fill-slate-700 dark:fill-slate-200 text-[11px]">
          {isZh ? '✓ 15%–200% 適應大型畫布' : '✓ 15%–200% Fit View'}
        </text>
      </svg>
    );
  }

  if (id === 'yaml-ast-pipeline') {
    return (
      <svg
        viewBox="0 0 840 240"
        className="w-full h-auto block text-slate-800 dark:text-slate-100"
        role="img"
        aria-label={
          isZh
            ? 'YAML AST 註解保留管線架構圖'
            : 'YAML AST comment-preserving pipeline diagram'
        }
      >
        <defs>
          <marker
            id="doc-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" className="fill-slate-400 dark:fill-slate-500" />
          </marker>
          <marker
            id="doc-arrow-blue"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" className="fill-blue-600 dark:fill-blue-400" />
          </marker>
        </defs>

        {/* Stage 1: Input YAML */}
        <rect
          x="16"
          y="70"
          width="156"
          height="96"
          rx="10"
          className="fill-white dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-700"
          strokeWidth="1.5"
        />
        <text x="94" y="102" textAnchor="middle" className="fill-blue-700 dark:fill-blue-400 text-[11px] font-mono font-semibold">
          .saga.yaml
        </text>
        <text x="94" y="124" textAnchor="middle" className="fill-slate-900 dark:fill-slate-100 text-[13px] font-semibold">
          {isZh ? '原始 YAML 檔案' : 'Source YAML'}
        </text>
        <text x="94" y="146" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 text-[11px] font-mono">
          # Header / Inline / Block
        </text>

        {/* Split arrows */}
        <path
          d="M 172 102 C 204 102 204 54 236 54"
          fill="none"
          className="stroke-blue-600 dark:stroke-blue-400"
          strokeWidth="1.75"
          markerEnd="url(#doc-arrow-blue)"
        />
        <path
          d="M 172 134 C 204 134 204 182 236 182"
          fill="none"
          className="stroke-slate-400 dark:stroke-slate-500"
          strokeWidth="1.75"
          strokeDasharray="5 4"
          markerEnd="url(#doc-arrow)"
        />

        {/* Stage 2A: Visual SagaGraph */}
        <rect
          x="244"
          y="18"
          width="176"
          height="76"
          rx="10"
          className="fill-blue-50/70 dark:fill-blue-950/40 stroke-blue-500 dark:stroke-blue-500/70"
          strokeWidth="1.5"
        />
        <text x="332" y="46" textAnchor="middle" className="fill-blue-700 dark:fill-blue-300 text-[12px] font-semibold">
          {isZh ? '視覺化畫布模型 (SagaGraph)' : 'Visual Graph (SagaGraph)'}
        </text>
        <text x="332" y="68" textAnchor="middle" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
          {isZh ? '拖曳座標 · 修改屬性 · 重命名' : 'Drag · Edit Props · Rename'}
        </text>

        {/* Stage 2B: YAML AST Snapshot */}
        <rect
          x="244"
          y="144"
          width="176"
          height="76"
          rx="10"
          className="fill-slate-50 dark:fill-slate-800/80 stroke-slate-300 dark:stroke-slate-600"
          strokeWidth="1.5"
        />
        <text x="332" y="172" textAnchor="middle" className="fill-slate-900 dark:fill-slate-100 text-[12px] font-semibold">
          {isZh ? 'YAML v2 Document AST' : 'YAML v2 Document AST'}
        </text>
        <text x="332" y="194" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 text-[11px] font-mono">
          yamlTemplate + commentBefore
        </text>

        {/* Converge arrows */}
        <path
          d="M 420 56 C 452 56 452 104 484 104"
          fill="none"
          className="stroke-blue-600 dark:stroke-blue-400"
          strokeWidth="1.75"
          markerEnd="url(#doc-arrow-blue)"
        />
        <path
          d="M 420 182 C 452 182 452 132 484 132"
          fill="none"
          className="stroke-slate-400 dark:stroke-slate-500"
          strokeWidth="1.75"
          strokeDasharray="5 4"
          markerEnd="url(#doc-arrow)"
        />

        {/* Stage 3: AST Reconciler */}
        <rect
          x="492"
          y="70"
          width="156"
          height="96"
          rx="10"
          className="fill-white dark:fill-slate-900 stroke-emerald-600 dark:stroke-emerald-500"
          strokeWidth="1.75"
        />
        <text x="570" y="102" textAnchor="middle" className="fill-emerald-700 dark:fill-emerald-400 text-[11px] font-mono font-semibold">
          AST Reconciler
        </text>
        <text x="570" y="124" textAnchor="middle" className="fill-slate-900 dark:fill-slate-100 text-[13px] font-semibold">
          {isZh ? '就地鍵值與鍵名調和' : 'In-Place AST Merge'}
        </text>
        <text x="570" y="146" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 text-[11px]">
          {isZh ? '僅更新異動節點與屬性' : 'Preserves keys & order'}
        </text>

        {/* Output arrow */}
        <line
          x1="648"
          y1="118"
          x2="682"
          y2="118"
          className="stroke-blue-600 dark:stroke-blue-400"
          strokeWidth="1.75"
          markerEnd="url(#doc-arrow-blue)"
        />

        {/* Stage 4: Output YAML */}
        <rect
          x="690"
          y="70"
          width="134"
          height="96"
          rx="10"
          className="fill-emerald-50/70 dark:fill-emerald-950/40 stroke-emerald-600 dark:stroke-emerald-500/80"
          strokeWidth="1.5"
        />
        <text x="757" y="104" textAnchor="middle" className="fill-emerald-700 dark:fill-emerald-300 text-[12px] font-semibold">
          {isZh ? '無損輸出 YAML' : 'Lossless YAML'}
        </text>
        <text x="757" y="126" textAnchor="middle" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
          {isZh ? '100% 保留 # 註解' : '100% # Comments'}
        </text>
        <text x="757" y="146" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 text-[11px] font-mono">
          Git Diff Friendly
        </text>
      </svg>
    );
  }

  if (id === 'submachine-stack') {
    return (
      <svg
        viewBox="0 0 840 250"
        className="w-full h-auto block text-slate-800 dark:text-slate-100"
        role="img"
        aria-label={
          isZh
            ? '三層 SubStateMachine 呼叫堆疊架構圖'
            : '3-level SubStateMachine call stack diagram'
        }
      >
        <defs>
          <marker
            id="sub-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" className="fill-sky-600 dark:fill-sky-400" />
          </marker>
        </defs>

        {/* Level 1 */}
        <rect
          x="20"
          y="30"
          width="224"
          height="136"
          rx="10"
          className="fill-white dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-700"
          strokeWidth="1.5"
        />
        <text x="36" y="54" className="fill-slate-500 dark:fill-slate-400 text-[11px] font-mono">
          LEVEL 1 · ROOT
        </text>
        <text x="36" y="76" className="fill-slate-900 dark:fill-slate-100 text-[14px] font-semibold font-mono">
          orderFulfillmentSaga
        </text>
        <rect
          x="36"
          y="92"
          width="192"
          height="34"
          rx="6"
          className="fill-sky-50 dark:fill-sky-950/60 stroke-sky-600 dark:stroke-sky-400"
          strokeWidth="1.25"
        />
        <text x="132" y="113" textAnchor="middle" className="fill-sky-800 dark:fill-sky-200 text-[11px] font-mono font-semibold">
          PaymentSubMachine
        </text>
        <text x="36" y="148" className="fill-slate-500 dark:fill-slate-400 text-[11px]">
          {isZh ? '獨立歷史堆疊 #1 · 雙擊進入' : 'Isolated History #1 · Double-click'}
        </text>

        {/* Arrow L1 -> L2 */}
        <line
          x1="244"
          y1="108"
          x2="296"
          y2="108"
          className="stroke-sky-600 dark:stroke-sky-400"
          strokeWidth="2"
          markerEnd="url(#sub-arrow)"
        />
        <text x="270" y="96" textAnchor="middle" className="fill-sky-700 dark:fill-sky-300 text-[10px] font-mono">
          dblclick
        </text>

        {/* Level 2 */}
        <rect
          x="306"
          y="30"
          width="234"
          height="136"
          rx="10"
          className="fill-white dark:fill-slate-900 stroke-sky-500 dark:stroke-sky-500/80"
          strokeWidth="1.75"
        />
        <text x="322" y="54" className="fill-sky-700 dark:fill-sky-400 text-[11px] font-mono">
          LEVEL 2 · SUB-MACHINE
        </text>
        <text x="322" y="76" className="fill-slate-900 dark:fill-slate-100 text-[13px] font-semibold font-mono">
          paymentSettlementSubSaga
        </text>
        <rect
          x="322"
          y="92"
          width="202"
          height="34"
          rx="6"
          className="fill-sky-50 dark:fill-sky-950/60 stroke-sky-600 dark:stroke-sky-400"
          strokeWidth="1.25"
        />
        <text x="423" y="113" textAnchor="middle" className="fill-sky-800 dark:fill-sky-200 text-[11px] font-mono font-semibold">
          FraudSubCheck
        </text>
        <text x="322" y="148" className="fill-slate-500 dark:fill-slate-400 text-[11px]">
          {isZh ? '獨立歷史堆疊 #2 · Alt+← 返回' : 'Isolated History #2 · Alt+Left'}
        </text>

        {/* Arrow L2 -> L3 */}
        <line
          x1="540"
          y1="108"
          x2="592"
          y2="108"
          className="stroke-sky-600 dark:stroke-sky-400"
          strokeWidth="2"
          markerEnd="url(#sub-arrow)"
        />
        <text x="566" y="96" textAnchor="middle" className="fill-sky-700 dark:fill-sky-300 text-[10px] font-mono">
          dblclick
        </text>

        {/* Level 3 */}
        <rect
          x="602"
          y="30"
          width="218"
          height="136"
          rx="10"
          className="fill-white dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-700"
          strokeWidth="1.5"
        />
        <text x="618" y="54" className="fill-slate-500 dark:fill-slate-400 text-[11px] font-mono">
          LEVEL 3 · LEAF MACHINE
        </text>
        <text x="618" y="76" className="fill-slate-900 dark:fill-slate-100 text-[13px] font-semibold font-mono">
          fraudVerificationSubSaga
        </text>
        <text x="618" y="106" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
          {isZh ? '裝置指紋 + 名單查核 + 風控評分' : 'Device + Blacklist + Risk Score'}
        </text>
        <text x="618" y="148" className="fill-slate-500 dark:fill-slate-400 text-[11px]">
          {isZh ? '獨立歷史堆疊 #3 · 遞迴模擬' : 'Isolated History #3 · Recursive Sim'}
        </text>

        {/* Bottom Guard Bar */}
        <rect
          x="20"
          y="188"
          width="800"
          height="42"
          rx="8"
          className="fill-slate-50 dark:fill-slate-800/70 stroke-slate-200 dark:stroke-slate-700"
          strokeWidth="1"
        />
        <text x="420" y="213" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 text-[12px] font-medium">
          {isZh
            ? '安全防護：循環參考自動阻斷（A → B → A） · 缺失子流程自動鷹架建立 · 麵包屑點擊即還原父節點選取狀態'
            : 'Safety Guards: Circular reference blocker (A -> B -> A) · Auto-scaffolding for new sub-machines · Selection restoration on return'}
        </text>
      </svg>
    );
  }

  if (id === 'saga-lifecycle') {
    return (
      <svg
        viewBox="0 0 840 260"
        className="w-full h-auto block text-slate-800 dark:text-slate-100"
        role="img"
        aria-label={
          isZh
            ? 'Seata Saga 正向執行與 LIFO 補償流程圖'
            : 'Seata Saga forward execution and LIFO compensation diagram'
        }
      >
        <defs>
          <marker id="life-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" className="fill-emerald-600 dark:fill-emerald-400" />
          </marker>
          <marker id="life-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" className="fill-amber-600 dark:fill-amber-400" />
          </marker>
          <marker id="life-indigo" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" className="fill-indigo-600 dark:fill-indigo-400" />
          </marker>
        </defs>

        {/* Forward row */}
        <circle cx="48" cy="64" r="20" className="fill-emerald-50 dark:fill-emerald-950/60 stroke-emerald-600 dark:stroke-emerald-400" strokeWidth="2" />
        <text x="48" y="68" textAnchor="middle" className="fill-emerald-700 dark:fill-emerald-300 text-[11px] font-semibold">Start</text>

        <line x1="68" y1="64" x2="112" y2="64" className="stroke-emerald-600 dark:stroke-emerald-400" strokeWidth="1.75" markerEnd="url(#life-green)" />

        <rect x="120" y="34" width="166" height="60" rx="8" className="fill-white dark:fill-slate-900 stroke-emerald-600 dark:stroke-emerald-500" strokeWidth="1.75" />
        <text x="203" y="58" textAnchor="middle" className="fill-slate-900 dark:fill-slate-100 text-[12px] font-semibold font-mono">1. ReduceInventory</text>
        <text x="203" y="78" textAnchor="middle" className="fill-emerald-700 dark:fill-emerald-400 text-[11px]">{isZh ? 'SU 成功 · 推入補償堆疊' : 'SU · Push Compensation'}</text>

        <line x1="286" y1="64" x2="338" y2="64" className="stroke-emerald-600 dark:stroke-emerald-400" strokeWidth="1.75" markerEnd="url(#life-green)" />

        <rect x="346" y="34" width="166" height="60" rx="8" className="fill-amber-50/70 dark:fill-amber-950/40 stroke-amber-600 dark:stroke-amber-400" strokeWidth="1.75" />
        <text x="429" y="58" textAnchor="middle" className="fill-slate-900 dark:fill-slate-100 text-[12px] font-semibold font-mono">2. ReduceBalance</text>
        <text x="429" y="78" textAnchor="middle" className="fill-amber-700 dark:fill-amber-300 text-[11px]">{isZh ? '拋出 RuntimeException' : 'Throws Exception (UN)'}</text>

        <line x1="512" y1="64" x2="578" y2="64" className="stroke-slate-300 dark:stroke-slate-700" strokeWidth="1.5" strokeDasharray="4 4" />
        <circle cx="614" cy="64" r="20" className="fill-slate-50 dark:fill-slate-800 stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.5" />
        <text x="614" y="68" textAnchor="middle" className="fill-slate-400 text-[10px] font-mono">Succeed</text>

        {/* Exception Catch curve to CompensationTrigger */}
        <path
          d="M 429 94 L 429 144"
          fill="none"
          className="stroke-amber-600 dark:stroke-amber-400"
          strokeWidth="2"
          strokeDasharray="4 3"
          markerEnd="url(#life-amber)"
        />
        <text x="492" y="124" className="fill-amber-700 dark:fill-amber-300 text-[11px] font-mono">Catch: Throwable</text>

        {/* CompensationTrigger */}
        <rect x="346" y="152" width="166" height="58" rx="8" className="fill-indigo-50/70 dark:fill-indigo-950/50 stroke-indigo-600 dark:stroke-indigo-400" strokeWidth="1.75" />
        <text x="429" y="176" textAnchor="middle" className="fill-indigo-800 dark:fill-indigo-200 text-[12px] font-semibold font-mono">CompensationTrigger</text>
        <text x="429" y="196" textAnchor="middle" className="fill-indigo-700 dark:fill-indigo-300 text-[11px]">{isZh ? '啟動 LIFO 反向回滾' : 'Trigger LIFO Rollback'}</text>

        {/* LIFO rollback arrow to CompensateReduceInventory */}
        <line x1="346" y1="181" x2="294" y2="181" className="stroke-indigo-600 dark:stroke-indigo-400" strokeWidth="2" strokeDasharray="6 4" markerEnd="url(#life-indigo)" />

        <rect x="120" y="152" width="166" height="58" rx="8" className="fill-white dark:fill-slate-900 stroke-indigo-500 dark:stroke-indigo-400" strokeWidth="1.5" strokeDasharray="5 3" />
        <text x="203" y="176" textAnchor="middle" className="fill-slate-900 dark:fill-slate-100 text-[11px] font-semibold font-mono">CompensateInventory</text>
        <text x="203" y="196" textAnchor="middle" className="fill-indigo-700 dark:fill-indigo-300 text-[11px]">{isZh ? '已成功回補庫存' : 'Inventory Restored'}</text>

        {/* CompensateState vertical dashed link */}
        <line x1="203" y1="94" x2="203" y2="144" className="stroke-indigo-400 dark:stroke-indigo-500" strokeWidth="1.5" strokeDasharray="4 4" markerEnd="url(#life-indigo)" />

        {/* Fail end */}
        <line x1="512" y1="181" x2="584" y2="181" className="stroke-red-500 dark:stroke-red-400" strokeWidth="1.75" />
        <circle cx="614" cy="181" r="22" className="fill-red-50 dark:fill-red-950/50 stroke-red-600 dark:stroke-red-400" strokeWidth="2" />
        <text x="614" y="185" textAnchor="middle" className="fill-red-700 dark:fill-red-300 text-[11px] font-semibold">Fail</text>

        {/* Legend box on right */}
        <rect x="668" y="34" width="154" height="176" rx="10" className="fill-slate-50 dark:fill-slate-800/70 stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
        <text x="684" y="60" className="fill-slate-900 dark:fill-slate-100 text-[12px] font-semibold">{isZh ? '執行結果狀態' : 'Outcome States'}</text>
        <text x="684" y="88" className="fill-emerald-700 dark:fill-emerald-400 text-[11px] font-mono">SU · {isZh ? '成功提交' : 'Success'}</text>
        <text x="684" y="114" className="fill-amber-700 dark:fill-amber-300 text-[11px] font-mono">UN · {isZh ? '異常捕獲' : 'Unknown/Exc'}</text>
        <text x="684" y="140" className="fill-indigo-700 dark:fill-indigo-300 text-[11px] font-mono">COMP · {isZh ? 'LIFO 補償' : 'Compensated'}</text>
        <text x="684" y="166" className="fill-red-700 dark:fill-red-400 text-[11px] font-mono">FA · {isZh ? '終止回滾' : 'Aborted Fail'}</text>
      </svg>
    );
  }

  // vscode-bridge
  return (
    <svg
      viewBox="0 0 840 250"
      className="w-full h-auto block text-slate-800 dark:text-slate-100"
      role="img"
      aria-label={
        isZh
          ? 'VS Code Web 與桌面版雙環境 Webview Bridge 架構圖'
          : 'VS Code Web and Desktop dual-runtime Webview Bridge diagram'
      }
    >
      <defs>
        <marker id="vsc-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" className="fill-blue-600 dark:fill-blue-400" />
        </marker>
        <marker id="vsc-emerald" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" className="fill-emerald-600 dark:fill-emerald-400" />
        </marker>
      </defs>

      {/* Left: VS Code Host */}
      <rect x="16" y="24" width="230" height="202" rx="10" className="fill-white dark:fill-slate-900 stroke-blue-500 dark:stroke-blue-500/80" strokeWidth="1.75" />
      <text x="32" y="50" className="fill-blue-700 dark:fill-blue-400 text-[11px] font-mono font-semibold">
        VS CODE WEB / DESKTOP HOST
      </text>
      <text x="32" y="72" className="fill-slate-900 dark:fill-slate-100 text-[13px] font-semibold">
        dist/web/extension.js
      </text>
      <text x="32" y="96" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
        • CustomTextEditorProvider
      </text>
      <text x="32" y="118" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
        • vscode.workspace.fs (Zero Node)
      </text>
      <text x="32" y="140" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
        • DiagnosticCollection (Problems)
      </text>
      <text x="32" y="162" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
        • revealRange + Flash Decoration
      </text>
      <text x="32" y="196" className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono">
        vscode.dev · github.dev · Desktop
      </text>

      {/* Middle: CSP Bridge */}
      <rect x="306" y="42" width="228" height="166" rx="10" className="fill-slate-50 dark:fill-slate-800/80 stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.5" />
      <text x="420" y="68" textAnchor="middle" className="fill-slate-900 dark:fill-slate-100 text-[12px] font-semibold">
        {isZh ? 'CSP Origin 驗證中繼層' : 'CSP & Origin Relay'}
      </text>
      <text x="420" y="94" textAnchor="middle" className="fill-blue-700 dark:fill-blue-300 text-[10px] font-mono">
        host:loadDocument →
      </text>
      <text x="420" y="114" textAnchor="middle" className="fill-blue-700 dark:fill-blue-300 text-[10px] font-mono">
        host:themeChanged →
      </text>
      <text x="420" y="142" textAnchor="middle" className="fill-emerald-700 dark:fill-emerald-400 text-[10px] font-mono">
        ← designer:updateDocument
      </text>
      <text x="420" y="162" textAnchor="middle" className="fill-emerald-700 dark:fill-emerald-400 text-[10px] font-mono">
        ← designer:revealSource
      </text>
      <text x="420" y="182" textAnchor="middle" className="fill-emerald-700 dark:fill-emerald-400 text-[10px] font-mono">
        ← designer:diagnostics
      </text>

      {/* Arrows Host <-> Relay */}
      <line x1="246" y1="98" x2="298" y2="98" className="stroke-blue-600 dark:stroke-blue-400" strokeWidth="1.75" markerEnd="url(#vsc-blue)" />
      <line x1="306" y1="156" x2="254" y2="156" className="stroke-emerald-600 dark:stroke-emerald-400" strokeWidth="1.75" markerEnd="url(#vsc-emerald)" />

      {/* Arrows Relay <-> Designer */}
      <line x1="534" y1="98" x2="586" y2="98" className="stroke-blue-600 dark:stroke-blue-400" strokeWidth="1.75" markerEnd="url(#vsc-blue)" />
      <line x1="594" y1="156" x2="542" y2="156" className="stroke-emerald-600 dark:stroke-emerald-400" strokeWidth="1.75" markerEnd="url(#vsc-emerald)" />

      {/* Right: Next.js Designer */}
      <rect x="594" y="24" width="230" height="202" rx="10" className="fill-white dark:fill-slate-900 stroke-emerald-600 dark:stroke-emerald-500" strokeWidth="1.75" />
      <text x="610" y="50" className="fill-emerald-700 dark:fill-emerald-400 text-[11px] font-mono font-semibold">
        SEATA SAGA DESIGNER
      </text>
      <text x="610" y="72" className="fill-slate-900 dark:fill-slate-100 text-[13px] font-semibold">
        ?embed=vscode
      </text>
      <text x="610" y="96" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
        • {isZh ? '視覺畫布 + YAML 註解保留' : 'Visual Canvas + YAML AST'}
      </text>
      <text x="610" y="118" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
        • {isZh ? '多層 SubStateMachine 鑽取' : 'Nested SubStateMachine'}
      </text>
      <text x="610" y="140" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
        • {isZh ? '窄窗自動收合左側節點庫' : 'Smart Narrow-Pane Collapse'}
      </text>
      <text x="610" y="162" className="fill-slate-600 dark:fill-slate-300 text-[11px]">
        • {isZh ? '即時拓樸驗證與補償模擬' : 'Live Validator & Simulator'}
      </text>
      <text x="610" y="196" className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono">
        HTTPS / localhost Only
      </text>
    </svg>
  );
}
