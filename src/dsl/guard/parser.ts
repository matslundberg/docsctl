import type { GuardAst } from "./ast";
import { parseCallChain } from "../shared/parser";

export function parseGuard(input: string): GuardAst {
  return { type: "guard", callChain: parseCallChain(input) };
}
