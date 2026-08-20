import { Injectable, Optional, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { cyan, blue, yellow, green, magenta, red, gray, bold } from 'colorette';
import { CorrelationContext } from './correlation-id.context';

const serviceColors: Record<string, (text: string) => string> = {
  'API-GATEWAY': cyan,
  'USER-SERVICE': blue,
  'MARKETPLACE-SERVICE': yellow,
  'FINANCIAL-SERVICE': green,
  'COMMUNICATION-SERVICE': magenta,
};

function formatServiceName(serviceName: string): string {
  const colorFn = serviceColors[serviceName.toUpperCase()] || gray;
  return bold(colorFn(`[${serviceName.toUpperCase()}]`));
}

@Injectable()
export class AppLoggerService implements NestLoggerService {
  private winstonLogger: winston.Logger;
  private serviceName: string;

  constructor(@Optional() serviceName?: string) {
    this.serviceName = serviceName || 'USER-SERVICE';
    this.winstonLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
        winston.format.printf((info: any) => {
          const correlationId = String(info.correlationId || CorrelationContext.getCorrelationId() || 'N/A');
          const tag = formatServiceName(this.serviceName);
          const levelStr =
            info.level === 'error'
              ? red(info.level.toUpperCase())
              : info.level === 'warn'
              ? yellow(info.level.toUpperCase())
              : green(info.level.toUpperCase());
          const contextStr = info.context ? `[Context: ${info.context}]` : '';
          const msg = typeof info.message === 'object' ? JSON.stringify(info.message) : String(info.message);
          const traceStr = info.trace ? `\n${red(String(info.trace))}` : '';
          const timeStr = gray(String(info.timestamp || new Date().toISOString()));
          return `${timeStr} ${tag} [${levelStr}] ${contextStr} [CorrID: ${correlationId}]: ${msg}${traceStr}`;
        })
      ),
      transports: [new winston.transports.Console()],
    });
  }

  setServiceName(name: string) {
    this.serviceName = name;
  }

  log(message: any, context?: string) {
    this.winstonLogger.info(message, { context });
  }

  error(message: any, trace?: string, context?: string) {
    this.winstonLogger.error(message, { context, trace });
  }

  warn(message: any, context?: string) {
    this.winstonLogger.warn(message, { context });
  }

  debug(message: any, context?: string) {
    this.winstonLogger.debug(message, { context });
  }
}
