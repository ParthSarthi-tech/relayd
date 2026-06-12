import { loadEnv } from '@relay/config'
import pino, { type Logger } from 'pino'

export type { Logger }

let logger: Logger | undefined

export function getLogger(): Logger {
  if (logger) return logger
  const env = loadEnv()
  logger = pino({
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV === 'development' && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
    }),
  })
  return logger
}
