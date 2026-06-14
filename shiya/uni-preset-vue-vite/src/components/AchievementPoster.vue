<template>
  <view class="poster-overlay" @click="handleClose">
    <view class="poster-container" @click.stop>
      <view class="close-button" @click="handleClose">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </view>

      <view class="poster-content">
        <view class="poster-header">
          <text class="poster-title">🎉 Bingo 成就达成！</text>
          <text class="poster-date">{{ currentDate }}</text>
        </view>

        <view class="poster-crow">
          <Crow :action="'happy'" />
        </view>

        <view class="poster-stats">
          <view class="stat-item">
            <text class="stat-value">{{ tasks.length }}</text>
            <text class="stat-label">完成任务</text>
          </view>
          <view class="stat-item">
            <text class="stat-value">{{ totalTime }}</text>
            <text class="stat-label">专注时长</text>
          </view>
          <view class="stat-item">
            <text class="stat-value">100%</text>
            <text class="stat-label">完成率</text>
          </view>
        </view>

        <view class="poster-tasks">
          <text class="tasks-title">完成的任务</text>
          <view class="tasks-list">
            <view v-for="(task, index) in tasks" :key="index" class="task-item">
              <view class="task-check">✓</view>
              <text class="task-name">{{ task.text }}</text>
              <text class="task-time">{{ task.estimatedTime }}分钟</text>
            </view>
          </view>
        </view>

        <view class="poster-footer">
          <text class="footer-text">拾鸦 Bingo 挑战</text>
          <text class="footer-hash">#拾鸦打卡 #时间管理</text>
        </view>
      </view>

      <view class="poster-actions">
        <view class="action-btn share-qq" @click="shareToQQ">
          <text>QQ分享</text>
        </view>
        <view class="action-btn share-qzone" @click="shareToQZone">
          <text>分享到QQ空间</text>
        </view>
        <view class="action-btn save" @click="savePoster">
          <text>保存图片</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import Crow from './Crow.vue';

const props = defineProps({
  tasks: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['close', 'share']);

const currentDate = computed(() => {
  const now = new Date();
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
});

const totalTime = computed(() => {
  const total = props.tasks.reduce((sum, task) => sum + (task.estimatedTime || 0), 0);
  if (total < 60) {
    return `${total}分钟`;
  }
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
});

const handleClose = () => {
  emit('close');
};

const shareToQQ = () => {
  emit('share', { type: 'qq' });
  uni.showToast({ 
    title: '模拟分享到QQ群', 
    icon: 'none',
    duration: 2000
  });
  console.log('真实环境需调用腾讯开放平台分享接口');
};

const shareToQZone = () => {
  emit('share', { type: 'qzone' });
  uni.showModal({
    title: '分享到QQ空间',
    content: '真实环境调用腾讯开放平台 API 完成分享',
    showCancel: false
  });
};

const savePoster = () => {
  uni.showToast({ 
    title: '保存成功', 
    icon: 'success' 
  });
};
</script>

<style scoped>
.poster-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 40rpx;
}

.poster-container {
  width: 100%;
  max-width: 600rpx;
  position: relative;
}

.close-button {
  position: absolute;
  top: -60rpx;
  right: 0;
  width: 60rpx;
  height: 60rpx;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  z-index: 10;
}

.poster-content {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fcd34d 100%);
  border-radius: 32rpx;
  padding: 40rpx;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.3);
}

.poster-header {
  text-align: center;
  margin-bottom: 20rpx;
}

.poster-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #854d0e;
  display: block;
}

.poster-date {
  font-size: 24rpx;
  color: #a16207;
  display: block;
  margin-top: 8rpx;
}

.poster-crow {
  display: flex;
  justify-content: center;
  margin-bottom: 30rpx;
}

.poster-stats {
  display: flex;
  justify-content: space-around;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 30rpx;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 36rpx;
  font-weight: bold;
  color: #5a5a40;
  display: block;
}

.stat-label {
  font-size: 22rpx;
  color: #6b7280;
  display: block;
  margin-top: 8rpx;
}

.poster-tasks {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 30rpx;
}

.tasks-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #1f2937;
  display: block;
  margin-bottom: 20rpx;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  max-height: 300rpx;
  overflow-y: auto;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.task-check {
  width: 36rpx;
  height: 36rpx;
  background: #22c55e;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  color: #fff;
}

.task-name {
  flex: 1;
  font-size: 26rpx;
  color: #374151;
}

.task-time {
  font-size: 22rpx;
  color: #9ca3af;
}

.poster-footer {
  text-align: center;
}

.footer-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #854d0e;
  display: block;
}

.footer-hash {
  font-size: 22rpx;
  color: #a16207;
  display: block;
  margin-top: 8rpx;
}

.poster-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 30rpx;
}

.action-btn {
  flex: 1;
  padding: 24rpx;
  border-radius: 24rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: bold;
  color: #fff;
  transition: all 0.3s;
}

.action-btn:active {
  transform: scale(0.95);
}

.action-btn.share-qq {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.action-btn.share-qzone {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.action-btn.save {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
}
</style>