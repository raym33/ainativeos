export type SourceQuality = "strong" | "standard" | "fallback" | "weak";

export type SourceCard = {
  date?: string;
  provider: string;
  quality: SourceQuality;
  rank: number;
  snippet: string;
  status: "found" | "read" | "failed";
  title: string;
  url: string;
};

export type PageRead = {
  extractor: "firecrawl" | "direct";
  markdown: string;
  title?: string;
  url: string;
};

const DIRECT_READ_LIMIT = 18000;

export function sourceQuality(provider: string, hasSnippet: boolean): SourceQuality {
  if (provider === "duckduckgo-instant-answer" || provider === "duckduckgo") {
    return hasSnippet ? "fallback" : "weak";
  }
  if (provider === "brave" || provider === "tavily") {
    return hasSnippet ? "strong" : "standard";
  }
  if (provider === "searxng") {
    return hasSnippet ? "standard" : "weak";
  }
  return hasSnippet ? "standard" : "weak";
}

export function sourceCard(input: {
  date?: string;
  provider: string;
  rank: number;
  snippet?: string;
  title?: string;
  url?: string;
}): SourceCard {
  const snippet = compactText(input.snippet ?? "");
  return {
    date: input.date,
    provider: input.provider,
    quality: sourceQuality(input.provider, Boolean(snippet)),
    rank: input.rank,
    snippet,
    status: "found",
    title: compactText(input.title ?? input.url ?? "Untitled source"),
    url: input.url ?? "",
  };
}

export async function readPage(url: string): Promise<PageRead> {
  if (process.env.FIRECRAWL_API_KEY || process.env.FIRECRAWL_BASE_URL) {
    const firecrawl = await readWithFirecrawl(url);
    if (firecrawl) {
      return firecrawl;
    }
  }

  return readDirect(url);
}

async function readWithFirecrawl(url: string): Promise<PageRead | null> {
  const baseUrl = (process.env.FIRECRAWL_BASE_URL || "https://api.firecrawl.dev").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v1/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.FIRECRAWL_API_KEY
        ? { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      formats: ["markdown"],
      onlyMainContent: true,
      url,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    data?: {
      markdown?: string;
      metadata?: { title?: string; sourceURL?: string };
    };
    markdown?: string;
    metadata?: { title?: string; sourceURL?: string };
  };

  const markdown = compactMarkdown(data.data?.markdown ?? data.markdown ?? "");
  if (!markdown) {
    return null;
  }

  return {
    extractor: "firecrawl",
    markdown: markdown.slice(0, DIRECT_READ_LIMIT),
    title: data.data?.metadata?.title ?? data.metadata?.title,
    url: data.data?.metadata?.sourceURL ?? data.metadata?.sourceURL ?? url,
  };
}

async function readDirect(url: string): Promise<PageRead> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html, text/plain;q=0.9, application/xhtml+xml;q=0.8, */*;q=0.5",
      "User-Agent": "AI Native OS local research agent",
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  const title = contentType.includes("html") ? extractTitle(body) : undefined;
  const markdown = contentType.includes("html") ? htmlToMarkdown(body) : compactMarkdown(body);

  return {
    extractor: "direct",
    markdown: markdown.slice(0, DIRECT_READ_LIMIT),
    title,
    url,
  };
}

function extractTitle(html: string): string | undefined {
  return decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim() || undefined;
}

function htmlToMarkdown(html: string): string {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(h1|h2|h3|h4)>/gi, "\n\n")
    .replace(/<(h1|h2|h3|h4)[^>]*>/gi, "\n\n## ")
    .replace(/<\/(p|div|section|article|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href, text) => {
      const label = stripTags(String(text)).trim();
      return label ? `${label} (${href})` : String(href);
    })
    .replace(/<[^>]+>/g, " ");

  return compactMarkdown(decodeEntities(body));
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function compactText(value: string): string {
  return decodeEntities(stripTags(value)).replace(/\s+/g, " ").trim();
}

export function compactMarkdown(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
