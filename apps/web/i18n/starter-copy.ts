import { tr } from "./provider";

// Translate only the known demo copy. User-authored slide content stays intact.
const starterCopy: Record<string, string> = {
  "A presentation that listens.": "Una presentación que escucha.",
  "The next big idea is in this room.": "La próxima gran idea está en esta sala.",
  "Where should we go next?": "¿Hacia dónde vamos ahora?",
  "Vote for the next chapter. You help choose the direction.": "Vota por el próximo capítulo. El rumbo se decide aquí.",
  "Slides that respond": "Diapositivas que responden", "Live research": "Investigar en vivo", "Unexpected moments": "Momentos inesperados",
  "One talk. Many perspectives.": "Una charla. Muchas perspectivas.",
  "Use the assistant to research, turn emails into slides or direct the talk with your voice. The audience writes the ending with you.": "Usa el copiloto para investigar, convertir un correo en diapositiva o dirigir la charla con tu voz. La audiencia escribe el cierre contigo.",
};
export function starterText(text: string | undefined) { return text ? tr(starterCopy[text] ?? text) : ""; }
export function isIntroParagraph(text: string) {
  return [
    "Suggest an improvement, share what you discover, and let’s build the last slide together.",
    "Suggest an improvement, share what you discover, and let's build the last slide together.",
    "Propón una mejora, comparte lo que descubres y construyamos juntos el último slide.",
  ].includes(text.trim());
}
