import { transaction, type Store } from "../storage/database.js";
import {
  ValidationError,
  type Actor,
  type Card,
  type EvidenceInput,
} from "./types.js";
import { requireCurrent, saveCard } from "./cards.js";
import { text, object } from "./validation.js";
export function recordEvidence(
  store: Store,
  id: string,
  expectedRevision: number,
  input: EvidenceInput,
  actor: Actor,
): Card {
  object(input, ["name", "outcome", "summary", "sourceRevision"]);
  const name = text(input.name, "Check name", 200);
  const summary = text(input.summary, "Evidence summary", 4000);
  if (!["passed", "failed"].includes(input.outcome))
    throw new ValidationError("Invalid evidence outcome.");
  const sourceRevision =
    input.sourceRevision === undefined
      ? undefined
      : text(input.sourceRevision, "Source revision", 200);
  return transaction(store, () => {
    const card = requireCurrent(store, id, expectedRevision);
    store.db.prepare("INSERT INTO evidence(card_id,data) VALUES(?,?)").run(
      id,
      JSON.stringify({
        name,
        summary,
        outcome: input.outcome,
        sourceRevision,
        workRevision: card.workRevision,
        at: new Date().toISOString(),
        actor,
      }),
    );
    if (input.outcome === "failed" && card.column === "Done")
      card.column = "Review";
    return saveCard(store, card, actor, "evidence.recorded");
  });
}
