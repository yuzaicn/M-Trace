/**
 * M-Trace 契约类型的唯一公开入口 / The single public entry point for contract types.
 *
 * 契约版本：`docs/interface.md` v1.0-frozen（对应 `schemaVersion: 1`）。
 *
 * 本入口**只导出类型与契约常量**，不含任何业务逻辑。
 * 实现模块从各自的路径导出函数；它们都依赖这里定义的类型，
 * 反向依赖一律禁止（`src/types/` 不得 import 任何其他 `src/` 子目录）。
 */

export * from './common.js';
export * from './errors.js';
export * from './config.js';
export * from './probe.js';
export * from './normalize.js';
export * from './stats.js';
export * from './credibility.js';
export * from './fingerprint.js';
export * from './library.js';
export * from './attribute.js';
export * from './evidence.js';
export * from './report.js';
export * from './i18n.js';
export * from './cli.js';

/** 本契约的版本。与 `docs/interface.md` 的版本号保持一致。 */
export const INTERFACE_VERSION = '1.0' as const;

/** JSON Schema 的结构版本。与 `ReferenceLibrary.schemaVersion` 配对使用。 */
export const SCHEMA_VERSION = 1 as const;
