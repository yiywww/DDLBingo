<template>
  <view class="flex gap-6 mb-8 border-b border-border overflow-x-auto">
    <view 
      @click="$emit('change', 'schedule')"
      class="pb-4 text-sm font-medium transition-all relative cursor-pointer whitespace-nowrap"
      :class="activeTab === 'schedule' ? 'text-primary' : 'text-muted'"
    >
      日程管理
      <template v-if="activeTab === 'schedule'">
        <view class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
      </template>
    </view>
    <view 
      @click="$emit('change', 'diary')"
      class="pb-4 text-sm font-medium transition-all relative cursor-pointer whitespace-nowrap"
      :class="activeTab === 'diary' ? 'text-primary' : 'text-muted'"
    >
      拾光日记
      <template v-if="activeTab === 'diary'">
        <view class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
      </template>
    </view>
    <view 
      @click="$emit('change', 'course')"
      class="pb-4 text-sm font-medium transition-all relative cursor-pointer whitespace-nowrap"
      :class="activeTab === 'course' ? 'text-primary' : 'text-muted'"
    >
      课程表
      <template v-if="activeTab === 'course'">
        <view class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
      </template>
    </view>
    <view 
      @click="$emit('change', 'achievements')"
      class="pb-4 text-sm font-medium transition-all relative cursor-pointer whitespace-nowrap"
      :class="activeTab === 'achievements' ? 'text-primary' : 'text-muted'"
    >
      🏆 成就
      <template v-if="activeTab === 'achievements'">
        <view class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
      </template>
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

defineEmits(['change']);
</script>
