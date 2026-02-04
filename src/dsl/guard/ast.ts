import type { CallChainAst } from "../shared/parser";

export type GuardAst = {
  type: "guard";
  callChain: CallChainAst;
};
