// Regenera la sección "Eventos que consumimos" de EVENTOS.md a partir de EVENT_SCHEMAS.
// Uso: npm run docs:payloads
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FieldSpec } from "../src/domain/entities/event-schema.entity";
import { EVENT_SCHEMAS } from "../src/domain/entities/event-schemas";
import { SOURCE_MODULE_LABELS, SOURCE_MODULES } from "../src/domain/entities/event-source.entity";

const START = "<!-- payloads:start -->";
const END = "<!-- payloads:end -->";

function typeLabel(field: FieldSpec): string {
  if (field.oneOf) return `enum (${field.oneOf.map((value) => `\`${value}\``).join(", ")})`;
  if (field.type === "date") return "`string` AAAA-MM-DD";
  if (field.type === "datetime") return "`string` ISO 8601 UTC";
  if (field.type === "decimal") return '`string` decimal (`"1500.00"`)';
  if (field.type === "array" && !field.fields) return "`array` de strings";
  if (field.type === "array") return "`array` de objetos";
  return `\`${field.type}\``;
}

function rows(fields: readonly FieldSpec[], prefix = ""): string[] {
  return fields.flatMap((field) => {
    const name = `${prefix}${field.name}`;
    const line = `| \`${name}\` | ${typeLabel(field)} | ${field.required ? "sí" : "no"} | ${field.description} |`;
    const nestedPrefix = field.type === "array" ? `${name}[].` : `${name}.`;
    return [line, ...(field.fields ? rows(field.fields, nestedPrefix) : [])];
  });
}

const sections = SOURCE_MODULES.flatMap((module) => {
  const schemas = EVENT_SCHEMAS.filter((schema) => schema.source === module);
  if (schemas.length === 0) return [];

  return [
    `#### \`${module}\` (${SOURCE_MODULE_LABELS[module]})`,
    ...schemas.flatMap((schema) => [
      "",
      `**\`${schema.eventType}\`** — ${schema.usage}`,
      "",
      "| Campo | Tipo | Obligatorio | Descripción |",
      "|---|---|---|---|",
      ...rows(schema.fields),
    ]),
    "",
  ];
});

const generated = [START, "", ...sections, END].join("\n");

const file = path.join(__dirname, "..", "EVENTOS.md");
const current = readFileSync(file, "utf8");
const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);
if (!pattern.test(current)) {
  throw new Error(`EVENTOS.md no tiene los marcadores ${START} / ${END}.`);
}

writeFileSync(file, current.replace(pattern, () => generated));
console.log("EVENTOS.md actualizado.");
