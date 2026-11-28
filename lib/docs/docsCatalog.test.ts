import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildDocsMarkdownFiles,
  buildDocsZipArchive,
  getDocsChapterBySlug,
  getDocsChapters,
  searchDocsChapters,
} from './docsCatalog';

test('docsCatalog ships 9 complete bilingual chapters with every referenced screenshot present on disk', () => {
  const zh = getDocsChapters('zh-TW');
  const en = getDocsChapters('en');

  assert.equal(zh.length, 9);
  assert.equal(en.length, 9);

  const slugsZh = zh.map((c) => c.slug);
  const slugsEn = en.map((c) => c.slug);
  assert.deepEqual(slugsZh, slugsEn);

  const referencedImages = new Set<string>();
  for (const ch of zh) {
    assert.ok(ch.title.length > 0);
    assert.ok(ch.sections.length >= 2);
    for (const sec of ch.sections) {
      for (const fig of sec.figures ?? []) {
        referencedImages.add(fig.src);
        const absPath = path.join(process.cwd(), 'public', fig.src.replace(/^\//, ''));
        assert.ok(
          fs.existsSync(absPath),
          `Expected screenshot asset to exist on disk: ${absPath}`
        );
        const stat = fs.statSync(absPath);
        assert.ok(stat.size > 10_000, `Screenshot too small: ${absPath}`);
      }
    }
  }
  assert.ok(referencedImages.size >= 12, 'Expected at least 12 unique illustrated screenshots');
});

test('searchDocsChapters filters chapters accurately in both zh-TW and en', () => {
  const subZh = searchDocsChapters('SubStateMachine', 'zh-TW');
  assert.ok(subZh.some((c) => c.slug === '05-sub-state-machine'));

  const vscEn = searchDocsChapters('vscode.dev', 'en');
  assert.ok(vscEn.some((c) => c.slug === '07-vscode-extension'));

  const aiZh = searchDocsChapters('MiniMax', 'zh-TW');
  assert.ok(aiZh.some((c) => c.slug === '09-auto-layout-and-ai'));

  const anchorEn = searchDocsChapters('sourceAnchor', 'en');
  assert.ok(anchorEn.some((c) => c.slug === '09-auto-layout-and-ai'));

  const autoLayoutZh = searchDocsChapters('自動排版', 'zh-TW');
  assert.ok(autoLayoutZh.some((c) => c.slug === '09-auto-layout-and-ai'));

  const none = searchDocsChapters('zzz_no_such_topic_xyz', 'zh-TW');
  assert.equal(none.length, 0);

  const lookup = getDocsChapterBySlug('04-yaml-comments', 'zh-TW');
  assert.ok(lookup);
  assert.equal(lookup.index, '04');

  const ch09En = getDocsChapterBySlug('09-auto-layout-and-ai', 'en');
  assert.ok(ch09En);
  assert.equal(ch09En.index, '09');
});

test('buildDocsMarkdownFiles and buildDocsZipArchive emit valid Markdown docs matching /docs on disk', () => {
  const files = buildDocsMarkdownFiles('zh-TW');
  assert.equal(files.length, 10); // README.md + 9 chapters
  assert.equal(files[0].path, 'README.md');
  assert.ok(String(files[0].content).includes('01-getting-started.md'));
  assert.ok(String(files[0].content).includes('09-auto-layout-and-ai.md'));
  assert.ok(String(files[5].content).includes('05-submachine-level2.png'));
  assert.ok(String(files[9].content).includes('09-auto-layout-large-cancellation.png'));
  assert.ok(String(files[9].content).includes('09-ai-layout-modal.png'));

  for (const entry of files) {
    const diskPath = path.join(process.cwd(), 'docs', entry.path);
    assert.ok(fs.existsSync(diskPath), `Expected synced markdown file on disk: ${diskPath}`);
    const diskContent = fs.readFileSync(diskPath, 'utf8');
    assert.equal(
      diskContent,
      String(entry.content),
      `Markdown file out of sync with docsCatalog: ${entry.path}`
    );
  }

  const zip = buildDocsZipArchive('zh-TW');
  assert.equal(zip[0], 0x50); // 'P'
  assert.equal(zip[1], 0x4b); // 'K'
  assert.equal(zip[2], 0x03);
  assert.equal(zip[3], 0x04);
  assert.ok(zip.byteLength > 10_000);
});
