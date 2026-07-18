import { TapNoteEditor } from "@tap-note/editor"
import type { Block } from "@tap-note/editor"
import { Button } from "@workspace/ui/components/button"
import { useState } from "react"

import "./app.css"

// TODO(FEAT-006): 多路由 demo 接管后清理此临时冒烟挂载

// 模块顶层常量,避免每次 render 重建 editor(详见 @tap-note/editor README "非受控模型")
const INITIAL_CONTENT = [
  { type: "paragraph", content: "Hello tap-note editor." },
  { type: "paragraph", content: "试试 / 唤起 slash 菜单,或拖拽块、缩进、切换格式。" },
] as const

export function App() {
  const [blocks, setBlocks] = useState<Block[] | null>(null)
  return (
    <div className="tap-note-app">
      <header className="tap-note-app-header">
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <h1 style={{ fontSize: "1rem", fontWeight: 500, margin: 0 }}>
            tap-note editor 冒烟
          </h1>
          <span style={{ color: "var(--muted-foreground)", fontSize: "0.875rem" }}>
            BlockNote shadcn · 全屏可滚动布局
          </span>
          <Button onClick={() => console.log(blocks)}>打印当前 blocks</Button>
        </div>
      </header>
      <main className="tap-note-app-editor">
        <TapNoteEditor
          initialContent={[...INITIAL_CONTENT]}
          onChange={setBlocks}
        />
      </main>
    </div>
  )
}
