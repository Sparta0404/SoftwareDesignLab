# 文件清单与职责（自动生成）

> 由 `scripts/metrics.mjs` 生成。基线 `final` → `p2`。

| 路径 | 类别 | 职责 | final 非空行 | p2 非空行 | Δ 行 | final CC | p2 CC | Δ CC |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| plugins/command-dir/DirCommand.ts | 插件 | 外部插件包（stats / dir / box / tree-star 等）：command-dir | 0 | 57 | +57 | 0 | 18 | +18 |
| plugins/command-dir/DirectoryLister.ts | 插件 | 外部插件包（stats / dir / box / tree-star 等）：command-dir | 0 | 15 | +15 | 0 | 0 | 0 |
| plugins/command-dir/NodeFsDirectoryAdapter.ts | 插件 | 外部插件包（stats / dir / box / tree-star 等）：command-dir | 0 | 18 | +18 | 0 | 4 | +4 |
| plugins/command-dir/index.ts | 插件 | 外部插件包（stats / dir / box / tree-star 等）：command-dir | 0 | 24 | +24 | 0 | 3 | +3 |
| plugins/command-stats/ShapeStatistics.ts | 插件 | 外部插件包（stats / dir / box / tree-star 等）：command-stats | 0 | 36 | +36 | 0 | 8 | +8 |
| plugins/command-stats/StatsCommand.ts | 插件 | 外部插件包（stats / dir / box / tree-star 等）：command-stats | 0 | 18 | +18 | 0 | 2 | +2 |
| plugins/command-stats/index.ts | 插件 | 外部插件包（stats / dir / box / tree-star 等）：command-stats | 0 | 16 | +16 | 0 | 1 | +1 |
| plugins/shape-box/BoxAttributeHandler.ts | 插件 | 外部插件包（stats / dir / box / tree-star 等）：shape-box | 0 | 43 | +43 | 0 | 9 | +9 |
| plugins/shape-box/BoxProvider.ts | 插件 | 外部插件包（stats / dir / box / tree-star 等）：shape-box | 0 | 85 | +85 | 0 | 15 | +15 |
| plugins/shape-box/BoxShape.ts | 插件 | 外部插件包（stats / dir / box / tree-star 等）：shape-box | 0 | 63 | +63 | 0 | 16 | +16 |
| plugins/shape-box/BoxTypeLabelDecorator.ts | 插件 | 外部插件包（stats / dir / box / tree-star 等）：shape-box | 0 | 9 | +9 | 0 | 2 | +2 |
| plugins/shape-box/index.ts | 插件 | 外部插件包（stats / dir / box / tree-star 等）：shape-box | 0 | 23 | +23 | 0 | 1 | +1 |
| plugins/tree-star/ModificationTracker.ts | 插件 | 外部插件包（stats / dir / box / tree-star 等）：tree-star | 0 | 91 | +91 | 0 | 24 | +24 |
| plugins/tree-star/ModifiedStarDecorator.ts | 插件 | 外部插件包（stats / dir / box / tree-star 等）：tree-star | 0 | 16 | +16 | 0 | 4 | +4 |
| plugins/tree-star/index.ts | 插件 | 外部插件包（stats / dir / box / tree-star 等）：tree-star | 0 | 17 | +17 | 0 | 1 | +1 |
| src/api/index.ts | 内核 | 插件唯一公开门面（再导出扩展点与领域抽象） | 0 | 39 | +39 | 0 | 0 | 0 |
| src/app/EditorSession.ts | 内核 | EditorSession 与 IO 端口 | 92 | 125 | +33 | 16 | 22 | +6 |
| src/app/error/FileError.ts | 内核 | EditorSession 与 IO 端口 | 3 | 3 | 0 | 0 | 0 | 0 |
| src/app/error/NoDocumentError.ts | 内核 | EditorSession 与 IO 端口 | 6 | 6 | 0 | 1 | 1 | 0 |
| src/app/port/DocumentReader.ts | 内核 | EditorSession 与 IO 端口 | 9 | 9 | 0 | 0 | 0 | 0 |
| src/app/port/DocumentWriter.ts | 内核 | EditorSession 与 IO 端口 | 5 | 5 | 0 | 0 | 0 | 0 |
| src/app/port/WarningSink.ts | 内核 | EditorSession 与 IO 端口 | 4 | 4 | 0 | 0 | 0 | 0 |
| src/builtin/BuiltinCommandsPlugin.ts | 装配处 | 把内置图形与 Phase 1 命令包装成插件 | 0 | 64 | +64 | 0 | 4 | +4 |
| src/builtin/BuiltinShapesPlugin.ts | 装配处 | 把内置图形与 Phase 1 命令包装成插件 | 0 | 14 | +14 | 0 | 2 | +2 |
| src/builtin/index.ts | 装配处 | 把内置图形与 Phase 1 命令包装成插件 | 0 | 11 | +11 | 0 | 1 | +1 |
| src/cli/Arguments.ts | 内核 | REPL、命令分派与 Command 扩展点 | 19 | 19 | 0 | 6 | 6 | 0 |
| src/cli/Cli.ts | 内核 | REPL、命令分派与 Command 扩展点 | 69 | 41 | -28 | 8 | 8 | 0 |
| src/cli/CliContext.ts | 内核 | REPL、命令分派与 Command 扩展点 | 9 | 0 | -9 | 0 | 0 | 0 |
| src/cli/Command.ts | 内核 | REPL、命令分派与 Command 扩展点 | 0 | 23 | +23 | 0 | 0 | 0 |
| src/cli/CommandRegistry.ts | 内核 | REPL、命令分派与 Command 扩展点 | 27 | 22 | -5 | 6 | 6 | 0 |
| src/cli/ConsoleOutput.ts | 内核 | REPL、命令分派与 Command 扩展点 | 18 | 18 | 0 | 4 | 4 | 0 |
| src/cli/Repl.ts | 内核 | REPL、命令分派与 Command 扩展点 | 26 | 26 | 0 | 3 | 3 | 0 |
| src/cli/TextOutput.ts | 内核 | REPL、命令分派与 Command 扩展点 | 5 | 5 | 0 | 0 | 0 | 0 |
| src/cli/Tokenizer.ts | 内核 | REPL、命令分派与 Command 扩展点 | 23 | 23 | 0 | 9 | 9 | 0 |
| src/cli/handler/AddToHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 15 | 14 | -1 | 2 | 2 | 0 |
| src/cli/handler/CanvasHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 17 | 16 | -1 | 3 | 3 | 0 |
| src/cli/handler/CliHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 6 | 0 | -6 | 0 | 0 | 0 |
| src/cli/handler/CreateHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 30 | 31 | +1 | 8 | 9 | +1 |
| src/cli/handler/DeleteHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 15 | 14 | -1 | 2 | 2 | 0 |
| src/cli/handler/GroupHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 16 | 15 | -1 | 2 | 2 | 0 |
| src/cli/handler/HelpHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 15 | 18 | +3 | 4 | 4 | 0 |
| src/cli/handler/InitHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 13 | 12 | -1 | 3 | 3 | 0 |
| src/cli/handler/MoveHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 15 | 14 | -1 | 2 | 2 | 0 |
| src/cli/handler/ReadHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 11 | 10 | -1 | 1 | 1 | 0 |
| src/cli/handler/RedoHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 11 | 10 | -1 | 1 | 1 | 0 |
| src/cli/handler/SaveHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 11 | 10 | -1 | 1 | 1 | 0 |
| src/cli/handler/ScaleHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 15 | 14 | -1 | 2 | 2 | 0 |
| src/cli/handler/SetHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 15 | 16 | +1 | 2 | 3 | +1 |
| src/cli/handler/ShowHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 13 | 12 | -1 | 2 | 2 | 0 |
| src/cli/handler/TreeHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 15 | 16 | +1 | 2 | 3 | +1 |
| src/cli/handler/UndoHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 11 | 10 | -1 | 1 | 1 | 0 |
| src/cli/handler/UngroupHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 15 | 14 | -1 | 2 | 2 | 0 |
| src/cli/handler/ZOrderHandler.ts | 内核 | REPL、命令分派与 Command 扩展点 | 17 | 16 | -1 | 3 | 3 | 0 |
| src/command/attribute/AttributeHandler.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 0 | 26 | +26 | 0 | 0 | 0 |
| src/command/attribute/AttributeHandlerRegistry.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 0 | 20 | +20 | 0 | 5 | +5 |
| src/command/edit/AddToCommand.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 51 | 51 | 0 | 12 | 12 | 0 |
| src/command/edit/CommandSnapshots.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 14 | 14 | 0 | 4 | 4 | 0 |
| src/command/edit/CreateCommand.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 37 | 40 | +3 | 8 | 9 | +1 |
| src/command/edit/DeleteCommand.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 36 | 36 | 0 | 8 | 8 | 0 |
| src/command/edit/GroupCommand.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 88 | 105 | +17 | 23 | 27 | +4 |
| src/command/edit/MoveCommand.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 50 | 50 | 0 | 10 | 10 | 0 |
| src/command/edit/ScaleCommand.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 40 | 40 | 0 | 9 | 9 | 0 |
| src/command/edit/SetAttrCommand.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 41 | 146 | +105 | 9 | 46 | +37 |
| src/command/edit/UngroupCommand.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 66 | 66 | 0 | 15 | 15 | 0 |
| src/command/edit/ZOrderCommand.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 51 | 51 | 0 | 12 | 12 | 0 |
| src/command/error/AttributeHandlerConflictError.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 0 | 9 | +9 | 0 | 1 | +1 |
| src/command/error/EmptyHistoryError.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 6 | 6 | 0 | 1 | 1 | 0 |
| src/command/error/GroupIntoDescendantError.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 7 | 7 | 0 | 1 | 1 | 0 |
| src/command/error/InvalidScaleFactorError.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 6 | 6 | 0 | 1 | 1 | 0 |
| src/command/error/UndoNotAllowedError.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 6 | 6 | 0 | 1 | 1 | 0 |
| src/command/error/UngroupCompositeError.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 6 | 6 | 0 | 1 | 1 | 0 |
| src/command/error/UngroupTopLevelError.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 6 | 6 | 0 | 1 | 1 | 0 |
| src/command/history/CommandHistory.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 51 | 51 | 0 | 8 | 8 | 0 |
| src/command/history/EditCommand.ts | 内核 | 编辑命令、属性处理器扩展点、历史栈 | 11 | 11 | 0 | 0 | 0 | 0 |
| src/factory/AbstractShapeCreator.ts | 内核 | 图形工厂与 ShapeProvider 扩展点 | 47 | 60 | +13 | 15 | 17 | +2 |
| src/factory/ShapeCreator.ts | 内核 | 图形工厂与 ShapeProvider 扩展点 | 15 | 0 | -15 | 0 | 0 | 0 |
| src/factory/ShapeFactory.ts | 内核 | 图形工厂与 ShapeProvider 扩展点 | 40 | 81 | +41 | 9 | 16 | +7 |
| src/factory/ShapeProvider.ts | 内核 | 图形工厂与 ShapeProvider 扩展点 | 0 | 41 | +41 | 0 | 0 | 0 |
| src/factory/error/InvalidArgumentsError.ts | 内核 | 图形工厂与 ShapeProvider 扩展点 | 3 | 3 | 0 | 0 | 0 | 0 |
| src/factory/error/UnknownShapeTypeError.ts | 内核 | 图形工厂与 ShapeProvider 扩展点 | 6 | 6 | 0 | 1 | 1 | 0 |
| src/io/FileDocumentStore.ts | 内核 | SVG 解析/序列化与文件存储 | 33 | 33 | 0 | 5 | 5 | 0 |
| src/io/SvgParser.ts | 内核 | SVG 解析/序列化与文件存储 | 113 | 127 | +14 | 31 | 33 | +2 |
| src/io/SvgSerializer.ts | 内核 | SVG 解析/序列化与文件存储 | 55 | 55 | 0 | 11 | 11 | 0 |
| src/loader/LaunchArguments.ts | 装配处 | 配置装配：读 plugins.config.json、按字符串解析模块 | 0 | 45 | +45 | 0 | 15 | +15 |
| src/loader/PluginConfig.ts | 装配处 | 配置装配：读 plugins.config.json、按字符串解析模块 | 0 | 56 | +56 | 0 | 25 | +25 |
| src/loader/PluginLoader.ts | 装配处 | 配置装配：读 plugins.config.json、按字符串解析模块 | 0 | 51 | +51 | 0 | 6 | +6 |
| src/loader/PluginModuleLoader.ts | 装配处 | 配置装配：读 plugins.config.json、按字符串解析模块 | 0 | 121 | +121 | 0 | 29 | +29 |
| src/loader/error/LoaderError.ts | 装配处 | 配置装配：读 plugins.config.json、按字符串解析模块 | 0 | 21 | +21 | 0 | 3 | +3 |
| src/loader/index.ts | 装配处 | 配置装配：读 plugins.config.json、按字符串解析模块 | 0 | 14 | +14 | 0 | 0 | 0 |
| src/main.ts | 装配处 | Composition Root：代码装配 / 配置装配入口 | 30 | 109 | +79 | 2 | 14 | +12 |
| src/model/document/DocumentEvent.ts | 内核 | 领域模型：图形树、文档、错误 | 0 | 7 | +7 | 0 | 0 | 0 |
| src/model/document/IdIndex.ts | 内核 | 领域模型：图形树、文档、错误 | 33 | 33 | 0 | 10 | 10 | 0 |
| src/model/document/Placement.ts | 内核 | 领域模型：图形树、文档、错误 | 6 | 6 | 0 | 0 | 0 | 0 |
| src/model/document/SvgDocument.ts | 内核 | 领域模型：图形树、文档、错误 | 98 | 103 | +5 | 24 | 27 | +3 |
| src/model/error/ContractViolationError.ts | 内核 | 领域模型：图形树、文档、错误 | 0 | 7 | +7 | 0 | 1 | +1 |
| src/model/error/EditorError.ts | 内核 | 领域模型：图形树、文档、错误 | 7 | 7 | 0 | 1 | 1 | 0 |
| src/model/error/IdExistsError.ts | 内核 | 领域模型：图形树、文档、错误 | 6 | 6 | 0 | 1 | 1 | 0 |
| src/model/error/InvalidValueError.ts | 内核 | 领域模型：图形树、文档、错误 | 3 | 3 | 0 | 0 | 0 | 0 |
| src/model/error/NoSuchContainerError.ts | 内核 | 领域模型：图形树、文档、错误 | 6 | 6 | 0 | 1 | 1 | 0 |
| src/model/error/NoSuchShapeError.ts | 内核 | 领域模型：图形树、文档、错误 | 6 | 6 | 0 | 1 | 1 | 0 |
| src/model/error/NotContainerError.ts | 内核 | 领域模型：图形树、文档、错误 | 6 | 6 | 0 | 1 | 1 | 0 |
| src/model/error/UnknownAttributeError.ts | 内核 | 领域模型：图形树、文档、错误 | 6 | 6 | 0 | 1 | 1 | 0 |
| src/model/shape/GeometryShape.ts | 内核 | 领域模型：图形树、文档、错误 | 80 | 80 | 0 | 24 | 24 | 0 |
| src/model/shape/GroupShape.ts | 内核 | 领域模型：图形树、文档、错误 | 52 | 52 | 0 | 14 | 14 | 0 |
| src/model/shape/Numbers.ts | 内核 | 领域模型：图形树、文档、错误 | 16 | 16 | 0 | 5 | 5 | 0 |
| src/model/shape/Shape.ts | 内核 | 领域模型：图形树、文档、错误 | 173 | 222 | +49 | 43 | 51 | +8 |
| src/plugin/Plugin.ts | 内核 | PluginHost：暂存注册、清单校验、原子提交 | 0 | 45 | +45 | 0 | 0 | 0 |
| src/plugin/PluginHost.ts | 内核 | PluginHost：暂存注册、清单校验、原子提交 | 0 | 217 | +217 | 0 | 60 | +60 |
| src/plugin/error/PluginError.ts | 内核 | PluginHost：暂存注册、清单校验、原子提交 | 0 | 22 | +22 | 0 | 4 | +4 |
| src/shapes/BuiltinShapes.ts | 内核 | 六种内置图形实现（由 builtin 包装注册） | 22 | 31 | +9 | 2 | 4 | +2 |
| src/shapes/circle/CircleCreator.ts | 内核 | 六种内置图形实现（由 builtin 包装注册） | 11 | 11 | 0 | 1 | 1 | 0 |
| src/shapes/circle/CircleShape.ts | 内核 | 六种内置图形实现（由 builtin 包装注册） | 21 | 21 | 0 | 3 | 3 | 0 |
| src/shapes/ellipse/EllipseCreator.ts | 内核 | 六种内置图形实现（由 builtin 包装注册） | 11 | 11 | 0 | 1 | 1 | 0 |
| src/shapes/ellipse/EllipseShape.ts | 内核 | 六种内置图形实现（由 builtin 包装注册） | 22 | 22 | 0 | 3 | 3 | 0 |
| src/shapes/group/GroupCreator.ts | 内核 | 六种内置图形实现（由 builtin 包装注册） | 10 | 10 | 0 | 1 | 1 | 0 |
| src/shapes/line/LineCreator.ts | 内核 | 六种内置图形实现（由 builtin 包装注册） | 11 | 11 | 0 | 1 | 1 | 0 |
| src/shapes/line/LineShape.ts | 内核 | 六种内置图形实现（由 builtin 包装注册） | 22 | 22 | 0 | 3 | 3 | 0 |
| src/shapes/rect/RectCreator.ts | 内核 | 六种内置图形实现（由 builtin 包装注册） | 11 | 11 | 0 | 1 | 1 | 0 |
| src/shapes/rect/RectShape.ts | 内核 | 六种内置图形实现（由 builtin 包装注册） | 22 | 22 | 0 | 3 | 3 | 0 |
| src/shapes/text/TextCreator.ts | 内核 | 六种内置图形实现（由 builtin 包装注册） | 19 | 19 | 0 | 3 | 3 | 0 |
| src/shapes/text/TextShape.ts | 内核 | 六种内置图形实现（由 builtin 包装注册） | 49 | 55 | +6 | 13 | 15 | +2 |
| src/view/ShowRenderer.ts | 内核 | tree/show 渲染与 TreeDecorator 扩展点 | 14 | 14 | 0 | 2 | 2 | 0 |
| src/view/TreeDecorator.ts | 内核 | tree/show 渲染与 TreeDecorator 扩展点 | 0 | 25 | +25 | 0 | 0 | 0 |
| src/view/TreeDecoratorRegistry.ts | 内核 | tree/show 渲染与 TreeDecorator 扩展点 | 0 | 15 | +15 | 0 | 3 | +3 |
| src/view/TreeRenderer.ts | 内核 | tree/show 渲染与 TreeDecorator 扩展点 | 60 | 88 | +28 | 22 | 29 | +7 |
| src/view/error/TreeDecoratorError.ts | 内核 | tree/show 渲染与 TreeDecorator 扩展点 | 0 | 8 | +8 | 0 | 2 | +2 |
