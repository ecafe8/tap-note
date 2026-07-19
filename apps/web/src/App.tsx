import { TapNoteEditor } from "@tap-note/editor"
import type { Block } from "@tap-note/editor"
import { Button } from "@workspace/ui/components/button"
import { useEffect, useState, useSyncExternalStore } from "react"
import { useTheme } from "@/components/theme-provider.tsx"
import { createAIBusyState, createServerTransport } from "@tap-note/ai-core"
import { createTapNoteInlineAssistant } from "@tap-note/ai-inline"
import type { AIInlineStoreState } from "@tap-note/ai-inline"

import "./app.css"

const INITIAL_CONTENT = [
  { type: "paragraph", content: "Hello tap-note editor." },
  { type: "paragraph", content: "试试 / 唤起 slash 菜单,或拖拽块、缩进、切换格式。" },
  { type: "paragraph", content: "点击上方「✨ AI 助手」按钮体验内联 AI(需启动 server-api)。" },
] as const

const aiBusyState = createAIBusyState()

function createInlineAssistant() {
  return createTapNoteInlineAssistant({
    transport: createServerTransport({
      baseUrl: "/api/ai/editor/streamText",
      model: "dashscope:qwen-plus",
    }),
    aiBusyState,
  })
}

const inlineAssistant = createInlineAssistant()
const aiContext = inlineAssistant.context!

function useAIInlineState(): AIInlineStoreState {
  const store = aiContext.store
  return useSyncExternalStore(
    (cb: () => void) => store.subscribe(cb as never),
    () => store.state,
    () => store.state,
  )
}

type ResolvedTheme = "light" | "dark"

function useResolvedTheme(): ResolvedTheme {
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark" : "light",
  )
  useEffect(() => {
    const update = () => setResolved(document.documentElement.classList.contains("dark") ? "dark" : "light")
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return resolved
}

function ThemeToggleButton() {
  const { theme, setTheme } = useTheme()
  const next = theme === "dark" ? "light" : theme === "light" ? "dark" : "light"
  return <Button variant="outline" size="sm" onClick={() => setTheme(next)}>切换主题({theme})</Button>
}

function AIMenuPanel({ onClose }: { onClose: () => void }) {
  const aiState = useAIInlineState()
  const [input, setInput] = useState("")
  const state = aiState.state

  const handleSubmit = () => {
    if (!input.trim()) return
    console.log("[AIMenu] submit:", input.trim())
    aiContext.submit(input.trim())
    setInput("")
  }

  if (state.status === "user-input") {
    return (
      <div style={{ position: "fixed", bottom: "2rem", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.5rem 0.75rem", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "0.5rem", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 1000 }}>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && input.trim()) { e.preventDefault(); handleSubmit() }
            if (e.key === "Escape") { onClose(); setInput("") }
          }}
          placeholder="输入指令,如「续写一段」..." style={{ width: "300px", border: "none", outline: "none", background: "transparent" }} autoFocus />
        <Button size="sm" onClick={handleSubmit}>发送</Button>
        <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
      </div>
    )
  }

  if (state.status === "thinking" || state.status === "ai-writing") {
    return (
      <div style={{ position: "fixed", bottom: "2rem", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.5rem 0.75rem", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "0.5rem", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 1000 }}>
        <span>AI 正在{state.status === "thinking" ? "思考" : "写作"}...</span>
        <Button size="sm" variant="destructive" onClick={() => aiContext.abort()}>中止</Button>
      </div>
    )
  }

  if (state.status === "user-reviewing") {
    return (
      <div style={{ position: "fixed", bottom: "2rem", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.5rem 0.75rem", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "0.5rem", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 1000 }}>
        <span>AI 完成,请审阅</span>
        <Button size="sm" onClick={() => { aiContext.accept(); onClose() }}>接受</Button>
        <Button size="sm" variant="outline" onClick={() => { aiContext.reject(); onClose() }}>拒绝</Button>
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div style={{ position: "fixed", bottom: "2rem", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.5rem 0.75rem", background: "var(--background)", border: "1px solid var(--destructive)", borderRadius: "0.5rem", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 1000 }}>
        <span style={{ color: "var(--destructive)" }}>{state.error}</span>
        <Button size="sm" onClick={() => aiContext.retry()}>重试</Button>
        <Button size="sm" variant="ghost" onClick={onClose}>关闭</Button>
      </div>
    )
  }

  return null
}

export function App() {
  const [blocks, setBlocks] = useState<Block[] | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const resolvedTheme = useResolvedTheme()

  const handleClose = () => {
    aiContext.close()
    setMenuOpen(false)
  }

  return (
    <div className="tap-note-app">
      <header className="tap-note-app-header">
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <h1 style={{ fontSize: "1rem", fontWeight: 500, margin: 0 }}>tap-note editor 冒烟</h1>
          <span style={{ color: "var(--muted-foreground)", fontSize: "0.875rem" }}>BlockNote · {resolvedTheme}</span>
          <Button size="sm" onClick={() => console.log(blocks)}>打印 blocks</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setMenuOpen(true)
            }}
          >
            ✨ AI 助手
          </Button>
          <ThemeToggleButton />
        </div>
      </header>
      <main className="tap-note-app-editor">
        <TapNoteEditor
          theme={resolvedTheme}
          initialContent={[...INITIAL_CONTENT]}
          onChange={setBlocks}
          inlineAssistant={inlineAssistant}
          aiBusyState={aiBusyState}
        />
      </main>
      {menuOpen && <AIMenuPanel onClose={handleClose} />}
    </div>
  )
}
