'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Download,
  Languages,
  Maximize2,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from 'lucide-react';
import {
  buildDocsZipArchive,
  DocChapter,
  DocFigure,
  getDocsChapters,
  searchDocsChapters,
} from '@/lib/docs/docsCatalog';
import { Locale } from '@/lib/saga/i18n';
import ArchitectureDiagram from './ArchitectureDiagrams';

export default function DocsPortal() {
  const [locale, setLocale] = useState<Locale>('zh-TW');
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [activeSlug, setActiveSlug] = useState<string>('01-getting-started');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lightboxFigure, setLightboxFigure] = useState<DocFigure | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const isZh = locale === 'zh-TW';

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    if (!lightboxFigure) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxFigure(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxFigure]);

  const allChapters = useMemo(() => getDocsChapters(locale), [locale]);
  const filteredChapters = useMemo(
    () => searchDocsChapters(searchQuery, locale),
    [searchQuery, locale]
  );

  const activeChapter: DocChapter = useMemo(() => {
    return (
      allChapters.find((c) => c.slug === activeSlug) ?? allChapters[0]
    );
  }, [allChapters, activeSlug]);

  const activeIdx = allChapters.findIndex((c) => c.slug === activeChapter.slug);
  const prevChapter = activeIdx > 0 ? allChapters[activeIdx - 1] : null;
  const nextChapter =
    activeIdx >= 0 && activeIdx < allChapters.length - 1
      ? allChapters[activeIdx + 1]
      : null;

  const handleSelectChapter = (slug: string) => {
    setActiveSlug(slug);
    setMobileNavOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCopyCode = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleDownloadDocsZip = () => {
    const zipBytes = buildDocsZipArchive(locale);
    const copy = new Uint8Array(zipBytes.byteLength);
    copy.set(zipBytes);
    const blob = new Blob([copy.buffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seata-saga-designer-docs-${locale}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const msg = isZh
      ? '已下載完整 8 章 Markdown 說明文件包 (.zip)'
      : 'Downloaded complete 8-chapter Markdown documentation bundle (.zip)';
    setDownloadNotice(msg);
    setTimeout(() => {
      setDownloadNotice((curr) => (curr === msg ? null : curr));
    }, 2800);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Sidebar utility controls: Search + Locale + Theme */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
            <BookOpen className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
            <span>{isZh ? '完整說明手冊' : 'Documentation'}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="docs-toggle-locale"
              onClick={() =>
                setLocale((prev) => (prev === 'zh-TW' ? 'en' : 'zh-TW'))
              }
              aria-label={isZh ? 'Switch to English' : '切換至繁體中文'}
              className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{isZh ? 'EN' : '繁中'}</span>
            </button>
            <button
              type="button"
              data-testid="docs-toggle-theme"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Light mode' : 'Dark mode'}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {darkMode ? (
                <Sun className="w-3.5 h-3.5" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isZh ? '搜尋章節或關鍵字...' : 'Search chapters or topics...'
            }
            aria-label={isZh ? '搜尋說明文件' : 'Search documentation'}
            className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Chapter list */}
      <nav
        aria-label={isZh ? '文件章節目錄' : 'Documentation chapters'}
        className="flex-1 overflow-y-auto p-3 space-y-1"
      >
        {filteredChapters.length === 0 ? (
          <div className="px-3 py-6 text-center space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isZh
                ? `找不到符合「${searchQuery}」的章節。`
                : `No chapters match "${searchQuery}".`}
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
            >
              {isZh ? '清除搜尋條件' : 'Clear search'}
            </button>
          </div>
        ) : (
          filteredChapters.map((ch) => {
            const isActive = ch.slug === activeChapter.slug;
            return (
              <button
                key={ch.slug}
                type="button"
                data-testid={`docs-chapter-${ch.slug}`}
                onClick={() => handleSelectChapter(ch.slug)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors cursor-pointer flex items-start gap-2.5 ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <span className="font-mono tabular-nums text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5 shrink-0">
                  {ch.index}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-snug">
                    {ch.title}
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {ch.category}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </nav>

      {/* Bottom quick back link */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <Link
          href="/"
          className="flex items-center justify-center gap-1.5 w-full h-9 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{isZh ? '返回視覺化設計器' : 'Back to Designer'}</span>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Bar Contract: 1 row, 3 zones, gap-8, whitespace-nowrap */}
      <header className="sticky top-0 z-30 h-14 px-6 flex items-center justify-between gap-8 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label={isZh ? '開啟文件目錄' : 'Open chapter menu'}
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Menu className="w-4 h-4" />
          </button>
          <Link
            href="/"
            className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 hover:opacity-85 transition-opacity"
          >
            Seata Saga Designer
          </Link>
        </div>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav
          aria-label="Documentation primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          <Link
            href="/"
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            {isZh ? '畫布設計器' : 'Designer'}
          </Link>
          <button
            type="button"
            onClick={() => handleSelectChapter('01-getting-started')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeChapter.slug === '01-getting-started'
                ? 'text-blue-700 dark:text-blue-400 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isZh ? '快速入門' : 'Quick Start'}
          </button>
          <button
            type="button"
            onClick={() => handleSelectChapter('05-sub-state-machine')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeChapter.slug === '05-sub-state-machine'
                ? 'text-blue-700 dark:text-blue-400 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isZh ? '巢狀子狀態機' : 'Sub-Machines'}
          </button>
          <button
            type="button"
            onClick={() => handleSelectChapter('07-vscode-extension')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeChapter.slug === '07-vscode-extension'
                ? 'text-blue-700 dark:text-blue-400 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isZh ? 'VS Code 擴充' : 'VS Code Ext'}
          </button>
        </nav>

        {/* Zone 3: 1 primary CTA */}
        <button
          type="button"
          data-testid="btn-download-docs-zip"
          onClick={handleDownloadDocsZip}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isZh ? '下載完整文件 (.zip)' : 'Download Docs (.zip)'}</span>
        </button>
      </header>

      {/* Main 3-Column Documentation Layout */}
      <div className="flex-1 flex max-w-[1440px] w-full mx-auto">
        {/* Left Sidebar (Desktop) */}
        <aside className="hidden lg:block w-72 shrink-0 border-r border-slate-200 dark:border-slate-800 sticky top-14 h-[calc(100vh-3.5rem)]">
          {sidebarContent}
        </aside>

        {/* Mobile Drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="relative z-10 w-80 max-w-[85vw] bg-white dark:bg-slate-950 h-full shadow-xl flex flex-col">
              <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  {isZh ? '文件章節目錄' : 'Chapters'}
                </span>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label={isZh ? '關閉目錄' : 'Close menu'}
                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0">{sidebarContent}</div>
            </div>
          </div>
        )}

        {/* Center Article Column */}
        <main className="flex-1 min-w-0 px-6 sm:px-10 lg:px-12 py-10">
          <article className="max-w-4xl mx-auto">
            {/* Chapter Header — Clean unboxed metadata (Zero-Pill Discipline) */}
            <header className="pb-8 border-b border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">
                <span className="font-mono tabular-nums text-blue-700 dark:text-blue-400 font-semibold">
                  {isZh
                    ? `第 ${activeChapter.index} 章`
                    : `Chapter ${activeChapter.index}`}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeChapter.category}</span>
                <span aria-hidden="true">·</span>
                <span>{activeChapter.readTime}</span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight [text-wrap:balance]">
                {activeChapter.title}
              </h1>

              <p className="mt-4 text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                {activeChapter.summary}
              </p>
            </header>

            {/* Chapter Sections */}
            <div className="mt-10 space-y-12">
              {activeChapter.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-20 space-y-5"
                >
                  <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {section.heading}
                  </h2>

                  {section.paragraphs.map((para, pIdx) => (
                    <p
                      key={pIdx}
                      className="text-[15px] text-slate-700 dark:text-slate-300 leading-7 max-w-[74ch]"
                    >
                      {para}
                    </p>
                  ))}

                  {/* Numbered Steps */}
                  {section.steps && section.steps.length > 0 && (
                    <ol className="space-y-3 pt-1">
                      {section.steps.map((step, sIdx) => (
                        <li
                          key={sIdx}
                          className="flex items-start gap-3 text-[15px] text-slate-700 dark:text-slate-300 leading-relaxed"
                        >
                          <span className="font-mono tabular-nums text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 w-6 h-6 rounded-md inline-flex items-center justify-center shrink-0 mt-0.5">
                            {sIdx + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  {/* Real High-Resolution Figures with Click-to-Zoom Lightbox */}
                  {section.figures &&
                    section.figures.map((fig, fIdx) => (
                      <figure key={fIdx} className="pt-2 space-y-3">
                        <button
                          type="button"
                          onClick={() => setLightboxFigure(fig)}
                          aria-label={
                            isZh
                              ? `放大檢視圖片：${fig.alt}`
                              : `Zoom image: ${fig.alt}`
                          }
                          className="group relative block w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          <div className="relative aspect-[16/10] w-full">
                            <Image
                              src={fig.src}
                              alt={fig.alt}
                              fill
                              sizes="(max-width: 1024px) 100vw, 900px"
                              referrerPolicy="no-referrer"
                              className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.01]"
                            />
                          </div>
                          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-900/80 text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>{isZh ? '點擊放大' : 'Zoom'}</span>
                          </span>
                        </button>

                        <figcaption className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {fig.caption}
                        </figcaption>

                        {fig.annotations && fig.annotations.length > 0 && (
                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                            {fig.annotations.map((ann, aIdx) => (
                              <div key={aIdx} className="space-y-1">
                                <dt className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                  {aIdx + 1}. {ann.label}
                                </dt>
                                <dd className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                  {ann.detail}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </figure>
                    ))}

                  {/* Custom Vector Architecture Diagram */}
                  {section.diagram && (
                    <figure className="pt-2 space-y-2.5">
                      <div className="p-5 sm:p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 overflow-x-auto">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-3">
                          {section.diagram.title}
                        </div>
                        <ArchitectureDiagram
                          id={section.diagram.id}
                          locale={locale}
                        />
                      </div>
                      <figcaption className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {section.diagram.caption}
                      </figcaption>
                    </figure>
                  )}

                  {/* Reference Table */}
                  {section.table && (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left border-collapse text-xs sm:text-[13px]">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                            {section.table.headers.map((header, hIdx) => (
                              <th
                                key={hIdx}
                                className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {section.table.rows.map((row, rIdx) => (
                            <tr
                              key={rIdx}
                              className="bg-white dark:bg-slate-950 hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors"
                            >
                              {row.map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  className={`px-4 py-3 leading-relaxed align-top ${
                                    cIdx === 0
                                      ? 'font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap'
                                      : 'text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Copyable Code Block */}
                  {section.codeBlock && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950 text-slate-100">
                      <div className="px-4 py-2.5 flex items-center justify-between gap-4 bg-slate-900 border-b border-slate-800">
                        <span className="text-xs font-mono text-slate-300 truncate">
                          {section.codeBlock.title || section.codeBlock.language}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyCode(
                              `${activeChapter.slug}:${section.id}`,
                              section.codeBlock!.code
                            )
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                        >
                          {copiedKey === `${activeChapter.slug}:${section.id}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">
                                {isZh ? '已複製' : 'Copied'}
                              </span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>{isZh ? '複製' : 'Copy'}</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-4 text-xs font-mono leading-6 overflow-x-auto text-slate-100">
                        <code>{section.codeBlock.code}</code>
                      </pre>
                    </div>
                  )}

                  {/* Clean All-Around Hairline Callout (Zero thick left borders) */}
                  {section.callout && (
                    <div
                      className={`p-4 rounded-xl border text-sm space-y-1 ${
                        section.callout.kind === 'warning'
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70 text-amber-950 dark:text-amber-100'
                          : section.callout.kind === 'tip'
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70 text-emerald-950 dark:text-emerald-100'
                            : 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/70 text-blue-950 dark:text-blue-100'
                      }`}
                    >
                      <p className="text-xs font-semibold">
                        {section.callout.title}
                      </p>
                      <p className="text-xs leading-relaxed opacity-90">
                        {section.callout.body}
                      </p>
                    </div>
                  )}
                </section>
              ))}
            </div>

            {/* Previous / Next Chapter Pagination */}
            <footer className="mt-14 pt-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {prevChapter ? (
                <button
                  type="button"
                  onClick={() => handleSelectChapter(prevChapter.slug)}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 text-left transition-colors cursor-pointer group"
                >
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{isZh ? '上一章' : 'Previous'}</span>
                  </span>
                  <span className="block mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                    {prevChapter.index}. {prevChapter.title}
                  </span>
                </button>
              ) : (
                <div />
              )}

              {nextChapter ? (
                <button
                  type="button"
                  onClick={() => handleSelectChapter(nextChapter.slug)}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 text-right transition-colors cursor-pointer group"
                >
                  <span className="flex items-center justify-end gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>{isZh ? '下一章' : 'Next'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                  <span className="block mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                    {nextChapter.index}. {nextChapter.title}
                  </span>
                </button>
              ) : (
                <Link
                  href="/"
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 text-right transition-colors group"
                >
                  <span className="flex items-center justify-end gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>{isZh ? '開始實作' : 'Start Building'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                  <span className="block mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                    {isZh ? '開啟 Seata Saga 設計器' : 'Open Seata Saga Designer'}
                  </span>
                </Link>
              )}
            </footer>
          </article>
        </main>

        {/* Right On-This-Page Outline (XL+) */}
        <aside className="hidden xl:block w-60 shrink-0 px-5 py-10 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {isZh ? '本頁目錄' : 'On this page'}
            </h2>
            <ul className="space-y-2 border-l border-slate-200 dark:border-slate-800 pl-3.5">
              {activeChapter.sections.map((sec) => (
                <li key={sec.id}>
                  <a
                    href={`#${sec.id}`}
                    className="block text-xs text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 transition-colors leading-snug"
                  >
                    {sec.heading}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {/* Screenshot Zoom Lightbox Modal */}
      {lightboxFigure && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightboxFigure.alt}
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 sm:p-8"
          onClick={() => setLightboxFigure(null)}
        >
          <div
            className="relative max-w-6xl w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                {lightboxFigure.caption}
              </p>
              <button
                type="button"
                data-testid="btn-close-lightbox"
                onClick={() => setLightboxFigure(null)}
                aria-label={isZh ? '關閉圖片檢視' : 'Close image viewer'}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative aspect-[16/10] w-full bg-slate-100 dark:bg-slate-950">
              <Image
                src={lightboxFigure.src}
                alt={lightboxFigure.alt}
                fill
                sizes="100vw"
                referrerPolicy="no-referrer"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Download Notice Toast */}
      {downloadNotice && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium shadow-lg"
        >
          {downloadNotice}
        </div>
      )}
    </div>
  );
}
