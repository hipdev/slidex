import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createInstance } from "i18next";
const es = JSON.parse(await readFile(new URL("../i18n/es.json", import.meta.url), "utf8"));
const en = JSON.parse(await readFile(new URL("../i18n/en.json", import.meta.url), "utf8"));
assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
for (const key of Object.keys(es)) {
  assert.ok(es[key].trim() && en[key].trim(), `Empty translation: ${key}`);
  assert.deepEqual(es[key].match(/\{\{[^}]+\}\}/g) ?? [], en[key].match(/\{\{[^}]+\}\}/g) ?? [], `Interpolation mismatch: ${key}`);
}
const i18n = createInstance();
await i18n.init({ lng: "en", fallbackLng: "es", keySeparator: false, resources: { es: { translation: es }, en: { translation: en } } });
assert.equal(i18n.t("clarityCount", { count: 1 }), "1 person needs clarity");
assert.equal(i18n.t("clarityCount", { count: 3 }), "3 people need clarity");
await i18n.changeLanguage("es");
assert.equal(i18n.t("participantCount", { count: 1 }), "1 participante");
assert.equal(i18n.t("participantCount", { count: 2 }), "2 participantes");
console.log(`${Object.keys(es).length} bilingual translations verified; pluralization and language switching passed.`);
