// Type definitions for node-tree-sitter grammar construction
export interface Rule {
  type: string;
  // Other properties can be added as needed
}

export interface Grammar {
  name: string;
  extras?: (($: any) => any[]) | undefined;
  rules: Record<string, ($: any) => any>;
}

export type GrammarFunction = (grammar: (grammarOptions: Grammar) => Grammar) => Grammar;

export function grammar(grammarOptions: Grammar): Grammar;

export function seq(...rules: any[]): Rule;
export function choice(...rules: any[]): Rule;
export function optional(rule: any): Rule;
export function repeat(rule: any): Rule;
export function repeat1(rule: any): Rule;
export function token(rule: any): Rule;
export function field(name: string, rule: any): Rule;
export function prec(value: number, rule: any): Rule;
export function alias(rule: any, name: string): Rule;
