import { useState, useEffect } from "react"
import { copy, linkIcon, loader, tick, trash } from "../assets"
import { useLazyGetSummaryQuery } from "../services/article"

const STORAGE_KEY = "articles"

const LENGTH_OPTIONS = [
  { label: "Short", value: 1 },
  { label: "Medium", value: 3 },
  { label: "Long", value: 5 },
]

// Read saved history safely - corrupted localStorage data shouldn't crash the app
const loadArticles = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

const getErrorMessage = (error) =>
  error?.data?.error ||
  error?.data?.message ||
  error?.error ||
  "Could not summarize this article. Please check the URL and try again."

const Demo = () => {

  const [url, setUrl] = useState('')
  const [length, setLength] = useState(3)
  const [article, setArticle] = useState(null)
  const [allArticles, setAllArticles] = useState(loadArticles)
  const [copied, setCopied] = useState('')

  const [getSummary, { error, isFetching }] = useLazyGetSummaryQuery()

  // Keep localStorage in sync with history
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allArticles))
  }, [allArticles])

  const handleSubmit = async (event) => {
    event.preventDefault();

    const articleUrl = url.trim()

    // Reuse an existing summary of the same length instead of spending an API call
    const existing = allArticles.find(
      (item) => item.url === articleUrl && (item.length ?? 3) === length
    )
    if (existing) {
      setArticle(existing)
      return
    }

    const { data } = await getSummary({ articleUrl, length })

    if (data?.summary) {
      const newArticle = { url: articleUrl, summary: data.summary, length }
      setArticle(newArticle)
      setAllArticles((prev) => [
        newArticle,
        ...prev.filter((item) => !(item.url === articleUrl && (item.length ?? 3) === length)),
      ])
      setUrl("")
    } else {
      setArticle(null)
    }
  }

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(text)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      // Clipboard can be unavailable (e.g. insecure context) - fail silently
    }
  }

  const handleDelete = (event, target) => {
    event.stopPropagation()
    setAllArticles((prev) => prev.filter((item) => item !== target))
    if (article === target) setArticle(null)
  }

  const handleClearAll = () => {
    if (window.confirm("Clear all saved summaries?")) {
      setAllArticles([])
      setArticle(null)
    }
  }

  const wordCount = article?.summary.trim().split(/\s+/).length ?? 0

  return (
    <section className="mt-16 w-full max-w-xl">

      <div className="flex flex-col w-full gap-2">
        <form
          className="relative flex justify-center items-center"
          onSubmit={handleSubmit}
        >
          <img
            src={linkIcon}
            alt='link-icon'
            className="absolute left-0 my-2 ml-3 w-5"
          />

          <input
            type="url"
            placeholder="Enter a URL"
            value={url}
            onChange={(event) => setUrl(event.currentTarget.value)}
            required
            className="url_input peer"
          />

          <button
            type="submit"
            disabled={isFetching}
            className="submit_btn peer-focus:border-gray-700 peer-focus:text-gray-700 disabled:opacity-50"
          >
            ↵
          </button>

        </form>

        {/* Summary length selector */}
        <div className="flex justify-between items-center">
          <div className="flex gap-1">
            {LENGTH_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setLength(option.value)}
                className={`length_btn ${length === option.value ? "length_btn_active" : ""}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {allArticles.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="font-satoshi text-xs text-gray-500 hover:text-red-600"
            >
              Clear history
            </button>
          )}
        </div>

        {/* Browse history */}
        <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
          {allArticles.map((item) => (
            <div
              key={`${item.url}-${item.length ?? 3}`}
              onClick={() => setArticle(item)}
              className={`link_card ${article === item ? "border-blue-400" : ""}`}
            >
              <div
                className="copy_btn"
                title="Copy URL"
                onClick={(event) => { event.stopPropagation(); handleCopy(item.url) }}
              >
                <img
                  src={copied === item.url ? tick : copy}
                  alt="copy"
                  className="w-[40%] h-[40%] object-contain"
                />
              </div>

              {/*truncate - if text is lengthy 3 dots and rest hidden*/}
              <p className="flex-1 font-satoshi text-blue-700 font-medium text-sm truncate">
                {item.url}
              </p>

              <div
                className="copy_btn"
                title="Delete"
                onClick={(event) => handleDelete(event, item)}
              >
                <img src={trash} alt="delete" className="w-[45%] h-[45%] object-contain" />
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Display result */}
      <div className="my-10 max-w-full flex justify-center items-center">
        {isFetching ? (
          <img
            src={loader}
            alt="loader"
            className="w-20 h-20 object-contain"
          />
        ) : error && !article ? (
          <p className="font-inter font-bold text-black text-center">
            Well, that wasn&apos;t supposed to happen...
            <br />
            <span className="font-satoshi font-normal text-gray-700">
              {getErrorMessage(error)}
            </span>
          </p>
        ) : (
          article && (
            <div className="flex flex-col gap-3 w-full">
              <div className="flex justify-between items-center">
                <h2 className="font-satoshi font-bold text-gray-600 text-xl">
                  Article <span className="blue_gradient">Summary</span>
                </h2>

                <button
                  type="button"
                  onClick={() => handleCopy(article.summary)}
                  className="black_btn"
                >
                  {copied === article.summary ? "Copied!" : "Copy summary"}
                </button>
              </div>

              <a
                href={article.url}
                target="_blank"
                rel="noreferrer"
                className="font-satoshi text-xs text-blue-600 hover:underline truncate"
              >
                {article.url}
              </a>

              <div className="summary_box">
                <p className="font-inter font-medium text-sm text-gray-700 whitespace-pre-line">
                  {article.summary}
                </p>
              </div>

              <p className="font-satoshi text-xs text-gray-500 text-right">
                {wordCount} words · ~{Math.max(1, Math.round(wordCount / 200))} min read
              </p>
            </div>
          )
        )}
      </div>

    </section>
  )
}

export default Demo
