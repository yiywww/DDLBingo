<template>
  <transition name="slide-float">
    <view 
      v-if="isVisible"
      class="fixed top-[100px] right-4 z-[9999] cursor-grab active:cursor-grabbing group/floating crow-drag-container"
      @click="$emit('click')"
      :style="{ transform: `translate(${floatingPos.x}px, ${floatingPos.y}px)` }"
    >
      <view v-if="!interacted" class="absolute -top-12 left-1/2 -translate-x-1/2 bg-white shadow-xl border border-border px-3 py-1.5 rounded-2xl rounded-b-none text-[10px] font-medium text-[#5a5a40] whitespace-nowrap">
        嘎！我在这儿呢 🌿
      </view>

      <view class="scale-[1] drop-shadow-2xl floating-crow">
        <Crow 
          :action="crowAction" 
          :isDraggable="true"
          @click="handleCrowClick"
          @dragStart="handleDragStart"
          @drag="handleDrag"
          @dragEnd="handleDragEnd"
        />
      </view>
    </view>
  </transition>
</template>

<script setup>
import { ref } from 'vue';
import Crow from './Crow.vue';

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  crowAction: {
    type: String,
    default: 'idle'
  }
});

const emit = defineEmits(['click', 'dragStart', 'drag', 'dragEnd']);

const floatingPos = ref({ x: 0, y: 0 });
const interacted = ref(false);

const handleCrowClick = () => {
  interacted.value = true;
  emit('click');
};

const handleDragStart = () => {
  interacted.value = true;
  emit('dragStart');
};

const handleDrag = (event) => {
  if (event.deltaX !== undefined && event.deltaY !== undefined) {
    floatingPos.value.x += event.deltaX;
    floatingPos.value.y += event.deltaY;
  }
  emit('drag', event);
};

const handleDragEnd = (event) => {
  emit('dragEnd', event);
};

const resetPosition = () => {
  floatingPos.value = { x: 0, y: 0 };
  interacted.value = false;
};

defineExpose({ resetPosition });
</script>

<style scoped>
.slide-float-enter-active,
.slide-float-leave-active {
  transition: all 0.5s ease;
}

.slide-float-enter-from {
  opacity: 0;
  transform: translateX(100px) translateY(-50px);
}

.slide-float-leave-to {
  opacity: 0;
  transform: translateX(100px) translateY(-50px);
}

.floating-crow {
  animation: floatIn 0.5s ease-out;
}

@keyframes floatIn {
  0% {
    opacity: 0;
    transform: translateX(50px) translateY(-30px) scale(0.3);
  }
  50% {
    transform: translateX(-10px) translateY(5px) scale(0.8);
  }
  100% {
    opacity: 1;
    transform: translateX(0) translateY(0) scale(1);
  }
}
</style>
