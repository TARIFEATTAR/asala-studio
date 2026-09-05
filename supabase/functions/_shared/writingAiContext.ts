import { AsyncLocalStorage } from "node:async_hooks";
import type { WritingSettings } from "./writingAiContract.ts";
export type WritingConnection = WritingSettings & { apiKey: string };
// Request-local credentials: concurrent organizations must never share settings.
export const writingAiContext = new AsyncLocalStorage<WritingConnection>();
export function getWritingConnection(): WritingConnection {
  const connection = writingAiContext.getStore();
  if (!connection) throw new Error("Writing AI request context is missing.");
  return connection;
}
