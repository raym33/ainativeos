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
    "approval.aria": "Action approval",
    "approval.approve": "Approve",
    "approval.cancel": "Cancel",
    "approval.note": "Nothing runs until you choose.",
    "approval.title": "Approve before continuing",
    "aria.chat": "Chat",
    "aria.coreFunctions": "Core functions",
    "aria.langToggle": "Language",
    "aria.message": "Message",
    "aria.permissionSummary": "Permission summary",
    "aria.systemCapabilities": "System capabilities",
    "aria.systemStatus": "System status",
    "aria.toolSummary": "Tool summary",
    "brand.eyebrow": "Local workspace",
    "brand.subtitle": "Private automation console",
    "composer.pending": "Approve or cancel the pending action above to continue...",
    "composer.placeholder": "Describe a task for Eve...",
    "composer.send": "Send",
    "composer.sendTooltip": "Send this task to the local agent.",
    "composer.stop": "Stop",
    "composer.stopTooltip": "Stop the current response.",
    "dashboard.copy":
      "Eve routes requests to LM Studio and the local R skill catalog. The interface keeps the model focused, exposes tool activity, and blocks sensitive actions by default.",
    "dashboard.eyebrow": "Desktop-grade local AI",
    "dashboard.heading": "Start with a task, not a prompt.",
    "forge.heading": "Skill Forge",
    "model.fallback": "LM Studio local",
    "model.label": "Model",
    "permissions.blocked": "blocked",
    "permissions.blockedSkills": "Blocked skills",
    "permissions.copy": "Sensitive skills are blocked by default. To unlock them, start Eve with",
    "permissions.loading": "Loading local permission profile.",
    "permissions.ready": "ready",
    "permissions.title": "Permissions",
    "quickActions.aria": "Quick actions",
    "reset.label": "New session",
    "reset.tooltip": "Clear the current Eve session and start fresh.",
    "skills.catalogMissing": "Run `npm run r:catalog` if the catalog does not appear.",
    "skills.fallbackDescription": "Local R skill.",
    "skills.loading": "loading",
    "skills.searchAria": "Search R tools",
    "skills.searchPlaceholder": "Search PDF, CSV, QR...",
    "skills.title": "R skills",
    "skills.use": "Use",
    "skills.useTooltip": "Create a guided prompt for this exact R tool.",
    "status.backend": "Eve backend through local proxy",
    "status.error": "Error",
    "status.ready": "Ready",
    "status.responding": "Responding",
    "status.sending": "Sending",
    "system.blockedByDefault": "blocked by default",
    "system.skillsIndexed": "skills indexed",
    "system.toolsAvailable": "tools available",
    "tools.label": "Tools",
    "tools.value": "ABC RSS / R skills / Web search",
    "toolLog.empty": "No runs yet",
    "toolLog.finished": "finished",
    "toolLog.history": "History",
    "toolLog.muted": "Tool activity will appear here when the agent acts.",
    "toolLog.running": "running",
    "toolLog.runsThisSession": "runs this session",
    "toolLog.tools": "tools",
    "user.you": "You",
    "workbench.pdf.copy": "OCR, summarize, merge, extract, repair, and generate reports locally.",
    "workbench.pdf.title": "PDF workbench",
  },
  es: {
    "approval.aria": "Aprobacion de accion",
    "approval.approve": "Aprobar",
    "approval.cancel": "Cancelar",
    "approval.note": "Nada se ejecuta hasta que elijas.",
    "approval.title": "Aprueba antes de continuar",
    "aria.chat": "Chat",
    "aria.coreFunctions": "Funciones principales",
    "aria.langToggle": "Idioma",
    "aria.message": "Mensaje",
    "aria.permissionSummary": "Resumen de permisos",
    "aria.systemCapabilities": "Capacidades del sistema",
    "aria.systemStatus": "Estado del sistema",
    "aria.toolSummary": "Resumen de herramientas",
    "brand.eyebrow": "Espacio de trabajo local",
    "brand.subtitle": "Consola privada de automatizacion",
    "composer.pending": "Aprueba o cancela la accion pendiente de arriba para continuar...",
    "composer.placeholder": "Describe una tarea para Eve...",
    "composer.send": "Enviar",
    "composer.sendTooltip": "Enviar esta tarea al agente local.",
    "composer.stop": "Detener",
    "composer.stopTooltip": "Detener la respuesta actual.",
    "dashboard.copy":
      "Eve dirige las solicitudes a LM Studio y al catalogo local de habilidades R. La interfaz mantiene el modelo enfocado, muestra la actividad de las herramientas y bloquea las acciones sensibles por defecto.",
    "dashboard.eyebrow": "IA local de escritorio",
    "dashboard.heading": "Empieza con una tarea, no con un prompt.",
    "forge.heading": "Forja de habilidades",
    "model.fallback": "LM Studio local",
    "model.label": "Modelo",
    "permissions.blocked": "bloqueadas",
    "permissions.blockedSkills": "Habilidades bloqueadas",
    "permissions.copy": "Las habilidades sensibles estan bloqueadas por defecto. Para desbloquearlas, inicia Eve con",
    "permissions.loading": "Cargando perfil local de permisos.",
    "permissions.ready": "listas",
    "permissions.title": "Permisos",
    "quickActions.aria": "Acciones rapidas",
    "reset.label": "Nueva sesion",
    "reset.tooltip": "Borrar la sesion actual de Eve y empezar de nuevo.",
    "skills.catalogMissing": "Ejecuta `npm run r:catalog` si el catalogo no aparece.",
    "skills.fallbackDescription": "Habilidad R local.",
    "skills.loading": "cargando",
    "skills.searchAria": "Buscar herramientas R",
    "skills.searchPlaceholder": "Buscar PDF, CSV, QR...",
    "skills.title": "Habilidades R",
    "skills.use": "Usar",
    "skills.useTooltip": "Crear un prompt guiado para esta herramienta R concreta.",
    "status.backend": "Backend de Eve mediante proxy local",
    "status.error": "Error",
    "status.ready": "Lista",
    "status.responding": "Respondiendo",
    "status.sending": "Enviando",
    "system.blockedByDefault": "bloqueadas por defecto",
    "system.skillsIndexed": "habilidades indexadas",
    "system.toolsAvailable": "herramientas disponibles",
    "tools.label": "Herramientas",
    "tools.value": "ABC RSS / habilidades R / busqueda web",
    "toolLog.empty": "Sin ejecuciones todavia",
    "toolLog.finished": "terminadas",
    "toolLog.history": "Historial",
    "toolLog.muted": "La actividad de herramientas aparecera aqui cuando actue el agente.",
    "toolLog.running": "en curso",
    "toolLog.runsThisSession": "ejecuciones en esta sesion",
    "toolLog.tools": "herramientas",
    "user.you": "Tu",
    "workbench.pdf.copy": "OCR, resumen, union, extraccion, reparacion y generacion de informes en local.",
    "workbench.pdf.title": "Mesa de trabajo PDF",
  },
};

export function t(lang: Lang, key: string): string {
  return translations[lang][key] ?? translations.en[key] ?? key;
}
