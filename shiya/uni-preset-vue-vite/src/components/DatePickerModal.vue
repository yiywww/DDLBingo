<template>
  <view class="fixed top-0 left-0 right-0 bottom-0 z-[200] flex items-center justify-center bg-black/20" @click="$emit('close')">
    <view class="bg-white rounded-3xl p-6 w-80 shadow-2xl" @click.stop>
      <view class="flex justify-between items-center mb-4">
        <view class="text-lg font-semibold">{{ calendarYear }}年{{ calendarMonth }}月</view>
        <view class="flex gap-2">
          <view @click="$emit('prevMonth')" class="p-2 hover:bg-gray-100 rounded-full cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          </view>
          <view @click="$emit('nextMonth')" class="p-2 hover:bg-gray-100 rounded-full cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
          </view>
        </view>
      </view>
      
      <view class="grid grid-cols-7 gap-1 mb-2">
        <view v-for="day in ['日', '一', '二', '三', '四', '五', '六']" :key="day" class="text-center text-xs text-gray-400 py-2">
          {{ day }}
        </view>
      </view>
      
      <view class="grid grid-cols-7 gap-1">
        <view 
          v-for="(day, index) in days" 
          :key="index"
          @click="$emit('select', day)"
          class="text-center py-2 rounded-lg cursor-pointer text-sm"
          :class="{
            'text-gray-300': day.isOtherMonth,
            'bg-primary text-white': day.isSelected,
            'hover:bg-gray-100': !day.isSelected && !day.isOtherMonth
          }"
        >
          {{ day.date }}
        </view>
      </view>
      
      <view class="flex gap-3 mt-6">
        <view 
          @click="$emit('close')"
          class="flex-1 py-2 text-center text-sm text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
        >
          取消
        </view>
        <view 
          @click="$emit('confirm')"
          class="flex-1 py-2 text-center text-sm bg-primary text-white rounded-lg cursor-pointer hover:bg-[#4a4a35]"
        >
          确认
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  calendarYear: {
    type: Number,
    required: true
  },
  calendarMonth: {
    type: Number,
    required: true
  },
  days: {
    type: Array,
    required: true
  },
  selectedValue: {
    type: String,
    default: ''
  }
});

defineEmits(['prevMonth', 'nextMonth', 'select', 'confirm', 'close']);
</script>
