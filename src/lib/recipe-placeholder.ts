// Warm food-inspired gradients matching the UX Direction 2 design palette.
// Each recipe gets one assigned deterministically from its ID so the color
// is always the same and never changes between renders.
const GRADIENTS = [
  ["#C4A882", "#8B6914"], // caramel
  ["#D4896A", "#A85432"], // terracotta
  ["#8CAA6E", "#4A7230"], // sage
  ["#C8B89A", "#8A7055"], // taupe
  ["#E8C87A", "#C49820"], // golden
  ["#B8D4A8", "#5A8840"], // soft green
] as const;

/**
 * Returns an inline CSS `background` value for a recipe placeholder.
 * The gradient is deterministic: the same recipe ID always yields the same color.
 */
export function getRecipePlaceholderGradient(id: string): string {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const [from, to] = GRADIENTS[hash % GRADIENTS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}
