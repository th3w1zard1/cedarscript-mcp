import { SyntaxNode, Tree } from 'tree-sitter';

/**
 * Base interface for all CEDARScript commands
 */
export interface Command {
  execute(content: string, tree: Tree): string;
}

/**
 * Command to update code content
 */
export class UpdateCommand implements Command {
  constructor(private node: SyntaxNode) {}

  execute(content: string, tree: Tree): string {
    const targetNode = this.node.child(0);
    const conditionNode = this.node.child(1);
    const contentNode = this.node.child(2);

    if (!contentNode) {
      throw new Error('Update command requires content');
    }

    // Extract the new content from the content node
    const newContent = this.extractContent(contentNode);

    // If no target is specified, replace the entire content
    if (!targetNode) {
      return newContent;
    }

    // Find the target in the content tree
    const targets = this.findTargets(tree, targetNode, conditionNode || undefined);
    
    // Apply the update to each target
    let result = content;
    for (const target of targets.reverse()) { // Reverse to maintain positions
      result = this.replaceContent(result, target.startIndex, target.endIndex, newContent);
    }

    return result;
  }

  private extractContent(node: SyntaxNode): string {
    // Remove quotes from string content
    return node.text.replace(/^['"`]|['"`]$/g, '');
  }

  private findTargets(tree: Tree, targetNode: SyntaxNode, conditionNode?: SyntaxNode): Array<{startIndex: number, endIndex: number}> {
    const targets: Array<{startIndex: number, endIndex: number}> = [];
    const rootNode = tree.rootNode;

    // Handle different target types
    switch (targetNode.type) {
      case 'identifier':
        // Find all nodes matching the identifier
        this.findNodesWithType(rootNode, targetNode.text, targets);
        break;
      case 'string':
        // Find exact text matches
        const searchText = targetNode.text.replace(/^['"`]|['"`]$/g, '');
        this.findNodesWithText(rootNode, searchText, targets);
        break;
      case 'regex_pattern':
        // Find regex matches
        const pattern = this.extractRegexPattern(targetNode);
        this.findNodesMatchingRegex(rootNode, pattern, targets);
        break;
    }

    // Apply condition filtering if present
    if (conditionNode) {
      return this.filterTargetsByCondition(targets, conditionNode, tree);
    }

    return targets;
  }

  private findNodesWithType(node: SyntaxNode, type: string, targets: Array<{startIndex: number, endIndex: number}>) {
    if (node.type === type) {
      targets.push({
        startIndex: node.startIndex,
        endIndex: node.endIndex,
      });
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.findNodesWithType(child, type, targets);
      }
    }
  }

  private findNodesWithText(node: SyntaxNode, text: string, targets: Array<{startIndex: number, endIndex: number}>) {
    if (node.text === text) {
      targets.push({
        startIndex: node.startIndex,
        endIndex: node.endIndex,
      });
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.findNodesWithText(child, text, targets);
      }
    }
  }

  private findNodesMatchingRegex(node: SyntaxNode, pattern: RegExp, targets: Array<{startIndex: number, endIndex: number}>) {
    if (pattern.test(node.text)) {
      targets.push({
        startIndex: node.startIndex,
        endIndex: node.endIndex,
      });
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.findNodesMatchingRegex(child, pattern, targets);
      }
    }
  }

  private extractRegexPattern(node: SyntaxNode): RegExp {
    const pattern = node.text.match(/\/(.+)\/([gimsuy]*)/);
    if (!pattern) {
      throw new Error('Invalid regex pattern');
    }
    return new RegExp(pattern[1], pattern[2]);
  }

  private filterTargetsByCondition(
    targets: Array<{startIndex: number, endIndex: number}>,
    conditionNode: SyntaxNode,
    tree: Tree
  ): Array<{startIndex: number, endIndex: number}> {
    // Extract condition components
    const [field, operator, value] = this.parseCondition(conditionNode);
    
    return targets.filter(target => {
      // Apply condition based on field and operator
      switch (field) {
        case 'type':
          const node = this.findNodeAtPosition(tree.rootNode, target.startIndex, target.endIndex);
          return node ? (operator === '=' ? node.type === value : node.type.includes(value)) : false;
        case 'text':
          const textNode = this.findNodeAtPosition(tree.rootNode, target.startIndex, target.endIndex);
          return textNode ? (operator === '=' ? textNode.text === value : textNode.text.includes(value)) : false;
        default:
          return true;
      }
    });
  }

  findNodeAtPosition(node: SyntaxNode, startIndex: number, endIndex: number): SyntaxNode | null {
    if (node.startIndex === startIndex && node.endIndex === endIndex) {
      return node;
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.startIndex <= startIndex && child.endIndex >= endIndex) {
        const found = this.findNodeAtPosition(child, startIndex, endIndex);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  parseCondition(node: SyntaxNode): [string, string, string] {
    const field = node.child(0)?.text || '';
    const operator = node.child(1)?.text || '=';
    const value = node.child(2)?.text.replace(/^['"`]|['"`]$/g, '') || '';
    return [field, operator, value];
  }

  replaceContent(content: string, start: number, end: number, newContent: string): string {
    return content.substring(0, start) + newContent + content.substring(end);
  }
}

/**
 * Command to select code elements
 */
export class SelectCommand implements Command {
  constructor(private node: SyntaxNode) {}

  execute(content: string, tree: Tree): string {
    const targetNode = this.node.child(0);
    const conditionNode = this.node.child(1);

    if (!targetNode) {
      return content; // Return full content if no target specified
    }

    // Find matching nodes
    const targets = this.findTargets(tree, targetNode, conditionNode || undefined);
    
    // Extract and join the selected content
    return targets.map(target => 
      content.substring(target.startIndex, target.endIndex)
    ).join('\n');
  }

  private findTargets(tree: Tree, targetNode: SyntaxNode, conditionNode?: SyntaxNode): Array<{startIndex: number, endIndex: number}> {
    const targets: Array<{startIndex: number, endIndex: number}> = [];
    const rootNode = tree.rootNode;

    // Handle different target types
    switch (targetNode.type) {
      case 'identifier':
        // Find all nodes matching the identifier
        this.findNodesWithType(rootNode, targetNode.text, targets);
        break;
      case 'string':
        // Find exact text matches
        const searchText = targetNode.text.replace(/^['"`]|['"`]$/g, '');
        this.findNodesWithText(rootNode, searchText, targets);
        break;
      case 'regex_pattern':
        // Find regex matches
        const pattern = this.extractRegexPattern(targetNode);
        this.findNodesMatchingRegex(rootNode, pattern, targets);
        break;
    }

    // Apply condition filtering if present
    if (conditionNode) {
      return this.filterTargetsByCondition(targets, conditionNode, tree);
    }

    return targets;
  }

  private findNodesWithType(node: SyntaxNode, type: string, targets: Array<{startIndex: number, endIndex: number}>) {
    if (node.type === type) {
      targets.push({
        startIndex: node.startIndex,
        endIndex: node.endIndex
      });
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.findNodesWithType(child, type, targets);
      }
    }
  }

  private findNodesWithText(node: SyntaxNode, text: string, targets: Array<{startIndex: number, endIndex: number}>) {
    if (node.text === text) {
      targets.push({
        startIndex: node.startIndex,
        endIndex: node.endIndex
      });
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.findNodesWithText(child, text, targets);
      }
    }
  }

  private findNodesMatchingRegex(node: SyntaxNode, pattern: RegExp, targets: Array<{startIndex: number, endIndex: number}>) {
    if (pattern.test(node.text)) {
      targets.push({
        startIndex: node.startIndex,
        endIndex: node.endIndex
      });
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.findNodesMatchingRegex(child, pattern, targets);
      }
    }
  }

  private extractRegexPattern(node: SyntaxNode): RegExp {
    const pattern = node.text.match(/\/(.+)\/([gimsuy]*)/);
    if (!pattern) {
      throw new Error('Invalid regex pattern');
    }
    return new RegExp(pattern[1], pattern[2]);
  }

  private filterTargetsByCondition(
    targets: Array<{startIndex: number, endIndex: number}>,
    conditionNode: SyntaxNode,
    tree: Tree
  ): Array<{startIndex: number, endIndex: number}> {
    // Extract condition components
    const [field, operator, value] = this.parseCondition(conditionNode);
    
    return targets.filter(target => {
      // Apply condition based on field and operator
      switch (field) {
        case 'type':
          const node = this.findNodeAtPosition(tree.rootNode, target.startIndex, target.endIndex);
          return node ? (operator === '=' ? node.type === value : node.type.includes(value)) : false;
        case 'text':
          const textNode = this.findNodeAtPosition(tree.rootNode, target.startIndex, target.endIndex);
          return textNode ? (operator === '=' ? textNode.text === value : textNode.text.includes(value)) : false;
        default:
          return true;
      }
    });
  }

  findNodeAtPosition(node: SyntaxNode, startIndex: number, endIndex: number): SyntaxNode | null {
    if (node.startIndex === startIndex && node.endIndex === endIndex) {
      return node;
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.startIndex <= startIndex && child.endIndex >= endIndex) {
        const found = this.findNodeAtPosition(child, startIndex, endIndex);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  parseCondition(node: SyntaxNode): [string, string, string] {
    const field = node.child(0)?.text || '';
    const operator = node.child(1)?.text || '=';
    const value = node.child(2)?.text.replace(/^['"`]|['"`]$/g, '') || '';
    return [field, operator, value];
  }
}

/**
 * Command to delete code elements
 */
export class DeleteCommand implements Command {
  constructor(private node: SyntaxNode) {}

  execute(content: string, tree: Tree): string {
    const targetNode = this.node.child(0);
    const conditionNode = this.node.child(1);

    if (!targetNode) {
      return ''; // Delete everything if no target specified
    }

    // Find the targets to delete
    const targets = this.findTargets(tree, targetNode, conditionNode || undefined);
    
    // Remove the targets from the content
    let result = content;
    for (const target of targets.reverse()) { // Reverse to maintain positions
      result = this.deleteContent(result, target.startIndex, target.endIndex);
    }

    return result;
  }

  private findTargets(tree: Tree, targetNode: SyntaxNode, conditionNode?: SyntaxNode): Array<{startIndex: number, endIndex: number}> {
    const targets: Array<{startIndex: number, endIndex: number}> = [];
    const rootNode = tree.rootNode;

    // Handle different target types
    switch (targetNode.type) {
      case 'identifier':
        // Find all nodes matching the identifier
        this.findNodesWithType(rootNode, targetNode.text, targets);
        break;
      case 'string':
        // Find exact text matches
        const searchText = targetNode.text.replace(/^['"`]|['"`]$/g, '');
        this.findNodesWithText(rootNode, searchText, targets);
        break;
      case 'regex_pattern':
        // Find regex matches
        const pattern = this.extractRegexPattern(targetNode);
        this.findNodesMatchingRegex(rootNode, pattern, targets);
        break;
    }

    // Apply condition filtering if present
    if (conditionNode) {
      return this.filterTargetsByCondition(targets, conditionNode, tree);
    }

    return targets;
  }

  private findNodesWithType(node: SyntaxNode, type: string, targets: Array<{startIndex: number, endIndex: number}>) {
    if (node.type === type) {
      targets.push({
        startIndex: node.startIndex,
        endIndex: node.endIndex
      });
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.findNodesWithType(child, type, targets);
      }
    }
  }

  private findNodesWithText(node: SyntaxNode, text: string, targets: Array<{startIndex: number, endIndex: number}>) {
    if (node.text === text) {
      targets.push({
        startIndex: node.startIndex,
        endIndex: node.endIndex
      });
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.findNodesWithText(child, text, targets);
      }
    }
  }

  private findNodesMatchingRegex(node: SyntaxNode, pattern: RegExp, targets: Array<{startIndex: number, endIndex: number}>) {
    if (pattern.test(node.text)) {
      targets.push({
        startIndex: node.startIndex,
        endIndex: node.endIndex
      });
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.findNodesMatchingRegex(child, pattern, targets);
      }
    }
  }

  private extractRegexPattern(node: SyntaxNode): RegExp {
    const pattern = node.text.match(/\/(.+)\/([gimsuy]*)/);
    if (!pattern) {
      throw new Error('Invalid regex pattern');
    }
    return new RegExp(pattern[1], pattern[2]);
  }

  private filterTargetsByCondition(
    targets: Array<{startIndex: number, endIndex: number}>,
    conditionNode: SyntaxNode,
    tree: Tree
  ): Array<{startIndex: number, endIndex: number}> {
    // Extract condition components
    const [field, operator, value] = this.parseCondition(conditionNode);
    
    return targets.filter(target => {
      // Apply condition based on field and operator
      switch (field) {
        case 'type':
          const node = this.findNodeAtPosition(tree.rootNode, target.startIndex, target.endIndex);
          return node ? (operator === '=' ? node.type === value : node.type.includes(value)) : false;
        case 'text':
          const textNode = this.findNodeAtPosition(tree.rootNode, target.startIndex, target.endIndex);
          return textNode ? (operator === '=' ? textNode.text === value : textNode.text.includes(value)) : false;
        default:
          return true;
      }
    });
  }

  findNodeAtPosition(node: SyntaxNode, startIndex: number, endIndex: number): SyntaxNode | null {
    if (node.startIndex === startIndex && node.endIndex === endIndex) {
      return node;
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.startIndex <= startIndex && child.endIndex >= endIndex) {
        const found = this.findNodeAtPosition(child, startIndex, endIndex);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  parseCondition(node: SyntaxNode): [string, string, string] {
    const field = node.child(0)?.text || '';
    const operator = node.child(1)?.text || '=';
    const value = node.child(2)?.text.replace(/^['"`]|['"`]$/g, '') || '';
    return [field, operator, value];
  }

  deleteContent(content: string, start: number, end: number): string {
    return content.substring(0, start) + content.substring(end);
  }
}

/**
 * Command to insert code elements
 */
export class InsertCommand implements Command {
  constructor(private node: SyntaxNode) {}

  execute(content: string, tree: Tree): string {
    const positionNode = this.node.child(0);
    const contentNode = this.node.child(1);

    if (!positionNode || !contentNode) {
      throw new Error('Insert command requires position and content');
    }

    const newContent = this.extractContent(contentNode);
    const position = positionNode.text;

    switch (position) {
      case 'start':
        return newContent + content;
      case 'end':
        return content + newContent;
      case 'before':
      case 'after':
        // TODO: Implement relative positioning
        return content;
      default:
        throw new Error(`Unknown position: ${position}`);
    }
  }

  private extractContent(node: SyntaxNode): string {
    // Remove quotes from string content
    return node.text.replace(/^['"`]|['"`]$/g, '');
  }
}

/**
 * Command to create new files
 */
export class CreateCommand implements Command {
  constructor(private node: SyntaxNode) {}

  execute(content: string, tree: Tree): string {
    const pathNode = this.node.child(0);
    const contentNode = this.node.child(1);

    if (!pathNode) {
      throw new Error('Create command requires a file path');
    }

    return contentNode ? this.extractContent(contentNode) : '';
  }

  private extractContent(node: SyntaxNode): string {
    return node.text.replace(/^['"`]|['"`]$/g, '');
  }
}

/**
 * Command to remove files
 */
export class RemoveFileCommand implements Command {
  constructor(private node: SyntaxNode) {}

  execute(content: string, tree: Tree): string {
    const pathNode = this.node.child(0);
    if (!pathNode) {
      throw new Error('Remove command requires a file path');
    }
    return ''; // File removal is handled by FileOperations
  }
}

/**
 * Command to move files
 */
export class MoveFileCommand implements Command {
  constructor(private node: SyntaxNode) {}

  execute(content: string, tree: Tree): string {
    const sourceNode = this.node.child(0);
    const targetNode = this.node.child(1);
    
    if (!sourceNode || !targetNode) {
      throw new Error('Move command requires source and target paths');
    }
    
    return content; // File moving is handled by FileOperations
  }
}

/**
 * Command to call external functions
 */
export class CallCommand implements Command {
  constructor(private node: SyntaxNode) {}

  execute(content: string, tree: Tree): string {
    const functionNode = this.node.child(0);
    const argsNode = this.node.child(1);
    
    if (!functionNode) {
      throw new Error('Call command requires a function name');
    }
    
    // Function calls should be handled by a separate function registry
    return content;
  }
}

/**
 * Factory to create appropriate command instances
 */
export class CommandFactory {
  static createCommand(node: SyntaxNode): Command {
    switch (node.type) {
      case 'update_command':
        return new UpdateCommand(node);
      case 'select_command':
        return new SelectCommand(node);
      case 'delete_command':
        return new DeleteCommand(node);
      case 'insert_command':
        return new InsertCommand(node);
      case 'create_command':
        return new CreateCommand(node);
      case 'rm_file_command':
        return new RemoveFileCommand(node);
      case 'mv_file_command':
        return new MoveFileCommand(node);
      case 'call_command':
        return new CallCommand(node);
      default:
        throw new Error(`Unknown command type: ${node.type}`);
    }
  }
}
