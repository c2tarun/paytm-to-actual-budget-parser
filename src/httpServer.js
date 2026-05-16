const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const log = require('./logger');

function buildApp(controller, triggerSync) {
  const app = new Hono();

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      pollInProgress: controller.pollInProgress,
      rerunRequested: controller.rerunRequested,
    })
  );

  app.post('/sync', (c) => {
    if (controller.shuttingDown) {
      return c.json({ status: 'shutting_down' }, 503);
    }

    const wasRunning = controller.pollInProgress;
    // Fire-and-forget — runCycleSafely handles concurrency via the controller.
    Promise.resolve()
      .then(() => triggerSync())
      .catch((err) => log.error('manual_sync_error', { error: err.message, stack: err.stack }));

    log.info('manual_sync_triggered', { wasRunning });
    return c.json({ status: wasRunning ? 'queued' : 'running' }, 202);
  });

  return app;
}

function startHttpServer({ port, controller, triggerSync }) {
  const app = buildApp(controller, triggerSync);
  const server = serve({ fetch: app.fetch, port });
  log.info('http_server_listening', { port });
  return server;
}

module.exports = { startHttpServer };
