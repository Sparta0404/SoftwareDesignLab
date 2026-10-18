import { describe, expect, it } from 'vitest';
import { UnknownShapeTypeError } from '../../src/factory/error/UnknownShapeTypeError';
import type { ShapeCreator } from '../../src/factory/ShapeCreator';
import { ShapeFactory } from '../../src/factory/ShapeFactory';
import { GroupShape } from '../../src/model/shape/GroupShape';

/** 只用桩创建器测试注册表本身，不依赖任何内置图形。 */
function stubCreator(typeName: string): ShapeCreator {
  return {
    typeName,
    usage: `create ${typeName} <id>`,
    fromArgs: (id) => new GroupShape(id),
    fromSvg: (id) => new GroupShape(id),
  };
}

describe('ShapeFactory', () => {
  it('按类型名分派到已注册的创建器', () => {
    const factory = new ShapeFactory().register(stubCreator('box'));
    expect(factory.typeNames()).toEqual(['box']);
    expect(factory.usages()).toEqual(['create box <id>']);
    expect(factory.create('box', 'b1', []).id).toBe('b1');
    expect(factory.createFromSvg('box', 'b2', new Map(), '').id).toBe('b2');
  });

  it('未注册的类型报 unknown shape type', () => {
    const factory = new ShapeFactory();
    expect(() => factory.create('rect', 'r', [])).toThrow(UnknownShapeTypeError);
    expect(() => factory.createFromSvg('rect', 'r', new Map(), '')).toThrow(
      'unknown shape type: rect (is the plugin loaded?)',
    );
  });

  it('不允许重复注册同名类型', () => {
    const factory = new ShapeFactory().register(stubCreator('box'));
    expect(() => factory.register(stubCreator('box'))).toThrow('already registered');
  });
});
