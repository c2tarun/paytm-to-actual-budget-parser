/**
 * Structured JSON logger for Loki/Promtail ingestion.
 *
 * Each line is a single JSON object with at least:
 *   { level, msg, ts }
 * Extra fields are merged in as-is.
 */

function log(level, msg, extra = {}) {
  const entry = {
    level,
    msg,
    ts: new Date().toISOString(),
    service: 'paytm-importer',
    ...extra
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

module.exports = {
  info: (msg, extra) => log('info', msg, extra),
  warn: (msg, extra) => log('warn', msg, extra),
  error: (msg, extra) => log('error', msg, extra),
  debug: (msg, extra) => log('debug', msg, extra),
};
