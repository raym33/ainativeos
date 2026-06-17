import { defineTool } from "eve/tools";
import { z } from "zod";
import { runRBridge } from "../lib/rBridge.js";

export default defineTool({
  description:
    "Record human approval for an implemented Skill Forge draft. This only writes an approval record; it never installs or executes the draft.",
  inputSchema: z.object({
    name: z.string().min(1).describe("Draft skill name."),
    approver: z.string().min(1).describe("Human approver name or identifier."),
  }),
  async execute({ name, approver }) {
    return runRBridge(["approve-draft", "--name", name, "--approver", approver]);
  },
});
