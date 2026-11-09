/**
 * Lets a script run under tsx load modules that import CSS modules (the shared engine reaches a few
 * through the statistics projector). Each `.css` import becomes an object that names every class
 * after itself. Vitest handles CSS on its own, so this does nothing there.
 */
import { registerHooks } from "node:module";

if (!process.env.VITEST) {
  registerHooks({
    load(url, context, nextLoad) {
      if (url.endsWith(".css")) {
        return {
          format: "module",
          source: "export default new Proxy({}, { get: (_, key) => (typeof key === 'string' ? key : undefined) });",
          shortCircuit: true,
        };
      }
      return nextLoad(url, context);
    },
  });
}
