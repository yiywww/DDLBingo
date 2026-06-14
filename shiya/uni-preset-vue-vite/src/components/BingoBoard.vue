<template>
  <view class="bingo-board-container">
    <view class="board-header">
      <view class="header-info">
        <text class="board-title">🎯 Bingo 挑战</text>
        <text class="board-subtitle">完成九宫格，解锁成就！</text>
      </view>
      <view class="completion-progress">
        <text class="progress-text">{{ completedCount }} / 9</text>
        <view class="progress-bar">
          <view class="progress-fill" :style="{ width: completionPercent + '%' }"></view>
        </view>
      </view>
    </view>

    <view class="task-pool-info" v-if="taskPool.length > 0">
      <text class="pool-label">任务池剩余: {{ taskPool.length }} 个任务</text>
      <view class="ai-pool-btn" @click="loadAITaskPool">
        <text>🤖 AI任务</text>
      </view>
    </view>

    <view class="bingo-grid">
      <view 
        v-for="(card, index) in cards" 
        :key="index" 
        class="grid-item"
      >
        <BingoCard
          :task="card.task"
          :isCompleted="card.isCompleted"
          :isFlipped="card.isFlipped"
          @flip="flipCard(index)"
          @complete="completeCard(index)"
          @startTimer="handleStartTimer"
          @stopTimer="handleStopTimer"
        />
      </view>
    </view>

    <view class="board-actions">
      <view class="action-button secondary" @click="refreshBoard">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 16 7 16 7 10 1 4"></polyline><line x1="3" y1="22" x2="21" y2="22"></line></svg>
        <text>刷新棋盘</text>
      </view>
      <view class="action-button primary" @click="resetBoard">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
        <text>重置游戏</text>
      </view>
    </view>

    <AchievementPoster 
      v-if="showPoster"
      :tasks="completedTasks"
      @close="showPoster = false"
      @share="handleShare"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import BingoCard from './BingoCard.vue';
import AchievementPoster from './AchievementPoster.vue';
import { getBingoPool } from '@/utils/api.js';

const props = defineProps({
  taskPool: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['refresh', 'reset', 'complete']);

const cards = ref([]);
const completedTaskIds = ref([]);
const showPoster = ref(false);
const aiPoolTasks = ref([]);
const loadingAI = ref(false);

const zeroEffortTasks = [
  { id: 'zero_1', text: '喝杯水', description: '保持身体水分充足', estimatedTime: 1, difficulty: 'easy', priority: 'low' },
  { id: 'zero_2', text: '起身活动', description: '站起来拉伸一下', estimatedTime: 2, difficulty: 'easy', priority: 'low' },
  { id: 'zero_3', text: '吃补剂', description: '记得补充维生素', estimatedTime: 1, difficulty: 'easy', priority: 'low' },
  { id: 'zero_4', text: '冥想', description: '深呼吸放松身心', estimatedTime: 3, difficulty: 'easy', priority: 'low' },
  { id: 'zero_5', text: '远眺', description: '保护眼睛，看看远方', estimatedTime: 2, difficulty: 'easy', priority: 'low' },
  { id: 'zero_6', text: '整理桌面', description: '保持工作环境整洁', estimatedTime: 3, difficulty: 'easy', priority: 'low' },
];

const completedCount = computed(() => {
  return cards.value.filter(c => c.isCompleted).length;
});

const completionPercent = computed(() => {
  return (completedCount.value / 9) * 100;
});

const completedTasks = computed(() => {
  return cards.value
    .filter(c => c.isCompleted && c.task)
    .map(c => c.task);
});

const generateBoard = () => {
  const availableTasks = [...props.taskPool];
  const completedIds = [...completedTaskIds.value];
  
  const urgentTasks = availableTasks.filter(t => t.priority === 'urgent' && !completedIds.includes(t.id));
  const normalTasks = availableTasks.filter(t => t.priority !== 'urgent' && !completedIds.includes(t.id));
  
  const selectedTasks = [];
  
  const urgentCount = Math.min(Math.ceil(9 * 0.7), urgentTasks.length);
  for (let i = 0; i < urgentCount; i++) {
    if (urgentTasks.length > 0) {
      const idx = Math.floor(Math.random() * urgentTasks.length);
      selectedTasks.push(urgentTasks.splice(idx, 1)[0]);
    }
  }
  
  const normalCount = 9 - urgentCount;
  for (let i = 0; i < normalCount; i++) {
    if (normalTasks.length > 0 && Math.random() > 0.3) {
      const idx = Math.floor(Math.random() * normalTasks.length);
      selectedTasks.push(normalTasks.splice(idx, 1)[0]);
    } else {
      const idx = Math.floor(Math.random() * zeroEffortTasks.length);
      const zeroTask = { ...zeroEffortTasks[idx] };
      zeroTask.id = `${zeroTask.id}_${Date.now()}_${i}`;
      selectedTasks.push(zeroTask);
    }
  }
  
  for (let i = selectedTasks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [selectedTasks[i], selectedTasks[j]] = [selectedTasks[j], selectedTasks[i]];
  }
  
  cards.value = selectedTasks.map(task => ({
    task,
    isCompleted: false,
    isFlipped: false
  }));
};

const flipCard = (index) => {
  if (!cards.value[index].isCompleted) {
    cards.value[index].isFlipped = true;
  }
};

const completeCard = (index) => {
  const card = cards.value[index];
  if (card.task) {
    card.isCompleted = true;
    completedTaskIds.value.push(card.task.id);
    saveProgress();
    
    emit('complete', card.task);
    
    if (completedCount.value >= 9) {
      setTimeout(() => {
        showPoster.value = true;
      }, 500);
    }
  }
};

const handleStartTimer = (task) => {
  console.log('开始计时:', task.text);
};

const handleStopTimer = () => {
  console.log('停止计时');
};

const refreshBoard = () => {
  cards.value.forEach(card => {
    if (!card.isCompleted) {
      card.isFlipped = false;
    }
  });
  
  generateBoard();
  saveProgress();
  emit('refresh');
};

const resetBoard = () => {
  completedTaskIds.value = [];
  cards.value = [];
  uni.removeStorageSync('bingoProgress');
  uni.removeStorageSync('bingoCompletedIds');
  generateBoard();
  emit('reset');
};

const saveProgress = () => {
  uni.setStorageSync('bingoProgress', cards.value);
  uni.setStorageSync('bingoCompletedIds', completedTaskIds.value);
};

const loadProgress = () => {
  const savedProgress = uni.getStorageSync('bingoProgress');
  const savedCompletedIds = uni.getStorageSync('bingoCompletedIds');
  
  if (savedProgress && savedProgress.length > 0) {
    cards.value = savedProgress;
  }
  if (savedCompletedIds && savedCompletedIds.length > 0) {
    completedTaskIds.value = savedCompletedIds;
  }
};

const handleShare = () => {
  console.log('分享成就海报');
  uni.showToast({ title: '分享功能开发中', icon: 'none' });
};

/** 从后端 AI 任务池加载任务，合并到 Bingo 棋盘 */
const loadAITaskPool = async () => {
  if (loadingAI.value) return;
  loadingAI.value = true;

  try {
    const res = await getBingoPool();
    if (res.success && res.data?.length > 0) {
      aiPoolTasks.value = res.data;

      // 将 AI 任务插入到空缺位置
      const newCards = [...cards.value];
      let aiIndex = 0;

      for (let i = 0; i < 9 && aiIndex < res.data.length; i++) {
        if (!newCards[i] || !newCards[i].task) {
          const aiTask = res.data[aiIndex++];
          newCards[i] = {
            task: {
              id: aiTask.id,
              text: aiTask.text,
              description: aiTask.description + (aiTask.ddlDate ? `\nDDL: ${aiTask.ddlDate}` : ''),
              estimatedTime: aiTask.estimatedTime,
              priority: aiTask.priority,
              difficulty: aiTask.difficulty,
              urgency: aiTask.urgency,
              ddlDate: aiTask.ddlDate,
            },
            isCompleted: false,
            isFlipped: false,
          };
        }
      }

      cards.value = newCards;
      saveProgress();

      uni.showToast({
        title: `已加载 ${Math.min(res.data.length, 9)} 个AI任务`,
        icon: 'success',
      });
    } else {
      uni.showToast({
        title: '暂无AI拆解任务，先用对话拆解吧',
        icon: 'none',
      });
    }
  } catch (e) {
    console.error('加载AI任务池失败:', e);
    uni.showToast({ title: '加载失败，请重试', icon: 'error' });
  } finally {
    loadingAI.value = false;
  }
};

watch(() => props.taskPool, () => {
  if (cards.value.length === 0) {
    generateBoard();
  }
}, { immediate: true });

onMounted(() => {
  loadProgress();
  if (cards.value.length === 0) {
    generateBoard();
  }
});
</script>

<style scoped>
/* Bingo Board Theme - Inspired by 可翻牌的Bingo九宫格 */

/* Animations */
@keyframes floatY {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@keyframes gradShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes popIn {
  0% { transform: scale(0) rotate(-12deg); opacity: 0; }
  65% { transform: scale(1.18) rotate(4deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

@keyframes pulseScale {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

/* Color Theme */
.bingo-board-container {
  --board-yellow: #fcea51;
  --board-light-yellow: #f5f6af;
  --board-light-green: #c8deae;
  --board-green: #85b251;
  --board-dark-green: #4a7a1e;
  width: 100%;
  max-width: 700rpx;
  margin: 0 auto;
  padding: 20rpx;
  position: relative;
}

/* Background Decorations */
.bingo-board-container::before {
  content: '';
  position: fixed;
  top: 4%;
  left: 5%;
  width: 200px;
  height: 200px;
  border-radius: 60% 40% 55% 45%/45% 55% 45% 55%;
  background: rgba(252, 234, 81, 0.27);
  filter: blur(40px);
  pointer-events: none;
  z-index: 0;
}

.bingo-board-container::after {
  content: '';
  position: fixed;
  bottom: 8%;
  right: 4%;
  width: 240px;
  height: 240px;
  border-radius: 45% 55% 40% 60%/55% 45% 60% 40%;
  background: rgba(200, 222, 174, 0.33);
  filter: blur(50px);
  pointer-events: none;
  z-index: 0;
}

/* Header Section */
.board-header {
  margin-bottom: 30rpx;
  position: relative;
  z-index: 2;
  animation: floatY 4s ease-in-out infinite;
}

.header-info {
  margin-bottom: 24rpx;
  text-align: center;
}

.board-title {
  font-size: 48rpx;
  font-weight: bold;
  font-family: 'Fredoka', sans-serif;
  background: linear-gradient(120deg, #4a7a1e, #85b251, #a0d040, #fcea51, #4a7a1e);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradShift 4s ease infinite;
  letter-spacing: -0.025em;
  display: block;
  margin-bottom: 8rpx;
}

.board-subtitle {
  font-size: 26rpx;
  font-weight: 600;
  color: #4a7a1e;
  opacity: 0.75;
  display: block;
  margin-top: 8rpx;
  font-family: 'Nunito', sans-serif;
}

/* Completion Progress */
.completion-progress {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: rgba(255, 255, 255, 0.75);
  padding: 16rpx 24rpx;
  border-radius: 20rpx;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(133, 178, 81, 0.2);
  box-shadow: 0 4px 16px rgba(133, 178, 81, 0.15);
}

.progress-text {
  font-size: 30rpx;
  font-weight: bold;
  color: #4a7a1e;
  min-width: 100rpx;
  font-family: 'Fredoka', sans-serif;
}

.progress-bar {
  flex: 1;
  height: 18rpx;
  background: rgba(200, 222, 174, 0.5);
  border-radius: 9rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #85b251, #a0d040, #fcea51);
  transition: width 0.5s ease-out;
  border-radius: 9rpx;
  box-shadow: 0 0 12px rgba(133, 178, 81, 0.88);
}

/* Task Pool Info */
.task-pool-info {
  margin-bottom: 24rpx;
  padding: 20rpx 24rpx;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 16rpx;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(133, 178, 81, 0.15);
  display: flex;
  align-items: center;
}

.pool-label {
  font-size: 26rpx;
  color: #4a7a1e;
  font-weight: 500;
}

.ai-pool-btn {
  margin-left: auto;
  padding: 10rpx 20rpx;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(37, 99, 235, 0.25));
  border-radius: 20rpx;
  border: 1px solid rgba(37, 99, 235, 0.3);
}

.ai-pool-btn text {
  font-size: 24rpx;
  color: #2563eb;
  font-weight: 600;
}

/* Bingo Grid */
.bingo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24rpx;
  padding: 32rpx;
  margin-bottom: 40rpx;
  background: rgba(255, 255, 255, 0.58);
  backdrop-filter: blur(18px);
  border-radius: 32rpx;
  border: 1.5px solid rgba(133, 178, 81, 0.2);
  box-shadow: 0 8px 48px rgba(133, 178, 81, 0.22), 0 2px 12px rgba(252, 234, 81, 0.33);
  position: relative;
  z-index: 2;
}

.grid-item {
  aspect-ratio: 1;
}

/* Board Actions */
.board-actions {
  display: flex;
  gap: 24rpx;
  position: relative;
  z-index: 2;
}

.action-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  padding: 28rpx;
  border-radius: 32rpx;
  font-size: 30rpx;
  font-weight: bold;
  transition: all 0.2s ease;
  cursor: pointer;
}

.action-button:active {
  transform: scale(0.95);
}

.action-button:hover {
  transform: scale(1.02);
}

.action-button.primary {
  background: linear-gradient(135deg, #85b251 0%, #a0d040 100%);
  color: #fff;
  box-shadow: 0 8px 24px rgba(133, 178, 81, 0.66);
  font-family: 'Fredoka', sans-serif;
  border: none;
}

.action-button.secondary {
  background: rgba(255, 255, 255, 0.75);
  color: #4a7a1e;
  backdrop-filter: blur(8px);
  border: 1.5px solid #c8deae;
  font-family: 'Nunito', sans-serif;
}

/* All Done Banner */
.all-done-banner {
  margin-top: 32rpx;
  padding: 28rpx 48rpx;
  border-radius: 24rpx;
  text-align: center;
  font-weight: bold;
  background: linear-gradient(135deg, #85b251 0%, #a0d040 100%, #fcea51 100%);
  color: #fff;
  box-shadow: 0 6px 24px rgba(133, 178, 81, 0.66);
  animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  font-family: 'Fredoka', sans-serif;
  font-size: 32rpx;
  position: relative;
  z-index: 2;
}

/* Bingo Badge */
.bingo-badge {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 28rpx;
  border-radius: 999rpx;
  font-weight: bold;
  background: linear-gradient(135deg, #85b251 0%, #a0d040 100%);
  color: #fff;
  box-shadow: 0 4px 16px rgba(133, 178, 81, 0.88);
  animation: popIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  font-family: 'Fredoka', sans-serif;
  font-size: 28rpx;
}

/* Progress Section */
.progress-section {
  margin-top: 32rpx;
  padding: 24rpx;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 24rpx;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(133, 178, 81, 0.15);
  position: relative;
  z-index: 2;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.progress-label {
  font-size: 26rpx;
  font-weight: bold;
  color: #4a7a1e;
  font-family: 'Fredoka', sans-serif;
}

.progress-count {
  font-size: 28rpx;
  font-weight: bold;
  color: #85b251;
  font-family: 'Fredoka', sans-serif;
}

/* Responsive Adjustments */
@media screen and (max-width: 375px) {
  .bingo-grid {
    padding: 24rpx;
    gap: 16rpx;
  }
  
  .board-title {
    font-size: 40rpx;
  }
  
  .board-subtitle {
    font-size: 24rpx;
  }
  
  .action-button {
    padding: 24rpx;
    font-size: 28rpx;
  }
}
</style>