/**
 * 依赖方向规则（对应 doc/README.md“依赖方向规则”一节）。
 * 允许的依赖：
 *   cli     -> app, command, factory, view
 *   io      -> app(端口), factory, model
 *   app     -> command, model
 *   command -> model
 *   factory -> model
 *   view    -> model
 *   model   -> (无)
 *   main    -> 全部（Composition Root）
 * 图中没有的依赖一律禁止（同一模块内部除外）。
 */

/** 用模块名构造 src/<module>/ 路径的正则 */
const mod = (...names) => `^src/(${names.join('|')})/`;
const all = ['model', 'factory', 'command', 'app', 'io', 'view', 'cli'];
/** 除 allowed 与自身外的所有模块，用于“只允许依赖白名单”的规则 */
const except = (self, ...allowed) =>
  mod(...all.filter((m) => m !== self && !allowed.includes(m)));

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: '规则 8：全局不允许循环依赖',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'model-isolated',
      comment: '规则 1：model 不依赖任何其他模块',
      severity: 'error',
      from: { path: mod('model') },
      to: { path: except('model') },
    },
    {
      name: 'model-no-node-builtin',
      comment: '规则 1：model 不引用 Node 内置模块（fs、readline 等）',
      severity: 'error',
      from: { path: mod('model') },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'command-only-model',
      comment: '规则 2：command 只依赖 model',
      severity: 'error',
      from: { path: mod('command') },
      to: { path: except('command', 'model') },
    },
    {
      name: 'app-no-outer',
      comment: '规则 3：app 只依赖 model 和 command，不得 import io（依赖倒置）',
      severity: 'error',
      from: { path: mod('app') },
      to: { path: except('app', 'model', 'command') },
    },
    {
      name: 'io-allowed-deps',
      comment: '规则 4：io 只依赖 app 端口、factory、model',
      severity: 'error',
      from: { path: mod('io') },
      to: { path: except('io', 'app', 'factory', 'model') },
    },
    {
      name: 'view-only-model',
      comment: '规则 5：view 只依赖 model',
      severity: 'error',
      from: { path: mod('view') },
      to: { path: except('view', 'model') },
    },
    {
      name: 'factory-only-model',
      comment: '图形工厂只依赖 model',
      severity: 'error',
      from: { path: mod('factory') },
      to: { path: except('factory', 'model') },
    },
    {
      name: 'cli-allowed-deps',
      comment: '规则 6：cli 只依赖 app、command、factory、view；不得 import io，也不得直接碰 model',
      severity: 'error',
      from: { path: mod('cli') },
      to: { path: except('cli', 'app', 'command', 'factory', 'view') },
    },
    {
      name: 'only-main-is-root',
      comment: '规则 7：main.ts 是 Composition Root，任何模块都不得依赖它',
      severity: 'error',
      from: { path: '^src/(?!main\\.ts)' },
      to: { path: '^src/main\\.ts$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: '\\.d\\.ts$' },
  },
};
