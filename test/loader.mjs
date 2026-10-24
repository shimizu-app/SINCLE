/**
 * node:test で TypeScript をそのまま読むための橋渡し。
 *
 * Node は "@/lib/design" のような別名も、拡張子なしの .ts も解決できない。
 * tsconfig の paths と同じことを 20行でやる。
 * これのために依存を足したくないので、Node 標準の仕掛けだけを使う。
 */
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const isFile = (path) => existsSync(path) && statSync(path).isFile();

function locate(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (isFile(candidate)) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let base = null;
    if (specifier.startsWith("@/")) {
      base = resolvePath(ROOT, specifier.slice(2));
    } else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
    }

    const found = base && locate(base);
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true };

    return nextResolve(specifier, context);
  },
});
