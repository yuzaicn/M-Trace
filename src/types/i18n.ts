/**
 * i18n / 文案目录。
 *
 * 与分发渠道解耦的落点之一：目录**不**通过 `require.resolve` 或包名解析定位，
 * 而是由调用方（CLI 入口）用相对 `import.meta.url` 的路径加载后注入。
 * 这样单文件打包、GitHub Releases tarball、`node_modules` 三种场景行为一致。
 */

/** 键 → 模板。占位符语法为 `{name}`，转义用 `{{` / `}}`。 */
export type MessageTemplate = string;

export interface MessageCatalog {
  locale: import('./common.js').Locale;
  /** 目录版本，进报告的方法区块（结论要能被复验，文案版本也是输入之一）。 */
  catalogVersion: string;
  messages: Record<string, MessageTemplate>;
}

/**
 * 格式化选项。**所有**数字与日期格式化必须经过这里，
 * 以防不同机器上的 `Intl` 默认值差异渗进报告产物（那会破坏可复验性）。
 */
export interface FormatOptions {
  /** 小数位。默认按调用点指定，不按 locale 推断。 */
  digits?: number;
  /** 是否按百分比渲染。 */
  percent?: boolean;
  /** 是否使用千分位。默认 false —— 统计数值不加千分位更易比对。 */
  grouping?: boolean;
}

/**
 * 翻译：查表 + 占位符替换。
 *
 * 契约要求：
 *  - 缺键**不抛异常**，返回一个显式的 `⟦missing:<key>⟧` 标记，
 *    以便快照测试抓住漏翻；
 *  - 找不到 locale 时回落到 `en`，并在 `ReportViewModel.limitations` 记账。
 */
export type Translate = (
  key: string,
  params?: Record<string, string | number>,
  locale?: import('./common.js').Locale,
) => string;

/** 确定性数字格式化。同一输入 + 同一 locale + 同一选项 → 同一字符串。 */
export type FormatNumber = (
  value: number,
  locale: import('./common.js').Locale,
  opts?: FormatOptions,
) => string;

/** 确定性日期格式化。输入为 ISO 8601 字符串，输出不含时区歧义。 */
export type FormatDateTime = (
  iso: string,
  locale: import('./common.js').Locale,
) => string;

/**
 * 目录加载。实现按**相对入口文件**的路径读取：
 * `<entryDir>/../data/i18n/<locale>.json`，**不**用包解析。
 */
export type LoadCatalog = (
  locale: import('./common.js').Locale,
) => Promise<MessageCatalog>;
