import { Locale } from './i18n';

export type AiLayoutDiagnosticCategory =
  | 'server-starting'
  | 'spa-html-fallback'
  | 'auth-redirect'
  | 'proxy-interstitial'
  | 'empty-body'
  | 'invalid-json'
  | 'server-json-error'
  | 'network-error'
  | 'timeout';

export interface AiLayoutDiagnosticDetails {
  category: AiLayoutDiagnosticCategory;
  requestUrl: string;
  finalUrl: string;
  redirected: boolean;
  status: number;
  statusText: string;
  contentType: string;
  pageTitle?: string;
  bodySnippet?: string;
  serverCode?: string;
  provider?: string;
  model?: string;
  upstreamStatus?: number;
  baseUrlHost?: string;
  timestamp: string;
}

export interface NonJsonDiagnosisResult {
  message: string;
  hint: string;
  details: AiLayoutDiagnosticDetails;
}

/**
 * Strips query strings and hash fragments from URLs so sensitive redirect
 * tokens or session parameters are never exposed in diagnostic output.
 */
export function sanitizeUrlForDiagnostics(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed, 'https://placeholder.local');
    const isAbsolute = /^https?:\/\//i.test(trimmed);
    const hasQuery = parsed.search.length > 0;
    const base = isAbsolute
      ? `${parsed.origin}${parsed.pathname}`
      : parsed.pathname;
    return hasQuery ? `${base}?[redacted]` : base;
  } catch {
    const idx = trimmed.search(/[?#]/);
    return idx >= 0 ? `${trimmed.slice(0, idx)}?[redacted]` : trimmed;
  }
}

/**
 * Extracts the plain text inside an HTML `<title>` element if present.
 */
export function extractHtmlTitle(rawBody: string): string | undefined {
  if (!rawBody) return undefined;
  const match = rawBody.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return undefined;
  const cleaned = match[1].replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, 120) : undefined;
}

/**
 * Produces a safe, readable plain-text excerpt of an unexpected HTTP body.
 * Strips `<script>`/`<style>` blocks and HTML tags, and redacts token-like
 * strings before displaying or copying diagnostics.
 */
export function sanitizeBodySnippet(rawBody: string, maxLen = 280): string {
  if (!rawBody) return '';
  const withoutBlocks = rawBody
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  const collapsed = withoutBlocks.replace(/\s+/g, ' ').trim();
  const redacted = collapsed
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\b(sk-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g, '[REDACTED]');

  if (redacted.length <= maxLen) return redacted;
  return `${redacted.slice(0, maxLen - 1)}…`;
}

/**
 * Attempts to parse an HTTP response body as a JSON object even when an
 * intermediary proxy altered or stripped the `Content-Type` header.
 */
export function tryParseAiLayoutResponseText(
  rawText: string
): { ok: true; data: Record<string, unknown> } | { ok: false } {
  const trimmed = (rawText || '').trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return { ok: false };
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, data: parsed as Record<string, unknown> };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

function getHostnameSafe(url: string): string {
  try {
    if (!/^https?:\/\//i.test(url)) return '';
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Detects AI Studio / Cloud Run preview cold-start splash pages
 * (HTTP 200 text/html with "Starting Server...").
 */
export function isServerStartingHtmlResponse(
  rawBody: string,
  pageTitle?: string
): boolean {
  const lowerTitle = (pageTitle ?? extractHtmlTitle(rawBody) ?? '').toLowerCase();
  const lowerBody = (rawBody || '').toLowerCase();
  return (
    lowerTitle.includes('starting server') ||
    lowerBody.includes('please wait while your application starts') ||
    (lowerBody.includes('starting server...') && lowerBody.includes('reload now'))
  );
}

/**
 * Analyzes why `/api/saga/ai-layout` returned a non-JSON payload (such as an
 * HTTP 200 HTML page) and returns an actionable diagnosis + safe diagnostics.
 */
export function diagnoseNonJsonAiResponse(
  input: {
    requestUrl: string;
    finalUrl?: string;
    redirected?: boolean;
    status: number;
    statusText?: string;
    contentType?: string;
    rawBody: string;
    currentOrigin?: string;
  },
  locale: Locale
): NonJsonDiagnosisResult {
  const safeRequestUrl = sanitizeUrlForDiagnostics(input.requestUrl);
  const safeFinalUrl = sanitizeUrlForDiagnostics(input.finalUrl || input.requestUrl);
  const redirected = Boolean(input.redirected);
  const contentType = (input.contentType || '').trim() || '(empty)';
  const rawBody = input.rawBody || '';
  const trimmedBody = rawBody.trim();
  const pageTitle = extractHtmlTitle(rawBody);
  const bodySnippet = sanitizeBodySnippet(rawBody);
  const lowerBody = rawBody.toLowerCase();
  const lowerTitle = (pageTitle || '').toLowerCase();
  const lowerFinalUrl = safeFinalUrl.toLowerCase();
  const lowerCt = contentType.toLowerCase();

  const isHtml =
    lowerCt.includes('text/html') ||
    lowerBody.startsWith('<!doctype html') ||
    lowerBody.startsWith('<html') ||
    lowerBody.includes('<head>');

  const currentHost = getHostnameSafe(input.currentOrigin || '');
  const finalHost = getHostnameSafe(input.finalUrl || '');
  const crossOriginRedirect =
    redirected && Boolean(currentHost) && Boolean(finalHost) && currentHost !== finalHost;

  const looksLikeAuthRedirect =
    crossOriginRedirect ||
    lowerFinalUrl.includes('accounts.google.') ||
    lowerFinalUrl.includes('/login') ||
    lowerFinalUrl.includes('/signin') ||
    lowerFinalUrl.includes('/oauth') ||
    lowerTitle.includes('sign in') ||
    lowerTitle.includes('login') ||
    lowerTitle.includes('登入') ||
    lowerTitle.includes('authenticate') ||
    lowerBody.includes('accounts.google.com') ||
    lowerBody.includes('service=lso');

  const looksLikeSpaFallback =
    isHtml &&
    input.status === 200 &&
    !looksLikeAuthRedirect &&
    (lowerTitle.includes('seata saga') ||
      lowerBody.includes('seata saga state machine designer') ||
      lowerBody.includes('/_next/static/') ||
      lowerBody.includes('__next_f'));

  const looksLikeServerStarting = isHtml && isServerStartingHtmlResponse(rawBody, pageTitle);

  let category: AiLayoutDiagnosticCategory;
  let message: string;
  let hint: string;

  if (!trimmedBody) {
    category = 'empty-body';
    message =
      locale === 'zh-TW'
        ? `AI 排版端點回傳了空白內容 (HTTP ${input.status})，而非預期的 JSON 回應。`
        : `AI layout endpoint returned an empty body (HTTP ${input.status}) instead of JSON.`;
    hint =
      locale === 'zh-TW'
        ? '請點擊下方「測試端點連線」檢查伺服器狀態，或確認反向代理未截斷 POST 回應。'
        : 'Click "Test Endpoint" below to check server reachability or verify your proxy is not stripping POST responses.';
  } else if (looksLikeServerStarting) {
    category = 'server-starting';
    message =
      locale === 'zh-TW'
        ? '雲端預覽伺服器正在啟動或重新載入中（Starting Server...），因此暫時回傳啟動頁 HTML 而非 AI 排版 JSON。'
        : 'The cloud preview server is currently starting or restarting ("Starting Server..."), temporarily returning a startup HTML page instead of API JSON.';
    hint =
      locale === 'zh-TW'
        ? '請等待 3–5 秒後點擊「開始 AI 排版」或「測試端點連線」重試；若持續出現此畫面，請重新整理瀏覽器分頁。'
        : 'Wait 3–5 seconds and retry, or click "Test Endpoint". If this persists, reload the browser tab.';
  } else if (looksLikeAuthRedirect) {
    category = 'auth-redirect';
    message =
      locale === 'zh-TW'
        ? `AI 排版請求遭到登入驗證或預覽代理攔截重導 (HTTP ${input.status}，回應類型 ${contentType})，導致收到登入/驗證 HTML 頁面而非 API JSON。`
        : `The AI layout request was redirected to a sign-in or proxy authentication page (HTTP ${input.status}, ${contentType}) instead of returning API JSON.`;
    hint =
      locale === 'zh-TW'
        ? '若您正透過 AI Studio 分享連結、內嵌 iframe 或受 SSO 保護的網址開啟，請重新整理頁面、改以獨立瀏覽器分頁開啟，或確認瀏覽器允許目前網域的驗證 Cookie。'
        : 'If you opened this via a shared preview link, embedded iframe, or SSO-protected proxy, refresh the page, open it in a standalone browser tab, or ensure cookies are allowed for this origin.';
  } else if (looksLikeSpaFallback) {
    category = 'spa-html-fallback';
    message =
      locale === 'zh-TW'
        ? `AI 排版端點回傳了前端 HTML 頁面（${pageTitle || 'index.html'}，HTTP 200），而非 Next.js API Route JSON。`
        : `The AI layout endpoint returned the frontend HTML page (${pageTitle || 'index.html'}, HTTP 200) instead of a Next.js API Route JSON response.`;
    hint =
      locale === 'zh-TW'
        ? '這通常代表目前網站部署於靜態空間，或反向代理將 /api/* 路徑重寫（fallback）導向首頁 HTML。請確認伺服器是以 Next.js standalone 模式執行，或直接改用本機自動排版。'
        : 'This typically means the app is served as static files or a reverse proxy rewrites /api/* to index.html. Ensure the Next.js server runtime is active, or use Local Auto Layout.';
  } else if (isHtml) {
    category = 'proxy-interstitial';
    message =
      locale === 'zh-TW'
        ? `AI 排版端點收到 HTML 頁面（HTTP ${input.status}${pageTitle ? ` · ${pageTitle}` : ''}），而非 JSON 資料。`
        : `AI layout endpoint received an HTML page (HTTP ${input.status}${pageTitle ? ` · ${pageTitle}` : ''}) instead of JSON.`;
    hint =
      locale === 'zh-TW'
        ? '可能是雲端預覽冷啟動中、閘道代理暫時回應維護頁，或路徑未指向 Next.js 伺服器。請展開下方診斷詳情查看實際回應內容，或點擊「測試端點連線」。'
        : 'A cloud preview cold-start page, proxy gateway, or misrouted path may have responded with HTML. Expand Diagnostic Details below or click "Test Endpoint".';
  } else {
    category = 'invalid-json';
    message =
      locale === 'zh-TW'
        ? `AI 排版端點回傳了無法解析的非 JSON 內容 (HTTP ${input.status}，Content-Type: ${contentType})。`
        : `AI layout endpoint returned unparseable non-JSON content (HTTP ${input.status}, Content-Type: ${contentType}).`;
    hint =
      locale === 'zh-TW'
        ? '請展開下方診斷詳情檢視原始回應摘要，或點擊「測試端點連線」驗證伺服器端點。'
        : 'Expand Diagnostic Details below to inspect the response excerpt or click "Test Endpoint".';
  }

  return {
    message,
    hint,
    details: {
      category,
      requestUrl: safeRequestUrl,
      finalUrl: safeFinalUrl,
      redirected,
      status: input.status,
      statusText: input.statusText || '',
      contentType,
      pageTitle,
      bodySnippet: bodySnippet || undefined,
      timestamp: new Date().toISOString(),
    },
  };
}

export function formatDiagnosticsReport(details: AiLayoutDiagnosticDetails): string {
  const lines = [
    `[Seata Saga AI Layout Diagnostics]`,
    `Time: ${details.timestamp}`,
    `Category: ${details.category}`,
    `Request URL: ${details.requestUrl}`,
    `Final URL: ${details.finalUrl}${details.redirected ? ' (redirected)' : ''}`,
    `HTTP Status: ${details.status}${details.statusText ? ` ${details.statusText}` : ''}`,
    `Content-Type: ${details.contentType}`,
  ];
  if (details.serverCode) lines.push(`Error Code: ${details.serverCode}`);
  if (details.provider) lines.push(`Provider: ${details.provider}`);
  if (details.model) lines.push(`Model: ${details.model}`);
  if (details.upstreamStatus !== undefined) {
    lines.push(`Upstream HTTP Status: ${details.upstreamStatus}`);
  }
  if (details.baseUrlHost) lines.push(`Upstream Host: ${details.baseUrlHost}`);
  if (details.pageTitle) lines.push(`HTML Title: ${details.pageTitle}`);
  if (details.bodySnippet) lines.push(`Body Excerpt: ${details.bodySnippet}`);
  return lines.join('\n');
}
