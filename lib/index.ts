// ALFRET: Autonomous Language Framework for Repository Engineering Tooling
// Main library entry point.

// Daemon module
export * from "./daemon/index.js";

// Store module
export * from "./store/index.js";

// Maid module (file classification, proposals)
export * from "./maid/index.js";

// Findings module (capsules, dedup, provenance)
export * from "./findings/index.js";

// GitHub module (write operations)
export * from "./github/index.js";
