import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_memoyoszwdxoakquebzc",
  runtime: "node",
  logLevel: "log",
  dirs: ["./src/trigger"],
  maxDuration: 900, // 15 minutes max duration for newsroom pipeline
  build: {
    external: ["zod"],
  },
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 2000,
      maxTimeoutInMs: 15000,
      factor: 2,
      randomize: true,
    },
  },
});
