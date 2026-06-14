<template>
  <view v-if="show" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,0.1);backdrop-filter:blur(8rpx);display:flex;align-items:center;justify-content:center;" @click="handleOverlayClick">
    <view style="width:600rpx;max-height:80vh;overflow-y:auto;background:#fdfcf9;border:2rpx solid #e5e0d8;padding:32rpx;border-radius:48rpx;box-shadow:0 50rpx 100rpx -20rpx rgba(0,0,0,0.25);" @click.stop>
      <text style="font-size:36rpx;font-style:italic;color:#5a5a40;margin-bottom:32rpx;display:block;">嘎！新计划吗？</text>
      
      <view style="margin-bottom:24rpx;">
        <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">任务内容</text>
        <input
          v-model="localTaskText"
          placeholder="要做什么呢..."
          style="width:100%;height:72rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:32rpx;padding:0 40rpx;font-size:28rpx;outline:none;"
        />
      </view>
      
      <view style="margin-bottom:24rpx;">
        <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">任务详情</text>
        <textarea
          v-model="localTaskDetails"
          placeholder="添加更多详情..."
          style="width:100%;min-height:100rpx;max-height:160rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:32rpx;padding:20rpx 40rpx;font-size:28rpx;outline:none;resize:none;"
        />
      </view>
      
      <view style="margin-bottom:24rpx;">
        <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">开始时间</text>
        <view
          @click="$emit('toggleNewTaskStartTimePicker')"
          style="width:100%;height:72rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:32rpx;padding:0 40rpx;font-size:28rpx;display:flex;align-items:center;justify-content:space-between;cursor:pointer;"
        >
          <text>{{ localStartTime || '选择开始时间' }}</text>
          <Calendar :size="24" />
        </view>
      </view>
      
      <view style="margin-bottom:32rpx;">
        <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">结束时间</text>
        <view
          @click="$emit('toggleNewTaskEndTimePicker')"
          style="width:100%;height:72rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:32rpx;padding:0 40rpx;font-size:28rpx;display:flex;align-items:center;justify-content:space-between;cursor:pointer;"
        >
          <text>{{ localEndTime || '选择结束时间' }}</text>
          <Calendar :size="24" />
        </view>
      </view>
      
      <view style="margin-bottom:32rpx;">
        <view style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12rpx;margin-left:20rpx;">
          <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;">重复日程</text>
          <view @click="localIsRepeat = !localIsRepeat" style="width:80rpx;height:40rpx;background:#e5e0d8;border-radius:20rpx;position:relative;cursor:pointer;" :class="{ 'bg-primary': localIsRepeat }">
            <view style="width:36rpx;height:36rpx;background:#fff;border-radius:50%;position:absolute;top:2rpx;left:2rpx;transition:all 0.3s;" :style="{ transform: localIsRepeat ? 'translateX(40rpx)' : 'translateX(0)' }"></view>
          </view>
        </view>
        <text v-if="localIsRepeat" style="font-size:16rpx;color:#8c857d;margin-left:20rpx;">开启后，每天都会生成此任务</text>
      </view>
      
      <view style="margin-bottom:24rpx;">
        <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">重要级别</text>
        <view style="display:flex;gap:16rpx;margin-left:20rpx;">
          <view 
            @click="localPriority = 'urgent'" 
            style="flex:1;height:64rpx;border:2rpx solid #e5e0d8;border-radius:24rpx;display:flex;align-items:center;justify-content:center;cursor:pointer;" 
            :class="{ 'border-red-500 bg-red-50': localPriority === 'urgent' }"
          >
            <text :style="{ color: localPriority === 'urgent' ? '#ef4444' : '#8c857d' }">紧急</text>
          </view>
          <view 
            @click="localPriority = 'normal'" 
            style="flex:1;height:64rpx;border:2rpx solid #e5e0d8;border-radius:24rpx;display:flex;align-items:center;justify-content:center;cursor:pointer;" 
            :class="{ 'border-green-500 bg-green-50': localPriority === 'normal' }"
          >
            <text :style="{ color: localPriority === 'normal' ? '#22c55e' : '#8c857d' }">一般</text>
          </view>
        </view>
      </view>
      
      <view style="margin-bottom:24rpx;">
        <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">预计耗时(分钟)</text>
        <input
          v-model.number="localEstimatedTime"
          type="number"
          placeholder="例如：30"
          style="width:100%;height:72rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:32rpx;padding:0 40rpx;font-size:28rpx;outline:none;"
        />
      </view>
      
      <view style="margin-bottom:32rpx;">
        <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">启动难度</text>
        <view style="display:flex;gap:16rpx;margin-left:20rpx;">
          <view 
            v-for="difficulty in difficultyOptions" 
            :key="difficulty.value"
            @click="localDifficulty = difficulty.value" 
            style="flex:1;height:64rpx;border:2rpx solid #e5e0d8;border-radius:24rpx;display:flex;align-items:center;justify-content:center;cursor:pointer;" 
            :class="{ 'border-blue-500 bg-blue-50': localDifficulty === difficulty.value }"
          >
            <text :style="{ color: localDifficulty === difficulty.value ? '#3b82f6' : '#8c857d' }">{{ difficulty.label }}</text>
          </view>
        </view>
      </view>
      
      <view style="display:flex;gap:24rpx;">
        <view @click="$emit('cancel')" style="flex:1;height:72rpx;background:#f0ede8;border-radius:32rpx;display:flex;align-items:center;justify-content:center;">
          <text style="font-size:28rpx;font-weight:500;color:#8c857d;">取消</text>
        </view>
        <view @click="handleAdd" style="flex:1;height:72rpx;background:#5a5a40;border-radius:32rpx;display:flex;align-items:center;justify-content:center;box-shadow:0 20rpx 30rpx -10rpx rgba(90,90,64,0.3);">
          <text style="font-size:28rpx;font-weight:500;color:#fff;">添加</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue';
import { Calendar } from 'lucide-vue-next';

const difficultyOptions = [
  { label: '简单', value: 'easy' },
  { label: '中等', value: 'medium' },
  { label: '困难', value: 'hard' }
];

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  taskText: {
    type: String,
    default: ''
  },
  taskDetails: {
    type: String,
    default: ''
  },
  startTime: {
    type: String,
    default: ''
  },
  endTime: {
    type: String,
    default: ''
  },
  isRepeat: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    default: 'normal'
  },
  estimatedTime: {
    type: Number,
    default: 0
  },
  difficulty: {
    type: String,
    default: 'medium'
  }
});

const emit = defineEmits([
  'update:show',
  'add',
  'cancel',
  'toggleNewTaskStartTimePicker',
  'toggleNewTaskEndTimePicker'
]);

// 本地状态
const localTaskText = ref('');
const localTaskDetails = ref('');
const localStartTime = ref('');
const localEndTime = ref('');
const localIsRepeat = ref(false);
const localPriority = ref('normal');
const localEstimatedTime = ref(0);
const localDifficulty = ref('medium');

// 监听 show 变化，当打开时初始化本地状态
watch(() => props.show, (newVal) => {
  if (newVal) {
    localTaskText.value = props.taskText || '';
    localTaskDetails.value = props.taskDetails || '';
    localStartTime.value = props.startTime || '';
    localEndTime.value = props.endTime || '';
    localIsRepeat.value = props.isRepeat || false;
    localPriority.value = props.priority || 'normal';
    localEstimatedTime.value = props.estimatedTime || 0;
    localDifficulty.value = props.difficulty || 'medium';
  }
}, { immediate: true });

// 同时监听 props 变化，更新本地状态
watch(() => [props.taskText, props.taskDetails, props.startTime, props.endTime, props.isRepeat, props.priority, props.estimatedTime, props.difficulty], 
  ([taskText, taskDetails, startTime, endTime, isRepeat, priority, estimatedTime, difficulty]) => {
    if (props.show) {
      localTaskText.value = taskText || '';
      localTaskDetails.value = taskDetails || '';
      localStartTime.value = startTime || '';
      localEndTime.value = endTime || '';
      localIsRepeat.value = isRepeat || false;
      localPriority.value = priority || 'normal';
      localEstimatedTime.value = estimatedTime || 0;
      localDifficulty.value = difficulty || 'medium';
    }
  }
);

const handleOverlayClick = () => {
  emit('cancel');
};

const handleAdd = () => {
  if (!localTaskText.value.trim()) return;
  emit('add', {
    text: localTaskText.value,
    details: localTaskDetails.value,
    startTime: localStartTime.value,
    endTime: localEndTime.value,
    isRepeat: localIsRepeat.value,
    priority: localPriority.value,
    estimatedTime: localEstimatedTime.value,
    difficulty: localDifficulty.value
  });
};

const reset = () => {
  localTaskText.value = '';
  localTaskDetails.value = '';
  localStartTime.value = '';
  localEndTime.value = '';
  localIsRepeat.value = false;
  localPriority.value = 'normal';
  localEstimatedTime.value = 0;
  localDifficulty.value = 'medium';
};

defineExpose({
  reset
});
</script>
