// The browser loads the reducer's slices after the page starts; tests register them up front so
// the reducer and provider stay synchronous, as on the server. The lazy path has its own test,
// `tests/ward-reducer-lazy-slices.test.ts`.
import "@/components/ward-management/ward-flow-reducer-slices";
