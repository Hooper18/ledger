import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { setupNotificationClickHandler } from './lib/notifications'
import './index.css'

// 必须在渲染前注册：原生侧的 actionPerformed 事件可能在 React 挂载完成前就到达
void setupNotificationClickHandler()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
