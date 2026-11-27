import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  isAllowedDesignerUrl,
  isValidHostMessage,
} from './hostBridge';
import { buildZipArchive, computeCrc32 } from './zipBuilder';
import {
  buildExtensionPackageJson,
  buildVsCodeExtensionFiles,
  buildVsCodeExtensionZip,
  buildWebExtensionBundleJs,
} from './vscodeExtensionGenerator';

test('hostBridge validates allowed designer URLs and host message schemas strictly', () => {
  assert.equal(isAllowedDesignerUrl('https://designer.example.com'), true);
  assert.equal(isAllowedDesignerUrl('http://localhost:3000'), true);
  assert.equal(isAllowedDesignerUrl('http://127.0.0.1:8080'), true);
  assert.equal(isAllowedDesignerUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedDesignerUrl('http://evil.example.com'), false);
  assert.equal(isAllowedDesignerUrl('data:text/html,<script>'), false);

  assert.equal(
    isValidHostMessage({
      type: 'host:loadDocument',
      uri: 'file:///demo.saga.yaml',
      fileName: 'demo.saga.yaml',
      format: 'yaml',
      content: 'Name: demo',
    }),
    true
  );
  assert.equal(isValidHostMessage({ type: 'host:themeChanged', theme: 'dark' }), true);
  assert.equal(isValidHostMessage({ type: 'host:loadDocument', format: 'xml' }), false);
  assert.equal(isValidHostMessage(null), false);
});

test('zipBuilder produces valid PKZIP archive with IEEE CRC-32 checksums', () => {
  // Standard CRC-32 test vector: "123456789" -> 0xcbf43926
  const crc = computeCrc32(new TextEncoder().encode('123456789'));
  assert.equal(crc, 0xcbf43926);

  const zip = buildZipArchive([
    { path: 'hello/world.txt', content: 'Seata Saga' },
    { path: 'hello/data.json', content: '{"ok":true}' },
  ]);

  // Local file header signature PK\x03\x04
  assert.equal(zip[0], 0x50);
  assert.equal(zip[1], 0x4b);
  assert.equal(zip[2], 0x03);
  assert.equal(zip[3], 0x04);

  // End of Central Directory signature PK\x05\x06 at tail - 22
  const eocdOffset = zip.length - 22;
  assert.equal(zip[eocdOffset], 0x50);
  assert.equal(zip[eocdOffset + 1], 0x4b);
  assert.equal(zip[eocdOffset + 2], 0x05);
  assert.equal(zip[eocdOffset + 3], 0x06);

  // Entry count in EOCD = 2
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(view.getUint16(eocdOffset + 10, true), 2);
});

test('generated VS Code Web Extension manifest and zero-dep browser bundle are valid and Node-free', () => {
  const opts = {
    designerUrl: 'https://seata-designer.example.com',
    defaultFormat: 'yaml' as const,
  };

  const pkg = JSON.parse(buildExtensionPackageJson(opts));
  assert.equal(pkg.browser, './dist/web/extension.js');
  assert.equal(pkg.main, './dist/web/extension.js');
  assert.ok(Array.isArray(pkg.contributes.customEditors));
  assert.equal(
    pkg.contributes.configuration.properties['seataSaga.designerUrl'].default,
    'https://seata-designer.example.com'
  );

  const bundleJs = buildWebExtensionBundleJs(opts);
  // Must NOT import Node-only modules (breaks vscode.dev browser WebWorker)
  assert.equal(/require\(['"](fs|path|child_process|os)['"]\)/.test(bundleJs), false);

  // Verify generated JS parses cleanly and exports activate/deactivate under mocked vscode API
  const script = new vm.Script(bundleJs, { filename: 'dist/web/extension.js' });
  const mockModule: { exports: Record<string, unknown> } = { exports: {} };
  const mockVscode = {
    window: {
      createTextEditorDecorationType: () => ({ dispose() {} }),
      registerCustomEditorProvider: () => ({ dispose() {} }),
      onDidChangeActiveColorTheme: () => ({ dispose() {} }),
      activeColorTheme: { kind: 1 },
      visibleTextEditors: [],
    },
    workspace: {
      getConfiguration: () => ({ get: (_k: string, def?: unknown) => def }),
      onDidChangeTextDocument: () => ({ dispose() {} }),
    },
    languages: {
      createDiagnosticCollection: () => ({ set() {}, delete() {}, dispose() {} }),
    },
    commands: {
      registerCommand: () => ({ dispose() {} }),
    },
    ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3 },
    ViewColumn: { Active: 1, Beside: 2 },
  };
  const sandbox = {
    module: mockModule,
    exports: mockModule.exports,
    require: (id: string) => {
      if (id === 'vscode') return mockVscode;
      throw new Error(`Unexpected require in browser bundle: ${id}`);
    },
    URL,
    TextEncoder,
    TextDecoder,
    setTimeout,
  };
  script.runInNewContext(sandbox);

  assert.equal(typeof mockModule.exports.activate, 'function');
  assert.equal(typeof mockModule.exports.deactivate, 'function');

  // Verify activate executes cleanly with a mock ExtensionContext
  const subscriptions: unknown[] = [];
  (mockModule.exports.activate as (ctx: { subscriptions: unknown[] }) => void)({
    subscriptions,
  });
  assert.ok(subscriptions.length >= 5, 'Should register diagnostics, custom editor, and commands');

  // Verify full extension zip includes package.json, dist/web/extension.js, README.md, and examples
  const files = buildVsCodeExtensionFiles(opts);
  assert.ok(files.some((f) => f.path.endsWith('package.json')));
  assert.ok(files.some((f) => f.path.endsWith('dist/web/extension.js')));
  assert.ok(files.some((f) => f.path.endsWith('examples/orderFulfillment.saga.yaml')));

  const zipBytes = buildVsCodeExtensionZip(opts);
  assert.ok(zipBytes.length > 2000);
});
