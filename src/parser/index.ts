import Parser from 'tree-sitter';
import { Tree, SyntaxNode } from 'tree-sitter';
import grammar from '../grammar.js';

/**
 * CEDARScript Parser class
 * Handles parsing of CEDARScript commands and content
 */
export class CEDARParser {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(grammar);
  }

  /**
   * Parse CEDARScript command string
   */
  parseCommand(script: string): Tree {
    return this.parser.parse(script);
  }

  /**
   * Parse content to be modified
   */
  parseContent(content: string): Tree {
    return this.parser.parse(content);
  }

  /**
   * Get all command nodes from a parsed tree
   */
  getCommandNodes(tree: Tree): SyntaxNode[] {
    const nodes: SyntaxNode[] = [];
    const rootNode = tree.rootNode;

    // Traverse the tree to find command nodes
    for (let i = 0; i < rootNode.childCount; i++) {
      const child = rootNode.child(i);
      if (child && this.isCommandNode(child)) {
        nodes.push(child);
      }
    }

    return nodes;
  }

  /**
   * Check if a node is a command node
   */
  private isCommandNode(node: SyntaxNode): boolean {
    return node.type.endsWith('_command');
  }
}
