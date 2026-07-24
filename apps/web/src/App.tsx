import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { TapNoteEditor } from '@tap-note/editor'
import type { Block } from '@tap-note/editor'
import { Button } from '@workspace/ui/components/button'
import { useEffect, useState, useMemo, type ReactNode } from 'react'
import { useTheme } from '@/components/theme-provider.tsx'
import { createAIBusyState, createServerTransport, DEFAULT_MODEL_ID } from '@tap-note/ai-core'
import { createTapNoteInlineAssistant } from '@tap-note/ai-inline'
import { createTapNoteChatAssistant } from '@tap-note/ai-chat'
import { Sidemenu } from '@/components/sidemenu'
import { EditorPaperLayout } from '@/components/editor-paper-layout'
import { ChatDrawer } from '@/components/chat-drawer'
import { ModelSelector } from '@/components/model-selector'
import { ExportButton } from '@/components/export-button'

import './app.css'

const INITIAL_CONTENT = [
  { type: 'paragraph', content: 'Hello tap-note editor.' },
  { type: 'paragraph', content: '试试 / 唤起 slash 菜单,或拖拽块、缩进、切换格式。' },
  { type: 'paragraph', content: '选中文字后点击工具栏中的 AI 按钮体验内联 AI(需启动 server-api)。' },
] as const

const aiBusyState = createAIBusyState()

function useAIAssistants(model: string) {
  return useMemo(() => {
    const inlineAssistant = createTapNoteInlineAssistant({
      transport: createServerTransport({
        baseUrl: '/api/ai/editor/streamText',
        model,
      }),
      aiBusyState,
    })

    const chatAssistant = createTapNoteChatAssistant({
      transport: createServerTransport({
        baseUrl: '/api/ai/chat',
        model,
      }),
      aiBusyState,
    })

    return { inlineAssistant, chatAssistant }
  }, [model])
}

type ResolvedTheme = 'light' | 'dark'

function useResolvedTheme(): ResolvedTheme {
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark' : 'light',
  )
  useEffect(() => {
    const update = () => setResolved(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return resolved
}

function ThemeToggleButton() {
  const { theme, setTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : theme === 'light' ? 'dark' : 'light'
  return <Button variant="outline" size="sm" onClick={() => setTheme(next)}>切换主题({theme})</Button>
}

interface EditorPaneProps {
  showChat?: boolean
  actions?: ReactNode
  inlineAssistant: ReturnType<typeof createTapNoteInlineAssistant>
  chatAssistant: ReturnType<typeof createTapNoteChatAssistant>
}

function EditorPane({ showChat, actions, inlineAssistant, chatAssistant }: EditorPaneProps) {
  const [blocks, setBlocks] = useState<Block[] | null>(null)
  const resolvedTheme = useResolvedTheme()

  return (
    <div className="tn-demo-editor-pane">
      <header className="tn-demo-editor-header">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {actions}
          <ExportButton blocks={blocks} />
          <Button size="sm" onClick={() => console.log(blocks)}>打印 blocks</Button>
          <span style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>BlockNote · {resolvedTheme}</span>
        </div>
      </header>
      <main className="tn-demo-editor-main">
        <TapNoteEditor
          theme={resolvedTheme}
          initialContent={[...INITIAL_CONTENT]}
          onChange={setBlocks}
          inlineAssistant={inlineAssistant}
          chatAssistant={showChat ? chatAssistant : undefined}
          aiBusyState={aiBusyState}
        />
      </main>
    </div>
  )
}

function ModelAndThemeBar({ model, onModelChange }: { model: string; onModelChange: (m: string) => void }) {
  return (
    <div className="tn-demo-toolbar">
      <ModelSelector value={model} onChange={onModelChange} />
      <ThemeToggleButton />
    </div>
  )
}

function InlineRoute() {
  const [model, setModel] = useState(DEFAULT_MODEL_ID)
  const { inlineAssistant, chatAssistant } = useAIAssistants(model)
  return (
    <EditorPaperLayout>
      <ModelAndThemeBar model={model} onModelChange={setModel} />
      <EditorPane inlineAssistant={inlineAssistant} chatAssistant={chatAssistant} />
    </EditorPaperLayout>
  )
}

function ChatRoute() {
  const [model, setModel] = useState(DEFAULT_MODEL_ID)
  const { inlineAssistant, chatAssistant } = useAIAssistants(model)
  return (
    <EditorPaperLayout>
      <ModelAndThemeBar model={model} onModelChange={setModel} />
      <EditorPane
        showChat
        inlineAssistant={inlineAssistant}
        chatAssistant={chatAssistant}
        actions={
          <ChatDrawer>
            {chatAssistant.panel ? <chatAssistant.panel /> : null}
          </ChatDrawer>
        }
      />
    </EditorPaperLayout>
  )
}

function BothRoute() {
  const [model, setModel] = useState(DEFAULT_MODEL_ID)
  const { inlineAssistant, chatAssistant } = useAIAssistants(model)
  return (
    <EditorPaperLayout>
      <ModelAndThemeBar model={model} onModelChange={setModel} />
      <EditorPane
        showChat
        inlineAssistant={inlineAssistant}
        chatAssistant={chatAssistant}
        actions={
          <ChatDrawer>
            {chatAssistant.panel ? <chatAssistant.panel /> : null}
          </ChatDrawer>
        }
      />
    </EditorPaperLayout>
  )
}

function HeaderBar() {
  return (
    <header className="tn-demo-header">
      <h1 className="tn-demo-title">tap-note demo</h1>
    </header>
  )
}

export function App() {
  const navigate = useNavigate()
  useEffect(() => {
    // 默认重定向到 /inline(根路径访问时)
    if (window.location.pathname === '/') {
      navigate('/inline', { replace: true })
    }
  }, [navigate])

  return (
    <div className="tn-demo-app">
      <HeaderBar />
      <div className="tn-demo-body">
        <Sidemenu
          items={[
            { to: '/inline', label: '内联助手', icon: '✨' },
            { to: '/chat', label: '对话助手', icon: '💬' },
            { to: '/both', label: '并存(互斥)', icon: '🔀' },
          ]}
        />
        <div className="tn-demo-content">
          <Routes>
            <Route path="/inline" element={<InlineRoute />} />
            <Route path="/chat" element={<ChatRoute />} />
            <Route path="/both" element={<BothRoute />} />
            <Route path="/" element={<InlineRoute />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

export function AppRoot() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}

void NavLink
