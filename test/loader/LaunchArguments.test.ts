import { describe, expect, it } from 'vitest';
import { InvalidLaunchArgumentsError, parseLaunchArguments } from '../../src/loader';

describe('parseLaunchArguments', () => {
  it('没有参数 → 代码装配', () => {
    expect(parseLaunchArguments([])).toEqual({ kind: 'code' });
  });

  it('--config <file> 与 --config=<file>', () => {
    expect(parseLaunchArguments(['--config', 'plugins.config.json'])).toEqual({
      kind: 'config',
      configPath: 'plugins.config.json',
    });
    expect(parseLaunchArguments(['--config=a/b.json'])).toEqual({
      kind: 'config',
      configPath: 'a/b.json',
    });
  });

  it('--no-plugins → 只留内置能力', () => {
    expect(parseLaunchArguments(['--no-plugins'])).toEqual({ kind: 'none' });
  });

  it.each([
    [['--config'], /--config requires a file path/],
    [['--config', '--no-plugins'], /--config requires a file path/],
    [['--config='], /unknown argument/],
    [['--config', 'a.json', '--config', 'b.json'], /more than once/],
    [['--config', 'a.json', '--no-plugins'], /cannot be combined/],
    [['--bogus'], /unknown argument: --bogus/],
    [['stray'], /unknown argument: stray/],
  ])('非法参数 %j', (argv, message) => {
    expect(() => parseLaunchArguments(argv)).toThrow(InvalidLaunchArgumentsError);
    expect(() => parseLaunchArguments(argv)).toThrow(message);
  });
});
