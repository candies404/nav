require('./load-typescript.cjs')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { EventEmitter } = require('node:events')
const { mergeMetadata } = require('../src/lib/site-form-state.ts')
const { normalizeSiteUrl, findDuplicateSites, buildQualityItems } = require('../src/lib/site-quality.ts')
const { readAdminResponse } = require('../src/lib/admin-api-response.ts')
const health = require('../src/lib/site-health.ts')

const form = () => ({ url: 'https://example.com/', name: '', description: '', icon: '', categoryId: 'new-category' })

test('pending metadata preserves manual values, deliberately cleared fields and a newly selected category', () => {
  const current = { ...form(), name: '我的名称', description: '', categoryId: 'manual-category' }
  const next = mergeMetadata(current, current.url, { title: 'Fetched', description: 'Fetched description', icon: '/icon.svg' }, new Set(['name', 'description']), {})
  assert.equal(next.name, '我的名称')
  assert.equal(next.description, '')
  assert.equal(next.icon, '/icon.svg')
  assert.equal(next.categoryId, 'manual-category')
})

test('a response for the previous URL cannot modify the new form', () => {
  const current = { ...form(), url: 'https://new.example/' }
  assert.equal(mergeMetadata(current, 'https://old.example/', { title: 'Old' }, new Set(), {}), current)
})

test('automatic fields can follow a changed URL; saved or manually edited values remain intact', () => {
  const current = { ...form(), name: 'Automatic A', description: 'Saved description' }
  const next = mergeMetadata(current, current.url, { title: 'Automatic B', description: 'New description' }, new Set(), { name: 'Automatic A' })
  assert.equal(next.name, 'Automatic B')
  assert.equal(next.description, 'Saved description')
  assert.equal(mergeMetadata(current, current.url, { title: 'B' }, new Set(['name']), { name: 'Automatic A' }).name, 'Automatic A')
})

test('save errors retain the server reason; expired sign-in produces a recoverable message', async () => {
  await assert.rejects(readAdminResponse(new Response(JSON.stringify({ error: '分类已被删除' }), { status: 409 }), '保存失败'), /分类已被删除/)
  await assert.rejects(readAdminResponse(new Response('Unauthorized', { status: 401 }), '保存失败'), /当前填写内容已保留/)
})

const data = { navigationItems: [
  { id: 'a', title: '分类 A', items: [{ id: 'one', title: '网站', href: 'https://example.com/path', enabled: true, description: 'Visit example.com' }] },
  { id: 'b', title: '分类 B', subCategories: [{ id: 'sub', title: '子分类', items: [{ id: 'two', title: '复用网站', href: 'https://example.com/path/#section', enabled: true, description: '完整描述', icon: '/icon.svg' }] }] },
] }

test('duplicate suggestions span categories and exclude the site being edited', () => {
  const matches = findDuplicateSites(data, 'https://EXAMPLE.com/path/', 'one')
  assert.equal(matches.length, 1)
  assert.equal(matches[0].categoryPath, '分类 B / 子分类')
  assert.equal(data.navigationItems.length, 2)
  assert.notEqual(normalizeSiteUrl('https://example.com/?q=a'), normalizeSiteUrl('https://example.com/?q=b'))
  assert.notEqual(normalizeSiteUrl('http://example.com/'), normalizeSiteUrl('https://example.com/'))
  assert.equal(normalizeSiteUrl('https://example.com/?b=2&a=1#x'), normalizeSiteUrl('https://example.com/?a=1&b=2'))
})

test('quality queue detects missing information, duplicates and stale or mismatched checks', () => {
  const now = Date.parse('2026-09-15T08:00:00Z')
  const items = buildQualityItems(data, {
    one: { href: 'https://previous.example/', state: 'broken', reason: '404', checkedAt: '2026-09-15T08:00:00Z' },
    two: { href: data.navigationItems[1].subCategories[0].items[0].href, state: 'ok', reason: 'OK', checkedAt: '2026-09-01T08:00:00Z' },
  }, now)
  assert.deepEqual(items[0].issues, ['missing-icon', 'missing-description', 'duplicate', 'unchecked'])
  assert.equal(items[0].health, undefined)
  assert.deepEqual(items[1].issues, ['duplicate', 'unchecked'])
})

test('link checks do not classify authentication and rate limits as dead pages', () => {
  assert.equal(health.classifyHttpStatus(404).state, 'broken')
  assert.equal(health.classifyHttpStatus(410).state, 'broken')
  for (const status of [401, 403, 429, 500]) assert.equal(health.classifyHttpStatus(status).state, 'review')
  assert.equal(health.classifyHttpStatus(204).state, 'ok')
})

test('private, loopback, reserved and mapped addresses are never probed', async () => {
  assert.equal((await health.checkSiteLink('not-a-url')).state, 'broken')
  assert.equal((await health.checkSiteLink('ftp://example.com/file')).state, 'broken')
  for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::ffff:127.0.0.1', 'fc00::1', '2002:7f00:1::']) assert.equal(health.isPublicAddress(address), false, address)
  assert.equal(health.isPublicAddress('93.184.216.34'), true)
  assert.equal(health.isPublicAddress('2606:4700:4700::1111'), true)
  for (const url of ['http://2130706433/', 'http://[::ffff:127.0.0.1]/', 'http://user:pass@example.com/']) {
    assert.equal((await health.checkSiteLink(url)).state, 'review')
  }
})

test('HTTP probing handles HEAD fallback and revalidates redirected destinations', async context => {
  const dns = require('node:dns/promises')
  const http = require('node:http')
  const requests = []
  let response = { statusCode: 405 }
  context.mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }])
  context.mock.method(http, 'request', (url, options, callback) => {
    requests.push({ url: url.href, method: options.method })
    options.lookup(url.hostname, {}, (error, address, family) => { assert.equal(address, '93.184.216.34'); assert.equal(family, 4) })
    options.lookup(url.hostname, { all: true }, (error, addresses) => assert.equal(addresses[0].address, '93.184.216.34'))
    const req = new EventEmitter()
    req.end = () => queueMicrotask(() => callback({ statusCode: options.method === 'GET' ? 200 : response.statusCode, headers: { location: response.location }, destroy() {} }))
    return req
  })
  assert.equal((await health.checkSiteLink('http://example.com/')).state, 'ok')
  assert.deepEqual(requests.map(item => item.method), ['HEAD', 'GET'])
  requests.length = 0
  response = { statusCode: 302, location: 'http://127.0.0.1/private' }
  assert.equal((await health.checkSiteLink('http://example.com/')).state, 'review')
  assert.equal(requests.length, 1)
  response = { statusCode: 404 }
  assert.equal((await health.checkSiteLink('http://example.com/')).state, 'broken')
})
