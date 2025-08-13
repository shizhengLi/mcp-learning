import { BaseMCPServer } from '../core/BaseMCPServer'
import { ServerConfig, MCPRequest, MCPResponse } from '../types'
import { z } from 'zod'
import { EventEmitter } from 'events'

export interface CollaborationSession {
  id: string
  projectId: string
  participants: string[]
  codeContext: string
  createdAt: Date
  lastActivity: Date
  isActive: boolean
  messages: CollaborationMessage[]
  codeReviews: CodeReview[]
}

export interface CollaborationMessage {
  id: string
  sessionId: string
  userId: string
  content: string
  type: 'text' | 'code' | 'suggestion'
  timestamp: Date
  replyTo?: string | undefined
}

export interface CodeReview {
  id: string
  sessionId: string
  filePath: string
  userId: string
  comments: CodeComment[]
  createdAt: Date
  status: 'pending' | 'resolved' | 'rejected'
}

export interface CodeComment {
  id: string
  line: number
  content: string
  severity: 'info' | 'warning' | 'error'
  timestamp: Date
  userId: string
  isResolved: boolean
}

export class CollaborationServer extends BaseMCPServer {
  private sessions: Map<string, CollaborationSession> = new Map()
  private eventEmitter: EventEmitter
  private sessionTimeout: number = 30 * 60 * 1000 // 30 minutes
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(config: Partial<ServerConfig> = {}) {
    const serverConfig: ServerConfig = {
      name: 'collaboration-server',
      version: '1.0.0',
      capabilities: {},
      transport: {
        type: 'stdio'
      },
      ...config
    }
    super(serverConfig)
    this.eventEmitter = new EventEmitter()
    this.startCleanupTask()
  }

  protected initializeTools(): void {
    this.server.tool(
      'start-collaboration',
      'Start a real-time collaboration session',
      {
        projectId: z.string(),
        participants: z.array(z.string()),
        codeContext: z.string(),
        sessionName: z.string().optional(),
        description: z.string().optional()
      },
      async ({ projectId, participants, codeContext, sessionName, description }) => {
        const session = await this.createCollaborationSession({
          projectId,
          participants,
          codeContext,
          sessionName,
          description
        })

        return {
          content: [
            {
              type: 'text',
              text: `Collaboration session started. Session ID: ${session.id}`
            }
          ]
        }
      }
    )

    this.server.tool(
      'join-collaboration',
      'Join an existing collaboration session',
      {
        sessionId: z.string(),
        userId: z.string(),
        userName: z.string().optional()
      },
      async ({ sessionId, userId, userName }) => {
        await this.joinCollaborationSession(sessionId, userId, userName)

        return {
          content: [
            {
              type: 'text',
              text: `Successfully joined collaboration session: ${sessionId}`
            }
          ]
        }
      }
    )

    this.server.tool(
      'send-message',
      'Send a message to collaboration session',
      {
        sessionId: z.string(),
        userId: z.string(),
        content: z.string(),
        type: z.enum(['text', 'code', 'suggestion']).optional(),
        replyTo: z.string().optional()
      },
      async ({ sessionId, userId, content, type = 'text', replyTo }) => {
        await this.sendMessage(sessionId, userId, content, type, replyTo)

        return {
          content: [
            {
              type: 'text',
              text: `Message sent to session ${sessionId}`
            }
          ]
        }
      }
    )

    this.server.tool(
      'send-code-review',
      'Send code review comments to collaborators',
      {
        sessionId: z.string(),
        filePath: z.string(),
        userId: z.string(),
        comments: z.array(
          z.object({
            line: z.number(),
            content: z.string(),
            severity: z.enum(['info', 'warning', 'error'])
          })
        )
      },
      async ({ sessionId, filePath, userId, comments }) => {
        await this.sendCodeReview(sessionId, filePath, userId, comments)

        return {
          content: [
            {
              type: 'text',
              text: `Code review sent for ${filePath}`
            }
          ]
        }
      }
    )

    this.server.tool(
      'get-session-info',
      'Get information about a collaboration session',
      {
        sessionId: z.string()
      },
      async ({ sessionId }) => {
        const session = this.sessions.get(sessionId)
        
        if (!session) {
          throw new Error(`Session ${sessionId} not found`)
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                id: session.id,
                projectId: session.projectId,
                participants: session.participants,
                codeContext: session.codeContext,
                createdAt: session.createdAt,
                lastActivity: session.lastActivity,
                isActive: session.isActive,
                messageCount: session.messages.length,
                reviewCount: session.codeReviews.length
              }, null, 2)
            }
          ]
        }
      }
    )

    this.server.tool(
      'list-sessions',
      'List all active collaboration sessions',
      {
        projectId: z.string().optional()
      },
      async ({ projectId }) => {
        const sessions = Array.from(this.sessions.values())
          .filter(session => 
            session.isActive && 
            (!projectId || session.projectId === projectId)
          )

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                sessions: sessions.map(session => ({
                  id: session.id,
                  projectId: session.projectId,
                  participantCount: session.participants.length,
                  createdAt: session.createdAt,
                  lastActivity: session.lastActivity
                }))
              }, null, 2)
            }
          ]
        }
      }
    )

    this.server.tool(
      'end-session',
      'End a collaboration session',
      {
        sessionId: z.string(),
        userId: z.string()
      },
      async ({ sessionId, userId }) => {
        await this.endCollaborationSession(sessionId, userId)

        return {
          content: [
            {
              type: 'text',
              text: `Collaboration session ${sessionId} ended`
            }
          ]
        }
      }
    )

    this.server.tool(
      'request-pair-programming',
      'Request AI assistance for pair programming',
      {
        sessionId: z.string(),
        userId: z.string(),
        codeContext: z.string(),
        requestType: z.enum(['explanation', 'suggestion', 'debugging', 'refactoring', 'optimization']),
        focusArea: z.string().optional()
      },
      async ({ sessionId, userId, codeContext, requestType, focusArea }) => {
        const assistance = await this.requestPairProgrammingAssistance(
          sessionId, userId, codeContext, requestType, focusArea
        )

        return {
          content: [
            {
              type: 'text',
              text: `Pair programming assistance provided for ${requestType}`
            },
            {
              type: 'text', 
              text: assistance
            }
          ]
        }
      }
    )

    this.server.tool(
      'share-cursor-position',
      'Share cursor position for pair programming',
      {
        sessionId: z.string(),
        userId: z.string(),
        filePath: z.string(),
        line: z.number(),
        column: z.number(),
        selection: z.object({
          startLine: z.number(),
          startColumn: z.number(),
          endLine: z.number(),
          endColumn: z.number()
        }).optional()
      },
      async ({ sessionId, userId, filePath, line, column, selection }) => {
        await this.shareCursorPosition(sessionId, userId, filePath, line, column, selection)

        return {
          content: [
            {
              type: 'text',
              text: 'Cursor position shared with collaborators'
            }
          ]
        }
      }
    )

    this.server.tool(
      'request-code-suggestion',
      'Request AI code suggestion during pair programming',
      {
        sessionId: z.string(),
        userId: z.string(),
        currentCode: z.string(),
        context: z.string().optional(),
        intent: z.enum(['complete', 'improve', 'fix', 'optimize']).optional()
      },
      async ({ sessionId, userId, currentCode, context, intent }) => {
        const suggestion = await this.requestCodeSuggestion(
          sessionId, userId, currentCode, context, intent
        )

        return {
          content: [
            {
              type: 'text',
              text: 'Code suggestion generated'
            },
            {
              type: 'text',
              text: suggestion
            }
          ]
        }
      }
    )

    this.server.tool(
      'create-branch',
      'Create a new branch for collaboration',
      {
        sessionId: z.string(),
        userId: z.string(),
        branchName: z.string(),
        baseBranch: z.string().optional(),
        description: z.string().optional()
      },
      async ({ sessionId, userId, branchName, baseBranch, description }) => {
        const result = await this.createBranch(sessionId, userId, branchName, baseBranch, description)

        return {
          content: [
            {
              type: 'text',
              text: `Branch '${branchName}' created successfully`
            },
            {
              type: 'text',
              text: result
            }
          ]
        }
      }
    )

    this.server.tool(
      'create-pull-request',
      'Create a pull request for collaboration session changes',
      {
        sessionId: z.string(),
        userId: z.string(),
        title: z.string(),
        description: z.string(),
        targetBranch: z.string().optional(),
        reviewers: z.array(z.string()).optional()
      },
      async ({ sessionId, userId, title, description, targetBranch, reviewers }) => {
        const result = await this.createPullRequest(sessionId, userId, title, description, targetBranch, reviewers)

        return {
          content: [
            {
              type: 'text',
              text: `Pull request '${title}' created successfully`
            },
            {
              type: 'text',
              text: result
            }
          ]
        }
      }
    )

    this.server.tool(
      'merge-changes',
      'Merge collaboration session changes',
      {
        sessionId: z.string(),
        userId: z.string(),
        mergeStrategy: z.enum(['merge', 'squash', 'rebase']).optional(),
        commitMessage: z.string().optional()
      },
      async ({ sessionId, userId, mergeStrategy, commitMessage }) => {
        const result = await this.mergeChanges(sessionId, userId, mergeStrategy, commitMessage)

        return {
          content: [
            {
              type: 'text',
              text: 'Changes merged successfully'
            },
            {
              type: 'text',
              text: result
            }
          ]
        }
      }
    )

    this.server.tool(
      'get-repository-status',
      'Get repository status for collaboration session',
      {
        sessionId: z.string(),
        userId: z.string()
      },
      async ({ sessionId, userId }) => {
        const status = await this.getRepositoryStatus(sessionId, userId)

        return {
          content: [
            {
              type: 'text',
              text: 'Repository status retrieved'
            },
            {
              type: 'text',
              text: JSON.stringify(status, null, 2)
            }
          ]
        }
      }
    )
  }

  protected initializeResources(): void {
    // Resources are not implemented in this version
  }

  protected getServerInstructions(): string {
    return 'Collaboration Server - Real-time code collaboration and review features'
  }

  protected async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'start-collaboration':
          return this.createSuccessResponse(
            request.id,
            await this.handleStartCollaboration(request.params || {})
          )
        case 'join-collaboration':
          return this.createSuccessResponse(
            request.id,
            await this.handleJoinCollaboration(request.params || {})
          )
        case 'send-message':
          return this.createSuccessResponse(
            request.id,
            await this.handleSendMessage(request.params || {})
          )
        case 'send-code-review':
          return this.createSuccessResponse(
            request.id,
            await this.handleSendCodeReview(request.params || {})
          )
        case 'get-session-info':
          return this.createSuccessResponse(
            request.id,
            await this.handleGetSessionInfo(request.params || {})
          )
        case 'list-sessions':
          return this.createSuccessResponse(
            request.id,
            await this.handleListSessions(request.params || {})
          )
        case 'end-session':
          return this.createSuccessResponse(
            request.id,
            await this.handleEndSession(request.params || {})
          )
        case 'request-pair-programming':
          return this.createSuccessResponse(
            request.id,
            await this.handleRequestPairProgramming(request.params || {})
          )
        case 'share-cursor-position':
          return this.createSuccessResponse(
            request.id,
            await this.handleShareCursorPosition(request.params || {})
          )
        case 'request-code-suggestion':
          return this.createSuccessResponse(
            request.id,
            await this.handleRequestCodeSuggestion(request.params || {})
          )
        case 'create-branch':
          return this.createSuccessResponse(
            request.id,
            await this.handleCreateBranch(request.params || {})
          )
        case 'create-pull-request':
          return this.createSuccessResponse(
            request.id,
            await this.handleCreatePullRequest(request.params || {})
          )
        case 'merge-changes':
          return this.createSuccessResponse(
            request.id,
            await this.handleMergeChanges(request.params || {})
          )
        case 'get-repository-status':
          return this.createSuccessResponse(
            request.id,
            await this.handleGetRepositoryStatus(request.params || {})
          )
        default:
          return this.createErrorResponse(
            request.id,
            -32601,
            `Method not found: ${request.method}`
          )
      }
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        -32603,
        `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  protected createTransport(): any {
    // Return a mock transport for testing
    return {
      start: async () => {},
      close: async () => {}
    }
  }

  // Handler methods for MCP requests
  private async handleStartCollaboration(params: any): Promise<any> {
    if (!params.projectId || !params.participants || !params.codeContext) {
      throw new Error('Missing required parameters: projectId, participants, and codeContext are required')
    }
    
    if (!Array.isArray(params.participants) || params.participants.length === 0) {
      throw new Error('participants must be a non-empty array')
    }

    const session = await this.createCollaborationSession(params)
    return {
      content: [
        {
          type: 'text',
          text: `Collaboration session started. Session ID: ${session.id}`
        }
      ]
    }
  }

  private async handleJoinCollaboration(params: any): Promise<any> {
    await this.joinCollaborationSession(params.sessionId, params.userId, params.userName)
    return {
      content: [
        {
          type: 'text',
          text: `Successfully joined collaboration session: ${params.sessionId}`
        }
      ]
    }
  }

  private async handleSendMessage(params: any): Promise<any> {
    await this.sendMessage(params.sessionId, params.userId, params.content, params.type, params.replyTo)
    return {
      content: [
        {
          type: 'text',
          text: `Message sent to session ${params.sessionId}`
        }
      ]
    }
  }

  private async handleSendCodeReview(params: any): Promise<any> {
    await this.sendCodeReview(params.sessionId, params.filePath, params.userId, params.comments)
    return {
      content: [
        {
          type: 'text',
          text: `Code review sent for ${params.filePath}`
        }
      ]
    }
  }

  private async handleGetSessionInfo(params: any): Promise<any> {
    const session = this.sessions.get(params.sessionId)
    
    if (!session) {
      throw new Error(`Session ${params.sessionId} not found`)
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            id: session.id,
            projectId: session.projectId,
            participants: session.participants,
            codeContext: session.codeContext,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            isActive: session.isActive,
            messageCount: session.messages.length,
            reviewCount: session.codeReviews.length
          }, null, 2)
        }
      ]
    }
  }

  private async handleListSessions(params: any): Promise<any> {
    const sessions = Array.from(this.sessions.values())
      .filter(session => 
        session.isActive && 
        (!params.projectId || session.projectId === params.projectId)
      )

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            sessions: sessions.map(session => ({
              id: session.id,
              projectId: session.projectId,
              participantCount: session.participants.length,
              createdAt: session.createdAt,
              lastActivity: session.lastActivity
            }))
          }, null, 2)
        }
      ]
    }
  }

  private async handleEndSession(params: any): Promise<any> {
    await this.endCollaborationSession(params.sessionId, params.userId)
    return {
      content: [
        {
          type: 'text',
          text: `Collaboration session ${params.sessionId} ended`
        }
      ]
    }
  }

  private async handleRequestPairProgramming(params: any): Promise<any> {
    const assistance = await this.requestPairProgrammingAssistance(
      params.sessionId, params.userId, params.codeContext, params.requestType, params.focusArea
    )
    return {
      content: [
        {
          type: 'text',
          text: `Pair programming assistance provided for ${params.requestType}`
        },
        {
          type: 'text',
          text: assistance
        }
      ]
    }
  }

  private async handleShareCursorPosition(params: any): Promise<any> {
    await this.shareCursorPosition(params.sessionId, params.userId, params.filePath, params.line, params.column, params.selection)
    return {
      content: [
        {
          type: 'text',
          text: 'Cursor position shared with collaborators'
        }
      ]
    }
  }

  private async handleRequestCodeSuggestion(params: any): Promise<any> {
    const suggestion = await this.requestCodeSuggestion(
      params.sessionId, params.userId, params.currentCode, params.context, params.intent
    )
    return {
      content: [
        {
          type: 'text',
          text: 'Code suggestion generated'
        },
        {
          type: 'text',
          text: suggestion
        }
      ]
    }
  }

  private async handleCreateBranch(params: any): Promise<any> {
    const result = await this.createBranch(params.sessionId, params.userId, params.branchName, params.baseBranch, params.description)
    return {
      content: [
        {
          type: 'text',
          text: `Branch '${params.branchName}' created successfully`
        },
        {
          type: 'text',
          text: result
        }
      ]
    }
  }

  private async handleCreatePullRequest(params: any): Promise<any> {
    const result = await this.createPullRequest(params.sessionId, params.userId, params.title, params.description, params.targetBranch, params.reviewers)
    return {
      content: [
        {
          type: 'text',
          text: `Pull request '${params.title}' created successfully`
        },
        {
          type: 'text',
          text: result
        }
      ]
    }
  }

  private async handleMergeChanges(params: any): Promise<any> {
    const result = await this.mergeChanges(params.sessionId, params.userId, params.mergeStrategy, params.commitMessage)
    return {
      content: [
        {
          type: 'text',
          text: 'Changes merged successfully'
        },
        {
          type: 'text',
          text: result
        }
      ]
    }
  }

  private async handleGetRepositoryStatus(params: any): Promise<any> {
    const status = await this.getRepositoryStatus(params.sessionId, params.userId)
    return {
      content: [
        {
          type: 'text',
          text: 'Repository status retrieved'
        },
        {
          type: 'text',
          text: JSON.stringify(status, null, 2)
        }
      ]
    }
  }

  private async createCollaborationSession(params: {
    projectId: string
    participants: string[]
    codeContext: string
    sessionName?: string | undefined
    description?: string | undefined
  }): Promise<CollaborationSession> {
    const sessionId = this.generateSessionId()
    const _session: CollaborationSession = {
      id: sessionId,
      projectId: params.projectId,
      participants: params.participants,
      codeContext: params.codeContext,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
      messages: [],
      codeReviews: []
    }

    this.sessions.set(sessionId, _session)

    const welcomeMessage: CollaborationMessage = {
      id: this.generateMessageId(),
      sessionId,
      userId: 'system',
      content: `Collaboration session started for project ${params.projectId}`,
      type: 'text',
      timestamp: new Date()
    }

    _session.messages.push(welcomeMessage)

    this.eventEmitter.emit('sessionCreated', _session)
    return _session
  }

  private async joinCollaborationSession(
    sessionId: string, 
    userId: string, 
    userName?: string
  ): Promise<CollaborationSession> {
    const session = this.sessions.get(sessionId)
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (!session.isActive) {
      throw new Error(`Session ${sessionId} is not active`)
    }

    if (!session.participants.includes(userId)) {
      session.participants.push(userId)
    }

    const joinMessage: CollaborationMessage = {
      id: this.generateMessageId(),
      sessionId,
      userId,
      content: userName ? `${userName} joined the session` : `User ${userId} joined the session`,
      type: 'text',
      timestamp: new Date()
    }

    session.messages.push(joinMessage)
    session.lastActivity = new Date()

    this.eventEmitter.emit('userJoined', { session, userId, userName })
    return session
  }

  private async sendMessage(
    sessionId: string,
    userId: string,
    content: string,
    type: 'text' | 'code' | 'suggestion' = 'text',
    replyTo?: string
  ): Promise<CollaborationMessage> {
    const session = this.sessions.get(sessionId)
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (!session.isActive) {
      throw new Error(`Session ${sessionId} is not active`)
    }

    if (!session.participants.includes(userId)) {
      throw new Error(`User ${userId} is not a participant in session ${sessionId}`)
    }

    const _message: CollaborationMessage = {
      id: this.generateMessageId(),
      sessionId,
      userId,
      content,
      type,
      timestamp: new Date(),
      replyTo
    }

    session.messages.push(_message)
    session.lastActivity = new Date()

    this.eventEmitter.emit('messageSent', { session, message: _message })
    return _message
  }

  private async sendCodeReview(
    sessionId: string,
    filePath: string,
    userId: string,
    comments: Array<{
      line: number
      content: string
      severity: 'info' | 'warning' | 'error'
    }>
  ): Promise<CodeReview> {
    const session = this.sessions.get(sessionId)
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (!session.isActive) {
      throw new Error(`Session ${sessionId} is not active`)
    }

    if (!session.participants.includes(userId)) {
      throw new Error(`User ${userId} is not a participant in session ${sessionId}`)
    }

    const codeComments: CodeComment[] = comments.map(comment => ({
      id: this.generateCommentId(),
      line: comment.line,
      content: comment.content,
      severity: comment.severity,
      timestamp: new Date(),
      userId,
      isResolved: false
    }))

    const _review: CodeReview = {
      id: this.generateReviewId(),
      sessionId,
      filePath,
      userId,
      comments: codeComments,
      createdAt: new Date(),
      status: 'pending'
    }

    session.codeReviews.push(_review)
    session.lastActivity = new Date()

    this.eventEmitter.emit('codeReviewSent', { session, review: _review })
    return _review
  }

  private async endCollaborationSession(sessionId: string, userId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (!session.participants.includes(userId)) {
      throw new Error(`User ${userId} is not authorized to end session ${sessionId}`)
    }

    const endMessage: CollaborationMessage = {
      id: this.generateMessageId(),
      sessionId,
      userId: 'system',
      content: `Collaboration session ended by ${userId}`,
      type: 'text',
      timestamp: new Date()
    }

    session.messages.push(endMessage)
    session.isActive = false
    session.lastActivity = new Date()

    this.eventEmitter.emit('sessionEnded', session)

    setTimeout(() => {
      this.sessions.delete(sessionId)
    }, 60000) // Delete session after 1 minute
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions()
    }, 5 * 60 * 1000) // Run every 5 minutes
  }

  private cleanupInactiveSessions(): void {
    const now = Date.now()
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.isActive && (now - session.lastActivity.getTime()) > this.sessionTimeout) {
        session.isActive = false
        
        const timeoutMessage: CollaborationMessage = {
          id: this.generateMessageId(),
          sessionId,
          userId: 'system',
          content: 'Session ended due to inactivity',
          type: 'text',
          timestamp: new Date()
        }
        
        session.messages.push(timeoutMessage)
        this.eventEmitter.emit('sessionTimeout', session)
        
        setTimeout(() => {
          this.sessions.delete(sessionId)
        }, 60000)
      }
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private generateReviewId(): string {
    return `review_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private generateCommentId(): string {
    return `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  public override async stop(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    
    for (const session of this.sessions.values()) {
      session.isActive = false
    }
    
    await super.stop()
  }

  // Event handlers for real-time features
  public onSessionCreated(handler: (session: CollaborationSession) => void): void {
    this.eventEmitter.on('sessionCreated', handler)
  }

  public onUserJoined(handler: (data: { session: CollaborationSession; userId: string; userName?: string }) => void): void {
    this.eventEmitter.on('userJoined', handler)
  }

  public onMessageSent(handler: (data: { session: CollaborationSession; message: CollaborationMessage }) => void): void {
    this.eventEmitter.on('messageSent', handler)
  }

  public onCodeReviewSent(handler: (data: { session: CollaborationSession; review: CodeReview }) => void): void {
    this.eventEmitter.on('codeReviewSent', handler)
  }

  public onSessionEnded(handler: (session: CollaborationSession) => void): void {
    this.eventEmitter.on('sessionEnded', handler)
  }

  // Pair programming assistance methods
  private async requestPairProgrammingAssistance(
    sessionId: string,
    userId: string,
    codeContext: string,
    requestType: 'explanation' | 'suggestion' | 'debugging' | 'refactoring' | 'optimization',
    focusArea?: string
  ): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (!session.participants.includes(userId)) {
      throw new Error(`User ${userId} is not a participant in session ${sessionId}`)
    }

    // Generate AI-powered assistance based on request type
    const assistance = await this.generatePairProgrammingAssistance(codeContext, requestType, focusArea)

    // Log the pair programming request
    const pairProgrammingMessage: CollaborationMessage = {
      id: this.generateMessageId(),
      sessionId,
      userId: 'system',
      content: `Pair programming assistance requested by ${userId}: ${requestType}${focusArea ? ` (${focusArea})` : ''}`,
      type: 'text',
      timestamp: new Date()
    }
    session.messages.push(pairProgrammingMessage)

    this.eventEmitter.emit('pairProgrammingAssistance', { session, userId, requestType, assistance })

    return assistance
  }

  private async shareCursorPosition(
    sessionId: string,
    userId: string,
    filePath: string,
    line: number,
    column: number,
    selection?: any
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (!session.participants.includes(userId)) {
      throw new Error(`User ${userId} is not a participant in session ${sessionId}`)
    }

    const cursorData = {
      userId,
      filePath,
      position: { line, column },
      selection,
      timestamp: new Date()
    }

    this.eventEmitter.emit('cursorPositionShared', { session, cursorData })

    // Add a system message about cursor sharing
    const cursorMessage: CollaborationMessage = {
      id: this.generateMessageId(),
      sessionId,
      userId: 'system',
      content: `${userId} is looking at ${filePath}:${line}:${column}`,
      type: 'text',
      timestamp: new Date()
    }
    session.messages.push(cursorMessage)
  }

  private async requestCodeSuggestion(
    sessionId: string,
    userId: string,
    currentCode: string,
    context?: string,
    intent?: 'complete' | 'improve' | 'fix' | 'optimize'
  ): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (!session.participants.includes(userId)) {
      throw new Error(`User ${userId} is not a participant in session ${sessionId}`)
    }

    // Generate AI-powered code suggestion
    const suggestion = await this.generateCodeSuggestion(currentCode, context, intent)

    // Log the code suggestion request
    const suggestionMessage: CollaborationMessage = {
      id: this.generateMessageId(),
      sessionId,
      userId: 'system',
      content: `Code suggestion requested by ${userId}: ${intent || 'general'}`,
      type: 'suggestion',
      timestamp: new Date()
    }
    session.messages.push(suggestionMessage)

    this.eventEmitter.emit('codeSuggestion', { session, userId, intent, suggestion })

    return suggestion
  }

  private async generatePairProgrammingAssistance(
    codeContext: string,
    requestType: 'explanation' | 'suggestion' | 'debugging' | 'refactoring' | 'optimization',
    focusArea?: string
  ): Promise<string> {
    // Simulate AI-generated assistance (in a real implementation, this would call an AI service)
    const assistanceTemplates = {
      explanation: `Here's an explanation of the code:\n\n${codeContext}\n\nThis code appears to be ${focusArea || 'a general implementation'}. Key points:\n- The main logic handles the core functionality\n- Variables are properly scoped\n- Control flow follows standard patterns`,
      suggestion: `Here are some suggestions for improvement:\n\n${focusArea ? `Focus on ${focusArea}:\n` : ''}\n1. Consider adding error handling\n2. Variable names could be more descriptive\n3. Add comments for complex logic\n4. Consider breaking down into smaller functions`,
      debugging: `Debugging assistance for:\n\n${codeContext}\n\nCommon issues to check:\n1. Variable initialization\n2. Boundary conditions\n3. Error cases\n4. Input validation\n5. Resource management`,
      refactoring: `Refactoring recommendations:\n\n${codeContext}\n\nSuggested improvements:\n1. Extract complex logic into separate functions\n2. Use more descriptive variable names\n3. Add proper error handling\n4. Consider design patterns that fit this use case`,
      optimization: `Optimization opportunities:\n\n${codeContext}\n\nPerformance considerations:\n1. Look for redundant computations\n2. Consider caching frequently used data\n3. Optimize loops and conditionals\n4. Use appropriate data structures`
    }

    return assistanceTemplates[requestType]
  }

  private async generateCodeSuggestion(
    currentCode: string,
    _context?: string,
    intent?: 'complete' | 'improve' | 'fix' | 'optimize'
  ): Promise<string> {
    // Simulate AI-generated code suggestion (in a real implementation, this would call an AI service)
    const baseSuggestion = `Based on your code:\n\n${currentCode}\n\n`

    const intentSuggestions = {
      complete: `${baseSuggestion}Here's a suggested completion:\n\n// Add your implementation here\nfunction completeLogic() {\n  // Your code logic\n  return result;\n}`,
      improve: `${baseSuggestion}Improved version:\n\n// Improved implementation\nfunction improvedVersion() {\n  // Better variable names\n  const meaningfulName = value;\n  \n  // Add error handling\n  if (!meaningfulName) {\n    throw new Error('Invalid input');\n  }\n  \n  return meaningfulName;\n}`,
      fix: `${baseSuggestion}Fixed version:\n\n// Fixed implementation\nfunction fixedVersion() {\n  // Add proper validation\n  const validatedInput = validateInput(value);\n  \n  // Handle edge cases\n  if (validatedInput === null) {\n    return defaultValue;\n  }\n  \n  return processInput(validatedInput);\n}`,
      optimize: `${baseSuggestion}Optimized version:\n\n// Optimized implementation\nfunction optimizedVersion() {\n  // Use more efficient algorithm\n  const result = efficientAlgorithm(value);\n  \n  // Cache results if applicable\n  if (cache.has(key)) {\n    return cache.get(key);\n  }\n  \n  cache.set(key, result);\n  return result;\n}`
    }

    return intentSuggestions[intent || 'improve']
  }

  // Event handlers for pair programming features
  public onPairProgrammingAssistance(handler: (data: { session: CollaborationSession; userId: string; requestType: string; assistance: string }) => void): void {
    this.eventEmitter.on('pairProgrammingAssistance', handler)
  }

  public onCursorPositionShared(handler: (data: { session: CollaborationSession; cursorData: any }) => void): void {
    this.eventEmitter.on('cursorPositionShared', handler)
  }

  public onCodeSuggestion(handler: (data: { session: CollaborationSession; userId: string; intent?: string; suggestion: string }) => void): void {
    this.eventEmitter.on('codeSuggestion', handler)
  }

  // VCS integration methods
  private async createBranch(
    sessionId: string,
    userId: string,
    branchName: string,
    baseBranch?: string,
    description?: string
  ): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (!session.participants.includes(userId)) {
      throw new Error(`User ${userId} is not a participant in session ${sessionId}`)
    }

    // Simulate branch creation (in a real implementation, this would interact with Git/VCS)
    const branchResult = {
      name: branchName,
      baseBranch: baseBranch || 'main',
      createdAt: new Date(),
      createdBy: userId,
      description: description || `Collaboration branch for ${session.projectId}`,
      sessionId: sessionId
    }

    // Log the branch creation
    const branchMessage: CollaborationMessage = {
      id: this.generateMessageId(),
      sessionId,
      userId: 'system',
      content: `Branch '${branchName}' created by ${userId} from ${baseBranch || 'main'}`,
      type: 'text',
      timestamp: new Date()
    }
    session.messages.push(branchMessage)

    this.eventEmitter.emit('branchCreated', { session, userId, branchResult })

    return JSON.stringify(branchResult, null, 2)
  }

  private async createPullRequest(
    sessionId: string,
    userId: string,
    title: string,
    description: string,
    targetBranch?: string,
    reviewers?: string[]
  ): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (!session.participants.includes(userId)) {
      throw new Error(`User ${userId} is not a participant in session ${sessionId}`)
    }

    // Simulate pull request creation (in a real implementation, this would interact with GitHub/GitLab/etc.)
    const prResult = {
      title,
      description,
      sourceBranch: `collab-${sessionId}-${Date.now()}`,
      targetBranch: targetBranch || 'main',
      author: userId,
      reviewers: reviewers || [],
      createdAt: new Date(),
      sessionId: sessionId,
      status: 'open',
      url: `https://github.com/example/repo/pull/${Math.floor(Math.random() * 1000)}`
    }

    // Log the pull request creation
    const prMessage: CollaborationMessage = {
      id: this.generateMessageId(),
      sessionId,
      userId: 'system',
      content: `Pull request '${title}' created by ${userId}`,
      type: 'text',
      timestamp: new Date()
    }
    session.messages.push(prMessage)

    this.eventEmitter.emit('pullRequestCreated', { session, userId, prResult })

    return JSON.stringify(prResult, null, 2)
  }

  private async mergeChanges(
    sessionId: string,
    userId: string,
    mergeStrategy: 'merge' | 'squash' | 'rebase' = 'merge',
    commitMessage?: string
  ): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (!session.participants.includes(userId)) {
      throw new Error(`User ${userId} is not a participant in session ${sessionId}`)
    }

    // Simulate merge operation (in a real implementation, this would interact with Git/VCS)
    const mergeResult = {
      sessionId,
      mergedBy: userId,
      mergeStrategy,
      commitMessage: commitMessage || `Merge collaboration session ${sessionId}`,
      mergedAt: new Date(),
      filesChanged: Math.floor(Math.random() * 10) + 1,
      insertions: Math.floor(Math.random() * 100) + 10,
      deletions: Math.floor(Math.random() * 50) + 5
    }

    // Log the merge operation
    const mergeMessage: CollaborationMessage = {
      id: this.generateMessageId(),
      sessionId,
      userId: 'system',
      content: `Changes merged by ${userId} using ${mergeStrategy} strategy`,
      type: 'text',
      timestamp: new Date()
    }
    session.messages.push(mergeMessage)

    this.eventEmitter.emit('changesMerged', { session, userId, mergeResult })

    return JSON.stringify(mergeResult, null, 2)
  }

  private async getRepositoryStatus(sessionId: string, userId: string): Promise<any> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (!session.participants.includes(userId)) {
      throw new Error(`User ${userId} is not a participant in session ${sessionId}`)
    }

    // Simulate repository status (in a real implementation, this would interact with Git/VCS)
    const repoStatus = {
      sessionId,
      currentBranch: `collab-${sessionId}`,
      isClean: Math.random() > 0.3,
      ahead: Math.floor(Math.random() * 5),
      behind: Math.floor(Math.random() * 3),
      stagedFiles: [
        { path: 'src/collaboration-feature.js', status: 'modified', additions: 15, deletions: 3 },
        { path: 'README.md', status: 'modified', additions: 5, deletions: 0 }
      ],
      unstagedFiles: [
        { path: 'config/collaboration.json', status: 'new' }
      ],
      untrackedFiles: [
        { path: 'temp/test.txt' }
      ],
      lastCommit: {
        hash: 'abc123def456',
        message: 'Add collaboration features',
        author: userId,
        timestamp: new Date(Date.now() - 3600000) // 1 hour ago
      }
    }

    return repoStatus
  }

  // Event handlers for VCS features
  public onBranchCreated(handler: (data: { session: CollaborationSession; userId: string; branchResult: any }) => void): void {
    this.eventEmitter.on('branchCreated', handler)
  }

  public onPullRequestCreated(handler: (data: { session: CollaborationSession; userId: string; prResult: any }) => void): void {
    this.eventEmitter.on('pullRequestCreated', handler)
  }

  public onChangesMerged(handler: (data: { session: CollaborationSession; userId: string; mergeResult: any }) => void): void {
    this.eventEmitter.on('changesMerged', handler)
  }
}