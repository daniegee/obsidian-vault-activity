// Obsidian exposes `window` and `activeWindow` as globals; the plugin calls
// `window.setTimeout` and friends. Alias them to the Node global so timer
// APIs (including vitest fake timers) resolve the same way they do in the app.
const globals = globalThis as Record<string, unknown>;
globals.window ??= globalThis;
globals.activeWindow ??= globalThis;
