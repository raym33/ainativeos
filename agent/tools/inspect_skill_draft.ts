import { defineTool } from "eve/tools";
import { z } from "zod";
import { runRBridge } from "../lib/rBridge.js";

export default defineTool({
  description: "Inspect a Skill Forge draft package, including manifest, review docs, source text, and readiness checks.",
  inputSchema: z.object({
    name: z.string().min(1).describe("Draft skill name."),
  }),
  async execute({ name }) {
    return runRBridge(["inspect-draft", "--name", name]);
  },
});
