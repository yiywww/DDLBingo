<template>
  <view 
    class="relative group cursor-pointer"
    :class="{ 
      'cursor-grab active:cursor-grabbing': props.isDraggable,
      'crow-no-select': isDragging,
      'crow-draggable': isDragging 
    }"
    @click="handleClick"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchEnd"
  >
    <view 
    ref="crowContainer"
    style="width: 96px; height: 96px; display: flex; align-items: center; justify-content: center; position: relative;"
    :class="{
      'animate-hop': currentAction === 'hop',
      'animate-flap': currentAction === 'flap' && !isDragging,
      'animate-think': currentAction === 'think',
      'animate-sleep': currentAction === 'sleep',
      'animate-alert': currentAction === 'alert',
      'animate-idle': currentAction === 'idle' && !props.action,
      'animate-faint': currentAction === 'faint'
    }"
    :style="dragStyle"
  >
      <svg viewBox="0 0 32 32" class="w-full h-full shape-rendering-pixelated drop-shadow-lg">
        <!-- Shadow/Ground -->
        <ellipse cx="16" cy="30" rx="6" ry="1.5" fill="#000" :opacity="(currentAction === 'sitting' || currentAction === 'faint') ? 0.05 : 0.1" />

        <!-- Legs -->
        <g
          :style="{
            opacity: 1,
            transform: `translateY(${(currentAction === 'sitting' || currentAction === 'sleep' || currentAction === 'faint') ? '2px' : '0px'}) scaleY(${(currentAction === 'sitting' || currentAction === 'sleep' || currentAction === 'faint') ? 0.7 : 1})`
          }"
        >
          <rect x="13" y="27" width="1" height="3" fill="#333" />
          <rect x="12" y="30" width="3" height="1" fill="#333" />
          <rect x="18" y="27" width="1" height="3" fill="#333" />
          <rect x="17" y="30" width="3" height="1" fill="#333" />
        </g>

        <!-- Body - Main Round Shape -->
        <g
          :style="{
            transform: 
              (currentAction === 'sitting' || currentAction === 'sleep' || currentAction === 'alert' || currentAction === 'faint') 
                ? 'scaleY(0.92) scaleX(1.05) translateY(2px)'
                : currentAction === 'idle' 
                ? 'scale(1.03) translateY(-0.5px)'
                : 'none'
          }"
        >
          <!-- Main Body Silhouette -->
          <path d="M10 12 Q10 6 16 6 Q22 6 22 12 L24 20 Q24 28 16 28 Q8 28 8 20 Z" fill="#4a4a4a" />
          <path d="M11 13 Q11 8 16 8 Q21 8 21 13 L22 20 Q22 26 16 26 Q10 26 10 20 Z" fill="#5c5c5c" />
          
          <!-- Leaf Collar -->
          <g>
            <g v-for="(pos, i) in flowerPositions" :key="`leaf-${i}`" :transform="`translate(${pos.x}, ${pos.y}) rotate(${i * 60})`">
              <path d="M0 -2 Q1 -1 0.5 1 Q0 2 -0.5 1 Q-1 -1 0 -2" fill="#8BC34A" />
              <path d="M0 -1.8 L0 1.8" stroke="#388E3C" stroke-width="0.2" fill="none" />
            </g>
          </g>
          <!-- Gap Flowers -->
          <g>
            <g v-for="(pos, i) in gapFlowerPositions" :key="`flower-${i}`" :transform="`translate(${pos.x}, ${pos.y})`">
              <circle cx="0" cy="-0.5" r="0.6" fill="#fff" />
              <circle cx="0.5" cy="0" r="0.6" fill="#fff" />
              <circle cx="0" cy="0.5" r="0.6" fill="#fff" />
              <circle cx="-0.5" cy="0" r="0.6" fill="#fff" />
              <circle cx="0" cy="0" r="0.3" fill="#ffd700" />
            </g>
          </g>
          
          <!-- Wings -->
          <rect 
            x="7" y="19" width="3" height="4" rx="1" fill="#4a4a4a" 
            :class="{'animate-wing-flap-left': currentAction === 'flap' || isDragging}"
          />
          <rect 
            x="22" y="19" width="3" height="4" rx="1" fill="#4a4a4a" 
            :class="{'animate-wing-flap-right': currentAction === 'flap' || isDragging}"
          />

          <!-- Head Features -->
            <g
              :class="{
                'animate-peck': currentAction === 'peck',
                'animate-happy': currentAction === 'happy'
              }"
            >
            <!-- Eyes -->
            <template v-if="currentAction === 'sleep'">
              <rect x="11" y="13" width="4" height="1" fill="#333" opacity="0.6" />
              <rect x="17" y="13" width="4" height="1" fill="#333" opacity="0.6" />
            </template>
            <template v-else-if="currentAction === 'alert'">
              <circle cx="13" cy="13.5" r="2.5" fill="#ffffff" />
              <circle cx="13" cy="13.5" r="1" fill="#000000" />
              <circle cx="19" cy="13.5" r="2.5" fill="#ffffff" />
              <circle cx="19" cy="13.5" r="1" fill="#000000" />
            </template>
            <template v-else-if="currentAction === 'faint'">
              <!-- Fainted eyes -->
              <path d="M10 12 L14 15" stroke="#000000" stroke-width="1" fill="none" />
              <path d="M14 12 L10 15" stroke="#000000" stroke-width="1" fill="none" />
              <path d="M18 12 L22 15" stroke="#000000" stroke-width="1" fill="none" />
              <path d="M22 12 L18 15" stroke="#000000" stroke-width="1" fill="none" />
            </template>
            <template v-else-if="isDragging">
              <!-- Expressive eyes when dragging -->
              <path d="M11 13 L14 14.5 L11 16" stroke="#000000" stroke-width="1" fill="none" />
              <path d="M21 13 L18 14.5 L21 16" stroke="#000000" stroke-width="1" fill="none" />
            </template>
            <template v-else-if="isBlinking">
              <rect x="11" y="13" width="4" height="1" fill="#333" />
              <rect x="17" y="13" width="4" height="1" fill="#333" />
            </template>
            <template v-else-if="currentAction === 'peck'">
              <!-- Star eyes when eating -->
              <circle cx="13" cy="13.5" r="2.5" fill="#ffffff" />
              <path d="M13 11.5 L13.6 12.7 L14.8 12.9 L13.9 13.8 L14.1 15.1 L13 14.5 L11.9 15.1 L12.1 13.8 L11.2 12.9 L12.4 12.7 Z" fill="#ffd700" />
              <circle cx="19" cy="13.5" r="2.5" fill="#ffffff" />
              <path d="M19 11.5 L19.6 12.7 L20.8 12.9 L19.9 13.8 L20.1 15.1 L19 14.5 L17.9 15.1 L18.1 13.8 L17.2 12.9 L18.4 12.7 Z" fill="#ffd700" />
            </template>
            <template v-else>
              <circle cx="13" cy="13.5" r="2.5" fill="#ffffff" />
              <circle cx="13" cy="13.5" r="1" fill="#000000" />
              <circle cx="19" cy="13.5" r="2.5" fill="#ffffff" />
              <circle cx="19" cy="13.5" r="1" fill="#000000" />
            </template>

            <!-- Beak -->
            <path 
              d="M15 15 L17 15 L16 17 Z" 
              fill="#222"
              :class="{'animate-beak-open': currentAction === 'peck'}"
            />

            <!-- Blush -->
            <g :class="{'opacity-100': currentAction === 'happy', 'opacity-40': currentAction !== 'happy'}">
              <rect x="9" y="14" width="2" height="1.5" rx="0.5" fill="#ff8080" />
              <rect x="21" y="14" width="2" height="1.5" rx="0.5" fill="#ff8080" />
            </g>
            
            <!-- Food crumbs -->
            <g v-if="currentAction === 'peck'">
              <circle cx="14" cy="20" r="0.5" fill="#ffd700" class="animate-crumb-left" />
              <circle cx="16" cy="21" r="0.5" fill="#ffc107" class="animate-crumb-center" />
              <circle cx="18" cy="20" r="0.5" fill="#ffd700" class="animate-crumb-right" />
            </g>
          </g>
        </g>
      </svg>

      <!-- Interaction Feedback -->
      <template v-if="currentAction === 'alert'">
        <view class="absolute top-0 left-1/2 -translate-x-1/2 text-4xl font-black text-red-500 pointer-events-none select-none drop-shadow-sm animate-alert-symbol">
          !
        </view>
      </template>
      <template v-if="currentAction === 'happy'">
        <view class="absolute top-0 left-1/2 -translate-x-1/2 flex gap-1 animate-happy-emojis">
          <text class="text-2xl">✨</text>
          <text class="text-2xl">💖</text>
        </view>
      </template>
      <template v-if="currentAction === 'sleep'">
        <view class="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl font-mono text-blue-400/80 pointer-events-none select-none animate-sleep-zzz">
          Zzz
        </view>
      </template>
      <template v-if="currentAction === 'faint'">
        <view class="absolute top-2 left-1/2 -translate-x-1/2">
          <view class="w-1 h-1 bg-black/60 rounded-full animate-debris-1"></view>
          <view class="w-1 h-1 bg-black/60 rounded-full animate-debris-2"></view>
          <view class="w-1 h-1 bg-black/60 rounded-full animate-debris-3"></view>
          <view class="w-1 h-1 bg-black/60 rounded-full animate-debris-4"></view>
        </view>
      </template>

      <!-- Custom Tooltip Slot -->
      <slot name="tooltip"></slot>

      <!-- Hover Tooltip -->
      <view class="absolute -bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-60 transition-opacity bg-black/80 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none">
        点击互动 | Click to interact
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps({
  action: {
    type: String,
    default: 'idle'
  },
  isDraggable: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['actionComplete', 'click', 'dragStart', 'dragEnd', 'drag', 'longPress']);

const internalAction = ref('idle');
const isBlinking = ref(false);
const crowContainer = ref(null);
const isDragging = ref(false);
const isLongPress = ref(false);
const dragStartPos = ref({ x: 0, y: 0 });
const dragOffset = ref({ x: 0, y: 0 });
let longPressTimer = null;
const LONG_PRESS_DURATION = 500; // 长按时间阈值，单位毫秒

// 晃动相关状态
const isShaking = ref(false);
const shakeAngle = ref(0);
const shakeIntensity = ref(5); // 晃动幅度
const clickCount = ref(0);
const lastClickTime = ref(0);
const CLICK_INTERVAL = 500; // 连续点击时间间隔阈值

const currentAction = computed(() => {
  // 检查是否有晕倒状态
  if (props.action === 'faint') {
    return 'faint';
  }
  return props.action || internalAction.value;
});

const dragStyle = computed(() => {
  // 即使拖拽结束，也要保持拖拽后的位置
  let transform = `translate(${dragOffset.value.x}px, ${dragOffset.value.y}px)`;
  
  // 添加晃动效果
  if (isShaking.value) {
    transform += ` rotate(${shakeAngle.value}deg)`;
  }
  
  // 根据拖拽状态设置不同的 z-index
  const zIndex = isDragging.value ? 99999 : 1000;
  
  return {
    transform: transform,
    position: 'relative',
    zIndex: zIndex,
    // 确保拖拽结束后位置保持固定，不受动画影响
    animation: 'none',
    // 重置任何可能影响位置的transform属性
    'transform-origin': 'center center'
  };
});

const flowerPositions = [
  { x: 8.5, y: 19 }, { x: 11.5, y: 21 }, { x: 14.5, y: 22 }, 
  { x: 17.5, y: 22 }, { x: 20.5, y: 21 }, { x: 23.5, y: 19 }
];
const gapFlowerPositions = [
  { x: 10, y: 20 }, { x: 13, y: 21.5 }, { x: 16, y: 22 },
  { x: 19, y: 21.5 }, { x: 22, y: 20 }
];

let idleInterval = null;
let blinkInterval = null;
let actionResetTimer = null;

// Random idle behaviors
const startIdleBehavior = () => {
  idleInterval = setInterval(() => {
    if (props.action) return;
    
    const rand = Math.random();
    if (rand < 0.1) internalAction.value = 'peck';
    else if (rand < 0.2) internalAction.value = 'hop';
    else if (rand < 0.15) internalAction.value = 'flap';
    else if (rand < 0.05) internalAction.value = 'sleep';
    else internalAction.value = 'idle';
  }, 4000);
};

// Blink effect
const startBlinking = () => {
  blinkInterval = setInterval(() => {
    if (currentAction.value !== 'sleep') {
      isBlinking.value = true;
      setTimeout(() => isBlinking.value = false, 150);
    }
  }, 3500 + Math.random() * 3000);
};

// Reset internal action after animation
watch(currentAction, (newAction) => {
  if (newAction !== 'idle' && newAction !== 'sleep' && !props.action) {
    if (actionResetTimer) clearTimeout(actionResetTimer);
    actionResetTimer = setTimeout(() => {
      internalAction.value = 'idle';
      emit('actionComplete');
    }, 1500);
  }
});

// 开始晃动动画
const startShaking = () => {
  isShaking.value = true;
  let currentAngle = 0;
  let direction = 1;
  const duration = 1000; // 晃动持续时间
  const startTime = Date.now();
  
  const shakeAnimation = () => {
    const elapsed = Date.now() - startTime;
    if (elapsed < duration) {
      // 计算当前角度，使用正弦函数模拟不倒翁效果
      currentAngle = Math.sin(Date.now() * 0.01) * shakeIntensity.value * direction;
      shakeAngle.value = currentAngle;
      requestAnimationFrame(shakeAnimation);
    } else {
      // 晃动结束，恢复到初始状态
      isShaking.value = false;
      shakeAngle.value = 0;
      // 重置晃动强度
      setTimeout(() => {
        shakeIntensity.value = 5;
      }, 500);
    }
  };
  
  shakeAnimation();
};

const handleClick = () => {
  if (!isDragging.value && !isLongPress.value) {
    // 检查是否睡着
    if (currentAction.value === 'sleep') {
      // 惊醒，显示感叹号
      internalAction.value = 'alert';
      // 通知父组件乌鸦被惊醒
      emit('actionComplete');
      setTimeout(() => {
        internalAction.value = 'idle';
      }, 1000);
    } else if (currentAction.value === 'sitting') {
      // 只有坐着的时候才触发晃动机制
      // 计算点击间隔
      const now = Date.now();
      if (now - lastClickTime.value < CLICK_INTERVAL) {
        // 连续点击
        clickCount.value++;
        // 增加晃动幅度
        shakeIntensity.value += 3;
        
        // 第三次点击，飞起来并脱离坐着机制
        if (clickCount.value >= 3) {
          internalAction.value = 'flap';
          clickCount.value = 0;
          shakeIntensity.value = 5;
          // 飞起来后不再回到坐着状态，而是回到空闲状态
          setTimeout(() => {
            internalAction.value = 'idle';
          }, 1500);
          // 触发事件通知父组件乌鸦已脱离坐着状态
          emit('flapAway');
        } else {
          // 开始晃动
          startShaking();
        }
      } else {
        // 不是连续点击，重置计数
        clickCount.value = 1;
        shakeIntensity.value = 5;
        // 开始晃动
        startShaking();
      }
      
      lastClickTime.value = now;
    }
    
    emit('click');
  }
};

const handleMouseDown = (e) => {
  // 清除之前的长按定时器
  if (longPressTimer) {
    clearTimeout(longPressTimer);
  }
  
  // 睡眠状态时先惊醒
  if (currentAction.value === 'sleep') {
    // 惊醒，显示感叹号
    internalAction.value = 'alert';
    setTimeout(() => {
      internalAction.value = 'idle';
    }, 1000);
    return;
  }
  
  // 坐下状态时触发长按事件
  if (currentAction.value === 'sitting') {
    longPressTimer = setTimeout(() => {
      emit('longPress');
    }, LONG_PRESS_DURATION);
    return;
  }
  
  // 可拖拽状态下的长按逻辑
  if (props.isDraggable) {
    // 设置长按定时器
    longPressTimer = setTimeout(() => {
      // 进入拖拽时临时禁用复制粘贴
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.userSelect = 'none';
        document.body.style.webkitTouchCallout = 'none';
      }
      
      isLongPress.value = true;
      isDragging.value = true;
      // 开始拖拽时设置翅膀扇动动画
      internalAction.value = 'flap';
      dragStartPos.value = {
        x: e.clientX,
        y: e.clientY
      };
      emit('dragStart', { x: e.clientX, y: e.clientY });
      if (typeof document !== 'undefined') {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
    }, LONG_PRESS_DURATION);
  }
};

// 优化拖拽性能，使用requestAnimationFrame
let dragAnimationFrame = null;
let lastDragPos = { x: 0, y: 0 };

const handleMouseMove = (e) => {
  if (!isDragging.value) return;
  
  // 取消之前的动画帧
  if (dragAnimationFrame) {
    cancelAnimationFrame(dragAnimationFrame);
  }
  
  // 使用requestAnimationFrame优化拖拽性能
  dragAnimationFrame = requestAnimationFrame(() => {
    // 计算相对移动距离
    const deltaX = e.clientX - dragStartPos.value.x;
    const deltaY = e.clientY - dragStartPos.value.y;
    
    // 更新位置
    const newX = dragOffset.value.x + deltaX;
    const newY = dragOffset.value.y + deltaY;
    
    dragOffset.value = {
      x: newX,
      y: newY
    };
    lastDragPos = { x: newX, y: newY };
    
    // 更新拖拽开始位置，用于下一次计算
    dragStartPos.value = {
      x: e.clientX,
      y: e.clientY
    };
    
    emit('drag', { x: e.clientX, y: e.clientY, deltaX, deltaY });
  });
};

const handleMouseUp = (e) => {
  // 清除长按定时器
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  
  // 清除动画帧
  if (dragAnimationFrame) {
    cancelAnimationFrame(dragAnimationFrame);
    dragAnimationFrame = null;
  }
  
  if (isDragging.value) {
    isDragging.value = false;
    isLongPress.value = false;
    // 拖拽结束立刻恢复正常
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.userSelect = '';
      document.body.style.webkitTouchCallout = '';
    }
    
    // 拖拽结束后保持位置不变，不切换到 idle 状态，避免动画导致位置变化
    // 保持 flap 状态一段时间，然后直接保持静止
    setTimeout(() => {
      // 不切换到 idle 状态，避免 transform 动画导致位置变化
      // 保持当前位置稳定
    }, 100);
    emit('dragEnd', { x: e.clientX, y: e.clientY });
  } else {
    // 非拖拽状态下也要清除isLongPress，确保click事件能正常触发
    isLongPress.value = false;
  }
  
  // 无论是否处于拖拽状态，都移除全局鼠标事件监听器，避免监听器残留
  if (typeof document !== 'undefined') {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }
};

const handleTouchStart = (e) => {
  // 清除之前的长按定时器
  if (longPressTimer) {
    clearTimeout(longPressTimer);
  }
  
  // 睡眠状态时先惊醒
  if (currentAction.value === 'sleep') {
    // 惊醒，显示感叹号
    internalAction.value = 'alert';
    setTimeout(() => {
      internalAction.value = 'idle';
    }, 1000);
    return;
  }
  
  // 坐下状态时触发长按事件
  if (currentAction.value === 'sitting') {
    longPressTimer = setTimeout(() => {
      emit('longPress');
    }, LONG_PRESS_DURATION);
    return;
  }
  
  // 可拖拽状态下的长按逻辑
  if (props.isDraggable) {
    // 保存触摸起始位置，用于计算移动距离
    const touch = e.touches[0];
    dragStartPos.value = {
      x: touch.clientX,
      y: touch.clientY
    };
    
    // 立即阻止默认行为，防止复制菜单弹出
    if (e.preventDefault) {
      e.preventDefault();
    }
    
    // 设置长按定时器
    longPressTimer = setTimeout(() => {
      // 进入拖拽时临时禁用复制粘贴
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.userSelect = 'none';
        document.body.style.webkitTouchCallout = 'none';
      }
      
      isLongPress.value = true;
      isDragging.value = true;
      // 开始拖拽时设置翅膀扇动动画
      internalAction.value = 'flap';
      lastDragPos = { x: dragOffset.value.x, y: dragOffset.value.y };
      emit('dragStart', { x: touch.clientX, y: touch.clientY });
    }, LONG_PRESS_DURATION);
  }
};

const handleTouchMove = (e) => {
  // 取消之前的动画帧
  if (dragAnimationFrame) {
    cancelAnimationFrame(dragAnimationFrame);
  }
  
  const touch = e.touches[0];
  
  // 如果还没有进入拖拽状态，检查是否应该立即进入拖拽
  if (props.isDraggable && !isDragging.value) {
    // 检查是否有移动
    if (dragStartPos.value.x !== 0 || dragStartPos.value.y !== 0) {
      const deltaX = Math.abs(touch.clientX - dragStartPos.value.x);
      const deltaY = Math.abs(touch.clientY - dragStartPos.value.y);
      
      // 如果移动距离超过阈值，立即进入拖拽状态
      if (deltaX > 10 || deltaY > 10) {
        // 进入拖拽时临时禁用复制粘贴
        if (typeof document !== 'undefined' && document.body) {
          document.body.style.userSelect = 'none';
          document.body.style.webkitTouchCallout = 'none';
        }
        
        isLongPress.value = true;
        isDragging.value = true;
        internalAction.value = 'flap';
        
        // 保存当前位置作为拖拽起点，确保后续移动计算连续
        lastDragPos = { x: dragOffset.value.x, y: dragOffset.value.y };
        
        // 阻止默认触摸事件，防止复制菜单
        if (e.preventDefault) {
          e.preventDefault();
        }
        
        emit('dragStart', { x: touch.clientX, y: touch.clientY });
      }
    }
  }
  
  // 取消长按定时器
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  
  if (!isDragging.value) {
    return;
  }
  
  // 阻止默认触摸事件，防止屏幕滚动
  if (e.preventDefault) {
    e.preventDefault();
  }
  
  // 使用requestAnimationFrame优化拖拽性能
  dragAnimationFrame = requestAnimationFrame(() => {
    const moveTouch = e.touches[0];
    // 计算相对移动距离
    const deltaX = moveTouch.clientX - dragStartPos.value.x;
    const deltaY = moveTouch.clientY - dragStartPos.value.y;
    
    // 更新位置
    const newX = dragOffset.value.x + deltaX;
    const newY = dragOffset.value.y + deltaY;
    
    dragOffset.value = {
      x: newX,
      y: newY
    };
    lastDragPos = { x: newX, y: newY };
    
    // 更新拖拽开始位置，用于下一次计算
    dragStartPos.value = {
      x: moveTouch.clientX,
      y: moveTouch.clientY
    };
    
    emit('drag', { x: moveTouch.clientX, y: moveTouch.clientY, deltaX, deltaY });
  });
};

const handleTouchEnd = (e) => {
  // 清除长按定时器
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  
  // 清除动画帧
  if (dragAnimationFrame) {
    cancelAnimationFrame(dragAnimationFrame);
    dragAnimationFrame = null;
  }
  
  if (isDragging.value) {
    isDragging.value = false;
    isLongPress.value = false;
    // 拖拽结束立刻恢复正常
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.userSelect = '';
      document.body.style.webkitTouchCallout = '';
    }
    
    // 拖拽结束后保持位置不变，不切换到 idle 状态，避免动画导致位置变化
    // 保持 flap 状态一段时间，然后直接保持静止
    setTimeout(() => {
      // 不切换到 idle 状态，避免 transform 动画导致位置变化
      // 保持当前位置稳定
    }, 100);
    // 安全访问changedTouches
    if (e.changedTouches && e.changedTouches[0]) {
      const touch = e.changedTouches[0];
      emit('dragEnd', { x: touch.clientX, y: touch.clientY });
    }
  } else {
    // 非拖拽状态下也要清除isLongPress，确保click事件能正常触发
    isLongPress.value = false;
    // 移动端触摸结束时，直接触发点击互动
    // 检查是否睡着
    if (currentAction.value === 'sleep') {
      // 惊醒，显示感叹号
      internalAction.value = 'alert';
      emit('actionComplete');
      setTimeout(() => {
        internalAction.value = 'idle';
      }, 1000);
    } else if (currentAction.value === 'sitting') {
      // 只有坐着的时候才触发晃动机制
      const now = Date.now();
      if (now - lastClickTime.value < CLICK_INTERVAL) {
        clickCount.value++;
        shakeIntensity.value += 3;
        
        if (clickCount.value >= 3) {
          internalAction.value = 'flap';
          clickCount.value = 0;
          shakeIntensity.value = 5;
          setTimeout(() => {
            internalAction.value = 'idle';
          }, 1500);
          emit('flapAway');
        } else {
          startShaking();
        }
      } else {
        clickCount.value = 1;
        shakeIntensity.value = 5;
        startShaking();
      }
      
      lastClickTime.value = now;
    }
    
    emit('click');
  }
};

// 阻止复制粘贴事件，防止打断拖拽功能
const handleCopy = (e) => {
  // 只有在拖拽状态下才阻止复制
  if (isDragging.value) {
    e.preventDefault();
  }
};

const handleCut = (e) => {
  // 只有在拖拽状态下才阻止剪切
  if (isDragging.value) {
    e.preventDefault();
  }
};

const handlePaste = (e) => {
  // 只有在拖拽状态下才阻止粘贴
  if (isDragging.value) {
    e.preventDefault();
  }
};

// 阻止上下文菜单，防止长按触发复制操作
const handleContextMenu = (e) => {
  // 只有在拖拽状态下才阻止上下文菜单
  if (isDragging.value) {
    e.preventDefault();
  }
};

onMounted(() => {
  startIdleBehavior();
  startBlinking();
});

onUnmounted(() => {
  if (idleInterval) clearInterval(idleInterval);
  if (blinkInterval) clearInterval(blinkInterval);
  if (actionResetTimer) clearTimeout(actionResetTimer);
  if (longPressTimer) clearTimeout(longPressTimer);
  // 清理事件监听器
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
});
</script>

<style scoped>
.shape-rendering-pixelated {
  shape-rendering: pixelated;
}

/* Animations */
@keyframes hop {
  0%, 100% { transform: translateY(0) translateX(0); }
  50% { transform: translateY(-25px) translateX(10px); }
}

@keyframes flap {
  0%, 100% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.05) translateY(-5px); }
}

@keyframes think {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(-8deg); }
  75% { transform: rotate(8deg); }
}

@keyframes sleep {
  0%, 100% { transform: scale(1) opacity(0.9); }
  50% { transform: scale(0.98) opacity(0.9); }
}

@keyframes alert {
  0%, 100% { transform: translateX(0) translateY(0); }
  25% { transform: translateX(-2px) translateY(-5px); }
  75% { transform: translateX(2px) translateY(-5px); }
}

@keyframes idle {
  0%, 100% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.03) translateY(-0.5px); }
}

@keyframes faint {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-5deg); }
  75% { transform: rotate(5deg); }
}

.animate-faint {
  animation: faint 2s ease-in-out infinite;
  transform-origin: 50% 80%;
}

@keyframes wingFlapLeft {
  0%, 100% { transform: translateX(0); width: 3px; }
  50% { transform: translateX(-3px); width: 6px; }
}

@keyframes wingFlapRight {
  0%, 100% { width: 3px; }
  50% { width: 6px; }
}

@keyframes peck {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(1px); }
}

@keyframes beakOpen {
  0%, 100% { d: path('M15 15 L17 15 L16 17 Z'); }
  50% { d: path('M15 15 L17 15 L16 19 Z'); }
}

@keyframes crumbLeft {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(-5px, 8px) scale(0.8); opacity: 0; }
}

@keyframes crumbCenter {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(0, 10px) scale(0.8); opacity: 0; }
}

@keyframes crumbRight {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(5px, 8px) scale(0.8); opacity: 0; }
}

@keyframes happy {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

@keyframes alertSymbol {
  0%, 100% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.4) translateY(-80px); }
}

@keyframes happyEmojis {
  0% { opacity: 0; transform: scale(0.5) translateY(0); }
  100% { opacity: 1; transform: scale(1) translateY(-60px); }
}

@keyframes sleepZzz {
  0%, 100% { opacity: 0; transform: translateY(0) translateX(0); }
  50% { opacity: 1; transform: translateY(-50px) translateX(-10px); }
  75% { opacity: 1; transform: translateY(-50px) translateX(10px); }
}

.animate-hop {
  animation: hop 0.6s ease-in-out;
}

.animate-flap {
  animation: flap 0.6s ease-in-out;
}

.animate-think {
  animation: think 0.6s ease-in-out;
}

.animate-sleep {
  animation: sleep 3s ease-in-out infinite;
}

.animate-alert {
  animation: alert 0.2s ease-in-out infinite;
}

.animate-idle {
  animation: idle 2.5s ease-in-out infinite;
}

.animate-wing-flap-left {
  animation: wingFlapLeft 0.2s ease-in-out infinite;
  transform-origin: 100% 50%;
}

.animate-wing-flap-right {
  animation: wingFlapRight 0.2s ease-in-out infinite;
  transform-origin: 0% 50%;
}

.animate-peck {
  animation: peck 0.6s ease-in-out;
  transform-origin: 16px 14px;
}

.animate-beak-open {
  animation: beakOpen 0.6s ease-in-out;
}

.animate-crumb-left {
  animation: crumbLeft 0.6s ease-in-out;
}

.animate-crumb-center {
  animation: crumbCenter 0.6s ease-in-out;
}

.animate-crumb-right {
  animation: crumbRight 0.6s ease-in-out;
}

.animate-happy {
  animation: happy 0.6s ease-in-out;
  transform-origin: 16px 14px;
}

.animate-alert-symbol {
  animation: alertSymbol 0.4s ease-in-out infinite;
}

.animate-happy-emojis {
  animation: happyEmojis 0.6s ease-in-out;
}

.animate-sleep-zzz {
  animation: sleepZzz 4s ease-in-out infinite;
}

@keyframes debris1 {
  0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(-10px, -15px) rotate(360deg); opacity: 0; }
}

@keyframes debris2 {
  0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(10px, -12px) rotate(-360deg); opacity: 0; }
}

@keyframes debris3 {
  0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(-5px, -20px) rotate(180deg); opacity: 0; }
}

@keyframes debris4 {
  0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(5px, -18px) rotate(-180deg); opacity: 0; }
}

.animate-debris-1 {
  animation: debris1 2s ease-in-out infinite;
  position: absolute;
  top: 0;
  left: 0;
}

.animate-debris-2 {
  animation: debris2 2s ease-in-out infinite 0.5s;
  position: absolute;
  top: 0;
  left: 0;
}

.animate-debris-3 {
  animation: debris3 2s ease-in-out infinite 1s;
  position: absolute;
  top: 0;
  left: 0;
}

.animate-debris-4 {
  animation: debris4 2s ease-in-out infinite 1.5s;
  position: absolute;
  top: 0;
  left: 0;
}

.crow-no-select {
  -webkit-user-select: none !important;
  user-select: none !important;
  -webkit-touch-callout: none !important;
  touch-callout: none !important;
}

.crow-draggable {
  -webkit-touch-callout: none !important;
  touch-callout: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}
</style>