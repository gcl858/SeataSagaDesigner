import { SourceFormat } from '@/components/designer/JsonEditorPanel';
import { Locale } from './i18n';

export type HostRuntimeMode = 'standalone' | 'vscode-webview' | 'vscode-iframe';

export interface HostSubMachinePayload {
  name: string;
  format: SourceFormat;
  content: string;
  uri?: string;
}

export interface HostDiagnosticItem {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  startLine: number;
  endLine: number;
}

export type HostToDesignerMessage =
  | {
      type: 'host:loadDocument';
      uri: string;
      fileName: string;
      format: SourceFormat;
      content: string;
      theme?: 'light' | 'dark';
      locale?: Locale;
      subMachines?: HostSubMachinePayload[];
    }
  | {
      type: 'host:themeChanged';
      theme: 'light' | 'dark';
    }
  | {
      type: 'host:localeChanged';
      locale: Locale;
    };

export type DesignerToHostMessage =
  | {
      type: 'designer:ready';
    }
  | {
      type: 'designer:updateDocument';
      content: string;
      format: SourceFormat;
      machineName: string;
    }
  | {
      type: 'designer:updateSubMachine';
      machineName: string;
      content: string;
      format: SourceFormat;
      created?: boolean;
    }
  | {
      type: 'designer:diagnostics';
      diagnostics: HostDiagnosticItem[];
    }
  | {
      type: 'designer:revealSource';
      startLine: number;
      endLine: number;
      label: string;
    }
  | {
      type: 'designer:exportFile';
      fileName: string;
      content: string;
      mimeType: string;
    }
  | {
      type: 'designer:notify';
      level: 'info' | 'warning' | 'error';
      message: string;
    };

export interface VsCodeWebviewApi {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeWebviewApi;
  }
}

export function isAllowedDesignerUrl(rawUrl: string): boolean {
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

export function detectHostRuntimeMode(): HostRuntimeMode {
  if (typeof window === 'undefined') return 'standalone';
  if (typeof window.acquireVsCodeApi === 'function') {
    return 'vscode-webview';
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get('embed') === 'vscode' && window.parent !== window) {
    return 'vscode-iframe';
  }
  return 'standalone';
}

export function parseInitialEmbedParams(): {
  theme?: 'light' | 'dark';
  locale?: Locale;
} {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const rawTheme = params.get('theme');
  const rawLocale = params.get('locale');
  return {
    theme:
      rawTheme === 'dark' || rawTheme === 'light' ? rawTheme : undefined,
    locale:
      rawLocale === 'zh-TW' || rawLocale === 'en' ? rawLocale : undefined,
  };
}

export function isValidHostMessage(
  raw: unknown
): raw is HostToDesignerMessage {
  if (!raw || typeof raw !== 'object') return false;
  const msg = raw as Record<string, unknown>;
  if (msg.type === 'host:loadDocument') {
    return (
      typeof msg.uri === 'string' &&
      typeof msg.fileName === 'string' &&
      (msg.format === 'json' || msg.format === 'yaml') &&
      typeof msg.content === 'string'
    );
  }
  if (msg.type === 'host:themeChanged') {
    return msg.theme === 'light' || msg.theme === 'dark';
  }
  if (msg.type === 'host:localeChanged') {
    return msg.locale === 'zh-TW' || msg.locale === 'en';
  }
  return false;
}

export interface HostBridgeClient {
  mode: HostRuntimeMode;
  isEmbedded: boolean;
  send: (msg: DesignerToHostMessage) => void;
  subscribe: (handler: (msg: HostToDesignerMessage) => void) => () => void;
}

let cachedVsCodeApi: VsCodeWebviewApi | null = null;

export function createHostBridge(): HostBridgeClient {
  const mode = detectHostRuntimeMode();
  const isEmbedded = mode !== 'standalone';

  if (mode === 'vscode-webview' && !cachedVsCodeApi && typeof window !== 'undefined' && window.acquireVsCodeApi) {
    cachedVsCodeApi = window.acquireVsCodeApi();
  }

  const send = (msg: DesignerToHostMessage) => {
    if (typeof window === 'undefined') return;
    if (mode === 'vscode-webview' && cachedVsCodeApi) {
      cachedVsCodeApi.postMessage(msg);
    } else if (mode === 'vscode-iframe' && window.parent !== window) {
      window.parent.postMessage(msg, '*');
    }
  };

  const subscribe = (handler: (msg: HostToDesignerMessage) => void) => {
    if (typeof window === 'undefined' || !isEmbedded) {
      return () => {};
    }
    const listener = (event: MessageEvent) => {
      if (isValidHostMessage(event.data)) {
        handler(event.data);
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  };

  return {
    mode,
    isEmbedded,
    send,
    subscribe,
  };
}
