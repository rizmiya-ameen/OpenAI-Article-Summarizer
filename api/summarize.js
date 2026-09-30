import { ApiError, GoogleGenAI } from '@google/genai'
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

// Vercel serverless function: GET /api/summarize?url=<article url>&length=<paragraphs>
// Written against plain Node req/res so it also runs inside the Vite dev server.

// Lightweight Flash-Lite model first (cheaper, less often overloaded), then a
// fallback model if it keeps failing. Override with GEMINI_MODEL / GEMINI_FALLBACK_MODEL.
const MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.8-flash',
].filter((model, i, all) => model && all.indexOf(model) === i)
const MAX_ATTEMPTS = 3
// Temporary server-side errors worth retrying (overloaded / internal / timeout)
const RETRYABLE_STATUSES = new Set([500, 503, 504])
const MAX_ARTICLE_CHARS = 300_000

const sendJson = (res, status, body) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  if (status === 200) {
    // Let Vercel's CDN reuse identical summaries for a day (saves API credits)
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate')
  }
  res.end(JSON.stringify(body))
}

const isPublicHttpUrl = (value) => {
  try {
    const { protocol, hostname } = new URL(value)
    if (!['http:', 'https:'].includes(protocol)) return false
    // Basic guard against requests to local/private hosts
    return !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/i.test(hostname)
  } catch {
    return false
  }
}

const extractArticle = async (articleUrl) => {
  const response = await fetch(articleUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; InsightifyBot/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`Could not fetch the article (HTTP ${response.status}).`)
  }

  const html = await response.text()
  const { document } = parseHTML(html)
  const article = new Readability(document).parse()

  const text = (article?.textContent || document.body?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim()

  return { title: article?.title || document.title || '', text }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Try each model up to MAX_ATTEMPTS times with backoff on temporary errors.
// A rate limit (429) skips straight to the next model, since it has its own quota.
const generateWithRetry = async (ai, request) => {
  let lastError
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await ai.models.generateContent({ ...request, model })
      } catch (error) {
        lastError = error
        const status = error instanceof ApiError ? error.status : undefined
        console.warn(`Gemini ${model} attempt ${attempt} failed (${status ?? error.message})`)
        if (status === 429) break
        if (!RETRYABLE_STATUSES.has(status)) throw error
        if (attempt < MAX_ATTEMPTS) await sleep(1000 * 2 ** (attempt - 1)) // 1s, 2s
      }
    }
  }
  throw lastError
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed.' })
  }

  const { searchParams } = new URL(req.url, 'http://localhost')
  const articleUrl = searchParams.get('url')?.trim()
  const length = Math.min(Math.max(parseInt(searchParams.get('length'), 10) || 3, 1), 5)

  if (!articleUrl || !isPublicHttpUrl(articleUrl)) {
    return sendJson(res, 400, { error: 'Please provide a valid http(s) article URL.' })
  }

  if (!process.env.GEMINI_API_KEY) {
    return sendJson(res, 500, { error: 'Server is missing GEMINI_API_KEY.' })
  }

  let article
  try {
    article = await extractArticle(articleUrl)
  } catch (error) {
    return sendJson(res, 502, { error: error.message || 'Could not fetch the article.' })
  }

  if (article.text.length < 200) {
    return sendJson(res, 422, { error: 'Could not find readable article text on that page.' })
  }
  if (article.text.length > MAX_ARTICLE_CHARS) {
    return sendJson(res, 413, { error: 'This article is too long to summarize.' })
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const response = await generateWithRetry(ai, {
      contents:
        `<article title="${article.title.replace(/"/g, "'")}">
${article.text}
</article>

` +
        `Summarize this article in ${length} paragraph${length > 1 ? 's' : ''}, ` +
        'separated by blank lines.',
      config: {
        systemInstruction:
          'You summarize articles for busy readers. Write clear, accurate, neutral prose ' +
          'in plain text (no markdown, headings or bullet points). Only use information from the article.',
      },
    })

    const summary = response.text?.trim()
    if (!summary) {
      // Empty output usually means the prompt or response was blocked by safety filters
      return sendJson(res, 422, { error: 'This article could not be summarized.' })
    }

    return sendJson(res, 200, { summary, title: article.title })
  } catch (error) {
    console.error(error)
    if (error instanceof ApiError) {
      if (error.status === 429) {
        return sendJson(res, 429, { error: 'Free-tier rate limit reached. Please try again in a minute.' })
      }
      if (error.status === 400 || error.status === 401 || error.status === 403) {
        return sendJson(res, 500, { error: 'The server has an invalid Gemini API key or request.' })
      }
      if (RETRYABLE_STATUSES.has(error.status)) {
        return sendJson(res, 503, {
          error: 'The AI service is busy right now. Please try again in a few moments.',
        })
      }
      return sendJson(res, 502, { error: 'Summarization failed. Please try again later.' })
    }
    return sendJson(res, 500, { error: 'Unexpected error while summarizing.' })
  }
}
