import { describe, expect, it } from 'vitest'
import {
  BASE_PATH,
  rewriteResponsesUnderBasePath,
  stripBasePath,
  withBasePathLocation,
  withBasePathText,
} from './base-path.js'
import { APPLICATION_KEY } from '../src/config/application.js'

const HOST = 'localhost:5175'
const O = `https://${HOST}`
const B = BASE_PATH

describe('base path', () => {
  it('is the application key', () => {
    expect(B).toBe(`/${APPLICATION_KEY}`)
  })

  it('strips the base from requests inside it only', () => {
    expect(stripBasePath(`${B}/api/auth/login`)).toBe('/api/auth/login')
    expect(stripBasePath(B)).toBe('/')
    expect(stripBasePath(`${B}?x=1`)).toBe('/?x=1')
    expect(stripBasePath(`${B}-other/x`)).toBeNull()
    expect(stripBasePath('/sharing/rest/info')).toBeNull()
  })

  it('puts the base on redirects for this origin, once', () => {
    expect(withBasePathLocation('/api/portal/proxy/gh/apps/x', [HOST])).toBe(`${B}/api/portal/proxy/gh/apps/x`)
    expect(withBasePathLocation('/portal/apps/experiencebuilder/?id=1', [HOST])).toBe(`${B}/portal/apps/experiencebuilder/?id=1`)
    expect(withBasePathLocation(`${B}/api/x`, [HOST])).toBe(`${B}/api/x`)
    expect(withBasePathLocation(`${O}/api/x`, [HOST])).toBe(`${O}${B}/api/x`)
    expect(withBasePathLocation('https://gh.space.gov.rw/portal/x', [HOST])).toBe('https://gh.space.gov.rw/portal/x')
    expect(withBasePathLocation('//cdn.example/x', [HOST])).toBe('//cdn.example/x')
  })

  it('puts the base on absolute URLs for this origin in every encoding', () => {
    const text = [
      `"${O}/api/portal/proxy/gh/sharing"`,
      `"https:\\/\\/${HOST}\\/api\\/portal\\/proxy\\/gh"`,
      `?u=${encodeURIComponent(`${O}/api/portal/proxy/gh`)}`,
      `wss://${HOST}/portal/ws`,
    ].join('\n')
    const out = withBasePathText(text, [HOST]).split('\n')
    expect(out[0]).toBe(`"${O}${B}/api/portal/proxy/gh/sharing"`)
    expect(out[1]).toBe(`"https:\\/\\/${HOST}${B.replaceAll('/', '\\/')}\\/api\\/portal\\/proxy\\/gh"`)
    expect(out[2]).toBe(`?u=${encodeURIComponent(`${O}${B}/api/portal/proxy/gh`)}`)
    expect(out[3]).toBe(`wss://${HOST}${B}/portal/ws`)
  })

  it('puts the base on quoted root-relative URLs for our own routes only', () => {
    expect(withBasePathText(`<script src="/dashboards/ssl-patch.js"></script>`, [HOST])).toBe(
      `<script src="${B}/dashboards/ssl-patch.js"></script>`,
    )
    expect(withBasePathText(`{"proxyPath":"/api/portal/proxy/gh/apps/x"}`, [HOST])).toBe(
      `{"proxyPath":"${B}/api/portal/proxy/gh/apps/x"}`,
    )
    expect(withBasePathText(`var c = "\\/api\\/portal\\/proxy\\/gh"`, [HOST])).toBe(
      `var c = "${B.replaceAll('/', '\\/')}\\/api\\/portal\\/proxy\\/gh"`,
    )
    expect(withBasePathText('<script src="/rbc-patch.js">', [HOST])).toBe(`<script src="${B}/rbc-patch.js">`)
    // Upstream portal strings stay as they are.
    for (const foreign of ['"/sharing/rest"', '"/apps/dashboards/"', '"/api/v3/datasets"', 'x.startsWith("/api")', '"https://gh.space.gov.rw/api/portal/x"']) {
      expect(withBasePathText(foreign, [HOST])).toBe(foreign)
    }
  })

  it('is idempotent', () => {
    const once = withBasePathText(`"${O}/api/x" "/api/portal/proxy/gh" "/dashboards/a.js"`, [HOST])
    expect(withBasePathText(once, [HOST])).toBe(once)
  })

  it('rewrites text responses and redirects, and leaves binary bodies alone', () => {
    const headers = {}
    let body
    const res = {
      headersSent: false,
      setHeader(k, v) { headers[k.toLowerCase()] = v },
      getHeader(k) { return headers[k.toLowerCase()] },
      writeHead() {},
      write() {},
      end(chunk) { body = chunk },
    }
    const req = { headers: { host: HOST } }
    const restore = rewriteResponsesUnderBasePath(req, res)
    res.setHeader('Location', '/api/portal/proxy/gh/x')
    expect(headers.location).toBe(`${B}/api/portal/proxy/gh/x`)
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Length', 10)
    res.end(`{"u":"${O}/api/x"}`)
    expect(body).toBe(`{"u":"${O}${B}/api/x"}`)
    expect(headers['content-length']).toBe(Buffer.byteLength(body))

    res.setHeader('Content-Type', 'image/png')
    const png = Buffer.from(`${O}/api/x`)
    res.end(png)
    expect(body).toBe(png)

    restore()
    res.setHeader('Location', '/x')
    expect(headers.location).toBe('/x')
  })
})
