import { useEveAgent } from "eve/react";
import type { EveMessage, EveMessagePart } from "eve/client";
import { summarizeGuardedAction, summarizeNativeApprovalAction } from "../agent/lib/guardedTools.js";
import {
  Activity,
  BarChart3,
  Code2,
  FileText,
  FolderKanban,
  Globe2,
  Mail,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  type LucideIcon,
  Wrench,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { type Lang, loadLang, saveLang, t } from "./i18n.js";
import { assessCapability, type Capability, matchCapabilities } from "./capabilities.js";
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

type HealthState = "ready" | "warning" | "offline" | "info";

type HealthCheck = {
  detail: string;
  key: string;
  label: string;
  state: HealthState;
};

type HealthStatus = {
  checks: HealthCheck[];
  generatedAt: string;
};

type ResearchNote = {
  id: string;
  modifiedAt: string;
  path: string;
  size: number;
  title: string;
};

type ResearchNotesResponse = {
  notes: ResearchNote[];
  root: string;
};

type ResearchNoteContent = {
  id: string;
  markdown: string;
  path: string;
  title: string;
};

type LocalizedAction = {
  title: string;
  description: string;
  hint: string;
  prompt: string;
};

type LocalizedEntry = Record<Lang, LocalizedAction>;

const WORKFLOWS: Array<{ icon: LucideIcon } & LocalizedEntry> = [
  {
    icon: FileText,
    en: {
      title: "Documents",
      description: "PDFs, Markdown, OCR, summaries, and reports.",
      hint: "Find the right local R tools for document work.",
      prompt:
        "Find the best local R skills for PDF and document work. Summarize the best options in 5 concise points and recommend the safest workflow for summarizing a folder of PDFs.",
    },
    es: {
      title: "Documentos",
      description: "PDF, Markdown, OCR, resumenes e informes.",
      hint: "Encuentra las herramientas R locales adecuadas para trabajar con documentos.",
      prompt:
        "Encuentra las mejores habilidades R locales para trabajar con PDF y documentos. Resume las mejores opciones en 5 puntos concisos y recomienda el flujo de trabajo mas seguro para resumir una carpeta de PDF.",
    },
  },
  {
    icon: Globe2,
    en: {
      title: "Web research",
      description: "Search, read sources, compare, and summarize.",
      hint: "Search the web and return source-backed notes.",
      prompt:
        "Search the web for recent LM Studio updates. Use web_search, return the best source cards with links, and clearly say if deeper page reading should be enabled.",
    },
    es: {
      title: "Investigacion web",
      description: "Busca, lee fuentes, compara y resume.",
      hint: "Busca en la web y devuelve notas respaldadas por fuentes.",
      prompt:
        "Busca en la web actualizaciones recientes de LM Studio. Usa web_search, devuelve las mejores fuentes con enlaces y di claramente si conviene activar lectura profunda.",
    },
  },
  {
    icon: FolderKanban,
    en: {
      title: "Local files",
      description: "Organize, convert, rename, and prepare folders.",
      hint: "Plan safe local file operations before running them.",
      prompt:
        "Find local R skills for organizing files. Propose a safe workflow for cleaning a Downloads folder without making changes yet.",
    },
    es: {
      title: "Archivos locales",
      description: "Organiza, convierte, renombra y prepara carpetas.",
      hint: "Planifica operaciones locales seguras antes de ejecutarlas.",
      prompt:
        "Encuentra habilidades R locales para organizar archivos. Propone un flujo de trabajo seguro para limpiar una carpeta Descargas sin hacer cambios todavia.",
    },
  },
  {
    icon: BarChart3,
    en: {
      title: "Data",
      description: "CSV, JSON, YAML, SQL, and small statistics.",
      hint: "Explore data tools for lightweight local analysis.",
      prompt:
        "Find R skills for CSV, JSON, and data analysis. Give 3 useful examples for a non-technical person.",
    },
    es: {
      title: "Datos",
      description: "CSV, JSON, YAML, SQL y estadistica ligera.",
      hint: "Explora herramientas de datos para analisis local sencillo.",
      prompt:
        "Encuentra habilidades R para CSV, JSON y analisis de datos. Da 3 ejemplos utiles para una persona no tecnica.",
    },
  },
  {
    icon: Code2,
    en: {
      title: "Code",
      description: "Git, analysis, generation, and explanation.",
      hint: "Use local tools to inspect and improve code projects.",
      prompt:
        "Find R skills for code and git workflows. Summarize how they could help with a local project.",
    },
    es: {
      title: "Codigo",
      description: "Git, analisis, generacion y explicacion.",
      hint: "Usa herramientas locales para inspeccionar y mejorar proyectos de codigo.",
      prompt:
        "Encuentra habilidades R para flujos de trabajo de codigo y git. Resume como podrian ayudar con un proyecto local.",
    },
  },
  {
    icon: Mail,
    en: {
      title: "Communication",
      description: "Email drafts and WhatsApp reply drafts with approval gates.",
      hint: "Check experimental connectors before reading or creating drafts.",
      prompt:
        "Explain that email and WhatsApp connectors are optional tool packs. Describe the safe draft-only workflow and say they must be enabled before use. Do not send anything.",
    },
    es: {
      title: "Comunicacion",
      description: "Borradores de email y WhatsApp con aprobacion humana.",
      hint: "Comprueba los conectores experimentales antes de leer o crear borradores.",
      prompt:
        "Explica que los conectores de email y WhatsApp son packs opcionales. Describe el flujo seguro de borradores y di que deben activarse antes de usarlos. No envies nada.",
    },
  },
  {
    icon: Wrench,
    en: {
      title: "Explore R",
      description: "Browse the catalog, choose tools, and test safely.",
      hint: "Map the installed R skill catalog without flooding the model.",
      prompt:
        "Use r_catalog to inspect the available R skills. Return a compact category map without listing every tool.",
    },
    es: {
      title: "Explorar R",
      description: "Revisa el catalogo, elige herramientas y prueba con seguridad.",
      hint: "Mapea el catalogo de habilidades R instalado sin saturar el modelo.",
      prompt:
        "Usa r_catalog para inspeccionar las habilidades R disponibles. Devuelve un mapa compacto por categorias sin listar todas las herramientas.",
    },
  },
];

const TRUST_POINTS: Array<Record<Lang, string>> = [
  { en: "Local model via LM Studio", es: "Modelo local via LM Studio" },
  { en: "R skills on demand", es: "Habilidades R bajo demanda" },
  { en: "Sensitive actions blocked", es: "Acciones sensibles bloqueadas" },
  { en: "Source-backed web research", es: "Investigacion web con fuentes" },
];

const SKILL_FORGE_ACTION: LocalizedEntry = {
  en: {
    title: "Forge a missing skill",
    description:
      "When no existing R tool fits, draft a new skill package with schema, tests, permissions, and an approval checklist.",
    hint: "Search first, then generate a reviewable draft skill. Nothing is installed automatically.",
    prompt:
      "I need a capability that may not exist yet. First search the R catalog for a good existing fit. If there is no good fit, explain the gap, ask me for the exact workflow, and tell me Skill Forge is an optional pack that must be enabled before generating a draft. Do not install or execute generated code.",
  },
  es: {
    title: "Forjar una habilidad que falta",
    description:
      "Cuando ninguna herramienta R existente encaje, redacta un nuevo paquete de habilidad con esquema, pruebas, permisos y una lista de aprobacion.",
    hint: "Busca primero y luego genera un borrador de habilidad revisable. Nada se instala automaticamente.",
    prompt:
      "Necesito una capacidad que quiza no exista todavia. Primero busca en el catalogo R una opcion existente que encaje bien. Si no hay una buena opcion, explica la carencia, pideme el flujo exacto y dime que Skill Forge es un pack opcional que debe activarse antes de generar borradores. No instales ni ejecutes codigo generado.",
  },
};

const PDF_WORKFLOWS: Array<{ tool: string } & LocalizedEntry> = [
  {
    tool: "ocr.extract_text_from_pdf",
    en: {
      title: "Summarize",
      description: "Extract text, detect scanned pages, and produce structured notes.",
      hint: "Ask for a PDF path, extract text locally, then summarize it.",
      prompt:
        "I want to summarize a local PDF. First search R PDF/OCR tools, prefer ocr.extract_text_from_pdf if the file may be scanned, ask me for the input path, and do not run anything until you have it. Then summarize the content with key points, action items, and open questions.",
    },
    es: {
      title: "Resumir",
      description: "Extrae texto, detecta paginas escaneadas y genera notas estructuradas.",
      hint: "Pide la ruta de un PDF, extrae texto localmente y luego resumelo.",
      prompt:
        "Quiero resumir un PDF local. Primero busca herramientas R de PDF/OCR, prioriza ocr.extract_text_from_pdf si el archivo podria estar escaneado, pideme la ruta de entrada y no ejecutes nada hasta tenerla. Luego resume el contenido con puntos clave, tareas y preguntas abiertas.",
    },
  },
  {
    tool: "ocr.ocr_to_searchable_pdf",
    en: {
      title: "Searchable OCR",
      description: "Turn scanned documents into selectable, searchable PDFs.",
      hint: "Create a new searchable PDF without touching the original.",
      prompt:
        "I want to convert a scanned PDF into a searchable PDF. Use r_search_tools to confirm the right OCR tool, ask for input path, output path, and language, then call r_call_tool with ocr.ocr_to_searchable_pdf only after you have those details.",
    },
    es: {
      title: "OCR buscable",
      description: "Convierte documentos escaneados en PDF seleccionables y buscables.",
      hint: "Crea un nuevo PDF buscable sin tocar el original.",
      prompt:
        "Quiero convertir un PDF escaneado en un PDF buscable. Usa r_search_tools para confirmar la herramienta OCR adecuada, pide ruta de entrada, ruta de salida e idioma, y llama a r_call_tool con ocr.ocr_to_searchable_pdf solo despues de tener esos datos.",
    },
  },
  {
    tool: "pdftools.pdf_merge",
    en: {
      title: "Merge",
      description: "Combine multiple PDFs into one ordered output file.",
      hint: "Ask for ordered input paths and a new output path.",
      prompt:
        "I want to merge several local PDFs. Find the R merge tool, ask for the ordered input paths and output path, verify that originals will not be overwritten, then prepare the pdftools.pdf_merge call.",
    },
    es: {
      title: "Unir",
      description: "Combina varios PDF en un unico archivo de salida ordenado.",
      hint: "Pide rutas de entrada ordenadas y una nueva ruta de salida.",
      prompt:
        "Quiero unir varios PDF locales. Encuentra la herramienta R para unir PDF, pide las rutas de entrada en orden y la ruta de salida, verifica que no se sobrescribiran los originales y luego prepara la llamada a pdftools.pdf_merge.",
    },
  },
  {
    tool: "pdftools.pdf_extract",
    en: {
      title: "Extract pages",
      description: "Pull out selected pages or ranges into a new PDF.",
      hint: "Extract a page range while preserving the source document.",
      prompt:
        "I want to extract pages from a PDF. Search pdftools, ask for the input PDF path, pages or ranges, and output path. Do not modify the original; prepare a safe pdftools.pdf_extract call.",
    },
    es: {
      title: "Extraer paginas",
      description: "Extrae paginas o rangos seleccionados a un PDF nuevo.",
      hint: "Extrae un rango de paginas conservando el documento de origen.",
      prompt:
        "Quiero extraer paginas de un PDF. Busca en pdftools, pide la ruta del PDF de entrada, las paginas o rangos y la ruta de salida. No modifiques el original; prepara una llamada segura a pdftools.pdf_extract.",
    },
  },
  {
    tool: "pdf.generate_pdf",
    en: {
      title: "Report",
      description: "Generate polished PDFs from text or Markdown.",
      hint: "Turn notes or Markdown into a clean report file.",
      prompt:
        "I want to generate a PDF report. Search R tools for creating PDFs from text or Markdown, ask for title, content or Markdown path, template, and output path. Use pdf.generate_pdf or pdf.markdown_to_pdf as appropriate.",
    },
    es: {
      title: "Informe",
      description: "Genera PDF cuidados desde texto o Markdown.",
      hint: "Convierte notas o Markdown en un informe limpio.",
      prompt:
        "Quiero generar un informe PDF. Busca herramientas R para crear PDF desde texto o Markdown, pide titulo, contenido o ruta Markdown, plantilla y ruta de salida. Usa pdf.generate_pdf o pdf.markdown_to_pdf segun corresponda.",
    },
  },
  {
    tool: "pdftools.pdf_rotate",
    en: {
      title: "Repair",
      description: "Rotate pages or compress large PDFs safely.",
      hint: "Fix orientation or reduce file size into a new output.",
      prompt:
        "I want to repair a PDF by rotating pages or reducing file size. Search pdftools for rotate/compress tools, ask for path, exact operation, affected pages, and output path. Keep the original intact.",
    },
    es: {
      title: "Reparar",
      description: "Rota paginas o comprime PDF grandes con seguridad.",
      hint: "Corrige la orientacion o reduce el tamano en una nueva salida.",
      prompt:
        "Quiero reparar un PDF rotando paginas o reduciendo el tamano del archivo. Busca en pdftools herramientas para rotar o comprimir, pide ruta, operacion exacta, paginas afectadas y ruta de salida. Manten intacto el original.",
    },
  },
];

const RESEARCH_WORKFLOWS: Array<{ mode: string } & LocalizedEntry> = [
  {
    mode: "quick",
    en: {
      title: "Quick brief",
      description: "Find and read the top sources, then answer with links.",
      hint: "Best for current facts, product updates, and news checks.",
      prompt:
        "Use web_search for this question: What changed recently in local AI desktop apps? Return the best source cards with links and a concise brief.",
    },
    es: {
      title: "Resumen rapido",
      description: "Encuentra y lee las mejores fuentes, luego responde con enlaces.",
      hint: "Ideal para hechos actuales, novedades de producto y noticias.",
      prompt:
        "Usa web_search para esta pregunta: Que ha cambiado recientemente en las apps de IA local de escritorio? Devuelve las mejores fuentes con enlaces y un resumen conciso.",
    },
  },
  {
    mode: "deep",
    en: {
      title: "Deep research",
      description: "Collect more candidates, read several sources, and compare evidence.",
      hint: "Use this when the answer needs stronger source quality.",
      prompt:
        "Explain that deep research is an optional tool pack. Ask me for the exact research question and offer to enable the research pack, or do a compact web_search pass now.",
    },
    es: {
      title: "Investigacion profunda",
      description: "Reune mas candidatos, lee varias fuentes y compara evidencia.",
      hint: "Usalo cuando la respuesta necesite fuentes mas solidas.",
      prompt:
        "Explica que la investigacion profunda es un pack opcional. Pideme la pregunta exacta y ofrece activar el pack de research, o hacer ahora una busqueda compacta con web_search.",
    },
  },
  {
    mode: "save",
    en: {
      title: "Save note",
      description: "Turn research into a Markdown file in the workspace.",
      hint: "Use after a research pass to keep sources and summary.",
      prompt:
        "Explain that saved research notes use the optional research pack. Offer to enable it, or provide a compact web_search summary I can copy for now.",
    },
    es: {
      title: "Guardar nota",
      description: "Convierte la investigacion en un Markdown dentro del workspace.",
      hint: "Usalo despues de investigar para conservar fuentes y resumen.",
      prompt:
        "Explica que guardar notas de investigacion usa el pack opcional de research. Ofrece activarlo, o da por ahora un resumen compacto con web_search que pueda copiar.",
    },
  },
  {
    mode: "site",
    en: {
      title: "Specific site",
      description: "Search inside a chosen domain and read the actual pages.",
      hint: "Useful for newspapers, docs, government sites, and vendors.",
      prompt:
        "Ask me for the domain and question, then use web_search with a site: query. Include links and say if deeper page reading should be enabled.",
    },
    es: {
      title: "Sitio concreto",
      description: "Busca dentro de un dominio elegido y lee las paginas reales.",
      hint: "Util para periodicos, docs, webs publicas y proveedores.",
      prompt:
        "Pideme el dominio y la pregunta, luego usa web_search con una consulta site:. Incluye enlaces y di si conviene activar lectura profunda.",
    },
  },
];

function App() {
  const agent = useEveAgent({ host: "" });
  const [lang, setLang] = useState<Lang>(loadLang);
  const [input, setInput] = useState("");
  const [catalog, setCatalog] = useState<RCatalog | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [researchNotes, setResearchNotes] = useState<ResearchNotesResponse | null>(null);
  const [selectedResearchNote, setSelectedResearchNote] = useState<ResearchNoteContent | null>(null);
  const [researchNotesLoading, setResearchNotesLoading] = useState(false);
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

  const pendingApproval = useMemo(() => {
    // Scan newest-first so the card always reflects the latest pending request.
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      for (const part of messages[i].parts) {
        if (part.type === "dynamic-tool" && part.state === "approval-requested") {
          return part;
        }
      }
    }
    return null;
  }, [messages]);

  async function respondToApproval(requestId: string, optionId: string) {
    if (agent.status === "submitted" || agent.status === "streaming") {
      return;
    }
    await agent.send({ inputResponses: [{ requestId, optionId }] });
  }

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

  async function refreshHealth() {
    setHealthLoading(true);
    try {
      const response = await fetch("/api/health");
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      setHealth((await response.json()) as HealthStatus);
    } catch {
      setHealth({
        generatedAt: new Date().toISOString(),
        checks: [
          {
            key: "health",
            label: "Health",
            state: "warning",
            detail: "Start the Vite web server to enable local diagnostics.",
          },
        ],
      });
    } finally {
      setHealthLoading(false);
    }
  }

  useEffect(() => {
    void refreshHealth();
  }, []);

  async function refreshResearchNotes() {
    setResearchNotesLoading(true);
    try {
      const response = await fetch("/api/research-notes");
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const payload = (await response.json()) as ResearchNotesResponse;
      setResearchNotes(payload);
      if (selectedResearchNote && !payload.notes.some((note) => note.id === selectedResearchNote.id)) {
        setSelectedResearchNote(null);
      }
    } catch {
      setResearchNotes({ notes: [], root: "" });
    } finally {
      setResearchNotesLoading(false);
    }
  }

  async function openResearchNote(id: string) {
    const response = await fetch(`/api/research-notes?id=${encodeURIComponent(id)}`);
    if (!response.ok) {
      return;
    }
    setSelectedResearchNote((await response.json()) as ResearchNoteContent);
  }

  useEffect(() => {
    void refreshResearchNotes();
  }, []);

  useEffect(() => {
    if (!selectedResearchNote && researchNotes?.notes[0]) {
      void openResearchNote(researchNotes.notes[0].id);
    }
  }, [researchNotes, selectedResearchNote]);

  const selectedSkillData = catalog?.skills.find((skill) => skill.name === selectedSkill);
  const permissionSummary = useMemo(() => getPermissionSummary(catalog), [catalog]);
  const skillForgeAction = SKILL_FORGE_ACTION[lang];

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

  function changeLang(next: Lang) {
    setLang(next);
    saveLang(next);
  }

  return (
    <main className="app-shell">
      <section className="sidebar" aria-label={t(lang, "aria.systemStatus")}>
        <div className="brand-lockup">
          <p className="eyebrow">{t(lang, "brand.eyebrow")}</p>
          <h1>AI Native OS</h1>
          <span>{t(lang, "brand.subtitle")}</span>
        </div>

        <div className="lang-toggle" aria-label={t(lang, "aria.langToggle")}>
          {(["es", "en"] as const).map((option) => (
            <button
              aria-pressed={lang === option}
              className={lang === option ? "active" : ""}
              key={option}
              onClick={() => changeLang(option)}
              type="button"
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="status-panel">
          <span className={`status-dot ${agent.status}`} />
          <div>
            <strong>{statusLabel(agent.status, lang)}</strong>
            <p>{t(lang, "status.backend")}</p>
          </div>
        </div>

        <SkillExplorer
          catalog={catalog}
          filteredTools={filteredTools}
          lang={lang}
          onSelectSkill={setSelectedSkill}
          onUseTool={(skill, tool) => sendMessage(buildToolPrompt(skill, tool, lang))}
          query={catalogQuery}
          selectedSkill={selectedSkill}
          selectedSkillData={selectedSkillData}
          setQuery={setCatalogQuery}
        />

        <div className="settings-block">
          <span>{t(lang, "model.label")}</span>
          <strong>{import.meta.env.VITE_MODEL_LABEL || t(lang, "model.fallback")}</strong>
        </div>

        <div className="settings-block">
          <span>{t(lang, "tools.label")}</span>
          <strong>{t(lang, "tools.value")}</strong>
        </div>

        <button
          className="secondary-button tooltip-control"
          data-tooltip={t(lang, "reset.tooltip")}
          onClick={agent.reset}
          title={t(lang, "reset.tooltip")}
          type="button"
        >
          <RotateCcw size={16} />
          {t(lang, "reset.label")}
        </button>

        <PermissionPanel lang={lang} summary={permissionSummary} />

        <ToolLog events={toolEvents} history={toolHistory} lang={lang} />
      </section>

      <section className="chat-panel" aria-label={t(lang, "aria.chat")}>
        <div className="messages">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-inner">
                <h2 className="welcome-greeting">{t(lang, "welcome.greeting")}</h2>
                <p className="welcome-sub">{t(lang, "welcome.sub")}</p>
                <div className="welcome-chips">
                  {INTENT_EXAMPLES.map((example) => (
                    <button
                      className="welcome-chip"
                      disabled={agent.status !== "ready"}
                      key={example.en}
                      onClick={() => sendMessage(example[lang])}
                      type="button"
                    >
                      {example[lang]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => <ChatMessage key={message.id} lang={lang} message={message} />)
          )}
        </div>

        {agent.error ? <div className="error-box">{String(agent.error.message ?? agent.error)}</div> : null}

        {pendingApproval ? (
          <ApprovalCard
            busy={agent.status === "submitted" || agent.status === "streaming"}
            lang={lang}
            onRespond={respondToApproval}
            part={pendingApproval}
          />
        ) : null}

        <form className="composer" onSubmit={onSubmit}>
          <textarea
            aria-label={t(lang, "aria.message")}
            disabled={Boolean(pendingApproval)}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={
              pendingApproval
                ? t(lang, "composer.pending")
                : t(lang, "composer.placeholder")
            }
            value={input}
          />
          {agent.status === "submitted" || agent.status === "streaming" ? (
            <button
              aria-label={t(lang, "composer.stop")}
              className="tooltip-control"
              data-tooltip={t(lang, "composer.stopTooltip")}
              onClick={agent.stop}
              title={t(lang, "composer.stopTooltip")}
              type="button"
            >
              <Square size={18} />
            </button>
          ) : (
            <button
              aria-label={t(lang, "composer.send")}
              className="tooltip-control"
              data-tooltip={t(lang, "composer.sendTooltip")}
              disabled={!input.trim() || Boolean(pendingApproval)}
              title={t(lang, "composer.sendTooltip")}
              type="submit"
            >
              <Send size={18} />
            </button>
          )}
        </form>
      </section>
    </main>
  );
}

function ChatMessage({ lang, message }: { lang: Lang; message: EveMessage }) {
  const text = message.parts.map(partToText).filter(Boolean).join("\n\n");

  if (!text.trim()) {
    return null;
  }

  return (
    <article className={`message ${message.role}`}>
      <div className="message-role">{message.role === "user" ? t(lang, "user.you") : "Eve"}</div>
      <div className="message-body">{text}</div>
    </article>
  );
}

const INTENT_EXAMPLES: Record<Lang, string>[] = [
  { es: "Resume estos PDFs", en: "Summarize these PDFs" },
  { es: "Redacta un email a un cliente", en: "Draft an email to a client" },
  { es: "Consulta una ley en el BOE", en: "Look up a Spanish law (BOE)" },
  { es: "Busca en la web y resume", en: "Search the web and summarize" },
  { es: "Ordena mis archivos", en: "Organize my files" },
];

function IntentChecker({
  agentStatus,
  health,
  lang,
  onAsk,
  onRunDiagnostics,
}: {
  agentStatus: string;
  health: HealthStatus | null;
  lang: Lang;
  onAsk: (text: string) => void;
  onRunDiagnostics: () => void;
}) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState("");

  // A capability requirement is met only when its health check is "ready".
  // "info" means optional-but-not-running (e.g. Lexia offline), which does not
  // satisfy a capability that actually needs that service.
  const readyKeys = useMemo(() => {
    const set = new Set<string>();
    for (const check of health?.checks ?? []) {
      if (check.state === "ready") {
        set.add(check.key);
      }
    }
    return set;
  }, [health]);

  const matches = useMemo(() => (submitted ? matchCapabilities(submitted) : []), [submitted]);
  const busy = agentStatus === "submitted" || agentStatus === "streaming";

  function check(value: string) {
    const next = value.trim();
    setText(next);
    setSubmitted(next);
  }

  const checkFor = (key: string) => health?.checks.find((entry) => entry.key === key);

  return (
    <section className="intent-checker" aria-label={t(lang, "intent.title")}>
      <form
        className="intent-form"
        onSubmit={(event) => {
          event.preventDefault();
          check(text);
        }}
      >
        <label className="intent-label" htmlFor="intent-input">
          {t(lang, "intent.title")}
        </label>
        <div className="intent-row">
          <input
            className="intent-input"
            id="intent-input"
            onChange={(event) => setText(event.target.value)}
            placeholder={t(lang, "intent.placeholder")}
            value={text}
          />
          <button className="intent-check" disabled={!text.trim()} type="submit">
            {t(lang, "intent.check")}
          </button>
        </div>
      </form>

      <div className="intent-examples">
        <span>{t(lang, "intent.examplesLabel")}</span>
        {INTENT_EXAMPLES.map((example) => (
          <button className="intent-chip" key={example.en} onClick={() => check(example[lang])} type="button">
            {example[lang]}
          </button>
        ))}
      </div>

      {submitted && matches.length === 0 ? (
        <div className="intent-card unknown">
          <div className="intent-verdict">
            <ShieldAlert size={16} />
            <strong>{t(lang, "intent.verdict.unknown")}</strong>
          </div>
          <p className="intent-how">{t(lang, "intent.unknownHelp")}</p>
          <div className="intent-actions">
            <button className="intent-ask" disabled={busy} onClick={() => onAsk(submitted)} type="button">
              {t(lang, "intent.ask")}
            </button>
            <button className="intent-diag" onClick={onRunDiagnostics} type="button">
              {t(lang, "intent.diagnostics")}
            </button>
          </div>
        </div>
      ) : null}

      {matches.map((capability: Capability) => {
        const { verdict, missing } = assessCapability(capability, readyKeys);
        const copy = capability.copy[lang];
        return (
          <div className={`intent-card ${verdict}`} key={capability.id}>
            <div className="intent-verdict">
              {verdict === "ready" ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
              <strong>{copy.title}</strong>
              <span className={`intent-badge ${verdict}`}>
                {verdict === "ready" ? t(lang, "intent.verdict.ready") : t(lang, "intent.verdict.setup")}
              </span>
            </div>
            <p className="intent-how">{copy.what}</p>
            <div className="intent-meta">
              <div className="intent-need">
                <span>{t(lang, "intent.youProvide")}</span>
                <p>{copy.provide}</p>
              </div>
              {missing.length > 0 ? (
                <div className="intent-need">
                  <span>{t(lang, "intent.setupNeeded")}</span>
                  <ul>
                    {missing.map((key) => {
                      const check = checkFor(key);
                      return (
                        <li key={key}>
                          {check ? localizedHealthLabel(check.label, lang) : key}
                          {check ? <em> — {localizedHealthDetail(check, lang)}</em> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              <p className="intent-guard">
                <ShieldCheck size={13} />{" "}
                {t(lang, capability.guarded ? "intent.guardrail.approval" : "intent.guardrail.general")}
              </p>
            </div>
            <div className="intent-actions">
              <button className="intent-ask" disabled={busy} onClick={() => onAsk(submitted)} type="button">
                {t(lang, "intent.ask")}
              </button>
              {missing.length > 0 ? (
                <button className="intent-diag" onClick={onRunDiagnostics} type="button">
                  {t(lang, "intent.diagnostics")}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function ApprovalCard({
  busy,
  lang,
  onRespond,
  part,
}: {
  busy: boolean;
  lang: Lang;
  onRespond: (requestId: string, optionId: string) => void;
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
}) {
  const request = part.toolMetadata?.eve?.inputRequest;
  if (!request) {
    return null;
  }

  const input = (part.input ?? {}) as { skill?: unknown; tool?: unknown; params?: unknown };
  const summary =
    typeof input.skill === "string" && typeof input.tool === "string"
      ? summarizeGuardedAction(
          input.skill,
          input.tool,
          (input.params as Record<string, unknown>) ?? {},
          lang,
        )
      : summarizeNativeApprovalAction(part.toolName, (part.input as Record<string, unknown>) ?? {}, lang) ??
        request.prompt;

  const options =
    request.options && request.options.length > 0
      ? request.options
      : [
          { id: "approve", label: t(lang, "approval.approve"), style: "primary" as const },
          { id: "deny", label: t(lang, "approval.cancel"), style: "danger" as const },
        ];

  return (
    <div className="approval-card" role="alertdialog" aria-label={t(lang, "approval.aria")}>
      <div className="approval-head">
        <ShieldAlert size={18} />
        <strong>{t(lang, "approval.title")}</strong>
      </div>
      <p className="approval-summary">{summary}</p>
      <div className="approval-actions">
        {options.map((option) => (
          <button
            className={`approval-button ${option.style === "danger" ? "danger" : "primary"}`}
            disabled={busy}
            key={option.id}
            onClick={() => onRespond(request.requestId, option.id)}
            type="button"
          >
            {option.id === "approve"
              ? t(lang, "approval.approve")
              : option.id === "deny"
                ? t(lang, "approval.cancel")
                : option.label}
          </button>
        ))}
      </div>
      <p className="approval-note">{t(lang, "approval.note")}</p>
    </div>
  );
}

function ToolEvent({ lang, part }: { lang: Lang; part: Extract<EveMessagePart, { type: "dynamic-tool" }> }) {
  const query = typeof part.input === "object" && part.input && "query" in part.input
    ? String(part.input.query)
    : typeof part.input === "object" && part.input && "feed" in part.input
      ? `feed: ${String(part.input.feed)}`
    : part.toolName;

  return (
    <div className="tool-event">
      <span className={stateClassName(part.state)}>{stateLabel(part.state, lang)}</span>
      <strong>{part.toolName}</strong>
      <p>{query}</p>
    </div>
  );
}

function ToolLog({
  events,
  history,
  lang,
}: {
  events: Array<{ id: string; part: Extract<EveMessagePart, { type: "dynamic-tool" }> }>;
  history: ToolHistory;
  lang: Lang;
}) {
  return (
    <div className="tool-log">
      <div className="tool-log-header">
        <div>
          <h2>{t(lang, "toolLog.history")}</h2>
          <p>
            {history.total
              ? `${history.total} ${t(lang, "toolLog.runsThisSession")}`
              : t(lang, "toolLog.empty")}
          </p>
        </div>
        <Activity size={16} />
      </div>

      {history.total ? (
        <div className="tool-summary" aria-label={t(lang, "aria.toolSummary")}>
          <span>{history.finished} {t(lang, "toolLog.finished")}</span>
          <span>{history.running} {t(lang, "toolLog.running")}</span>
          <span>{history.distinctTools} {t(lang, "toolLog.tools")}</span>
        </div>
      ) : (
        <p className="muted">{t(lang, "toolLog.muted")}</p>
      )}

      {events.length ? (
        <div className="tool-events">
          {events.slice(-8).reverse().map(({ id, part }) => (
            <ToolEvent key={id} lang={lang} part={part} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HealthPanel({
  health,
  lang,
  loading,
  onRefresh,
}: {
  health: HealthStatus | null;
  lang: Lang;
  loading: boolean;
  onRefresh: () => void;
}) {
  const checks = health?.checks ?? [];
  const summary = summarizeHealth(checks);

  return (
    <section className="health-panel" aria-label={t(lang, "health.title")}>
      <div className="health-header">
        <div>
          <p className="eyebrow">{t(lang, "health.eyebrow")}</p>
          <h3>{t(lang, "health.title")}</h3>
        </div>
        <button
          className="tooltip-control"
          data-tooltip={t(lang, "health.refreshTooltip")}
          disabled={loading}
          onClick={onRefresh}
          title={t(lang, "health.refreshTooltip")}
          type="button"
        >
          <RotateCcw size={15} />
          {loading ? t(lang, "health.checking") : t(lang, "health.refresh")}
        </button>
      </div>

      <div className="health-summary">
        <span className="ready">{summary.ready} {t(lang, "health.ready")}</span>
        <span className="warning">{summary.warning} {t(lang, "health.needsSetup")}</span>
      </div>

      <div className="health-grid">
        {(checks.length ? checks : placeholderHealth(lang)).map((check) => (
          <div className={`health-check ${check.state}`} key={check.key}>
            <span>{healthStateLabel(check.state, lang)}</span>
            <strong>{localizedHealthLabel(check.label, lang)}</strong>
            <p>{localizedHealthDetail(check, lang)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResearchCollections({
  lang,
  loading,
  note,
  notes,
  onExport,
  onOpen,
  onRefresh,
  root,
}: {
  lang: Lang;
  loading: boolean;
  note: ResearchNoteContent | null;
  notes: ResearchNote[];
  onExport: (id: string, formats: Array<"pdf" | "txt">) => void;
  onOpen: (id: string) => void;
  onRefresh: () => void;
  root: string;
}) {
  return (
    <section className="research-collections" aria-label={t(lang, "collections.title")}>
      <div className="research-collections-header">
        <div>
          <p className="eyebrow">{t(lang, "collections.eyebrow")}</p>
          <h3>{t(lang, "collections.title")}</h3>
        </div>
        <button
          className="tooltip-control"
          data-tooltip={t(lang, "collections.refreshTooltip")}
          disabled={loading}
          onClick={onRefresh}
          title={t(lang, "collections.refreshTooltip")}
          type="button"
        >
          <RotateCcw size={15} />
          {loading ? t(lang, "health.checking") : t(lang, "health.refresh")}
        </button>
      </div>

      <p className="collection-root">{root || t(lang, "collections.rootPending")}</p>

      {notes.length ? (
        <div className="collection-layout">
          <div className="collection-list">
            {notes.slice(0, 6).map((item) => (
              <button
                className={note?.id === item.id ? "active" : ""}
                key={item.id}
                onClick={() => onOpen(item.id)}
                type="button"
              >
                <strong>{item.title}</strong>
                <span>{formatDate(item.modifiedAt, lang)} · {formatBytes(item.size)}</span>
              </button>
            ))}
          </div>
          <article className="collection-preview">
            {note ? (
              <>
                <strong>{note.title}</strong>
                <p>{note.path}</p>
                <div className="collection-export-actions">
                  <button onClick={() => onExport(note.id, ["txt"])} type="button">
                    {t(lang, "collections.exportText")}
                  </button>
                  <button onClick={() => onExport(note.id, ["pdf"])} type="button">
                    {t(lang, "collections.exportPdf")}
                  </button>
                  <button onClick={() => onExport(note.id, ["txt", "pdf"])} type="button">
                    {t(lang, "collections.exportBoth")}
                  </button>
                </div>
                <pre>{note.markdown.slice(0, 1200)}</pre>
              </>
            ) : (
              <p>{t(lang, "collections.select")}</p>
            )}
          </article>
        </div>
      ) : (
        <div className="collection-empty">
          <p>{t(lang, "collections.empty")}</p>
        </div>
      )}
    </section>
  );
}

function SkillExplorer({
  catalog,
  filteredTools,
  lang,
  onSelectSkill,
  onUseTool,
  query,
  selectedSkill,
  selectedSkillData,
  setQuery,
}: {
  catalog: RCatalog | null;
  filteredTools: Array<RTool & { skill: string; skillBlocked: boolean }>;
  lang: Lang;
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
        <h2>{t(lang, "skills.title")}</h2>
        <span>{catalog ? `${catalog.skillCount} / ${catalog.toolCount}` : t(lang, "skills.loading")}</span>
      </div>

      <input
        aria-label={t(lang, "skills.searchAria")}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t(lang, "skills.searchPlaceholder")}
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
              {selectedSkillData.description || t(lang, "skills.fallbackDescription")}
            </p>
          ) : null}

          <div className="tool-results">
            {filteredTools.slice(0, 6).map((tool) => (
              <div className="tool-result" key={`${tool.skill}.${tool.name}`}>
                <div>
                  <strong>{tool.name}</strong>
                  <span className={tool.skillBlocked ? "blocked" : ""}>
                    {tool.skillBlocked ? t(lang, "permissions.blocked") : tool.skill}
                  </span>
                </div>
                <p>{tool.description}</p>
                <button
                  className="tooltip-control"
                  data-tooltip={t(lang, "skills.useTooltip")}
                  onClick={() => onUseTool(tool.skill, tool)}
                  title={t(lang, "skills.useTooltip")}
                  type="button"
                >
                  {t(lang, "skills.use")}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="skill-summary">{t(lang, "skills.catalogMissing")}</p>
      )}
    </div>
  );
}

function PermissionPanel({ lang, summary }: { lang: Lang; summary: PermissionSummary | null }) {
  const visibleBlocked = summary?.blocked.slice(0, 8) ?? [];

  return (
    <div className="permission-panel">
      <div className="permission-title">
        <ShieldAlert size={16} />
        <h2>{t(lang, "permissions.title")}</h2>
      </div>

      {summary ? (
        <>
          <div className="permission-meter" aria-label={t(lang, "aria.permissionSummary")}>
            <div>
              <strong>{summary.allowedCount}</strong>
              <span>{t(lang, "permissions.ready")}</span>
            </div>
            <div>
              <strong>{summary.blockedCount}</strong>
              <span>{t(lang, "permissions.blocked")}</span>
            </div>
          </div>

          <p>
            {t(lang, "permissions.copy")}
            {" "}
            <code>R_BRIDGE_ALLOW_DANGEROUS=1</code>.
          </p>

          {visibleBlocked.length ? (
            <div className="blocked-list" aria-label={t(lang, "permissions.blockedSkills")}>
              {visibleBlocked.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p>{t(lang, "permissions.loading")}</p>
      )}
    </div>
  );
}

function buildToolPrompt(skill: string, tool: RTool, lang: Lang) {
  if (lang === "es") {
    return [
      `Quiero usar una herramienta R.`,
      `Habilidad: ${skill}`,
      `Herramienta: ${tool.name}`,
      `Descripcion: ${tool.description}`,
      `Parametros esperados: ${JSON.stringify(tool.parameters ?? {}, null, 2)}`,
      `Primero explica que entradas necesitas. Si todas las entradas ya estan disponibles, llama a r_call_tool con esos parametros.`,
    ].join("\n");
  }

  return [
    `I want to use an R tool.`,
    `Skill: ${skill}`,
    `Tool: ${tool.name}`,
    `Description: ${tool.description}`,
    `Expected parameters: ${JSON.stringify(tool.parameters ?? {}, null, 2)}`,
    `First explain which inputs you need. If all inputs are already available, call r_call_tool with those parameters.`,
  ].join("\n");
}

function buildResearchExportPrompt(id: string, formats: Array<"pdf" | "txt">, lang: Lang) {
  if (lang === "es") {
    return [
      "Exporta esta nota de investigacion guardada.",
      `Archivo: ${id}`,
      `Formatos: ${formats.join(", ")}`,
      "Explica que exportar notas requiere activar el pack opcional de research.",
    ].join("\n");
  }
  return [
    "Export this saved research note.",
    `File: ${id}`,
    `Formats: ${formats.join(", ")}`,
    "Explain that exporting notes requires enabling the optional research pack.",
  ].join("\n");
}

function partToText(part: EveMessagePart) {
  if (part.type === "text") {
    return part.text;
  }

  return "";
}

function statusLabel(status: string, lang: Lang) {
  if (status === "submitted") {
    return t(lang, "status.sending");
  }
  if (status === "streaming") {
    return t(lang, "status.responding");
  }
  if (status === "error") {
    return t(lang, "status.error");
  }
  return t(lang, "status.ready");
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

function stateLabel(state: string, lang: Lang) {
  if (state === "output-available") {
    return t(lang, "toolLog.finished");
  }
  if (state === "output-error") {
    return t(lang, "status.error").toLowerCase();
  }
  if (state === "input-streaming" || state === "input-available") {
    return t(lang, "toolLog.running");
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

function summarizeHealth(checks: HealthCheck[]) {
  return checks.reduce(
    (summary, check) => {
      if (check.state === "ready") {
        summary.ready += 1;
      } else if (check.state === "warning" || check.state === "offline") {
        summary.warning += 1;
      }
      return summary;
    },
    { ready: 0, warning: 0 },
  );
}

function placeholderHealth(lang: Lang): HealthCheck[] {
  return [
    {
      key: "loading",
      label: t(lang, "health.loadingLabel"),
      state: "info",
      detail: t(lang, "health.loadingDetail"),
    },
  ];
}

function healthStateLabel(state: HealthState, lang: Lang) {
  if (state === "ready") {
    return t(lang, "health.state.ready");
  }
  if (state === "warning") {
    return t(lang, "health.state.warning");
  }
  if (state === "offline") {
    return t(lang, "health.state.offline");
  }
  return t(lang, "health.state.info");
}

function localizedHealthLabel(label: string, lang: Lang) {
  const key = `health.label.${label.toLowerCase().replace(/\s+/g, "")}`;
  const value = t(lang, key);
  return value === key ? label : value;
}

function localizedHealthDetail(check: HealthCheck, lang: Lang) {
  if (check.key === "lexia" && check.state === "info") {
    return t(lang, "health.detail.lexiaOptional");
  }
  if (check.key === "lmstudio" && check.state === "offline") {
    return t(lang, "health.detail.lmOffline");
  }
  if (check.key === "lmstudio" && check.detail.includes("not found")) {
    return t(lang, "health.detail.lmModelMissing");
  }
  if (check.key === "eve" && check.state !== "ready") {
    return t(lang, "health.detail.eveOffline");
  }
  if (check.key === "search" && check.detail === "DuckDuckGo fallback only") {
    return t(lang, "health.detail.searchFallback");
  }
  if (check.key === "reader" && check.detail === "Direct page extraction only") {
    return t(lang, "health.detail.readerDirect");
  }
  if (check.key === "catalog" && check.detail === "Run npm run r:catalog") {
    return t(lang, "health.detail.catalogMissing");
  }
  if (check.key === "bridge" && check.detail === "Run npm run r:install") {
    return t(lang, "health.detail.bridgeMissing");
  }
  if (check.key === "bridge" && check.detail === "Python bridge files are present") {
    return t(lang, "health.detail.bridgeReady");
  }
  if (check.key === "health") {
    return t(lang, "health.detail.healthUnavailable");
  }
  return check.detail;
}

function formatDate(value: string, lang: Lang) {
  try {
    return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-US", {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

createRoot(document.getElementById("root")!).render(<App />);
