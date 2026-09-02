import { describe, it, expect, vi } from "vitest";
import { withEffortFallback, TEXT_MODEL_EXTRA_PARAMS } from "./ai-models";

// Contexte : le 2026-09-02, OpenAI a changé la gamme reasoning_effort de Luna
// (minimal → none) en cours de journée, cassant les imports en prod (Sentry
// 6df59580). Le fallback garantit qu'un futur renommage dégrade en latence,
// pas en erreur utilisateur.
describe("withEffortFallback", () => {
  it("passe TEXT_MODEL_EXTRA_PARAMS au premier essai", async () => {
    const call = vi.fn().mockResolvedValue("ok");
    await expect(withEffortFallback(call)).resolves.toBe("ok");
    expect(call).toHaveBeenCalledExactlyOnceWith(TEXT_MODEL_EXTRA_PARAMS);
  });

  it("retente une fois sans paramètre si l'API rejette reasoning_effort", async () => {
    const err = Object.assign(
      new Error("400 Unsupported value: 'reasoning_effort' does not support 'none' with this model."),
      { status: 400 },
    );
    const call = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");
    await expect(withEffortFallback(call)).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(2);
    expect(call).toHaveBeenNthCalledWith(2, {});
  });

  it("propage telles quelles les autres erreurs (pas de double appel)", async () => {
    const err = Object.assign(new Error("429 Too Many Requests"), { status: 429 });
    const call = vi.fn().mockRejectedValue(err);
    await expect(withEffortFallback(call)).rejects.toThrow("429");
    expect(call).toHaveBeenCalledTimes(1);
  });
});
