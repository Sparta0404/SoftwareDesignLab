#!/usr/bin/env node
/**
 * 从 git 历史 + TypeScript 编译器 API 生成 docs/metrics/。
 * 对比 tag `final` 与 `p2`（若尚无 p2 则用 HEAD），统计 CLI 范围的行数与圈复杂度。
 * 数字全部由本脚本写出，不接受手填。
 *
 * 用法：node scripts/metrics.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'docs', 'metrics');

const CATEGORY_LABEL = {
  kernel: '内核',
  assembly: '装配处',
  plugin: '插件',
  vscode: 'VSCode 扩展',
};

const MODULE_ROLE = {
  'src/model': '领域模型：图形树、文档、错误',
  'src/factory': '图形工厂与 ShapeProvider 扩展点',
  'src/shapes': '六种内置图形实现（由 builtin 包装注册）',
  'src/command': '编辑命令、属性处理器扩展点、历史栈',
  'src/app': 'EditorSession 与 IO 端口',
  'src/io': 'SVG 解析/序列化与文件存储',
  'src/view': 'tree/show 渲染与 TreeDecorator 扩展点',
  'src/cli': 'REPL、命令分派与 Command 扩展点',
  'src/plugin': 'PluginHost：暂存注册、清单校验、原子提交',
  'src/api': '插件唯一公开门面（再导出扩展点与领域抽象）',
  'src/builtin': '把内置图形与 Phase 1 命令包装成插件',
  'src/loader': '配置装配：读 plugins.config.json、按字符串解析模块',
  'src/main.ts': 'Composition Root：代码装配 / 配置装配入口',
  plugins: '外部插件包（stats / dir / box / tree-star 等）',
  'vscode-extension': 'Lab2 第一部分：SVG 标记与大纲（不计入 CLI 增量）',
};

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trimEnd();
}

function refExists(ref) {
  try {
    git(['rev-parse', '--verify', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function resolveHeadRef() {
  if (refExists('p2')) return 'p2';
  return 'HEAD';
}

function listTsFiles(ref) {
  const out = git(['ls-tree', '-r', '--name-only', ref]);
  if (!out) return [];
  return out
    .split(/\r?\n/)
    .filter((p) => p.endsWith('.ts'))
    .filter((p) => !p.endsWith('.d.ts'))
    .filter((p) => !p.includes('/node_modules/'))
    .filter((p) => !p.startsWith('dist/') && !p.includes('/dist/'))
    .filter((p) => !p.startsWith('test/'))
    .filter(
      (p) =>
        p.startsWith('src/') ||
        p.startsWith('plugins/') ||
        p.startsWith('vscode-extension/src/'),
    );
}

function showFile(ref, filePath) {
  try {
    return git(['show', `${ref}:${filePath}`]);
  } catch {
    return null;
  }
}

/** @returns {'kernel'|'assembly'|'plugin'|'vscode'|null} */
function categorize(filePath) {
  if (filePath.startsWith('vscode-extension/')) return 'vscode';
  if (filePath.startsWith('plugins/')) return 'plugin';
  if (
    filePath === 'src/main.ts' ||
    filePath.startsWith('src/builtin/') ||
    filePath.startsWith('src/loader/')
  ) {
    return 'assembly';
  }
  if (filePath.startsWith('src/')) return 'kernel';
  return null;
}

function roleFor(filePath) {
  if (filePath.startsWith('plugins/')) {
    const pkg = filePath.split('/')[1];
    return `${MODULE_ROLE.plugins}：${pkg}`;
  }
  if (filePath.startsWith('vscode-extension/')) {
    return MODULE_ROLE['vscode-extension'];
  }
  if (filePath === 'src/main.ts') return MODULE_ROLE['src/main.ts'];
  const parts = filePath.split('/');
  if (parts.length >= 2) {
    const key = `${parts[0]}/${parts[1]}`;
    if (MODULE_ROLE[key]) return MODULE_ROLE[key];
  }
  return '（未分类模块）';
}

function countLines(source) {
  if (source.length === 0) return { total: 0, nonBlank: 0 };
  const lines = source.split(/\r?\n/);
  // 末尾空行不计入 total（与常见 wc -l 对无换行结尾文件的差异对齐：按物理行）
  const total = lines.length;
  const nonBlank = lines.filter((l) => l.trim().length > 0).length;
  return { total, nonBlank };
}

/**
 * McCabe 圈复杂度：每个函数/方法/访问器/箭头函数从 1 起，
 * 遇分支与短路逻辑 +1。文件级 = 各函数之和。
 */
function analyzeComplexity(source, fileName) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  let fileTotal = 0;
  let functionCount = 0;
  let maxFn = 0;

  function decisionPoints(node) {
    let n = 0;
    const visit = (child) => {
      switch (child.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.CatchClause:
        case ts.SyntaxKind.ConditionalExpression:
          n += 1;
          break;
        case ts.SyntaxKind.BinaryExpression: {
          const op = child.operatorToken.kind;
          if (
            op === ts.SyntaxKind.AmpersandAmpersandToken ||
            op === ts.SyntaxKind.BarBarToken ||
            op === ts.SyntaxKind.QuestionQuestionToken
          ) {
            n += 1;
          }
          break;
        }
        default:
          break;
      }
      ts.forEachChild(child, visit);
    };
    ts.forEachChild(node, visit);
    return n;
  }

  function isFunctionLike(node) {
    return (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessor(node) ||
      ts.isSetAccessor(node) ||
      ts.isConstructorDeclaration(node)
    );
  }

  function visit(node) {
    if (isFunctionLike(node) && node.body) {
      const cc = 1 + decisionPoints(node.body);
      fileTotal += cc;
      functionCount += 1;
      if (cc > maxFn) maxFn = cc;
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return { total: fileTotal, functions: functionCount, max: maxFn };
}

function emptyBucket() {
  return {
    files: 0,
    linesTotal: 0,
    linesNonBlank: 0,
    complexity: 0,
    functions: 0,
  };
}

function accumulate(bucket, metrics) {
  bucket.files += 1;
  bucket.linesTotal += metrics.lines.total;
  bucket.linesNonBlank += metrics.lines.nonBlank;
  bucket.complexity += metrics.complexity.total;
  bucket.functions += metrics.complexity.functions;
}

function analyzeRef(ref) {
  const files = listTsFiles(ref);
  /** @type {Record<string, ReturnType<typeof emptyBucket>>} */
  const byCategory = {
    kernel: emptyBucket(),
    assembly: emptyBucket(),
    plugin: emptyBucket(),
    vscode: emptyBucket(),
  };
  /** @type {Map<string, object>} */
  const inventory = new Map();

  for (const filePath of files) {
    const category = categorize(filePath);
    if (!category) continue;
    const source = showFile(ref, filePath);
    if (source === null) continue;
    const lines = countLines(source);
    const complexity = analyzeComplexity(source, filePath);
    const entry = {
      path: filePath,
      category,
      role: roleFor(filePath),
      lines,
      complexity,
    };
    inventory.set(filePath, entry);
    accumulate(byCategory[category], entry);
  }

  return { ref, commit: git(['rev-parse', '--short', ref]), files: inventory, byCategory };
}

function delta(a, b) {
  return {
    files: b.files - a.files,
    linesTotal: b.linesTotal - a.linesTotal,
    linesNonBlank: b.linesNonBlank - a.linesNonBlank,
    complexity: b.complexity - a.complexity,
    functions: b.functions - a.functions,
  };
}

function fmtDelta(n) {
  if (n > 0) return `+${n}`;
  return String(n);
}

function mdTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}`;
}

function writeOutputs(base, head) {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const categories = ['kernel', 'assembly', 'plugin'];
  const cliDelta = {
    files: 0,
    linesTotal: 0,
    linesNonBlank: 0,
    complexity: 0,
    functions: 0,
  };
  for (const cat of categories) {
    const d = delta(base.byCategory[cat], head.byCategory[cat]);
    for (const k of Object.keys(cliDelta)) cliDelta[k] += d[k];
  }

  const summaryRows = categories.map((cat) => {
    const b = base.byCategory[cat];
    const h = head.byCategory[cat];
    const d = delta(b, h);
    return [
      CATEGORY_LABEL[cat],
      String(b.files),
      String(h.files),
      fmtDelta(d.files),
      String(b.linesNonBlank),
      String(h.linesNonBlank),
      fmtDelta(d.linesNonBlank),
      String(b.complexity),
      String(h.complexity),
      fmtDelta(d.complexity),
    ];
  });

  const vscodeB = base.byCategory.vscode;
  const vscodeH = head.byCategory.vscode;
  const vscodeD = delta(vscodeB, vscodeH);

  const allPaths = new Set([...base.files.keys(), ...head.files.keys()]);
  const inventoryRows = [...allPaths]
    .filter((p) => {
      const cat = categorize(p);
      return cat && cat !== 'vscode';
    })
    .sort()
    .map((p) => {
      const b = base.files.get(p);
      const h = head.files.get(p);
      const cat = (h ?? b).category;
      const role = (h ?? b).role;
      const bLines = b ? b.lines.nonBlank : 0;
      const hLines = h ? h.lines.nonBlank : 0;
      const bCc = b ? b.complexity.total : 0;
      const hCc = h ? h.complexity.total : 0;
      return [
        p,
        CATEGORY_LABEL[cat],
        role,
        String(bLines),
        String(hLines),
        fmtDelta(hLines - bLines),
        String(bCc),
        String(hCc),
        fmtDelta(hCc - bCc),
      ];
    });

  const generatedAt = new Date().toISOString();
  const headNote =
    head.ref === 'p2'
      ? '对比终点为 tag `p2`。'
      : '仓库尚无 tag `p2`，对比终点暂用 `HEAD`；打上 `p2` 后请重新运行本脚本。';

  const readme = `# CLI 重构度量（自动生成）

> 由 \`scripts/metrics.mjs\` 从 git 历史生成，**请勿手改数字**。重新生成：\`npm run metrics\`。
>
> 基线：\`${base.ref}\` (\`${base.commit}\`) → 对比：\`${head.ref}\` (\`${head.commit}\`)
> 生成时间：${generatedAt}
>
> ${headNote}
>
> 范围：\`src/**/*.ts\`、\`plugins/**/*.ts\`（排除 \`test/\`、\`node_modules/\`、\`dist/\`）。
> VSCode 扩展单独列出，**不计入** CLI 重构增量。

## 分类说明

| 类别 | 路径 |
| --- | --- |
| 内核 | \`src/\` 下除 \`main.ts\`、\`builtin/\`、\`loader/\` 以外的模块（含 \`plugin/\`、\`api/\`、\`shapes/\`） |
| 装配处 | \`src/main.ts\`、\`src/builtin/\`、\`src/loader/\` |
| 插件 | \`plugins/*\` 外部插件包 |
| VSCode 扩展 | \`vscode-extension/src/\`（单独统计） |

## 行数与圈复杂度（CLI）

行数取**非空行**；圈复杂度为文件内各函数 McCabe 复杂度之和（TypeScript 编译器 API 遍历 AST：\`if/for/while/case/catch/?: /&&/||/??\` 各 +1，函数基底为 1）。

${mdTable(
    [
      '类别',
      `${base.ref} 文件`,
      `${head.ref} 文件`,
      'Δ 文件',
      `${base.ref} 非空行`,
      `${head.ref} 非空行`,
      'Δ 非空行',
      `${base.ref} 复杂度`,
      `${head.ref} 复杂度`,
      'Δ 复杂度',
    ],
    summaryRows,
  )}

### CLI 合计增量（内核 + 装配处 + 插件）

| 指标 | 增量 |
| --- | --- |
| 文件数 | ${fmtDelta(cliDelta.files)} |
| 非空行 | ${fmtDelta(cliDelta.linesNonBlank)} |
| 物理行 | ${fmtDelta(cliDelta.linesTotal)} |
| 圈复杂度 | ${fmtDelta(cliDelta.complexity)} |
| 函数数 | ${fmtDelta(cliDelta.functions)} |

## VSCode 扩展（不计入 CLI 增量）

| 指标 | ${base.ref} | ${head.ref} | Δ |
| --- | ---: | ---: | ---: |
| 文件 | ${vscodeB.files} | ${vscodeH.files} | ${fmtDelta(vscodeD.files)} |
| 非空行 | ${vscodeB.linesNonBlank} | ${vscodeH.linesNonBlank} | ${fmtDelta(vscodeD.linesNonBlank)} |
| 圈复杂度 | ${vscodeB.complexity} | ${vscodeH.complexity} | ${fmtDelta(vscodeD.complexity)} |

## 文件清单与职责

详见 [inventory.md](./inventory.md)。原始数据见 [raw.json](./raw.json)。
`;

  const inventoryMd = `# 文件清单与职责（自动生成）

> 由 \`scripts/metrics.mjs\` 生成。基线 \`${base.ref}\` → \`${head.ref}\`。

${mdTable(
    [
      '路径',
      '类别',
      '职责',
      `${base.ref} 非空行`,
      `${head.ref} 非空行`,
      'Δ 行',
      `${base.ref} CC`,
      `${head.ref} CC`,
      'Δ CC',
    ],
    inventoryRows,
  )}
`;

  const raw = {
    generatedAt,
    base: { ref: base.ref, commit: base.commit, byCategory: base.byCategory },
    head: { ref: head.ref, commit: head.commit, byCategory: head.byCategory },
    cliDelta,
    vscodeDelta: vscodeD,
    files: [...allPaths].sort().map((p) => {
      const b = base.files.get(p);
      const h = head.files.get(p);
      return {
        path: p,
        category: (h ?? b)?.category ?? null,
        role: (h ?? b)?.role ?? null,
        base: b
          ? { lines: b.lines, complexity: b.complexity }
          : null,
        head: h
          ? { lines: h.lines, complexity: h.complexity }
          : null,
      };
    }),
  };

  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), readme, 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'inventory.md'), inventoryMd, 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'raw.json'), `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

  console.log(`Wrote metrics to ${path.relative(ROOT, OUT_DIR).replace(/\\/g, '/')}/`);
  console.log(`  base=${base.ref} (${base.commit})  head=${head.ref} (${head.commit})`);
  console.log(
    `  CLI Δ lines=${fmtDelta(cliDelta.linesNonBlank)}  complexity=${fmtDelta(cliDelta.complexity)}`,
  );
}

function main() {
  if (!refExists('final')) {
    console.error('error: git tag `final` not found; cannot compare.');
    process.exitCode = 1;
    return;
  }
  const headRef = resolveHeadRef();
  const base = analyzeRef('final');
  const head = analyzeRef(headRef);
  writeOutputs(base, head);
}

main();
