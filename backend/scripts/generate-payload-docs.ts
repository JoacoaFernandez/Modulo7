// Regenera la sección de payloads de EVENTOS.md (entre los marcadores payloads:start / payloads:end) a partir de
// EVENT_CATALOG (domain/entities/event-catalog.ts, docs/INTEGRACION.md, 3). El resto de EVENTOS.md se edita a mano.
// Uso: npm run docs:payloads
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EVENT_CATALOG, EventCatalogEntry, EventHandling, EventOrigin } from "../src/domain/entities/event-catalog";
import { FieldSpec } from "../src/domain/entities/event-schema.entity";
import { CORE_SOURCES } from "../src/domain/entities/event-source.entity";

const START = "<!-- payloads:start -->";
const END = "<!-- payloads:end -->";

const HANDLING: Record<EventHandling, string> = {
  persist: "se guarda",
  "side-effect": "efecto lateral (se procesa y no se guarda)",
  ignore: "se recibe y se descarta (ack)",
};
const ORIGIN: Record<EventOrigin, string> = {
  core: "CORE oficial",
  declared: "declarado por el equipo emisor",
  proposed: "propuesto, pendiente de registrar en CORE",
};

function typeLabel(field: FieldSpec): string {
  if (field.oneOf) return `enum (${field.oneOf.map((value) => `\`${value}\``).join(", ")})`;
  switch (field.type) {
    case "date":
      return "`date` AAAA-MM-DD";
    case "datetime":
      return "`datetime` ISO 8601 UTC con `Z`";
    case "money":
      return "`money` texto con 2 decimales";
    case "array":
      return "`array` de objetos";
    default:
      return `\`${field.type}\``;
  }
}

function rows(fields: readonly FieldSpec[], prefix = ""): string[] {
  return fields.flatMap((field) => {
    const name = `${prefix}${field.name}`;
    const line = `| \`${name}\` | ${typeLabel(field)} | ${field.required ? "sí" : "no"} | ${field.description} |`;
    const nestedPrefix = field.type === "array" ? `${name}[].` : `${name}.`;
    return [line, ...(field.fields ? rows(field.fields, nestedPrefix) : [])];
  });
}

function section(entry: EventCatalogEntry): string[] {
  const lines = [
    `**\`${entry.eventType}\`**${entry.declaredBy ? ` · ${entry.declaredBy}` : ""}`,
    "",
    `- Estado: ${ORIGIN[entry.origin]}.`,
    `- Tratamiento: ${HANDLING[entry.handling]}.`,
    `- Alimenta: ${entry.feeds}.`,
  ];
  if (entry.redact?.length) lines.push(`- No se guarda: ${entry.redact.map((field) => `\`data.${field}\``).join(", ")} (redact).`);
  if (entry.handling === "ignore") return [...lines, ""];

  return [...lines, "", "| Campo | Tipo | Obligatorio | Descripción |", "|---|---|---|---|", ...rows(entry.fields, "data."), ""];
}

const sections = CORE_SOURCES.flatMap((source) => {
  const entries = EVENT_CATALOG.filter((entry) => entry.source === source);
  if (entries.length === 0) return [];

  // Primero los que se guardan, después efecto lateral y descartados.
  const order: Record<EventHandling, number> = { persist: 0, "side-effect": 1, ignore: 2 };
  const sorted = [...entries].sort((a, b) => order[a.handling] - order[b.handling]);
  return [`#### \`source: ${source}\``, "", ...sorted.flatMap(section)];
});

const generated = [START, "", "<!-- Generado por `npm run docs` desde event-catalog.ts: no editar a mano. -->", "", ...sections, END].join("\n");

const file = path.join(__dirname, "..", "EVENTOS.md");
const current = readFileSync(file, "utf8");
const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);
if (!pattern.test(current)) {
  throw new Error(`EVENTOS.md no tiene los marcadores ${START} / ${END}.`);
}

writeFileSync(file, current.replace(pattern, () => generated));
console.log("EVENTOS.md actualizado.");
