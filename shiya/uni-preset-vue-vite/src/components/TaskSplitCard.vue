<template>
  <view class="task-split-card">
    <view class="card-header">
      <view class="header-icon">📋</view>
      <view class="header-info">
        <text class="header-title">任务拆解完成</text>
        <text class="header-subtitle">{{ mainTask?.title || '任务' }}</text>
      </view>
    </view>

    <view class="main-task-desc" v-if="mainTask?.description">
      <text>{{ mainTask.description }}</text>
    </view>

    <view class="sub-tasks">
      <view
        v-for="(task, index) in subTasks"
        :key="index"
        class="sub-task-item"
        :class="{ completed: task.isCompleted, active: task.isActive }"
        @click="toggleTask(index)"
      >
        <view class="task-index">
          <view class="index-circle" :class="{ done: task.isCompleted }">
            <text v-if="task.isCompleted">✓</text>
            <text v-else>{{ index + 1 }}</text>
          </view>
        </view>

        <view class="task-body">
          <view class="task-title-row">
            <text class="task-title">{{ task.title }}</text>
            <view class="task-priority-badge" :class="'p' + (task.priority || 3)">
              <text>{{ getPriorityText(task.priority) }}</text>
            </view>
          </view>
          <text class="task-desc" v-if="task.description">{{ task.description }}</text>
          <view class="task-meta">
            <text class="meta-time">⏱ {{ task.estimatedMinutes || 30 }}分钟</text>
          </view>
        </view>
      </view>
    </view>

    <view class="card-actions">
      <view class="action-btn secondary" @click="handleAddAllToTasks">
        <text>全部加入任务列表</text>
      </view>
      <view class="action-btn primary" @click="handleAddToBingo">
        <text>加入 Bingo 棋盘</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['addToTasks', 'addToBingo']);

const mainTask = computed(() => props.data?.mainTask || null);
const subTasks = computed(() => {
  const tasks = props.data?.subTasks || [];
  return tasks.map(t => ({
    ...t,
    isCompleted: false,
    isActive: false,
  }));
});

const internalTasks = ref([]);

function getPriorityText(priority) {
  const map = { 1: '最高', 2: '高', 3: '中', 4: '低', 5: '最低' };
  return map[priority] || '中';
}

function toggleTask(index) {
  const task = internalTasks.value[index];
  if (task) {
    task.isCompleted = !task.isCompleted;
  }
}

function handleAddAllToTasks() {
  const taskData = {
    mainTask: mainTask.value,
    subTasks: subTasks.value.map(t => ({
      title: t.title,
      description: t.description,
      estimatedMinutes: t.estimatedMinutes,
      priority: t.priority,
    })),
  };
  emit('addToTasks', taskData);
}

function handleAddToBingo() {
  const taskData = {
    mainTask: mainTask.value,
    subTasks: subTasks.value.map(t => ({
      title: t.title,
      description: t.description,
      estimatedMinutes: t.estimatedMinutes,
      priority: t.priority,
    })),
  };
  emit('addToBingo', taskData);
}
</script>

<style scoped>
.task-split-card {
  background: linear-gradient(135deg, rgba(133, 178, 81, 0.1) 0%, rgba(252, 234, 81, 0.1) 100%);
  border: 1px solid rgba(133, 178, 81, 0.25);
  border-radius: 24rpx;
  padding: 24rpx;
  margin: 16rpx 0;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.header-icon {
  font-size: 40rpx;
}

.header-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #4a7a1e;
  display: block;
}

.header-subtitle {
  font-size: 24rpx;
  color: rgba(74, 122, 30, 0.7);
}

.main-task-desc {
  padding: 12rpx 16rpx;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12rpx;
  margin-bottom: 16rpx;
  font-size: 24rpx;
  color: rgba(26, 58, 8, 0.7);
}

.sub-tasks {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.sub-task-item {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  padding: 16rpx;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 16rpx;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.sub-task-item:active {
  background: rgba(133, 178, 81, 0.15);
  border-color: rgba(133, 178, 81, 0.3);
}

.sub-task-item.completed {
  opacity: 0.5;
}

.sub-task-item.completed .task-title {
  text-decoration: line-through;
}

.index-circle {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(133, 178, 81, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: bold;
  color: #4a7a1e;
  transition: all 0.2s;
}

.index-circle.done {
  background: #85b251;
  color: #fff;
}

.task-body {
  flex: 1;
  min-width: 0;
}

.task-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.task-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a3a08;
  flex: 1;
}

.task-desc {
  font-size: 22rpx;
  color: rgba(26, 58, 8, 0.55);
  margin-top: 6rpx;
  display: block;
}

.task-meta {
  margin-top: 8rpx;
}

.meta-time {
  font-size: 22rpx;
  color: rgba(26, 58, 8, 0.45);
}

.task-priority-badge {
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  font-size: 20rpx;
  font-weight: bold;
}

.p1, .p2 {
  background: rgba(220, 38, 38, 0.15);
  color: #dc2626;
}

.p3 {
  background: rgba(37, 99, 235, 0.15);
  color: #2563eb;
}

.p4, .p5 {
  background: rgba(22, 163, 74, 0.15);
  color: #16a34a;
}

.card-actions {
  display: flex;
  gap: 16rpx;
}

.action-btn {
  flex: 1;
  padding: 20rpx;
  border-radius: 20rpx;
  text-align: center;
  font-size: 26rpx;
  font-weight: bold;
  transition: all 0.2s;
}

.action-btn:active {
  transform: scale(0.95);
}

.action-btn.primary {
  background: linear-gradient(135deg, #85b251, #a0d040);
  color: #fff;
  box-shadow: 0 4px 16rpx rgba(133, 178, 81, 0.4);
}

.action-btn.secondary {
  background: rgba(255, 255, 255, 0.8);
  color: #4a7a1e;
  border: 1px solid #c8deae;
}
</style>
