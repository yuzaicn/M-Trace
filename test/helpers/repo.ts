/**
 * 测试辅助：定位仓库根目录。
 *
 * 契约测试里有一类断言必须**直接读源文件**（例如"实现里不得出现阈值字面量"、
 * "auth.json 只判存在"）。这类断言的价值在于它们检查的是**人写下的文本**，
 * 而不是编译产物 —— 编译后的 JS 会把类型擦掉，很多契约信号正好在类型里。
 *
 * 但测试是被编译到 `dist/test/**` 后运行的，相对路径会指错地方。
 * 因此这里从当前文件出发向上找 `package.json`，而不是数 `../` 的层数：
 * 后者在调整构建布局时会静默指向错误目录（然后断言在错误文件上"通过"）。
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function findRepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (
      existsSync(resolve(dir, 'package.json')) &&
      existsSync(resolve(dir, 'src'))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        'could not locate the repository root from ' + import.meta.url,
      );
    }
    dir = parent;
  }
}

/** 仓库根目录的绝对路径。 */
export const REPO_ROOT = findRepoRoot();

/** 拼一个仓库内的路径（相对仓库根）。 */
export function repoPath(...segments: string[]): string {
  return resolve(REPO_ROOT, ...segments);
}

/** 读取仓库内一个源文件。找不到时抛错，而不是返回空串。 */
export async function readRepoFile(...segments: string[]): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  const target = repoPath(...segments);
  if (!existsSync(target)) {
    throw new Error(
      `contract test expected a file at ${segments.join('/')} but found none`,
    );
  }
  return readFile(target, 'utf8');
}

/**
 * 递归收集 `src/` 下的全部 `.ts` 源文件。
 *
 * 每个条目同时带 `text`（原始内容）与 `code`（去掉注释与字符串内容后的骨架）。
 * 检查"代码里有没有用 X"必须看 `code`；检查"文档有没有说明 X"才看 `text`。
 * 混用这两者会让断言在说明文字上假阳性，然后被人删掉。
 */
export async function collectTypeScriptSources(): Promise<
  Array<{ rel: string; text: string; code: string }>
> {
  const { readdir, readFile } = await import('node:fs/promises');
  const { toView } = await import('./scan.js');
  const out: Array<{ rel: string; text: string; code: string }> = [];

  async function walk(rel: string): Promise<void> {
    const abs = repoPath('src', rel);
    for (const entry of await readdir(abs, { withFileTypes: true })) {
      const childRel = rel.length > 0 ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(childRel);
      } else if (entry.name.endsWith('.ts')) {
        const view = toView(
          childRel,
          await readFile(repoPath('src', childRel), 'utf8'),
        );
        out.push({ rel: childRel, text: view.raw, code: view.code });
      }
    }
  }

  await walk('');
  return out;
}
