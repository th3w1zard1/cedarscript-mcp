# cedardiff MCP Server

Edit files with CEDARScript grammar rules

This is a TypeScript-based MCP server that implements CEDARScript, a SQL-like language for code manipulation. It provides:

- A comprehensive grammar for code manipulation commands
- Tools for executing CEDARScript operations
- Support for complex pattern matching and transformations

## Features

### Grammar

- SQL-like syntax for code operations (DDL, DML)
- Support for file, function, class, and method targeting
- Pattern matching with regex, prefix/suffix, and indentation rules
- Block-level code manipulation capabilities

### Tools

- `edit_file` - Execute CEDARScript commands
  - Takes script and working directory as parameters
  - Supports file creation, deletion, moving, and updating
  - Pattern-based code transformations

### Implementation Status

Current testing has revealed:

- Command parsing works correctly
- Grammar supports complex operations
- File writing mechanism needs improvement
- Success messages returned but changes not persisted

## Development

Install dependencies:

```bash
npm install
```

Build the server:

```bash
npm run build
```

For development with auto-rebuild:

```bash
npm run watch
```

## Installation

To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "cedardiff": {
      "command": "/path/to/cedardiff/build/index.js"
    }
  }
}
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.

## ES Module Migration

The project has been migrated to use ES modules. Key changes include:

- Added `"type": "module"` to `package.json`
- Updated `tsconfig.json` to use `"module": "ESNext"`
- Converted import/export statements to ES module syntax
- Updated type definitions to be compatible with ES modules

### Compatibility Notes

- Ensure you are using Node.js version 12 or higher
- Use `import` instead of `require()` for module imports
- Use `.js` extension when importing local files
