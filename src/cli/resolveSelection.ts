import { getToken } from "../auth/oauth";
import { parseGuard } from "../dsl/guard/parser";
import { normalizeGuard } from "../dsl/guard/normalize";
import { parseSelector } from "../dsl/selector/parser";
import { normalizeSelector } from "../dsl/selector/normalize";
import type { GuardAst } from "../dsl/guard/ast";
import { DocsClient } from "../google/docsClient";
import { buildDocumentModel } from "../model/documentModel";
import type { DocumentModel, ResolvedTarget } from "../model/types";
import { resolveTarget } from "../resolver/resolve";
import { formatHeadingPath } from "../util/format";

export type GuardInputs = {
  guard?: string;
  ifRevision?: string;
  expect?: string;
};

export type ResolveInputs = GuardInputs & {
  docId: string;
  select?: string;
  allowAmbiguous?: boolean;
};

export type ResolvedSelection = {
  model: DocumentModel;
  target: ResolvedTarget;
  selector: string;
  guard: string | null;
};

function escapeLiteral(value: string): string {
  return JSON.stringify(value);
}

export function buildGuardExpression(inputs: GuardInputs): string | null {
  const parts: string[] = [];
  if (inputs.ifRevision) {
    parts.push(`ifRevision(${escapeLiteral(inputs.ifRevision)})`);
  }
  if (inputs.expect) {
    parts.push(`expectContains(${escapeLiteral(inputs.expect)})`);
  }
  if (inputs.guard) {
    parts.push(inputs.guard);
  }

  if (parts.length === 0) {
    return null;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return `all(${parts.join(", ")})`;
}

export async function resolveSelection(inputs: ResolveInputs): Promise<ResolvedSelection> {
  if (!inputs.select) {
    throw new Error("Missing --select value.");
  }

  const selectorAst = parseSelector(inputs.select);
  const selector = normalizeSelector(selectorAst);
  const guardExpression = buildGuardExpression(inputs);
  const guardAst = guardExpression ? parseGuard(guardExpression) : null;
  const guard = guardAst ? normalizeGuard(guardAst) : null;

  const token = await getToken();
  const client = new DocsClient(token.accessToken);
  const doc = await client.getDocument(inputs.docId);
  const model = buildDocumentModel(doc);

  const target = resolveTarget(model, selectorAst, guardAst, {
    allowAmbiguous: inputs.allowAmbiguous,
  });

  return { model, target, selector, guard };
}

export function formatResolvedTarget(target: ResolvedTarget): string {
  const heading = formatHeadingPath(target.context.headingPath);
  const snippet = target.context.snippet ? ` :: ${target.context.snippet}` : "";
  return `${target.kind} ${heading}${snippet}`;
}
