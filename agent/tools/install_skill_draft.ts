import { defineTool } from "eve/tools";
import { z } from "zod";
import { runRBridge } from "../lib/rBridge.js";

export default defineTool({
  description:
    "Install a previously approved Skill Forge draft by copying its package into installed skills. Code is copied but never executed; prior approval is required.",
  inputSchema: z.object({
    name: z.string().min(1).describe("Draft skill name."),
    allowSensitive: z
      .boolean()
      .default(false)
      .describe("Allow installing a reviewed draft whose permission profile is sensitive."),
    force: z.boolean().default(false).describe("Reinstall even if the draft or target is already installed."),
  }),
  async execute({ name, allowSensitive, force }) {
    const args = ["install-draft", "--name", name];
    if (allowSensitive) {
      args.push("--allow-sensitive");
    }
    if (force) {
      args.push("--force");
    }
    return runRBridge(args);
  },
});
