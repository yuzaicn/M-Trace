/**
 * 规范 JSON / Canonical JSON。
 *
 * 这是**复验契约的底层原语**，不是实现细节。库哈希与证据包哈希都建立在它上面，
 * 因此它必须有独立的对照测试（固定输入 → 固定期望输出）。
 *
 * 规则（与 `docs/interface.md` §8 一致，改任何一条都是契约 major 变更）：
 *  1. 对象键按**字典序**递归排序（`Array.prototype.sort` 默认的 UTF-16 序）；
 *  2. 数组保持原序；
 *  3. 数字用 `Number.prototype.toString` 的最短往返表示；
 *     `NaN` / `Infinity` 被拒绝（抛错），因为它们没有合法的 JSON 表示；
 *  4. 字符串按 JSON 规范转义，**非 ASCII 保留原字符**（不转成 `\uXXXX`）；
 *  5. 无多余空白，UTF-8，末尾无换行；
 *  6. `undefined` 在对象里被跳过，在数组里报错（数组空洞会让哈希依赖位置语义）。
 */

import type { CanonicalJson } from '../types/evidence.js';

/** 规范化失败。这是**编程错误**，不是业务结果，所以抛异常而不是返回 Result。 */
export class CanonicalJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonicalJsonError';
  }
}

function stringify(value: unknown, seen: Set<object>): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';

    case 'number': {
      if (!Number.isFinite(value)) {
        throw new CanonicalJsonError(
          `non-finite number ${String(value)} has no canonical JSON form`,
        );
      }
      // 归一化 -0：JSON 里 -0 与 0 无法区分，但哈希会区分，必须消掉。
      return Object.is(value, -0) ? '0' : value.toString();
    }

    case 'string':
      // 保留非 ASCII：可读性更好，且哈希在 UTF-8 下稳定。
      return JSON.stringify(value);

    case 'bigint':
      throw new CanonicalJsonError(
        'bigint is not representable in canonical JSON',
      );

    case 'undefined':
      throw new CanonicalJsonError(
        'undefined reached the canonicalizer as a value',
      );

    case 'function':
      throw new CanonicalJsonError('functions cannot be canonicalized');

    case 'object': {
      const obj = value as object;
      if (seen.has(obj)) {
        throw new CanonicalJsonError('circular reference detected');
      }
      seen.add(obj);
      try {
        if (Array.isArray(obj)) {
          const parts: string[] = [];
          for (let i = 0; i < obj.length; i += 1) {
            if (!(i in obj)) {
              throw new CanonicalJsonError(`array hole at index ${i}`);
            }
            parts.push(stringify(obj[i], seen));
          }
          return `[${parts.join(',')}]`;
        }

        // Date / Map / Set 等对象没有定义规范形式：拒绝，而不是静默取一个 toString。
        const proto = Object.getPrototypeOf(obj) as object | null;
        if (proto !== Object.prototype && proto !== null) {
          throw new CanonicalJsonError(
            `unsupported object of type ${obj.constructor?.name ?? 'unknown'}; ` +
              'canonical JSON only accepts plain objects',
          );
        }

        const record = obj as Record<string, unknown>;
        const keys = Object.keys(record).sort();
        const parts: string[] = [];
        for (const key of keys) {
          const child = record[key];
          if (child === undefined) continue; // 跳过可选字段，而不是写成 null
          parts.push(`${JSON.stringify(key)}:${stringify(child, seen)}`);
        }
        return `{${parts.join(',')}}`;
      } finally {
        seen.delete(obj);
      }
    }

    default:
      throw new CanonicalJsonError(`unsupported type: ${typeof value}`);
  }
}

/**
 * 纯函数：取值 → 规范 JSON 字符串。
 * 同一逻辑值必然得到同一字符串，与键的书写顺序无关。
 */
export const canonicalJson: CanonicalJson = (value: unknown): string =>
  stringify(value, new Set());
