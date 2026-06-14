<template>
  <view class="space-y-8">
    <view class="flex flex-col gap-4 mb-6">
      <view class="flex items-center justify-between">
        <view class="text-2xl font-serif italic text-primary">
          拾光日记 <text v-if="!isMainCrowVisible" class="text-sm font-normal text-muted ml-2 animate-pulse">嘎！</text>
        </view>
        <view 
          @click="openDiaryEdit()"
          class="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-black/5 text-sm hover:shadow-md transition-all cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg> 记录瞬间
        </view>
      </view>
      <view class="flex items-center gap-3">
        <view 
          @click="openDatePicker"
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

    <view v-for="entry in filteredDiaryEntries" :key="entry.id" class="bg-white rounded-3xl overflow-hidden shadow-sm border border-black/5">
      <view v-if="entry.images && entry.images.length > 0" class="p-4">
        <view class="relative">
          <view :class="{
            'grid grid-cols-3 gap-2': entry.images.length > 1,
            'grid grid-cols-1': entry.images.length === 1
          }">
            <image 
              v-for="(image, index) in entry.images.slice(0, 9)" 
              :key="index" 
              :src="image" 
              alt="Diary" 
              :class="{
                'w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity': entry.images.length > 1,
                'w-full h-64 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity': entry.images.length === 1
              }"
              @click="openImageViewer(entry.images, index)"
            />
          </view>
          <view v-if="entry.images.length > 9" class="absolute top-6 right-6 bg-black/60 text-white text-xs px-2 py-1 rounded">
            +{{ entry.images.length - 9 }}
          </view>
        </view>
      </view>
      <image v-else-if="entry.image" :src="entry.image" alt="Diary" class="w-full h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity" @click="openImageViewer([entry.image], 0)" />
      <view class="p-8">
        <view class="flex items-center justify-between mb-4">
          <text class="text-xs font-mono text-gray-400">{{ entry.date }}</text>
          <view class="flex gap-2">
            <text v-for="tag in entry.tags" :key="tag" class="px-2 py-1 bg-gray-100 text-[10px] rounded-md text-gray-500">#{{ tag }}</text>
          </view>
        </view>
        <text class="text-sm leading-relaxed text-gray-700 mb-4">{{ entry.content }}</text>
        <view class="flex gap-2 justify-end">
          <view 
            @click="openDiaryEdit(entry)"
            class="p-2 hover:bg-background rounded-full cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500 hover:text-primary"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </view>
          <view 
            @click="deleteDiary(entry.id)"
            class="p-2 hover:bg-background rounded-full cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500 hover:text-red-500"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { X, Plus } from 'lucide-vue-next';

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const props = defineProps({
  diaryEntries: {
    type: Array,
    default: () => []
  },
  isMainCrowVisible: {
    type: Boolean,
    default: true
  },
  selectedDate: {
    type: String,
    default: ''
  }
});

const emit = defineEmits([
  'update:diaryEntries',
  'openDiaryEdit',
  'deleteDiary',
  'openImageViewer',
  'openDatePicker'
]);

const displaySelectedDate = computed(() => {
  return props.selectedDate || getLocalDateString();
});

const filteredDiaryEntries = computed(() => {
  const currentDate = props.selectedDate || getLocalDateString();
  return props.diaryEntries.filter(entry => entry.date === currentDate);
});

const openDatePicker = () => {
  emit('openDatePicker');
};

const openDiaryEdit = (diary = null) => {
  emit('openDiaryEdit', diary);
};

const deleteDiary = (id) => {
  emit('deleteDiary', id);
};

const openImageViewer = (images, index) => {
  emit('openImageViewer', images, index);
};

defineExpose({});
</script>
