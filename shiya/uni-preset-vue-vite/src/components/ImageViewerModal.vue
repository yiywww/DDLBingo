<template>
  <view class="fixed top-0 left-0 right-0 bottom-0 z-[200] bg-black/90 flex items-center justify-center" @click="$emit('close')">
    <view class="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full cursor-pointer" @click="$emit('close')">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </view>
    
    <view v-if="images.length > 1" class="absolute left-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-full cursor-pointer" @click.stop="$emit('prev')">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
    </view>
    
    <image 
      :src="images[currentIndex]" 
      class="max-w-full max-h-full object-contain"
      mode="aspectFit"
      @click.stop
    />
    
    <view v-if="images.length > 1" class="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-full cursor-pointer" @click.stop="$emit('next')">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
    </view>
    
    <view class="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
      {{ currentIndex + 1 }} / {{ images.length }}
    </view>
  </view>
</template>

<script setup>
defineProps({
  images: {
    type: Array,
    required: true
  },
  currentIndex: {
    type: Number,
    default: 0
  }
});

defineEmits(['close', 'prev', 'next']);
</script>
