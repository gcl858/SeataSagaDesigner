import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBasePath,
  resolveRuntimeDesignerUrl,
  withBasePath,
} from './basePath';

test('normalizeBasePath strips trailing slashes and handles empty or root values', () => {
  assert.equal(normalizeBasePath(undefined), '');
  assert.equal(normalizeBasePath(''), '');
  assert.equal(normalizeBasePath('/'), '');
  assert.equal(normalizeBasePath('/SeataSagaDesigner/'), '/SeataSagaDesigner');
  assert.equal(normalizeBasePath('SeataSagaDesigner'), '/SeataSagaDesigner');
});

test('withBasePath prefixes public paths for GitHub Pages and stays idempotent', () => {
  assert.equal(
    withBasePath('/docs/images/01-overview-canvas.png', ''),
    '/docs/images/01-overview-canvas.png'
  );
  assert.equal(
    withBasePath('/docs/images/01-overview-canvas.png', '/SeataSagaDesigner'),
    '/SeataSagaDesigner/docs/images/01-overview-canvas.png'
  );
  assert.equal(
    withBasePath(
      '/SeataSagaDesigner/docs/images/01-overview-canvas.png',
      '/SeataSagaDesigner'
    ),
    '/SeataSagaDesigner/docs/images/01-overview-canvas.png'
  );
  assert.equal(withBasePath('/', '/SeataSagaDesigner'), '/SeataSagaDesigner/');
  assert.equal(withBasePath('/', ''), '/');
});

test('resolveRuntimeDesignerUrl joins origin and optional basePath cleanly', () => {
  assert.equal(
    resolveRuntimeDesignerUrl('http://localhost:3000', ''),
    'http://localhost:3000'
  );
  assert.equal(
    resolveRuntimeDesignerUrl('https://user.github.io/', '/SeataSagaDesigner/'),
    'https://user.github.io/SeataSagaDesigner'
  );
});
