import { vi } from "vitest";
import type { PhotoStore } from "@/lib/storage/photos";

// Doublure du stockage photos : chaque méthode est un vi.fn() ; `publicUrl`
// renvoie une URL déterministe pour les assertions.
export type PhotoStoreMock = { [K in keyof PhotoStore]: ReturnType<typeof vi.fn> } & PhotoStore;

export function createPhotoStoreMock(): PhotoStoreMock {
  return {
    upload: vi.fn(() => Promise.resolve()),
    copy: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
    publicUrl: vi.fn((path: string) => `https://photos.test/${path}`),
  } as PhotoStoreMock;
}
