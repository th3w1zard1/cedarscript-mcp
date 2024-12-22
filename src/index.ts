#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';

interface CaseWhen {
  empty?: boolean;
  indentLevel?: number;
  lineNumber?: number;
  lineMatcher?: string;
  regex?: string;
  prefix?: string;
  suffix?: string;
}

interface CaseAction {
  remove?: boolean;
  subPattern?: string;
  subRepl?: string;
  indent?: number;
  content?: string;
}

interface CaseStatement {
  cases: Array<{
    when: CaseWhen;
    then: CaseAction;
  }>;
  elseAction?: CaseAction;
}

class CedarDiffServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'cedardiff',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'edit_file',
          description: 'Edit a file using CEDARScript syntax',
          inputSchema: {
            type: 'object',
            properties: {
              script: {
                type: 'string',
                description: 'CEDARScript commands to execute'
              },
              workingDir: {
                type: 'string',
                description: 'Working directory for resolving file paths'
              }
            },
            required: ['script', 'workingDir'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'edit_file') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      if (!request.params.arguments || 
          typeof request.params.arguments.script !== 'string' ||
          typeof request.params.arguments.workingDir !== 'string') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Missing or invalid file/script arguments'
        );
      }

      const { script, workingDir } = request.params.arguments;
      
      try {
        // Extract file path from script
        const fileMatch = script.match(/FILE\s+['"]([^'"]+)['"]/i);
        if (!fileMatch) {
          throw new Error('Script must specify a file using FILE "path"');
        }
        const filePath = path.resolve(workingDir, fileMatch[1]);

        // Read the file
        const content = fs.readFileSync(filePath, 'utf8');

        // Parse and execute the CEDARScript
        const newContent = this.executeCedarScript(content, script);

        // Write back to file
        fs.writeFileSync(filePath, newContent);

        return {
          content: [
            {
              type: 'text',
              text: `Successfully edited ${filePath}`,
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error editing file: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private executeCedarScript(content: string, script: string): string {
    const lines = content.split('\n');
    let result = [...lines];

    // Parse the script into commands
    const commands = this.parseScript(script);

    // Execute each command
    for (const command of commands) {
      result = this.executeCommand(command, result);
    }

    return result.join('\n');
  }

  private parseScript(script: string): Array<{
    type: 'update' | 'create' | 'rm_file' | 'mv_file';
    caseStatement?: CaseStatement;
    filePath?: string;
    content?: string;
    targetPath?: string;
  }> {
    const commands: Array<{
      type: 'update' | 'create' | 'rm_file' | 'mv_file';
      targetPath?: string;
    }> = [];
    
    // Split into individual commands (separated by semicolons)
    const commandStrings = script.split(';').map(cmd => cmd.trim()).filter(Boolean);

    for (const cmdStr of commandStrings) {
      if (cmdStr.startsWith('UPDATE')) {
        commands.push(this.parseUpdateCommand(cmdStr));
      } else if (cmdStr.startsWith('CREATE')) {
        commands.push(this.parseCreateCommand(cmdStr));
      } else if (cmdStr.startsWith('RM')) {
        commands.push(this.parseRmCommand(cmdStr));
      } else if (cmdStr.startsWith('MV')) {
        commands.push(this.parseMvCommand(cmdStr));
      }
    }

    return commands;
  }

  private parseCreateCommand(cmdStr: string) {
    const fileMatch = cmdStr.match(/FILE\s+['"]([^'"]+)['"]/i);
    const contentMatch = cmdStr.match(/WITH\s+CONTENT\s+['"]([^'"]+)['"]/i);
    
    if (!fileMatch || !contentMatch) {
      throw new Error('Invalid CREATE command: must specify FILE and CONTENT');
    }

    return {
      type: 'create' as const,
      filePath: fileMatch[1],
      content: contentMatch[1]
    };
  }

  private parseRmCommand(cmdStr: string) {
    const fileMatch = cmdStr.match(/FILE\s+['"]([^'"]+)['"]/i);
    
    if (!fileMatch) {
      throw new Error('Invalid RM command: must specify FILE');
    }

    return {
      type: 'rm_file' as const,
      filePath: fileMatch[1]
    };
  }

  private parseMvCommand(cmdStr: string) {
    const fileMatch = cmdStr.match(/FILE\s+['"]([^'"]+)['"]/i);
    const toMatch = cmdStr.match(/TO\s+['"]([^'"]+)['"]/i);
    
    if (!fileMatch || !toMatch) {
      throw new Error('Invalid MV command: must specify FILE and TO');
    }

    return {
      type: 'mv_file' as const,
      filePath: fileMatch[1],
      targetPath: toMatch[1]
    };
  }

  private parseUpdateCommand(cmdStr: string): {
    type: 'update';
    caseStatement: CaseStatement;
  } {
    const caseMatch = cmdStr.match(/CASE([\s\S]+?)END/i);
    if (!caseMatch) {
      throw new Error('Invalid UPDATE command: missing CASE statement');
    }

    const caseBody = caseMatch[1];
    const caseStatement: CaseStatement = {
      cases: []
    };

    // Parse WHEN/THEN pairs
    const whenThenPairs = caseBody.split(/WHEN\s+/i).filter(Boolean);
    for (const pair of whenThenPairs) {
      const parts = pair.split(/\s+THEN\s+/i);
      if (!parts || parts.length < 2) continue;
      const [condition, action] = parts;
      if (!condition || !action) continue;

      const when: CaseWhen = {};
      const then: CaseAction = {};

      // Parse condition
      if (condition.startsWith('REGEX')) {
        const regexMatch = condition.match(/REGEX\s+['"]([^'"]+)['"]/i);
        if (regexMatch) {
          when.regex = regexMatch[1];
        }
      } else if (condition.startsWith('PREFIX')) {
        const prefixMatch = condition.match(/PREFIX\s+['"]([^'"]+)['"]/i);
        if (prefixMatch) {
          when.prefix = prefixMatch[1];
        }
      } else if (condition.startsWith('SUFFIX')) {
        const suffixMatch = condition.match(/SUFFIX\s+['"]([^'"]+)['"]/i);
        if (suffixMatch) {
          when.suffix = suffixMatch[1];
        }
      } else if (condition === 'EMPTY') {
        when.empty = true;
      }

      // Parse action
      if (action.startsWith('REMOVE')) {
        then.remove = true;
      } else if (action.startsWith('SUB')) {
        const subMatch = action.match(/SUB\s+['"]([^'"]+)['"]\s+['"]([^'"]+)['"]/i);
        if (subMatch) {
          then.subPattern = subMatch[1];
          then.subRepl = subMatch[2];
        }
      } else if (action.startsWith('INDENT')) {
        const indentMatch = action.match(/INDENT\s+([+-]?\d+)/i);
        if (indentMatch) {
          then.indent = parseInt(indentMatch[1]);
        }
      } else if (action.startsWith('CONTENT')) {
        const contentMatch = action.match(/CONTENT\s+['"]([^'"]+)['"]/i);
        if (contentMatch) {
          then.content = contentMatch[1];
        }
      }

      caseStatement.cases.push({ when, then });
    }

    return {
      type: 'update',
      caseStatement
    };
  }

  private executeCommand(command: {
    type: 'update' | 'create' | 'rm_file' | 'mv_file';
    caseStatement?: CaseStatement;
    filePath?: string;
    content?: string;
    targetPath?: string;
  }, lines: string[]): string[] {
    switch (command.type) {
      case 'update':
        if (!command.caseStatement) {
          throw new Error('Update command missing case statement');
        }
        return this.executeUpdateCommand({
          type: 'update',
          caseStatement: command.caseStatement
        }, lines);
      case 'create':
        if (command.content) {
          return command.content.split('\n');
        }
        return lines;
      case 'rm_file':
        return [];
      case 'mv_file':
        // MV command doesn't modify content, just moves the file
        return lines;
      default:
        return lines;
    }
  }

  private executeUpdateCommand(command: {
    type: 'update';
    caseStatement: CaseStatement;
  }, lines: string[]): string[] {
    const result = [...lines];
    const { caseStatement } = command;

    for (let i = 0; i < result.length; i++) {
      const line = result[i];
      
      for (const { when, then } of caseStatement.cases) {
        if (this.matchesCondition(line, when)) {
          result[i] = this.applyAction(line, then);
          if (then.remove) {
            result.splice(i, 1);
            i--;
          }
          break;
        }
      }
    }

    return result;
  }

  private matchesCondition(line: string, when: CaseWhen): boolean {
    if (when.empty && line.trim() === '') {
      return true;
    }
    if (when.regex && new RegExp(when.regex).test(line)) {
      return true;
    }
    if (when.prefix && line.startsWith(when.prefix)) {
      return true;
    }
    if (when.suffix && line.endsWith(when.suffix)) {
      return true;
    }
    return false;
  }

  private applyAction(line: string, then: CaseAction): string {
    if (then.remove) {
      return '';
    }
    if (then.subPattern && then.subRepl) {
      return line.replace(new RegExp(then.subPattern), then.subRepl);
    }
    if (typeof then.indent === 'number') {
      const indentMatch = line.match(/^\s*/);
      const currentIndent = indentMatch ? indentMatch[0].length : 0;
      const newIndent = Math.max(0, currentIndent + then.indent);
      return ' '.repeat(newIndent) + line.trimLeft();
    }
    if (then.content) {
      return then.content;
    }
    return line;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('CedarDiff MCP server running on stdio');
  }
}

const server = new CedarDiffServer();
server.run().catch(console.error);
