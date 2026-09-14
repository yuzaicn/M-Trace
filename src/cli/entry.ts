/**
 * CLI 入口 / CLI entry.
 *
 * 这一个文件是**唯一**允许接触 `process` 的地方（另一个是 `bin/m-trace.js`）。
 * 它的职责只有三件：拼装注入依赖、调用 `runCli`、按返回码退出。
 *
 * ## 分发渠道解耦（契约 §7）
 *
 * 本文件**不得**：
 *  - `require.resolve('m-trace')` 或任何形式的包名解析；
 *  - 依赖 `node_modules/m-trace/...` 这一布局；
 *  - 以 npm 特有字段（`package.json` 的 `files` / `bin` 等）作为运行时配置来源。
 *
 * 资源路径一律按**相对本文件**解析（`new URL('../data/...', import.meta.url)`），
 * 这样无论它是被 `npx`、被 GitHub Releases 解包、还是被别人拷进自己的项目，
 * 行为都一致。
 *
 * 阶段 3 的实现任务负责把 `detect` / `score` / `report` 的真正管线接上；
 * 本文件当前只落地契约层的参数解析骨架与退出码语义。
 */

import { EXIT } from '../types/cli.js';
import type { CliCommand, ExitCode } from '../types/cli.js';

/** 已识别但尚未接上实现的子命令。阶段 3 逐个补齐。 */
const COMMANDS: readonly CliCommand[] = [
  'detect',
  'challenges',
  'score',
  'report',
  'library',
  'doctor',
  'verify',
];

/**
 * 帮助文本。中英双语是 P0-3 的一部分，因此帮助从第一天就是双语的。
 * 措辞与 `data/i18n/` 目录的最终形态无关 —— 目录就绪后这里改为读目录。
 */
export function renderHelp(version: string): string {
  return `m-trace ${version}

Trace and verify the model identity behind AI coding interactions.
追踪并验证 AI 编程交互背后的模型身份。

Usage / 用法:
  m-trace [command] [options]

Commands / 命令:
  detect       Run probes and attribute the endpoint (default) / 探测并归因（默认）
  challenges   Print challenge prompts for manual copy-paste use / 生成挑战文本
  score        Score pasted output offline / 由粘贴文本离线打分
  report       Re-render a report from a saved evidence pack / 由证据包重新渲染报告
  library      Inspect the reference bank: info | verify | hash / 查看参考指纹库
  doctor       Environment self-check without probing / 环境自检（不探测）
  verify       Re-derive a verdict from an evidence pack / 第三方复验

Options / 选项:
  --locale <zh-CN|en>   Report and terminal language / 报告与终端语言
  --out <path>          Report output path / 报告输出路径
  --json <path>         Also write the machine-readable verdict / 同时写出机读判定
  --library <path>      Override the reference bank path / 覆盖参考库路径
  --offline             Local bank only, no network / 只用本地库，禁止联网
  --no-config-read      Do not read local agent configuration / 不读本机配置
  --yes                 Non-interactive confirmation / 非交互确认
  --quiet, --verbose, --no-color
  -h, --help            Show this help / 显示本帮助
  -v, --version         Show version / 显示版本号

Exit codes / 退出码:
  0    verdict is in-library or in-library-family / 归因命中
  10   verdict is unknown (out-of-library) / 无法判定（库外）
  11   verdict is ambiguous / 判定歧义
  12   self-reported model conflicts with the verdict / 自报与结论冲突
  2    usage error / 用法错误
  3    transport error / 网络或上游错误
  4    insufficient or malformed evidence / 证据不足或异常
  5    local environment error / 本地环境问题
  130  interrupted / 被中断`;
}

/** 解析结果：要么得到命令与选项，要么立刻产生一个退出码。 */
type ParseOutcome =
  | { kind: 'run'; command: CliCommand; rest: string[] }
  | { kind: 'exit'; code: ExitCode; text: string; toStderr: boolean };

/**
 * 解析 argv。**纯函数**：不做 IO、不退出进程，因此可被单测直接覆盖。
 *
 * 契约要点：
 *  - 无子命令时默认为 `detect`（P0-1 的"一条命令可用"）；
 *  - 未知 flag / 未知子命令 → 用法错误（退出码 2），**不静默忽略**；
 *    CI 里静默忽略一个拼错的 flag，比直接报错危险得多。
 */
export function parseArgv(
  argv: readonly string[],
  version: string,
): ParseOutcome {
  const args = [...argv];

  if (args.includes('-v') || args.includes('--version')) {
    return { kind: 'exit', code: EXIT.SUCCESS, text: version, toStderr: false };
  }
  if (args.includes('-h') || args.includes('--help')) {
    return {
      kind: 'exit',
      code: EXIT.SUCCESS,
      text: renderHelp(version),
      toStderr: false,
    };
  }

  const head = args[0];
  let command: CliCommand = 'detect';
  if (head !== undefined && !head.startsWith('-')) {
    if (!(COMMANDS as readonly string[]).includes(head)) {
      return {
        kind: 'exit',
        code: EXIT.USAGE,
        text: `Unknown command / 未知命令: ${head}`,
        toStderr: true,
      };
    }
    command = head as CliCommand;
    args.shift();
  }

  for (const arg of args) {
    if (arg.startsWith('-')) {
      return {
        kind: 'exit',
        code: EXIT.USAGE,
        text: `Not yet supported / 尚未支持: ${arg}`,
        toStderr: true,
      };
    }
  }

  return { kind: 'run', command, rest: args };
}

/**
 * 进程入口。返回退出码而非调用 `process.exit`，
 * 以便测试直接断言，也避免截断未 flush 的 stdout。
 */
export async function main(
  argv: readonly string[],
  version: string,
): Promise<ExitCode> {
  const outcome = parseArgv(argv, version);

  if (outcome.kind === 'exit') {
    const stream = outcome.toStderr ? process.stderr : process.stdout;
    stream.write(outcome.text + '\n');
    return outcome.code;
  }

  process.stderr.write(
    `m-trace: command '${outcome.command}' is defined by the frozen contract ` +
      `(docs/interface.md v1.0) but not yet implemented.\n` +
      `m-trace：子命令 '${outcome.command}' 已在冻结契约中定义，实现由阶段 3 交付。\n`,
  );
  return EXIT.LOCAL;
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectRun) {
  const { readFile } = await import('node:fs/promises');
  const pkgUrl = new URL('../../package.json', import.meta.url);
  const version = JSON.parse(await readFile(pkgUrl, 'utf8')).version as string;
  process.exitCode = await main(process.argv.slice(2), version);
}
