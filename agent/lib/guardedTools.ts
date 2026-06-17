// Outward-facing or irreversible R tools that require explicit user approval
// before they run. This is the UI/agent-side mirror of DEFAULT_GUARDED_TOOLS in
// scripts/r_bridge.py. Keep the two lists in sync: the bridge enforces the gate
// for any caller (CLI, tests), while `needsApproval` drives the in-app
// human-in-the-loop approval prompt. Pure module (no Node APIs) so it can be
// imported from both the agent runtime and the browser UI.
export const GUARDED_TOOLS: ReadonlySet<string> = new Set([
  "email.send_email",
  "social.social_post",
  "social.social_dm",
  "social.social_reply",
  "http.http_post",
  "http.http_put",
  "http.http_delete",
  "http.http_request",
  "sql.import_csv_to_db",
]);

export function isGuardedTool(skill: unknown, tool: unknown): boolean {
  return (
    typeof skill === "string" &&
    typeof tool === "string" &&
    GUARDED_TOOLS.has(`${skill}.${tool}`)
  );
}

/**
 * Plain-language description of a guarded action, shown to the user in the
 * approval prompt. Mirrors `_summarize_action` in scripts/r_bridge.py so the
 * preview the user approves matches what the bridge will run.
 */
export function summarizeGuardedAction(
  skill: string,
  tool: string,
  params: Record<string, unknown>,
  lang: "es" | "en" = "en",
): string {
  if (skill === "email" && tool === "send_email") {
    const to = params.to ?? params.recipient ?? params.recipients ?? (lang === "es" ? "el destinatario" : "the recipient");
    const subject = params.subject ?? (lang === "es" ? "(sin asunto)" : "(no subject)");
    let summary =
      lang === "es"
        ? `Enviar un correo a ${String(to)} con asunto "${String(subject)}".`
        : `Send an email to ${String(to)} with subject "${String(subject)}".`;
    if (params.cc) {
      summary += ` Cc: ${String(params.cc)}.`;
    }
    const attachments = params.attachments ?? params.files;
    if (attachments) {
      const count = Array.isArray(attachments) ? attachments.length : 1;
      summary += lang === "es" ? ` Con ${count} adjunto(s).` : ` With ${count} attachment(s).`;
    }
    const body = params.body ?? params.text ?? params.html ?? "";
    if (typeof body === "string" && body.trim()) {
      let preview = body.replace(/\s+/g, " ").trim();
      if (preview.length > 200) {
        preview = `${preview.slice(0, 200)}…`;
      }
      summary += lang === "es" ? ` Vista previa del cuerpo: "${preview}"` : ` Body preview: "${preview}"`;
    }
    return summary;
  }
  if (lang === "es") {
    return `Ejecutar ${skill}.${tool} con los datos indicados.`;
  }
  return `Run ${skill}.${tool} with the provided details.`;
}
