import { describe, expect, it } from 'vitest';
import { UnknownShapeTypeError } from '../../src/factory/error/UnknownShapeTypeError';
import type { ShapeBuilder, ShapeProvider } from '../../src/factory/ShapeProvider';
import { ShapeFactory } from '../../src/factory/ShapeFactory';
import { ContractViolationError } from '../../src/model/error/ContractViolationError';
import { GroupShape } from '../../src/model/shape/GroupShape';
import type { Shape } from '../../src/model/shape/Shape';
import { BuiltinShapes } from '../../src/shapes/BuiltinShapes';
import { FakeBoxProvider } from '../support/FakeBox';

/** 只用桩提供者测试注册表本身，不依赖任何内置图形。 */
function stubProvider(typeName: string, overrides: Partial<ShapeProvider> = {}): ShapeProvider {
  return {
    typeName,
    usage: `create ${typeName} <id>`,
    fromArgs: (id) => new GroupShape(id),
    matches: (tag) => tag === typeName,
    fromSvgTree: (id) => new GroupShape(id),
    ...overrides,
  };
}

describe('ShapeFactory', () => {
  it('按类型名分派到已注册的提供者', () => {
    const factory = new ShapeFactory().register(stubProvider('g'));
    expect(factory.typeNames()).toEqual(['g']);
    expect(factory.usages()).toEqual(['create g <id>']);
    expect(factory.create('g', 'b1', []).id).toBe('b1');
    expect(factory.createFromSvg('g', 'b2', new Map(), '').id).toBe('b2');
  });

  it('未注册的类型报 unknown shape type', () => {
    const factory = new ShapeFactory();
    expect(() => factory.create('rect', 'r', [])).toThrow(UnknownShapeTypeError);
    expect(() => factory.createFromSvg('rect', 'r', new Map(), '')).toThrow(
      'unknown shape type: rect (is the plugin loaded?)',
    );
  });

  it('不允许重复注册同名类型', () => {
    const factory = new ShapeFactory().register(stubProvider('box'));
    expect(() => factory.register(stubProvider('box'))).toThrow('already registered');
  });

  it('向提供者暴露 builder，插件可创建内部部件而不 import 内置图形', () => {
    let received: ShapeBuilder | undefined;
    const factory = new ShapeFactory().register(
      stubProvider('box', {
        fromArgs: (id, _args, builder) => {
          received = builder;
          return new GroupShape(id);
        },
      }),
    );
    factory.create('box', 'b1', []);
    expect(received).toBe(factory);
  });

  describe('SVG 匹配', () => {
    it('matches 决定由谁接管；子树作为已构造好的 children 传入', () => {
      let seen: readonly Shape[] = [];
      const factory = new ShapeFactory().register(
        stubProvider('box', {
          matches: (tag, attrs) => tag === 'g' && attrs.get('data-kind') === 'box',
          fromSvgTree: (id, _attrs, _text, children) => {
            seen = children;
            return new GroupShape(id);
          },
        }),
      );
      const child = new GroupShape('c');
      factory.createFromSvgTree('g', 'b', new Map([['data-kind', 'box']]), '', [child]);
      expect(seen).toEqual([child]);
      expect(() => factory.createFromSvgTree('g', 'x', new Map(), '', [])).toThrow(
        UnknownShapeTypeError,
      );
    });

    it('多个提供者同时匹配时，后注册者（更具体的插件）优先；没装插件时回落内置 g', () => {
      const attrs = new Map([['data-kind', 'box']]);
      const without = BuiltinShapes.createFactory();
      const degraded = without.createFromSvg('g', 'n1', attrs, '');
      expect(degraded.isComposite()).toBe(false);
      expect(degraded.attributes()).toEqual([
        ['id', 'n1'],
        ['data-kind', 'box'],
      ]);

      const withBox = BuiltinShapes.createFactory().register(new FakeBoxProvider());
      const parts = [
        withBox.create('rect', 'n1-rect', ['0', '0', '1', '1']),
        withBox.create('text', 'n1-label', ['0', '0', 'T']),
      ];
      expect(withBox.createFromSvgTree('g', 'n1', attrs, '', parts).displayLabel).toBe('box#n1');
    });
  });

  describe('契约检查', () => {
    it('提供者返回的 id 与请求不符时报契约违反，create 与 SVG 路径一致', () => {
      const factory = new ShapeFactory().register(
        stubProvider('g', { fromArgs: () => new GroupShape('other'), fromSvgTree: () => new GroupShape('other') }),
      );
      expect(() => factory.create('g', 'n1', [])).toThrow(ContractViolationError);
      expect(() => factory.create('g', 'n1', [])).toThrow(
        'contract violation: shape provider g returned id other, expected n1',
      );
      expect(() => factory.createFromSvg('g', 'n1', new Map(), '')).toThrow(
        'contract violation: shape provider g returned id other, expected n1',
      );
    });

    it('SVG 路径上返回的标签与被匹配的标签不符时报契约违反', () => {
      const factory = new ShapeFactory().register(
        stubProvider('circle', {
          matches: () => true,
          fromSvgTree: (id) => new GroupShape(id),
        }),
      );
      expect(() => factory.createFromSvg('circle', 'c1', new Map(), '')).toThrow(
        'contract violation: shape provider circle returned <g> for <circle>',
      );
    });
  });
});
