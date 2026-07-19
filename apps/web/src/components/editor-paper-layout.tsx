import type { FC, ReactNode } from 'react'

interface EditorPaperLayoutProps {
  /** 编辑器区域内容。 */
  children: ReactNode
  /** 右侧抽屉(可选)。 */
  drawer?: ReactNode
  /** 是否展开抽屉。 */
  drawerOpen?: boolean
}

/**
 * EditorPaperLayout:A4 纸面布局 demo example。
 *
 * 灰色工作区背景 + 居中白色 A4 纸面 + 阴影。纸面固定最大宽 820px,
 * 两侧工作区灰底吸收宽度变化。抽屉从右侧滑入,挤压工作区宽度。
 *
 * 这是 apps/web demo 自有样式与逻辑,不在 @tap-note/editor 或 @tap-note/ai-chat 包范围内。
 * 集成方可参考或自行实现任意布局。
 */
export const EditorPaperLayout: FC<EditorPaperLayoutProps> = ({ children, drawer, drawerOpen }) => {
  return (
    <div className={`tn-paper-layout ${drawerOpen ? 'tn-paper-layout-drawer-open' : ''}`}>
      <main className="tn-paper-workspace" aria-label="文档工作区">
        <div className="tn-paper-page">
          {children}
        </div>
      </main>
      {drawer ? (
        <aside className="tn-paper-drawer" aria-label="对话面板抽屉">
          {drawer}
        </aside>
      ) : null}
    </div>
  )
}
