import { TapNoteEditor } from "@tap-note/editor"
import type { Block } from "@tap-note/editor"
import { Button } from "@workspace/ui/components/button"
import { useEffect, useState } from "react"
import { useTheme } from "@/components/theme-provider.tsx"

import "./app.css"

// TODO(FEAT-006): 多路由 demo 接管后清理此临时冒烟挂载

// 模块顶层常量,避免每次 render 重建 editor(详见 @tap-note/editor README "非受控模型")
const INITIAL_CONTENT = [
  { type: "paragraph", content: "Hello tap-note editor." },
  { type: "paragraph", content: "试试 / 唤起 slash 菜单,或拖拽块、缩进、切换格式。" },
] as const

type ResolvedTheme = "light" | "dark"

/**
 * 从 <html> class 解析当前 resolved theme。
 * theme-provider 通过给 <html> 加 light/dark class 切换主题(支持 system 模式),
 * BlockNote 的 theme prop 需要明确的 "light" | "dark",不能用 system。
 * 监听 <html> class 变化,确保两者同步。
 */
function useResolvedTheme(): ResolvedTheme {
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
  )

  useEffect(() => {
    const update = () => {
      setResolved(
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      )
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [])

  return resolved
}

function ThemeToggleButton() {
  const { theme, setTheme } = useTheme()
  const next = theme === "dark" ? "light" : theme === "light" ? "dark" : "light"
  return (
    <Button variant="outline" size="sm" onClick={() => setTheme(next)}>
      切换主题(当前: {theme})
    </Button>
  )
}

export function App() {
  const [blocks, setBlocks] = useState<Block[] | null>(null)
  const resolvedTheme = useResolvedTheme()
  return (
    <div className="tap-note-app">
      <header className="tap-note-app-header">
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <h1 style={{ fontSize: "1rem", fontWeight: 500, margin: 0 }}>
            tap-note editor 冒烟
          </h1>
          <span style={{ color: "var(--muted-foreground)", fontSize: "0.875rem" }}>
            BlockNote shadcn · 全屏可滚动 · {resolvedTheme}
          </span>
          <Button size="sm" onClick={() => console.log(blocks)}>打印当前 blocks</Button>
          <ThemeToggleButton />
        </div>
      </header>
      <main className="tap-note-app-editor">
        <TapNoteEditor
          theme={resolvedTheme}
          initialContent={[...INITIAL_CONTENT]}
          onChange={setBlocks}
        />
      </main>
    </div>
  )
}
