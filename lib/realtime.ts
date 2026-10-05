import "server-only";
import { EventEmitter } from "node:events";

// Pengganti Supabase Realtime Broadcast kanal "kongsi-lelang".
// Satu proses Node (pm2 1 instance) → emitter in-process cukup.
const g = globalThis as unknown as { kongsiBus?: EventEmitter };
export const bus = g.kongsiBus ?? new EventEmitter();
bus.setMaxListeners(0);
g.kongsiBus = bus;

export const LELANG_EVENT = "kongsi-lelang";

export function broadcastLelang() {
  bus.emit(LELANG_EVENT, { at: new Date().toISOString() });
}
