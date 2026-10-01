export interface Actor {
  client: "browser" | "claude" | "codex";
  humanSession: boolean;
}
export interface Project {
  id: string;
  name: string;
  root: string;
  revision: number;
  createdAt: string;
  wipLimit: number | null;
}
export class ValidationError extends Error {}
export class NotFoundError extends Error {}
export class PolicyError extends Error {}
export class ConflictError extends Error {
  constructor(public current: unknown) {
    super("This item changed. Reload it before saving.");
  }
}
export const columns = [
  "Backlog",
  "Ready",
  "In Progress",
  "Review",
  "Done",
] as const;
export type Column = (typeof columns)[number];
export const phases = [
  "Discovery",
  "Design",
  "Planning",
  "Implementation",
  "Review",
  "Verification",
] as const;
export type Phase = (typeof phases)[number];
export type Priority = "low" | "normal" | "high" | "urgent";
export interface Artifact {
  path: string;
  label: string;
}
export interface EvidenceInput {
  name: string;
  outcome: "passed" | "failed";
  summary: string;
  sourceRevision?: string;
}
export interface Evidence extends EvidenceInput {
  id: number;
  workRevision: number;
  at: string;
  actor: Actor;
}
export interface NewCard {
  projectId: string;
  title: string;
  description?: string;
}
export interface CardPatch {
  title?: string;
  description?: string;
  priority?: Priority;
  owner?: string | null;
  blockedReason?: string | null;
  phase?: Phase;
  artifacts?: Artifact[];
}
export interface Card {
  id: string;
  projectId: string;
  title: string;
  description: string;
  column: Column;
  priority: Priority;
  owner: string | null;
  blockedReason: string | null;
  phase: Phase;
  artifacts: Artifact[];
  revision: number;
  workRevision: number;
  createdAt: string;
  updatedAt: string;
  evidence: Evidence[];
}
