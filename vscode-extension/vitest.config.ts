const { configDefaults, defineConfig } = require('vitest/config');

/** 扩展的纯逻辑测试。宿主冒烟测试由 mocha 单独跑，根目录 vitest 不收录本目录。 */
module.exports = defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'test/integration/**'],
    environment: 'node',
  },
});
