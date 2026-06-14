<template>
  <view class="thinking-panel" v-if="steps.length > 0">
    <!-- 折叠标题 -->
    <view
      @click="expanded = !expanded"
      class="thinking-header"
      :class="{ 'is-active': isActive }"
    >
      <view class="flex items-center gap-2">
        <!-- 旋转加载图标（活跃时） -->
        <view v-if="isActive" class="thinking-spinner" />
        <!-- 静态图标（完成时） -->
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-green-500">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
        <text class="thinking-title">{{ isActive ? '正在处理...' : '处理完成' }}</text>
        <text class="thinking-count">({{ steps.length }}步)</text>
      </view>
      <view class="thinking-chevron" :class="{ 'is-expanded': expanded }">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </view>
    </view>

    <!-- 展开的步骤列表 -->
    <view v-if="expanded" class="thinking-body">
      <view
        v-for="(step, i) in steps"
        :key="i"
        class="thinking-step"
        :class="[
          step.status === 'running' ? 'step-running' : '',
          step.status === 'completed' ? 'step-completed' : '',
          step.status === 'error' ? 'step-error' : ''
        ]"
      >
        <!-- 步骤指示线 -->
        <view class="step-connector">
          <view class="step-dot" :class="step.status">
            <text v-if="step.status === 'completed'" class="step-check">✓</text>
            <text v-else-if="step.status === 'error'" class="step-cross">✗</text>
            <text v-else-if="step.status === 'running'" class="step-loading" />
          </view>
          <view v-if="i < steps.length - 1" class="step-line" :class="steps[i + 1].status === 'completed' ? 'line-done' : ''" />
        </view>

        <!-- 步骤内容 -->
        <view class="step-content">
          <view class="step-header">
            <text class="step-icon">{{ step.icon || '•' }}</text>
            <text class="step-text" :class="step.status === 'running' ? 'text-blinking' : ''">
              {{ step.text }}
            </text>
          </view>

          <!-- 工具调用卡片 -->
          <view v-if="step.toolCall" class="tool-call-card" :class="'tool-' + step.toolCall.status">
            <view class="tool-card-header">
              <text class="tool-icon">{{ step.toolCall.icon || '🔧' }}</text>
              <text class="tool-name">{{ step.toolCall.name }}</text>
              <text class="tool-status" :class="'status-' + step.toolCall.status">
                {{ step.toolCall.status === 'running' ? '执行中...' : step.toolCall.status === 'completed' ? '✅ 完成' : step.toolCall.status === 'failed' ? '❌ 失败' : '' }}
              </text>
            </view>
            <view v-if="step.toolCall.detail && step.toolCall.status === 'completed'" class="tool-card-detail">
              {{ step.toolCall.detail }}
            </view>
            <!-- 运行中显示脉冲条 -->
            <view v-if="step.toolCall.status === 'running'" class="tool-card-loader">
              <view class="loader-bar" />
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  steps: { type: Array, default: () => [] },
  isActive: { type: Boolean, default: false },
});

const expanded = ref(true);
</script>

<style scoped>
.thinking-panel {
  margin-bottom: 8px;
  max-width: 92%;
}

.thinking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.thinking-header.is-active {
  background: #eff6ff;
  border-color: #bfdbfe;
}
.thinking-header:hover {
  background: #f1f5f9;
}

.thinking-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #bfdbfe;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.thinking-title {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}
.is-active .thinking-title {
  color: #1d4ed8;
}

.thinking-count {
  font-size: 11px;
  color: #94a3b8;
}

.thinking-chevron {
  transition: transform 0.2s;
}
.thinking-chevron.is-expanded {
  transform: rotate(180deg);
}

.thinking-body {
  margin-top: 6px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  max-height: 320px;
  overflow-y: auto;
}

.thinking-step {
  display: flex;
  gap: 10px;
  padding: 6px 0;
  transition: opacity 0.3s;
}

.step-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 20px;
}

.step-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  background: #e2e8f0;
  color: #94a3b8;
  transition: all 0.3s;
}
.step-dot.running {
  background: #dbeafe;
  color: #3b82f6;
  animation: pulse-dot 1.5s ease-in-out infinite;
}
.step-dot.completed {
  background: #dcfce7;
  color: #16a34a;
}
.step-dot.error {
  background: #fee2e2;
  color: #dc2626;
}

.step-check { color: #16a34a; }
.step-cross { color: #dc2626; }

.step-loading::after {
  content: '';
  display: block;
  width: 8px;
  height: 8px;
  border: 2px solid #3b82f6;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.step-line {
  width: 2px;
  flex: 1;
  min-height: 8px;
  background: #e2e8f0;
  transition: background 0.5s;
}
.step-line.line-done {
  background: #86efac;
}

.step-content {
  flex: 1;
  min-width: 0;
}

.step-header {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.step-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.step-text {
  font-size: 12px;
  color: #475569;
  line-height: 1.5;
}
.step-text.text-blinking {
  animation: text-blink 1.2s ease-in-out infinite;
}

/* 工具调用卡片 */
.tool-call-card {
  margin-top: 6px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  transition: all 0.3s;
}
.tool-call-card.tool-running {
  border-color: #bfdbfe;
  background: #eff6ff;
}
.tool-call-card.tool-completed {
  border-color: #bbf7d0;
  background: #f0fdf4;
}
.tool-call-card.tool-failed {
  border-color: #fecaca;
  background: #fef2f2;
}

.tool-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-icon {
  font-size: 14px;
}

.tool-name {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.tool-status {
  font-size: 11px;
  margin-left: auto;
}
.tool-status.status-running {
  color: #3b82f6;
}
.tool-status.status-completed {
  color: #16a34a;
}
.tool-status.status-failed {
  color: #dc2626;
}

.tool-card-detail {
  margin-top: 4px;
  font-size: 11px;
  color: #64748b;
  line-height: 1.4;
}

.tool-card-loader {
  margin-top: 6px;
  height: 3px;
  background: #e2e8f0;
  border-radius: 2px;
  overflow: hidden;
}
.loader-bar {
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  border-radius: 2px;
  animation: loader-slide 1.5s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); }
}

@keyframes text-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes loader-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
</style>
