import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diagnoseNonJsonAiResponse,
  extractHtmlTitle,
  formatDiagnosticsReport,
  isServerStartingHtmlResponse,
  sanitizeBodySnippet,
  sanitizeUrlForDiagnostics,
  tryParseAiLayoutResponseText,
} from './aiLayoutDiagnostics';

test('tryParseAiLayoutResponseText parses valid JSON even if Content-Type was stripped', () => {
  const parsed = tryParseAiLayoutResponseText('  {"ok":true,"model":"MiniMax-M3.1-Flash"}  ');
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.data.ok, true);
    assert.equal(parsed.data.model, 'MiniMax-M3.1-Flash');
  }

  assert.equal(tryParseAiLayoutResponseText('<!DOCTYPE html><html></html>').ok, false);
  assert.equal(tryParseAiLayoutResponseText('').ok, false);
});

test('diagnoseNonJsonAiResponse identifies HTTP 200 SPA index.html fallback cleanly', () => {
  const res = diagnoseNonJsonAiResponse(
    {
      requestUrl: '/api/saga/ai-layout',
      finalUrl: 'https://example.github.io/SeataSagaDesigner/api/saga/ai-layout',
      redirected: false,
      status: 200,
      statusText: 'OK',
      contentType: 'text/html; charset=utf-8',
      rawBody:
        '<!DOCTYPE html><html><head><title>Seata Saga State Machine Designer</title></head><body><script>window.__next_f=[]</script><div>App</div></body></html>',
      currentOrigin: 'https://example.github.io',
    },
    'zh-TW'
  );

  assert.equal(res.details.category, 'spa-html-fallback');
  assert.equal(res.details.pageTitle, 'Seata Saga State Machine Designer');
  assert.match(res.message, /前端 HTML 頁面/);
  assert.ok(!res.details.bodySnippet?.includes('__next_f'));
});

test('diagnoseNonJsonAiResponse identifies auth/SSO redirect and redacts query tokens', () => {
  const res = diagnoseNonJsonAiResponse(
    {
      requestUrl: '/api/saga/ai-layout',
      finalUrl: 'https://accounts.google.com/v3/signin?continue=https://app.run.app&token=secret123',
      redirected: true,
      status: 200,
      statusText: 'OK',
      contentType: 'text/html; charset=utf-8',
      rawBody: '<html><head><title>Sign in - Google Accounts</title></head><body>Please sign in</body></html>',
      currentOrigin: 'https://ais-pre-demo.run.app',
    },
    'zh-TW'
  );

  assert.equal(res.details.category, 'auth-redirect');
  assert.equal(res.details.redirected, true);
  assert.equal(res.details.finalUrl, 'https://accounts.google.com/v3/signin?[redacted]');
  assert.ok(!res.details.finalUrl.includes('secret123'));
  assert.match(res.message, /登入驗證|重導/);
});

test('sanitizeBodySnippet strips scripts and redacts bearer/API tokens', () => {
  const raw =
    '<html><head><style>body{color:red}</style><script>alert(1)</script></head><body>Error: Bearer eyJhbGciOiJIUzI1NiJ9.abcdef123456.sig1234567890 key=sk-abcdef1234567890</body></html>';
  const snippet = sanitizeBodySnippet(raw);
  assert.ok(!snippet.includes('alert(1)'));
  assert.ok(!snippet.includes('color:red'));
  assert.ok(!snippet.includes('eyJhbGci'));
  assert.ok(!snippet.includes('sk-abcdef'));
  assert.match(snippet, /\[REDACTED\]/);
});

test('extractHtmlTitle, sanitizeUrlForDiagnostics, and formatDiagnosticsReport work reliably', () => {
  assert.equal(extractHtmlTitle('<TITLE>  Cloud Run 502  </TITLE>'), 'Cloud Run 502');
  assert.equal(
    sanitizeUrlForDiagnostics('/api/saga/ai-layout?foo=bar#baz'),
    '/api/saga/ai-layout?[redacted]'
  );

  const report = formatDiagnosticsReport({
    category: 'proxy-interstitial',
    requestUrl: '/api/saga/ai-layout',
    finalUrl: 'https://demo.run.app/api/saga/ai-layout',
    redirected: false,
    status: 200,
    statusText: 'OK',
    contentType: 'text/html',
    pageTitle: 'Loading Preview',
    bodySnippet: 'Starting container...',
    timestamp: '2026-11-28T00:00:00.000Z',
  });
  assert.match(report, /Category: proxy-interstitial/);
  assert.match(report, /HTML Title: Loading Preview/);
});

test('diagnoseNonJsonAiResponse detects AI Studio / Cloud Run Starting Server splash page', () => {
  const html =
    '<!DOCTYPE html><html><head><title>Starting Server...</title></head><body><h1>Starting Server...</h1><p>Please wait while your application starts...</p><button>Reload now</button></body></html>';
  assert.equal(isServerStartingHtmlResponse(html), true);

  const res = diagnoseNonJsonAiResponse(
    {
      requestUrl: '/api/saga/ai-layout',
      finalUrl: 'https://ais-dev-example.run.app/api/saga/ai-layout',
      redirected: false,
      status: 200,
      statusText: 'OK',
      contentType: 'text/html',
      rawBody: html,
      currentOrigin: 'https://ais-dev-example.run.app',
    },
    'zh-TW'
  );
  assert.equal(res.details.category, 'server-starting');
  assert.equal(res.details.pageTitle, 'Starting Server...');
  assert.match(res.message, /Starting Server/);
});
