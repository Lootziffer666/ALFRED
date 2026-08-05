// ALFRET: Autonomous Language Framework for Repository Engineering Tooling
// Main library entry point.

// Daemon module
export * from "./daemon/index";

// Store module
export * from "./store/index";

// Maid module (file classification, proposals)
export * from "./maid/index";

// Findings module (capsules, dedup, provenance)
export * from "./findings/index";

// GitHub module (write operations)
export * from "./github/index";
