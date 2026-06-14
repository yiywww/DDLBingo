<template>
  <view class="bingo-card-container" @click="handleClick">
    <view 
      class="bingo-card"
      :class="{
        'is-flipped': isFlipped,
        'is-completed': isCompleted,
        'is-timer-running': isTimerRunning
      }"
    >
      <view class="bingo-card-inner">
        <view class="bingo-card-front">
          <view class="blind-box">
            <view class="question-mark">?</view>
            <view class="sparkles">
              <text>✨</text>
              <text>✨</text>
              <text>✨</text>
            </view>
          </view>
        </view>
        <view class="bingo-card-back">
          <view v-if="!isCompleted && !isTimerRunning" class="task-content">
            <view class="task-priority" :class="task?.priority">
              {{ getPriorityLabel(task?.priority) }}
            </view>
            <text class="task-title">{{ task?.text }}</text>
            <text class="task-desc">{{ task?.description }}</text>
            <view class="task-meta">
              <view class="meta-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <text>{{ task?.estimatedTime }}分钟</text>
              </view>
              <view class="meta-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M8 20V10M21 10H3"></path></svg>
                <text>{{ getDifficultyLabel(task?.difficulty) }}</text>
              </view>
            </view>
            <view class="task-ddl" v-if="task?.ddlDate">
              <text class="ddl-text">DDL: {{ task?.ddlDate }}</text>
            </view>
            <view class="start-button" @click.stop="startTimer">
              <text>开始专注</text>
            </view>
          </view>

          <view v-if="isTimerRunning" class="timer-content">
            <view class="timer-display">
              <text class="timer-time">{{ formatTime(timeLeft) }}</text>
              <text class="timer-label">专注中...</text>
            </view>
            <view class="timer-progress">
              <view class="timer-progress-bar" :style="{ width: progressPercent + '%' }"></view>
            </view>
            <view class="crow-animation">
              <Crow :action="crowAction" />
            </view>
            <view class="cancel-button" @click.stop="stopTimer">
              <text>取消</text>
            </view>
          </view>

          <view v-if="isCompleted" class="completed-content">
            <view class="checkmark">✓</view>
            <text class="completed-text">已完成</text>
            <text class="completed-task">{{ task?.text }}</text>
          </view>
        </view>
      </view>

      <canvas 
        v-if="showSmearEffect" 
        class="smear-canvas" 
        ref="smearCanvas"
        @touchstart="handleSmearStart"
        @touchmove="handleSmearMove"
        @touchend="handleSmearEnd"
      ></canvas>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';
import Crow from './Crow.vue';

const props = defineProps({
  task: {
    type: Object,
    default: null
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  isFlipped: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['flip', 'complete', 'startTimer', 'stopTimer']);

const isTimerRunning = ref(false);
const timeLeft = ref(0);
const totalTime = ref(0);
const crowAction = ref('idle');
const showSmearEffect = ref(false);
const smearCanvas = ref(null);
let timerInterval = null;
let smearCtx = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

const progressPercent = computed(() => {
  if (totalTime.value === 0) return 0;
  return ((totalTime.value - timeLeft.value) / totalTime.value) * 100;
});

const getPriorityLabel = (priority) => {
  const labels = {
    'urgent': '紧急',
    'normal': '普通',
    'low': '低'
  };
  return labels[priority] || '普通';
};

const getDifficultyLabel = (difficulty) => {
  const labels = {
    'easy': '简单',
    'medium': '中等',
    'hard': '困难'
  };
  return labels[difficulty] || '中等';
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const handleClick = () => {
  if (!props.isCompleted && !props.isFlipped) {
    emit('flip');
  }
};

const startTimer = () => {
  if (!props.task?.estimatedTime) return;
  
  isTimerRunning.value = true;
  totalTime.value = props.task.estimatedTime * 60;
  timeLeft.value = totalTime.value;
  crowAction.value = 'sitting';
  
  emit('startTimer', props.task);
  
  timerInterval = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--;
    } else {
      stopTimer();
      triggerCompletion();
    }
  }, 1000);
};

const stopTimer = () => {
  isTimerRunning.value = false;
  crowAction.value = 'idle';
  
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  emit('stopTimer');
};

const triggerCompletion = () => {
  showSmearEffect.value = true;
  crowAction.value = 'happy';
  
  setTimeout(() => {
    initSmearCanvas();
  }, 100);
};

const initSmearCanvas = () => {
  const canvas = smearCanvas.value;
  if (!canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  
  smearCtx = canvas.getContext('2d');
  smearCtx.fillStyle = 'rgba(255, 215, 0, 0.3)';
};

const handleSmearStart = (e) => {
  isDrawing = true;
  const touch = e.touches?.[0] || e;
  lastX = touch.clientX - smearCanvas.value.getBoundingClientRect().left;
  lastY = touch.clientY - smearCanvas.value.getBoundingClientRect().top;
};

const handleSmearMove = (e) => {
  if (!isDrawing || !smearCtx) return;
  
  e.preventDefault();
  const touch = e.touches?.[0] || e;
  const currentX = touch.clientX - smearCanvas.value.getBoundingClientRect().left;
  const currentY = touch.clientY - smearCanvas.value.getBoundingClientRect().top;
  
  smearCtx.beginPath();
  smearCtx.moveTo(lastX, lastY);
  smearCtx.lineTo(currentX, currentY);
  smearCtx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
  smearCtx.lineWidth = 60;
  smearCtx.lineCap = 'round';
  smearCtx.stroke();
  
  lastX = currentX;
  lastY = currentY;
  
  checkCompletion();
};

const handleSmearEnd = () => {
  isDrawing = false;
};

const checkCompletion = () => {
  const canvas = smearCanvas.value;
  if (!canvas || !smearCtx) return;
  
  const imageData = smearCtx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  
  let paintedPixels = 0;
  let totalPixels = pixels.length / 4;
  
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] > 0) {
      paintedPixels++;
    }
  }
  
  if (paintedPixels / totalPixels > 0.5) {
    completeTask();
  }
};

const completeTask = () => {
  showSmearEffect.value = false;
  emit('complete', props.task);
};

onUnmounted(() => {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
});
</script>

<style scoped>
/* Bingo Card Theme - Inspired by 可翻牌的Bingo九宫格 */

/* Color Theme Variables */
.bingo-card-container {
  --card-yellow: #fcea51;
  --card-light-yellow: #f5f6af;
  --card-light-green: #c8deae;
  --card-green: #85b251;
  --card-dark-green: #4a7a1e;
  --card-white: #fffef0;
}

/* Animations */
@keyframes ringOut {
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.18); }
}

@keyframes pulseScale {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes brushStroke {
  0% { stroke-dashoffset: 130; }
  100% { stroke-dashoffset: 0; }
}

@keyframes shimmerSparkle {
  0%, 100% { opacity: 0.6; transform: translateY(0) scale(1); }
  50% { opacity: 1; transform: translateY(-3px) scale(1.2); }
}

.bingo-card-container {
  perspective: 900px;
  width: 100%;
  aspect-ratio: 1;
}

.bingo-card {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.34, 1.4, 0.64, 1);
  cursor: pointer;
}

.bingo-card.is-flipped {
  transform: rotateY(180deg);
}

.bingo-card.is-completed {
  pointer-events: none;
}

.bingo-card-inner {
  position: absolute;
  width: 100%;
  height: 100%;
  transition: transform 0.6s;
  transform-style: preserve-3d;
}

.bingo-card.is-flipped .bingo-card-inner {
  transform: rotateY(180deg);
}

.bingo-card-front,
.bingo-card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.bingo-card-front {
  /* Card Theme Colors based on index */
  background: linear-gradient(135deg, #fcea51 0%, #f5f6af 100%);
  box-shadow: 0 6px 24px rgba(133, 178, 81, 0.25), 0 3px 14px rgba(74, 122, 30, 0.13);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.bingo-card-back {
  background: linear-gradient(135deg, #c8deae 0%, #85b251 100%);
  transform: rotateY(180deg);
  padding: 20rpx;
  box-sizing: border-box;
  box-shadow: 0 4px 20px rgba(133, 178, 81, 0.44);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Front Card - Blind Box Design */
.blind-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  position: relative;
}

.question-mark {
  font-size: 100rpx;
  font-weight: bold;
  color: #4a7a1e;
  text-shadow: 0 4rpx 8rpx rgba(74, 122, 30, 0.3);
  animation: pulseScale 2s ease-in-out infinite;
  font-family: 'Fredoka', sans-serif;
}

.sparkles {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
  animation: shimmerSparkle 1.5s ease-in-out infinite;
}

.sparkles text {
  font-size: 32rpx;
}

/* Selection Glow Effect */
.bingo-selection-glow {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(circle at 50% 50%, rgba(133, 178, 81, 0.3) 0%, transparent 70%);
  pointer-events: none;
  z-index: 10;
}

/* Ring Ripple Effect */
.ring-ripple {
  position: absolute;
  inset: -2px;
  border-radius: 24rpx;
  border: 3px solid #85b251;
  animation: ringOut 0.5s ease-out forwards;
  pointer-events: none;
  z-index: 20;
}

/* Brush Stroke SVG Overlay */
.brush-stroke-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  border-radius: inherit;
  z-index: 15;
}

.brush-stroke-overlay svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.brush-stroke-overlay .primary-stroke {
  stroke: rgba(133, 178, 81, 0.72);
  stroke-width: 24;
  stroke-linecap: round;
  fill: none;
  stroke-dasharray: 130;
  stroke-dashoffset: 0;
}

.brush-stroke-overlay .secondary-stroke {
  stroke: rgba(245, 246, 175, 0.55);
  stroke-width: 14;
  stroke-linecap: round;
  fill: none;
  stroke-dasharray: 130;
  stroke-dashoffset: 0;
}

/* Task Content */
.task-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  position: relative;
  z-index: 5;
}

.task-priority {
  align-self: flex-start;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 2rpx;
}

.task-priority.urgent {
  background: rgba(220, 38, 38, 0.15);
  color: #dc2626;
  border: 1px solid rgba(220, 38, 38, 0.3);
}

.task-priority.normal {
  background: rgba(37, 99, 235, 0.15);
  color: #2563eb;
  border: 1px solid rgba(37, 99, 235, 0.3);
}

.task-priority.low {
  background: rgba(22, 163, 74, 0.15);
  color: #16a34a;
  border: 1px solid rgba(22, 163, 74, 0.3);
}

.task-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #1a3a08;
  line-height: 1.4;
  font-family: 'Fredoka', sans-serif;
}

.task-desc {
  font-size: 26rpx;
  color: rgba(26, 58, 8, 0.7);
  line-height: 1.4;
  flex: 1;
}

.task-meta {
  display: flex;
  gap: 20rpx;
  margin-top: auto;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 24rpx;
  color: rgba(26, 58, 8, 0.6);
}

.task-ddl {
  margin-top: 8rpx;
  padding: 6rpx 12rpx;
  background: rgba(220, 38, 38, 0.1);
  border-radius: 8rpx;
  border-left: 3rpx solid #dc2626;
}

.ddl-text {
  font-size: 20rpx;
  color: #dc2626;
  font-weight: 600;
}

.start-button {
  background: linear-gradient(135deg, #4a7a1e 0%, #85b251 100%);
  color: #fff;
  padding: 20rpx;
  border-radius: 24rpx;
  text-align: center;
  font-size: 30rpx;
  font-weight: bold;
  box-shadow: 0 6px 20rpx rgba(74, 122, 30, 0.4);
  transition: all 0.3s;
  font-family: 'Fredoka', sans-serif;
}

.start-button:active {
  transform: scale(0.95);
}

/* Timer Content */
.timer-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  position: relative;
  z-index: 5;
}

.timer-display {
  text-align: center;
}

.timer-time {
  font-size: 80rpx;
  font-weight: bold;
  color: #fff;
  font-family: 'Fredoka', sans-serif;
  text-shadow: 0 2rpx 4rpx rgba(74, 122, 30, 0.5);
}

.timer-label {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
  display: block;
  margin-top: 8rpx;
  font-family: 'Nunito', sans-serif;
}

.timer-progress {
  width: 100%;
  height: 14rpx;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 7rpx;
  overflow: hidden;
}

.timer-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #fcea51, #f5f6af);
  transition: width 1s linear;
  border-radius: 7rpx;
}

.crow-animation {
  width: 100rpx;
  height: 100rpx;
}

.cancel-button {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 16rpx 48rpx;
  border-radius: 24rpx;
  font-size: 26rpx;
  font-weight: bold;
  backdrop-filter: blur(8px);
  transition: all 0.3s;
}

.cancel-button:active {
  transform: scale(0.95);
}

/* Completed Content */
.completed-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  background: linear-gradient(135deg, rgba(252, 234, 81, 0.9) 0%, rgba(133, 178, 81, 0.9) 100%);
  border-radius: 24rpx;
  position: relative;
  overflow: hidden;
}

.completed-content::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3) 0%, transparent 50%);
}

.checkmark {
  width: 100rpx;
  height: 100rpx;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60rpx;
  color: #85b251;
  box-shadow: 0 4px 20rpx rgba(133, 178, 81, 0.5);
  animation: pulseScale 0.5s ease-out;
  position: relative;
  z-index: 1;
}

.completed-text {
  font-size: 36rpx;
  font-weight: bold;
  color: #4a7a1e;
  position: relative;
  z-index: 1;
  font-family: 'Fredoka', sans-serif;
}

.completed-task {
  font-size: 26rpx;
  color: #1a3a08;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  position: relative;
  z-index: 1;
}

/* Smear Canvas */
.smear-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 24rpx;
  pointer-events: auto;
  z-index: 30;
  background: transparent;
}

/* Timer Running State */
.bingo-card.is-timer-running {
  pointer-events: none;
}

.bingo-card.is-timer-running .timer-content,
.bingo-card.is-timer-running .cancel-button {
  pointer-events: auto;
}

/* Responsive Text Sizes */
@media screen and (max-width: 320px) {
  .question-mark {
    font-size: 80rpx;
  }
  
  .task-title {
    font-size: 30rpx;
  }
  
  .task-desc {
    font-size: 22rpx;
  }
  
  .timer-time {
    font-size: 60rpx;
  }
}
</style>