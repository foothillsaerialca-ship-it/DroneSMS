type TelemetryContext = Record<
  string,
  string | number | boolean | null | undefined
>;

function safeContext(context: TelemetryContext) {
  return Object.fromEntries(
    Object.entries(context).filter(
      ([, value]) =>
        ["string", "number", "boolean"].includes(typeof value) ||
        value === null,
    ),
  );
}

export function reportClientError(
  event: string,
  error: unknown,
  context: TelemetryContext = {},
) {
  const payload = {
    event,
    correlationId:
      typeof context.correlationId === "string"
        ? context.correlationId
        : crypto.randomUUID(),
    errorType: error instanceof Error ? error.name : "UnknownError",
    route: window.location.pathname,
    occurredAt: new Date().toISOString(),
    context: safeContext(context),
  };
  const endpoint = import.meta.env.VITE_TELEMETRY_ENDPOINT as
    string | undefined;
  if (endpoint)
    navigator.sendBeacon(
      endpoint,
      new Blob([JSON.stringify(payload)], { type: "application/json" }),
    );
  else if (import.meta.env.DEV) console.error(JSON.stringify(payload));
  return payload.correlationId;
}
