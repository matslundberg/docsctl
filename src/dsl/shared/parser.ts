export type CallValue = string | number | boolean | CallExpr;

export type CallArg =
  | { kind: "positional"; value: CallValue }
  | { kind: "named"; name: string; value: CallValue };

export interface CallExpr {
  type: "call";
  name: string;
  args: CallArg[];
}

export interface CallChainAst {
  head: CallExpr;
  chain: CallExpr[];
}

type TokenType =
  | "identifier"
  | "string"
  | "number"
  | "boolean"
  | "comma"
  | "dot"
  | "parenOpen"
  | "parenClose"
  | "equals"
  | "eof";

type Token = {
  type: TokenType;
  value?: string | number | boolean;
  index: number;
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const push = (type: TokenType, value?: string | number | boolean) => {
    tokens.push({ type, value, index: i });
  };

  while (i < input.length) {
    const char = input[i];

    if (char === " " || char === "\t" || char === "\n" || char === "\r") {
      i += 1;
      continue;
    }

    if (char === ",") {
      push("comma");
      i += 1;
      continue;
    }

    if (char === ".") {
      push("dot");
      i += 1;
      continue;
    }

    if (char === "(") {
      push("parenOpen");
      i += 1;
      continue;
    }

    if (char === ")") {
      push("parenClose");
      i += 1;
      continue;
    }

    if (char === "=") {
      push("equals");
      i += 1;
      continue;
    }

    if (char === '"') {
      let raw = "";
      i += 1;
      while (i < input.length) {
        const next = input[i];
        if (next === '"') {
          i += 1;
          break;
        }
        if (next === "\\") {
          const escape = input[i + 1];
          if (escape) {
            raw += `\\${escape}`;
            i += 2;
            continue;
          }
        }
        raw += next;
        i += 1;
      }
      const value = JSON.parse(`"${raw}"`) as string;
      push("string", value);
      continue;
    }

    if (/[0-9]/.test(char)) {
      let raw = char;
      i += 1;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        raw += input[i];
        i += 1;
      }
      push("number", Number(raw));
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let raw = char;
      i += 1;
      while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) {
        raw += input[i];
        i += 1;
      }
      if (raw === "true" || raw === "false") {
        push("boolean", raw === "true");
      } else {
        push("identifier", raw);
      }
      continue;
    }

    throw new Error(`Unexpected character '${char}' at ${i}`);
  }

  tokens.push({ type: "eof", index: i });
  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parseCallChain(): CallChainAst {
    const head = this.parseCall();
    const chain: CallExpr[] = [];

    while (this.match("dot")) {
      chain.push(this.parseCall());
    }

    this.expect("eof");
    return { head, chain };
  }

  private parseCall(): CallExpr {
    const nameToken = this.expect("identifier");
    this.expect("parenOpen");
    const args: CallArg[] = [];
    if (!this.check("parenClose")) {
      do {
        args.push(this.parseArg());
      } while (this.match("comma"));
    }
    this.expect("parenClose");
    return { type: "call", name: String(nameToken.value), args };
  }

  private parseArg(): CallArg {
    if (this.check("identifier") && this.checkNext("equals")) {
      const name = String(this.expect("identifier").value);
      this.expect("equals");
      const value = this.parseValue();
      return { kind: "named", name, value };
    }
    const value = this.parseValue();
    return { kind: "positional", value };
  }

  private parseValue(): CallValue {
    const token = this.peek();
    switch (token.type) {
      case "string":
      case "number":
      case "boolean":
        this.advance();
        return token.value as string | number | boolean;
      case "identifier":
        return this.parseCall();
      default:
        throw new Error(`Unexpected token ${token.type} at ${token.index}`);
    }
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private checkNext(type: TokenType): boolean {
    return this.tokens[this.index + 1]?.type === type;
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw new Error(`Expected ${type} but found ${token.type} at ${token.index}`);
    }
    this.advance();
    return token;
  }

  private peek(): Token {
    return this.tokens[this.index];
  }

  private advance(): Token {
    const token = this.tokens[this.index];
    this.index = Math.min(this.index + 1, this.tokens.length - 1);
    return token;
  }
}

export function parseCallChain(input: string): CallChainAst {
  const tokens = tokenize(input);
  const parser = new Parser(tokens);
  return parser.parseCallChain();
}

function formatValue(value: CallValue): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : "0";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return formatCall(value);
}

function formatCall(call: CallExpr): string {
  const args = call.args
    .map((arg) => {
      if (arg.kind === "named") {
        return `${arg.name}=${formatValue(arg.value)}`;
      }
      return formatValue(arg.value);
    })
    .join(", ");
  return `${call.name}(${args})`;
}

export function formatCallChain(ast: CallChainAst): string {
  const parts = [formatCall(ast.head), ...ast.chain.map(formatCall)];
  return parts.join(".");
}
