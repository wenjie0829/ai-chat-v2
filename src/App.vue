<template>
  <div class="app">
    <!-- 侧边栏 -->
    <div :class="['sidebar', { collapsed }]">
      <div class="logo">
        <span v-if="!collapsed">💬 对话</span>
        <span v-else>💬</span>

        <button class="collapse-btn" @click="collapsed = !collapsed">
          {{ collapsed ? '›' : '‹' }}
        </button>
      </div>

      <button class="new-chat">+ 新对话</button>

      <div class="chat-list">
        <div
          v-for="(c, i) in chats"
          :key="i"
          class="chat-item"
          :class="{ active: i === activeChat }"
          @click="activeChat = i"
        >
          <span v-if="!collapsed">{{ c }}</span>
          <span v-else>💬</span>
        </div>
      </div>
    </div>

    <!-- 主体 -->
    <div class="main">
      <!-- 顶部栏 -->
      <div class="topbar">
        <div class="model">🤖 智言</div>

        <div class="actions">
          <button>🌙</button>
          <button>🗑</button>
          <button>⬇</button>
        </div>
      </div>

      <!-- 对话区域 -->
      <div class="chat-box">
        <div
          v-for="(msg, i) in messages"
          :key="i"
          :class="['msg', msg.role]"
        >
          <div class="bubble">{{ msg.text }}</div>
        </div>
      </div>

      <!-- 输入框 -->
      <div class="input-area">
        <input
          v-model="input"
          placeholder="输入消息..."
          @keydown.enter="send"
        />
        <button @click="send">发送</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const collapsed = ref(false)

const chats = ref(['新对话 1', '新对话 2'])
const activeChat = ref(0)

const messages = ref([
  { role: 'ai', text: '你好，我是AI助手 👋' }
])

const input = ref('')

const send = () => {
  if (!input.value.trim()) return

  messages.value.push({
    role: 'user',
    text: input.value
  })

  setTimeout(() => {
    messages.value.push({
      role: 'ai',
      text: '（这里接你的AI接口返回）'
    })
  }, 500)

  input.value = ''
}
</script>

<style scoped>
/* ===== 整体布局 ===== */
.app {
  display: flex;
  height: 100vh;
  background: #0f172a;
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI";
}

/* ===== 侧边栏 ===== */
.sidebar {
  width: 260px;
  background: #111827;
  padding: 12px;
  transition: 0.3s;
  display: flex;
  flex-direction: column;
}

.sidebar.collapsed {
  width: 70px;
}

.logo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  margin-bottom: 10px;
}

.collapse-btn {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
}

.new-chat {
  margin: 10px 0;
  padding: 8px;
  border-radius: 8px;
  border: none;
  background: #2563eb;
  color: white;
  cursor: pointer;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
}

.chat-item {
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 6px;
  background: rgba(255,255,255,0.05);
}

.chat-item.active {
  background: #2563eb;
}

/* ===== 主体 ===== */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* ===== 顶部栏 ===== */
.topbar {
  height: 50px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 15px;
  background: rgba(17,24,39,0.7);
  backdrop-filter: blur(10px);
}

/* ===== 聊天 ===== */
.chat-box {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.msg {
  display: flex;
  margin-bottom: 10px;
}

.msg.user {
  justify-content: flex-end;
}

.bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 14px;
  background: #1f2937;
}

.msg.user .bubble {
  background: #2563eb;
}

/* ===== 输入框 ===== */
.input-area {
  display: flex;
  padding: 10px;
  background: #111827;
  gap: 10px;
}

input {
  flex: 1;
  padding: 10px;
  border-radius: 10px;
  border: none;
  outline: none;
}

button {
  padding: 10px 14px;
  border-radius: 10px;
  border: none;
  background: #2563eb;
  color: white;
  cursor: pointer;
}

/* ===== 手机适配 ===== */
@media (max-width: 768px) {
  .sidebar {
    position: absolute;
    z-index: 10;
    height: 100%;
  }

  .main {
    margin-left: 0;
  }

  .bubble {
    max-width: 85%;
  }
}
</style>