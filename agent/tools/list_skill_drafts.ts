import { defineTool } from "eve/tools";
import { z } from "zod";
import { runRBridge } from "../lib/rBridge.js";

export default defineTool({
  description: "List Skill Forge draft packages and their implementation, approval, and install status.",
  inputSchema: z.object({
    outputDir: z.string().default("skill-drafts").describe("Directory containing Skill Forge drafts."),
  }),
  async execute({ outputDir }) {
    return runRBridge(["list-drafts", "--output-dir", outputDir]);
  },
});
