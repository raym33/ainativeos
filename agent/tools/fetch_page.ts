import { defineTool } from "eve/tools";
import { z } from "zod";
import { readPage } from "../lib/webResearch.js";

export default defineTool({
  description:
    "Read a specific web page and return clean Markdown for source-grounded research. Uses Firecrawl when configured, otherwise direct HTML/text extraction. Use after web_search before writing serious cited answers.",
  inputSchema: z.object({
    url: z.string().url().describe("URL of the page to read."),
  }),
  outputSchema: z.object({
    url: z.string(),
    title: z.string().optional(),
    extractor: z.enum(["firecrawl", "direct"]),
    markdown: z.string(),
    text: z.string(),
    citationHint: z.string(),
  }),
  async execute({ url }) {
    const page = await readPage(url);
    return {
      ...page,
      text: page.markdown,
      citationHint: `Cite this source as: ${page.title ? `${page.title} - ` : ""}${page.url}`,
    };
  },
});
