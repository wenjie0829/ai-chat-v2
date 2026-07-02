<template>
  <div class="app-container">
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
            <span class="session-title">{{ session.title }}</span>
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
        <select v-model="selectedModel" @change="switchModel" class="model-select">
        <option v-for="m in modelList" :key="m.key" :value="m.key">
        {{ m.name }}
          </option>
        </select>
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

const inputText = ref('')
const isLoading = ref(false)
const messageContainer = ref(null)
const sidebarOpen = ref(false)

const currentMessages = computed(() => getCurrentMessages())

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
const modelList = ref([])

// 加载可用模型列表
async function loadModels() {
  try {
    const res = await fetch('http://localhost:3000/api/models')
    const data = await res.json()
    modelList.value = data.models
    selectedModel.value = data.current
  } catch (e) {
    console.error('加载模型列表失败:', e)
  }
}

// 切换模型
async function switchModel() {
  try {
    const res = await fetch('http://localhost:3000/api/models/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel.value }),
    })
    const data = await res.json()
    if (data.success) {
      // 切换成功后，清空当前会话并显示提示
      const session = sessions.value.find(s => s.id === currentSessionId.value)
      if (session) {
        session.messages = [
          { role: 'assistant', content: `已切换到 ${modelList.value.find(m => m.key === selectedModel.value)?.name}，欢迎继续提问！` }
        ]
      }
      scrollToBottom()
    }
  } catch (e) {
    console.error('切换模型失败:', e)
  }
}

// 修改 sendMessage，把模型信息传给后端
// 在 fetch 的 body 里增加 model: selectedModel.value

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
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: currentMessages.value }),
      model: selectedModel.value, 
    })

    const data = await response.json()
    if (data.reply) {
      addMessageToCurrent({ role: 'assistant', content: data.reply })
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
/* ===== 整体布局 ===== */
.app-container {
  display: flex;
  height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  background: #f7f9fc;
  overflow: hidden;
}

/* ===== 侧栏 ===== */
.sidebar {
  width: 260px;
  background: #ffffff;
  border-right: 1px solid #e8edf3;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}
.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e8edf3;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sidebar-header h3 {
  margin: 0;
  color: #1a3c6e;
  font-size: 16px;
}
.new-chat-btn {
  background: #1a3c6e;
  color: white;
  border: none;
  padding: 4px 14px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
}
.sidebar-search {
  padding: 10px 12px;
  border-bottom: 1px solid #e8edf3;
}
.sidebar-search input {
  width: 100%;
  padding: 8px 14px;
  border: 1px solid #d0d9e6;
  border-radius: 20px;
  font-size: 14px;
  outline: none;
  background: #f7f9fc;
  transition: 0.2s;
}
.sidebar-search input:focus {
  border-color: #1a3c6e;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(26, 60, 110, 0.1);
}
.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
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
  background: #f0f4fa;
}
.session-item.active {
  background: #e3edf7;
}
.session-title {
  flex: 1;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.search-result {
  flex-direction: column;
  align-items: stretch !important;
  padding: 8px 14px !important;
}
.result-title {
  font-weight: 500;
  font-size: 14px;
}
.result-count {
  font-size: 12px;
  color: #8a9aa8;
}
.no-result {
  text-align: center;
  color: #8a9aa8;
  padding: 30px 0;
  font-size: 14px;
}

/* ===== 聊天主区域 ===== */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.chat-header {
  display: flex;
  align-items: center;
  background: #1a3c6e;
  color: white;
  padding: 12px 20px;
  gap: 12px;
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
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  word-wrap: break-word;
  overflow-wrap: break-word;
}
.message.user .bubble {
  background: #1a3c6e;
  color: white;
  border-radius: 16px 16px 4px 16px;
}
.message.assistant .bubble {
  background: white;
  color: #333;
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
  background: white;
  border-top: 1px solid #e8edf3;
  gap: 10px;
}
.chat-input input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #d0d9e6;
  border-radius: 30px;
  outline: none;
  font-size: 15px;
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
    box-shadow: 2px 0 12px rgba(0,0,0,0.1);
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