/**
 * 契约扫描器 / Contract scanner.
 *
 * 契约测试里有一类断言是"实现里不得出现 X"。这类断言最容易失败在**假阳性**上：
 * 源代码的注释里会写着"不要用 `require.resolve`"、"`auth.json` 只判存在"，
 * 一个朴素的字符串搜索会把说明文字当成违规，然后维护者只能把断言删掉 ——
 * 那等于保护没了。
 *
 * 所以扫描的对象必须是**真正的代码**：去掉注释、去掉字符串字面量的内容，
 * 只留下会被执行的语法结构。`codeOf()` 提供这个视图。
 *
 * 注意：去字符串内容是有意的 —— 契约文档的文本会出现在注释里，而
 * `require.resolve` 这类违规只可能以标识符/调用形式出现在代码中。
 */

export interface SourceView {
  /** 仓库相对路径，用于报错信息。 */
  rel: string;
  /** 原始文件内容。 */
  raw: string;
  /** 去掉注释与字符串字面量内容后的代码骨架。 */
  code: string;
}

/**
 * 去掉注释与字符串内容，保留其余字符（含换行），因此报错时行号仍可用。
 *
 * 这是一个**朴素**的词法处理：它只识别行注释、块注释、单双引号与反引号字符串。
 * 它不需要处理 TypeScript 的全部语法，只需要保证"注释与文档字符串里的词
 * 不会被当成代码"。
 */
export function stripCommentsAndStrings(source: string): string {
  let out = '';
  let i = 0;
  const n = source.length;

  while (i < n) {
    const ch = source[i]!;
    const next = source[i + 1];

    // 行注释
    if (ch === '/' && next === '/') {
      while (i < n && source[i] !== '\n') {
        out += ' ';
        i += 1;
      }
      continue;
    }

    // 块注释
    if (ch === '/' && next === '*') {
      out += '  ';
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < n) {
        out += '  ';
        i += 2;
      }
      continue;
    }

    // 字符串字面量（含模板串）。保留引号本身，丢掉内容。
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      out += quote;
      i += 1;
      while (i < n) {
        if (source[i] === '\\') {
          out += source[i] === '\n' ? '\n' : ' ';
          out += ' ';
          i += 2;
          continue;
        }
        if (source[i] === quote) {
          out += quote;
          i += 1;
          break;
        }
        out += source[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      continue;
    }

    // 正则字面量：只在明显的位置（= ( , : [ ! & | ? { } ; 换行之后）识别。
    if (ch === '/' && isRegexPosition(out)) {
      out += '/';
      i += 1;
      let inClass = false;
      while (i < n) {
        const c = source[i]!;
        if (c === '\\') {
          out += '  ';
          i += 2;
          continue;
        }
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) {
          out += '/';
          i += 1;
          break;
        } else if (c === '\n') {
          break;
        }
        out += c === '\n' ? '\n' : ' ';
        i += 1;
      }
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function isRegexPosition(prefix: string): boolean {
  const trimmed = prefix.replace(/\s+$/, '');
  if (trimmed.length === 0) return true;
  const last = trimmed[trimmed.length - 1]!;
  return (
    '=(,:;[!&|?{}>'.includes(last) ||
    /\breturn$/.test(trimmed) ||
    /\btypeof$/.test(trimmed)
  );
}

/** 构造一个源文件的扫描视图。 */
export function toView(rel: string, raw: string): SourceView {
  return { rel, raw, code: stripCommentsAndStrings(raw) };
}
