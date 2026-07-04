<template>
  <div class="app-container" :class="themeClass">
    <!-- 左侧会话列表 -->
    <div class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
      <div class="sidebar-header">
        <h3>💬 对话</h3>
        <button class="new-chat-btn" @click="handleNewChat">＋ 新对话</button>
      </div>

      <!-- 搜索框 -->
      <div class="sidebar-search">
        <input 
          type="text" 
          v-model="searchKeyword" 
          placeholder="🔍 搜索对话..." 
          @input="handleSearch"
          @keyup.esc="clearSearch"
        />
      </div>

      <!-- 会话列表 / 搜索结果 -->
      <div class="session-list">
        <template v-if="isSearching">
          <div v-if="searchResults.length === 0" class="no-result">
            <span>😅 未找到匹配的对话</span>
          </div>
          <div 
            v-for="result in searchResults" 
            :key="result.id"
            class="session-item search-result"
            @click="goToSearchResult(result.id, result.matchedMessages[0]?.index || 0)"
          >
            <div class="session-title">
              <span class="result-title">{{ result.title }}</span>
              <span class="result-count">匹配 {{ result.matchedMessages.length }} 条</span>
            </div>
          </div>
        </template>
        <template v-else>
          <div 
            v-for="session in sessions" 
            :key="session.id"
            class="session-item"
            :class="{ active: session.id === currentSessionId }"
            @click="handleSwitchSession(session.id)"
          >
            <!-- 可编辑标题：双击变成输入框 -->
            <span 
              v-if="editingSessionId !== session.id"
              class="session-title"
              @dblclick="startEditTitle(session.id)"
            >{{ session.title }}</span>
            <input 
              v-else
              ref="titleInputRef"
              class="session-title-input"
              v-model="editingTitle"
              @blur="saveEditTitle(session.id)"
              @keyup.enter="saveEditTitle(session.id)"
              @keyup.esc="cancelEditTitle"
              autofocus
            />
            <button class="delete-btn" @click.stop="handleDeleteSession(session.id)">✕</button>
          </div>
        </template>
      </div>
    </div>

    <!-- 右侧聊天区域 -->
    <div class="chat-main">
      <div class="chat-header">
        <button class="menu-toggle" @click="toggleSidebar">☰</button>
        <h1>💡 智言</h1>
        
        <!-- 模型切换下拉框 -->
        <select 
          v-model="selectedModel" 
          @change="switchModel" 
          class="model-select"
          style="min-height: 44px; font-size: 16px;"
        >
          <option v-for="m in modelList" :key="m.key" :value="m.key">
            {{ m.name }}
          </option>
        </select>

        <!-- 主题切换按钮 -->
        <button class="theme-toggle" @click="toggleTheme">
          {{ theme === 'dark' ? '☀️' : '🌙' }}
        </button>

        <div style="display:flex; gap:8px;">
          <button class="clear-btn" @click="clearChat">🗑️ 清空</button>
          <button class="clear-btn" @click="exportChat">📥 导出</button>
        </div>
      </div>

      <div class="chat-messages" ref="messageContainer">
        <div v-for="(msg, index) in currentMessages" :key="index" 
             :class="['message', msg.role === 'user' ? 'user' : 'assistant']">
          <div class="bubble" v-html="renderMarkdown(msg.content)"></div>
          <div v-if="msg.role === 'assistant'" class="bubble-actions">
            <button class="copy-btn" @click="copyMessage(msg.content)">📋 复制</button>
          </div>
        </div>
        <div v-if="isLoading" class="message assistant">
          <div class="bubble typing">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>

      <div class="chat-input">
        <input 
          type="text" 
          v-model="inputText" 
          placeholder="输入消息..." 
          @keyup.enter="sendMessage" 
          :disabled="isLoading"
        />
        <button @click="sendMessage" :disabled="isLoading">发送</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, computed } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { 
  sessions, currentSessionId, getCurrentMessages, 
  addMessageToCurrent, createNewSession, deleteSession, switchSession,
  updateSessionTitle, searchSessions
} from './stores/useChatStore'

marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  },
  breaks: true,
  gfm: true
})

// ===== 基础状态 =====
const inputText = ref('')
const isLoading = ref(false)
const messageContainer = ref(null)
const sidebarOpen = ref(false)

const currentMessages = computed(() => getCurrentMessages())

// ===== 主题切换 =====
const theme = ref(localStorage.getItem('theme') || 'light')
const themeClass = computed(() => theme.value === 'dark' ? 'dark-theme' : '')

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('theme', theme.value)
}

// ===== 渲染 Markdown =====
function renderMarkdown(content) {
  if (!content) return ''
  return marked.parse(content)
}

function scrollToBottom() {
  nextTick(() => {
    if (messageContainer.value) {
      messageContainer.value.scrollTop = messageContainer.value.scrollHeight
    }
  })
}

// ===== 模型切换 =====
// 默认使用 DeepSeek（更快）
const selectedModel = ref('deepseek')
const modelList = ref([ 
  { key: 'deepseek', name: 'DeepSeek' },
  { key: 'zhipu', name: '智谱 GLM' },
])

// 加载可用模型列表（暂时禁用）
async function loadModels() {
  return;
}

// 切换模型（暂时禁用）
async function switchModel() {
  return;
}

// ===== 发送消息 =====
async function sendMessage() {
  if (!inputText.value.trim() || isLoading.value) return

  const userMsg = inputText.value
  addMessageToCurrent({ role: 'user', content: userMsg })
  
  const msgs = currentMessages.value
  if (msgs.length === 2 && msgs[0].role === 'assistant') {
    updateSessionTitle(currentSessionId.value, userMsg)
  }

  inputText.value = ''
  scrollToBottom()
  isLoading.value = true

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        messages: currentMessages.value,
        model: selectedModel.value,
      }),
    })

    const data = await response.json()
    console.log('后端返回:', data)

    const assistantMsg = data.reply
    if (assistantMsg) {
      addMessageToCurrent({ role: 'assistant', content: assistantMsg })
    } else {
      addMessageToCurrent({ role: 'assistant', content: '抱歉，我遇到了一点问题，请稍后再试。' })
    }
  } catch (error) {
    console.error('请求失败:', error)
    addMessageToCurrent({ role: 'assistant', content: '网络好像不太稳定，请稍后再试。' })
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

// ===== 可编辑标题 =====
const editingSessionId = ref(null)
const editingTitle = ref('')
const titleInputRef = ref(null)

function startEditTitle(sessionId) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (!session) return
  editingSessionId.value = sessionId
  editingTitle.value = session.title
  nextTick(() => {
    if (titleInputRef.value) {
      titleInputRef.value.focus()
      titleInputRef.value.select()
    }
  })
}

function saveEditTitle(sessionId) {
  if (editingTitle.value.trim()) {
    updateSessionTitle(sessionId, editingTitle.value.trim())
  }
  editingSessionId.value = null
  editingTitle.value = ''
}

function cancelEditTitle() {
  editingSessionId.value = null
  editingTitle.value = ''
}

// ===== 清空对话 =====
function clearChat() {
  if (currentMessages.value.length <= 1) return
  if (confirm('确定要清空当前对话吗？')) {
    const session = sessions.value.find(s => s.id === currentSessionId.value)
    if (session) {
      session.messages = [
        { role: 'assistant', content: '你好！我是AI智能助手，请问有什么可以帮助你的？' }
      ]
      session.title = '新对话'
    }
  }
}

// ===== 复制消息 =====
async function copyMessage(content) {
  try {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = renderMarkdown(content)
    const plainText = tempDiv.textContent || tempDiv.innerText || ''
    await navigator.clipboard.writeText(plainText)
    alert('✅ 已复制到剪贴板')
  } catch (err) {
    console.error('复制失败:', err)
    alert('复制失败，请手动复制')
  }
}

// ===== 导出对话 =====
function exportChat() {
  const messages = currentMessages.value
  if (messages.length <= 1) {
    alert('当前对话为空，无需导出')
    return
  }

  const session = sessions.value.find(s => s.id === currentSessionId.value)
  const title = session?.title || '对话记录'
  
  let md = `# ${title}\n\n`
  md += `> 导出时间：${new Date().toLocaleString()}\n\n---\n\n`
  
  for (const msg of messages) {
    const role = msg.role === 'user' ? '👤 **用户**' : '🤖 **AI 助手**'
    md += `### ${role}\n\n${msg.content}\n\n---\n\n`
  }

  md += `\n\n*由 AI 智能助手导出*`

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ===== 会话管理 =====
function handleNewChat() {
  createNewSession()
  scrollToBottom()
  sidebarOpen.value = false
}

function handleSwitchSession(sessionId) {
  switchSession(sessionId)
  scrollToBottom()
  sidebarOpen.value = false
}

function handleDeleteSession(sessionId) {
  deleteSession(sessionId)
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

// ===== 搜索功能 =====
const searchKeyword = ref('')
const searchResults = ref([])
const isSearching = ref(false)

function handleSearch() {
  const keyword = searchKeyword.value.trim()
  if (!keyword) {
    isSearching.value = false
    searchResults.value = []
    return
  }
  isSearching.value = true
  searchResults.value = searchSessions(keyword)
}

function clearSearch() {
  searchKeyword.value = ''
  isSearching.value = false
  searchResults.value = []
}

function goToSearchResult(sessionId, messageIndex) {
  switchSession(sessionId)
  nextTick(() => {
    scrollToBottom()
    const items = document.querySelectorAll('.message')
    if (items.length > messageIndex && items[messageIndex]) {
      items[messageIndex].scrollIntoView({ behavior: 'smooth', block: 'center' })
      items[messageIndex].classList.add('highlight-flash')
      setTimeout(() => {
        items[messageIndex]?.classList.remove('highlight-flash')
      }, 2000)
    }
  })
  clearSearch()
  sidebarOpen.value = false
}

onMounted(() => {
  loadModels()
  scrollToBottom()
})
</script>

<style scoped>
/* ===== CSS 变量：主题颜色 ===== */
:root {
  --bg-primary: #f7f9fc;
  --bg-sidebar: #ffffff;
  --bg-chat: #ffffff;
  --bg-header: #1a3c6e;
  --text-primary: #333333;
  --text-secondary: #555555;
  --border-color: #e8edf3;
  --bubble-user: #1a3c6e;
  --bubble-user-text: white;
  --bubble-assistant: white;
  --bubble-assistant-text: #333333;
  --input-bg: white;
  --shadow-color: rgba(0,0,0,0.1);
}

.dark-theme {
  --bg-primary: #1a1a2e;
  --bg-sidebar: #16213e;
  --bg-chat: #1a1a2e;
  --bg-header: #0f3460;
  --text-primary: #e0e0e0;
  --text-secondary: #aaaaaa;
  --border-color: #2a2a4a;
  --bubble-user: #0f3460;
  --bubble-user-text: white;
  --bubble-assistant: #2a2a4a;
  --bubble-assistant-text: #e0e0e0;
  --input-bg: #2a2a4a;
  --shadow-color: rgba(0,0,0,0.3);
}

/* ===== 整体布局 ===== */
.app-container {
  display: flex;
  height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  background: var(--bg-primary);
  overflow: hidden;
  color: var(--text-primary);
  transition: background 0.3s, color 0.3s;
}

/* ===== 侧栏 ===== */
.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  transition: background 0.3s, transform 0.3s ease;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.sidebar-search {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  width: 100%;
  box-sizing: border-box;
}
.sidebar-search input {
  width: 100%;
  padding: 8px 14px;
  border: 1px solid var(--border-color);
  border-radius: 20px;
  font-size: 14px;
  outline: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: 0.2s;
  box-sizing: border-box;
}
.sidebar-search input:focus {
  border-color: #1a3c6e;
  box-shadow: 0 0 0 3px rgba(26, 60, 110, 0.1);
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  min-height: 0;
}
.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: background 0.15s;
}
.session-item:hover {
  background: rgba(26, 60, 110, 0.08);
}
.session-item.active {
  background: rgba(26, 60, 110, 0.15);
}

.session-title {
  flex: 1;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

/* 可编辑标题输入框 */
.session-title-input {
  flex: 1;
  font-size: 14px;
  padding: 2px 6px;
  border: 2px solid #1a3c6e;
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
}

.delete-btn {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
}
.delete-btn:hover {
  color: #c0392b;
}

/* ===== 主题切换按钮 ===== */
.theme-toggle {
  background: rgba(255,255,255,0.15);
  border: none;
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 18px;
  transition: background 0.2s;
}
.theme-toggle:hover {
  background: rgba(255,255,255,0.3);
}

/* ===== 聊天主区域 ===== */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-chat);
  transition: background 0.3s;
}

.chat-header {
  display: flex;
  align-items: center;
  background: var(--bg-header);
  color: white;
  padding: 12px 20px;
  gap: 12px;
  transition: background 0.3s;
}
.menu-toggle {
  display: none;
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
}
.chat-header h1 {
  flex: 1;
  font-size: 18px;
  margin: 0;
}
.clear-btn {
  background: rgba(255,255,255,0.15);
  border: none;
  color: white;
  padding: 4px 14px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
}
.clear-btn:hover {
  background: rgba(255,255,255,0.3);
}

.model-select {
  background: rgba(255,255,255,0.15);
  color: white;
  border: 1px solid rgba(255,255,255,0.3);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  outline: none;
}
.model-select option {
  background: #1a3c6e;
  color: white;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.message {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
}
.message.user {
  align-items: flex-end;
}
.message.assistant {
  align-items: flex-start;
}

.bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 16px;
  word-wrap: break-word;
  overflow-wrap: break-word;
  background: var(--bubble-assistant);
  color: var(--bubble-assistant-text);
  box-shadow: 0 1px 3px var(--shadow-color);
  transition: background 0.3s, color 0.3s;
}
.message.user .bubble {
  background: var(--bubble-user);
  color: var(--bubble-user-text);
  border-radius: 16px 16px 4px 16px;
}
.message.assistant .bubble {
  background: var(--bubble-assistant);
  color: var(--bubble-assistant-text);
  border-radius: 16px 16px 16px 4px;
}

.bubble :deep(pre) {
  background: #0d1117;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  color: #e6edf3;
}
.bubble :deep(code) {
  font-family: 'Courier New', monospace;
  font-size: 14px;
}
.bubble :deep(p) {
  margin: 0.5em 0;
}
.bubble :deep(ul), .bubble :deep(ol) {
  padding-left: 1.5em;
}

.bubble-actions {
  margin-top: 4px;
}
.copy-btn {
  background: none;
  border: none;
  color: #8a9aa8;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
}
.copy-btn:hover {
  background: #f0f4fa;
  color: #1a3c6e;
}

.typing span {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
  margin-right: 4px;
  animation: blink 1.4s infinite both;
}
.typing span:nth-child(2) { animation-delay: 0.2s; }
.typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink {
  0% { opacity: 0.2; transform: scale(0.8); }
  20% { opacity: 1; transform: scale(1); }
  100% { opacity: 0.2; transform: scale(0.8); }
}

.chat-input {
  display: flex;
  padding: 12px;
  background: var(--bg-chat);
  border-top: 1px solid var(--border-color);
  gap: 10px;
  transition: background 0.3s;
}
.chat-input input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid var(--border-color);
  border-radius: 30px;
  outline: none;
  font-size: 15px;
  background: var(--input-bg);
  color: var(--text-primary);
  transition: background 0.3s, color 0.3s;
}
.chat-input button {
  background: #1a3c6e;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 30px;
  cursor: pointer;
  font-weight: 500;
}
.chat-input button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ===== 高亮闪烁 ===== */
.highlight-flash {
  animation: flashHighlight 2s ease;
}
@keyframes flashHighlight {
  0% { background-color: rgba(255, 235, 59, 0.4); }
  50% { background-color: rgba(255, 235, 59, 0.8); }
  100% { background-color: transparent; }
}
.bubble :deep(mark) {
  background: #ffeb3b;
  padding: 0 2px;
  border-radius: 2px;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(-100%);
    width: 280px;
    box-shadow: 2px 0 12px var(--shadow-color);
  }
  .sidebar-open {
    transform: translateX(0);
  }
  .menu-toggle {
    display: block;
  }
  .model-select {
    background: rgba(255,255,255,0.15);
    color: white;
    border: 1px solid rgba(255,255,255,0.3);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 14px;
    cursor: pointer;
    outline: none;
  }
  .model-select option {
    background: #1a3c6e;
    color: white;
  }
}
</style>