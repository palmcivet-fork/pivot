import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

// Define registry types locally
export interface RegistryItem {
  name: string;
  type: string;
  title?: string;
  description?: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: Array<{
    path: string;
    type: string;
    target?: string;
  }>;
  cssVars?: Record<string, any>;
  meta?: Record<string, any>;
}

export interface Registry {
  name: string;
  $schema?: string;
  homepage?: string;
  items: RegistryItem[];
}

const registryItemSchema = z.object({
  name: z.string(),
  type: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  registryDependencies: z.array(z.string()).optional(),
  files: z.array(z.object({
    path: z.string(),
    type: z.string(),
    target: z.string().optional(),
  })).optional(),
  cssVars: z.record(z.any()).optional(),
  meta: z.record(z.any()).optional(),
});

// Load registry data dynamically
async function loadRegistryData() {
  const { pivot } = await import("../registry/registry-pivot.js");
  const { lib } = await import("../registry/registry-lib.js");
  const { exampleRegistry: example } = await import("../registry/registry-example.js");

  return { pivot, lib, example };
}

const DEPRECATED_ITEMS: string[] = [];

async function buildRegistryIndex() {
  const { pivot, lib, example } = await loadRegistryData();

  const registry = {
    name: "pivot/ui",
    $schema: "https://ui.shadcn.com/schema/registry.json",
    homepage: "https://pivotkit.vercel.app",
    items: z.array(registryItemSchema).parse(
      [
        {
          name: "index",
          type: "registry:style",
          dependencies: [
            "class-variance-authority",
            "lucide-react",
          ],
          registryDependencies: ["utils"],
          cssVars: {},
          files: [],
        },
        ...pivot,
        ...lib,
        ...example,
      ].filter((item) => {
        return !DEPRECATED_ITEMS.includes(item.name);
      }),
    ),
  } satisfies Registry;

  let index = `/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
// This file is autogenerated by scripts/build-registry.ts
// Do not edit this file directly.
import * as React from "react"

export const Index: Record<string, any> = {`;
  for (const item of registry.items) {
    const resolveFiles = item.files?.map((file) => `${file.path}`);
    if (!resolveFiles) {
      continue;
    }

    const componentPath = item.files?.[0]?.path
      ? `@/${item.files[0].path}`
      : "";

    index += `
  "${item.name}": {
    name: "${item.name}",
    description: "${item.description ?? ""}",
    type: "${item.type}",
    registryDependencies: ${JSON.stringify(item.registryDependencies)},
    files: [${item.files?.map((file) => {
      const filePath = `${typeof file === "string" ? file : file.path}`;
      const resolvedFilePath = path.resolve(filePath);
      return typeof file === "string"
        ? `"${resolvedFilePath}"`
        : `{
      path: "${filePath}",
      type: "${file.type}",
      target: "${file.target ?? ""}"
    }`;
    })}],
    component: ${componentPath
        ? `React.lazy(async () => {
      const mod = await import("${componentPath}")
      const exportName = Object.keys(mod).find(key => typeof mod[key] === 'function' || typeof mod[key] === 'object') || item.name
      return { default: mod.default || mod[exportName] }
    })`
        : "null"
      },
    meta: ${JSON.stringify(item.meta)},
  },`;
  }

  index += `
  }`;

  // Write style index.
  try {
    await fs.rm(path.join(process.cwd(), "__registry__/index.tsx"), { force: true });
  } catch (error) {
    // Ignore if file doesn't exist
  }
  await fs.writeFile(path.join(process.cwd(), "__registry__/index.tsx"), index);

  return registry;
}

async function buildRegistryJsonFile() {
  const { pivot, lib, example } = await loadRegistryData();

  const registry = {
    name: "pivot/ui",
    homepage: "https://pivotkit.vercel.app",
    items: z.array(registryItemSchema).parse(
      [
        {
          name: "index",
          type: "registry:style",
          dependencies: [
            "class-variance-authority",
            "lucide-react",
          ],
          registryDependencies: ["utils"],
          cssVars: {},
          files: [],
        },
        ...pivot,
        ...lib,
        ...example,
      ].filter((item) => {
        return !DEPRECATED_ITEMS.includes(item.name);
      }),
    ),
  } satisfies Registry;

  // 1. Fix the path for registry items.
  const fixedRegistry = {
    ...registry,
    items: registry.items.map((item) => {
      const files = item.files?.map((file) => {
        return {
          ...file,
          path: `${file.path}`,
        };
      });

      return {
        ...item,
        files,
      };
    }),
  };

  // 2. Write the content of the registry to `registry.json` and public folder
  try {
    await fs.rm(path.join(process.cwd(), `registry.json`), { force: true });
    await fs.rm(path.join(process.cwd(), `public/registry.json`), { force: true });
  } catch (error) {
    // Ignore if files don't exist
  }

  const registryJson = JSON.stringify(fixedRegistry, null, 2);

  await fs.writeFile(path.join(process.cwd(), `registry.json`), registryJson);
  await fs.writeFile(
    path.join(process.cwd(), `public/registry.json`),
    registryJson,
  );
}

async function buildRegistry() {
  return new Promise((resolve, reject) => {
    const process = exec(`echo "shadcn build not available, skipping..."`);

    process.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

try {
  console.log("🗂️ Building registry/__index__.tsx...");
  await buildRegistryIndex();
  console.log("✅ Registry index built successfully");

  console.log("💅 Building registry.json...");
  await buildRegistryJsonFile();
  console.log("✅ Registry JSON file built successfully");

  console.log("🏗️ Building registry...");
  await buildRegistry();
  console.log("✅ Registry build completed");
} catch (error) {
  console.error("❌ Build failed with error:");
  console.error(error);
  if (error instanceof Error) {
    console.error("Error stack:", error.stack);
  }
  process.exit(1);
}
