import { defineConfig } from "tsup";
import { readFile, writeFile, access } from "node:fs/promises";

const USE_CLIENT_DIRECTIVE = `"use client";\n`;

async function ensureUseClientDirective(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    return;
  }
  const content = await readFile(filePath, "utf8");
  if (
    content.startsWith(`"use client"`) ||
    content.startsWith(`'use client'`)
  ) {
    return;
  }
  await writeFile(filePath, USE_CLIENT_DIRECTIVE + content, "utf8");
}

export default defineConfig([
  {
    entry: { "client/index": "src/client/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    external: ["react", "react-dom"],
    outExtension({ format }) {
      return { js: format === "cjs" ? ".cjs" : ".js" };
    },
    async onSuccess() {
      await ensureUseClientDirective("dist/client/index.js");
      await ensureUseClientDirective("dist/client/index.cjs");
    },
  },
  {
    entry: { "server/index": "src/server/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: false,
    treeshake: true,
    external: ["next", "next/server"],
    outExtension({ format }) {
      return { js: format === "cjs" ? ".cjs" : ".js" };
    },
  },
]);
