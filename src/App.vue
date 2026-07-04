<template>
  <div class="app-container" :class="themeClass">
    <!-- 侧边栏 -->
    <div class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
      <div class="sidebar-header">
        <h3>💡 智言</h3>
        <button class="new-chat-btn" @click="handleNewChat">＋ 新对话</button>
      </div>

      <div class="sidebar-search">
        <input 
          type="text" 
          v-model="searchKeyword" 
          placeholder="🔍 搜索对话..." 
          @input="handleSearch"
          @keyup.esc="clearSearch"
        />
      </div>

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
            <span 
              v-if="editingSessionId !== session.id"
              class="session-title"
              @dblclick.stop="startEditTitle(session.id)"
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

    <!-- 主聊天区域 -->
    <div class="chat-main" :class="{ 'chat-shifted': sidebarOpen }">
      <div class="chat-header">
        <button class="menu-toggle" @click="toggleSidebar">☰</button>
        <h1 class="chat-title">{{ currentSessionTitle }}</h1>
        
        <select v-model="selectedModel" @change="switchModel" class="model-select">
          <option v-for="m in modelList" :key="m.key" :value="m.key">
            {{ m.name }}
          </option>
        </select>

        <button class="theme-toggle" @click="toggleTheme">
          {{ theme === 'dark' ? '🌙' : '☀️' }}
        </button>

        <button class="clear-btn" @click="clearChat">清空</button>
        <button class="clear-btn" @click="exportChat">导出</button>
        <button class="clear-btn" @click="shareChat">分享</button>
      </div>

      <div class="chat-messages" ref="messageContainer">
        <div v-for="(msg, index) in currentMessages" :key="index" 
             :class="['message', msg.role === 'user' ? 'user' : 'assistant']">
          <div class="bubble" v-html="renderMarkdown(msg.content)"></div>
          <div v-if="msg.role === 'assistant'" class="bubble-actions">
            <button class="copy-btn" @click="copyMessage(msg.content)">复制</button>
          </div>
        </div>
        <div v-if="isLoading" class="message assistant">
          <div class="bubble typing">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
        <div v-if="typingMessage" class="message assistant">
          <div class="bubble" v-html="renderMarkdown(typingMessage)"></div>
        </div>
      </div>

      <div class="chat-input">
        <textarea 
          v-model="inputText" 
          placeholder="输入消息... (Shift+Enter 换行)" 
          @keydown="handleKeydown"
          :disabled="isLoading"
          rows="1"
          class="chat-textarea"
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

const inputText = ref('')
const isLoading = ref(false)
const messageContainer = ref(null)
const sidebarOpen = ref(false)
const currentMessages = computed(() => getCurrentMessages())

// ===== 打字机效果 =====
const typingMessage = ref('')
const isTyping = ref(false)
let typingTimer = null

function typeMessage(content, callback) {
  if (!content) return
  isTyping.value = true
  typingMessage.value = ''
  let index = 0
  const speed = 30
  
  function typeChar() {
    if (index < content.length) {
      typingMessage.value += content[index]
      index++
      scrollToBottom()
      typingTimer = setTimeout(typeChar, speed)
    } else {
      isTyping.value = false
      if (callback) callback()
    }
  }
  typeChar()
}

// ===== 当前会话标题 =====
const currentSessionTitle = computed(() => {
  const session = sessions.value.find(s => s.id === currentSessionId.value)
  return session?.title || '新对话'
})

// ===== 主题切换 =====
const theme = ref(localStorage.getItem('theme') || 'light')
const themeClass = computed(() => theme.value === 'dark' ? 'dark-theme' : '')

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('theme', theme.value)
}

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
const selectedModel = ref('deepseek')
const modelList = ref([ 
  { key: 'deepseek', name: 'DeepSeek' },
  { key: 'zhipu', name: '智谱 GLM' },
])

async function loadModels() { return; }
async function switchModel() { return; }

// ===== 发送消息 =====
async function sendMessage() {
  if (!inputText.value.trim() || isLoading.value || isTyping.value) return

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
    const assistantMsg = data.reply
    
    if (assistantMsg) {
      typeMessage(assistantMsg, () => {
        addMessageToCurrent({ role: 'assistant', content: assistantMsg })
        typingMessage.value = ''
      })
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

// ===== Enter发送 + Shift换行 =====
function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
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

// ===== 清空 =====
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

// ===== 复制 =====
async function copyMessage(content) {
  try {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = renderMarkdown(content)
    const plainText = tempDiv.textContent || tempDiv.innerText || ''
    await navigator.clipboard.writeText(plainText)
    alert('已复制到剪贴板')
  } catch (err) {
    console.error('复制失败:', err)
    alert('复制失败，请手动复制')
  }
}

// ===== 导出 =====
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

// ===== 对话分享 =====
function shareChat() {
  const messages = currentMessages.value
  if (messages.length <= 1) {
    alert('当前对话为空，无需分享')
    return
  }

  const session = sessions.value.find(s => s.id === currentSessionId.value)
  const title = session?.title || '对话记录'
  
  let text = `💡 智言 · ${title}\n\n`
  for (const msg of messages) {
    const role = msg.role === 'user' ? '👤 用户' : '🤖 AI'
    text += `${role}：${msg.content}\n\n`
  }
  text += `\n---\n由 智言 AI 助手生成`

  if (navigator.share) {
    navigator.share({ title: title, text: text }).catch(() => {})
  } else {
    navigator.clipboard.writeText(text).then(() => {
      alert('对话已复制到剪贴板，可粘贴分享')
    }).catch(() => {
      alert('复制失败，请手动复制')
    })
  }
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
}

function handleDeleteSession(sessionId) {
  deleteSession(sessionId)
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

// ===== 搜索 =====
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
}

onMounted(() => {
  loadModels()
  scrollToBottom()
})
</script>

<style scoped>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  transition: background 0.3s;
}

/* ===== 白天模式 ===== */
.app-container:not(.dark-theme) {
  background: #faf7f5;
  color: #3d2a2a;
}
.app-container:not(.dark-theme) .chat-header {
  background: #e8d5d5;
  color: #3d2a2a;
}
.app-container:not(.dark-theme) .sidebar {
  background: #f5e8e8;
  border-right: 2px solid #dcc8c8;
}
.app-container:not(.dark-theme) .chat-input {
  background: #faf0f0;
  border-top: 1px solid #dcc8c8;
}
.app-container:not(.dark-theme) .chat-input textarea {
  background: white;
  border: 1px solid #dcc8c8;
  color: #3d2a2a;
}
.app-container:not(.dark-theme) .bubble.user {
  background: #d4b5b5;
  color: #3d2a2a;
}
.app-container:not(.dark-theme) .bubble.assistant {
  background: white;
  color: #3d2a2a;
}
.app-container:not(.dark-theme) .chat-messages {
  background: #faf7f5;
}

/* ===== 黑夜模式 ===== */
.dark-theme {
  background: #1a1f24;
  color: #dde4e8;
}
.dark-theme .chat-header {
  background: #2d3a42;
  color: #dde4e8;
}
.dark-theme .sidebar {
  background: #24303a;
  border-right: 2px solid #3a4a55;
}
.dark-theme .chat-input {
  background: #24303a;
  border-top: 1px solid #3a4a55;
}
.dark-theme .chat-input textarea {
  background: #1a242e;
  border: 1px solid #3a4a55;
  color: #dde4e8;
}
.dark-theme .bubble.user {
  background: #3a5668;
  color: #eef4f8;
}
.dark-theme .bubble.assistant {
  background: #2a3845;
  color: #dde4e8;
}
.dark-theme .chat-messages {
  background: #0d1216;
}

/* ===== 侧边栏 ===== */
.sidebar {
  width: 280px;
  min-width: 280px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  margin-left: -280px;
}
.sidebar-open {
  margin-left: 0;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100vh;
}

.sidebar-header {
  padding: 18px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  border-bottom: 2px solid #dcc8c8;
}
.dark-theme .sidebar-header {
  border-bottom: 2px solid #3a4a55;
}
.sidebar-header h3 {
  font-size: 18px;
  font-weight: 600;
}
.new-chat-btn {
  background: rgba(0,0,0,0.08);
  border: none;
  padding: 6px 16px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
}
.dark-theme .new-chat-btn {
  background: rgba(255,255,255,0.08);
}

.sidebar-search {
  padding: 12px 16px;
  flex-shrink: 0;
}
.sidebar-search input {
  width: 100%;
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 14px;
  outline: none;
  border: 1px solid #dcc8c8;
  background: white;
}
.dark-theme .sidebar-search input {
  border: 1px solid #3a4a55;
  background: #1a242e;
  color: #dde4e8;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}
.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
  margin-bottom: 4px;
}
.session-item:hover {
  background: rgba(0,0,0,0.04);
}
.dark-theme .session-item:hover {
  background: rgba(255,255,255,0.04);
}
.session-item.active {
  background: rgba(0,0,0,0.08);
}
.dark-theme .session-item.active {
  background: rgba(255,255,255,0.06);
}
.session-title {
  flex: 1;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-title-input {
  flex: 1;
  font-size: 14px;
  padding: 2px 8px;
  border: 2px solid #8a9aa8;
  border-radius: 6px;
  background: transparent;
  outline: none;
}
.delete-btn {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 14px;
  padding: 0 6px;
}
.delete-btn:hover {
  color: #c0392b;
}

/* ===== 聊天主区域 ===== */
.chat-header {
  display: flex;
  align-items: center;
  padding: 12px 24px;
  gap: 12px;
  flex-shrink: 0;
}
.menu-toggle {
  background: rgba(0,0,0,0.06);
  border: none;
  font-size: 22px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 8px;
  color: inherit;
}
.dark-theme .menu-toggle {
  background: rgba(255,255,255,0.06);
}
.chat-title {
  flex: 1;
  font-size: 20px;
  margin: 0;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.model-select {
  background: rgba(0,0,0,0.06);
  border: 1px solid rgba(0,0,0,0.08);
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  outline: none;
  color: inherit;
}
.dark-theme .model-select {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.08);
}
.theme-toggle {
  background: rgba(0,0,0,0.06);
  border: none;
  padding: 4px 12px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 18px;
}
.dark-theme .theme-toggle {
  background: rgba(255,255,255,0.06);
}
.clear-btn {
  background: rgba(0,0,0,0.06);
  border: none;
  padding: 4px 14px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  color: inherit;
}
.dark-theme .clear-btn {
  background: rgba(255,255,255,0.06);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}
.message {
  margin-bottom: 14px;
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
  max-width: 75%;
  padding: 12px 18px;
  border-radius: 18px;
  word-wrap: break-word;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.message.user .bubble {
  border-radius: 18px 18px 4px 18px;
}
.message.assistant .bubble {
  border-radius: 18px 18px 18px 4px;
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
.bubble :deep(p) { margin: 0.5em 0; }
.bubble :deep(ul), .bubble :deep(ol) { padding-left: 1.5em; }

.bubble-actions { margin-top: 4px; }
.copy-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
}

.typing .dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #999;
  margin-right: 6px;
  animation: typingBounce 1.4s infinite both;
}
.typing .dot:nth-child(2) { animation-delay: 0.2s; }
.typing .dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typingBounce {
  0%, 60%, 100% { opacity: 0.2; transform: scale(0.8); }
  30% { opacity: 1; transform: scale(1.2); }
}

.chat-input {
  display: flex;
  padding: 14px 20px;
  gap: 12px;
  flex-shrink: 0;
  border-top: 1px solid #dcc8c8;
}
.dark-theme .chat-input {
  border-top: 1px solid #3a4a55;
}
.chat-textarea {
  flex: 1;
  padding: 12px 20px;
  border-radius: 30px;
  outline: none;
  font-size: 15px;
  font-family: inherit;
  resize: none;
  min-height: 48px;
  max-height: 150px;
  line-height: 1.5;
  border: 1px solid #dcc8c8;
}
.dark-theme .chat-textarea {
  border: 1px solid #3a4a55;
}
.chat-textarea:focus {
  border-color: #8a9aa8;
}
.chat-input button {
  background: rgba(0,0,0,0.08);
  border: none;
  padding: 12px 28px;
  border-radius: 30px;
  cursor: pointer;
  font-weight: 500;
  font-size: 15px;
  color: inherit;
}
.dark-theme .chat-input button {
  background: rgba(255,255,255,0.06);
}
.chat-input button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.highlight-flash {
  animation: flashHighlight 2s ease;
}
@keyframes flashHighlight {
  0% { background-color: rgba(200, 170, 170, 0.3); }
  50% { background-color: rgba(200, 170, 170, 0.6); }
  100% { background-color: transparent; }
}

@media (max-width: 768px) {
  .sidebar {
    width: 50vw;
    min-width: 50vw;
    margin-left: -50vw;
  }
  .sidebar-open {
    margin-left: 0;
  }
  .chat-header {
    padding: 10px 14px;
    gap: 6px;
    flex-wrap: wrap;
  }
  .chat-title {
    font-size: 16px;
  }
  .model-select {
    font-size: 12px;
    padding: 2px 10px;
  }
  .clear-btn {
    font-size: 11px;
    padding: 3px 10px;
  }
  .chat-messages {
    padding: 12px 14px;
  }
  .bubble {
    max-width: 85%;
    padding: 10px 14px;
  }
  .chat-input {
    padding: 10px 14px;
    gap: 8px;
  }
  .chat-textarea {
    font-size: 14px;
    padding: 10px 16px;
    min-height: 40px;
  }
  .chat-input button {
    padding: 10px 18px;
    font-size: 14px;
  }
}
</style>