<template>
  <view 
    ref="mainCrowRef"
    class="w-full h-[28rem] bg-surface rounded-[2.5rem] border border-border shadow-sm flex flex-col items-center justify-center p-10 relative group"
  >
    <view class="absolute bottom-0 left-0 right-0 h-1/3 bg-[#f0f4f0]/50 -z-10" />
    <view class="absolute top-10 right-10 w-24 h-24 bg-[#fff9e6] rounded-full blur-3xl opacity-60 animate-pulse" />
    
    <template v-if="!isBingoMode">
      <view 
        class="absolute top-4 right-[-20rpx] px-3 py-1.5 bg-gradient-to-r from-[#5a5a40] to-[#3d3d30] text-white text-[10px] font-bold rounded-full shadow-md hover:shadow-lg transition-all hover:scale-105 cursor-pointer z-20"
        @click="$emit('openBingo')"
      >
        DDLBINGO
      </view>
      
      <view class="absolute top-8 left-6 flex flex-col gap-3 w-2/3">
        <view class="flex flex-col gap-1.5">
          <view class="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted">
            <text>Hunger</text>
            <text>{{ crowStats.hunger }}%</text>
          </view>
          <view class="h-1.5 w-full bg-[#f0ede8] rounded-full overflow-hidden">
            <view 
              class="h-full bg-accent transition-all duration-300"
              :style="{ width: `${crowStats.hunger}%` }"
            />
          </view>
        </view>
        <view class="flex flex-col gap-1.5">
          <view class="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted">
            <text>Mood</text>
            <text>{{ crowStats.mood }}%</text>
          </view>
          <view class="h-1.5 w-full bg-[#f0ede8] rounded-full overflow-hidden">
            <view 
              class="h-full bg-secondary transition-all duration-300"
              :style="{ width: `${crowStats.mood}%` }"
            />
          </view>
        </view>
        <view class="flex flex-col gap-1.5">
          <view class="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted">
            <text>Food</text>
            <text>{{ foodCount }} 🥣</text>
          </view>
          <view class="h-1.5 w-full bg-[#f0ede8] rounded-full overflow-hidden">
            <view 
              class="h-full bg-yellow-400 transition-all duration-300"
              :style="{ width: `${Math.min(100, (foodCount / 10) * 100)}%` }"
            />
          </view>
        </view>
      </view>

      <template v-if="!sittingOnId">
        <view 
          v-if="isMainCrowVisible && !isChatOpen"
          class="relative z-[100] cursor-grab active:cursor-grabbing crow-drag-container"
          @click="$emit('click')"
        >
          <Crow 
            :action="isCrowFainted ? 'faint' : crowAction" 
            :isDraggable="!isCrowFainted" 
            @click="$emit('click')"
            @dragStart="$emit('dragStart', $event)"
            @drag="$emit('drag', $event)"
            @dragEnd="$emit('dragEnd', $event)"
          >
            <template #tooltip>
              <view class="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-medium text-[#5a5a40] shadow-sm border border-border whitespace-nowrap">
                {{ isCrowFainted ? '乌鸦晕倒了，需要喂食！' : '完成任务可增加进度嘎！ 🌿' }}
              </view>
            </template>
          </Crow>
        </view>
        
        <view class="mt-4 text-center min-h-[3rem]">
          <transition name="fade">
            <text 
              key="crowAction"
              class="text-sm text-[#5a5a40] italic font-serif"
            >
              {{ crowMessage }}
            </text>
          </transition>
        </view>
        
        <view class="mt-6 flex gap-3 w-full">
          <view 
            @click="$emit('openChat')"
            class="flex-1 px-4 py-3 bg-primary text-white text-xs font-medium rounded-2xl hover:bg-[#4a4a35] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> 对话
          </view>
          <view 
            @click="$emit('feed')"
            class="flex-1 px-4 py-3 bg-white border border-border text-[#5a5a40] text-xs font-medium rounded-2xl hover:bg-surface transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
          >
            🥣 投喂
          </view>
        </view>
      </template>
      
      <template v-else>
        <view class="absolute inset-0 flex flex-col items-center justify-center">
          <text class="text-xs text-muted italic animate-pulse">嘎！我去忙啦...</text>
          <view 
            @click="$emit('findCrow')"
            class="mt-4 px-4 py-2 bg-primary/10 text-primary text-xs font-medium rounded-xl hover:bg-primary/20 transition-all"
          >
            寻找拾鸦
          </view>
        </view>
      </template>
    </template>

    <template v-else>
      <view class="absolute inset-0 bg-[#f8fdf2] rounded-[2.5rem] flex flex-col p-5 z-10">
        <view class="flex items-center justify-between mb-4">
          <view class="bingo-header-title">
            <text class="text-base font-bold">🐦 BINGO 九宫格 🌿</text>
          </view>
          <view 
            @click="$emit('closeBingo')"
            class="w-8 h-8 rounded-full bg-white/70 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm border border-[#c8deae]/30"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a7a1e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </view>
        </view>
        
        <view class="flex gap-3 mb-4">
          <view 
            class="flex-1 px-4 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer"
            :class="bingoMode === 'single' ? 'bg-gradient-to-r from-[#85b251] to-[#a0d040] text-white shadow-md shadow-[#85b251]/30' : 'bg-white/70 text-[#4a7a1e] border border-[#c8deae]/50'"
            @click="$emit('switchBingoMode', 'single')"
          >
            单人模式
          </view>
          <view 
            class="flex-1 px-4 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer"
            :class="bingoMode === 'team' ? 'bg-gradient-to-r from-[#85b251] to-[#a0d040] text-white shadow-md shadow-[#85b251]/30' : 'bg-white/70 text-[#4a7a1e] border border-[#c8deae]/50'"
            @click="$emit('switchBingoMode', 'team')"
          >
            小组协作
          </view>
        </view>
        
        <view class="flex-1 overflow-hidden overflow-y-auto overflow-x-hidden">
          <slot name="bingo-content"></slot>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import Crow from './Crow.vue';

const props = defineProps({
  crowStats: {
    type: Object,
    required: true
  },
  foodCount: {
    type: Number,
    required: true
  },
  isMainCrowVisible: {
    type: Boolean,
    default: true
  },
  isCrowFainted: {
    type: Boolean,
    default: false
  },
  crowAction: {
    type: String,
    default: 'idle'
  },
  sittingOnId: {
    type: [String, null],
    default: null
  },
  isChatOpen: {
    type: Boolean,
    default: false
  },
  isBingoMode: {
    type: Boolean,
    default: false
  },
  bingoMode: {
    type: String,
    default: 'single'
  }
});

defineEmits(['click', 'feed', 'openChat', 'findCrow', 'openBingo', 'closeBingo', 'switchBingoMode', 'dragStart', 'drag', 'dragEnd']);

const crowMessage = computed(() => {
  if (props.isCrowFainted) {
    return '我需要食物...';
  }
  
  if (props.crowAction === 'happy') {
    return '我很开心嘎！';
  }
  
  if (props.crowAction === 'eat') {
    return '好吃！谢谢喂食！';
  }
  
  if (props.crowAction === 'sleep') {
    return '让我休息一下...';
  }
  
  if (props.foodCount === 0) {
    return '肚子饿了...';
  }
  
  const mood = props.crowStats.mood;
  if (mood < 30) {
    return '有点无聊...';
  } else if (mood < 60) {
    return '今天怎么样？';
  } else {
    const messages = [
      '今天想做什么呢？',
      '完成任务会让我开心的！',
      '记得经常来看我哦！',
      '有什么新鲜事吗？'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
});
</script>
