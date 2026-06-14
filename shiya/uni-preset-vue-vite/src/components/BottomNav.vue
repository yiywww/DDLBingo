<template>
  <view class="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-border flex items-center justify-around z-50 md:hidden">
    <view 
      @click="$emit('change', 'schedule')"
      class="flex flex-col items-center gap-1 cursor-pointer"
      :class="activeTab === 'schedule' ? 'text-primary' : 'text-muted'"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      <text class="text-xs">日程</text>
    </view>
    <view 
      @click="$emit('change', 'diary')"
      class="flex flex-col items-center gap-1 cursor-pointer"
      :class="activeTab === 'diary' ? 'text-primary' : 'text-muted'"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
      <text class="text-xs">日记</text>
    </view>
    <view 
      @click="$emit('change', 'course')"
      class="flex flex-col items-center gap-1 cursor-pointer"
      :class="activeTab === 'course' ? 'text-primary' : 'text-muted'"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
      <text class="text-xs">课程</text>
    </view>
    <view 
      @click="$emit('openChat')"
      class="flex flex-col items-center gap-1 cursor-pointer text-muted"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      <text class="text-xs">对话</text>
    </view>
  </view>
</template>

<script setup>
defineProps({
  activeTab: {
    type: String,
    default: 'schedule'
  }
});

defineEmits(['change', 'openChat']);
</script>
