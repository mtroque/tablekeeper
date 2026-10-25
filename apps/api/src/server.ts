import { createApp } from './app';
import { loadConfig } from './config';
import { createLogger } from './logger';

const config = loadConfig();
const logger = createLogger(config);
const app = createApp(config, { logger });

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'api listening');
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
