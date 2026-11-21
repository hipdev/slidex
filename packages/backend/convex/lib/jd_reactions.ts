// Fast path for the presenter's recurring cue; other paraphrases use JD's interpreter.
export function isFarewellReaction(text: string) {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (/\b(no|not|dont|never|nunca|jamas|evita|cancelar|cancela|hipoteticamente|if|si)\b/.test(normalized)) return false;
  if (/\b(crea|crear|slide|diapositiva|contador|minutos|siguiente|anterior|significa|meaning|traduce|translate)\b/.test(normalized)) return false;
  return /\b(thats all folks|that is all folks|eso es todo amigos|esto (ha|a) sido todo|eso (ha|a) sido todo)\b/.test(normalized);
}

export function isConvexCostsReaction(text: string) {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b(no|nunca|jamas|evita|cancelar|cancela|hipoteticamente)\b/.test(normalized)) return false;
  return /\bconvex\b/.test(normalized)
    && /\b(costos?|costes?|factur\w*|precios?|cobros?|pago|pagar)\b/.test(normalized)
    && /\b(como me siento|como me veo|mi reaccion|como reacciono|como estoy)\b/.test(normalized)
    && !/\b(crea|crear|slide|diapositiva|contador|minutos|siguiente|anterior)\b/.test(normalized);
}
