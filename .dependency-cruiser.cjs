/**
 * 依賴方向規則（對應 doc/README.md「依賴方向規則」一節）。
 * 允許的依賴：
 *   cli     -> app, command, factory, view
 *   io      -> app(端口), factory, model
 *   app     -> command, model
 *   command -> model
 *   factory -> model
 *   view    -> model
 *   model   -> (無)
 *   main    -> 全部（Composition Root）
 * 圖中沒有的依賴一律禁止（同一模塊內部除外）。
 */

/** 用模塊名構造 src/<module>/ 路徑的正則 */
const mod = (...names) => `^src/(${names.join('|')})/`;
const all = ['model', 'factory', 'command', 'app', 'io', 'view', 'cli'];
/** 除 allowed 與自身外的所有模塊，用於「只允許依賴白名單」的規則 */
const except = (self, ...allowed) =>
  mod(...all.filter((m) => m !== self && !allowed.includes(m)));

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: '規則 8：全局不允許循環依賴',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'model-isolated',
      comment: '規則 1：model 不依賴任何模塊，也不引用 Node 內置模塊',
      severity: 'error',
      from: { path: mod('model') },
      to: { path: except('model'), },
    },
    {
      name: 'model-no-node-builtin',
      comment: '規則 1：model 不引用 Node 內置模塊（fs、readline 等）',
      severity: 'error',
      from: { path: mod('model') },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'command-only-model',
      comment: '規則 2：command 只依賴 model',
      severity: 'error',
      from: { path: mod('command') },
      to: { path: except('command', 'model') },
    },
    {
      name: 'app-no-outer',
      comment: '規則 3：app 只依賴 model 和 command，不得 import io（依賴倒置）',
      severity: 'error',
      from: { path: mod('app') },
      to: { path: except('app', 'model', 'command') },
    },
    {
      name: 'io-allowed-deps',
      comment: '規則 4：io 只依賴 app 端口、factory、model',
      severity: 'error',
      from: { path: mod('io') },
      to: { path: except('io', 'app', 'factory', 'model') },
    },
    {
      name: 'view-only-model',
      comment: '規則 5：view 只依賴 model',
      severity: 'error',
      from: { path: mod('view') },
      to: { path: except('view', 'model') },
    },
    {
      name: 'factory-only-model',
      comment: '圖形工廠只依賴 model',
      severity: 'error',
      from: { path: mod('factory') },
      to: { path: except('factory', 'model') },
    },
    {
      name: 'cli-allowed-deps',
      comment: '規則 6：cli 只依賴 app、command、factory、view；不得 import io，也不得直接碰 model',
      severity: 'error',
      from: { path: mod('cli') },
      to: { path: except('cli', 'app', 'command', 'factory', 'view') },
    },
    {
      name: 'only-main-is-root',
      comment: '規則 7：main.ts 是 Composition Root，任何模塊都不得依賴它',
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
