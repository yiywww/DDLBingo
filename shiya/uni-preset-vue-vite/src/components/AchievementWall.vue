<template>
  <view class="achievement-wall">
    <view class="wall-header">
      <text class="wall-title">🏆 成就墙</text>
      <text class="wall-subtitle">记录你的 Bingo 挑战成就</text>
    </view>

    <view v-if="achievements.length === 0" class="empty-state">
      <view class="empty-icon">🎉</view>
      <text class="empty-text">还没有完成任何 Bingo 挑战</text>
      <text class="empty-hint">完成九宫格挑战，解锁你的第一个成就！</text>
    </view>

    <view v-else class="achievements-grid">
      <view 
        v-for="(achievement, index) in achievements" 
        :key="index" 
        class="achievement-card"
        @click="viewAchievement(achievement)"
      >
        <view class="card-header">
          <view class="achievement-badge">
            <text>{{ index + 1 }}</text>
          </view>
          <text class="achievement-date">{{ formatDate(achievement.date) }}</text>
        </view>
        <view class="card-stats">
          <view class="stat">
            <text class="stat-num">{{ achievement.taskCount }}</text>
            <text class="stat-label">任务</text>
          </view>
          <view class="stat">
            <text class="stat-num">{{ formatTime(achievement.totalTime) }}</text>
            <text class="stat-label">专注</text>
          </view>
        </view>
        <view class="card-tasks">
          <text class="tasks-preview">{{ getTasksPreview(achievement.tasks) }}</text>
        </view>
      </view>
    </view>

    <view v-if="showDetail" class="detail-overlay" @click="closeDetail">
      <view class="detail-content" @click.stop>
        <view class="detail-header">
          <text class="detail-title">成就详情</text>
          <view class="close-btn" @click="closeDetail">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </view>
        </view>
        <view class="detail-date">{{ formatDate(selectedAchievement?.date) }}</view>
        <view class="detail-stats">
          <view class="detail-stat">
            <text class="detail-stat-value">{{ selectedAchievement?.taskCount }}</text>
            <text class="detail-stat-label">完成任务数</text>
          </view>
          <view class="detail-stat">
            <text class="detail-stat-value">{{ formatTime(selectedAchievement?.totalTime) }}</text>
            <text class="detail-stat-label">总专注时长</text>
          </view>
        </view>
        <view class="detail-tasks">
          <text class="detail-tasks-title">完成的任务</text>
          <view class="detail-tasks-list">
            <view v-for="(task, idx) in selectedAchievement?.tasks" :key="idx" class="detail-task-item">
              <view class="task-check">✓</view>
              <text class="task-name">{{ task.text }}</text>
              <text class="task-time">{{ task.estimatedTime }}分钟</text>
            </view>
          </view>
        </view>
        <view class="detail-actions">
          <view class="detail-btn share" @click="shareAchievement">分享</view>
          <view class="detail-btn delete" @click="deleteAchievement">删除记录</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';

const achievements = ref([
  {
    date: '2024-01-15',
    taskCount: 9,
    totalTime: 120,
    tasks: [
      { text: '完成项目报告', estimatedTime: 30 },
      { text: '整理文档', estimatedTime: 20 },
      { text: '喝杯水', estimatedTime: 1 },
      { text: '起身活动', estimatedTime: 2 },
      { text: '冥想', estimatedTime: 3 },
      { text: '代码审查', estimatedTime: 45 },
      { text: '吃补剂', estimatedTime: 1 },
      { text: '远眺', estimatedTime: 2 },
      { text: '整理桌面', estimatedTime: 3 },
    ]
  },
  {
    date: '2024-01-14',
    taskCount: 9,
    totalTime: 90,
    tasks: [
      { text: '写代码', estimatedTime: 40 },
      { text: '测试功能', estimatedTime: 25 },
      { text: '喝杯水', estimatedTime: 1 },
      { text: '起身活动', estimatedTime: 2 },
      { text: '冥想', estimatedTime: 3 },
      { text: '开会', estimatedTime: 15 },
      { text: '吃补剂', estimatedTime: 1 },
      { text: '远眺', estimatedTime: 2 },
      { text: '整理桌面', estimatedTime: 1 },
    ]
  },
  {
    date: '2024-01-13',
    taskCount: 9,
    totalTime: 75,
    tasks: [
      { text: '学习新技术', estimatedTime: 35 },
      { text: '做笔记', estimatedTime: 15 },
      { text: '喝杯水', estimatedTime: 1 },
      { text: '起身活动', estimatedTime: 2 },
      { text: '冥想', estimatedTime: 3 },
      { text: '看视频', estimatedTime: 15 },
      { text: '吃补剂', estimatedTime: 1 },
      { text: '远眺', estimatedTime: 2 },
      { text: '整理桌面', estimatedTime: 1 },
    ]
  }
]);

const showDetail = ref(false);
const selectedAchievement = ref(null);

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

const formatTime = (minutes) => {
  if (!minutes) return '0分钟';
  if (minutes < 60) {
    return `${minutes}分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
};

const getTasksPreview = (tasks) => {
  if (!tasks || tasks.length === 0) return '';
  const names = tasks.slice(0, 3).map(t => t.text);
  const more = tasks.length > 3 ? `等${tasks.length}个` : '';
  return `${names.join('、')}${more}`;
};

const viewAchievement = (achievement) => {
  selectedAchievement.value = achievement;
  showDetail.value = true;
};

const closeDetail = () => {
  showDetail.value = false;
  selectedAchievement.value = null;
};

const shareAchievement = () => {
  uni.showToast({ title: '分享功能开发中', icon: 'none' });
};

const deleteAchievement = () => {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除这条成就记录吗？',
    success: (res) => {
      if (res.confirm && selectedAchievement.value) {
        const index = achievements.value.findIndex(
          a => a.date === selectedAchievement.value.date
        );
        if (index !== -1) {
          achievements.value.splice(index, 1);
          closeDetail();
          uni.showToast({ title: '删除成功', icon: 'success' });
        }
      }
    }
  });
};
</script>

<style scoped>
.achievement-wall {
  width: 100%;
  padding: 20rpx;
}

.wall-header {
  margin-bottom: 30rpx;
}

.wall-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #1f2937;
  display: block;
}

.wall-subtitle {
  font-size: 24rpx;
  color: #6b7280;
  display: block;
  margin-top: 8rpx;
}

.empty-state {
  text-align: center;
  padding: 60rpx 20rpx;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #6b7280;
  display: block;
  margin-bottom: 12rpx;
}

.empty-hint {
  font-size: 24rpx;
  color: #9ca3af;
}

.achievements-grid {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.achievement-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
  transition: all 0.3s;
}

.achievement-card:active {
  transform: scale(0.98);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.achievement-badge {
  width: 48rpx;
  height: 48rpx;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: bold;
  color: #fff;
}

.achievement-date {
  font-size: 24rpx;
  color: #6b7280;
}

.card-stats {
  display: flex;
  gap: 40rpx;
  margin-bottom: 16rpx;
}

.stat {
  display: flex;
  flex-direction: column;
}

.stat-num {
  font-size: 32rpx;
  font-weight: bold;
  color: #5a5a40;
}

.stat-label {
  font-size: 20rpx;
  color: #9ca3af;
}

.card-tasks {
  padding-top: 16rpx;
  border-top: 1rpx solid #f3f4f6;
}

.tasks-preview {
  font-size: 24rpx;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-overlay {
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

.detail-content {
  width: 100%;
  max-width: 600rpx;
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid #e5e7eb;
}

.detail-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #1f2937;
}

.close-btn {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.detail-date {
  padding: 16rpx 24rpx;
  font-size: 24rpx;
  color: #6b7280;
  background: #f9fafb;
}

.detail-stats {
  display: flex;
  justify-content: space-around;
  padding: 32rpx 24rpx;
}

.detail-stat {
  text-align: center;
}

.detail-stat-value {
  font-size: 40rpx;
  font-weight: bold;
  color: #5a5a40;
  display: block;
}

.detail-stat-label {
  font-size: 22rpx;
  color: #6b7280;
  display: block;
  margin-top: 8rpx;
}

.detail-tasks {
  padding: 0 24rpx;
}

.detail-tasks-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #1f2937;
  display: block;
  margin-bottom: 20rpx;
}

.detail-tasks-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  max-height: 360rpx;
  overflow-y: auto;
  padding-bottom: 20rpx;
}

.detail-task-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx;
  background: #f9fafb;
  border-radius: 12rpx;
}

.task-check {
  width: 32rpx;
  height: 32rpx;
  background: #22c55e;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18rpx;
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

.detail-actions {
  display: flex;
  gap: 20rpx;
  padding: 24rpx;
  border-top: 1rpx solid #e5e7eb;
}

.detail-btn {
  flex: 1;
  padding: 20rpx;
  border-radius: 16rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: bold;
}

.detail-btn.share {
  background: #5a5a40;
  color: #fff;
}

.detail-btn.delete {
  background: #fef2f2;
  color: #ef4444;
}
</style>