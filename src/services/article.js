import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

// Calls our own serverless function (api/summarize.js), which keeps the
// Gemini API key on the server.
export const articleApi = createApi ({
  reducerPath: 'articleApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/' }),
  endpoints: (builder) => ({
    getSummary: builder.query({
      // length = number of paragraphs in the summary
      query: ({ articleUrl, length = 3 }) =>
        `summarize?url=${encodeURIComponent(articleUrl)}&length=${length}`
    })
  })

})

export const { useLazyGetSummaryQuery } = articleApi
