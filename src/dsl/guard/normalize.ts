import type { GuardAst } from "./ast";
import { formatCallChain } from "../shared/parser";

export function normalizeGuard(ast: GuardAst): string {
  return formatCallChain(ast.callChain);
}
