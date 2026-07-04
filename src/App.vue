<template>
  <div class="app-container">

    <!-- 遮罩层 -->
    <div
      v-if="sidebarOpen"
      class="sidebar-mask"
      @click="sidebarOpen = false"
    ></div>

    <!-- Sidebar -->
    <div class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <h2>💬 对话</h2>
        <button @click="createNewSession">+ 新对话</button>
      </div>

      <input
        class="search"
        placeholder="搜索对话..."
        v-model="searchText"
      />

      <div
        v-for="s in sessions"
        :key="s.id"
        class="session-item"
        :class="{ active: s.id === currentSessionId }"
        @click="switchSession(s.id)"
      >
        {{ s.title }}
      </div>
    </div>

    <!-- Main -->
    <div class="chat-main" :class="{ 'chat-shifted': sidebarOpen }">

      <!-- Header -->
      <div class="chat-header">

        <button class="menu-toggle" @click="toggleSidebar">☰</button>

        <h1 class="chat-title">{{ currentSessionTitle }}</h1>

        <div class="header-actions">
          <select v-model="selectedModel" @change="switchModel">
            <option v-for="m in modelList" :key="m.key" :value="m.key">
              {{ m.name }}
            </option>
          </select>

          <button @click="toggleTheme">
            {{ theme === 'dark' ? '🌙' : '☀️' }}
          </button>

          <button @click="clearChat">🗑</button>
          <button @click="exportChat">📤</button>
        </div>
      </div>

      <!-- Messages -->
      <div class="chat-body">
        <div
          v-for="msg in getCurrentMessages()"
          :key="msg.id"
          :class="['message-row', msg.role]"
        >
          <div class="message-bubble">
            <div class="markdown-body" v-html="renderMarkdown(msg.content)"></div>

            <div class="msg-actions">
              <span @click="copy(msg.content)">📋 复制</span>
            </div>
          </div>
        </div>

        <div v-if="isLoading" class="message-row assistant">
          <div class="bubble typing">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="chat-input">
        <textarea
          v-model="inputText"
          placeholder="输入消息..."
          @keydown.enter.exact.prevent="sendMessage"
        ></textarea>

        <button @click="sendMessage">发送</button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

import {
  sessions,
  currentSessionId,
  getCurrentMessages,
  addMessageToCurrent,
  createNewSession,
  deleteSession,
  switchSession,
  updateSessionTitle,
  searchSessions
} from './stores/useChatStore'

/* =====================
   Step 3 Sidebar
===================== */
const sidebarOpen = ref(false)
const searchText = ref('')

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

/* =====================
   Markdown
===================== */
const renderer = new marked.Renderer()

renderer.code = (code, language) => {
  const validLang = hljs.getLanguage(language) ? language : 'plaintext'
  const highlighted = hljs.highlight(code, { language: validLang }).value

  return `
    <pre class="code-block">
      <div class="code-header">${validLang}</div>
      <code class="hljs ${validLang}">${highlighted}</code>
    </pre>
  `
}

marked.setOptions({
  renderer,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  },
  breaks: true,
  gfm: true
})

function renderMarkdown(text) {
  return marked.parse(text || '')
}

/* =====================
   Input
===================== */
const inputText = ref('')
const isLoading = ref(false)

function sendMessage() {
  if (!inputText.value.trim()) return

  addMessageToCurrent({
    id: Date.now(),
    role: 'user',
    content: inputText.value
  })

  inputText.value = ''
  isLoading.value = true

  setTimeout(() => {
    addMessageToCurrent({
      id: Date.now() + 1,
      role: 'assistant',
      content: '抱歉，我遇到了一点问题，请稍后再试。'
    })

    isLoading.value = false
  }, 800)
}

/* =====================
   Actions
===================== */
function copy(text) {
  navigator.clipboard.writeText(text)
}

function clearChat() {
  deleteSession(currentSessionId.value)
}

function exportChat() {
  const data = JSON.stringify(getCurrentMessages())
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = 'chat.json'
  a.click()
}
</script>

<style scoped>

/* Layout */
.app-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 260px;
  background: #1f2937;
  color: white;
  transform: translateX(-100%);
  transition: 0.25s;
  z-index: 1000;
  padding: 12px;
}

.sidebar.open {
  transform: translateX(0);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search {
  width: 100%;
  margin: 10px 0;
  padding: 6px;
}

/* Mask */
.sidebar-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  z-index: 999;
}

/* Main */
.chat-main {
  flex: 1;
  margin-left: 0;
  display: flex;
  flex-direction: column;
  transition: 0.25s;
}

.chat-shifted {
  margin-left: 260px;
}

/* Header */
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.menu-toggle {
  font-size: 18px;
  background: none;
  border: none;
}

/* Messages */
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.message-row {
  display: flex;
  margin-bottom: 10px;
}

.message-row.user {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 70%;
  padding: 10px;
  border-radius: 10px;
  background: #f3f4f6;
}

.message-row.user .message-bubble {
  background: #3b82f6;
  color: white;
}

/* Input */
.chat-input {
  display: flex;
  padding: 10px;
  border-top: 1px solid #eee;
}

.chat-input textarea {
  flex: 1;
  padding: 8px;
}

.chat-input button {
  margin-left: 10px;
}

/* Code */
.code-block {
  background: #0d1117;
  color: white;
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
}

.code-header {
  font-size: 12px;
  opacity: 0.6;
  margin-bottom: 6px;
}

/* typing */
.typing span {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 4px;
  background: #999;
  border-radius: 50%;
  animation: blink 1s infinite;
}

@keyframes blink {
  0% { opacity: .2; }
  50% { opacity: 1; }
  100% { opacity: .2; }
}
</style>