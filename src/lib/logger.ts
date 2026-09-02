import pino from "pino";

/**
 * Structured logging. Cloud Run collects stdout as JSON, so the default
 * serializer already lands correctly in Cloud Logging.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "audio",
      "*.idToken",
      "*.accessToken",
    ],
    censor: "[redacted]",
  },
});

/** Child logger scoped to a single request, so lines can be correlated. */
export function requestLogger(requestId: string) {
  return logger.child({ requestId });
}
