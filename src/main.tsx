import { useEveAgent } from "eve/react";
import type { EveMessage, EveMessagePart } from "eve/client";
import {
  Activity,
  BarChart3,
  Code2,
  FileText,
  FolderKanban,
  Globe2,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Wrench,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type RTool = {
  name: string;
  description: string;
  parameters?: unknown;
};

type RSkill = {
  name: string;
  description: string;
  blocked: boolean;
  toolCount: number;
  tools: RTool[];
};

type RCatalog = {
  skillCount: number;
  toolCount: number;
  blockedSkills: string[];
  skills: RSkill[];
};

const WORKFLOWS = [
  {
    icon: FileText,
    title: "Documentos",
    description: "PDFs, Markdown, OCR, resúmenes e informes.",
    prompt:
      "Busca en las skills de R las mejores herramientas para trabajar con documentos PDF. Resume las opciones en 5 puntos y dime cuál usarías para resumir una carpeta de PDFs.",
  },
  {
    icon: Globe2,
    title: "Investigación web",
    description: "Noticias, páginas, fuentes y síntesis.",
    prompt:
      "Haz una investigación web breve sobre las novedades recientes de LM Studio. Usa búsqueda web, lee fuentes relevantes y dame un resumen con enlaces.",
  },
  {
    icon: FolderKanban,
    title: "Archivos locales",
    description: "Ordenar, convertir, renombrar y preparar carpetas.",
    prompt:
      "Busca en las skills de R herramientas para organizar archivos locales. Propón un flujo seguro para ordenar una carpeta de Descargas sin ejecutar cambios todavía.",
  },
  {
    icon: BarChart3,
    title: "Datos",
    description: "CSV, JSON, YAML, SQL y pequeñas estadísticas.",
    prompt:
      "Busca en las skills de R herramientas para CSV, JSON y análisis de datos. Dame 3 ejemplos útiles para una persona no técnica.",
  },
  {
    icon: Code2,
    title: "Código",
    description: "Git, análisis, generación y explicación.",
    prompt:
      "Busca en las skills de R herramientas para trabajar con código y git. Resume cómo podrían ayudar en un proyecto local.",
  },
  {
    icon: Wrench,
    title: "Explorar R",
    description: "Ver catálogo, elegir tools y probar una ejecución.",
    prompt:
      "Usa r_catalog para ver las skills de R disponibles. Dame un mapa compacto por categorías, sin listar todas las tools.",
  },
];

const TRUST_POINTS = [
  "Modelo local vía LM Studio",
  "R skills bajo demanda",
  "Permisos sensibles bloqueados",
  "Web con fuentes y enlaces",
];

const PDF_WORKFLOWS = [
  {
    title: "Resumir PDF",
    tool: "ocr.extract_text_from_pdf",
    description: "Extrae texto, detecta si necesita OCR y devuelve resumen con puntos clave.",
    prompt:
      "Quiero resumir un PDF local. Busca primero tools de R para PDF/OCR, prioriza ocr.extract_text_from_pdf si el documento puede estar escaneado, pideme la ruta del archivo y no ejecutes nada hasta tenerla. Despues resume el contenido con puntos clave, posibles acciones y dudas abiertas.",
  },
  {
    title: "OCR buscable",
    tool: "ocr.ocr_to_searchable_pdf",
    description: "Convierte un escaneado en PDF con texto seleccionable.",
    prompt:
      "Quiero convertir un PDF escaneado en un PDF buscable. Usa r_search_tools para confirmar la tool OCR adecuada, pideme ruta de entrada, ruta de salida e idioma, y luego llama r_call_tool con ocr.ocr_to_searchable_pdf solo cuando tenga esos datos.",
  },
  {
    title: "Unir PDFs",
    tool: "pdftools.pdf_merge",
    description: "Combina varios PDFs en un solo archivo.",
    prompt:
      "Quiero unir varios PDFs locales. Busca la tool de R para merge de PDFs, pideme la lista de rutas en orden y la ruta de salida, verifica que no vas a sobrescribir originales sin permiso, y despues prepara la llamada a pdftools.pdf_merge.",
  },
  {
    title: "Separar páginas",
    tool: "pdftools.pdf_extract",
    description: "Extrae rangos concretos o divide documentos grandes.",
    prompt:
      "Quiero extraer paginas de un PDF. Busca las tools de pdftools, pideme ruta del PDF, paginas o rangos y ruta de salida. No modifiques el original; prepara una llamada segura a pdftools.pdf_extract.",
  },
  {
    title: "Informe PDF",
    tool: "pdf.generate_pdf",
    description: "Genera un informe desde texto o Markdown.",
    prompt:
      "Quiero generar un informe PDF. Busca las tools de R para crear PDFs desde Markdown/texto, pideme titulo, contenido o ruta Markdown, plantilla y ruta de salida. Usa pdf.generate_pdf o pdf.markdown_to_pdf segun convenga.",
  },
  {
    title: "Rotar/comprimir",
    tool: "pdftools.pdf_rotate",
    description: "Arregla orientación o reduce tamaño del documento.",
    prompt:
      "Quiero arreglar un PDF rotando paginas o reduciendo su tamaño. Busca tools de pdftools para rotate/compress, pideme ruta, operacion exacta, paginas afectadas y ruta de salida. Mantén intacto el original.",
  },
];

function App() {
  const agent = useEveAgent({ host: "" });
  const [input, setInput] = useState("");
  const [catalog, setCatalog] = useState<RCatalog | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<string>("pdf");

  const messages = agent.data.messages ?? [];
  const toolEvents = useMemo(
    () =>
      messages.flatMap((message) =>
        message.parts.filter((part) => part.type === "dynamic-tool").map((part) => ({
          id: `${message.id}-${part.toolCallId}`,
          part,
        })),
      ),
    [messages],
  );
  const toolHistory = useMemo(() => summarizeToolEvents(toolEvents), [toolEvents]);

  useEffect(() => {
    let cancelled = false;
    fetch("/r-catalog.json")
      .then((response) => response.json())
      .then((data: RCatalog) => {
        if (!cancelled) {
          setCatalog(data);
          if (!data.skills.some((skill) => skill.name === selectedSkill)) {
            setSelectedSkill(data.skills[0]?.name ?? "");
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSkillData = catalog?.skills.find((skill) => skill.name === selectedSkill);
  const permissionSummary = useMemo(() => getPermissionSummary(catalog), [catalog]);

  const filteredTools = useMemo(() => {
    if (!catalog) {
      return [];
    }

    const query = catalogQuery.trim().toLowerCase();
    const tools = catalog.skills.flatMap((skill) =>
      skill.tools.map((tool) => ({
        ...tool,
        skill: skill.name,
        skillBlocked: skill.blocked,
      })),
    );

    if (!query) {
      return selectedSkillData
        ? selectedSkillData.tools.slice(0, 8).map((tool) => ({
            ...tool,
            skill: selectedSkillData.name,
            skillBlocked: selectedSkillData.blocked,
          }))
        : [];
    }

    return tools
      .filter((tool) =>
        `${tool.skill} ${tool.name} ${tool.description}`.toLowerCase().includes(query),
      )
      .slice(0, 16);
  }, [catalog, catalogQuery, selectedSkillData]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage(input);
  }

  async function sendMessage(value: string) {
    const message = value.trim();
    if (!message || agent.status === "submitted" || agent.status === "streaming") {
      return;
    }
    setInput("");
    await agent.send({ message });
  }

  return (
    <main className="app-shell">
      <section className="sidebar" aria-label="Estado">
        <div>
          <p className="eyebrow">Local agent</p>
          <h1>Eve + LM Studio</h1>
        </div>

        <div className="status-panel">
          <span className={`status-dot ${agent.status}`} />
          <div>
            <strong>{statusLabel(agent.status)}</strong>
            <p>Backend Eve via proxy local</p>
          </div>
        </div>

        <div className="settings-block">
          <span>Modelo</span>
          <strong>{import.meta.env.VITE_MODEL_LABEL || "LM Studio local"}</strong>
        </div>

        <div className="settings-block">
          <span>Tools</span>
          <strong>ABC RSS / R skills / Web search</strong>
        </div>

        <button className="secondary-button" onClick={agent.reset} type="button">
          <RotateCcw size={16} />
          Nueva sesion
        </button>

        <SkillExplorer
          catalog={catalog}
          filteredTools={filteredTools}
          onSelectSkill={setSelectedSkill}
          onUseTool={(skill, tool) => sendMessage(buildToolPrompt(skill, tool))}
          query={catalogQuery}
          selectedSkill={selectedSkill}
          selectedSkillData={selectedSkillData}
          setQuery={setCatalogQuery}
        />

        <PermissionPanel summary={permissionSummary} />

        <ToolLog events={toolEvents} history={toolHistory} />
      </section>

      <section className="chat-panel" aria-label="Chat">
        <div className="messages">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-header">
                <Sparkles size={28} />
                <h2>Elige una tarea para tu ordenador.</h2>
                <p>
                  R aporta 82 skills y 560 tools; Eve las busca y ejecuta bajo demanda para que el modelo local no se ahogue con todo el catálogo.
                </p>
              </div>
              <section className="pdf-workbench" aria-label="Documentos PDF">
                <div className="pdf-workbench-header">
                  <FileText size={18} />
                  <div>
                    <h3>Documentos PDF</h3>
                    <p>OCR, resumen, union, extraccion y generacion de informes con R local.</p>
                  </div>
                </div>
                <div className="pdf-action-grid">
                  {PDF_WORKFLOWS.map((workflow) => (
                    <button
                      className="pdf-action"
                      disabled={agent.status !== "ready"}
                      key={workflow.title}
                      onClick={() => sendMessage(workflow.prompt)}
                      type="button"
                    >
                      <span>{workflow.title}</span>
                      <strong>{workflow.tool}</strong>
                      <p>{workflow.description}</p>
                    </button>
                  ))}
                </div>
              </section>
              <div className="workflow-grid">
                {WORKFLOWS.map((workflow) => (
                  <button
                    className="workflow-card"
                    disabled={agent.status !== "ready"}
                    key={workflow.title}
                    onClick={() => sendMessage(workflow.prompt)}
                    type="button"
                  >
                    <workflow.icon size={19} />
                    <span>{workflow.title}</span>
                    <p>{workflow.description}</p>
                  </button>
                ))}
              </div>
              <div className="trust-strip">
                {TRUST_POINTS.map((point) => (
                  <span key={point}>
                    <ShieldCheck size={14} />
                    {point}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => <ChatMessage key={message.id} message={message} />)
          )}
        </div>

        {agent.error ? <div className="error-box">{String(agent.error.message ?? agent.error)}</div> : null}

        <div className="quickbar" aria-label="Acciones rápidas">
          {WORKFLOWS.slice(0, 4).map((workflow) => (
            <button
              disabled={agent.status !== "ready"}
              key={workflow.title}
              onClick={() => sendMessage(workflow.prompt)}
              type="button"
            >
              <workflow.icon size={15} />
              {workflow.title}
            </button>
          ))}
        </div>

        <form className="composer" onSubmit={onSubmit}>
          <textarea
            aria-label="Mensaje"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Escribe una tarea para Eve..."
            value={input}
          />
          {agent.status === "submitted" || agent.status === "streaming" ? (
            <button aria-label="Detener" onClick={agent.stop} type="button">
              <Square size={18} />
            </button>
          ) : (
            <button aria-label="Enviar" disabled={!input.trim()} type="submit">
              <Send size={18} />
            </button>
          )}
        </form>
      </section>
    </main>
  );
}

function ChatMessage({ message }: { message: EveMessage }) {
  const text = message.parts.map(partToText).filter(Boolean).join("\n\n");

  if (!text.trim()) {
    return null;
  }

  return (
    <article className={`message ${message.role}`}>
      <div className="message-role">{message.role === "user" ? "Tu" : "Eve"}</div>
      <div className="message-body">{text}</div>
    </article>
  );
}

function ToolEvent({ part }: { part: Extract<EveMessagePart, { type: "dynamic-tool" }> }) {
  const query = typeof part.input === "object" && part.input && "query" in part.input
    ? String(part.input.query)
    : typeof part.input === "object" && part.input && "feed" in part.input
      ? `feed: ${String(part.input.feed)}`
    : part.toolName;

  return (
    <div className="tool-event">
      <span className={stateClassName(part.state)}>{stateLabel(part.state)}</span>
      <strong>{part.toolName}</strong>
      <p>{query}</p>
    </div>
  );
}

function ToolLog({
  events,
  history,
}: {
  events: Array<{ id: string; part: Extract<EveMessagePart, { type: "dynamic-tool" }> }>;
  history: ToolHistory;
}) {
  return (
    <div className="tool-log">
      <div className="tool-log-header">
        <div>
          <h2>Historial</h2>
          <p>{history.total ? `${history.total} ejecuciones en esta sesion` : "Sin ejecuciones"}</p>
        </div>
        <Activity size={16} />
      </div>

      {history.total ? (
        <div className="tool-summary" aria-label="Resumen de herramientas">
          <span>{history.finished} terminadas</span>
          <span>{history.running} en curso</span>
          <span>{history.distinctTools} tools</span>
        </div>
      ) : (
        <p className="muted">Las herramientas apareceran aqui cuando el agente actue.</p>
      )}

      {events.length ? (
        <div className="tool-events">
          {events.slice(-8).reverse().map(({ id, part }) => <ToolEvent key={id} part={part} />)}
        </div>
      ) : null}
    </div>
  );
}

function SkillExplorer({
  catalog,
  filteredTools,
  onSelectSkill,
  onUseTool,
  query,
  selectedSkill,
  selectedSkillData,
  setQuery,
}: {
  catalog: RCatalog | null;
  filteredTools: Array<RTool & { skill: string; skillBlocked: boolean }>;
  onSelectSkill: (skill: string) => void;
  onUseTool: (skill: string, tool: RTool) => void;
  query: string;
  selectedSkill: string;
  selectedSkillData?: RSkill;
  setQuery: (query: string) => void;
}) {
  return (
    <div className="skill-panel">
      <div className="skill-panel-header">
        <h2>R skills</h2>
        <span>{catalog ? `${catalog.skillCount} / ${catalog.toolCount}` : "cargando"}</span>
      </div>

      <input
        aria-label="Buscar tools de R"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar PDF, CSV, QR..."
        value={query}
      />

      {catalog ? (
        <>
          <div className="skill-tabs">
            {catalog.skills.slice(0, 12).map((skill) => (
              <button
                className={skill.name === selectedSkill ? "active" : ""}
                key={skill.name}
                onClick={() => {
                  onSelectSkill(skill.name);
                  setQuery("");
                }}
                type="button"
              >
                {skill.name}
              </button>
            ))}
          </div>

          {selectedSkillData && !query ? (
            <p className="skill-summary">
              {selectedSkillData.description || "Skill local de R."}
            </p>
          ) : null}

          <div className="tool-results">
            {filteredTools.slice(0, 6).map((tool) => (
              <div className="tool-result" key={`${tool.skill}.${tool.name}`}>
                <div>
                  <strong>{tool.name}</strong>
                  <span className={tool.skillBlocked ? "blocked" : ""}>
                    {tool.skillBlocked ? "bloqueada" : tool.skill}
                  </span>
                </div>
                <p>{tool.description}</p>
                <button onClick={() => onUseTool(tool.skill, tool)} type="button">
                  Usar
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="skill-summary">Ejecuta `npm run r:catalog` si el catálogo no aparece.</p>
      )}
    </div>
  );
}

function PermissionPanel({ summary }: { summary: PermissionSummary | null }) {
  const visibleBlocked = summary?.blocked.slice(0, 8) ?? [];

  return (
    <div className="permission-panel">
      <div className="permission-title">
        <ShieldAlert size={16} />
        <h2>Permisos</h2>
      </div>

      {summary ? (
        <>
          <div className="permission-meter" aria-label="Resumen de permisos">
            <div>
              <strong>{summary.allowedCount}</strong>
              <span>listas</span>
            </div>
            <div>
              <strong>{summary.blockedCount}</strong>
              <span>bloqueadas</span>
            </div>
          </div>

          <p>
            Las skills sensibles no se ejecutan desde la UI por defecto. Para abrirlas, arranca Eve con
            {" "}
            <code>R_BRIDGE_ALLOW_DANGEROUS=1</code>.
          </p>

          {visibleBlocked.length ? (
            <div className="blocked-list" aria-label="Skills bloqueadas">
              {visibleBlocked.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p>Cargando perfil local de permisos.</p>
      )}
    </div>
  );
}

function buildToolPrompt(skill: string, tool: RTool) {
  return [
    `Quiero usar una tool de R.`,
    `Skill: ${skill}`,
    `Tool: ${tool.name}`,
    `Descripción: ${tool.description}`,
    `Parámetros esperados: ${JSON.stringify(tool.parameters ?? {}, null, 2)}`,
    `Primero explícame qué datos necesitas. Si ya tienes todos los datos, llama r_call_tool con esos parámetros.`,
  ].join("\n");
}

function partToText(part: EveMessagePart) {
  if (part.type === "text") {
    return part.text;
  }

  return "";
}

function statusLabel(status: string) {
  if (status === "submitted") {
    return "Enviando";
  }
  if (status === "streaming") {
    return "Respondiendo";
  }
  if (status === "error") {
    return "Error";
  }
  return "Listo";
}

type PermissionSummary = {
  allowedCount: number;
  blocked: string[];
  blockedCount: number;
};

type ToolHistory = {
  distinctTools: number;
  finished: number;
  running: number;
  total: number;
};

function getPermissionSummary(catalog: RCatalog | null): PermissionSummary | null {
  if (!catalog) {
    return null;
  }

  const blocked = catalog.blockedSkills.length
    ? catalog.blockedSkills
    : catalog.skills.filter((skill) => skill.blocked).map((skill) => skill.name);

  return {
    allowedCount: catalog.skillCount - blocked.length,
    blocked,
    blockedCount: blocked.length,
  };
}

function summarizeToolEvents(
  events: Array<{ id: string; part: Extract<EveMessagePart, { type: "dynamic-tool" }> }>,
): ToolHistory {
  const tools = new Set(events.map(({ part }) => part.toolName));
  const running = events.filter(({ part }) =>
    ["input-streaming", "input-available"].includes(part.state),
  ).length;
  const finished = events.filter(({ part }) =>
    ["output-available", "output-error"].includes(part.state),
  ).length;

  return {
    distinctTools: tools.size,
    finished,
    running,
    total: events.length,
  };
}

function stateLabel(state: string) {
  if (state === "output-available") {
    return "terminada";
  }
  if (state === "output-error") {
    return "error";
  }
  if (state === "input-streaming" || state === "input-available") {
    return "en curso";
  }
  return state;
}

function stateClassName(state: string) {
  if (state === "output-error") {
    return "error";
  }
  if (state === "output-available") {
    return "done";
  }
  return "running";
}

createRoot(document.getElementById("root")!).render(<App />);
