<template>
  <div class="min-h-screen bg-background text-text font-sans selection:bg-emerald-100">
    <!-- Header -->
    <header class="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-black/5 z-50 flex items-center justify-between px-6">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center text-white font-bold text-xl">拾</div>
        <h1 class="text-xl font-semibold tracking-tight">拾鸦 <span class="text-sm font-normal text-gray-400 ml-1">Shi Ya</span></h1>
      </div>
      <div class="flex items-center gap-4">
        <button class="p-2 hover:bg-black/5 rounded-full transition-colors">
          <Search size={20} />
        </button>
        <button class="p-2 hover:bg-black/5 rounded-full transition-colors">
          <Settings size={20} />
        </button>
      </div>
    </header>

    <main class="pt-24 pb-32 max-w-5xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- Left Column: Crow & Interaction -->
      <div class="lg:col-span-4 flex flex-col gap-6">
        <div 
          ref="mainCrowRef"
          class="w-full h-[36rem] bg-surface rounded-[2.5rem] border border-border shadow-sm flex flex-col items-center justify-center p-8 relative group"
        >
          <!-- Background elements for "scene" feel -->
          <div class="absolute bottom-0 left-0 right-0 h-1/3 bg-[#f0f4f0]/50 -z-10" />
          <div class="absolute top-10 right-10 w-24 h-24 bg-[#fff9e6] rounded-full blur-3xl opacity-60 animate-pulse" />
          
          <div class="absolute top-12 left-8 flex flex-col gap-3 w-1/2">
            <div class="flex flex-col gap-1.5">
              <div class="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted">
                <span>Hunger</span>
                <span>{{ crowStats.hunger }}%</span>
              </div>
              <div class="h-1.5 w-full bg-[#f0ede8] rounded-full overflow-hidden">
                <div 
                  class="h-full bg-accent transition-all duration-300"
                  :style="{ width: `${crowStats.hunger}%` }"
                />
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <div class="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted">
                <span>Mood</span>
                <span>{{ crowStats.mood }}%</span>
              </div>
              <div class="h-1.5 w-full bg-[#f0ede8] rounded-full overflow-hidden">
                <div 
                  class="h-full bg-secondary transition-all duration-300"
                  :style="{ width: `${crowStats.mood}%` }"
                />
              </div>
            </div>
          </div>

          <div 
            class="relative z-[100] cursor-grab active:cursor-grabbing crow-drag-container"
            @click="handleCrowClick"
          >
            <Crow :action="crowAction" @click="handleCrowClick" />
            <div class="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-medium text-[#5a5a40] shadow-sm border border-border whitespace-nowrap">
              拖拽我到任务上 🌿
            </div>
          </div>
          
          <template v-if="sittingOnId">
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p class="text-xs text-muted italic animate-pulse">嘎！我去忙啦...</p>
            </div>
          </template>
          
          <div class="mt-4 text-center min-h-[3rem]">
            <transition name="fade">
              <p 
                key="crowAction"
                class="text-sm text-[#5a5a40] italic font-serif"
              >
                {{ getCrowMessage() }}
              </p>
            </transition>
          </div>
          
          <div class="mt-6 flex gap-3 w-full">
            <button 
              @click="setIsChatOpen(true)"
              class="flex-1 px-4 py-3 bg-primary text-white text-xs font-medium rounded-2xl hover:bg-[#4a4a35] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
            >
              <MessageSquare size={14} /> 对话
            </button>
            <button 
              @click="handleFeed"
              class="flex-1 px-4 py-3 bg-white border border-border text-[#5a5a40] text-xs font-medium rounded-2xl hover:bg-surface transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
            >
              🥣 投喂
            </button>
          </div>
        </div>

        <div class="w-full p-6 bg-[#f0f4f0] rounded-[2rem] border border-[#e0e8e0]">
          <h3 class="text-sm font-semibold text-[#3a5a40] mb-2 flex items-center gap-2">
            <Clock size={16} /> 拾鸦小贴士
          </h3>
          <p class="text-xs text-[#4a6a50] leading-relaxed">
            点击乌鸦可以进行互动。当你完成任务时，它会为你感到高兴！记得经常投喂它哦。
          </p>
        </div>
      </div>

      <!-- Right Column: Content -->
      <div class="lg:col-span-8">
        <!-- Tabs -->
        <div class="flex gap-8 mb-8 border-b border-border">
          <button 
            @click="setActiveTab('schedule')"
            class="pb-4 text-sm font-medium transition-all relative"
            :class="activeTab === 'schedule' ? 'text-primary' : 'text-muted'"
          >
            日程管理
            <template v-if="activeTab === 'schedule'">
              <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            </template>
          </button>
          <button 
            @click="setActiveTab('diary')"
            class="pb-4 text-sm font-medium transition-all relative"
            :class="activeTab === 'diary' ? 'text-primary' : 'text-muted'"
          >
            图片日记
            <template v-if="activeTab === 'diary'">
              <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            </template>
          </button>
        </div>

        <!-- Tab Content -->
        <transition name="fade">
          <div key="activeTab">
            <template v-if="activeTab === 'schedule'">
              <div class="space-y-4">
                <div class="flex items-center justify-between mb-6">
                  <h2 class="text-2xl font-serif italic text-primary">
                    今日待办 <span v-if="!isMainCrowVisible" class="text-sm font-normal text-muted ml-2 animate-pulse">嘎！</span>
                  </h2>
                  <button 
                    @click="setShowAddTask(true)"
                    class="flex items-center gap-2 px-5 py-2.5 bg-white rounded-2xl shadow-sm border border-border text-sm font-medium text-primary hover:shadow-md transition-all active:scale-95"
                  >
                    <Plus size={18} /> 添加事项
                  </button>
                </div>

                <!-- Add Task Modal -->
                <transition name="modal">
                  <div v-if="showAddTask" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/10 backdrop-blur-[2px]">
                    <div class="bg-white p-8 rounded-[2.5rem] border border-border shadow-2xl w-full max-w-md">
                      <h3 class="text-xl font-serif italic text-primary mb-6">嘎！新计划吗？</h3>
                      <div class="space-y-5">
                        <div>
                          <label class="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2 ml-1">任务内容</label>
                          <input 
                            ref="taskInput"
                            type="text" 
                            v-model="newTaskText"
                            placeholder="要做什么呢..."
                            class="w-full px-5 py-3.5 bg-surface border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm"
                          />
                        </div>
                        <div>
                          <label class="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2 ml-1">预计用时</label>
                          <input 
                            type="text" 
                            v-model="newTaskTime"
                            placeholder="例如: 30分钟"
                            class="w-full px-5 py-3.5 bg-surface border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm"
                          />
                        </div>
                      </div>
                      <div class="flex gap-3 mt-10">
                        <button 
                          @click="setShowAddTask(false)" 
                          class="flex-1 px-4 py-3.5 text-sm font-medium text-muted bg-[#f0ede8] rounded-2xl hover:bg-border transition-all"
                        >
                          取消
                        </button>
                        <button 
                          @click="handleAddTask" 
                          class="flex-1 px-4 py-3.5 bg-primary text-white text-sm font-medium rounded-2xl hover:bg-[#4a4a35] transition-all shadow-lg shadow-primary/20"
                        >
                          添加
                        </button>
                      </div>
                    </div>
                  </div>
                </transition>
                
                <div v-for="todo in todos" :key="todo.id" 
                  :data-todo-id="todo.id"
                  @click="toggleTodo(todo.id)"
                  class="group flex items-center gap-4 p-5 bg-white rounded-[1.5rem] border transition-all shadow-sm relative"
                  :class="{
                    'border-secondary bg-surface ring-4 ring-secondary/30 shadow-lg': sittingOnId === todo.id,
                    'border-yellow-400 bg-yellow-50 scale-[1.05] shadow-xl ring-4 ring-yellow-400/50 z-30': dragOverId === todo.id,
                    'border-border hover:border-secondary hover:bg-surface': sittingOnId !== todo.id && dragOverId !== todo.id
                  }"
                >
                  <template v-if="dragOverId === todo.id">
                    <div class="absolute -top-10 left-1/2 -translate-x-1/2 bg-yellow-400 text-white text-[12px] px-4 py-1.5 rounded-full font-bold animate-bounce whitespace-nowrap shadow-lg ring-2 ring-white z-50 pointer-events-none">
                      快放手！我要坐这 🌿
                    </div>
                  </template>
                  <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all" :class="todo.completed ? 'bg-secondary border-secondary' : 'border-border group-hover:border-secondary'">
                    <CheckCircle2 v-if="todo.completed" size={16} class="text-white" />
                  </div>
                  <div class="flex-1">
                    <p class="text-sm font-medium" :class="todo.completed ? 'text-muted line-through' : 'text-primary'">{{ todo.text }}</p>
                    <span v-if="todo.time" class="text-xs text-muted">{{ todo.time }}</span>
                  </div>
                  
                  <!-- Sitting Crow Placeholder -->
                  <transition name="fade">
                    <div v-if="sittingOnId === todo.id" class="absolute right-8 top-0 -translate-y-[85%] z-50 cursor-grab active:cursor-grabbing crow-drag-container group"
                      @click="handleSittingCrowClick"
                      @mouseenter="setShowCrowMenu(true)"
                      @mouseleave="!showTimerPicker && setShowCrowMenu(false)"
                    >
                      <!-- Floating Menu Spheres -->
                      <transition name="fade">
                        <div v-if="showCrowMenu && !isTimerRunning" class="absolute left-1/2 -translate-x-1/2">
                          <div
                            @click="handleTimerClick"
                            class="absolute w-16 h-16 flex items-center justify-center z-50"
                            :style="{ left: '-170%', top: '2px' }"
                          >
                            <button
                              class="w-10 h-10 bg-red-400 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-500 transition-colors"
                              style="opacity: 0.8"
                            >
                              <Timer size={20} />
                            </button>
                          </div>
                          <button
                            class="absolute w-10 h-10 bg-blue-400 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-blue-500 transition-colors z-50"
                            :style="{ left: '-50%', top: '-15px' }"
                          >
                            <Coffee size={20} />
                          </button>
                          <button
                            class="absolute w-10 h-10 bg-green-400 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-green-500 transition-colors z-50"
                            :style="{ left: '60%', top: '10px' }"
                          >
                            <Settings size={20} />
                          </button>
                        </div>
                      </transition>

                      <!-- Timer Countdown Display -->
                      <template v-if="isTimerRunning && timeLeft !== null">
                        <div class="absolute left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-md border border-red-100 flex items-center gap-2 z-50" style="top: 5px">
                          <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          <span class="text-xs font-mono font-bold text-red-600">{{ formatTime(timeLeft) }}</span>
                        </div>
                      </template>

                      <!-- Time's Up Bubble -->
                      <template v-if="!isTimerRunning && crowAction === 'alert'">
                        <div class="absolute left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-2xl shadow-xl font-bold text-sm whitespace-nowrap z-50" style="top: '-30px'">
                          时间到啦！嘎！⏰
                          <div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-red-500 rotate-45" />
                        </div>
                      </template>

                      <Crow :action="crowAction === 'sleep' ? 'sleep' : (crowAction === 'alert' ? 'alert' : 'sitting')" @longPress="setShowCrowMenu(true)" @actionComplete="crowAction = 'idle'" />
                      <div class="absolute -top-12 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-[8px] font-medium text-[#5a5a40] shadow-sm border border-border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {{ isTimerRunning ? '计时中...' : '点击召回 🌿' }}
                      </div>
                    </div>
                  </transition>

                  <!-- Draggable Timer Picker UI -->
                  <transition name="modal">
                    <div v-if="showTimerPicker" class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 bg-white rounded-3xl shadow-2xl border border-border p-6 z-[200] cursor-default" @click.stop>
                      <div class="flex justify-between items-center mb-6">
                        <h3 class="text-sm font-bold text-primary">番茄钟设置</h3>
                        <button @click="setShowTimerPicker(false)" class="text-gray-400 hover:text-gray-600">
                          <X size={18} />
                        </button>
                      </div>
                      
                      <div class="flex flex-col items-center gap-4">
                        <div class="text-4xl font-mono font-bold text-red-500">{{ timerDuration }}m</div>
                        
                        <div class="w-full h-2 bg-gray-100 rounded-full relative overflow-hidden">
                          <div class="absolute top-0 left-0 h-full bg-red-400" :style="{ width: `${(timerDuration / 60) * 100}%` }" />
                          <input 
                            type="range" 
                            min="1" 
                            max="60" 
                            v-model.number="timerDuration"
                            class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        </div>
                        
                        <div class="flex gap-2 w-full mt-6">
                          <button
                            @click="startTimer"
                            class="flex-1 relative overflow-hidden group bg-gradient-to-br from-red-500 via-rose-500 to-orange-400 text-white py-4 rounded-2xl font-bold text-sm tracking-wide shadow-xl shadow-red-500/30 hover:shadow-2xl hover:shadow-red-500/40 transition-all duration-300 active:scale-[0.97]"
                          >
                            <span class="absolute inset-0 w-full h-full bg-gradient-to-br from-white/0 via-white/10 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <span class="absolute -inset-1 bg-gradient-to-r from-red-400 via-rose-400 to-orange-300 rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity duration-300" />
                            <span class="relative flex items-center justify-center gap-2">
                              <Timer size={18} class="group-hover:rotate-12 transition-transform duration-300" />
                              开始专注
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </transition>
                </div>
              </div>
            </template>

            <template v-if="activeTab === 'diary'">
              <div class="space-y-8">
                <div class="flex items-center justify-between mb-6">
                  <h2 class="text-2xl font-serif italic text-primary">
                    拾光日记 <span v-if="!isMainCrowVisible" class="text-sm font-normal text-muted ml-2 animate-pulse">嘎！</span>
                  </h2>
                  <button class="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-black/5 text-sm hover:shadow-md transition-all">
                    <ImageIcon size={18} /> 记录瞬间
                  </button>
                </div>

                <div v-for="entry in diaryEntries" :key="entry.id" class="bg-white rounded-3xl overflow-hidden shadow-sm border border-black/5">
                  <img v-if="entry.image" :src="entry.image" alt="Diary" class="w-full h-64 object-cover" referrerPolicy="no-referrer" />
                  <div class="p-6">
                    <div class="flex items-center justify-between mb-4">
                      <span class="text-xs font-mono text-gray-400">{{ entry.date }}</span>
                      <div class="flex gap-2">
                        <span v-for="tag in entry.tags" :key="tag" class="px-2 py-1 bg-gray-100 text-[10px] rounded-md text-gray-500">#{{ tag }}</span>
                      </div>
                    </div>
                    <p class="text-sm leading-relaxed text-gray-700">{{ entry.content }}</p>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </transition>
      </div>
    </main>

    <!-- Chat Sidebar/Overlay -->
    <transition name="slide">
      <div v-if="isChatOpen" class="fixed inset-0 z-[60] flex">
        <div 
          class="fixed inset-0 bg-black/20 backdrop-blur-sm"
          @click="setIsChatOpen(false)"
        />
        <div class="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[70] flex flex-col">
          <div class="p-6 border-b border-black/5 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-background rounded-full flex items-center justify-center z-10">
                <div class="w-6 h-6 bg-[#1a1a1a] rounded-full flex items-center justify-center text-white font-bold text-xl">拾</div>
              </div>
              <div>
                <h3 class="font-semibold text-sm">拾鸦助手</h3>
                <span class="text-[10px] text-emerald-500 flex items-center gap-1">
                  <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> 在线
                </span>
              </div>
            </div>
            <button @click="setIsChatOpen(false)" class="p-2 hover:bg-black/5 rounded-full">
              <X size={20} />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-6 space-y-4">
            <div v-for="(msg, i) in messages" :key="i" class="flex" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
              <div class="max-w-[80%] p-3 rounded-2xl text-sm" :class="msg.role === 'user' ? 'bg-[#1a1a1a] text-white rounded-tr-none' : 'bg-background text-gray-800 rounded-tl-none'">
                {{ msg.text }}
              </div>
            </div>
            <div v-if="isTyping" class="flex justify-start">
              <div class="bg-background p-3 rounded-2xl rounded-tl-none flex gap-1">
                <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
            <div ref="chatEndRef" />
          </div>

          <div class="p-6 border-t border-black/5">
            <div class="relative">
              <input 
                type="text" 
                v-model="chatInput"
                @keyup.enter="handleSendMessage"
                placeholder="嘎？想聊点什么..."
                class="w-full pl-4 pr-12 py-3 bg-background rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
              />
              <button 
                @click="handleSendMessage"
                :disabled="!chatInput.trim() || isTyping"
                class="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-black disabled:opacity-50 transition-all"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Bottom Navigation (Mobile) -->
    <nav class="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-black/5 lg:hidden flex justify-around p-4 z-50">
      <button @click="setActiveTab('schedule')" class="p-2" :class="activeTab === 'schedule' ? 'text-black' : 'text-gray-400'">
        <Calendar size={24} />
      </button>
      <button @click="setActiveTab('diary')" class="p-2" :class="activeTab === 'diary' ? 'text-black' : 'text-gray-400'">
        <ImageIcon size={24} />
      </button>
      <button @click="setIsChatOpen(true)" class="p-2 text-gray-400">
        <MessageSquare size={24} />
      </button>
    </nav>

    <!-- Floating Crow (Appears when main crow is scrolled out of view) -->
    <transition name="slide">
      <div v-if="!isMainCrowVisible && !isChatOpen && !sittingOnId" 
        class="fixed top-[100px] right-4 z-[9999] cursor-grab active:cursor-grabbing group/floating crow-drag-container"
        @click="handleCrowClick"
      >
        <!-- Speech Bubble -->
        <div class="absolute -top-12 -left-20 bg-white shadow-xl border border-border px-3 py-1.5 rounded-2xl rounded-br-none text-[10px] font-medium text-[#5a5a40] whitespace-nowrap">
          嘎！我在这儿呢 🌿
        </div>

        <div class="scale-[0.8] drop-shadow-2xl">
          <Crow :action="crowAction" />
        </div>
        
        <!-- Hover Indicator -->
        <div class="absolute -bottom-4 left-0 opacity-0 group-hover/floating:opacity-100 transition-opacity bg-black/80 text-white text-[8px] px-2 py-1 rounded whitespace-nowrap pointer-events-none">
          点击互动
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { Calendar, Image as ImageIcon, Plus, Search, Settings, MessageSquare, CheckCircle2, Clock, Send, X, Timer, Coffee } from 'lucide-vue-next';
import Crow from './components/Crow.vue';

// Types
// Todo type: { id: string; text: string; completed: boolean; time?: string; }
// DiaryEntry type: { id: string; date: string; content: string; image?: string; tags: string[]; }
// ChatMessage type: { role: 'user' | 'model'; text: string; }

// State
const todos = ref([
  { id: '1', text: '整理今日灵感', completed: false, time: '10:00' },
  { id: '2', text: '给乌鸦喂食 (交互测试)', completed: true, time: '08:30' },
]);
const showAddTask = ref(false);
const newTaskText = ref('');
const newTaskTime = ref('');
const diaryEntries = ref([
  { id: '1', date: '2026-03-19', content: '今天开始制作拾鸦软件，像素风乌鸦真可爱。', tags: ['开发', '心情'], image: 'https://picsum.photos/seed/crow/400/300' }
]);
const activeTab = ref('schedule');
const crowAction = ref('idle');
const crowStats = ref({ hunger: 80, mood: 90 });
const sittingOnId = ref(null);
const showCrowMenu = ref(false);
const showTimerPicker = ref(false);
const timerDuration = ref(25); // minutes
const timeLeft = ref(null); // seconds
const isTimerRunning = ref(false);
const dragOverId = ref(null);

// Chat state
const isChatOpen = ref(false);
const chatInput = ref('');
const messages = ref([
  { role: 'model', text: '嘎！我是你的拾鸦助手，今天有什么想记录的吗？' }
]);
const isTyping = ref(false);
const chatEndRef = ref(null);
const mainCrowRef = ref(null);
const isMainCrowVisible = ref(true);
const floatingPos = ref({ x: 0, y: 0 });
const isNarrowScreen = ref(window.innerWidth < 1024);
const taskInput = ref(null);

// Monitor screen width changes
const handleResize = () => {
  isNarrowScreen.value = window.innerWidth < 1024;
};

// Use scroll event to detect main crow visibility
const handleScroll = () => {
  if (mainCrowRef.value) {
    const rect = mainCrowRef.value.getBoundingClientRect();
    // Check if main crow is significantly visible
    const isVisible = rect.top < window.innerHeight * 0.6 && rect.bottom > window.innerHeight * 0.2;
    isMainCrowVisible.value = isVisible;
  }
};

// Scroll to bottom of chat
const scrollToBottom = () => {
  chatEndRef.value?.scrollIntoView({ behavior: "smooth" });
};

// Get crow message based on action
const getCrowMessage = () => {
  switch (crowAction.value) {
    case 'think':
      return "嘎... 正在思考...";
    case 'happy':
      return "嘎！太棒了！";
    case 'sleep':
      return "呼... 呼...";
    case 'peck':
      return "咔哒，咔哒...";
    default:
      return "嘎？今天有什么计划吗？";
  }
};

// Event handlers
const handleAddTask = () => {
  if (!newTaskText.value.trim()) return;
  const newTodo = {
    id: Date.now().toString(),
    text: newTaskText.value,
    completed: false,
    time: newTaskTime.value || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  todos.value.unshift(newTodo);
  newTaskText.value = '';
  newTaskTime.value = '';
  showAddTask.value = false;
  crowAction.value = 'flap';
  setTimeout(() => crowAction.value = 'idle', 1000);
};

const handleFeed = () => {
  sittingOnId.value = null;
  crowAction.value = 'peck';
  crowStats.value = {
    hunger: Math.min(100, crowStats.value.hunger + 10),
    mood: Math.min(100, crowStats.value.mood + 5)
  };
  setTimeout(() => {
    crowAction.value = 'happy';
    setTimeout(() => crowAction.value = 'idle', 1000);
  }, 1000);
};

const toggleTodo = (id) => {
  todos.value = todos.value.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
  crowAction.value = 'happy';
  crowStats.value = { ...crowStats.value, mood: Math.min(100, crowStats.value.mood + 2) };
  setTimeout(() => crowAction.value = 'idle', 1500);
};

const handleCrowClick = () => {
  crowAction.value = 'happy';
  crowStats.value = { ...crowStats.value, mood: Math.min(100, crowStats.value.mood + 1) };
  setTimeout(() => crowAction.value = 'idle', 1000);
};

const handleSendMessage = async () => {
  if (!chatInput.value.trim() || isTyping.value) return;

  const userMsg = chatInput.value.trim();
  chatInput.value = '';
  messages.value.push({ role: 'user', text: userMsg });
  isTyping.value = true;
  crowAction.value = 'think';

  try {
    // Simulate API response
    setTimeout(() => {
      const modelText = "嘎！我收到你的消息了，这是一个模拟回复。";
      messages.value.push({ role: 'model', text: modelText });
      crowAction.value = 'happy';
      isTyping.value = false;
      setTimeout(() => crowAction.value = 'idle', 2000);
    }, 1500);
  } catch (error) {
    console.error("AI Error:", error);
    messages.value.push({ role: 'model', text: "嘎... 网络好像有点问题。" });
    isTyping.value = false;
    setTimeout(() => crowAction.value = 'idle', 2000);
  }
};

// Life cycle hooks
onMounted(() => {
  window.addEventListener('resize', handleResize);
  window.addEventListener('scroll', handleScroll);
  // Initial check
  handleScroll();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('scroll', handleScroll);
  // 清除计时器
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
});

// Watchers
watch(isMainCrowVisible, (newValue) => {
  if (!newValue) {
    crowAction.value = 'flap';
    const timer = setTimeout(() => crowAction.value = 'idle', 1500);
    return () => clearTimeout(timer);
  }
});

watch(messages, () => {
  nextTick(() => {
    scrollToBottom();
  });
}, { deep: true });

// Sleep timer logic
watch([sittingOnId, isTimerRunning, crowAction], ([newSittingOnId, newIsTimerRunning, newCrowAction]) => {
  if (newSittingOnId && !newIsTimerRunning) {
    // If sitting and no timer running, start a timer to fall asleep after 10 seconds
    const sleepTimer = setTimeout(() => {
      crowAction.value = 'sleep';
    }, 10000);
    return () => clearTimeout(sleepTimer);
  } else {
    // If not sitting or timer running, ensure it's not in sleep mode
    if (newCrowAction === 'sleep') {
      crowAction.value = 'idle';
    }
  }
}, { deep: true });

// Pomodoro Timer Logic
let timerInterval = null;

// 确保在任何情况下都只创建一个interval
const startTimerInterval = () => {
  // 清除之前的interval
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  if (isTimerRunning.value && timeLeft.value !== null && timeLeft.value > 0) {
    timerInterval = setInterval(() => {
      if (timeLeft.value !== null && timeLeft.value > 0) {
        timeLeft.value -= 1;
      } else {
        clearInterval(timerInterval);
        timerInterval = null;
        isTimerRunning.value = false;
        timeLeft.value = null;
        crowAction.value = 'alert';
        // Show a "Time's Up!" notification
        setTimeout(() => crowAction.value = 'idle', 5000);
      }
    }, 1000);
  }
};

// 监听计时器状态变化
watch([isTimerRunning, timeLeft], ([newIsTimerRunning, newTimeLeft]) => {
  // 只在timeLeft自然减少到0时触发，避免与startTimer()冲突
  if (newTimeLeft === 0) {
    isTimerRunning.value = false;
    timeLeft.value = null;
    crowAction.value = 'alert';
    // Show a "Time's Up!" notification
    setTimeout(() => crowAction.value = 'idle', 5000);
  }
}, { deep: true });

// Focus input when add task modal opens
watch(showAddTask, (newValue) => {
  if (newValue) {
    nextTick(() => {
      taskInput.value?.focus();
    });
  }
});

// Format time for timer
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Start timer
const startTimer = () => {
  // 确保清除之前的计时器
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // 设置初始时间
  timeLeft.value = timerDuration.value * 60;
  isTimerRunning.value = true;
  showTimerPicker.value = false;
  crowAction.value = 'think';
  
  // 启动计时器
  startTimerInterval();
};

// Handle sitting crow click
const handleSittingCrowClick = (e) => {
  e.stopPropagation();
  if (!showCrowMenu.value) {
    sittingOnId.value = null;
    crowAction.value = 'happy';
    isTimerRunning.value = false;
    timeLeft.value = null;
    setTimeout(() => crowAction.value = 'idle', 1000);
  }
};

// Handle timer click
const handleTimerClick = (e) => {
  e.stopPropagation();
  showTimerPicker.value = true;
};

// Set show crow menu
const setShowCrowMenu = (value) => {
  showCrowMenu.value = value;
};

// Set show timer picker
const setShowTimerPicker = (value) => {
  showTimerPicker.value = value;
};

// Set is chat open
const setIsChatOpen = (value) => {
  isChatOpen.value = value;
};

// Set active tab
const setActiveTab = (value) => {
  activeTab.value = value;
};

// Set show add task
const setShowAddTask = (value) => {
  showAddTask.value = value;
};
</script>

<style scoped>
/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>