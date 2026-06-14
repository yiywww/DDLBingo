<template>
  <view class="conv-list">
    <!-- 新建对话 -->
    <view class="new-chat-btn" @click="$emit('newChat')">
      <view class="nc-icon-wrap">
        <text class="nc-icon">+</text>
      </view>
      <text class="nc-text">新建对话</text>
    </view>

    <!-- 加载中 -->
    <view v-if="loading" class="conv-loading">
      <text>加载中...</text>
    </view>

    <!-- 空状态 -->
    <view v-else-if="conversations.length === 0" class="conv-empty">
      <text class="empty-icon">🐦</text>
      <text class="empty-text">暂无对话记录</text>
      <text class="empty-hint">发送第一条消息开始对话吧</text>
    </view>

    <!-- 会话列表 -->
    <view v-else class="conv-items">
      <template v-for="group in groupedConversations" :key="group.label">
        <text class="conv-group-label">{{ group.label }}</text>
        <view
          v-for="conv in group.items"
          :key="conv.id"
          class="conv-item"
          :class="{ active: conv.id === activeId }"
          @click="$emit('select', conv)"
        >
          <view class="ci-avatar">
            <text class="cia-text">{{ getAvatarText(conv.title) }}</text>
          </view>
          <view class="ci-body">
            <text class="ci-title" :lines="1">{{ conv.title || '新对话' }}</text>
            <view class="ci-meta">
              <text class="ci-time">{{ formatTime(conv.updatedAt || conv.createdAt) }}</text>
              <text class="ci-count" v-if="conv.messageCount">{{ conv.messageCount }}条</text>
            </view>
          </view>
          <view class="ci-actions" @click.stop>
            <view class="ci-action-btn delete" @click="handleDelete(conv)">
              <text>🗑</text>
            </view>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { getConversations, deleteConversation as apiDelete } from '@/utils/api.js';

const props = defineProps({
  activeId: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['select', 'newChat', 'refresh']);

const loading = ref(false);
const conversations = ref([]);

// 加载列表
async function loadList() {
  loading.value = true;
  try {
    const res = await getConversations({ size: 30 });
    if (res.success && res.data?.records) {
      conversations.value = res.data.records;
    }
  } catch (e) {
    console.error('[ConvList] 加载失败:', e);
  } finally {
    loading.value = false;
  }
}

// 删除
async function handleDelete(conv) {
  const confirmed = await showConfirm(`删除"${conv.title || '新对话'}"？`);
  if (!confirmed) return;

  try {
    await apiDelete(conv.id);
    conversations.value = conversations.value.filter(c => c.id !== conv.id);
    uni.showToast({ title: '已删除', icon: 'success' });
    emit('refresh');
  } catch (e) {
    uni.showToast({ title: '删除失败', icon: 'error' });
  }
}

// 简单确认弹窗
function showConfirm(msg) {
  return new Promise((resolve) => {
    uni.showModal({
      title: '确认删除',
      content: msg,
      success: (res) => resolve(res.confirm),
      fail: () => resolve(false),
    });
  });
}

// 按时间分组
const groupedConversations = computed(() => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  const groups = { today: [], yesterday: [], earlier: [] };

  for (const c of conversations.value) {
    const d = new Date(c.updatedAt || c.createdAt);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day.getTime() === today.getTime()) {
      groups.today.push(c);
    } else if (day.getTime() === yesterday.getTime()) {
      groups.yesterday.push(c);
    } else {
      groups.earlier.push(c);
    }
  }

  const result = [];
  if (groups.today.length) result.push({ label: '今天', items: groups.today });
  if (groups.yesterday.length) result.push({ label: '昨天', items: groups.yesterday });
  if (groups.earlier.length) result.push({ label: '更早', items: groups.earlier });
  return result;
});

function getAvatarText(title) {
  if (!title) return '新';
  return title.slice(0, 2);
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (day.getTime() === today.getTime()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

onMounted(() => {
  loadList();
});

defineExpose({ loadList });
</script>

<style scoped>
.conv-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.new-chat-btn {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 32rpx;
  margin: 16rpx 24rpx 20rpx;
  background: linear-gradient(135deg, rgba(133, 178, 81, 0.1), rgba(160, 208, 64, 0.15));
  border: 1px solid rgba(133, 178, 81, 0.25);
  border-radius: 20rpx;
  cursor: pointer;
  transition: all 0.2s;
}

.new-chat-btn:active {
  background: rgba(133, 178, 81, 0.2);
  transform: scale(0.97);
}

.nc-icon-wrap {
  width: 48rpx;
  height: 48rpx;
  border-radius: 14rpx;
  background: #85b251;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nc-icon {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
  line-height: 1;
}

.nc-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #4a7a1e;
}

.conv-loading, .conv-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}

.empty-icon {
  font-size: 64rpx;
}

.empty-text {
  font-size: 28rpx;
  color: rgba(26, 58, 8, 0.5);
  font-weight: 500;
}

.empty-hint {
  font-size: 22rpx;
  color: rgba(26, 58, 8, 0.35);
}

.conv-items {
  flex: 1;
  overflow-y: auto;
  padding: 0 24rpx;
}

.conv-group-label {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  color: rgba(26, 58, 8, 0.4);
  padding: 16rpx 8rpx 8rpx;
}

.conv-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 12rpx;
  border-radius: 16rpx;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}

.conv-item:active {
  background: rgba(133, 178, 81, 0.08);
}

.conv-item.active {
  background: rgba(133, 178, 81, 0.12);
  border: 1px solid rgba(133, 178, 81, 0.2);
}

.ci-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 14rpx;
  background: rgba(133, 178, 81, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.active .ci-avatar {
  background: rgba(133, 178, 81, 0.25);
}

.cia-text {
  font-size: 22rpx;
  font-weight: bold;
  color: #4a7a1e;
}

.ci-body {
  flex: 1;
  min-width: 0;
}

.ci-title {
  font-size: 26rpx;
  font-weight: 500;
  color: #1a3a08;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.ci-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 4rpx;
}

.ci-time {
  font-size: 20rpx;
  color: rgba(26, 58, 8, 0.4);
}

.ci-count {
  font-size: 20rpx;
  color: rgba(26, 58, 8, 0.3);
}

.ci-actions {
  display: none;
}

.conv-item:active .ci-actions,
.conv-item.active .ci-actions {
  display: block;
}

.ci-action-btn {
  padding: 8rpx;
  border-radius: 10rpx;
  font-size: 24rpx;
}

.ci-action-btn.delete:active {
  background: rgba(220, 38, 38, 0.15);
}
</style>
