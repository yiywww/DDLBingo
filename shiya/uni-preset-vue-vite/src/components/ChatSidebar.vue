<template>
  <view class="fixed inset-0 z-[90] flex">
    <!-- 会话列表面板（左侧滑出） -->
    <view v-if="showConvList" class="conv-list-panel">
      <view class="conv-list-header">
        <text class="conv-list-title">对话历史</text>
        <view class="conv-list-close" @click="$emit('toggleConvList')">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </view>
      </view>
      <ConversationList
        :activeId="activeSessionId"
        @select="handleSelectConversation"
        @newChat="handleNewChat"
        @refresh="$emit('refreshSessions')"
        ref="convListRef"
      />
    </view>

    <!-- 遮罩 -->
    <view 
      class="fixed inset-0 bg-black/20 backdrop-blur-sm"
      @click="handleOverlayClick"
    />
    <view class="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[100] flex flex-col">
      <view class="p-6 border-b border-black/5 flex items-center justify-between">
        <view class="flex items-center gap-3">
          <view class="w-10 h-10 bg-background rounded-full flex items-center justify-center z-10">
            <view class="w-6 h-6 bg-[#1a1a1a] rounded-full flex items-center justify-center text-white font-bold text-xl">拾</view>
          </view>
          <view>
            <view class="font-semibold text-sm">拾鸦助手</view>
            <view class="text-[10px] text-emerald-500 flex items-center gap-1">
              <view class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              在线
            </view>
          </view>
        </view>
        <view class="flex items-center gap-2">
          <view @click="toggleConvList" class="p-2 hover:bg-black/5 rounded-full relative" title="对话列表">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
          </view>
          <view @click="clearChatHistory" class="p-2 hover:bg-black/5 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c1 0-2-1-2-2V6"/><path d="M8 6V4c0 1-1 2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </view>
          <view @click="closeChat" class="p-2 hover:bg-black/5 rounded-full">
            <X :size="20" />
          </view>
        </view>
      </view>

      <view class="absolute top-20 right-4 flex flex-col gap-2 z-10">
        <view 
          @tap="scrollToTop" 
          class="w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-all cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
        </view>
        <view 
          @tap="scrollToBottom" 
          class="w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-all cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </view>
      </view>
      
      <view class="flex-1 overflow-y-auto p-6 space-y-4 chat-container" ref="chatContainerRef" @scroll="handleChatScroll">
        
        <view v-for="(msg, i) in messages" :key="i" class="flex flex-col" :class="msg.role === 'user' ? 'items-end' : 'items-start'">
          <view v-if="msg.role === 'model' && msg.thinkingSteps && msg.thinkingSteps.length > 0" class="max-w-[90%] mb-2">
            <ThinkingPanel :steps="msg.thinkingSteps" :isActive="false" />
          </view>
          
          <view class="flex" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
            <view class="max-w-[80%] p-3 rounded-2xl text-sm" :class="msg.role === 'user' ? 'bg-[#1a1a1a] text-white rounded-tr-none' : 'bg-background text-gray-800 rounded-tl-none'">
              <text v-if="msg.text">{{ msg.text }}</text>
              <image v-if="msg.image" :src="msg.image" class="w-full h-auto rounded-lg mt-2" />
              <view v-if="msg.images && msg.images.length > 0" class="mt-2 space-y-2">
                <image v-for="(img, index) in msg.images" :key="index" :src="img" class="w-full h-auto rounded-lg" />
              </view>
            </view>
          </view>
        </view>
        
        <view v-if="isTyping" class="flex justify-start w-full">
          <view class="max-w-[90%]">
            <ThinkingPanel :steps="thinkingSteps" :isActive="true" />
            <view v-if="thinkingSteps.length === 0" class="bg-background p-3 rounded-2xl rounded-tl-none flex gap-2 items-center">
              <view class="flex gap-1">
                <view class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                <view class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <view class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </view>
              <text class="text-xs text-gray-400">拾鸦正在思考...</text>
            </view>
          </view>
        </view>
        <view ref="chatEndRef" />
      </view>

      <view class="p-6 border-t border-black/5">
        <view v-if="needsConfirmation" class="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <view class="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            需要你的确认
          </view>
          <view class="flex flex-wrap gap-2">
            <button 
              v-for="option in confirmOptions" 
              :key="option.tool"
              @click="handleConfirm(option.tool)"
              class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-[#4a4a35] transition-all shadow-sm active:scale-95"
            >
              {{ option.label }}
            </button>
            <button 
              @click="handleCancelConfirmation"
              class="px-4 py-2 bg-white border border-border text-[#5a5a40] text-sm font-medium rounded-xl hover:bg-surface transition-all shadow-sm active:scale-95"
            >
              取消
            </button>
          </view>
        </view>
        
        <view v-if="uploadedImages.length > 0" class="mb-4 flex flex-wrap gap-2">
          <view v-for="(image, index) in uploadedImages" :key="index" class="relative w-24 h-24">
            <image :src="image" class="w-full h-full object-cover rounded-lg" />
            <view 
              @click="removeImage(index)"
              class="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white cursor-pointer"
            >
              <X :size="16" />
            </view>
          </view>
        </view>
        
        <!-- 确认操作卡片 -->
        <view v-if="pendingConfirm" class="mx-4 mb-3 p-4 rounded-2xl border-2"
          :class="pendingConfirm.action === 'delete' ? 'bg-red-50 border-red-300' : 'bg-yellow-50 border-yellow-300'">
          <view class="flex items-start gap-3">
            <text class="text-lg">
              {{ pendingConfirm.action === 'delete' ? '🗑️' : '✏️' }}
            </text>
            <view class="flex-1">
              <text class="font-bold text-sm block mb-1">
                {{ pendingConfirm.action === 'delete' ? '确认删除' : '确认修改' }}
              </text>
              <text class="text-xs text-gray-600 block mb-3">{{ pendingConfirm.detail }}</text>
              <view class="flex gap-2">
                <button
                  @click="handleConfirmAction"
                  class="px-4 py-2 rounded-xl text-xs font-bold text-white"
                  :class="pendingConfirm.action === 'delete' ? 'bg-red-500' : 'bg-yellow-500'"
                >
                  {{ pendingConfirm.action === 'delete' ? '确认删除' : '确认修改' }}
                </button>
                <button
                  @click="handleCancelConfirm"
                  class="px-4 py-2 bg-gray-200 rounded-xl text-xs text-gray-600"
                >
                  取消
                </button>
              </view>
            </view>
          </view>
        </view>

        <view class="relative">
          <textarea 
            v-model="chatInput"
            @confirm="handleSendMessage"
            @paste="handlePaste"
            placeholder="嘎？想聊点什么..."
            style="width:100%;min-height:72rpx;max-height:144rpx;background:#f5f5f0;border-radius:24rpx;padding:20rpx 120rpx 20rpx 48rpx;font-size:28rpx;outline:none;resize:none;"
          />
          <input
            type="file"
            ref="imageInput"
            accept="image/*"
            @change="handleImageUpload"
            style="display:none;"
          />
          <view 
            @click="triggerImageUpload"
            style="position:absolute;right:96rpx;top:50%;transform:translateY(-50%);padding:16rpx;transition:opacity 0.2s;cursor:pointer;z-index:10;"
          >
            <ImageIcon :size="32" />
          </view>
          <view 
            @click="handleSendMessage"
            style="position:absolute;right:16rpx;top:50%;transform:translateY(-50%);padding:16rpx;background:#1a1a1a;border-radius:16rpx;transition:opacity 0.2s;"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { X, Image as ImageIcon } from 'lucide-vue-next';
import ConversationList from './ConversationList.vue';
import ThinkingPanel from './ThinkingPanel.vue';

const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  isTyping: {
    type: Boolean,
    default: false
  },
  thinkingSteps: {
    type: Array,
    default: () => []
  },
  needsConfirmation: {
    type: Boolean,
    default: false
  },
  confirmOptions: {
    type: Array,
    default: () => []
  },
  activeSessionId: {
    type: String,
    default: ''
  },
  showConvList: {
    type: Boolean,
    default: false
  },
  pendingConfirm: {
    type: Object,
    default: null
  }
});

const emit = defineEmits([
  'update:messages',
  'sendMessage',
  'clearChatHistory',
  'confirm',
  'cancelConfirmation',
  'scrollToBottom',
  'scrollToTop',
  'closeChat',
  'newChat',
  'switchConversation',
  'toggleConvList',
  'refreshSessions',
  'confirmAction',
  'cancelAction'
]);

const chatInput = ref('');
const uploadedImages = ref([]);
const chatEndRef = ref(null);
const chatContainerRef = ref(null);
const imageInput = ref(null);
const showScrollButtons = ref(false);

const convListRef = ref(null);

// Agent 确认/取消操作（直连 API，不走聊天流程）
const handleConfirmAction = () => {
  if (props.pendingConfirm) {
    // CRUD 确认：通过 API 直接执行，不再走聊天 SSE 流程
    emit('confirmAction');
  } else {
    // 旧工具确认流程
    emit('confirm');
    chatInput.value = '';
    emit('sendMessage', { text: '确认', images: [] });
  }
};

const handleCancelConfirm = () => {
  if (props.pendingConfirm) {
    // CRUD 取消：通过 API 直接取消
    emit('cancelAction');
  } else {
    emit('cancelConfirmation');
    chatInput.value = '';
    emit('sendMessage', { text: '取消', images: [] });
  }
};

const closeChat = () => {
  emit('closeChat');
};

const toggleConvList = () => {
  emit('toggleConvList');
};

const handleSelectConversation = (conv) => {
  emit('switchConversation', conv);
  emit('toggleConvList'); // 选完后关闭面板
};

const handleNewChat = () => {
  emit('newChat');
  emit('toggleConvList'); // 新建后关闭面板
};

const handleOverlayClick = () => {
  if (props.showConvList) {
    emit('toggleConvList'); // 关闭会话列表
  } else {
    closeChat(); // 关闭整个聊天
  }
};

const clearChatHistory = () => {
  emit('clearChatHistory');
};

const handleSendMessage = () => {
  console.log('[ChatSidebar] handleSendMessage 被调用了！');
  console.log('[ChatSidebar] chatInput.value:', chatInput.value);
  console.log('[ChatSidebar] uploadedImages.value:', uploadedImages.value);
  
  if (!chatInput.value.trim() && uploadedImages.value.length === 0) {
    console.log('[ChatSidebar] 没有内容，return');
    return;
  }
  
  const userMsg = chatInput.value.trim();
  const images = [...uploadedImages.value];
  
  console.log('[ChatSidebar] 发送消息:', { text: userMsg, images });
  
  chatInput.value = '';
  uploadedImages.value = [];
  
  emit('sendMessage', { text: userMsg, images });
};

const triggerImageUpload = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = handleImageUpload;
  input.click();
};

const handleImageUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const compressedImage = await compressImage(file);
    uploadedImages.value.push(compressedImage);
  } catch (error) {
    console.error('Error compressing image:', error);
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedImages.value.push(e.target.result);
    };
    reader.readAsDataURL(file);
  }
};

const removeImage = (index) => {
  uploadedImages.value.splice(index, 1);
};

const handlePaste = async (event) => {
  const clipboardData = event.clipboardData || window.clipboardData;
  if (!clipboardData) return;

  const items = clipboardData.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.indexOf('image') !== -1) {
      event.preventDefault();
      const file = item.getAsFile();
      if (file) {
        try {
          const compressedImage = await compressImage(file);
          uploadedImages.value.push(compressedImage);
        } catch (error) {
          const reader = new FileReader();
          reader.onload = (e) => {
            uploadedImages.value.push(e.target.result);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }
};

const compressImage = (file, maxWidth = 1024, maxHeight = 1024, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const isPng = file.type === 'image/png';
        const mimeType = isPng ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);

        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const handleConfirm = (tool) => {
  emit('confirm', tool);
};

const handleCancelConfirmation = () => {
  emit('cancelConfirmation');
};

const scrollToBottom = () => {
  emit('scrollToBottom');
};

const scrollToTop = () => {
  emit('scrollToTop');
};

const handleChatScroll = (e) => {
  if (e && e.detail) {
    const { scrollTop, scrollHeight, clientHeight } = e.detail;
    showScrollButtons.value = scrollTop > 50 || scrollTop < scrollHeight - clientHeight - 50;
  }
};

watch(() => props.messages, () => {
  nextTick(() => {
    scrollToBottom();
  });
}, { deep: true });

defineExpose({
  chatInput,
  uploadedImages,
  imageInput,
  chatContainerRef
});
</script>

<style scoped>
/* Conversation List Panel */
.conv-list-panel {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 280px;
  max-width: 80vw;
  background: #fff;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.1);
  z-index: 110;
  overflow: hidden;
  border-right: 1px solid rgba(133, 178, 81, 0.1);
  display: flex;
  flex-direction: column;
}

.conv-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 20rpx;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}

.conv-list-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a3a08;
}

.conv-list-close {
  width: 52rpx;
  height: 52rpx;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  transition: all 0.15s;
  cursor: pointer;
}

.conv-list-close:active {
  background: rgba(0, 0, 0, 0.06);
  color: #333;
}
</style>
