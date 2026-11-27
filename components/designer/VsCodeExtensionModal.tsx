'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Blocks,
  Check,
  Code2,
  Copy,
  Download,
  FileCode2,
  Globe,
  Monitor,
  Play,
  Sun,
  Moon,
  X,
} from 'lucide-react';
import { Locale, UI_COPY } from '@/lib/saga/i18n';
import {
  DesignerToHostMessage,
  HostDiagnosticItem,
  isAllowedDesignerUrl,
} from '@/lib/saga/hostBridge';
import {
  buildVsCodeExtensionFiles,
  buildVsCodeExtensionZip,
} from '@/lib/saga/vscodeExtensionGenerator';
import {
  ORDER_FULFILLMENT_SUBMACHINE_JSON,
  PAYMENT_SETTLEMENT_SUBMACHINE_JSON,
} from '@/lib/saga/templates';
import { parseSeataJsonToGraph } from '@/lib/saga/serializer';
import { serializeGraphToSeataYaml } from '@/lib/saga/yaml';

interface VsCodeExtensionModalProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
}

type ModalTab = 'install' | 'files' | 'live-preview';

function buildSampleYaml(json: typeof ORDER_FULFILLMENT_SUBMACHINE_JSON): string {
  return serializeGraphToSeataYaml(parseSeataJsonToGraph(json), {
    includeLayout: true,
  });
}

export default function VsCodeExtensionModal({
  open,
  onClose,
  locale,
}: VsCodeExtensionModalProps) {
  const t = UI_COPY[locale];
  const [activeTab, setActiveTab] = useState<ModalTab>('install');
  const [designerUrl, setDesignerUrl] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  );
  const [defaultFormat, setDefaultFormat] = useState<'yaml' | 'json'>('yaml');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);

  // Live Webview Bridge Sandbox state
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('dark');
  const [docText, setDocText] = useState<string>(() =>
    buildSampleYaml(ORDER_FULFILLMENT_SUBMACHINE_JSON)
  );
  const [subDocText] = useState<string>(() =>
    buildSampleYaml(PAYMENT_SETTLEMENT_SUBMACHINE_JSON)
  );
  const [bridgeReady, setBridgeReady] = useState<boolean>(false);
  const [revealedLines, setRevealedLines] = useState<{
    startLine: number;
    endLine: number;
    label: string;
  } | null>(null);
  const [diagnostics, setDiagnostics] = useState<HostDiagnosticItem[]>([]);
  const [eventLog, setEventLog] = useState<string[]>([]);

  const urlValid = isAllowedDesignerUrl(designerUrl.trim());

  const generatedFiles = useMemo(
    () =>
      buildVsCodeExtensionFiles({
        designerUrl,
        defaultFormat,
      }),
    [designerUrl, defaultFormat]
  );

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Listen to messages from the embedded live preview iframe
  useEffect(() => {
    if (!open || activeTab !== 'live-preview') return;

    const pushLog = (line: string) => {
      setEventLog((prev) => [line, ...prev].slice(0, 8));
    };

    const onMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
        return;
      }
      const msg = event.data as DesignerToHostMessage | undefined;
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

      if (msg.type === 'designer:ready') {
        setBridgeReady(true);
        pushLog('← designer:ready (sending orderFulfillment.saga.yaml + workspace sub-machine)');
        iframeRef.current.contentWindow?.postMessage(
          {
            type: 'host:loadDocument',
            uri: 'vscode-vfs://github/seata/orderFulfillment.saga.yaml',
            fileName: 'orderFulfillment.saga.yaml',
            format: 'yaml',
            content: docText,
            theme: previewTheme,
            locale,
            subMachines: [
              {
                name: 'paymentSettlementSubSaga',
                format: 'yaml',
                content: subDocText,
                uri: 'vscode-vfs://github/seata/paymentSettlementSubSaga.saga.yaml',
              },
            ],
          },
          window.location.origin
        );
      } else if (msg.type === 'designer:updateDocument') {
        setDocText(msg.content);
        pushLog(`← designer:updateDocument (${msg.machineName}, ${msg.format.toUpperCase()})`);
      } else if (msg.type === 'designer:revealSource') {
        setRevealedLines({
          startLine: msg.startLine,
          endLine: msg.endLine,
          label: msg.label,
        });
        pushLog(`← designer:revealSource ${msg.label} (L${msg.startLine}–${msg.endLine})`);
      } else if (msg.type === 'designer:diagnostics') {
        setDiagnostics(msg.diagnostics);
        pushLog(`← designer:diagnostics (${msg.diagnostics.length} item(s))`);
      } else if (msg.type === 'designer:exportFile') {
        pushLog(`← designer:exportFile (${msg.fileName} -> VS Code Save Dialog)`);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open, activeTab, docText, subDocText, previewTheme, locale]);

  if (!open) return null;

  const copyText = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1600);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleDownloadZip = () => {
    const zipBytes = buildVsCodeExtensionZip({
      designerUrl,
      defaultFormat,
    });
    const copy = new Uint8Array(zipBytes.byteLength);
    copy.set(zipBytes);
    const blob = new Blob([copy.buffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'seata-saga-vscode-web-extension.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const pushDocEditToIframe = (nextText: string) => {
    setDocText(nextText);
    if (iframeRef.current?.contentWindow && bridgeReady) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'host:loadDocument',
          uri: 'vscode-vfs://github/seata/orderFulfillment.saga.yaml',
          fileName: 'orderFulfillment.saga.yaml',
          format: 'yaml',
          content: nextText,
          theme: previewTheme,
          locale,
          subMachines: [
            {
              name: 'paymentSettlementSubSaga',
              format: 'yaml',
              content: subDocText,
              uri: 'vscode-vfs://github/seata/paymentSettlementSubSaga.saga.yaml',
            },
          ],
        },
        window.location.origin
      );
    }
  };

  const togglePreviewTheme = () => {
    const nextTheme = previewTheme === 'dark' ? 'light' : 'dark';
    setPreviewTheme(nextTheme);
    if (iframeRef.current?.contentWindow && bridgeReady) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'host:themeChanged', theme: nextTheme },
        window.location.origin
      );
    }
  };

  const webTestCmd =
    'npx @vscode/test-web --browserType=chromium --extensionDevelopmentPath=./seata-saga-vscode-web';
  const vscodeDevCmd = 'npx serve --cors ./seata-saga-vscode-web';
  const vsixCmd =
    'cd seata-saga-vscode-web && npx @vscode/vsce package --target web && code --install-extension seata-saga-designer-1.0.0.vsix';

  const currentFile = generatedFiles[selectedFileIndex] ?? generatedFiles[0];
  const currentFileContent =
    typeof currentFile.content === 'string'
      ? currentFile.content
      : new TextDecoder().decode(currentFile.content);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.vscodeModalTitle}
      data-testid="vscode-extension-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl max-h-[88vh] flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Blocks className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {t.vscodeModalTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {locale === 'zh-TW'
                  ? '免 Node.js 依賴通用 Web Extension — 同時相容 vscode.dev 瀏覽器版與桌面版 VS Code'
                  : 'Zero-Node universal Web Extension — runs natively in vscode.dev browser and VS Code Desktop'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 flex items-center gap-6">
          {[
            {
              id: 'install' as const,
              label: locale === 'zh-TW' ? '匯出擴充與安裝指南' : 'Package & Install',
              icon: Download,
            },
            {
              id: 'files' as const,
              label: locale === 'zh-TW' ? '擴充檔案檢視' : 'Extension Files',
              icon: FileCode2,
            },
            {
              id: 'live-preview' as const,
              label:
                locale === 'zh-TW'
                  ? 'VS Code Webview 實機模擬'
                  : 'Live Webview Bridge Test',
              icon: Play,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`vscode-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  active
                    ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeTab === 'install' && (
            <div className="p-5 space-y-5">
              {/* Architecture & Capability Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span>
                      {locale === 'zh-TW'
                        ? '瀏覽器版 VS Code 原生支援'
                        : 'Native Browser VS Code'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {locale === 'zh-TW'
                      ? '採用 browser 入口點與 vscode.workspace.fs，免編譯即可在 vscode.dev、github.dev 與 Codespaces 執行。'
                      : 'Uses the browser entrypoint and vscode.workspace.fs so it runs zero-build in vscode.dev, github.dev, and Codespaces.'}
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    <Code2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>
                      {locale === 'zh-TW'
                        ? '雙向檔案同步與行號閃爍'
                        : 'Two-Way Sync & Code Reveal'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {locale === 'zh-TW'
                      ? '透過 CustomTextEditorProvider 與 WorkspaceEdit 整合原生 Ctrl+S/Ctrl+Z、Problems 診斷面板與並排行號定位。'
                      : 'Integrates native Ctrl+S/Ctrl+Z via WorkspaceEdit, Problems panel diagnostics, and side-by-side line reveal.'}
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    <Monitor className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {locale === 'zh-TW'
                        ? '跨檔案子狀態機自動掃描'
                        : 'Cross-File SubStateMachine Scan'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {locale === 'zh-TW'
                      ? '自動索引工作區內的 *.saga.yaml / *.json，雙擊 SubStateMachine 即可鑽取或直接於同目錄建立子檔案。'
                      : 'Scans workspace *.saga.yaml / *.json files so double-clicking SubStateMachine drills into or scaffolds sibling files.'}
                  </p>
                </div>
              </div>

              {/* Config + Download Box */}
              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/70 bg-blue-50/50 dark:bg-blue-950/25 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label
                      htmlFor="vscode-designer-url"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
                    >
                      {locale === 'zh-TW'
                        ? 'Hosted Designer URL（寫入預設 seataSaga.designerUrl）'
                        : 'Hosted Designer URL (default seataSaga.designerUrl)'}
                    </label>
                    <input
                      id="vscode-designer-url"
                      type="url"
                      value={designerUrl}
                      onChange={(e) => setDesignerUrl(e.target.value)}
                      placeholder="https://your-designer-host.app"
                      className="w-full h-9 px-3 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    {!urlValid && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                        {locale === 'zh-TW'
                          ? '基於 Webview CSP 安全限制，僅允許 https:// 或 http://localhost 位址。'
                          : 'For Webview CSP security, only https:// or http://localhost URLs are allowed.'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="vscode-default-fmt"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
                    >
                      {locale === 'zh-TW' ? '預設檔案格式' : 'Default Format'}
                    </label>
                    <select
                      id="vscode-default-fmt"
                      value={defaultFormat}
                      onChange={(e) =>
                        setDefaultFormat(e.target.value as 'yaml' | 'json')
                      }
                      className="w-full h-9 px-2.5 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="yaml">YAML (.saga.yaml)</option>
                      <option value="json">JSON (.saga.json)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    {locale === 'zh-TW'
                      ? '內含 package.json、免編譯 dist/web/extension.js、README 與雙檔子狀態機範例。'
                      : 'Includes package.json, zero-build dist/web/extension.js, README, and multi-file SubStateMachine examples.'}
                  </span>
                  <button
                    type="button"
                    data-testid="btn-download-vscode-zip"
                    disabled={!urlValid}
                    onClick={handleDownloadZip}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-45 rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t.vscodeDownloadZip}</span>
                  </button>
                </div>
              </div>

              {/* Step-by-Step Commands */}
              <div className="space-y-3">
                {[
                  {
                    id: 'cmd-web',
                    title:
                      locale === 'zh-TW'
                        ? '1. 瀏覽器版 VS Code 立即啟動測試（推薦・免編譯）'
                        : '1. Launch immediately in Browser VS Code (Zero-Build)',
                    cmd: webTestCmd,
                  },
                  {
                    id: 'cmd-vscodedev',
                    title:
                      locale === 'zh-TW'
                        ? '2. 載入至 vscode.dev / github.dev（執行後於 vscode.dev 按 F1 → Developer: Install Web Extension）'
                        : '2. Sideload into vscode.dev / github.dev (F1 -> Developer: Install Web Extension)',
                    cmd: vscodeDevCmd,
                  },
                  {
                    id: 'cmd-vsix',
                    title:
                      locale === 'zh-TW'
                        ? '3. 打包成 .vsix 安裝到桌面版 VS Code 或發佈 Marketplace'
                        : '3. Package as .vsix for VS Code Desktop or Marketplace',
                    cmd: vsixCmd,
                  },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden"
                  >
                    <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        {item.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(item.id, item.cmd)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer shrink-0"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedId === item.id ? t.copied : t.copySource}</span>
                      </button>
                    </div>
                    <pre className="px-3.5 py-2.5 text-xs font-mono text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 overflow-x-auto">
                      {item.cmd}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="flex h-[560px] min-h-0">
              <div className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-2 space-y-1 overflow-y-auto">
                {generatedFiles.map((file, idx) => {
                  const shortName = file.path.replace(/^seata-saga-vscode-web\//, '');
                  const active = idx === selectedFileIndex;
                  return (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => setSelectedFileIndex(idx)}
                      className={`w-full text-left px-2.5 py-2 rounded-md text-xs font-mono truncate transition-colors cursor-pointer ${
                        active
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      {shortName}
                    </button>
                  );
                })}
              </div>
              <div className="flex-1 flex flex-col min-w-0">
                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate">
                    {currentFile.path}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText('file-content', currentFileContent)}
                    className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {copiedId === 'file-content' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedId === 'file-content' ? t.copied : t.copySource}</span>
                  </button>
                </div>
                <pre className="flex-1 p-4 text-xs font-mono leading-relaxed text-slate-800 dark:text-slate-200 bg-slate-50/40 dark:bg-slate-950 overflow-auto">
                  {currentFileContent}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'live-preview' && (
            <div className="flex flex-col h-[580px]">
              {/* Simulated VS Code Status Header */}
              <div className="px-4 py-2 bg-slate-900 text-slate-200 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0 font-mono">
                  <span className="text-sky-400 font-semibold">VS Code Web Host</span>
                  <span className="text-slate-500">·</span>
                  <span className="truncate text-slate-300">
                    orderFulfillment.saga.yaml
                  </span>
                  {revealedLines && (
                    <span
                      data-testid="vscode-sim-reveal"
                      className="text-blue-300 bg-blue-950/80 border border-blue-700/60 px-2 py-0.5 rounded text-[11px]"
                    >
                      Reveal {revealedLines.label} (L{revealedLines.startLine}–
                      {revealedLines.endLine})
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={togglePreviewTheme}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] cursor-pointer shrink-0"
                >
                  {previewTheme === 'dark' ? (
                    <Sun className="w-3.5 h-3.5" />
                  ) : (
                    <Moon className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {previewTheme === 'dark' ? 'Switch Light Theme' : 'Switch Dark Theme'}
                  </span>
                </button>
              </div>

              <div className="flex-1 min-h-0 flex">
                {/* Left: Simulated VS Code TextDocument + Problems + Bridge Log */}
                <div className="w-80 shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-950 text-slate-200">
                  <div className="px-3 py-1.5 text-[11px] font-mono text-slate-400 border-b border-slate-800 flex items-center justify-between">
                    <span>TextDocument (YAML)</span>
                    <span>
                      {bridgeReady ? 'Connected' : 'Loading...'}
                    </span>
                  </div>
                  <textarea
                    aria-label="Simulated VS Code TextDocument"
                    spellCheck={false}
                    value={docText}
                    onChange={(e) => pushDocEditToIframe(e.target.value)}
                    className="flex-1 p-3 text-[11px] font-mono leading-relaxed bg-slate-950 text-slate-200 resize-none focus:outline-none"
                  />

                  {/* Simulated VS Code Problems Panel */}
                  <div className="border-t border-slate-800 px-3 py-2 bg-slate-900/90 max-h-28 overflow-y-auto">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
                      <span className="inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        Problems ({diagnostics.length})
                      </span>
                    </div>
                    {diagnostics.length === 0 ? (
                      <p className="text-[11px] text-emerald-400 font-mono">
                        0 errors, 0 warnings
                      </p>
                    ) : (
                      <ul className="space-y-1 text-[11px] font-mono">
                        {diagnostics.slice(0, 3).map((d, i) => (
                          <li key={i} className="text-amber-300 truncate">
                            L{d.startLine}: {d.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Bridge Message Log */}
                  <div className="border-t border-slate-800 px-3 py-2 bg-slate-950 max-h-24 overflow-y-auto">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                      postMessage Bridge
                    </div>
                    {eventLog.map((entry, idx) => (
                      <div
                        key={idx}
                        className="text-[10.5px] font-mono text-sky-300/90 truncate"
                      >
                        {entry}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Real Designer running in ?embed=vscode mode */}
                <div className="flex-1 min-w-0 bg-white dark:bg-slate-950">
                  <iframe
                    ref={iframeRef}
                    title="VS Code Webview Embedded Seata Saga Designer"
                    data-testid="vscode-live-preview-iframe"
                    src={`/?embed=vscode&theme=${previewTheme}&locale=${locale}`}
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
