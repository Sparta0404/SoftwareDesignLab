import * as path from 'node:path';
import Mocha from 'mocha';

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'bdd', color: true, timeout: 20_000 });
  mocha.addFile(path.resolve(__dirname, 'extension.test.js'));

  return new Promise((resolve, reject) => {
    try {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} 个冒烟测试失败`));
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}
