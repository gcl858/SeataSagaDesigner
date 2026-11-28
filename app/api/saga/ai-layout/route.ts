import { NextRequest, NextResponse } from 'next/server';
import {
  AiLayoutNodePosition,
  AiLayoutPlan,
  applyAiLayoutToGraph,
  buildAiLayoutPrompts,
  computeLayoutMetrics,
  extractAiLayoutJsonFromText,
  resolveMiniMaxBaseUrl,
  resolveMiniMaxModel,
  validateAiLayoutRequest,
} from '@/lib/saga/aiLayout';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

function jsonNoStore(payload: unknown, status = 200): NextResponse {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

function getSafeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'api.minimax.io';
  }
}

export async function GET() {
  const apiKey = (process.env.MINIMAX_API_KEY ?? '').trim();
  const apiKeyConfigured = Boolean(apiKey && apiKey !== 'YOUR_MINIMAX_API_KEY');
  const baseUrl = resolveMiniMaxBaseUrl(process.env.MINIMAX_BASE_URL);
  const defaultModel = resolveMiniMaxModel(undefined, process.env.MINIMAX_MODEL);

  return jsonNoStore({
    ok: true,
    endpoint: '/api/saga/ai-layout',
    runtime: 'nextjs-api-route',
    provider: 'minimax',
    apiKeyConfigured,
    defaultModel,
    baseUrlHost: getSafeHost(baseUrl),
  });
}

interface RawAiLayoutResponse {
  positions?: Array<{
    id?: string;
    x?: number;
    y?: number;
    lane?: string;
  }>;
  summary?: string;
  rationale?: string[];
  suggestions?: string[];
}

interface MiniMaxChatCompletionResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      reasoning_content?: string | null;
    };
    finish_reason?: string;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
}

class MiniMaxApiError extends Error {
  status: number;
  code: string;
  upstreamStatus?: number;

  constructor(message: string, status: number, code: string, upstreamStatus?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.upstreamStatus = upstreamStatus;
  }
}

function mapMiniMaxHttpError(
  status: number,
  rawMsg: string,
  locale: 'zh-TW' | 'en'
): MiniMaxApiError {
  const upper = rawMsg.toUpperCase();
  if (status === 401 || status === 403 || upper.includes('INVALID') || upper.includes('AUTH')) {
    return new MiniMaxApiError(
      locale === 'zh-TW'
        ? 'MiniMax API 金鑰無效或權限不足，請確認環境變數 MINIMAX_API_KEY（或 Settings > Secrets）設定是否正確。'
        : 'MiniMax API key is invalid or unauthorized. Please check MINIMAX_API_KEY in your server environment or Settings > Secrets.',
      403,
      'MINIMAX_AUTH_ERROR',
      status
    );
  }
  if (status === 429 || upper.includes('RATE') || upper.includes('QUOTA') || upper.includes('BALANCE')) {
    return new MiniMaxApiError(
      locale === 'zh-TW'
        ? 'MiniMax API 速率受限或帳戶餘額不足，請稍後再試或檢查您的 MiniMax 平台配額。'
        : 'MiniMax API rate limit or quota exceeded. Please retry shortly or check your MiniMax account balance.',
      429,
      'MINIMAX_RATE_LIMITED',
      status
    );
  }
  if (status === 404 || upper.includes('MODEL_NOT_FOUND')) {
    return new MiniMaxApiError(
      locale === 'zh-TW'
        ? `MiniMax 找不到指定模型，請切換其他 MiniMax 模型或檢查 MINIMAX_MODEL 設定。`
        : 'The requested MiniMax model was not found. Try selecting another MiniMax model or verify MINIMAX_MODEL.',
      502,
      'MINIMAX_MODEL_NOT_FOUND',
      status
    );
  }
  return new MiniMaxApiError(
    locale === 'zh-TW'
      ? `MiniMax AI 排版請求失敗（HTTP ${status}）：${rawMsg || '上游服務暫時不可用'}`
      : `MiniMax AI layout request failed (HTTP ${status}): ${rawMsg || 'Upstream service unavailable'}`,
    status >= 500 ? 502 : 400,
    'MINIMAX_UPSTREAM_ERROR',
    status
  );
}

async function callMiniMaxWithRetry(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemInstruction: string;
  userPrompt: string;
  locale: 'zh-TW' | 'en';
}): Promise<{ content: string; resolvedModel: string }> {
  const { baseUrl, apiKey, model, systemInstruction, userPrompt, locale } = params;
  const endpoint = `${baseUrl}/chat/completions`;

  // Per https://platform.minimax.io/docs/guides/text-generation:
  // OpenAI-compatible Chat Completions endpoint at https://api.minimax.io/v1/chat/completions
  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    max_completion_tokens: 4096,
  };

  if (model === 'MiniMax-M3.1-Flash') {
    requestBody.reasoning_effort = 'low';
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 115000);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      const rawText = await res.text();
      let payload: MiniMaxChatCompletionResponse | null = null;
      try {
        payload = JSON.parse(rawText) as MiniMaxChatCompletionResponse;
      } catch {
        payload = null;
      }

      if (!res.ok) {
        const errMsg =
          payload?.error?.message ||
          payload?.base_resp?.status_msg ||
          rawText.slice(0, 200);
        const mapped = mapMiniMaxHttpError(res.status, errMsg, locale);
        if (res.status >= 500 && attempt === 0) {
          lastError = mapped;
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        throw mapped;
      }

      if (payload?.base_resp?.status_code && payload.base_resp.status_code !== 0) {
        const msg =
          payload.base_resp.status_msg ||
          `MiniMax status code ${payload.base_resp.status_code}`;
        throw mapMiniMaxHttpError(
          payload.base_resp.status_code === 1004 ? 401 : 502,
          msg,
          locale
        );
      }

      const content = payload?.choices?.[0]?.message?.content?.trim() ?? '';
      if (!content) {
        throw new MiniMaxApiError(
          locale === 'zh-TW'
            ? 'MiniMax 未回傳有效的文字排版內容，請重新嘗試。'
            : 'MiniMax returned an empty completion. Please try again.',
          502,
          'MINIMAX_EMPTY_RESPONSE'
        );
      }

      return {
        content,
        resolvedModel: payload?.model || model,
      };
    } catch (err) {
      if (err instanceof MiniMaxApiError) {
        throw err;
      }
      lastError = err;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (isAbort) {
        throw new MiniMaxApiError(
          locale === 'zh-TW'
            ? '呼叫 MiniMax API 逾時，請稍後再試或切換至 MiniMax-M3.1-Flash。'
            : 'MiniMax API request timed out. Please retry or switch to MiniMax-M3.1-Flash.',
          504,
          'MINIMAX_TIMEOUT'
        );
      }
      if (attempt === 1) {
        throw new MiniMaxApiError(
          locale === 'zh-TW'
            ? `無法連線至 MiniMax API：${err instanceof Error ? err.message : '網路錯誤'}`
            : `Unable to reach MiniMax API: ${err instanceof Error ? err.message : 'Network error'}`,
          502,
          'MINIMAX_NETWORK_ERROR'
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonNoStore(
      { ok: false, code: 'INVALID_JSON', error: 'Request body must be valid JSON.' },
      400
    );
  }

  const validated = validateAiLayoutRequest(body);
  if (!validated.ok) {
    return jsonNoStore(
      { ok: false, code: 'VALIDATION_ERROR', error: validated.error },
      400
    );
  }

  const { graph, style, customPrompt, locale, model: requestedModel } = validated.data;
  const apiKey = (process.env.MINIMAX_API_KEY ?? '').trim();
  const baseUrl = resolveMiniMaxBaseUrl(process.env.MINIMAX_BASE_URL);
  const baseUrlHost = getSafeHost(baseUrl);
  const model = resolveMiniMaxModel(requestedModel, process.env.MINIMAX_MODEL);

  if (!apiKey || apiKey === 'YOUR_MINIMAX_API_KEY') {
    return jsonNoStore(
      {
        ok: false,
        code: 'MISSING_MINIMAX_API_KEY',
        error:
          locale === 'zh-TW'
            ? '伺服器尚未設定 MINIMAX_API_KEY，無法呼叫 MiniMax AI 排版 API。請於伺服器環境變數或 Settings > Secrets 中加入 MINIMAX_API_KEY，或先使用「改用本機自動排版」。'
            : 'MINIMAX_API_KEY is not configured on the server. Add MINIMAX_API_KEY to your environment or Settings > Secrets, or use local Auto Layout.',
        details: {
          provider: 'minimax',
          model,
          baseUrlHost,
        },
      },
      503
    );
  }
  const { systemInstruction, userPrompt } = buildAiLayoutPrompts(
    graph,
    style,
    customPrompt,
    locale
  );

  try {
    const { content, resolvedModel } = await callMiniMaxWithRetry({
      baseUrl,
      apiKey,
      model,
      systemInstruction,
      userPrompt,
      locale,
    });

    const parsedObj = extractAiLayoutJsonFromText(content);
    if (!parsedObj) {
      return NextResponse.json(
        {
          ok: false,
          code: 'PARSE_ERROR',
          error:
            locale === 'zh-TW'
              ? 'MiniMax 回傳的內容無法解析為有效 JSON 座標格式，請重新產生。'
              : 'Failed to parse MiniMax output as valid layout JSON. Please regenerate.',
        },
        { status: 502 }
      );
    }

    const parsed = parsedObj as RawAiLayoutResponse;
    const validNodeIds = new Set(graph.nodes.map((n) => n.id));
    const sanitizedPositions: AiLayoutNodePosition[] = Array.isArray(
      parsed.positions
    )
      ? parsed.positions
          .filter(
            (p): p is { id: string; x: number; y: number; lane?: string } =>
              Boolean(p) &&
              typeof p.id === 'string' &&
              validNodeIds.has(p.id) &&
              typeof p.x === 'number' &&
              Number.isFinite(p.x) &&
              typeof p.y === 'number' &&
              Number.isFinite(p.y)
          )
          .map((p) => ({
            id: p.id,
            x: p.x,
            y: p.y,
            lane: typeof p.lane === 'string' ? p.lane.slice(0, 40) : undefined,
          }))
      : [];

    if (sanitizedPositions.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          code: 'INVALID_POSITIONS',
          error:
            locale === 'zh-TW'
              ? 'MiniMax 回傳的節點座標清單為空或與目前狀態機節點不相符，請重新嘗試。'
              : 'MiniMax did not return valid coordinates matching this state machine.',
        },
        { status: 502 }
      );
    }

    const metricsBefore = computeLayoutMetrics(graph);
    const resolvedGraph = applyAiLayoutToGraph(graph, sanitizedPositions, {
      style,
      resolveOverlaps: true,
    });
    const metricsAfter = computeLayoutMetrics(resolvedGraph);

    const laneById = new Map(sanitizedPositions.map((p) => [p.id, p.lane]));
    const finalPositions: AiLayoutNodePosition[] = resolvedGraph.nodes.map(
      (n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        lane: laneById.get(n.id),
      })
    );

    const plan: AiLayoutPlan = {
      style,
      positions: finalPositions,
      summary:
        typeof parsed.summary === 'string' && parsed.summary.trim()
          ? parsed.summary.trim().slice(0, 400)
          : locale === 'zh-TW'
            ? '已完成 MiniMax 語意分析與無重疊拓樸優化排版。'
            : 'Completed MiniMax semantic layout with collision-free spacing.',
      rationale: Array.isArray(parsed.rationale)
        ? parsed.rationale
            .filter(
              (item): item is string =>
                typeof item === 'string' && item.trim().length > 0
            )
            .map((item) => item.trim().slice(0, 240))
            .slice(0, 5)
        : [],
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions
            .filter(
              (item): item is string =>
                typeof item === 'string' && item.trim().length > 0
            )
            .map((item) => item.trim().slice(0, 240))
            .slice(0, 4)
        : [],
      model: resolvedModel,
    };

    return jsonNoStore({
      ok: true,
      provider: 'minimax',
      model: resolvedModel,
      plan,
      metricsBefore,
      metricsAfter,
    });
  } catch (err) {
    if (err instanceof MiniMaxApiError) {
      return jsonNoStore(
        {
          ok: false,
          code: err.code,
          error: err.message,
          details: {
            provider: 'minimax',
            model,
            baseUrlHost,
            ...(err.upstreamStatus !== undefined
              ? { upstreamStatus: err.upstreamStatus }
              : {}),
          },
        },
        err.status
      );
    }
    return jsonNoStore(
      {
        ok: false,
        code: 'UPSTREAM_ERROR',
        error:
          locale === 'zh-TW'
            ? 'MiniMax AI 排版發生未預期錯誤，請稍後再試。'
            : 'An unexpected error occurred while calling MiniMax AI layout.',
        details: {
          provider: 'minimax',
          model,
          baseUrlHost,
        },
      },
      502
    );
  }
}
