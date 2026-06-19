export type Lang = "es" | "en";

const STORAGE_KEY = "rworkbench.lang";

export function detectLang(): Lang {
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("es")) {
    return "es";
  }
  return "en";
}

export function loadLang(): Lang {
  try {
    if (typeof localStorage === "undefined") {
      return detectLang();
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "es" || stored === "en" ? stored : detectLang();
  } catch {
    return detectLang();
  }
}

export function saveLang(lang: Lang): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  } catch {
    // Ignore storage failures in private browsing, SSR, or locked-down contexts.
  }
}

export const translations: Record<Lang, Record<string, string>> = {
  en: {
    "welcome.greeting": "What can I help you with?",
    "welcome.sub": "Ask in your own words. I'll tell you if I can do it and what I need — and I always ask before doing anything important.",
    "approval.aria": "Action approval",
    "approval.approve": "Approve",
    "approval.cancel": "Cancel",
    "approval.note": "Nothing runs until you choose.",
    "approval.title": "Approve before continuing",
    "aria.chat": "Chat",
    "aria.langToggle": "Language",
    "aria.message": "Message",
    "aria.systemStatus": "System status",
    "brand.eyebrow": "Local workspace",
    "brand.subtitle": "Private automation console",
    "composer.pending": "Approve or cancel the pending action above to continue...",
    "composer.placeholder": "Type what you need...",
    "composer.send": "Send",
    "composer.sendTooltip": "Send this task to the local agent.",
    "composer.stop": "Stop",
    "composer.stopTooltip": "Stop the current response.",
    "model.fallback": "LM Studio local",
    "model.label": "Model",
    "os.about": "About",
    "os.about.credits": "Local-first and open source — github.com/raym33/ainativeos",
    "os.about.ok": "OK",
    "os.about.tagline": "Private, local AI assistant for documents, research and admin.",
    "os.about.title": "About AI Native OS",
    "os.about.version": "Version",
    "os.clock": "Clock",
    "os.close": "Close",
    "os.exit": "Exit",
    "os.explorer.empty": "Empty folder",
    "os.explorer.root": "Workspace",
    "os.explorer.title": "File Explorer",
    "os.explorer.up": "Up",
    "os.hint": "Click an icon to start",
    "os.launch": "OS",
    "os.min": "Minimize",
    "os.programs": "Programs",
    "os.start": "Start",
    "os.title": "AI Native OS - Program Manager",
    "explorer.action.ask": "Ask",
    "explorer.action.invoice": "Invoice data",
    "explorer.action.summarize": "Summarize",
    "explorer.preview.error": "Couldn't preview this file.",
    "explorer.preview.loading": "Loading preview…",
    "explorer.preview.none": "No preview available",
    "explorer.preview.pdf": "PDF document — use Summarize or Invoice data",
    "explorer.preview.truncated": "… (truncated)",
    "explorer.selected": "Selected",
    "reset.label": "New session",
    "reset.tooltip": "Clear the current Eve session and start fresh.",
    "status.backend": "Eve backend through local proxy",
    "status.error": "Error",
    "status.ready": "Ready",
    "status.responding": "Responding",
    "status.sending": "Sending",
    "user.you": "You",
  },
  es: {
    "welcome.greeting": "¿En qué te ayudo?",
    "welcome.sub": "Pídemelo con tus palabras. Te diré si puedo hacerlo y qué necesito, y siempre te pregunto antes de hacer algo importante.",
    "approval.aria": "Aprobacion de accion",
    "approval.approve": "Aprobar",
    "approval.cancel": "Cancelar",
    "approval.note": "Nada se ejecuta hasta que elijas.",
    "approval.title": "Aprueba antes de continuar",
    "aria.chat": "Chat",
    "aria.langToggle": "Idioma",
    "aria.message": "Mensaje",
    "aria.systemStatus": "Estado del sistema",
    "brand.eyebrow": "Espacio de trabajo local",
    "brand.subtitle": "Consola privada de automatizacion",
    "composer.pending": "Aprueba o cancela la accion pendiente de arriba para continuar...",
    "composer.placeholder": "Escribe lo que necesitas...",
    "composer.send": "Enviar",
    "composer.sendTooltip": "Enviar esta tarea al agente local.",
    "composer.stop": "Detener",
    "composer.stopTooltip": "Detener la respuesta actual.",
    "model.fallback": "LM Studio local",
    "model.label": "Modelo",
    "os.about": "Acerca de",
    "os.about.credits": "Local y de código abierto — github.com/raym33/ainativeos",
    "os.about.ok": "Aceptar",
    "os.about.tagline": "Asistente de IA local y privado para documentos, investigación y gestión.",
    "os.about.title": "Acerca de AI Native OS",
    "os.about.version": "Versión",
    "os.clock": "Reloj",
    "os.close": "Cerrar",
    "os.exit": "Salir",
    "os.explorer.empty": "Carpeta vacia",
    "os.explorer.root": "Espacio de trabajo",
    "os.explorer.title": "Explorador de archivos",
    "os.explorer.up": "Subir",
    "os.hint": "Haz clic en un icono para empezar",
    "os.launch": "OS",
    "os.min": "Minimizar",
    "os.programs": "Programas",
    "os.start": "Inicio",
    "os.title": "AI Native OS - Administrador de programas",
    "explorer.action.ask": "Preguntar",
    "explorer.action.invoice": "Datos de factura",
    "explorer.action.summarize": "Resumir",
    "explorer.preview.error": "No se pudo previsualizar este archivo.",
    "explorer.preview.loading": "Cargando vista previa…",
    "explorer.preview.none": "Sin vista previa",
    "explorer.preview.pdf": "Documento PDF — usa Resumir o Datos de factura",
    "explorer.preview.truncated": "… (recortado)",
    "explorer.selected": "Seleccionado",
    "reset.label": "Nueva sesion",
    "reset.tooltip": "Borrar la sesion actual de Eve y empezar de nuevo.",
    "status.backend": "Backend de Eve mediante proxy local",
    "status.error": "Error",
    "status.ready": "Lista",
    "status.responding": "Respondiendo",
    "status.sending": "Enviando",
    "user.you": "Tu",
  },
};

export function t(lang: Lang, key: string): string {
  return translations[lang][key] ?? translations.en[key] ?? key;
}
