import { isAllowedDesignerUrl } from './hostBridge';
import { buildZipArchive, ZipEntryInput } from './zipBuilder';

export interface VsCodeExtensionOptions {
  designerUrl: string;
  defaultFormat?: 'yaml' | 'json';
  extensionVersion?: string;
}

export function normalizeDesignerUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (isAllowedDesignerUrl(trimmed)) {
    return trimmed;
  }
  return 'http://localhost:3000';
}

export function buildExtensionPackageJson(
  options: VsCodeExtensionOptions
): string {
  const designerUrl = normalizeDesignerUrl(options.designerUrl);
  const defaultFormat = options.defaultFormat ?? 'yaml';
  const version = options.extensionVersion ?? '1.0.0';

  const manifest = {
    name: 'seata-saga-designer',
    displayName: 'Apache Seata Saga State Machine Designer',
    description:
      'Visual BPMN-style designer, YAML/JSON comment-preserving editor, multi-level SubStateMachine drill-down, and Saga compensation simulator for VS Code Desktop and VS Code for the Web (vscode.dev / github.dev).',
    version,
    publisher: 'seata-saga-tools',
    license: 'Apache-2.0',
    engines: {
      vscode: '^1.85.0',
    },
    categories: ['Visualization', 'Programming Languages', 'Other'],
    keywords: [
      'seata',
      'saga',
      'state-machine',
      'distributed-transaction',
      'yaml',
      'json',
      'web-extension',
    ],
    extensionKind: ['ui', 'workspace'],
    browser: './dist/web/extension.js',
    main: './dist/web/extension.js',
    activationEvents: [
      'onCustomEditor:seataSaga.visualDesigner',
      'onCommand:seataSaga.openDesigner',
      'onCommand:seataSaga.openDesignerToSide',
      'onCommand:seataSaga.newStateMachine',
    ],
    contributes: {
      customEditors: [
        {
          viewType: 'seataSaga.visualDesigner',
          displayName: 'Seata Saga Visual Designer',
          selector: [
            { filenamePattern: '*.saga.json' },
            { filenamePattern: '*.saga.yaml' },
            { filenamePattern: '*.saga.yml' },
            { filenamePattern: '*.statemachine.json' },
            { filenamePattern: '*.statemachine.yaml' },
            { filenamePattern: '*.statemachine.yml' },
          ],
          priority: 'default',
        },
        {
          viewType: 'seataSaga.visualDesigner',
          displayName: 'Seata Saga Visual Designer',
          selector: [
            { filenamePattern: '*.json' },
            { filenamePattern: '*.yaml' },
            { filenamePattern: '*.yml' },
          ],
          priority: 'option',
        },
      ],
      commands: [
        {
          command: 'seataSaga.openDesigner',
          title: 'Seata Saga: Open Visual Designer',
          icon: '$(type-hierarchy-sub)',
        },
        {
          command: 'seataSaga.openDesignerToSide',
          title: 'Seata Saga: Open Visual Designer to the Side',
          icon: '$(split-horizontal)',
        },
        {
          command: 'seataSaga.newStateMachine',
          title: 'Seata Saga: New State Machine (JSON / YAML)',
          icon: '$(new-file)',
        },
      ],
      menus: {
        'editor/title': [
          {
            command: 'seataSaga.openDesignerToSide',
            when: 'resourceExtname == .json || resourceExtname == .yaml || resourceExtname == .yml',
            group: 'navigation',
          },
        ],
        'explorer/context': [
          {
            command: 'seataSaga.openDesigner',
            when: 'resourceExtname == .json || resourceExtname == .yaml || resourceExtname == .yml',
            group: 'navigation',
          },
        ],
      },
      configuration: {
        title: 'Seata Saga Designer',
        properties: {
          'seataSaga.designerUrl': {
            type: 'string',
            default: designerUrl,
            description:
              'HTTPS or localhost URL hosting the Seata Saga Designer web app (loaded with ?embed=vscode inside the Webview).',
          },
          'seataSaga.defaultFormat': {
            type: 'string',
            enum: ['yaml', 'json'],
            default: defaultFormat,
            description:
              'Default format used when creating new Seata Saga state machines or auto-scaffolding SubStateMachine files.',
          },
          'seataSaga.syncDiagnostics': {
            type: 'boolean',
            default: true,
            description:
              'Publish Seata Saga structural validation errors and warnings directly to the VS Code Problems panel.',
          },
          'seataSaga.autoScanSubMachines': {
            type: 'boolean',
            default: true,
            description:
              'Automatically scan workspace *.json/*.yaml files using vscode.workspace.fs to resolve SubStateMachine drill-down references.',
          },
        },
      },
    },
    scripts: {
      'test:web': 'npx @vscode/test-web --browserType=chromium --extensionDevelopmentPath=.',
      'package:vsix': 'npx @vscode/vsce package --target web',
      'typecheck': 'tsc --noEmit',
    },
    devDependencies: {
      '@types/vscode': '^1.85.0',
      typescript: '^5.7.0',
    },
  };

  return JSON.stringify(manifest, null, 2) + '\n';
}

/**
 * Generates the zero-dependency, browser-safe CommonJS bundle for VS Code Web Extension Host
 * (`dist/web/extension.js`). Uses ONLY `vscode` APIs + Web Standard `TextEncoder`/`TextDecoder`
 * so it runs identically in vscode.dev, github.dev, Codespaces, and VS Code Desktop with ZERO build step.
 */
export function buildWebExtensionBundleJs(
  options: VsCodeExtensionOptions
): string {
  const defaultDesignerUrl = normalizeDesignerUrl(options.designerUrl);

  return `// Apache Seata Saga State Machine Designer - Universal VS Code Web & Desktop Extension
// Compatible with vscode.dev, github.dev, GitHub Codespaces, and VS Code Desktop.
// Uses only browser-safe vscode.workspace.fs APIs (no Node.js fs/path dependencies).
'use strict';

const vscode = require('vscode');

const VIEW_TYPE = 'seataSaga.visualDesigner';
const DEFAULT_DESIGNER_URL = ${JSON.stringify(defaultDesignerUrl)};
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

/** @param {string} rawUrl */
function isAllowedDesignerUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:') return true;
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** @param {string} filePath */
function detectFormatFromPath(filePath) {
  const lower = String(filePath || '').toLowerCase();
  return lower.endsWith('.yaml') || lower.endsWith('.yml') ? 'yaml' : 'json';
}

/** @param {string} filePath */
function getBaseFileName(filePath) {
  const parts = String(filePath || '').split(/[\\\\/]/);
  return parts[parts.length - 1] || 'statemachine.saga.yaml';
}

function getCurrentVsCodeTheme() {
  const kind = vscode.window.activeColorTheme.kind;
  return kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast
    ? 'dark'
    : 'light';
}

function getCurrentLocale() {
  const lang = String(vscode.env.language || '').toLowerCase();
  return lang.startsWith('zh') ? 'zh-TW' : 'en';
}

function getConfiguredDesignerUrl() {
  const config = vscode.workspace.getConfiguration('seataSaga');
  const configured = String(config.get('designerUrl') || DEFAULT_DESIGNER_URL).trim().replace(/\\/+$/, '');
  return isAllowedDesignerUrl(configured) ? configured : DEFAULT_DESIGNER_URL;
}

/**
 * Extract top-level Seata State Machine Name from JSON or YAML without heavy dependencies.
 * @param {string} content
 * @param {'json' | 'yaml'} format
 */
function extractStateMachineName(content, format) {
  if (format === 'json') {
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed.Name === 'string' && parsed.States && typeof parsed.States === 'object') {
        return parsed.Name.trim();
      }
    } catch {
      return null;
    }
    return null;
  }
  const hasStates = /^States\\s*:/m.test(content);
  if (!hasStates) return null;
  const nameMatch = content.match(/^Name\\s*:\\s*['"]?([^'"\\r\\n#]+?)['"]?\\s*(?:#.*)?$/m);
  return nameMatch ? nameMatch[1].trim() : null;
}

/**
 * Scan workspace using browser-safe vscode.workspace.findFiles + vscode.workspace.fs
 * to automatically discover sibling SubStateMachine definitions.
 * @param {string} excludeUriString
 */
async function scanWorkspaceSubMachines(excludeUriString) {
  const config = vscode.workspace.getConfiguration('seataSaga');
  if (!config.get('autoScanSubMachines', true)) {
    return [];
  }

  const subMachines = [];
  try {
    const uris = await vscode.workspace.findFiles(
      '**/*.{json,yaml,yml}',
      '**/{node_modules,.git,dist,build,.next}/**',
      80
    );

    for (const uri of uris) {
      if (uri.toString() === excludeUriString) continue;
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.size > 512 * 1024) continue;
        const rawBytes = await vscode.workspace.fs.readFile(uri);
        const content = decoder.decode(rawBytes);
        const format = detectFormatFromPath(uri.path);
        const name = extractStateMachineName(content, format);
        if (name) {
          subMachines.push({
            name,
            format,
            content,
            uri: uri.toString(),
          });
        }
      } catch {
        // Ignore unreadable workspace files
      }
    }
  } catch {
    // Workspace may be empty in single-file mode
  }
  return subMachines;
}

/**
 * Build CSP-hardened Webview HTML that embeds the hosted Seata Saga Designer
 * and relays messages strictly for the verified designer origin.
 * @param {string} designerUrl
 * @param {'light' | 'dark'} theme
 * @param {'zh-TW' | 'en'} locale
 */
function buildWebviewHtml(designerUrl, theme, locale) {
  const origin = new URL(designerUrl).origin;
  const iframeSrc = \`\${designerUrl}/?embed=vscode&theme=\${encodeURIComponent(theme)}&locale=\${encodeURIComponent(locale)}\`;
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);

  return \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src \${origin}; style-src 'unsafe-inline'; script-src 'nonce-\${nonce}';" />
  <title>Seata Saga Designer</title>
  <style>
    html, body, iframe {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      border: 0;
      overflow: hidden;
      background: transparent;
    }
  </style>
</head>
<body>
  <iframe
    id="seata-designer-frame"
    src="\${iframeSrc}"
    allow="clipboard-write"
    sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups"
  ></iframe>
  <script nonce="\${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const frame = document.getElementById('seata-designer-frame');
      const expectedOrigin = \${JSON.stringify(origin)};
      const pendingHostMessages = [];
      let designerReady = false;

      window.addEventListener('message', (event) => {
        // Messages arriving from the hosted Seata Saga Designer iframe -> forward to Extension Host
        if (event.source === frame.contentWindow) {
          if (event.origin !== expectedOrigin) return;
          const data = event.data;
          if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
          if (data.type === 'designer:ready') {
            designerReady = true;
            while (pendingHostMessages.length > 0) {
              frame.contentWindow.postMessage(pendingHostMessages.shift(), expectedOrigin);
            }
          }
          vscode.postMessage(data);
          return;
        }

        // Messages arriving from VS Code Extension Host -> forward to Designer iframe
        const data = event.data;
        if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
        if (!designerReady || !frame.contentWindow) {
          pendingHostMessages.push(data);
          return;
        }
        frame.contentWindow.postMessage(data, expectedOrigin);
      });
    })();
  </script>
</body>
</html>\`;
}

/**
 * Reveal and briefly flash the selected node/edge lines in any visible VS Code TextEditor
 * showing the same document (supports side-by-side Split Editor workflow!).
 */
const flashDecoration = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  backgroundColor: 'rgba(37, 99, 235, 0.22)',
  borderWidth: '0 0 0 3px',
  borderStyle: 'solid',
  borderColor: 'rgba(37, 99, 235, 0.95)',
});

/**
 * @param {vscode.TextDocument} document
 * @param {number} startLine 1-indexed
 * @param {number} endLine 1-indexed
 */
function revealAndFlashLinesInTextEditor(document, startLine, endLine) {
  const editor = vscode.window.visibleTextEditors.find(
    (ed) => ed.document.uri.toString() === document.uri.toString()
  );
  if (!editor) return;

  const maxLine = Math.max(0, document.lineCount - 1);
  const s = Math.max(0, Math.min(maxLine, (startLine || 1) - 1));
  const e = Math.max(s, Math.min(maxLine, (endLine || startLine || 1) - 1));
  const range = new vscode.Range(s, 0, e, document.lineAt(e).text.length);

  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  editor.setDecorations(flashDecoration, [range]);
  setTimeout(() => {
    editor.setDecorations(flashDecoration, []);
  }, 1150);
}

/**
 * Attach bidirectional sync between a VS Code TextDocument and a Webview.
 * Works identically for CustomTextEditorProvider and Open-to-Side WebviewPanel.
 * @param {vscode.TextDocument} document
 * @param {vscode.Webview} webview
 * @param {vscode.DiagnosticCollection} diagnosticCollection
 */
function bindDocumentToWebview(document, webview, diagnosticCollection) {
  const disposables = [];
  const subMachineUriMap = new Map();
  let lastAppliedFromWebview = null;

  const sendFullDocument = async () => {
    const subMachines = await scanWorkspaceSubMachines(document.uri.toString());
    subMachineUriMap.clear();
    for (const sm of subMachines) {
      subMachineUriMap.set(sm.name, vscode.Uri.parse(sm.uri));
    }

    webview.postMessage({
      type: 'host:loadDocument',
      uri: document.uri.toString(),
      fileName: getBaseFileName(document.uri.path),
      format: detectFormatFromPath(document.uri.path),
      content: document.getText(),
      theme: getCurrentVsCodeTheme(),
      locale: getCurrentLocale(),
      subMachines,
    });
  };

  disposables.push(
    webview.onDidReceiveMessage(async (msg) => {
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'designer:ready') {
        await sendFullDocument();
        return;
      }

      if (msg.type === 'designer:updateDocument' && typeof msg.content === 'string') {
        if (document.getText() === msg.content) return;
        lastAppliedFromWebview = msg.content;
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );
        edit.replace(document.uri, fullRange, msg.content);
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === 'designer:updateSubMachine' && typeof msg.machineName === 'string' && typeof msg.content === 'string') {
        const existingUri = subMachineUriMap.get(msg.machineName);
        if (existingUri) {
          await vscode.workspace.fs.writeFile(existingUri, encoder.encode(msg.content));
        } else if (msg.created) {
          // Create sibling file beside parent document using browser-safe URI manipulation
          const parentPath = document.uri.path;
          const dirPath = parentPath.slice(0, Math.max(0, parentPath.lastIndexOf('/')));
          const ext = msg.format === 'yaml' ? 'saga.yaml' : 'saga.json';
          const safeName = msg.machineName.replace(/[^a-zA-Z0-9_.-]/g, '_');
          const targetUri = document.uri.with({ path: \`\${dirPath}/\${safeName}.\${ext}\` });
          await vscode.workspace.fs.writeFile(targetUri, encoder.encode(msg.content));
          subMachineUriMap.set(msg.machineName, targetUri);
        }
        return;
      }

      if (msg.type === 'designer:diagnostics' && Array.isArray(msg.diagnostics)) {
        const syncEnabled = vscode.workspace
          .getConfiguration('seataSaga')
          .get('syncDiagnostics', true);
        if (!syncEnabled) {
          diagnosticCollection.delete(document.uri);
          return;
        }
        const maxLine = Math.max(0, document.lineCount - 1);
        const mapped = msg.diagnostics.map((item) => {
          const s = Math.max(0, Math.min(maxLine, (Number(item.startLine) || 1) - 1));
          const e = Math.max(s, Math.min(maxLine, (Number(item.endLine) || s + 1) - 1));
          const range = new vscode.Range(s, 0, e, document.lineAt(e).text.length);
          const severity =
            item.severity === 'error'
              ? vscode.DiagnosticSeverity.Error
              : vscode.DiagnosticSeverity.Warning;
          const diag = new vscode.Diagnostic(range, String(item.message || ''), severity);
          diag.source = 'Seata Saga';
          diag.code = String(item.code || 'SAGA');
          return diag;
        });
        diagnosticCollection.set(document.uri, mapped);
        return;
      }

      if (msg.type === 'designer:revealSource') {
        revealAndFlashLinesInTextEditor(document, Number(msg.startLine), Number(msg.endLine));
        return;
      }

      if (msg.type === 'designer:exportFile' && typeof msg.content === 'string') {
        const defaultName = String(msg.fileName || 'statemachine.saga.yaml');
        const parentPath = document.uri.path;
        const dirPath = parentPath.slice(0, Math.max(0, parentPath.lastIndexOf('/')));
        const defaultUri = document.uri.with({ path: \`\${dirPath}/\${defaultName}\` });
        const target = await vscode.window.showSaveDialog({ defaultUri });
        if (target) {
          await vscode.workspace.fs.writeFile(target, encoder.encode(msg.content));
          vscode.window.showInformationMessage(\`Seata Saga: Exported \${getBaseFileName(target.path)}\`);
        }
        return;
      }

      if (msg.type === 'designer:notify' && typeof msg.message === 'string') {
        if (msg.level === 'error') vscode.window.showErrorMessage(msg.message);
        else if (msg.level === 'warning') vscode.window.showWarningMessage(msg.message);
        else vscode.window.showInformationMessage(msg.message);
      }
    })
  );

  disposables.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() !== document.uri.toString()) return;
      if (event.contentChanges.length === 0) return;
      const currentText = document.getText();
      if (currentText === lastAppliedFromWebview) {
        lastAppliedFromWebview = null;
        return;
      }
      sendFullDocument();
    })
  );

  disposables.push(
    vscode.window.onDidChangeActiveColorTheme(() => {
      webview.postMessage({
        type: 'host:themeChanged',
        theme: getCurrentVsCodeTheme(),
      });
    })
  );

  return {
    dispose: () => {
      diagnosticCollection.delete(document.uri);
      for (const d of disposables) d.dispose();
    },
  };
}

class SeataSagaCustomEditorProvider {
  /** @param {vscode.DiagnosticCollection} diagnosticCollection */
  constructor(diagnosticCollection) {
    this.diagnosticCollection = diagnosticCollection;
  }

  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.WebviewPanel} webviewPanel
   */
  async resolveCustomTextEditor(document, webviewPanel) {
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = buildWebviewHtml(
      getConfiguredDesignerUrl(),
      getCurrentVsCodeTheme(),
      getCurrentLocale()
    );
    const binding = bindDocumentToWebview(
      document,
      webviewPanel.webview,
      this.diagnosticCollection
    );
    webviewPanel.onDidDispose(() => binding.dispose());
  }
}

/** @param {vscode.ExtensionContext} context */
function activate(context) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('seata-saga');
  context.subscriptions.push(diagnosticCollection);

  const provider = new SeataSagaCustomEditorProvider(diagnosticCollection);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    })
  );

  const openPanelForUri = async (uri, viewColumn) => {
    const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
    if (!targetUri) {
      vscode.window.showWarningMessage('Open a Seata Saga JSON or YAML file first.');
      return;
    }
    const doc = await vscode.workspace.openTextDocument(targetUri);
    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      \`Saga: \${getBaseFileName(doc.uri.path)}\`,
      viewColumn,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    panel.webview.html = buildWebviewHtml(
      getConfiguredDesignerUrl(),
      getCurrentVsCodeTheme(),
      getCurrentLocale()
    );
    const binding = bindDocumentToWebview(doc, panel.webview, diagnosticCollection);
    panel.onDidDispose(() => binding.dispose());
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('seataSaga.openDesigner', (uri) =>
      openPanelForUri(uri, vscode.ViewColumn.Active)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('seataSaga.openDesignerToSide', (uri) =>
      openPanelForUri(uri, vscode.ViewColumn.Beside)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('seataSaga.newStateMachine', async () => {
      const config = vscode.workspace.getConfiguration('seataSaga');
      const defaultFmt = config.get('defaultFormat', 'yaml');
      const picked = await vscode.window.showQuickPick(
        [
          { label: 'YAML (.saga.yaml)', format: 'yaml' },
          { label: 'JSON (.saga.json)', format: 'json' },
        ],
        {
          placeHolder: \`Select Seata Saga format (default: \${defaultFmt.toUpperCase()})\`,
        }
      );
      if (!picked) return;
      const format = picked.format;
      const starter =
        format === 'yaml'
          ? \`# Apache Seata Saga State Machine\\nName: customSagaWorkflow\\nComment: Created from VS Code Seata Saga Designer\\nStartState: FirstServiceTask\\nVersion: 0.0.1\\nType: STATE_LANG\\nPersist: true\\nStates:\\n  FirstServiceTask:\\n    Type: ServiceTask\\n    ServiceName: demoService\\n    ServiceMethod: execute\\n    ServiceType: SpringBean\\n    Next: Succeed\\n  Succeed:\\n    Type: Succeed\\n\`
          : JSON.stringify(
              {
                Name: 'customSagaWorkflow',
                Comment: 'Created from VS Code Seata Saga Designer',
                StartState: 'FirstServiceTask',
                Version: '0.0.1',
                Type: 'STATE_LANG',
                Persist: true,
                States: {
                  FirstServiceTask: {
                    Type: 'ServiceTask',
                    ServiceName: 'demoService',
                    ServiceMethod: 'execute',
                    ServiceType: 'SpringBean',
                    Next: 'Succeed',
                  },
                  Succeed: { Type: 'Succeed' },
                },
              },
              null,
              2
            );

      const doc = await vscode.workspace.openTextDocument({
        language: format,
        content: starter,
      });
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
      await openPanelForUri(doc.uri, vscode.ViewColumn.Beside);
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
`;
}

export function buildExtensionReadmeMd(options: VsCodeExtensionOptions): string {
  const designerUrl = normalizeDesignerUrl(options.designerUrl);

  return `# Apache Seata Saga State Machine Designer — VS Code Web & Desktop Extension

一套同時支援 **瀏覽器版 VS Code (\`vscode.dev\` / \`github.dev\` / GitHub Codespaces)** 與 **桌面版 VS Code** 的通用擴充套件。

## 核心能力

- **瀏覽器原生相容（Zero Node.js Dependencies）**：宣告 \`"browser": "./dist/web/extension.js"\`，全程使用 \`vscode.workspace.fs\` 與 Webview API，不依賴本機 Node \`fs\`，可直接在瀏覽器 Web Worker 中執行。
- **Custom Editor 與雙欄並排同步**：開啟 \`*.saga.json\` / \`*.saga.yaml\` / \`*.statemachine.*\` 自動以視覺化畫布開啟；點擊任意 JSON/YAML 檔案右上角分割圖示即可在右側同步檢視畫布，點擊節點還會即時定位並閃爍 VS Code 原始碼對應行號。
- **多層 SubStateMachine 工作區掃描**：自動掃描工作區內的 Seata Saga 檔案，雙擊 \`SubStateMachine\` 節點即可直接鑽取檢視或於同目錄建立子狀態機檔案。
- **Problems 面板即時驗證**：將 Seata Saga 語法與拓樸驗證結果直接回報至 VS Code「問題（Problems）」面板並標示行號波浪底線。
- **自動跟隨 VS Code 主題與語系**：即時同步 Dark/Light 主題與繁中/英文介面，保留 YAML \`#\` 註解並支援原生 \`Ctrl+S\` / \`Ctrl+Z\` / Git Diff。

---

## 快速啟動方式

### 方式一：直接在瀏覽器版 VS Code 測試（免編譯）

在解壓縮後的資料夾執行：

\`\`\`bash
npx @vscode/test-web --browserType=chromium --extensionDevelopmentPath=.
\`\`\`

指令會直接開啟瀏覽器版 VS Code，立即使用本擴充套件！

### 方式二：安裝至 \`vscode.dev\` / \`github.dev\`

1. 使用支援 CORS 的靜態伺服器啟動本資料夾（例如 \`npx serve --cors .\`，記下 HTTPS 或 localhost 位址）。
2. 在瀏覽器開啟 \`https://vscode.dev\`。
3. 按下 \`F1\`（或 \`Ctrl+Shift+P\`）執行 **\`Developer: Install Web Extension...\`**，貼上該位址即可載入！

### 方式三：打包成 \`.vsix\` 並安裝到桌面版 VS Code / 發佈至 Marketplace

\`\`\`bash
npx @vscode/vsce package --target web
code --install-extension seata-saga-designer-1.0.0.vsix
\`\`\`

---

## 設定項 (\`settings.json\`)

\`\`\`json
{
  "seataSaga.designerUrl": "${designerUrl}",
  "seataSaga.defaultFormat": "${options.defaultFormat ?? 'yaml'}",
  "seataSaga.syncDiagnostics": true,
  "seataSaga.autoScanSubMachines": true
}
\`\`\`
`;
}

export function buildVsCodeExtensionFiles(
  options: VsCodeExtensionOptions
): ZipEntryInput[] {
  const folder = 'seata-saga-vscode-web';
  return [
    {
      path: `${folder}/package.json`,
      content: buildExtensionPackageJson(options),
    },
    {
      path: `${folder}/dist/web/extension.js`,
      content: buildWebExtensionBundleJs(options),
    },
    {
      path: `${folder}/README.md`,
      content: buildExtensionReadmeMd(options),
    },
    {
      path: `${folder}/.vscodeignore`,
      content: '.vscode/**\nnode_modules/**\n*.vsix\n',
    },
    {
      path: `${folder}/examples/orderFulfillment.saga.yaml`,
      content: `# Apache Seata Saga 範例（可用 Seata Saga Visual Designer 開啟）
Name: orderFulfillmentSaga
Comment: Order fulfillment demo with SubStateMachine
StartState: CreateOrder
Version: 1.2.0
Type: STATE_LANG
Persist: true
States:
  CreateOrder:
    Type: ServiceTask
    ServiceName: orderService
    ServiceMethod: create
    ServiceType: SpringBean
    CompensateState: CancelOrder
    Next: PaymentSubMachine
  CancelOrder:
    Type: ServiceTask
    ServiceName: orderService
    ServiceMethod: cancel
    ServiceType: SpringBean
    IsForCompensation: true
  PaymentSubMachine:
    Type: SubStateMachine
    StateMachineName: paymentSettlementSubSaga
    Next: OrderSucceed
  OrderSucceed:
    Type: Succeed
`,
    },
    {
      path: `${folder}/examples/paymentSettlementSubSaga.saga.yaml`,
      content: `# 子狀態機範例：在父畫布雙擊 PaymentSubMachine 即可自動載入
Name: paymentSettlementSubSaga
Comment: Payment settlement sub-state machine
StartState: FreezePaymentChannel
Version: 1.2.0
Type: STATE_LANG
Persist: true
States:
  FreezePaymentChannel:
    Type: ServiceTask
    ServiceName: paymentGatewayService
    ServiceMethod: freezeFunds
    ServiceType: SpringBean
    Next: PaymentSucceed
  PaymentSucceed:
    Type: Succeed
`,
    },
  ];
}

export function buildVsCodeExtensionZip(
  options: VsCodeExtensionOptions
): Uint8Array {
  return buildZipArchive(buildVsCodeExtensionFiles(options));
}
