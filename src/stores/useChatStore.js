// src/stores/useChatStore.js
import { ref, watch } from 'vue'

// 生成短ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// 从 localStorage 读取或初始化
const STORAGE_KEY = 'ai_chat_sessions'

function loadSessions() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      return null
    }
  }
  return null
}

const defaultSessions = [
  {
    id: generateId(),
    title: '新对话',
    messages: [
      { role: 'assistant', content: '你好！我是AI智能助手，请问有什么可以帮助你的？' }
    ]
  }
]

const sessionsData = loadSessions() || defaultSessions

export const sessions = ref(sessionsData)
export const currentSessionId = ref(sessionsData[0]?.id || '')

// 获取当前会话
export function getCurrentSession() {
  return sessions.value.find(s => s.id === currentSessionId.value)
}

// 获取当前会话的消息
export function getCurrentMessages() {
  const session = getCurrentSession()
  return session ? session.messages : []
}

// 更新当前会话的消息（直接替换）
export function updateCurrentMessages(messages) {
  const session = getCurrentSession()
  if (session) {
    session.messages = messages
    saveToLocalStorage()
  }
}

// 添加消息到当前会话
export function addMessageToCurrent(message) {
  const session = getCurrentSession()
  if (session) {
    session.messages.push(message)
    saveToLocalStorage()
  }
}

// 创建新会话
export function createNewSession() {
  const newSession = {
    id: generateId(),
    title: `新对话 ${sessions.value.length + 1}`,
    messages: [
      { role: 'assistant', content: '你好！我是AI智能助手，请问有什么可以帮助你的？' }
    ]
  }
  sessions.value.unshift(newSession)
  currentSessionId.value = newSession.id
  saveToLocalStorage()
  return newSession
}

// 删除会话
export function deleteSession(sessionId) {
  if (sessions.value.length <= 1) {
    alert('至少保留一个对话')
    return false
  }
  sessions.value = sessions.value.filter(s => s.id !== sessionId)
  if (currentSessionId.value === sessionId) {
    currentSessionId.value = sessions.value[0]?.id || ''
  }
  saveToLocalStorage()
  return true
}

// 切换会话
export function switchSession(sessionId) {
  const exists = sessions.value.some(s => s.id === sessionId)
  if (exists) {
    currentSessionId.value = sessionId
  }
}

// 更新会话标题（根据第一条用户消息自动生成）
export function updateSessionTitle(sessionId, title) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (session && title) {
    // 截取前20个字符作为标题
    session.title = title.slice(0, 20) + (title.length > 20 ? '...' : '')
    saveToLocalStorage()
  }
}

// 保存到 localStorage
function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.value))
}

// 监听变化自动保存
watch(sessions, () => {
  saveToLocalStorage()
}, { deep: true })
// ===== 搜索功能 =====

// 搜索所有会话中匹配关键词的消息
export function searchSessions(keyword) {
    if (!keyword || keyword.trim() === '') {
      return sessions.value.map(s => ({ ...s, matchedMessages: [] }))
    }
  
    const trimmed = keyword.trim().toLowerCase()
    const results = []
  
    for (const session of sessions.value) {
      const matchedMessages = session.messages
        .map((msg, index) => {
          const content = msg.content.toLowerCase()
          if (content.includes(trimmed)) {
            // 找出匹配的位置，用于高亮
            const startIndex = content.indexOf(trimmed)
            const endIndex = startIndex + trimmed.length
            // 截取匹配内容前后的上下文（最多50个字符）
            const contextStart = Math.max(0, startIndex - 30)
            const contextEnd = Math.min(msg.content.length, endIndex + 30)
            const preview = (contextStart > 0 ? '...' : '') + 
              msg.content.substring(contextStart, contextEnd) + 
              (contextEnd < msg.content.length ? '...' : '')
            return {
              ...msg,
              index,
              preview,
              matchStart: startIndex,
              matchEnd: endIndex
            }
          }
          return null
        })
        .filter(Boolean)
  
      if (matchedMessages.length > 0) {
        results.push({
          ...session,
          matchedMessages
        })
      }
    }
  
    return results
  }