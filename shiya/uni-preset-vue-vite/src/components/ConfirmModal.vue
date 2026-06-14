<template>
  <view class="fixed top-0 left-0 right-0 bottom-0 z-[200] flex items-center justify-center bg-black/20" @click="$emit('cancel')">
    <view class="bg-white rounded-3xl p-6 w-80 shadow-2xl" @click.stop>
      <view class="text-lg font-semibold mb-2">{{ title }}</view>
      <view class="text-sm text-gray-500 mb-6">{{ message }}</view>
      
      <view class="flex gap-3">
        <view 
          @click="$emit('cancel')"
          class="flex-1 py-2 text-center text-sm text-gray-500 bg-gray-100 rounded-xl cursor-pointer hover:bg-gray-200 transition-all"
        >
          {{ cancelText }}
        </view>
        <view 
          @click="$emit('confirm')"
          class="flex-1 py-2 text-center text-sm text-white rounded-xl cursor-pointer transition-all"
          :class="isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-[#4a4a35]'"
        >
          {{ confirmText }}
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: '确认'
  },
  message: {
    type: String,
    default: '确定要执行此操作吗？'
  },
  confirmText: {
    type: String,
    default: '确认'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  isDanger: {
    type: Boolean,
    default: false
  }
});

defineEmits(['confirm', 'cancel']);
</script>
