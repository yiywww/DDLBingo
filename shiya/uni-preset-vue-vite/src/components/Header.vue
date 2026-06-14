<template>
  <view class="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-black/5 z-50 flex items-center justify-between px-6">
    <view class="flex items-center gap-3">
      <view class="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center text-white font-bold text-xl">拾</view>
      <view class="text-xl font-semibold tracking-tight">拾鸦 <text class="text-sm font-normal text-gray-400 ml-1">Shi Ya</text></view>
    </view>
    <view class="flex items-center gap-4">
      <view class="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      </view>
      <view class="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer" @click="$emit('showSettings')">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
      </view>
      <view class="relative group">
        <view class="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer" @click="$emit('toggleUserMenu')">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </view>
        <view v-if="showUserMenu" class="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-border overflow-hidden z-50">
          <view class="p-4 border-b border-border">
            <view class="text-sm font-semibold">{{ currentUser?.username || '用户' }}</view>
            <view class="text-xs text-muted">{{ currentUser?.email || '' }}</view>
          </view>
          <view class="p-2">
            <view class="px-4 py-2 text-sm hover:bg-background cursor-pointer" @click="$emit('restoreData')">恢复数据</view>
            <view class="px-4 py-2 text-sm hover:bg-background cursor-pointer" @click="$emit('logout')">退出登录</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  currentUser: {
    type: Object,
    default: null
  },
  showUserMenu: {
    type: Boolean,
    default: false
  }
});

defineEmits(['toggleUserMenu', 'restoreData', 'logout', 'showSettings']);
</script>
