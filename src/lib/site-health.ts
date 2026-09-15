import { lookup } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP } from 'node:net'
import type { LinkHealth } from './site-quality'

const blocked = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(address, prefix, 'ipv4')
blocked.addSubnet('2001:db8::', 32, 'ipv6')
blocked.addSubnet('2001::', 32, 'ipv6')
blocked.addSubnet('2002::', 16, 'ipv6')
const globalIPv6 = new BlockList()
globalIPv6.addSubnet('2000::', 3, 'ipv6')

export function isPublicAddress(address: string) {
  const family = isIP(address)
  if (family === 4) return !blocked.check(address, 'ipv4')
  if (family === 6) return globalIPv6.check(address, 'ipv6') && !blocked.check(address, 'ipv6')
  return false
}

export function classifyHttpStatus(statusCode: number): Pick<LinkHealth, 'state' | 'reason'> {
  if (statusCode >= 200 && statusCode < 300) return { state: 'ok', reason: '链接可访问' }
  if (statusCode === 404 || statusCode === 410) return { state: 'broken', reason: `页面不存在（HTTP ${statusCode}）` }
  if (statusCode === 401 || statusCode === 403 || statusCode === 429) return { state: 'review', reason: `需要登录或访问受限（HTTP ${statusCode}），请人工复核` }
  return { state: 'review', reason: `服务返回 HTTP ${statusCode}，请稍后复核` }
}

type ProbeResult = { statusCode: number; location?: string }

async function probe(url: URL, method: 'HEAD' | 'GET', signal: AbortSignal): Promise<ProbeResult> {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('unsafe-url')
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await Promise.race([
      lookup(hostname, { all: true }),
      new Promise<never>((_, reject) => {
        if (signal.aborted) reject(new Error('timeout'))
        else signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true })
      }),
    ])
  if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) throw new Error('private-address')
  const address = addresses[0]
  // Pin the validated address, while preserving the original Host and TLS server name.
  // Checking DNS and then using fetch would allow a second resolution to reach a private host.
  return new Promise((resolve, reject) => {
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest
    const request = send(url, {
      method, signal, agent: false, family: address.family,
      headers: { 'User-Agent': 'NavSphere-LinkCheck/1.0', Accept: '*/*' },
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [address])
        else (callback as unknown as (error: null, address: string, family: number) => void)(null, address.address, address.family)
      },
    }, response => {
      resolve({ statusCode: response.statusCode || 0, location: response.headers.location })
      response.destroy() // No response body needs to be downloaded or stored.
    })
    request.on('error', reject)
    request.end()
  })
}

export async function checkSiteLink(href: string): Promise<LinkHealth> {
  const base = { href, checkedAt: new Date().toISOString() }
  const signal = AbortSignal.timeout(8000)
  try {
    let url: URL
    try { url = new URL(href) } catch { return { ...base, state: 'broken', reason: '网址格式无效' } }
    if (!['http:', 'https:'].includes(url.protocol)) return { ...base, state: 'broken', reason: '请使用 HTTP(S) 网址' }
    for (let redirects = 0; redirects <= 4; redirects++) {
      let result = await probe(url, 'HEAD', signal)
      if (result.statusCode === 405 || result.statusCode === 501) result = await probe(url, 'GET', signal)
      if ([301, 302, 303, 307, 308].includes(result.statusCode) && result.location) {
        url = new URL(result.location, url)
        continue
      }
      return { ...base, statusCode: result.statusCode, ...classifyHttpStatus(result.statusCode) }
    }
    return { ...base, state: 'review', reason: '重定向次数过多，请人工复核' }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : ''
    if (message === 'private-address' || message === 'unsafe-url') {
      return { ...base, state: 'review', reason: '内网地址、含凭据地址或非 HTTP(S) 链接需人工检查' }
    }
    return { ...base, state: 'review', reason: '连接失败或检测超时，请稍后复核' }
  }
}
