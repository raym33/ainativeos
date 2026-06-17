import { defineTool } from "eve/tools";
import { z } from "zod";
import { runRBridge } from "../lib/rBridge.js";

export default defineTool({
  description:
    "Execute one specific tool from the raym33/r project. Use r_search_tools or r_catalog first when the exact schema is unknown. Outward or irreversible tools return a safe preview first; call again with confirm=true only after the user explicitly approves.",
  inputSchema: z.object({
    skill: z.string().describe("R skill name, for example math, json, rss, pdf, git."),
    tool: z.string().describe("Tool name inside that skill."),
    params: z.record(z.string(), z.unknown()).default({}).describe("JSON arguments for the tool."),
    confirm: z
      .boolean()
      .default(false)
      .describe(
        "Set to true ONLY after the user has explicitly approved an outward or irreversible action (such as sending an email). Leave false to get a safe preview first.",
      ),
  }),
  async execute({ skill, tool, params, confirm }) {
    const args = ["call", skill, tool, "--params", JSON.stringify(params)];
    if (confirm) {
      args.push("--confirm");
    }
    return runRBridge(args);
  },
});
