import { defineTool } from "eve/tools";
import { z } from "zod";
import { readPage } from "../lib/webResearch.js";
import { runWebSearch } from "./web_search.js";

const Source = z.object({
  date: z.string().optional(),
  error: z.string().optional(),
  extractor: z.enum(["firecrawl", "direct"]).optional(),
  markdown: z.string().optional(),
  provider: z.string(),
  quality: z.enum(["strong", "standard", "fallback", "weak"]),
  rank: z.number().int(),
  snippet: z.string(),
  status: z.enum(["found", "read", "failed"]),
  title: z.string(),
  url: z.string(),
});

export default defineTool({
  description:
    "Run a complete web research pass: search, read the top sources, and return source cards plus Markdown excerpts. Use this for cited answers, comparisons, recent facts, and research notes.",
  inputSchema: z.object({
    query: z.string().min(2).describe("Research question or web search query."),
    maxResults: z.number().int().min(2).max(8).default(6).describe("Search results to collect."),
    readTop: z.number().int().min(1).max(5).default(3).describe("Top sources to read fully."),
  }),
  outputSchema: z.object({
    query: z.string(),
    provider: z.string(),
    quality: z.enum(["strong", "standard", "fallback", "weak"]),
    note: z.string(),
    sources: z.array(Source),
    answerGuidance: z.string(),
  }),
  async execute({ query, maxResults, readTop }) {
    const search = await runWebSearch(query, maxResults);
    const sources = await Promise.all(
      search.results.map(async (source) => {
        if (source.rank > readTop) {
          return source;
        }
        try {
          const page = await readPage(source.url);
          return {
            ...source,
            extractor: page.extractor,
            markdown: page.markdown,
            status: "read" as const,
            title: page.title || source.title,
            url: page.url || source.url,
          };
        } catch (error) {
          return {
            ...source,
            error: error instanceof Error ? error.message : String(error),
            status: "failed" as const,
          };
        }
      }),
    );

    return {
      query,
      provider: search.provider,
      quality: search.quality,
      note: search.note,
      sources,
      answerGuidance:
        "Write the final answer only from sources with status=read when possible. Cite each claim with the source title and URL. Say when evidence is weak, missing, or only fallback search was available.",
    };
  },
});
