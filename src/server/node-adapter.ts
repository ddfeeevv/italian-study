import { handleGenerateDeck } from './generate-deck'

export class BadTutorRequest extends Error {
  constructor() {
    super('bad_request')
    this.name = 'BadTutorRequest'
  }
}

export type NodeRequest = {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

export type NodeResponse = {
  statusCode: number
  headersSent?: boolean
  setHeader: (name: string, value: string) => void
  end: (body?: string) => void
}

export async function handleNode(req: NodeRequest, res: NodeResponse): Promise<void> {
  try {
    const request = await toWebRequest(req)
    const response = await handleGenerateDeck(request)
    res.statusCode = response.status
    const type = response.headers.get('content-type')
    if (type) res.setHeader('content-type', type)
    const cache = response.headers.get('cache-control')
    if (cache) res.setHeader('cache-control', cache)
    res.end(await response.text())
  } catch (error) {
    console.error('[tutor] request failed', error instanceof Error ? error.message : 'error')
    if (res.headersSent) return
    const bad = error instanceof BadTutorRequest
    res.statusCode = bad ? 400 : 500
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: bad ? 'bad_request' : 'upstream' }))
  }
}

async function toWebRequest(req: NodeRequest): Promise<Request> {
  const method = (req.method ?? 'GET').toUpperCase()
  const headers = new Headers()
  const authorization = header(req.headers, 'authorization')
  if (authorization) headers.set('authorization', authorization)
  let body: string | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    body = await readBody(req)
    if (body) headers.set('content-type', 'application/json')
  }
  return new Request(requestUrl(req), { method, headers, body })
}

async function readBody(req: NodeRequest): Promise<string> {
  if (typeof req.body === 'string') {
    if (req.body.length > 8000) throw new BadTutorRequest()
    return req.body
  }
  if (req.body instanceof Uint8Array) {
    if (req.body.byteLength > 8000) throw new BadTutorRequest()
    return new TextDecoder().decode(req.body)
  }
  if (req.body !== undefined && req.body !== null) {
    const raw = JSON.stringify(req.body)
    if (raw.length > 8000) throw new BadTutorRequest()
    return raw
  }
  if (!(Symbol.asyncIterator in req) || typeof req[Symbol.asyncIterator] !== 'function') return ''
  const decoder = new TextDecoder()
  let raw = ''
  for await (const chunk of req as AsyncIterable<Uint8Array | string>) {
    const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
    raw += text
    if (raw.length > 8000) throw new BadTutorRequest()
  }
  raw += decoder.decode()
  return raw
}

function requestUrl(req: NodeRequest): string {
  const raw = req.url && req.url.startsWith('/') ? req.url : '/api/generate-deck'
  return new URL(raw, 'http://127.0.0.1').toString()
}

function header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const direct = headers[name] ?? headers[name.toLowerCase()]
  if (typeof direct === 'string') return direct
  if (Array.isArray(direct)) return direct[0]
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name)
  if (!found) return undefined
  return Array.isArray(found[1]) ? found[1][0] : found[1]
}
