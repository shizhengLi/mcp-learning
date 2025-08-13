export class Logger {
  private static instance: Logger

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  static debug(message: string, ...args: any[]): void {
    Logger.getInstance().log('debug', message, ...args)
  }

  static info(message: string, ...args: any[]): void {
    Logger.getInstance().log('info', message, ...args)
  }

  static warn(message: string, ...args: any[]): void {
    Logger.getInstance().log('warn', message, ...args)
  }

  static error(message: string, ...args: any[]): void {
    Logger.getInstance().log('error', message, ...args)
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`

    if (args.length > 0) {
      console.log(logMessage, ...args)
    } else {
      console.log(logMessage)
    }
  }
}
