# MCP 基础概念详解

## 什么是 Model Context Protocol (MCP)？

Model Context Protocol (MCP) 是一个标准化的通信协议，用于在 AI 模型与外部工具和服务之间建立安全、可靠的连接。它由 Anthropic 公司开发，旨在解决 AI 模型访问外部资源时的标准化问题。

### MCP 的核心价值

1. **标准化接口**: 为 AI 模型提供统一的工具访问接口
2. **安全性**: 定义了安全的数据交换机制
3. **可扩展性**: 支持各种类型的工具和服务
4. **跨平台**: 支持多种编程语言和平台

## MCP 架构

### 基本架构图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Model      │    │   MCP Client    │    │   MCP Server    │
│   (Claude, etc) │◄──►│   (Cursor, etc) │◄──►│   (Context7)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │                        │
                               ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Transport      │    │  Tools/Resources│
                       │  (stdio/http)   │    │  (API, Database)│
                       └─────────────────┘    └─────────────────┘
```

### 核心组件

#### 1. MCP Server
- **职责**: 提供具体的功能和服务
- **特点**: 实现 MCP 规范，注册工具和资源
- **示例**: Context7 服务器提供文档检索服务

#### 2. MCP Client
- **职责**: 连接 AI 模型和 MCP 服务器
- **特点**: 管理通信会话，处理消息路由
- **示例**: Claude Desktop、Cursor 等

#### 3. Transport Layer
- **职责**: 处理底层通信
- **类型**: stdio、HTTP、SSE
- **特点**: 支持不同的部署场景

#### 4. Tools & Resources
- **Tools**: 可被 AI 模型调用的功能
- **Resources**: 可被访问的数据和资源
- **特点**: 标准化的接口定义

## MCP 消息协议

### 消息格式
MCP 使用 JSON-RPC 2.0 作为消息格式：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "resolve-library-id",
    "arguments": {
      "libraryName": "react"
    }
  }
}
```

### 消息类型

#### 1. 请求消息 (Request)
```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "method": "tools/call",
  "params": {
    "name": "tool-name",
    "arguments": {
      "param1": "value1"
    }
  }
}
```

#### 2. 响应消息 (Response)
```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Tool execution result"
      }
    ]
  }
}
```

#### 3. 错误消息 (Error)
```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": {
      "details": "Additional error information"
    }
  }
}
```

## 传输协议详解

### 1. STDIO 传输

**特点**:
- 最简单的传输方式
- 通过标准输入输出通信
- 适合本地开发环境

**工作原理**:
```
AI Client ── stdin/out ── MCP Server
```

**优势**:
- 简单易用
- 低延迟
- 适合本地开发

**劣势**:
- 不适合远程部署
- 扩展性有限

### 2. HTTP 传输

**特点**:
- 基于 HTTP 协议
- 支持远程部署
- 可扩展性强

**工作原理**:
```
AI Client ── HTTP Request ── MCP Server
           └─ HTTP Response ─┘
```

**优势**:
- 支持远程访问
- 可扩展性好
- 支持负载均衡

**劣势**:
- 需要网络配置
- 延迟相对较高

### 3. SSE 传输

**特点**:
- 基于服务器推送事件
- 支持实时通信
- 保持长连接

**工作原理**:
```
AI Client ── SSE Connection ── MCP Server
           └─ Server Events ─┘
```

**优势**:
- 实时性好
- 支持推送通知
- 连接保持

**劣势**:
- 资源消耗较大
- 需要连接管理

## MCP 服务器开发

### 基本开发流程

#### 1. 初始化服务器
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer(
  {
    name: "My MCP Server",
    version: "1.0.0",
  },
  {
    instructions: "Server description and usage instructions",
  }
);
```

#### 2. 注册工具
```typescript
server.tool(
  "tool-name",
  "Tool description",
  {
    param1: z.string().describe("Parameter description"),
    param2: z.number().optional().describe("Optional parameter"),
  },
  async ({ param1, param2 }) => {
    // Tool implementation
    return {
      content: [
        {
          type: "text",
          text: "Tool execution result",
        },
      ],
    };
  }
);
```

#### 3. 连接传输层
```typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 工具开发最佳实践

#### 1. 参数验证
```typescript
// 使用 Zod 进行参数验证
const schema = z.object({
  query: z.string().min(1).max(100),
  limit: z.number().min(1).max(100).optional().default(10),
});
```

#### 2. 错误处理
```typescript
try {
  const result = await performOperation(params);
  return {
    content: [{ type: "text", text: result }],
  };
} catch (error) {
  return {
    content: [{ type: "text", text: `Error: ${error.message}` }],
    isError: true,
  };
}
```

#### 3. 响应格式
```typescript
return {
  content: [
    {
      type: "text",
      text: "Result text",
    },
    {
      type: "image",
      data: "base64-encoded-image",
      mimeType: "image/png",
    },
  ],
};
```

## MCP 客户端集成

### 客户端配置示例

#### Claude Desktop
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

#### Cursor
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

#### VS Code
```json
{
  "mcp": {
    "servers": {
      "context7": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@upstash/context7-mcp"]
      }
    }
  }
}
```

## 安全考虑

### 1. 输入验证
- 验证所有输入参数
- 限制参数长度和范围
- 使用类型安全的模式定义

### 2. 输出过滤
- 过滤敏感信息
- 限制输出大小
- 格式化输出内容

### 3. 访问控制
- 实现认证机制
- 限制访问频率
- 记录访问日志

### 4. 数据保护
- 加密敏感数据
- 安全处理用户信息
- 遵循数据保护法规

## 部署和运维

### 部署方式

#### 1. 本地部署
- 直接运行 npm 包
- 适合开发和测试
- 简单快捷

#### 2. 容器化部署
```dockerfile
FROM node:18-alpine
WORKDIR /app
RUN npm install -g @upstash/context7-mcp
CMD ["context7-mcp"]
```

#### 3. 云服务部署
- 使用云函数
- 容器编排
- 负载均衡

### 监控和日志

#### 1. 健康检查
```typescript
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: Date.now() });
});
```

#### 2. 指标收集
- 请求计数
- 响应时间
- 错误率
- 资源使用情况

#### 3. 日志记录
```typescript
console.error(`[${new Date().toISOString()}] Error: ${error.message}`);
```

## 最佳实践

### 1. 设计原则
- **单一职责**: 每个工具专注一个功能
- **一致性**: 统一的接口设计
- **可扩展性**: 易于添加新功能
- **可维护性**: 清晰的代码结构

### 2. 性能优化
- 缓存常用结果
- 异步处理
- 资源复用
- 并发控制

### 3. 错误处理
- 优雅降级
- 详细的错误信息
- 重试机制
- 熔断保护

### 4. 文档和测试
- 完整的 API 文档
- 使用示例
- 单元测试
- 集成测试

## 总结

Model Context Protocol 为 AI 模型与外部工具的集成提供了标准化的解决方案。通过理解 MCP 的核心概念、架构和最佳实践，开发者可以构建安全、可靠、可扩展的 MCP 服务器，为 AI 模型提供更强大的功能支持。

Context7 服务器作为 MCP 的优秀实现案例，展示了如何在实际应用中运用 MCP 规范，为 AI 模型提供实时的库文档和代码示例服务。