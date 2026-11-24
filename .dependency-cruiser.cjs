/**
 * 依赖方向规则（对应 doc/README.md“依赖方向规则”一节）。
 * 允许的依赖：
 *   cli     -> app, command, factory, view
 *   io      -> app(端口), factory, model
 *   app     -> command, model
 *   command -> model
 *   shapes  -> factory, model（内置图形，只有 builtin 与 main 可以引用）
 *   plugin  -> app, cli, command, factory, view, model（插件宿主；cli/内核都不依赖它）
 *   api     -> plugin, app, cli, command, factory, view, model（插件唯一允许依赖的公开门面）
 *   builtin -> plugin, api, shapes, cli, command, factory, view, model（内置能力包装成插件）
 *   loader  -> plugin, api, model（只做字符串到模块，不认识任何具体插件）
 *   factory -> model
 *   view    -> model
 *   model   -> (无)
 *   main    -> 全部（Composition Root）
 * 图中没有的依赖一律禁止（同一模块内部除外）。
 * model 内部：error <- shape <- document（箭头指向被依赖方）。
 */

/** 用模块名构造 src/<module>/ 路径的正则 */
const mod = (...names) => `^src/(${names.join('|')})/`;
const all = [
  'model', 'factory', 'shapes', 'command', 'app', 'io', 'view', 'cli',
  'plugin', 'api', 'builtin', 'loader',
];
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
      name: 'model-error-is-leaf',
      comment: 'model 内部：error 不依赖 model 的其他子模块',
      severity: 'error',
      from: { path: '^src/model/error/' },
      to: { path: '^src/model/(shape|document)/' },
    },
    {
      name: 'model-shape-no-document',
      comment: 'model 内部：shape 不依赖 document（文档持有图形树，反之不行）',
      severity: 'error',
      from: { path: '^src/model/shape/' },
      to: { path: '^src/model/document/' },
    },
    {
      name: 'shapes-allowed-deps',
      comment: '内置图形只依赖 factory 与 model',
      severity: 'error',
      from: { path: mod('shapes') },
      to: { path: except('shapes', 'factory', 'model') },
    },
    {
      name: 'shapes-isolated-from-each-other',
      comment: '每种内置图形是独立子模块，彼此不得互相引用',
      severity: 'error',
      from: { path: '^src/shapes/([^/]+)/' },
      to: { path: '^src/shapes/([^/]+)/', pathNot: '^src/shapes/$1/' },
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
      name: 'plugin-allowed-deps',
      comment: '插件宿主只依赖内核扩展点所在模块，不依赖 io、shapes、builtin、loader、api',
      severity: 'error',
      from: { path: mod('plugin') },
      to: { path: except('plugin', 'app', 'cli', 'command', 'factory', 'view', 'model') },
    },
    {
      name: 'api-allowed-deps',
      comment: '门面只再导出内核的扩展点接口与公开领域抽象',
      severity: 'error',
      from: { path: mod('api') },
      to: { path: except('api', 'plugin', 'app', 'cli', 'command', 'factory', 'view', 'model') },
    },
    {
      name: 'builtin-allowed-deps',
      comment: '内置插件包装只依赖宿主、门面、内置图形与命令处理器；不碰 io、loader',
      severity: 'error',
      from: { path: mod('builtin') },
      to: {
        path: except('builtin', 'plugin', 'api', 'shapes', 'cli', 'command', 'factory', 'view', 'model'),
      },
    },
    {
      name: 'loader-allowed-deps',
      comment: '加载器只依赖宿主与门面，不含任何具体插件、图形或命令',
      severity: 'error',
      from: { path: mod('loader') },
      to: { path: except('loader', 'plugin', 'api', 'model') },
    },
    {
      name: 'only-main-uses-assembly',
      comment: '装配侧（builtin、loader）只有组合根 main.ts 可以引用，内核不认识它们',
      severity: 'error',
      from: { path: '^src/', pathNot: ['^src/main\\.ts$', '^src/(builtin|loader)/'] },
      to: { path: mod('builtin', 'loader') },
    },
    {
      name: 'plugins-only-api',
      comment: '插件包（plugins/*）只能 import src/api 与自身；插件之间互不引用',
      severity: 'error',
      from: { path: '^plugins/([^/]+)/' },
      to: { path: '^(src|plugins)/', pathNot: ['^src/api/', '^plugins/$1/'] },
    },
    {
      name: 'src-no-plugins',
      comment: '内核与装配代码不得 import plugins/*（插件只经由配置或 main 的装配表接入）',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/main\\.ts$' },
      to: { path: '^plugins/' },
    },
    {
      name: 'only-main-uses-shapes',
      comment: '规则 7：具体图形类型只在装配侧（main、builtin）注册，内核不认识它们',
      severity: 'error',
      from: { path: '^src/', pathNot: ['^src/main\\.ts$', '^src/shapes/', '^src/builtin/'] },
      to: { path: mod('shapes') },
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
