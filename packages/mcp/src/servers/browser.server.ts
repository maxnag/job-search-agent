import { MCPServerNameEnum } from '../mcp-server-name.enum.js';
import { startStdioServer } from '../mcp-server.factory.js';

await startStdioServer(MCPServerNameEnum.BROWSER);
