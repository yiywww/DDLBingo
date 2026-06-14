<template>
  <view class="space-y-4">
    <view class="flex flex-col gap-4 mb-6">
      <view class="flex items-center justify-between">
        <view class="text-2xl font-serif italic text-primary">
          {{ selectedScheduleDate === getLocalDateString() ? '今日待办' : '日程' }} <text v-if="!isMainCrowVisible" class="text-sm font-normal text-muted ml-2 animate-pulse">嘎！</text>
        </view>
        <view 
          @click="setShowAddTask(true)"
          class="flex items-center gap-2 px-5 py-2.5 bg-white rounded-2xl shadow-sm border border-border text-sm font-medium text-primary hover:shadow-md transition-all active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> 添加事项
        </view>
      </view>
      <view class="flex items-center justify-between">
        <view 
          @click="toggleBatchMode"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
          :class="batchMode ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-white text-muted border border-border'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          {{ batchMode ? '退出批量模式' : '批量管理' }}
        </view>
        <text v-if="batchMode" class="text-xs text-muted">勾选后点击下方按钮删除</text>
      </view>
      <view class="flex items-center gap-3">
        <view 
          @click="openScheduleDatePicker"
          class="flex-1 bg-white rounded-xl shadow-sm border border-black/5 p-4 flex items-center justify-between cursor-pointer"
        >
          <view>
            <text class="text-sm font-medium text-muted">选择日期</text>
            <text class="text-lg font-semibold text-primary">{{ displaySelectedDate }}</text>
          </view>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        </view>
      </view>
    </view>

    <view v-for="todo in filteredTodos" :key="todo.id" class="group flex items-center gap-2 relative">
      <view v-if="batchMode" 
        @click="toggleSelect(todo.id)" 
        class="w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
        :class="selectedIds.has(String(todo.id)) ? 'bg-red-500 border-red-500' : 'border-gray-300 hover:border-red-400'"
      >
        <svg v-if="selectedIds.has(String(todo.id))" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </view>
      <view 
        :data-todo-id="todo.id"
        class="flex-1 p-6 rounded-[1.5rem] border transition-all shadow-sm relative"
        :class="{
          'border-secondary ring-4 ring-secondary/30 shadow-lg': String(sittingOnId) === String(todo.id),
          'border-yellow-400 scale-[1.05] shadow-xl ring-4 ring-yellow-400/50 z-30': String(dragOverId) === String(todo.id),
          'opacity-70': todo.completed
        }"
        :style="{
          borderColor: getTaskBorderColor(todo),
          backgroundColor: getTaskBackgroundColor(todo)
        }"
        @longpress="showTodoDetailsPopup(todo, $event)"
      >
        <template v-if="String(dragOverId) === String(todo.id)">
          <view class="absolute -top-10 left-1/2 -translate-x-1/2 bg-yellow-400 text-white text-[12px] px-4 py-1.5 rounded-full font-bold animate-bounce whitespace-nowrap shadow-lg ring-2 ring-white z-50 pointer-events-none">
            快放手！我要坐这 🌿
          </view>
        </template>
        <view class="flex items-start gap-3">
          <view 
            @click="toggleTodo(todo.id)"
            class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer mt-0.5" 
            :class="todo.completed ? 'bg-secondary border-secondary' : 'border-border group-hover:border-secondary'"
          >
            <svg v-if="todo.completed" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </view>
          <view class="flex-1">
            <text 
              class="text-sm font-medium" 
              :class="todo.completed ? 'text-muted line-through' : 'text-primary'"
            >{{ todo.text || todo.title }}</text>
            <view v-if="todo.startDate || todo.endDate" class="text-xs text-muted mt-0.5">
              📅 {{ todo.startDate || todo.date }}{{ todo.endDate && todo.endDate !== todo.startDate && todo.endDate !== todo.date ? ' ~ ' + todo.endDate : '' }}
            </view>
            <text v-if="todo.time && !todo.startDate" class="text-xs text-muted">{{ todo.time }}</text>
            
            <view class="flex gap-2 mt-2 flex-wrap">
              <view v-if="(todo.estimatedMinutes > 0 || todo.estimatedTime > 0)" class="px-2 py-1 bg-blue-50 rounded-full text-xs text-blue-600">
                ⏱ {{ todo.estimatedMinutes || todo.estimatedTime }}分钟
              </view>
              <view v-if="(todo.priority && typeof todo.priority === 'number')" class="px-2 py-1 rounded-full text-xs" 
                :class="todo.priority >= 5 ? 'bg-red-50 text-red-600' : todo.priority >= 4 ? 'bg-orange-50 text-orange-600' : todo.priority >= 3 ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'">
                {{ getPriorityLabel(todo.priority) }}
              </view>
              <view v-else-if="todo.priority === 'urgent'" class="px-2 py-1 bg-red-50 rounded-full text-xs text-red-600">
                🚨 紧急
              </view>
              <view v-else-if="todo.priority === 'normal'" class="px-2 py-1 bg-green-50 rounded-full text-xs text-green-600">
                ✅ 一般
              </view>
              <view v-if="todo.difficulty" class="px-2 py-1 bg-purple-50 rounded-full text-xs text-purple-600">
                💪 {{ getDifficultyLabel(todo.difficulty) }}
              </view>
            </view>
          </view>
        </view>
      </view>
      <view class="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <view 
          @click="startEditTask(todo)"
          class="p-2 hover:bg-background rounded-full cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500 hover:text-primary"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </view>
        <view 
          @click="deleteTask(todo.id)"
          class="p-2 hover:bg-background rounded-full cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500 hover:text-red-500"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </view>
      </view>
      
      <transition name="fade">
        <view v-if="String(sittingOnId) === String(todo.id) && !isChatOpen" class="absolute right-8 top-0 -translate-y-[85%] z-50 cursor-grab active:cursor-grabbing crow-drag-container group"
          @mouseenter="setShowCrowMenu(true)"
          @mouseleave="!showTimerPicker && setShowCrowMenu(false)"
          @click.stop
        >
          <Crow 
            :action="crowAction === 'sleep' ? 'sleep' : (crowAction === 'alert' ? 'alert' : 'sitting')"
            :isDraggable="true"
            @click="handleSittingCrowClick"
            @dragStart="handleDragStart"
            @drag="handleDrag"
            @dragEnd="handleDragEnd"
            @flapAway="handleFlapAway"
            @longPress="setShowCrowMenu(true)"
            @actionComplete="crowAction = 'idle'"
          />
          <view class="absolute -top-12 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-[8px] font-medium text-[#5a5a40] shadow-sm border border-border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {{ isTimerRunning ? '计时中...' : '点击召回 🌿' }}
          </view>
          
          <transition name="fade">
            <view v-if="showCrowMenu && !isTimerRunning" class="absolute left-1/2 top-0 z-50">
              <view
                @click="handleTimerClick"
                class="w-16 h-16 flex items-center justify-center transform transition-all duration-300"
                :style="{ transform: showCrowMenu ? 'scale(1) translate(-45%, -40%)' : 'scale(0) translate(-45%, -40%)' }"
              >
                <view
                  class="w-7 h-7 bg-red-400 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-500 transition-colors"
                  style="opacity: 0.8"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </view>
              </view>
            </view>
          </transition>

          <template v-if="isTimerRunning && timeLeft !== null">
            <view class="absolute left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-md border border-red-100 flex items-center gap-2 z-50" :style="{ top: '5px' }">
              <view class="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <text class="text-xs font-mono font-bold text-red-600">{{ formatTime(timeLeft) }}</text>
            </view>
          </template>

          <template v-if="!isTimerRunning && crowAction === 'alert'">
            <view class="absolute left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-2xl shadow-xl font-bold text-sm whitespace-nowrap z-50" :style="{ top: '-30px' }">
              时间到啦！嘎！⏰
              <view class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-red-500 rotate-45" />
            </view>
          </template>
        </view>
      </transition>
    </view>
    
    <transition name="modal">
      <view v-if="showTimerPicker" class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 bg-white rounded-3xl shadow-2xl border border-border p-6 z-[200] cursor-default" @click.stop>
        <view class="flex justify-between items-center mb-6">
          <view class="text-sm font-bold text-primary">番茄钟设置</view>
          <view @click="setShowTimerPicker(false)" class="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </view>
        </view>
        
        <view class="flex flex-col items-center gap-6">
          <view class="text-4xl font-mono font-bold text-red-500">{{ localTimerDuration }}m</view>
          
          <view class="w-full px-4">
            <input 
              type="range" 
              min="1" 
              max="60" 
              v-model="localTimerDuration" 
              @input="handleRangeInput"
              class="w-full h-8 appearance-none cursor-pointer"
              style="
                -webkit-appearance: none; 
                appearance: none; 
                background: linear-gradient(to right, #f87171 0%, #f87171 var(--progress), #f3f4f6 var(--progress), #f3f4f6 100%); 
                border-radius: 9999px;
                height: 2rem;
              "
              :style="{ '--progress': `${(localTimerDuration / 60) * 100}%` }"
            />
            <view class="flex justify-between text-xs text-gray-500 mt-2">
              <span>1m</span>
              <span>30m</span>
              <span>60m</span>
            </view>
          </view>
          
          <view class="flex gap-2 w-full mt-6">
            <view
              @click="startTimer"
              class="flex-1 relative overflow-hidden group"
              style="background: linear-gradient(135deg, #ef4444 0%, #f43f5e 50%, #fb923c 100%); height: 96rpx; border-radius: 32rpx; font-weight: bold; font-size: 28rpx; color: #fff; box-shadow: 0 20rpx 40rpx -10rpx rgba(239, 68, 68, 0.4); transition: all 0.3s;"
            >
              <span style="position: relative; display: flex; align-items: center; justify-content: center; gap: 12rpx; padding-top: 16rpx;">
                <Timer :size="36" />
                开始专注
              </span>
            </view>
          </view>
        </view>
      </view>
    </transition>

    <!-- 批量删除浮动按钮 -->
    <transition name="slide-up">
      <view v-if="batchMode && selectedIds.size > 0" 
        @click="confirmBatchDelete"
        class="fixed bottom-20 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 bg-red-500 text-white rounded-2xl shadow-xl font-bold text-sm flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        删除选中 ({{ selectedIds.size }})
      </view>
    </transition>

    <!-- 确认弹窗 -->
    <view v-if="showBatchConfirm" class="fixed inset-0 z-[400] flex items-center justify-center" @click="showBatchConfirm = false">
      <view class="absolute inset-0 bg-black/40" />
      <view class="relative bg-white rounded-2xl shadow-2xl p-6 mx-8 w-80" @click.stop>
        <view class="text-center mb-4">
          <view class="text-3xl mb-2">⚠️</view>
          <view class="text-sm font-bold text-primary">确认批量删除？</view>
          <view class="text-xs text-muted mt-1">将删除 {{ selectedIds.size }} 项日程，不可恢复</view>
        </view>
        <view class="flex gap-3">
          <view @click="showBatchConfirm = false" class="flex-1 py-2.5 text-center bg-gray-100 rounded-xl text-sm text-muted">取消</view>
          <view @click="executeBatchDelete" class="flex-1 py-2.5 text-center bg-red-500 rounded-xl text-sm text-white font-bold">确认删除</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import Crow from './Crow.vue';
import { Timer } from 'lucide-vue-next';

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const props = defineProps({
  todos: {
    type: Array,
    default: () => []
  },
  repeatTasks: {
    type: Array,
    default: () => []
  },
  completedTasks: {
    type: Array,
    default: () => []
  },
  isMainCrowVisible: {
    type: Boolean,
    default: true
  },
  sittingOnId: {
    type: [String, null],
    default: null
  },
  crowAction: {
    type: String,
    default: 'idle'
  },
  showCrowMenu: {
    type: Boolean,
    default: false
  },
  showTimerPicker: {
    type: Boolean,
    default: false
  },
  timerDuration: {
    type: Number,
    default: 25
  },
  timeLeft: {
    type: [Number, null],
    default: null
  },
  isTimerRunning: {
    type: Boolean,
    default: false
  },
  dragOverId: {
    type: [String, null],
    default: null
  },
  selectedScheduleDate: {
    type: String,
    default: ''
  },
  isChatOpen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'update:todos',
  'toggleTodo',
  'deleteTask',
  'deleteTodos',
  'startEditTask',
  'setShowAddTask',
  'setShowCrowMenu',
  'setShowTimerPicker',
  'startTimer',
  'handleSittingCrowClick',
  'handleDragStart',
  'handleDrag',
  'handleDragEnd',
  'handleFlapAway',
  'update:timerDuration',
  'openScheduleDatePicker'
]);

// ===== 批量删除模式 =====
const batchMode = ref(false);
const selectedIds = ref(new Set());
const showBatchConfirm = ref(false);

const toggleBatchMode = () => {
  batchMode.value = !batchMode.value;
  selectedIds.value = new Set();
  showBatchConfirm.value = false;
};

const toggleSelect = (id) => {
  const key = String(id);
  const newSet = new Set(selectedIds.value);
  if (newSet.has(key)) {
    newSet.delete(key);
  } else {
    newSet.add(key);
  }
  selectedIds.value = newSet;
};

const confirmBatchDelete = () => {
  if (selectedIds.value.size === 0) return;
  showBatchConfirm.value = true;
};

const executeBatchDelete = () => {
  const ids = Array.from(selectedIds.value);
  showBatchConfirm.value = false;
  emit('deleteTodos', ids);
  batchMode.value = false;
  selectedIds.value = new Set();
};
// ===== 批量删除模式结束 =====

const localTimerDuration = ref(props.timerDuration);

watch(() => props.timerDuration, (newVal) => {
  localTimerDuration.value = newVal;
});

const openScheduleDatePicker = () => {
  emit('openScheduleDatePicker');
};

const displaySelectedDate = computed(() => {
  return props.selectedScheduleDate || getLocalDateString();
});

const filteredTodos = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const currentDate = props.selectedScheduleDate || getLocalDateString();
  
  const regularTodos = props.todos.filter(todo => {
    const getDatePart = (dateStr) => {
      if (!dateStr) return '';
      return dateStr.split(' ')[0];
    };
    
    if (!todo.completed) {
      const taskDateStr = todo.startTime || todo.endTime;
      if (taskDateStr) {
        const taskDate = new Date(taskDateStr);
        taskDate.setHours(23, 59, 59, 999);
        if (taskDate < today) {
          const selectedDate = new Date(currentDate);
          return selectedDate >= today;
        }
      }
    }
    
    if (todo.startTime && todo.endTime) {
      const todoStartDate = getDatePart(todo.startTime);
      const todoEndDate = getDatePart(todo.endTime);
      return currentDate >= todoStartDate && currentDate <= todoEndDate;
    } 
    else if (todo.startTime) {
      const todoDate = getDatePart(todo.startTime);
      return todoDate === currentDate;
    }
    return currentDate === getLocalDateString();
  });
  
  const todayRepeatTodos = props.repeatTasks.map(task => {
    const isCompleted = props.completedTasks.some(completed => 
      completed.repeatTaskId === task.id && completed.date === currentDate
    );
    
    return {
      id: `${task.id}_${currentDate}`,
      text: task.text,
      completed: isCompleted,
      time: task.time,
      details: task.details,
      startTime: currentDate,
      endTime: currentDate,
      isRepeat: true,
      repeatTaskId: task.id
    };
  });
  
  const allTodos = [...regularTodos, ...todayRepeatTodos];
  
  allTodos.sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    
    // 提取优先级权重：urgent/P5=5, P4=4, ..., P1=1, 未知=0
    const getPriorityWeight = (todo) => {
      if (todo.priority === 'urgent') return 5;
      if (typeof todo.priority === 'number') return todo.priority;
      return 0;
    };
    const weightA = getPriorityWeight(a);
    const weightB = getPriorityWeight(b);
    if (weightA !== weightB) return weightB - weightA;  // 高优先级在前
    
    if (a.isRepeat && !b.isRepeat) return -1;
    if (!a.isRepeat && b.isRepeat) return 1;
    
    if (a.priority === 'urgent' && b.priority === 'urgent') {
      const todayStr = getLocalDateString();
      const aIsToday = a.endTime === todayStr;
      const bIsToday = b.endTime === todayStr;
      if (aIsToday && !bIsToday) return -1;
      if (!aIsToday && bIsToday) return 1;
    }
    
    return 0;
  });
  
  return allTodos;
});

const getTaskBorderColor = (todo) => {
  if (String(props.sittingOnId) === String(todo.id)) return '#a3b18a';
  if (String(props.dragOverId) === String(todo.id)) return '#facc15';
  if (todo.completed) return '#d1d5db';
  // 兼容数字和字符串 priority：P4-5 或 'urgent' → 暖粉边框
  if (todo.priority === 'urgent' || (typeof todo.priority === 'number' && todo.priority >= 4)) return '#D89982';
  if (todo.isRepeat) return '#DFB199';
  return '#99B6B4';
};

const getTaskBackgroundColor = (todo) => {
  if (String(props.sittingOnId) === String(todo.id)) return '#f5f5f0';
  if (String(props.dragOverId) === String(todo.id)) return '#fffbeb';
  if (todo.completed) return '#f9fafb';
  // 兼容数字和字符串 priority：P4-5 或 'urgent' → 暖粉背景
  if (todo.priority === 'urgent' || (typeof todo.priority === 'number' && todo.priority >= 4)) return '#F8F0F0';
  if (todo.isRepeat) return '#FFF8F0';
  return '#F0F5F5';
};

const toggleTodo = (id) => {
  emit('toggleTodo', id);
};

const deleteTask = (id) => {
  emit('deleteTask', id);
};

const startEditTask = (todo) => {
  emit('startEditTask', todo);
};

const setShowAddTask = (value) => {
  emit('setShowAddTask', value);
};

const setShowCrowMenu = (value) => {
  emit('setShowCrowMenu', value);
};

const setShowTimerPicker = (value) => {
  emit('setShowTimerPicker', value);
};

const startTimer = () => {
  emit('startTimer');
};

const handleSittingCrowClick = (e) => {
  emit('handleSittingCrowClick', e);
};

const handleDragStart = () => {
  emit('handleDragStart');
};

const handleDrag = (event) => {
  emit('handleDrag', event);
};

const handleDragEnd = (event) => {
  emit('handleDragEnd', event);
};

const handleFlapAway = () => {
  emit('handleFlapAway');
};

const handleRangeInput = () => {
  emit('update:timerDuration', localTimerDuration.value);
};

const handleTimerClick = (e) => {
  setShowTimerPicker(true);
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getDifficultyLabel = (difficulty) => {
  const labels = {
    'easy': '简单',
    'medium': '中等',
    'hard': '困难'
  };
  return labels[difficulty] || difficulty;
};

const getPriorityLabel = (priority) => {
  const labels = {
    1: '🎯普通',
    2: '📌一般',
    3: '⭐重要',
    4: '🔥很重​要',
    5: '🚨紧急',
  };
  return labels[priority] || `P${priority}`;
};

const showTodoDetailsPopup = (todo, event) => {
  // emit('showTodoDetails', todo);
};
</script>

<style scoped>
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 1.5rem;
  height: 1.5rem;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  cursor: pointer;
}
input[type="range"]::-moz-range-thumb {
  width: 1.5rem;
  height: 1.5rem;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  cursor: pointer;
  border: none;
}
</style>
