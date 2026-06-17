import { defineTool } from "eve/tools";
import { z } from "zod";
import { sourceCard, type SourceCard } from "../lib/webResearch.js";

const SearchResult = z.object({
  date: z.string().optional(),
  provider: z.string(),
  quality: z.enum(["strong", "standard", "fallback", "weak"]),
  rank: z.number().int(),
  status: z.enum(["found", "read", "failed"]),
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  source: z.string().describe("Deprecated alias for provider."),
});

const SearchOutput = z.object({
  query: z.string(),
  provider: z.string(),
  quality: z.enum(["strong", "standard", "fallback", "weak"]),
  note: z.string(),
  results: z.array(SearchResult),
});

type SearchResult = SourceCard & { source: string };
type SearchOutput = {
  note: string;
  provider: string;
  quality: "strong" | "standard" | "fallback" | "weak";
  query: string;
  results: SearchResult[];
};

export default defineTool({
  description:
    "Search the current web and return normalized source cards. Use it for news, recent facts, links, prices, current documentation, or anything that may have changed. For serious answers, read the best sources with fetch_page before writing the final response.",
  inputSchema: z.object({
    query: z.string().min(2).describe("Web search query."),
    maxResults: z.number().int().min(1).max(8).default(5).describe("Maximum number of results."),
  }),
  outputSchema: SearchOutput,
  async execute({ query, maxResults }) {
    return runWebSearch(query, maxResults);
  },
});

export async function runWebSearch(query: string, maxResults: number): Promise<SearchOutput> {
  if (process.env.SEARXNG_URL) {
    return searchOutput(query, "searxng", await searchSearxng(query, maxResults));
  }

  if (process.env.BRAVE_SEARCH_API_KEY) {
    return searchOutput(query, "brave", await searchBrave(query, maxResults));
  }

  if (process.env.TAVILY_API_KEY) {
    return searchOutput(query, "tavily", await searchTavily(query, maxResults));
  }

  return searchOutput(
    query,
    "duckduckgo-instant-answer",
    await searchDuckDuckGoInstantAnswer(query, maxResults),
  );
}

function searchOutput(query: string, provider: string, results: SearchResult[]): SearchOutput {
  const quality = provider === "duckduckgo-instant-answer"
    ? "fallback"
    : provider === "brave" || provider === "tavily"
      ? "strong"
      : "standard";
  return {
    query,
    provider,
    quality,
    note:
      quality === "fallback"
        ? "Fallback search only. Read sources with fetch_page and treat missing results as weak evidence."
        : "Read the strongest sources with fetch_page before writing cited answers.",
    results,
  };
}

function withSource(card: SourceCard): SearchResult {
  return { ...card, source: card.provider };
}

async function searchSearxng(query: string, maxResults: number): Promise<SearchResult[]> {
  const baseUrl = process.env.SEARXNG_URL?.replace(/\/$/, "");
  const url = new URL(`${baseUrl}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "en-US");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`SearXNG search failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string; engine?: string }>;
  };

  return (data.results ?? [])
    .filter((item) => item.title && item.url)
    .slice(0, maxResults)
    .map((item, index) =>
      withSource(sourceCard({
        provider: "searxng",
        rank: index + 1,
        snippet: item.content,
        title: item.title,
        url: item.url,
      })),
    );
}

async function searchBrave(query: string, maxResults: number): Promise<SearchResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(maxResults));
  url.searchParams.set("search_lang", "en");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY ?? "",
    },
  });
  if (!response.ok) {
    throw new Error(`Brave search failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };

  return (data.web?.results ?? []).slice(0, maxResults).map((item, index) =>
    withSource(sourceCard({
      provider: "brave",
      rank: index + 1,
      snippet: item.description,
      title: item.title,
      url: item.url,
    })),
  );
}

async function searchTavily(query: string, maxResults: number): Promise<SearchResult[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: maxResults,
      search_depth: "basic",
      include_answer: false,
    }),
  });
  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return (data.results ?? []).slice(0, maxResults).map((item, index) =>
    withSource(sourceCard({
      provider: "tavily",
      rank: index + 1,
      snippet: item.content,
      title: item.title,
      url: item.url,
    })),
  );
}

async function searchDuckDuckGoInstantAnswer(
  query: string,
  maxResults: number,
): Promise<SearchResult[]> {
  const url = new URL("https://api.duckduckgo.com/");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  url.searchParams.set("skip_disambig", "1");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`DuckDuckGo instant answer failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    AbstractText?: string;
    AbstractURL?: string;
    Heading?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
  };

  const results: SearchResult[] = [];
  if (data.AbstractText && data.AbstractURL) {
    results.push({
      ...withSource(sourceCard({
        provider: "duckduckgo",
        rank: 1,
        snippet: data.AbstractText,
        title: data.Heading || query,
        url: data.AbstractURL,
      })),
    });
  }

  for (const item of data.RelatedTopics ?? []) {
    if (results.length >= maxResults) {
      break;
    }
    if (item.Text && item.FirstURL) {
      results.push({
        ...withSource(sourceCard({
          provider: "duckduckgo",
          rank: results.length + 1,
          snippet: item.Text,
          title: item.Text.split(" - ")[0] ?? item.Text,
          url: item.FirstURL,
        })),
      });
    }
  }

  return results.slice(0, maxResults);
}
