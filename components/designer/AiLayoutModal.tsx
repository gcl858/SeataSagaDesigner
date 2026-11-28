'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns3,
  Copy,
  GitCompareArrows,
  LayoutGrid,
  Lightbulb,
  Loader2,
  Maximize2,
  RefreshCw,
  Rows3,
  Sparkles,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';
import {
  AI_LAYOUT_QUICK_PROMPTS,
  AI_LAYOUT_STYLES,
  AI_LAYOUT_TIMEOUT_MS,
  AI_LAYOUT_TIMEOUT_SECONDS,
  AiLayoutPlan,
  AiLayoutResponsePayload,
  AiLayoutStyle,
  applyAiLayoutToGraph,
  computeLayoutMetrics,
  DEFAULT_MINIMAX_MODEL,
  formatAiLayoutDuration,
  formatLiveElapsedTimer,
  LayoutQualityMetrics,
  MINIMAX_MODEL_OPTIONS,
} from '@/lib/saga/aiLayout';
import {
  AiLayoutDiagnosticDetails,
  diagnoseNonJsonAiResponse,
  formatDiagnosticsReport,
  isServerStartingHtmlResponse,
  sanitizeUrlForDiagnostics,
  tryParseAiLayoutResponseText,
} from '@/lib/saga/aiLayoutDiagnostics';
import { Locale, UI_COPY } from '@/lib/saga/i18n';
import { computeGraphEdgeRoutes } from '@/lib/saga/edgeRouting';
import { SagaGraph, SeataEdgeType, SeataStateType } from '@/lib/saga/types';
import { withBasePath } from '@/lib/basePath';

interface AiLayoutModalProps {
  open: boolean;
  onClose: () => void;
  graph: SagaGraph;
  locale: Locale;
  onApplyLayout: (nextGraph: SagaGraph, summary: string, durationMs?: number) => void;
  onRunBasicAutoLayout: () => void;
}

interface GeneratedState {
  graphSignature: string;
  plan: AiLayoutPlan;
  previewGraph: SagaGraph;
  metricsBefore: LayoutQualityMetrics;
  metricsAfter: LayoutQualityMetrics;
  model: string;
  durationMs: number;
}

const STYLE_ICONS: Record<AiLayoutStyle, React.ReactNode> = {
  'horizontal-swimlane': <Columns3 className="w-4 h-4" />,
  'vertical-flowchart': <Rows3 className="w-4 h-4" />,
  'compensation-aligned': <GitCompareArrows className="w-4 h-4" />,
  'compact-executive': <Maximize2 className="w-4 h-4" />,
};

function getNodeFillColor(type: SeataStateType, isComp?: boolean): string {
  if (isComp) return '#d97706';
  switch (type) {
    case 'StartState':
    case 'Succeed':
      return '#059669';
    case 'Fail':
      return '#dc2626';
    case 'Choice':
      return '#4f46e5';
    case 'SubStateMachine':
      return '#0284c7';
    case 'CompensationTrigger':
      return '#ea580c';
    case 'ScriptTask':
      return '#0f766e';
    default:
      return '#2563eb';
  }
}

function getEdgeStrokeColor(type: SeataEdgeType): string {
  switch (type) {
    case 'Compensation':
      return '#d97706';
    case 'Catch':
      return '#dc2626';
    case 'Choice':
    case 'Default':
      return '#4f46e5';
    default:
      return '#64748b';
  }
}

function LayoutMiniPreview({ graph, label }: { graph: SagaGraph; label: string }) {
  const { viewBox, routedEdges } = useMemo(() => {
    const routes = computeGraphEdgeRoutes(graph.nodes, graph.edges);
    if (graph.nodes.length === 0) {
      return { viewBox: '0 0 400 220', routedEdges: routes };
    }
    const minX = Math.min(...graph.nodes.map((n) => n.x)) - 28;
    const minY = Math.min(...graph.nodes.map((n) => n.y)) - 28;
    const maxX = Math.max(...graph.nodes.map((n) => n.x + n.width)) + 28;
    const maxY = Math.max(...graph.nodes.map((n) => n.y + n.height)) + 28;
    const w = Math.max(240, maxX - minX);
    const h = Math.max(140, maxY - minY);
    return { viewBox: `${minX} ${minY} ${w} ${h}`, routedEdges: routes };
  }, [graph]);

  return (
    <div
      data-testid="ai-layout-preview-svg-box"
      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/70 overflow-hidden"
    >
      <div className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-400">
        <span>{label}</span>
        <span className="font-mono tabular-nums">
          {graph.nodes.length} nodes · {graph.edges.length} edges
        </span>
      </div>
      <div className="h-44 w-full p-2 flex items-center justify-center">
        <svg
          viewBox={viewBox}
          className="w-full h-full"
          role="img"
          aria-label={label}
        >
          {graph.edges.map((edge) => {
            const route = routedEdges.get(edge.id);
            if (!route) return null;
            const isDashed =
              edge.type === 'Compensation' || edge.type === 'Catch';
            return (
              <path
                key={edge.id}
                d={route.path}
                fill="none"
                stroke={getEdgeStrokeColor(edge.type)}
                strokeWidth={3}
                strokeOpacity={0.78}
                strokeDasharray={isDashed ? '8 6' : undefined}
              />
            );
          })}
          {graph.nodes.map((node) => {
            const fill = getNodeFillColor(node.type, node.isForCompensation);
            const isCircle =
              node.type === 'StartState' ||
              node.type === 'Succeed' ||
              node.type === 'Fail' ||
              node.type === 'CompensationTrigger';
            if (isCircle) {
              const r = Math.min(node.width, node.height) / 2;
              return (
                <circle
                  key={node.id}
                  cx={node.x + node.width / 2}
                  cy={node.y + node.height / 2}
                  r={r}
                  fill={fill}
                  stroke="#ffffff"
                  strokeWidth={2.5}
                />
              );
            }
            if (node.type === 'Choice') {
              const cx = node.x + node.width / 2;
              const cy = node.y + node.height / 2;
              const pts = `${cx},${node.y} ${node.x + node.width},${cy} ${cx},${node.y + node.height} ${node.x},${cy}`;
              return (
                <polygon
                  key={node.id}
                  points={pts}
                  fill={fill}
                  stroke="#ffffff"
                  strokeWidth={2.5}
                />
              );
            }
            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx={10}
                  fill={fill}
                  stroke="#ffffff"
                  strokeWidth={2.5}
                />
                <text
                  x={node.x + node.width / 2}
                  y={node.y + node.height / 2 + 5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={16}
                  fontWeight={600}
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {node.name.length > 14 ? `${node.name.slice(0, 13)}…` : node.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-xs bg-blue-600" />
          Service
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-xs bg-indigo-600" />
          Choice
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-xs bg-amber-600" />
          Compensate
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-600" />
          Start / Succeed
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-600" />
          Fail / Catch
        </span>
      </div>
    </div>
  );
}

function MetricComparisonRow({
  label,
  before,
  after,
  lowerIsBetter = true,
  unit = '',
}: {
  label: string;
  before: number;
  after?: number;
  lowerIsBetter?: boolean;
  unit?: string;
}) {
  const delta = after !== undefined ? after - before : null;
  const improved =
    delta !== null &&
    delta !== 0 &&
    (lowerIsBetter ? delta < 0 : delta > 0);
  const worsened =
    delta !== null &&
    delta !== 0 &&
    (lowerIsBetter ? delta > 0 : delta < 0);

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0 text-xs">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <div className="flex items-center gap-2 font-mono tabular-nums">
        <span className="text-slate-700 dark:text-slate-300">
          {before}
          {unit}
        </span>
        {after !== undefined && (
          <>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <span
              className={`font-semibold ${
                improved
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : worsened
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {after}
              {unit}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default function AiLayoutModal({
  open,
  onClose,
  graph,
  locale,
  onApplyLayout,
  onRunBasicAutoLayout,
}: AiLayoutModalProps) {
  const t = UI_COPY[locale];
  const isStaticExport = process.env.NEXT_PUBLIC_IS_STATIC_EXPORT === 'true';

  const [style, setStyle] = useState<AiLayoutStyle>('horizontal-swimlane');
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MINIMAX_MODEL);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingNotice, setLoadingNotice] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [cancelledNotice, setCancelledNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [errorDiagnostics, setErrorDiagnostics] =
    useState<AiLayoutDiagnosticDetails | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [copiedDiag, setCopiedDiag] = useState<boolean>(false);
  const [probingEndpoint, setProbingEndpoint] = useState<boolean>(false);
  const [probeSummary, setProbeSummary] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedState | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestStartRef = useRef<number | null>(null);
  const requestSeqRef = useRef<number>(0);

  const graphSignature = useMemo(
    () =>
      `${graph.meta.name}:${graph.nodes.map((n) => n.id).join(',')}:${graph.edges.length}`,
    [graph]
  );

  const baselineMetrics = useMemo(() => computeLayoutMetrics(graph), [graph]);

  const activeResult =
    generated && generated.graphSignature === graphSignature ? generated : null;

  const handleCloseSafely = () => {
    requestSeqRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    requestStartRef.current = null;
    setLoading(false);
    setLoadingNotice(null);
    setElapsedMs(0);
    onClose();
  };

  useEffect(() => {
    if (!loading) return;
    const id = window.setInterval(() => {
      if (requestStartRef.current !== null) {
        setElapsedMs(Math.max(0, performance.now() - requestStartRef.current));
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        requestSeqRef.current += 1;
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        requestStartRef.current = null;
        setLoading(false);
        setLoadingNotice(null);
        setElapsedMs(0);
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      requestSeqRef.current += 1;
      abortControllerRef.current?.abort();
      requestStartRef.current = null;
    };
  }, []);

  if (!open) return null;

  const handleCancelRequest = () => {
    const waitedMs =
      requestStartRef.current !== null
        ? Math.max(0, performance.now() - requestStartRef.current)
        : elapsedMs;
    requestSeqRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    requestStartRef.current = null;
    setLoading(false);
    setLoadingNotice(null);
    setElapsedMs(0);
    setErrorMessage(null);
    setErrorHint(null);
    setErrorDiagnostics(null);
    setCancelledNotice(
      locale === 'zh-TW'
        ? `已取消 AI 排版請求（已等待 ${formatAiLayoutDuration(waitedMs, 'zh-TW')}），您可以調整排版策略或隨時重新產生。`
        : `AI layout request cancelled after ${formatAiLayoutDuration(waitedMs, 'en')}. Adjust settings or regenerate anytime.`
    );
  };

  const handleProbeEndpoint = async () => {
    if (probingEndpoint) return;
    setProbingEndpoint(true);
    setProbeSummary(null);
    const endpointUrl = withBasePath('/api/saga/ai-layout');
    try {
      const res = await fetch(endpointUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const rawText = await res.text();
      const parsed = tryParseAiLayoutResponseText(rawText);
      if (parsed.ok && parsed.data.ok === true) {
        const keyReady = Boolean(parsed.data.apiKeyConfigured);
        const host = typeof parsed.data.baseUrlHost === 'string' ? parsed.data.baseUrlHost : 'api.minimax.io';
        const timeoutSec =
          typeof parsed.data.timeoutSeconds === 'number'
            ? parsed.data.timeoutSeconds
            : AI_LAYOUT_TIMEOUT_SECONDS;
        setProbeSummary(
          locale === 'zh-TW'
            ? `端點連線正常 (HTTP ${res.status} · Next.js API Route)｜MINIMAX_API_KEY：${keyReady ? '已設定' : '未設定'}｜目標主機：${host}｜逾時上限：${timeoutSec} 秒`
            : `Endpoint reachable (HTTP ${res.status} · Next.js API Route) | MINIMAX_API_KEY: ${keyReady ? 'Configured' : 'Missing'} | Host: ${host} | Timeout: ${timeoutSec}s`
        );
      } else {
        const diag = diagnoseNonJsonAiResponse(
          {
            requestUrl: endpointUrl,
            finalUrl: res.url || endpointUrl,
            redirected: res.redirected,
            status: res.status,
            statusText: res.statusText,
            contentType: res.headers.get('content-type') || '',
            rawBody: rawText,
            currentOrigin: window.location.origin,
          },
          locale
        );
        setProbeSummary(
          locale === 'zh-TW'
            ? `GET 探測同樣未回傳 JSON (HTTP ${res.status} · ${diag.details.contentType}${diag.details.redirected ? ` · 重導至 ${diag.details.finalUrl}` : ''}${diag.details.pageTitle ? ` · 標題「${diag.details.pageTitle}」` : ''})`
            : `GET probe also received non-JSON (HTTP ${res.status} · ${diag.details.contentType}${diag.details.redirected ? ` · redirected to ${diag.details.finalUrl}` : ''}${diag.details.pageTitle ? ` · title "${diag.details.pageTitle}"` : ''})`
        );
        setErrorDiagnostics(diag.details);
        setShowDiagnostics(true);
      }
    } catch (err) {
      setProbeSummary(
        locale === 'zh-TW'
          ? `無法連線至探測端點：${err instanceof Error ? err.message : '網路錯誤'}`
          : `Failed to reach probe endpoint: ${err instanceof Error ? err.message : 'Network error'}`
      );
    } finally {
      setProbingEndpoint(false);
    }
  };

  const handleCopyDiagnostics = async () => {
    if (!errorDiagnostics) return;
    const text = formatDiagnosticsReport(errorDiagnostics);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedDiag(true);
      window.setTimeout(() => setCopiedDiag(false), 1800);
    } catch {
      // Clipboard API may be unavailable in restricted contexts
    }
  };

  const handleGenerate = async () => {
    if (loading) return;
    if (isStaticExport) {
      setErrorMessage(
        locale === 'zh-TW'
          ? '目前執行於純靜態 GitHub Pages 模式，無法呼叫伺服器端 AI 排版 API。您可直接點擊下方「改用本機自動排版」，或以 standalone 伺服器模式部署以啟用 AI 排版。'
          : 'This deployment runs in static GitHub Pages export mode without a server API runtime. Use local Auto Layout below, or deploy in standalone mode to enable AI Layout.'
      );
      setErrorHint(null);
      setErrorDiagnostics(null);
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const reqSeq = requestSeqRef.current + 1;
    requestSeqRef.current = reqSeq;
    const startedAt = performance.now();
    requestStartRef.current = startedAt;

    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, AI_LAYOUT_TIMEOUT_MS);

    setLoading(true);
    setElapsedMs(0);
    setLoadingNotice(null);
    setCancelledNotice(null);
    setErrorMessage(null);
    setErrorHint(null);
    setErrorDiagnostics(null);
    setProbeSummary(null);
    setShowDiagnostics(false);

    const requestUrl = withBasePath('/api/saga/ai-layout');
    const retryDelaysMs = [2500, 4000, 5000];
    const sleepAbortable = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        if (controller.signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        const id = window.setTimeout(() => {
          controller.signal.removeEventListener('abort', onAbort);
          resolve();
        }, ms);
        const onAbort = () => {
          window.clearTimeout(id);
          reject(new DOMException('Aborted', 'AbortError'));
        };
        controller.signal.addEventListener('abort', onAbort, { once: true });
      });

    try {
      let response!: Response;
      let contentType = '';
      let rawText = '';
      let parsedBody: ReturnType<typeof tryParseAiLayoutResponseText> = { ok: false };

      for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
        response = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
          body: JSON.stringify({
            graph,
            style,
            customPrompt,
            locale,
            model: selectedModel,
          }),
        });

        contentType = response.headers.get('content-type') || '';
        rawText = await response.text();
        parsedBody = tryParseAiLayoutResponseText(rawText);

        if (parsedBody.ok) {
          setLoadingNotice(null);
          break;
        }

        const isStartingSplash =
          contentType.toLowerCase().includes('text/html') &&
          isServerStartingHtmlResponse(rawText);

        if (isStartingSplash && attempt < retryDelaysMs.length) {
          const delayMs = retryDelaysMs[attempt];
          const delaySec = Math.round(delayMs / 1000);
          setLoadingNotice(
            locale === 'zh-TW'
              ? `偵測到預覽伺服器正在啟動中（Starting Server...），${delaySec} 秒後自動重試（第 ${attempt + 1}/${retryDelaysMs.length} 次）…`
              : `Preview server is starting ("Starting Server..."). Automatically retrying in ${delaySec}s (${attempt + 1}/${retryDelaysMs.length})…`
          );
          await sleepAbortable(delayMs);
          continue;
        }

        break;
      }

      if (!parsedBody.ok) {
        const diagnosis = diagnoseNonJsonAiResponse(
          {
            requestUrl,
            finalUrl: response.url || requestUrl,
            redirected: response.redirected,
            status: response.status,
            statusText: response.statusText,
            contentType,
            rawBody: rawText,
            currentOrigin: window.location.origin,
          },
          locale
        );
        setErrorMessage(diagnosis.message);
        setErrorHint(diagnosis.hint);
        setErrorDiagnostics(diagnosis.details);
        setShowDiagnostics(true);
        return;
      }

      const data = parsedBody.data as unknown as
        | AiLayoutResponsePayload
        | {
            ok: false;
            code?: string;
            error?: string;
            details?: {
              provider?: string;
              model?: string;
              upstreamStatus?: number;
              baseUrlHost?: string;
            };
          };

      if (!response.ok || !data.ok) {
        const errPayload = data as {
          code?: string;
          error?: string;
          details?: {
            provider?: string;
            model?: string;
            upstreamStatus?: number;
            baseUrlHost?: string;
          };
        };
        setErrorMessage(
          errPayload.error ||
            (locale === 'zh-TW'
              ? `AI 排版請求失敗 (HTTP ${response.status})，請稍後再試。`
              : `AI layout request failed (HTTP ${response.status}). Please try again.`)
        );
        setErrorDiagnostics({
          category: 'server-json-error',
          requestUrl: sanitizeUrlForDiagnostics(requestUrl),
          finalUrl: sanitizeUrlForDiagnostics(response.url || requestUrl),
          redirected: response.redirected,
          status: response.status,
          statusText: response.statusText,
          contentType: contentType || '(empty)',
          serverCode: errPayload.code,
          provider: errPayload.details?.provider,
          model: errPayload.details?.model || selectedModel,
          upstreamStatus: errPayload.details?.upstreamStatus,
          baseUrlHost: errPayload.details?.baseUrlHost,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (controller.signal.aborted || requestSeqRef.current !== reqSeq) {
        return;
      }

      const previewGraph = applyAiLayoutToGraph(graph, data.plan.positions, {
        style,
        resolveOverlaps: false,
      });
      const durationMs = Math.max(1, Math.round(performance.now() - startedAt));

      setGenerated({
        graphSignature,
        plan: data.plan,
        previewGraph,
        metricsBefore: data.metricsBefore,
        metricsAfter: data.metricsAfter,
        model: data.model,
        durationMs,
      });
    } catch (err) {
      if (requestSeqRef.current !== reqSeq) {
        return;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (didTimeout) {
          setErrorMessage(
            locale === 'zh-TW'
              ? `AI 排版回應逾時（超過 ${AI_LAYOUT_TIMEOUT_SECONDS} 秒），請再試一次或改用本機自動排版。`
              : `AI layout request timed out after ${AI_LAYOUT_TIMEOUT_SECONDS} seconds. Please retry or use local Auto Layout.`
          );
          setErrorDiagnostics({
            category: 'timeout',
            requestUrl: sanitizeUrlForDiagnostics(requestUrl),
            finalUrl: sanitizeUrlForDiagnostics(requestUrl),
            redirected: false,
            status: 0,
            statusText: `Client Timeout (${AI_LAYOUT_TIMEOUT_SECONDS}s)`,
            contentType: '(none)',
            model: selectedModel,
            timestamp: new Date().toISOString(),
          });
        }
        return;
      }
      setErrorMessage(
        err instanceof Error
          ? err.message
          : locale === 'zh-TW'
            ? '無法連線至 AI 排版服務。'
            : 'Unable to reach AI layout service.'
      );
      setErrorDiagnostics({
        category: 'network-error',
        requestUrl: sanitizeUrlForDiagnostics(requestUrl),
        finalUrl: sanitizeUrlForDiagnostics(requestUrl),
        redirected: false,
        status: 0,
        statusText: err instanceof Error ? err.name : 'NetworkError',
        contentType: '(none)',
        bodySnippet: err instanceof Error ? err.message : undefined,
        timestamp: new Date().toISOString(),
      });
    } finally {
      window.clearTimeout(timeoutId);
      if (requestSeqRef.current === reqSeq) {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        requestStartRef.current = null;
        setLoading(false);
        setLoadingNotice(null);
      }
    }
  };

  const handleApply = () => {
    if (!activeResult) return;
    onApplyLayout(
      activeResult.previewGraph,
      activeResult.plan.summary,
      activeResult.durationMs
    );
    onClose();
  };

  const nonStartCount = graph.nodes.filter((n) => n.type !== 'StartState').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCloseSafely();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-layout-modal-title"
        data-testid="ai-layout-modal"
        className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/70 flex items-center justify-center text-blue-700 dark:text-blue-400 shrink-0">
              <Wand2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="ai-layout-modal-title"
                className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate"
              >
                {t.aiLayoutModalTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                  {graph.meta.name}
                </span>
                {' · '}
                {nonStartCount} {locale === 'zh-TW' ? '狀態節點' : 'states'} ·{' '}
                {graph.edges.length} {locale === 'zh-TW' ? '條連線' : 'edges'}
                {graph.yamlTemplate
                  ? locale === 'zh-TW'
                    ? ' · 保留 YAML # 註解'
                    : ' · YAML # comments preserved'
                  : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseSafely}
            aria-label={locale === 'zh-TW' ? '關閉 AI 排版視窗' : 'Close AI Layout dialog'}
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Style Presets + Custom Prompt */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                {locale === 'zh-TW' ? '1. 選擇語意排版策略' : '1. Choose Semantic Layout Strategy'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AI_LAYOUT_STYLES.map((opt) => {
                  const selected = style === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      data-testid={`ai-style-${opt.id}`}
                      aria-pressed={selected}
                      onClick={() => setStyle(opt.id)}
                      className={`text-left p-3 rounded-lg border transition-all cursor-pointer ${
                        selected
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 ring-1 ring-blue-600/20'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={
                            selected
                              ? 'text-blue-700 dark:text-blue-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }
                        >
                          {STYLE_ICONS[opt.id]}
                        </span>
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {locale === 'zh-TW' ? opt.labelZh : opt.labelEn}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                        {locale === 'zh-TW' ? opt.descZh : opt.descEn}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="ai-layout-custom-prompt"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  {locale === 'zh-TW'
                    ? '2. 自訂排版偏好（選填）'
                    : '2. Custom Layout Guidance (Optional)'}
                </label>
                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                  {customPrompt.length}/400
                </span>
              </div>
              <textarea
                id="ai-layout-custom-prompt"
                rows={3}
                maxLength={400}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={
                  locale === 'zh-TW'
                    ? '例如：把風控與失敗節點放在下方，主成功路徑拉成水平直線，補償節點對齊原任務正下方…'
                    : 'e.g., Align the main happy path horizontally, place compensation tasks directly beneath each service task...'
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {AI_LAYOUT_QUICK_PROMPTS.map((item) => {
                  const text = locale === 'zh-TW' ? item.zh : item.en;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCustomPrompt(text)}
                      className="text-[11px] px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer text-left"
                    >
                      {text}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 px-3 py-2">
              <label
                htmlFor="ai-layout-model-select"
                className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
              >
                {locale === 'zh-TW' ? 'MiniMax 模型' : 'MiniMax Model'}
              </label>
              <select
                id="ai-layout-model-select"
                data-testid="ai-layout-model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={loading}
                className="h-7 flex-1 max-w-[260px] px-2 text-xs font-medium bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
              >
                {MINIMAX_MODEL_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {locale === 'zh-TW' ? opt.labelZh : opt.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-0.5 flex items-center gap-2">
              <button
                type="button"
                data-testid="btn-generate-ai-layout"
                onClick={handleGenerate}
                disabled={loading || graph.nodes.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {locale === 'zh-TW'
                        ? 'AI 正在分析語意與最佳化拓樸…'
                        : 'Analyzing semantics & optimizing layout…'}
                    </span>
                  </>
                ) : activeResult ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      {locale === 'zh-TW' ? '重新產生 AI 排版' : 'Regenerate AI Layout'}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {locale === 'zh-TW' ? '開始 AI 排版' : 'Generate AI Layout'}
                    </span>
                  </>
                )}
              </button>
              {loading && (
                <button
                  type="button"
                  data-testid="btn-cancel-ai-layout"
                  onClick={handleCancelRequest}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-red-300 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors cursor-pointer shrink-0"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{locale === 'zh-TW' ? '取消 AI 排版' : 'Cancel'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Live Preview, Quality Metrics & Rationale */}
          <div className="lg:col-span-6 flex flex-col gap-3.5">
            {errorMessage && (
              <div
                role="alert"
                data-testid="ai-layout-error"
                className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3.5 flex flex-col gap-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="text-xs font-medium text-red-800 dark:text-red-200 leading-relaxed">
                      {errorMessage}
                    </div>
                    {errorHint && (
                      <div className="text-[11px] text-red-700/90 dark:text-red-300/90 leading-relaxed">
                        {errorHint}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pl-6">
                  <button
                    type="button"
                    onClick={onRunBasicAutoLayout}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>
                      {locale === 'zh-TW' ? '改用本機自動排版' : 'Use Local Auto Layout'}
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="btn-probe-ai-endpoint"
                    onClick={handleProbeEndpoint}
                    disabled={probingEndpoint}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                  >
                    {probingEndpoint ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Activity className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {locale === 'zh-TW' ? '測試端點連線' : 'Test Endpoint'}
                    </span>
                  </button>
                  {errorDiagnostics && (
                    <button
                      type="button"
                      data-testid="btn-toggle-ai-diagnostics"
                      onClick={() => setShowDiagnostics((v) => !v)}
                      className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-red-700 dark:text-red-300 hover:bg-red-100/70 dark:hover:bg-red-900/40 cursor-pointer"
                    >
                      {showDiagnostics ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {locale === 'zh-TW' ? '診斷詳情' : 'Diagnostic Details'}
                      </span>
                    </button>
                  )}
                </div>

                {probeSummary && (
                  <div
                    data-testid="ai-endpoint-probe-result"
                    className="ml-6 rounded-md border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 px-2.5 py-1.5 text-[11px] font-mono text-slate-700 dark:text-slate-300 break-all"
                  >
                    {probeSummary}
                  </div>
                )}

                {errorDiagnostics && showDiagnostics && (
                  <div
                    data-testid="ai-layout-diagnostics-panel"
                    className="ml-6 rounded-md border border-red-200/80 dark:border-red-900/70 bg-white/95 dark:bg-slate-950/80 p-2.5 space-y-1.5 text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-200 dark:border-slate-800">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {locale === 'zh-TW' ? '技術診斷資訊' : 'Technical Diagnostics'}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyDiagnostics}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {copiedDiag ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>
                          {copiedDiag
                            ? locale === 'zh-TW'
                              ? '已複製'
                              : 'Copied'
                            : locale === 'zh-TW'
                              ? '複製診斷資訊'
                              : 'Copy'}
                        </span>
                      </button>
                    </div>
                    <dl className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-1 font-mono text-[10.5px] leading-relaxed">
                      <dt className="text-slate-500 dark:text-slate-400">Request URL</dt>
                      <dd className="text-slate-800 dark:text-slate-200 break-all">
                        {errorDiagnostics.requestUrl}
                      </dd>
                      <dt className="text-slate-500 dark:text-slate-400">Final URL</dt>
                      <dd className="text-slate-800 dark:text-slate-200 break-all">
                        {errorDiagnostics.finalUrl}
                        {errorDiagnostics.redirected ? ' (redirected)' : ''}
                      </dd>
                      <dt className="text-slate-500 dark:text-slate-400">HTTP Status</dt>
                      <dd className="text-slate-800 dark:text-slate-200">
                        {errorDiagnostics.status}
                        {errorDiagnostics.statusText ? ` ${errorDiagnostics.statusText}` : ''}
                      </dd>
                      <dt className="text-slate-500 dark:text-slate-400">Content-Type</dt>
                      <dd className="text-slate-800 dark:text-slate-200 break-all">
                        {errorDiagnostics.contentType}
                      </dd>
                      {errorDiagnostics.serverCode && (
                        <>
                          <dt className="text-slate-500 dark:text-slate-400">Error Code</dt>
                          <dd className="text-slate-800 dark:text-slate-200">
                            {errorDiagnostics.serverCode}
                          </dd>
                        </>
                      )}
                      {errorDiagnostics.model && (
                        <>
                          <dt className="text-slate-500 dark:text-slate-400">Model</dt>
                          <dd className="text-slate-800 dark:text-slate-200">
                            {errorDiagnostics.model}
                            {errorDiagnostics.baseUrlHost
                              ? ` (${errorDiagnostics.baseUrlHost})`
                              : ''}
                          </dd>
                        </>
                      )}
                      {errorDiagnostics.upstreamStatus !== undefined && (
                        <>
                          <dt className="text-slate-500 dark:text-slate-400">Upstream</dt>
                          <dd className="text-slate-800 dark:text-slate-200">
                            HTTP {errorDiagnostics.upstreamStatus}
                          </dd>
                        </>
                      )}
                      {errorDiagnostics.pageTitle && (
                        <>
                          <dt className="text-slate-500 dark:text-slate-400">HTML Title</dt>
                          <dd className="text-slate-800 dark:text-slate-200 break-all">
                            {errorDiagnostics.pageTitle}
                          </dd>
                        </>
                      )}
                    </dl>
                    {errorDiagnostics.bodySnippet && (
                      <div className="pt-1 border-t border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                          {locale === 'zh-TW' ? '回應內容摘要（已去除腳本與敏感資訊）' : 'Response Excerpt (sanitized)'}
                        </div>
                        <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap break-all font-mono text-[10px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 rounded p-1.5 border border-slate-200/70 dark:border-slate-800">
                          {errorDiagnostics.bodySnippet}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {cancelledNotice && !loading && !errorMessage && (
              <div
                role="status"
                data-testid="ai-layout-cancelled"
                className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/90 dark:bg-amber-950/35 px-3.5 py-2.5 flex items-start justify-between gap-2.5"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <XCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                    {cancelledNotice}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCancelledNotice(null)}
                  aria-label={locale === 'zh-TW' ? '關閉取消提示' : 'Dismiss cancellation notice'}
                  className="p-0.5 rounded text-amber-700/70 hover:text-amber-900 dark:text-amber-300/70 dark:hover:text-amber-100 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {loading ? (
              <div
                data-testid="ai-layout-loading-panel"
                className="flex-1 min-h-[260px] rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-6 flex flex-col items-center justify-center text-center gap-3.5"
              >
                <Loader2 className="w-7 h-7 text-blue-600 dark:text-blue-400 animate-spin" />
                <div className="space-y-1.5 max-w-sm">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {loadingNotice ||
                      (locale === 'zh-TW'
                        ? '正在理解 Seata Saga 業務流程與補償關係…'
                        : 'Understanding Seata Saga flow & compensation pairings…')}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {locale === 'zh-TW'
                      ? 'AI 將根據狀態類型、條件分支與例外捕獲路徑規劃泳道，並自動執行無重疊幾何校驗。'
                      : 'Planning swimlanes by state type, Choice branches, and Catch routes, followed by deterministic collision checking.'}
                  </p>
                </div>

                {/* Live elapsed time & 300s timeout indicator */}
                <div className="w-full max-w-xs space-y-1.5">
                  <div
                    data-testid="ai-layout-live-elapsed"
                    className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>
                        {locale === 'zh-TW'
                          ? `已耗時 ${formatLiveElapsedTimer(elapsedMs)}`
                          : `Elapsed ${formatLiveElapsedTimer(elapsedMs)}`}
                      </span>
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {locale === 'zh-TW'
                        ? `逾時上限 ${AI_LAYOUT_TIMEOUT_SECONDS} 秒`
                        : `Limit ${AI_LAYOUT_TIMEOUT_SECONDS}s`}
                    </span>
                  </div>
                  <progress
                    max={AI_LAYOUT_TIMEOUT_MS}
                    value={Math.min(AI_LAYOUT_TIMEOUT_MS, Math.max(AI_LAYOUT_TIMEOUT_MS * 0.02, elapsedMs))}
                    aria-label={
                      locale === 'zh-TW'
                        ? `AI 排版等待進度（上限 ${AI_LAYOUT_TIMEOUT_SECONDS} 秒）`
                        : `AI layout elapsed time (limit ${AI_LAYOUT_TIMEOUT_SECONDS}s)`
                    }
                    className="block h-1.5 w-full overflow-hidden rounded-full appearance-none bg-slate-200 dark:bg-slate-800 [&::-webkit-progress-bar]:bg-slate-200 dark:[&::-webkit-progress-bar]:bg-slate-800 [&::-webkit-progress-value]:bg-blue-600 dark:[&::-webkit-progress-value]:bg-blue-500 [&::-moz-progress-bar]:bg-blue-600"
                  />
                </div>

                <button
                  type="button"
                  data-testid="btn-cancel-ai-layout-panel"
                  onClick={handleCancelRequest}
                  className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md border border-red-300 dark:border-red-800/80 bg-white dark:bg-slate-900 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{locale === 'zh-TW' ? '取消排版' : 'Cancel Request'}</span>
                </button>
              </div>
            ) : activeResult ? (
              <div
                data-testid="ai-layout-result"
                className="flex flex-col gap-3"
              >
                {/* Success & Total Elapsed Time Banner */}
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/80 dark:bg-emerald-950/35 px-3 py-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      {locale === 'zh-TW' ? 'AI 排版產生完成' : 'AI Layout Generated'}
                    </span>
                  </div>
                  <div
                    data-testid="ai-layout-duration"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/90 dark:bg-slate-900/80 border border-emerald-200/80 dark:border-emerald-800/60 text-xs font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-300 shrink-0"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {locale === 'zh-TW'
                        ? `總耗時 ${formatAiLayoutDuration(activeResult.durationMs, 'zh-TW')}`
                        : `Total ${formatAiLayoutDuration(activeResult.durationMs, 'en')}`}
                    </span>
                  </div>
                </div>

                <LayoutMiniPreview
                  graph={activeResult.previewGraph}
                  label={
                    locale === 'zh-TW'
                      ? `MiniMax 建議拓樸預覽（${activeResult.model}）`
                      : `MiniMax Proposed Preview (${activeResult.model})`
                  }
                />

                {/* Quantitative Before / After Metrics */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {locale === 'zh-TW'
                        ? '排版品質前後對比'
                        : 'Before vs. After Layout Metrics'}
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400">
                      {activeResult.metricsAfter.boundsWidth}×
                      {activeResult.metricsAfter.boundsHeight}px
                    </span>
                  </div>
                  <MetricComparisonRow
                    label={locale === 'zh-TW' ? '重疊節點對數' : 'Overlapping Node Pairs'}
                    before={activeResult.metricsBefore.overlapCount}
                    after={activeResult.metricsAfter.overlapCount}
                  />
                  <MetricComparisonRow
                    label={locale === 'zh-TW' ? '估算連線交叉數' : 'Estimated Edge Crossings'}
                    before={activeResult.metricsBefore.edgeCrossings}
                    after={activeResult.metricsAfter.edgeCrossings}
                  />
                  {((activeResult.metricsBefore.nodeThroughEdgeHits ?? 0) > 0 ||
                    (activeResult.metricsAfter.nodeThroughEdgeHits ?? 0) > 0) && (
                    <MetricComparisonRow
                      label={locale === 'zh-TW' ? '穿越節點連線數' : 'Edges Passing Through Nodes'}
                      before={activeResult.metricsBefore.nodeThroughEdgeHits ?? 0}
                      after={activeResult.metricsAfter.nodeThroughEdgeHits ?? 0}
                    />
                  )}
                  <MetricComparisonRow
                    label={locale === 'zh-TW' ? '總連線長度' : 'Total Edge Length'}
                    before={activeResult.metricsBefore.totalEdgeLength}
                    after={activeResult.metricsAfter.totalEdgeLength}
                    unit="px"
                  />
                </div>

                {/* AI Summary & Rationale */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3 space-y-2">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-100 leading-relaxed">
                    {activeResult.plan.summary}
                  </p>
                  {activeResult.plan.rationale.length > 0 && (
                    <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300 list-disc pl-4">
                      {activeResult.plan.rationale.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  )}
                  {activeResult.plan.suggestions.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-1">
                        <Lightbulb className="w-3.5 h-3.5" />
                        <span>
                          {locale === 'zh-TW'
                            ? '架構與可讀性建議'
                            : 'Architecture & Readability Tips'}
                        </span>
                      </div>
                      <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400 list-disc pl-4">
                        {activeResult.plan.suggestions.map((tip, idx) => (
                          <li key={idx}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <LayoutMiniPreview
                  graph={graph}
                  label={
                    locale === 'zh-TW' ? '目前畫布排版現況' : 'Current Canvas Layout'
                  }
                />
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-3.5">
                  <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-1.5">
                    {locale === 'zh-TW'
                      ? '目前排版品質基準'
                      : 'Current Layout Quality Baseline'}
                  </h4>
                  <MetricComparisonRow
                    label={locale === 'zh-TW' ? '重疊節點對數' : 'Overlapping Node Pairs'}
                    before={baselineMetrics.overlapCount}
                  />
                  <MetricComparisonRow
                    label={locale === 'zh-TW' ? '估算連線交叉數' : 'Estimated Edge Crossings'}
                    before={baselineMetrics.edgeCrossings}
                  />
                  <MetricComparisonRow
                    label={locale === 'zh-TW' ? '總連線長度' : 'Total Edge Length'}
                    before={baselineMetrics.totalEdgeLength}
                    unit="px"
                  />
                  <div className="flex items-center justify-between pt-1.5 text-xs">
                    <span className="text-slate-600 dark:text-slate-400">
                      {locale === 'zh-TW' ? '畫布包圍尺寸' : 'Canvas Bounding Box'}
                    </span>
                    <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {baselineMetrics.boundsWidth}×{baselineMetrics.boundsHeight}px (
                      {baselineMetrics.aspectRatio}:1)
                    </span>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 px-1">
                  {locale === 'zh-TW'
                    ? 'AI 排版僅調整節點視覺座標，絕不更動 Seata 狀態語意、連線條件或 YAML # 註解；套用後可隨時按 Ctrl+Z 一鍵復原。'
                    : 'AI Layout only updates node visual coordinates—never altering Seata semantics, edges, or YAML # comments. Press Ctrl+Z anytime to undo.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleCloseSafely}
            className="h-8 px-3 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {loading
              ? locale === 'zh-TW'
                ? '取消並關閉'
                : 'Cancel & Close'
              : locale === 'zh-TW'
                ? '關閉'
                : 'Close'}
          </button>

          <div className="flex items-center gap-2">
            {activeResult && (
              <button
                type="button"
                data-testid="btn-apply-ai-layout"
                onClick={handleApply}
                className="inline-flex items-center gap-1.5 h-8 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>
                  {locale === 'zh-TW' ? '套用至畫布' : 'Apply to Canvas'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
