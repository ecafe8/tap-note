import { NavLink } from 'react-router-dom'
import type { FC } from 'react'

interface SidemenuProps {
  items: Array<{ to: string; label: string; icon?: string }>
}

/**
 * Sidemenu:侧边菜单切换 /inline、/chat、/both 三路由。
 * 这是 apps/web demo example,不在 @tap-note/ai-chat 包范围内。
 */
export const Sidemenu: FC<SidemenuProps> = ({ items }) => {
  return (
    <nav className="tn-sidemenu" aria-label="主导航">
      <ul className="tn-sidemenu-list">
        {items.map((item) => (
          <li key={item.to} className="tn-sidemenu-item">
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `tn-sidemenu-link ${isActive ? 'active' : ''}`
              }
              aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
            >
              {item.icon ? <span className="tn-sidemenu-icon" aria-hidden="true">{item.icon}</span> : null}
              <span className="tn-sidemenu-label">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
