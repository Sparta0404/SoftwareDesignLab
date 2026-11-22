const { configDefaults, defineConfig } = require('vitest/config');

/** CLI 测试与 vscode-extension 测试分开跑，根目录不收录扩展目录。 */
module.exports = defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'vscode-extension/**'],
  },
});
