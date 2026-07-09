import type { Tag } from "@/types/recipe";

export type CarouselRecipeItem = {
  id: string;
  title: string;
  tags: Tag[];
  photoUrl: string | null;
  createdAt: string;
  generatedImageUrl: string | null;
  enrichmentStatus: string;
  imageStatus: string;
  prepTime: string | null;
  cookTime: string | null;
  cost: string | null;
  lastActivityAt: string;
  viewCount: number;
};

// Prêt à rendre côté client : les prédicats du catalogue ne sortent jamais du
// module — l'UI ne connaît que ces deux flags de comportement.
export type CarouselSection = {
  key: string;
  title: string;
  /** Affiché en tête, jamais shufflé ni masqué (Récentes). */
  pinned: boolean;
  /**
   * true (catégories) : la dédup en cascade repousse les recettes déjà vues
   * en queue. false (tris sémantiques) : réordonner casserait le sens, la
   * section est masquée si aucune de ses 2 premières cartes n'est fraîche.
   */
  reorderable: boolean;
  recipes: CarouselRecipeItem[];
};
