// ---------------------------------------------------------------------------
// Recipe section parsing.
//
// Ingredients and steps are stored as raw newline-separated text. A line
// starting with "//" opens a named section (« // Pour la sauce ») grouping the
// lines that follow it — an advanced, deliberately low-key convention: the
// single textarea stays untouched and the AI import emits the same syntax.
// ---------------------------------------------------------------------------

const SECTION_LINE = /^\/\/\s*(.*)$/;

export type RecipeSection = {
  // null for lines appearing before any "//" marker (or an unnamed "//" line).
  title: string | null;
  items: string[];
};

/** True when a (trimmed) line is a "// Nom" section marker. */
export function isSectionLine(line: string): boolean {
  return SECTION_LINE.test(line);
}

/**
 * Split newline-separated text into sections. Blank lines are dropped. Text
 * without any "//" marker yields a single untitled section, so callers can
 * render the sectioned and unsectioned cases with the same loop.
 */
export function parseSections(text: string | null): RecipeSection[] {
  if (!text) return [];
  const sections: RecipeSection[] = [];
  let current: RecipeSection | null = null;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const match = line.match(SECTION_LINE);
    if (match) {
      current = { title: match[1].trim() || null, items: [] };
      sections.push(current);
    } else {
      if (!current) {
        current = { title: null, items: [] };
        sections.push(current);
      }
      current.items.push(line);
    }
  }

  return sections;
}
