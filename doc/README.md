# Lab1 Phase 1：SVG 编辑器（CLI）

## 架构方案

### 1. 模块划分

```text
src/
  model/        领域模型：图形树 + 文档（不依赖其他任何模块）
  factory/      图形工厂：类型名 -> 图形类（第 2 处按名字分派）
  command/      编辑命令 + 撤销历史（Command 模式）
  app/          编辑会话外观 + 端口接口（Facade，依赖倒置）
  io/           SVG 解析/序列化 + 文件读写（实现 app 的端口）
  view/         tree/show 文本渲染（基于图形自描述）
  cli/          REPL、分词、命令名分派（第 1 处按名字分派）
  main.ts       组装入口（Composition Root）
```

#### 各模块职责

- **model**
  - `Shape`（抽象类，Composite 中的 Component），提供：
    - 身份与结构：`id`、`parent`、`children()`（叶子返回空列表，使容器与叶子可被统一遍历）。
    - 统一操作：`move(dx,dy)`、`scale(f)`、`setAttr/getAttr`、`attrNames()`（`set` 命令的白名单）。
    - **自描述（供序列化）**：`tagName`（SVG 标签名）、`attributes()`（按序输出的 SVG 属性键值对）、`textContent()`（`<text>` 的文本内容，其余类型返回 `undefined`）。
    - **自描述（供显示）**：`summary()`（`tree` 一行中 `tag#id` 之后的属性摘要，如 `x=0 y=0 w=800 h=600 fill=#ffffff`；`g` 返回空串，`box` 插件返回 `(box)`）、`detailLines()`（`show` 输出的属性明细行）。
  - 叶子图形：`RectShape`、`CircleShape`、`EllipseShape`、`LineShape`、`TextShape`。
  - `GroupShape`（Composite）：管理子节点的插入、摘出和 z-order；`move/scale` 递归作用到子节点。
  - `SvgDocument`：包含画布尺寸、根节点和 `IdIndex`，负责 id 唯一性和按 id 查找。
  - `EditorError` 系列错误类（`NoSuchShapeError`、`IdExistsError` 等，只带消息，不带 `error:` 前缀）。
  - 约束：不出现 `console`、`fs`、`readline`，也不出现 `switch(tag)`。
- **factory**
  - `ShapeCreator` 接口：`typeName`、`fromArgs(id, args)`（给 CLI 的 `create` 用）、`fromSvg(id, attrs)`（给读入 SVG 用）。
  - `ShapeFactory`：用 `Map<string, ShapeCreator>` 注册和查找，查不到时抛出 `unknown shape type`。
  - 第 2 处按名字分派，**待重构**；是后续 `ShapeProvider` 插件的插槽雏形。
- **command**
  - `EditCommand` 接口：`execute(): string`（返回成功摘要）、`undo(): string`、`redo(): string`。
  - 具体命令：`CreateCommand`、`DeleteCommand`、`MoveCommand`、`ScaleCommand`、`SetAttrCommand`、`GroupCommand`、`UngroupCommand`、`AddToCommand`、`ZOrderCommand`。
  - 所有校验在修改状态之前完成，保证“失败不改变状态”；`group` 等涉及多个图形的命令整体作为一个 undo 单元。
  - `CommandHistory`：管理 undo/redo 两个栈，执行新命令时清空 redo 栈，提供 `lockByIo()` 和 `unlock()`。
- **app**
  - `EditorSession`（Facade）：持有当前文档、`CommandHistory` 和当前文件路径；提供 `init/read/save/canvas` 四个文档类操作，`execute(cmd)`、`undo()`、`redo()`，以及“无文档”检查。
  - 端口接口：`DocumentReader`、`DocumentWriter`（输入输出为 `SvgDocument` 和路径）、`WarningSink`（接收“自动补 id”警告）。
- **io**
  - `SvgParser`：把 XML 解析成 model，通过 `ShapeFactory.fromSvg` 构建图形，缺 id 时补成 `标签名+序号` 并发出警告。
  - `SvgSerializer`：**通用序列化器**，只依赖 `Shape` 的自描述接口（`tagName`、`attributes()`、`textContent()`、`children()`）递归输出 SVG，不认识任何具体图形类。
  - `FileDocumentStore`：实现 app 中的端口，用 `fs` 读写文件，并转换 `cannot read/write file` 错误。
- **view**
  - `TreeRenderer`：递归遍历 `children()`，负责树形连接符（`├──`、`└──`）、缩进和列对齐，每行内容取自 `tagName`、`id` 和 `summary()`。
  - `ShowRenderer`：输出 `tag#id  parent=…` 头行，之后逐行输出 `detailLines()`。
  - 两者都只使用 `Shape` 的自描述接口，不认识任何具体图形类；只负责“怎么排版”，不负责“图形显示什么”。
- **cli**
  - `Repl`：基于 readline，处理 `svg>` 提示符和 `#` 注释。
  - `Tokenizer`：处理双引号包裹的参数。
  - `CommandRegistry`：命令名到 `CliHandler` 的映射。第 1 处按名字分派，**待重构**。
  - 每个 `CliHandler` 负责解析参数、构建 `EditCommand`（通过 factory 创建图形），再交给 session 执行。
  - `ConsoleOutput`：统一加上 `error:` / `warning:` 前缀。



#### 包图（PlantUML）

```plantuml
@startuml
package cli
package app
package command
package model
package factory
package io
package view
cli --> app
cli --> command
cli --> factory
cli --> view
app --> command
app --> model
command --> model
factory --> model
view --> model
io ..|> app : implements ports
io --> factory
io --> model
@enduml
```



### 2. 设计模式的选择

（待补充：Command、Composite、Facade、Factory 的具体落地说明。）

序列化与显示的设计决策：采用**图形自描述**而非 Visitor。每个 `Shape` 自己说明“我是什么标签、有哪些属性、有无文本内容、有哪些子节点、在 tree/show 中如何显示”，`SvgSerializer`、`TreeRenderer`、`ShowRenderer` 只做通用的递归遍历与排版。这样新增图形类型（包括后续的 `box` 插件）时，序列化器和渲染器都无需修改，符合“内核为插件新增的代码为 0”的目标。本方案不使用 Visitor。

### 3. 依赖方向规则

箭头表示“可以依赖”，图中没有的依赖一律禁止：

```mermaid
flowchart TD
  mainEntry[main.ts] --> cli
  mainEntry --> io
  mainEntry --> factory
  cli --> app
  cli --> command
  cli --> factory
  cli --> view
  io --> app
  io --> factory
  io --> model
  app --> command
  app --> model
  command --> model
  factory --> model
  view --> model
```



1. **model 不依赖任何模块**，也不引用 Node 内置模块。理由：图形树会被 CLI、agent、鼠标三种通道共用，必须保持纯净，便于单元测试。
2. **command 只依赖 model**。命令不关心来源是文本还是鼠标，也不做任何输出。理由：以后 GUI 可以直接复用。
3. **app 只依赖 model 和 command，通过自己定义的端口接口使用 IO**，不能 import io。理由：依赖倒置，文件、网络、内存存储都可替换，测试时可注入假实现。
4. **io 依赖 app 的端口和 model/factory，属于最外层的“插件”**，不允许被 app、command、model 引用。io 只通过 `Shape` 的自描述接口读取图形，不依赖任何具体图形子类。
5. **view 只依赖 model**，通过 `Shape` 的自描述接口只读遍历图形树，不修改状态。
6. **cli 位于最外层**，可依赖 app、command、factory、view，但不能直接 import io，也不能绕过 session 直接修改 model。
7. **只有 main.ts 可以同时看到所有模块**，负责创建 `FileDocumentStore`、`ShapeFactory`（注册 6 种内置类型）、`EditorSession` 和 `Repl` 并连接。
8. **全局不允许循环依赖**；同一模块内部可以互相引用。
9. 按名字分派只允许出现在 `cli/CommandRegistry` 和 `factory/ShapeFactory` 两处。

检查手段：`dependency-cruiser`，规则见 `.dependency-cruiser.cjs`，执行 `npm run lint:deps`。

### 4. 变化点假设

- **新增图形类型（如 `box` 插件）**：序列化与 tree/show 显示都已改为图形自描述，序列化器和渲染器无需修改；`box` 的 `data-kind` 标记由其 `attributes()` 输出，`g#n1 (box)` 的类型标注由其 `summary()` 输出。代价是 model 中的 `Shape` 需要知道 SVG 的标签名和属性名，并且承担了一部分显示文本的职责，即 SVG 词汇和显示格式进入了 model。决定接受这一点：SVG 本身就是本领域的原生格式，不为“可能换成别的格式”预留抽象。
- **显示文本的职责边界**：`summary()`/`detailLines()` 返回的是 CLI 文本。若以后有 GUI 需要结构化属性展示，可改为返回键值对，由各通道自行排版；目前 CLI 是唯一通道，暂不预留。
- **命令直接返回摘要字符串**：简单，但一部分展示职责落在了 command。若以后要多语言或有 GUI，可改成结构化的 `CommandResult`。
- **暂不引入 Observer**：CLI 不需要；GUI 阶段需要刷新画面时，再在 `SvgDocument` 上加事件。

（待补充：其余变化点。）

## 过程记录

- **序列化方案由 Visitor 改为图形自描述**：AI 给出的初稿选用 Visitor，同时在取舍中指出它与 `box` 插件化（内核新增代码为 0）的目标冲突。复核后决定在方案阶段就改为自描述，避免后期重构。起初 view 仍保留 Visitor（每种图形的显示格式不同），但这会让新增类型时仍需修改渲染器，与序列化改动的目的自相矛盾，随后也一并改为自描述（`summary()` / `detailLines()`），整个方案不再使用 Visitor。

（其余待补充。）

## 一致性自查

（实现完成后补充。）

## 质量保证手段

（实现完成后补充。）