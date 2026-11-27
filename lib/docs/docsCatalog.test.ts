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

test('docsCatalog ships 8 complete bilingual chapters with every referenced screenshot present on disk', () => {
  const zh = getDocsChapters('zh-TW');
  const en = getDocsChapters('en');

  assert.equal(zh.length, 8);
  assert.equal(en.length, 8);

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
  assert.ok(referencedImages.size >= 9, 'Expected at least 9 unique illustrated screenshots');
});

test('searchDocsChapters filters chapters accurately in both zh-TW and en', () => {
  const subZh = searchDocsChapters('SubStateMachine', 'zh-TW');
  assert.ok(subZh.some((c) => c.slug === '05-sub-state-machine'));

  const vscEn = searchDocsChapters('vscode.dev', 'en');
  assert.ok(vscEn.some((c) => c.slug === '07-vscode-extension'));

  const none = searchDocsChapters('zzz_no_such_topic_xyz', 'zh-TW');
  assert.equal(none.length, 0);

  const lookup = getDocsChapterBySlug('04-yaml-comments', 'zh-TW');
  assert.ok(lookup);
  assert.equal(lookup.index, '04');
});

test('buildDocsMarkdownFiles and buildDocsZipArchive emit valid Markdown docs and PKZIP archive', () => {
  const files = buildDocsMarkdownFiles('zh-TW');
  assert.equal(files.length, 9); // README.md + 8 chapters
  assert.equal(files[0].path, 'README.md');
  assert.ok(String(files[0].content).includes('01-getting-started.md'));
  assert.ok(String(files[5].content).includes('05-submachine-level2.png'));

  const zip = buildDocsZipArchive('zh-TW');
  assert.equal(zip[0], 0x50); // 'P'
  assert.equal(zip[1], 0x4b); // 'K'
  assert.equal(zip[2], 0x03);
  assert.equal(zip[3], 0x04);
  assert.ok(zip.byteLength > 10_000);
});
