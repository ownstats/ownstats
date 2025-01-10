import bunyan, { LogLevelString } from 'bunyan';

type LoggerOptions = {
  level?: LogLevelString,
  name?: string
}

export default class Logger {
  private level: LogLevelString;
  private name: string;
  private loggerInstance: bunyan | undefined;

  // See https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/bunyan/index.d.ts#L196
  constructor (options?: LoggerOptions) {
    this.level = options?.level || process.env.LOG_LEVEL as LogLevelString || 'info' as LogLevelString;
    this.name = options?.name || `ownstats-logger`;
  }

  public getInstance() {
    if (!this.loggerInstance) {
      this.loggerInstance = bunyan.createLogger({
        name: this.name,
        level: this.level,
      });
    }
    return this.loggerInstance;
  }
}