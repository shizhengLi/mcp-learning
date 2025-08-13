# Context7 MCP 服务器源码分析

## 项目概述

Context7 是一个基于 Model Context Protocol (MCP) 的服务器，专门用于为 AI 模型提供最新的代码库文档和示例。该项目由 Upstash 开发，旨在解决 LLM 使用过时或通用信息的问题。

### 核心功能
- **动态文档检索**: 从各种开源项目中获取最新的文档和代码示例
- **库 ID 解析**: 将通用库名称解析为 Context7 兼容的库 ID
- **多传输协议支持**: 支持 stdio、HTTP 和 SSE 三种传输协议
- **客户端 IP 加密**: 对客户端 IP 地址进行加密保护

## MCP 基础概念

### 什么是 Model Context Protocol (MCP)？

Model Context Protocol 是一个标准化的协议，用于 AI 模型与外部工具和服务之间的通信。它定义了一套规范，允许 AI 模型安全、可靠地访问外部资源。

### MCP 架构组件

#### 1. 服务器 (Server)
MCP 服务器是提供具体功能的服务端实现。Context7 服务器就是一个典型的 MCP 服务器，它：
- 实现了 MCP 规范定义的接口
- 提供特定的工具和资源
- 支持多种传输协议

#### 2. 客户端 (Client)
MCP 客户端是使用 MCP 服务的应用程序，如：
- Claude Desktop
- Cursor
- VS Code
- 其他支持 MCP 的开发工具

#### 3. 传输协议 (Transport)
MCP 支持多种传输协议：

**STDIO (标准输入输出)**
- 通过进程间通信传输数据
- 适合本地开发环境
- 使用 `StdioServerTransport`

**HTTP (超文本传输协议)**
- 基于 HTTP 的远程通信
- 适合分布式部署
- 使用 `StreamableHTTPServerTransport`

**SSE (Server-Sent Events)**
- 基于服务器推送事件的实时通信
- 适合需要实时更新的场景
- 使用 `SSEServerTransport`

#### 4. 工具 (Tools)
MCP 服务器提供的具体功能，Context7 提供了两个主要工具：

**resolve-library-id**
- 功能：将库名称解析为 Context7 兼容的库 ID
- 输入：libraryName (库名称)
- 输出：匹配的库列表和详细信息

**get-library-docs**
- 功能：获取指定库的文档
- 输入：context7CompatibleLibraryID (库 ID)、topic (可选主题)、tokens (可选令牌数)
- 输出：最新的库文档和代码示例

## 源码分析

### 项目结构

```
context7/
├── src/
│   ├── index.ts              # 主入口文件
│   └── lib/
│       ├── api.ts           # API 调用逻辑
│       ├── encryption.ts    # 加密工具
│       ├── types.ts         # 类型定义
│       └── utils.ts         # 工具函数
├── schema/
│   └── context7.json        # MCP 架构定义
└── package.json             # 项目配置
```

### 核心模块分析

#### 1. 主入口文件 (src/index.ts)

**服务器初始化**
```typescript
const server = new McpServer(
  {
    name: "Context7",
    version: "1.0.13",
  },
  {
    instructions: "Use this server to retrieve up-to-date documentation and code examples for any library.",
  }
);
```

**传输协议配置**
```typescript
const program = new Command()
  .option("--transport <stdio|http|sse>", "transport type", "stdio")
  .option("--port <number>", "port for HTTP/SSE transport", "3000")
  .parse(process.argv);
```

**工具注册**
```typescript
server.tool(
  "resolve-library-id",
  // 工具描述和参数定义
  {
    libraryName: z.string().describe("Library name to search for"),
  },
  async ({ libraryName }) => {
    // 工具实现逻辑
  }
);
```

#### 2. API 模块 (src/lib/api.ts)

**搜索功能**
```typescript
export async function searchLibraries(query: string, clientIp?: string): Promise<SearchResponse> {
  const url = new URL(`${CONTEXT7_API_BASE_URL}/v1/search`);
  url.searchParams.set("query", query);
  
  const headers = generateHeaders(clientIp);
  const response = await fetch(url, { headers });
  
  return await response.json();
}
```

**文档获取**
```typescript
export async function fetchLibraryDocumentation(
  libraryId: string,
  options: { tokens?: number; topic?: string } = {},
  clientIp?: string
): Promise<string | null> {
  const url = new URL(`${CONTEXT7_API_BASE_URL}/v1/${libraryId}`);
  if (options.tokens) url.searchParams.set("tokens", options.tokens.toString());
  if (options.topic) url.searchParams.set("topic", options.topic);
  
  const headers = generateHeaders(clientIp, { "X-Context7-Source": "mcp-server" });
  const response = await fetch(url, { headers });
  
  return await response.text();
}
```

#### 3. 类型定义 (src/lib/types.ts)

**搜索结果**
```typescript
export interface SearchResult {
  id: string;                    // Context7 库 ID
  title: string;                 // 库名称
  description: string;           // 描述
  branch: string;                // 分支
  lastUpdateDate: string;        // 最后更新日期
  state: DocumentState;          // 文档状态
  totalTokens: number;           // 总令牌数
  totalSnippets: number;         // 代码片段数量
  totalPages: number;            // 总页数
  stars?: number;                // GitHub 星标
  trustScore?: number;           // 信任分数
  versions?: string[];           // 可用版本
}
```

#### 4. 加密模块 (src/lib/encryption.ts)

**客户端 IP 加密**
```typescript
function encryptClientIp(clientIp: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);
  let encrypted = cipher.update(clientIp, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}
```

#### 5. 工具函数 (src/lib/utils.ts)

**搜索结果格式化**
```typescript
export function formatSearchResult(result: SearchResult): string {
  const formattedResult = [
    `- Title: ${result.title}`,
    `- Context7-compatible library ID: ${result.id}`,
    `- Description: ${result.description}`,
  ];
  
  if (result.totalSnippets !== -1) {
    formattedResult.push(`- Code Snippets: ${result.totalSnippets}`);
  }
  
  return formattedResult.join("\n");
}
```

### 工作流程

#### 1. 启动流程
1. 解析命令行参数（传输类型、端口）
2. 根据传输类型创建对应的服务器实例
3. 注册 MCP 工具
4. 启动服务器监听

#### 2. 请求处理流程
1. 接收客户端请求
2. 解析请求参数
3. 调用对应的 API
4. 处理响应数据
5. 返回格式化结果

#### 3. 工具调用流程
1. 客户端调用 `resolve-library-id` 工具
2. 服务器搜索匹配的库
3. 返回库列表和 ID
4. 客户端调用 `get-library-docs` 工具
5. 服务器获取最新文档
6. 返回文档内容

## 技术特点

### 1. 多传输协议支持
- **STDIO**: 适合本地开发，简单可靠
- **HTTP**: 适合远程部署，支持负载均衡
- **SSE**: 适合实时通信，支持长连接

### 2. 安全性考虑
- 客户端 IP 加密
- CORS 头设置
- 错误处理和日志记录
- 请求频率限制处理

### 3. 可扩展性
- 模块化设计
- 清晰的类型定义
- 统一的错误处理
- 配置化参数

### 4. 开发友好
- 详细的工具描述
- 完善的类型检查
- 灵活的参数配置
- 多种部署选项

## 部署和配置

### 本地部署
```bash
# 使用 stdio 传输
npx @upstash/context7-mcp

# 使用 HTTP 传输
npx @upstash/context7-mcp --transport http --port 3000
```

### 配置文件示例
```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```

## 总结

Context7 MCP 服务器是一个功能完善、设计良好的 MCP 实现，它：

1. **解决了实际问题**: 为 AI 模型提供最新的库文档和代码示例
2. **技术实现优秀**: 支持多种传输协议，具有良好的扩展性
3. **安全性考虑周全**: 包含加密、错误处理等安全措施
4. **易于集成**: 提供清晰的 API 和配置选项

该项目是学习和理解 MCP 架构的优秀案例，展示了如何构建一个实用、安全、可扩展的 MCP 服务器。