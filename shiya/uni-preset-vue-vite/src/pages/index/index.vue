<template>
  <view class="min-h-screen bg-background text-text font-sans selection:bg-emerald-100">
    <!-- Header -->
    <Header 
      :currentUser="currentUser"
      :showUserMenu="showUserMenu"
      @toggleUserMenu="toggleUserMenu"
      @restoreData="restoreDataFromServer"
      @logout="handleLogout"
      @showSettings="showSettingsModal = true"
    />

    <view class="pt-16 pb-24 max-w-4xl mx-auto px-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- Left Column: Crow & Interaction -->
      <view id="main-crow-area" class="lg:col-span-4 flex flex-col gap-6 p-4">
        <CrowArea 
          ref="mainCrowRef"
          :crowStats="crowStats"
          :foodCount="foodCount"
          :isMainCrowVisible="isMainCrowVisible"
          :isCrowFainted="isCrowFainted"
          :crowAction="crowAction"
          :sittingOnId="sittingOnId"
          :showCrowMenu="showCrowMenu"
          :showTimerPicker="showTimerPicker"
          :timerDuration="timerDuration"
          :timeLeft="timeLeft"
          :isTimerRunning="isTimerRunning"
          :dragOverId="dragOverId"
          :isChatOpen="isChatOpen"
          :isBingoMode="isBingoMode"
          :bingoMode="bingoMode"
          @click="handleCrowClick"
          @feed="handleFeed"
          @dragStart="handleDragStart"
          @drag="handleDrag"
          @dragEnd="handleDragEnd"
          @openChat="setIsChatOpen(true)"
          @findCrow="findCrow"
          @sittingCrowClick="handleSittingCrowClick"
          @flapAway="handleFlapAway"
          @openBingo="openBingo"
          @closeBingo="closeBingo"
          @switchBingoMode="switchBingoMode"
        >
          <template #bingo-content>
            <!-- 执行模式 -->
            <view v-if="isExecutingMode" class="bingo-content-mini execution-mode">
              <view class="flex items-center justify-between mb-4">
                <text class="text-sm font-bold text-primary">🎯 日程执行</text>
                <view 
                  @click="exitExecution"
                  class="w-8 h-8 rounded-full bg-[#f0ede8] flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </view>
              </view>
              
              <view class="flex justify-center mb-4">
                <view 
                  class="relative cursor-pointer"
                  @click="handleCrowClickInExecution"
                >
                  <Crow 
                    :action="crowActionInExecution" 
                    :isDraggable="false"
                    :size="80"
                  />
                  <view v-if="isExecutionRunning" class="absolute -bottom-1 -right-1 w-6 h-6 bg-accent rounded-full flex items-center justify-center animate-bounce">
                    <text class="text-[8px]">🎯</text>
                  </view>
                </view>
              </view>
              <view class="text-center mb-2">
                <text class="text-[10px] text-muted">{{ crowMessageInExecution }}</text>
              </view>
              
              <view class="text-center mb-4">
                <text class="text-lg font-bold text-primary">
                  {{ Math.floor(remainingExecutionTime / 60) }}:{{ String(remainingExecutionTime % 60).padStart(2, '0') }}
                </text>
                <text class="text-xs text-muted block mt-1">剩余时间</text>
              </view>
              
              <view class="space-y-2 mb-4">
                <view 
                  v-for="(task, index) in executionTasks" 
                  :key="task.uniqueId"
                  class="p-3 rounded-lg transition-all border relative overflow-hidden"
                  :class="{ 
                    'bg-primary/10 border-primary': index === currentTaskIndex && !task.completed,
                    'bg-white border-[#e5e0d8]': index !== currentTaskIndex && !task.completed,
                    'bg-secondary/20 border-secondary completed-cell': task.completed
                  }"
                >
                  <view class="flex items-start gap-2">
                    <view 
                      class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5"
                      :class="task.completed ? 'bg-secondary text-white' : (index === currentTaskIndex ? 'bg-primary text-white' : 'bg-[#f0ede8] text-muted')"
                    >
                      {{ task.completed ? '✓' : task.taskOrder }}
                    </view>
                    <view class="flex-1 min-w-0">
                      <view class="flex items-center gap-2 mb-1">
                        <text class="text-sm font-medium text-[#2d2d2d]">{{ task.title }}</text>
                        <text class="text-[10px] text-[#8c857d] bg-[#f0ede8] px-1.5 py-0.5 rounded">{{ task.estimatedMinutes }}分钟</text>
                      </view>
                      <text v-if="task.description" class="text-[11px] text-[#8c857d] leading-relaxed">{{ task.description }}</text>
                      <view v-if="index === currentTaskIndex && !task.completed" class="mt-2">
                        <view class="flex items-center justify-between text-[10px] mb-1">
                          <text class="text-[#8c857d]">⏱ 进行中</text>
                          <text class="text-primary font-medium">{{ getTaskRemainingTime(task) }}</text>
                        </view>
                        <view class="h-2 bg-[#f0ede8] rounded-full overflow-hidden">
                          <view 
                            class="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
                            :style="{ width: getTaskProgress(task) + '%' }"
                          />
                        </view>
                        <text class="text-[9px] text-[#8c857d] mt-1 block text-right">{{ getTaskProgress(task) }}%</text>
                      </view>
                      <view v-if="task.completed" class="mt-1 flex items-center gap-1">
                        <text class="text-[10px] text-secondary">✓ 已完成</text>
                      </view>
                    </view>
                  </view>
                </view>
              </view>
              
              <view class="flex gap-2">
                <view 
                  v-if="!isExecutionRunning"
                  @click="startExecution"
                  class="flex-1 px-4 py-2 bg-primary text-white text-xs font-medium rounded-lg text-center"
                >
                  ▶ 开始执行
                </view>
                <view 
                  v-else
                  @click="pauseExecution"
                  class="flex-1 px-4 py-2 bg-accent text-white text-xs font-medium rounded-lg text-center"
                >
                  ⏸ 暂停
                </view>
                <view 
                  @click="addMoreTime"
                  class="flex-1 px-4 py-2 bg-[#f0f4f0] text-primary text-xs font-medium rounded-lg text-center"
                >
                  +15分钟
                </view>
                <view 
                  @click="skipToNextTask"
                  class="flex-1 px-4 py-2 text-xs font-medium rounded-lg text-center transition-all"
                  :class="isLastTask ? 'bg-accent text-white' : 'bg-[#f0f4f0] text-muted'"
                >
                  {{ isLastTask ? '🏁 结束任务' : '下一个' }}
                </view>
              </view>
            </view>
            
            <!-- 时间输入模式 -->
            <view v-else-if="bingoMode === 'single' && showTimeInput" class="bingo-content-mini time-input-mode">
              <view class="text-center mb-4">
                <text class="text-xs text-muted">{{ pendingRefresh ? '输入新的可用时间以匹配更合适的任务' : '输入可用时间（分钟）' }}</text>
              </view>
              <view class="flex gap-2 mb-4">
                <input 
                  v-model.number="availableMinutes"
                  type="number"
                  placeholder="例如：60"
                  class="flex-1 px-4 py-2 bg-[#f0f4f0] rounded-lg text-sm text-center"
                />
              </view>
              <view class="flex gap-2">
                <view 
                  @click="pendingRefresh ? doRefreshBingoBoard(availableMinutes) : initBingoBoard(availableMinutes)"
                  class="flex-1 px-4 py-2 bg-primary text-white text-xs font-medium rounded-lg text-center"
                >
                  {{ pendingRefresh ? '确认刷新' : '开始挑战' }}
                </view>
                <view 
                  @click="pendingRefresh ? doRefreshBingoBoard(0) : initBingoBoard(0)"
                  class="flex-1 px-4 py-2 bg-[#f0f4f0] text-muted text-xs font-medium rounded-lg text-center"
                >
                  不限时间
                </view>
                <view 
                  v-if="pendingRefresh"
                  @click="pendingRefresh = false; showTimeInput = false"
                  class="flex-1 px-4 py-2 bg-[#fef2f2] text-red-500 text-xs font-medium rounded-lg text-center"
                >
                  取消
                </view>
              </view>
              <view v-if="!pendingRefresh" class="mt-4 text-center">
                <text class="text-[10px] text-muted">
                  时间限制模式下，翻牌会消耗预计时间，超出限制将无法继续翻牌
                </text>
              </view>
            </view>
            
            <!-- 翻牌模式 -->
            <template v-else>
              <view v-if="bingoMode === 'single'" class="bingo-content-mini">
                <view class="flex items-center justify-between mb-3 px-1">
                  <text class="text-[10px] text-muted">
                    已用: {{ usedTime }} / {{ userAvailableMinutes || '不限' }} 分钟
                  </text>
                </view>
                
                <view class="mini-bingo-grid">
                  <view 
                    v-for="(card, index) in selectedTasks" 
                    :key="card.uniqueId || index"
                    class="mini-bingo-card"
                    :class="{ 
                      'is-flipped': card.isFlipped, 
                      'is-completed': card.isCompleted 
                    }"
                    @click="handleFlipCard(index)"
                  >
                    <view v-if="!card.isFlipped && !card.isCompleted" class="mini-bingo-back">
                      <BirdSVG :idx="index % 9" />
                      <text class="hint-text">点击选取</text>
                    </view>
                    <view v-else class="mini-bingo-front">
                      <text class="text-[9px] font-medium line-clamp-2">{{ card.title }}</text>
                      <text v-if="!card.isCompleted && card.isFlipped" class="text-[8px] text-accent">{{ card.estimatedMinutes }}分钟</text>
                      <text v-if="card.isCompleted" class="text-[8px] text-white/80">✓ 完成</text>
                    </view>
                  </view>
                </view>
                
                <view class="mt-4 flex gap-2">
                  <view 
                    v-if="!isBingoComplete"
                    @click="startPlanning"
                    class="flex-1 px-2 py-2 bg-gradient-to-r from-[#85b251] to-[#a0d040] text-white text-[9px] font-bold rounded-xl text-center shadow-lg shadow-[#85b251]/40 active:scale-95 transition-transform flex items-center justify-center gap-1 whitespace-nowrap overflow-hidden"
                  >
                    📅 开始策划
                  </view>
                  <view 
                    v-else
                    @click="saveBingoBoard"
                    class="flex-1 px-2 py-2 bg-gradient-to-r from-[#85b251] to-[#a0d040] text-white text-[9px] font-bold rounded-xl text-center shadow-lg shadow-[#85b251]/40 active:scale-95 transition-transform flex items-center justify-center gap-1 whitespace-nowrap overflow-hidden"
                  >
                    🎉 保存棋盘
                  </view>
                  <view 
                    @click="refreshBingoBoard"
                    class="flex-1 px-2 py-2 bg-white/70 text-[#4a7a1e] text-[9px] font-bold rounded-xl text-center border border-[#c8deae] active:scale-95 transition-transform flex items-center justify-center gap-1 whitespace-nowrap overflow-hidden"
                  >
                    🔄 刷新
                  </view>
                  <view 
                    @click="resetBingoBoard"
                    class="flex-1 px-2 py-2 bg-white/70 text-[#4a7a1e] text-[9px] font-bold rounded-xl text-center border border-[#c8deae] active:scale-95 transition-transform flex items-center justify-center gap-1 whitespace-nowrap overflow-hidden"
                  >
                    🔁 重置
                  </view>
                </view>
              </view>
              
              <view v-if="bingoMode === 'team'" class="bingo-content-mini">
                <view class="flex items-center justify-between mb-3">
                  <view class="text-xs text-muted">
                    当前成员：<text :style="{ color: currentTeamMember.color }">{{ currentTeamMember.name }}</text>
                  </view>
                  <view 
                    @click="openTeamShareModal"
                    class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                  </view>
                </view>
                <view class="flex gap-2 mb-3">
                  <view 
                    v-for="member in teamMembers" 
                    :key="member.name"
                    class="px-3 py-1.5 text-xs rounded-full transition-all cursor-pointer font-bold"
                    :style="{ 
                      backgroundColor: currentTeamMember.name === member.name ? member.color : member.bgColor,
                      color: currentTeamMember.name === member.name ? '#fff' : member.color
                    }"
                    @click="currentTeamMember = member"
                  >
                    {{ member.name }}
                  </view>
                </view>
                
                <view class="mini-bingo-grid">
                  <view 
                    v-for="(card, index) in teamSelectedTasks" 
                    :key="card.uniqueId || index"
                    class="mini-bingo-card team-card"
                    :class="{ 
                      'is-flipped': card.isFlipped, 
                      'is-completed': card.isCompleted,
                      'is-claimed': card.isClaimed && !card.isCompleted
                    }"
                    :style="{
                      '--claimed-color': card.claimedByColor || 'inherit',
                      '--claimed-bg': card.claimedByBgColor || 'inherit'
                    }"
                    @click="handleTeamFlipCard(index)"
                  >
                    <view v-if="!card.isFlipped && !card.isCompleted" class="mini-bingo-back">
                      <BirdSVG :idx="index % 9" />
                      <text class="hint-text">点击选取</text>
                    </view>
                    <view v-else class="mini-bingo-front" :style="card.isCompleted ? { backgroundColor: card.claimedByColor } : {}">
                      <text class="text-[9px] font-medium line-clamp-2" :style="card.isCompleted ? { color: '#fff' } : {}">{{ card.title }}</text>
                      <text v-if="card.isClaimed && !card.isCompleted" class="text-[8px]" :style="{ color: card.claimedByColor }">{{ card.claimedBy }} 领取中</text>
                      <text v-if="card.isCompleted" class="text-[8px] text-white/80">✓ {{ card.claimedBy }}</text>
                    </view>
                    <view 
                      v-if="card.isFlipped && !card.isCompleted"
                      class="absolute bottom-1 right-1"
                      @click.stop="card.isClaimed && card.claimedBy === currentTeamMember.name ? handleTeamCompleteTask(index) : handleTeamClaimTask(index)"
                    >
                      <view class="w-6 h-6 rounded-full flex items-center justify-center"
                        :style="card.isClaimed ? { backgroundColor: card.claimedByColor, color: '#fff' } : { backgroundColor: '#f59e0b', color: '#fff' }"
                      >
                        <text class="text-[8px]">{{ card.isClaimed ? '✓' : '领' }}</text>
                      </view>
                    </view>
                  </view>
                </view>
              </view>
            </template>
          </template>
        </CrowArea>

        <TipsCard />
      </view>

      <!-- Right Column: Content -->
      <view class="lg:col-span-8 p-4">
        <!-- Tabs -->
        <TabNavigation 
          :activeTab="activeTab"
          @change="setActiveTab"
        />

        <!-- Tab Content -->
        <transition name="fade">
          <view key="activeTab">
            <template v-if="activeTab === 'course'">
              <CourseTable 
                ref="courseTableRef"
                :courseSchedule="courseSchedule"
                :courseView="courseView"
                :showImportModal="showImportModal"
                :showAddCourseModal="showAddCourseModal"
                :showTimeSettings="showTimeSettings"
                :showCourseDatePicker="showCourseDatePicker"
                :importType="importType"
                :newCourse="newCourse"
                :colorOptions="colorOptions"
                :selectedCourseDay="selectedCourseDay"
                :selectedCourseDate="selectedCourseDate"
                :tempSelectedCourseDate="tempSelectedCourseDate"
                :courseDateCalendarYear="courseDateCalendarYear"
                :courseDateCalendarMonth="courseDateCalendarMonth"
                :courseDateCalendarDays="courseDateCalendarDays"
                @update:courseSchedule="val => courseSchedule.value = val"
                @toggleImportModal="val => showImportModal.value = val"
                @toggleAddCourseModal="val => showAddCourseModal.value = val"
                @toggleTimeSettings="val => showTimeSettings.value = val"
                @toggleCourseDatePicker="val => showCourseDatePicker.value = val"
                @setImportType="val => importType.value = val"
                @handleImport="handleImport"
                @updateCourse="updateCourse"
                @addCourse="addCourse"
                @deleteCourse="deleteCourse"
                @saveTimeSettings="saveTimeSettings"
                @prevCourseDateMonth="prevCourseDateMonth"
                @nextCourseDateMonth="nextCourseDateMonth"
                @selectCourseDate="selectCourseDate"
                @confirmCourseDate="confirmCourseDate"
                @updateCurrentWeek="updateCurrentWeek"
                @prevWeek="prevWeek"
                @nextWeek="nextWeek"
                @resetToCurrentWeek="resetToCurrentWeek"
                @clearAllCourses="clearAllCourses"
                @setCourseView="val => courseView.value = val"
                @prevCourseDay="prevCourseDay"
                @nextCourseDay="nextCourseDay"
              />
            </template>
            
            <template v-if="activeTab === 'schedule'">
              <ScheduleTab 
                ref="scheduleTabRef"
                :todos="todos"
                :repeatTasks="repeatTasks"
                :completedTasks="completedTasks"
                :isMainCrowVisible="isMainCrowVisible"
                :sittingOnId="sittingOnId"
                :crowAction="crowAction"
                :showCrowMenu="showCrowMenu"
                :showTimerPicker="showTimerPicker"
                :timerDuration="timerDuration"
                :timeLeft="timeLeft"
                :isTimerRunning="isTimerRunning"
                :dragOverId="dragOverId"
                :selectedScheduleDate="selectedScheduleDate"
                :isChatOpen="isChatOpen"
                @toggleTodo="toggleTodo"
                @deleteTask="deleteTask"
                @startEditTask="startEditTask"
                @setShowAddTask="setShowAddTask"
                @setShowCrowMenu="setShowCrowMenu"
                @setShowTimerPicker="setShowTimerPicker"
                @startTimer="startTimer"
                @handleSittingCrowClick="handleSittingCrowClick"
                @handleDragStart="handleDragStart"
                @handleDrag="handleDrag"
                @handleDragEnd="handleDragEnd"
                @handleFlapAway="handleFlapAway"
                @update:timerDuration="val => timerDuration = val"
                @openScheduleDatePicker="openScheduleDatePicker"
                @deleteTodos="handleBatchDelete"
              />
            </template>

            <template v-if="activeTab === 'diary'">
              <DiaryTab 
                ref="diaryTabRef"
                :diaryEntries="diaryEntries"
                :isMainCrowVisible="isMainCrowVisible"
                :selectedDate="selectedDate"
                @openDiaryEdit="openDiaryEdit"
                @deleteDiary="deleteDiary"
                @openImageViewer="openImageViewer"
                @openDatePicker="openDiaryDatePicker"
              />
            </template>

            <template v-if="activeTab === 'achievements'">
              <view class="achievements-page">
                <view class="achievements-header">
                  <text class="text-2xl font-bold text-primary mb-2">🏆 成就墙</text>
                  <text class="text-sm text-muted">记录你的 Bingo 挑战成果</text>
                </view>
                
                <view class="achievements-stats">
                  <view class="stat-card">
                    <text class="stat-value">{{ achievements.length }}</text>
                    <text class="stat-label">完成棋盘数</text>
                  </view>
                  <view class="stat-card">
                    <text class="stat-value">{{ achievements.reduce((sum, a) => sum + a.totalMinutes, 0) }}</text>
                    <text class="stat-label">累计时长(分钟)</text>
                  </view>
                  <view class="stat-card">
                    <text class="stat-value">{{ achievements.reduce((sum, a) => sum + a.tasks.length, 0) }}</text>
                    <text class="stat-label">完成任务数</text>
                  </view>
                </view>

                <view class="achievements-list" v-if="achievements.length > 0">
                  <view 
                    v-for="achievement in achievements" 
                    :key="achievement.id" 
                    class="achievement-card"
                  >
                    <view class="achievement-header">
                      <view class="achievement-badge">
                        <text class="text-xl">🎯</text>
                      </view>
                      <view class="achievement-info">
                        <text class="achievement-title">第 {{ achievement.boardNumber }} 个 Bingo</text>
                        <text class="achievement-date">{{ formatDate(achievement.date) }}</text>
                      </view>
                      <view class="achievement-actions">
                        <view 
                          @click="openShareModal(achievement)"
                          class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                        </view>
                        <view 
                          @click="deleteAchievement(achievement)"
                          class="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </view>
                      </view>
                    </view>
                    <view class="achievement-time-row">
                      <text class="text-lg font-bold text-primary">{{ achievement.totalMinutes }}分钟</text>
                    </view>
                    <view class="achievement-tasks">
                      <text class="text-xs text-muted mb-2 block">完成的任务：</text>
                      <view class="flex flex-wrap gap-1">
                        <view 
                          v-for="task in achievement.tasks" 
                          :key="task.id" 
                          class="task-tag"
                        >
                          {{ task.title }} ({{ task.estimatedMinutes }}分钟)
                        </view>
                      </view>
                    </view>
                  </view>
                </view>

                <view v-else class="empty-achievements">
                  <text class="text-4xl mb-4">🎮</text>
                  <text class="text-lg font-medium text-muted mb-2">还没有成就记录</text>
                  <text class="text-sm text-muted">完成一个完整的 Bingo 九宫格来解锁你的第一个成就！</text>
                </view>
              </view>
            </template>

            <view v-if="showShareModal" class="share-modal-overlay" @click="closeShareModal">
              <view class="share-modal" @click.stop>
                <view class="share-modal-header">
                  <text class="text-lg font-bold text-primary">📤 分享成就</text>
                  <view @click="closeShareModal" class="close-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </view>
                </view>
                
                <view class="share-modal-content" v-if="selectedAchievement">
                  <view class="share-poster-preview">
                    <view class="poster-header">
                      <text class="text-xl font-bold">🎯 第 {{ selectedAchievement.boardNumber }} 个 Bingo</text>
                    </view>
                    <view class="poster-date">{{ formatDate(selectedAchievement.date) }}</view>
                    <view class="poster-stats">
                      <view class="stat-item">
                        <text class="stat-num">{{ selectedAchievement.totalMinutes }}</text>
                        <text class="stat-text">分钟</text>
                      </view>
                      <view class="stat-item">
                        <text class="stat-num">{{ selectedAchievement.tasks.length }}</text>
                        <text class="stat-text">任务</text>
                      </view>
                    </view>
                    <view class="poster-qrcode">
                      <view class="qrcode-placeholder">
                        <text class="text-4xl">📱</text>
                        <text class="text-xs text-muted mt-1 block">扫码下载</text>
                      </view>
                    </view>
                    <view class="poster-footer">
                      <text class="text-xs text-muted">分享自 DDLBINGO</text>
                    </view>
                  </view>
                  
                  <view class="share-options">
                    <view class="share-option" @click="shareToQQ">
                      <view class="share-icon qq-icon">
                        <text class="text-2xl">💬</text>
                      </view>
                      <text class="share-text">分享到QQ</text>
                    </view>
                    <view class="share-option" @click="shareToQQZone">
                      <view class="share-icon qzone-icon">
                        <text class="text-2xl">🌟</text>
                      </view>
                      <text class="share-text">分享到QQ空间</text>
                    </view>
                    <view class="share-option" @click="shareToFriend">
                      <view class="share-icon friend-icon">
                        <text class="text-2xl">👥</text>
                      </view>
                      <text class="share-text">分享给QQ好友</text>
                    </view>
                    <view class="share-option" @click="copyLink">
                      <view class="share-icon link-icon">
                        <text class="text-2xl">🔗</text>
                      </view>
                      <text class="share-text">复制链接</text>
                    </view>
                  </view>
                </view>
              </view>
            </view>

            <view v-if="showTeamShareModal" class="share-modal-overlay" @click="closeTeamShareModal">
              <view class="share-modal" @click.stop>
                <view class="share-modal-header">
                  <text class="text-lg font-bold text-primary">🤝 协同分享</text>
                  <view @click="closeTeamShareModal" class="close-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </view>
                </view>
                
                <view class="share-modal-content">
                  <view class="share-poster-preview">
                    <view class="poster-header">
                      <text class="text-xl font-bold">{{ teamProjectName }}</text>
                    </view>
                    <view class="poster-date">小组协作任务</view>
                    <view v-if="teamDeadline" class="poster-deadline">
                      <text class="text-xs">⏰ 协作期限: {{ teamDeadline }}</text>
                    </view>
                    <view class="poster-stats">
                      <view class="stat-item">
                        <text class="stat-num">{{ teamMembers.length }}</text>
                        <text class="stat-text">成员</text>
                      </view>
                      <view class="stat-item">
                      <text class="stat-num">{{ teamSelectedTasks.filter(c => c.isCompleted).length }}/{{ teamSelectedTasks.length }}</text>
                      <text class="stat-text">完成</text>
                    </view>
                    </view>
                    <view class="poster-qrcode">
                      <view class="qrcode-placeholder">
                        <text class="text-4xl">🔗</text>
                        <text class="text-xs text-muted mt-1 block">扫码加入</text>
                      </view>
                    </view>
                    <view class="poster-footer">
                      <text class="text-xs text-muted">DDLBINGO 协同任务</text>
                    </view>
                  </view>
                  
                  <view class="deadline-input-section">
                    <text class="text-xs text-muted mb-2 block">设置协作期限（可选）</text>
                    <view class="deadline-input">
                      <input 
                        v-model="teamDeadline"
                        type="text"
                        placeholder="例如：2026-06-01"
                        class="flex-1 px-3 py-2 bg-[#f0f4f0] rounded-lg text-xs"
                      />
                    </view>
                  </view>
                  
                  <view class="share-options">
                    <view class="share-option" @click="shareTeamToQQ">
                      <view class="share-icon qq-icon">
                        <text class="text-2xl">💬</text>
                      </view>
                      <text class="share-text">分享到QQ</text>
                    </view>
                    <view class="share-option" @click="shareTeamToQQZone">
                      <view class="share-icon qzone-icon">
                        <text class="text-2xl">🌟</text>
                      </view>
                      <text class="share-text">分享到QQ空间</text>
                    </view>
                    <view class="share-option" @click="shareTeamToFriend">
                      <view class="share-icon friend-icon">
                        <text class="text-2xl">👥</text>
                      </view>
                      <text class="share-text">分享给QQ好友</text>
                    </view>
                    <view class="share-option" @click="copyTeamLink">
                      <view class="share-icon link-icon">
                        <text class="text-2xl">🔗</text>
                      </view>
                      <text class="share-text">复制链接</text>
                    </view>
                  </view>
                </view>
              </view>
            </view>


          </view>
        </transition>
      </view>
    </view>

    <!-- Chat Sidebar -->
    <ChatSidebar 
      v-if="isChatOpen"
      :messages="messages"
      :isTyping="isTyping"
      :thinkingSteps="thinkingSteps"
      :needsConfirmation="needsConfirmation"
      :confirmOptions="confirmOptions"
      :activeSessionId="activeSessionId"
      :showConvList="showConvList"
      :pendingConfirm="pendingConfirm"
      @closeChat="setIsChatOpen(false)"
      @clearChatHistory="clearChatHistory"
      @sendMessage="handleSendMessage"
      @confirm="handleConfirm"
      @cancelConfirmation="handleCancelConfirmation"
      @scrollToBottom="scrollChatToBottom"
      @scrollToTop="scrollChatToTop"
      @newChat="handleNewChat"
      @switchConversation="handleSwitchConversation"
      @toggleConvList="toggleConvList"
      @refreshSessions="() => {}"
      @confirmAction="handleConfirmActionApi"
      @cancelAction="handleCancelActionApi"
    />

    <!-- Floating Crow (Appears when main crow is scrolled out of view) -->
    <FloatingCrow 
      v-if="!isMainCrowVisible && !isChatOpen && !sittingOnId && !showAddTask && !showDeleteConfirm && !showTimerPicker && !isCrowFainted"
      :isVisible="true"
      :crowAction="crowAction"
      @click="handleCrowClick"
      @dragStart="handleDragStart"
      @drag="handleDrag"
      @dragEnd="handleDragEnd"
    />

    <!-- Bottom Navigation -->
    <BottomNav 
      v-if="isMobile"
      :activeTab="activeTab"
      @change="setActiveTab"
      @openChat="setIsChatOpen(true)"
    />

    <!-- Modals -->
    <AddTaskModal
      :show="showAddTask"
      :taskText="newTaskText"
      :taskDetails="newTaskDetails"
      :startTime="newTaskStartTime"
      :endTime="newTaskEndTime"
      :isRepeat="newTaskIsRepeat"
      :priority="newTaskPriority"
      :estimatedTime="newTaskEstimatedTime"
      :difficulty="newTaskDifficulty"
      @add="handleAddTask"
      @cancel="setShowAddTask(false)"
      @toggleNewTaskStartTimePicker="toggleNewTaskStartTimePicker"
      @toggleNewTaskEndTimePicker="toggleNewTaskEndTimePicker"
    />

    <!-- Edit Task Modal -->
    <view v-if="showEditTask" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,0.1);backdrop-filter:blur(8rpx);display:flex;align-items:center;justify-content:center;" @click="closeEditTask">
      <view style="width:600rpx;max-height:80vh;overflow-y:auto;background:#fdfcf9;border:2rpx solid #e5e0d8;padding:32rpx;border-radius:48rpx;box-shadow:0 50rpx 100rpx -20rpx rgba(0,0,0,0.25);" @click.stop>
        <text style="font-size:36rpx;font-style:italic;color:#5a5a40;margin-bottom:32rpx;display:block;">嘎！修改计划？</text>
        
        <view style="margin-bottom:24rpx;">
          <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">任务内容</text>
          <input
            v-model="editTaskText"
            placeholder="要做什么呢..."
            style="width:100%;height:72rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:32rpx;padding:0 40rpx;font-size:28rpx;outline:none;"
          />
        </view>
        
        <view style="margin-bottom:24rpx;">
          <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">任务详情</text>
          <textarea
            v-model="editTaskDetails"
            placeholder="添加更多详情..."
            style="width:100%;min-height:100rpx;max-height:160rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:32rpx;padding:20rpx 40rpx;font-size:28rpx;outline:none;resize:none;"
          />
        </view>
        
        <view style="margin-bottom:24rpx;">
          <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">开始时间</text>
          <view
            @click="toggleStartTimePicker"
            style="width:100%;height:72rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:32rpx;padding:0 40rpx;font-size:28rpx;display:flex;align-items:center;justify-between;cursor:pointer;"
          >
            <text>{{ editTaskStartTime || '选择开始时间' }}</text>
            <Calendar :size="24" />
          </view>
        </view>
        
        <view style="margin-bottom:32rpx;">
          <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">结束时间</text>
          <view
            @click="toggleEndTimePicker"
            style="width:100%;height:72rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:32rpx;padding:0 40rpx;font-size:28rpx;display:flex;align-items:center;justify-between;cursor:pointer;"
          >
            <text>{{ editTaskEndTime || '选择结束时间' }}</text>
            <Calendar :size="24" />
          </view>
        </view>
        
        <view style="margin-bottom:32rpx;">
          <view style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12rpx;margin-left:20rpx;">
            <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;">重复日程</text>
            <view @click="editTaskIsRepeat = !editTaskIsRepeat" style="width:80rpx;height:40rpx;background:#e5e0d8;border-radius:20rpx;position:relative;cursor:pointer;" :class="{ 'bg-primary': editTaskIsRepeat }">
              <view style="width:36rpx;height:36rpx;background:#fff;border-radius:50%;position:absolute;top:2rpx;left:2rpx;transition:all 0.3s;" :style="{ transform: editTaskIsRepeat ? 'translateX(40rpx)' : 'translateX(0)' }"></view>
            </view>
          </view>
          <text v-if="editTaskIsRepeat" style="font-size:16rpx;color:#8c857d;margin-left:20rpx;">开启后，每天都会生成此任务</text>
        </view>
        
        <view style="margin-bottom:32rpx;">
          <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">重要级别</text>
          <view style="display:flex;gap:16rpx;margin-left:20rpx;">
            <view 
              @click="editTaskPriority = 'urgent'" 
              style="flex:1;height:64rpx;border:2rpx solid #e5e0d8;border-radius:24rpx;display:flex;align-items:center;justify-content:center;cursor:pointer;" 
              :class="{ 'border-red-500 bg-red-50': editTaskPriority === 'urgent' }"
            >
              <text :style="{ color: editTaskPriority === 'urgent' ? '#ef4444' : '#8c857d' }">紧急</text>
            </view>
            <view 
              @click="editTaskPriority = 'normal'" 
              style="flex:1;height:64rpx;border:2rpx solid #e5e0d8;border-radius:24rpx;display:flex;align-items:center;justify-content:center;cursor:pointer;" 
              :class="{ 'border-green-500 bg-green-50': editTaskPriority === 'normal' }"
            >
              <text :style="{ color: editTaskPriority === 'normal' ? '#22c55e' : '#8c857d' }">一般</text>
            </view>
          </view>
        </view>
        
        <view style="margin-bottom:32rpx;">
          <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">预计耗时 (分钟)</text>
          <input
            v-model.number="editTaskEstimatedTime"
            type="number"
            min="0"
            placeholder="0"
            style="width:100%;height:72rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:32rpx;padding:0 40rpx;font-size:28rpx;outline:none;"
          />
        </view>
        
        <view style="margin-bottom:32rpx;">
          <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">难度</text>
          <view style="display:flex;gap:16rpx;margin-left:20rpx;">
            <view 
              @click="editTaskDifficulty = 'easy'" 
              style="flex:1;height:64rpx;border:2rpx solid #e5e0d8;border-radius:24rpx;display:flex;align-items:center;justify-content:center;cursor:pointer;" 
              :class="{ 'border-green-500 bg-green-50': editTaskDifficulty === 'easy' }"
            >
              <text :style="{ color: editTaskDifficulty === 'easy' ? '#22c55e' : '#8c857d' }">简单</text>
            </view>
            <view 
              @click="editTaskDifficulty = 'medium'" 
              style="flex:1;height:64rpx;border:2rpx solid #e5e0d8;border-radius:24rpx;display:flex;align-items:center;justify-content:center;cursor:pointer;" 
              :class="{ 'border-yellow-500 bg-yellow-50': editTaskDifficulty === 'medium' }"
            >
              <text :style="{ color: editTaskDifficulty === 'medium' ? '#eab308' : '#8c857d' }">中等</text>
            </view>
            <view 
              @click="editTaskDifficulty = 'hard'" 
              style="flex:1;height:64rpx;border:2rpx solid #e5e0d8;border-radius:24rpx;display:flex;align-items:center;justify-content:center;cursor:pointer;" 
              :class="{ 'border-red-500 bg-red-50': editTaskDifficulty === 'hard' }"
            >
              <text :style="{ color: editTaskDifficulty === 'hard' ? '#ef4444' : '#8c857d' }">困难</text>
            </view>
          </view>
        </view>
        
        <view style="display:flex;gap:24rpx;">
          <view @click="closeEditTask" style="flex:1;height:72rpx;background:#f0ede8;border-radius:32rpx;display:flex;align-items:center;justify-content:center;">
            <text style="font-size:28rpx;font-weight:500;color:#8c857d;">取消</text>
          </view>
          <view @click="handleEditTask" style="flex:1;height:72rpx;background:#5a5a40;border-radius:32rpx;display:flex;align-items:center;justify-content:center;box-shadow:0 20rpx 30rpx -10rpx rgba(90,90,64,0.3);">
            <text style="font-size:28rpx;font-weight:500;color:#fff;">保存</text>
          </view>
        </view>
      </view>
    </view>

    <DiaryEditModal 
      :show="showDiaryEdit"
      :isEditing="!!editingDiary"
      :diary="editingDiary"
      @update:show="val => showDiaryEdit.value = val"
      @save="handleSaveDiary"
      @cancel="closeDiaryEdit"
      @toggleDatePicker="showDatePicker.value = true"
    />

    <!-- Date Picker Modals -->
    <DatePickerModal 
      v-if="showDatePicker"
      :calendarYear="dateCalendarYear"
      :calendarMonth="dateCalendarMonth"
      :days="dateCalendarDays"
      :selectedValue="selectedDateValue"
      @prevMonth="prevDateMonth"
      @nextMonth="nextDateMonth"
      @select="selectDate"
      @confirm="confirmDate"
      @close="closeDatePicker"
    />

    <DatePickerModal 
      v-if="showScheduleDatePicker"
      :calendarYear="scheduleDateCalendarYear"
      :calendarMonth="scheduleDateCalendarMonth"
      :days="scheduleDateCalendarDays"
      :selectedValue="selectedScheduleDateValue"
      @prevMonth="prevScheduleDateMonth"
      @nextMonth="nextScheduleDateMonth"
      @select="selectScheduleDate"
      @confirm="confirmScheduleDate"
      @close="closeScheduleDatePicker"
    />

    <!-- Image Viewer Modal -->
    <ImageViewerModal 
      v-if="showImageViewer"
      :images="viewingImages"
      :currentIndex="viewingImageIndex"
      @close="closeImageViewer"
      @prev="prevImage"
      @next="nextImage"
    />

    <!-- Delete Confirm Modal -->
    <ConfirmModal 
      v-if="showDeleteConfirm"
      title="确认删除"
      message="确定要删除这个任务吗？此操作不可恢复！"
      confirmText="删除"
      cancelText="取消"
      :isDanger="true"
      @confirm="confirmDeleteTask"
      @cancel="cancelDeleteTask"
    />

    <ConfirmModal 
      v-if="showDiaryDeleteConfirm"
      title="确认删除"
      message="确定要删除这篇日记吗？此操作不可恢复！"
      confirmText="删除"
      cancelText="取消"
      :isDanger="true"
      @confirm="confirmDeleteDiary"
      @cancel="showDiaryDeleteConfirm.value = false"
    />

    <!-- Start Time Picker -->
    <view v-if="showStartTimePicker" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:100000;background:rgba(0,0,0,0.1);backdrop-filter:blur(8rpx);display:flex;align-items:flex-end;justify-content:center;" @click="showStartTimePicker = false">
      <view style="width:100%;max-width:750rpx;background:#fdfcf9;border-top:2rpx solid #e5e0d8;border-radius:48rpx 48rpx 0 0;padding:32rpx;box-sizing:border-box;" @click.stop>
        <view style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32rpx;">
          <text style="font-size:32rpx;font-weight:bold;color:#5a5a40;">选择开始时间</text>
          <view @click="showStartTimePicker = false" style="padding:16rpx;">
            <X :size="24" />
          </view>
        </view>
        <view style="height:50vh;max-height:500rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:24rpx;margin-bottom:32rpx;box-sizing:border-box;overflow-y:auto;">
          <!-- 日历选择器 -->
          <view style="padding:20rpx;display:flex;flex-direction:column;">
            <view style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24rpx;">
              <view @click="prevMonth('start')" style="padding:8rpx;cursor:pointer;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </view>
              <text style="font-size:28rpx;font-weight:bold;">{{ startCalendarYear }}年{{ startCalendarMonth }}月</text>
              <view @click="nextMonth('start')" style="padding:8rpx;cursor:pointer;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </view>
            </view>
            <view style="display:grid;grid-template-columns:repeat(7,1fr);gap:8rpx;margin-bottom:16rpx;">
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">日</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">一</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">二</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">三</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">四</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">五</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">六</text>
            </view>
            <view style="display:grid;grid-template-columns:repeat(7,1fr);gap:8rpx;">
              <view v-for="(day, index) in startCalendarDays" :key="index" style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;" 
                :class="{
                  'bg-primary text-white': day.isSelected,
                  'text-gray-300': day.isOtherMonth,
                  'text-gray-400 cursor-not-allowed': day.isDisabled,
                  'hover:bg-background': !day.isOtherMonth && !day.isSelected && !day.isDisabled
                }"
                @click="selectStartDate(day)"
              >
                <text style="font-size:clamp(16rpx, 3vw, 24rpx);">{{ day.date }}</text>
              </view>
            </view>
          </view>
        </view>
        <view style="display:flex;gap:24rpx;">
          <view @click="showStartTimePicker = false" style="flex:1;height:72rpx;background:#f0ede8;border-radius:32rpx;display:flex;align-items:center;justify-content:center;">
            <text style="font-size:clamp(18rpx, 3.5vw, 28rpx);font-weight:500;color:#8c857d;">取消</text>
          </view>
          <view @click="confirmStartTime" style="flex:1;height:72rpx;background:#5a5a40;border-radius:32rpx;display:flex;align-items:center;justify-content:center;box-shadow:0 20rpx 30rpx -10rpx rgba(90,90,64,0.3);">
            <text style="font-size:clamp(18rpx, 3.5vw, 28rpx);font-weight:500;color:#fff;">确认</text>
          </view>
        </view>
      </view>
    </view>
    
    <!-- End Time Picker -->
    <view v-if="showEndTimePicker" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:100000;background:rgba(0,0,0,0.1);backdrop-filter:blur(8rpx);display:flex;align-items:flex-end;justify-content:center;" @click="showEndTimePicker = false">
      <view style="width:100%;max-width:750rpx;background:#fdfcf9;border-top:2rpx solid #e5e0d8;border-radius:48rpx 48rpx 0 0;padding:32rpx;box-sizing:border-box;" @click.stop>
        <view style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32rpx;">
          <text style="font-size:32rpx;font-weight:bold;color:#5a5a40;">选择结束时间</text>
          <view @click="showEndTimePicker = false" style="padding:16rpx;">
            <X :size="24" />
          </view>
        </view>
        <view style="height:50vh;max-height:500rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:24rpx;margin-bottom:32rpx;box-sizing:border-box;overflow-y:auto;">
          <!-- 日历选择器 -->
          <view style="padding:20rpx;display:flex;flex-direction:column;">
            <view style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24rpx;">
              <view @click="prevMonth('end')" style="padding:8rpx;cursor:pointer;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </view>
              <text style="font-size:28rpx;font-weight:bold;">{{ endCalendarYear }}年{{ endCalendarMonth }}月</text>
              <view @click="nextMonth('end')" style="padding:8rpx;cursor:pointer;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </view>
            </view>
            <view style="display:grid;grid-template-columns:repeat(7,1fr);gap:8rpx;margin-bottom:16rpx;">
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">日</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">一</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">二</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">三</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">四</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">五</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">六</text>
            </view>
            <view style="display:grid;grid-template-columns:repeat(7,1fr);gap:8rpx;">
              <view v-for="(day, index) in endCalendarDays" :key="index" style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;" 
                :class="{
                  'bg-primary text-white': day.isSelected,
                  'text-gray-300': day.isOtherMonth,
                  'text-gray-400 cursor-not-allowed': day.isDisabled,
                  'hover:bg-background': !day.isOtherMonth && !day.isSelected && !day.isDisabled
                }"
                @click="selectEndDate(day)"
              >
                <text style="font-size:clamp(16rpx, 3vw, 24rpx);">{{ day.date }}</text>
              </view>
            </view>
          </view>
        </view>
        <view style="display:flex;gap:24rpx;">
          <view @click="showEndTimePicker = false" style="flex:1;height:72rpx;background:#f0ede8;border-radius:32rpx;display:flex;align-items:center;justify-content:center;">
            <text style="font-size:clamp(18rpx, 3.5vw, 28rpx);font-weight:500;color:#8c857d;">取消</text>
          </view>
          <view @click="confirmEndTime" style="flex:1;height:72rpx;background:#5a5a40;border-radius:32rpx;display:flex;align-items:center;justify-content:center;box-shadow:0 20rpx 30rpx -10rpx rgba(90,90,64,0.3);">
            <text style="font-size:clamp(18rpx, 3.5vw, 28rpx);font-weight:500;color:#fff;">确认</text>
          </view>
        </view>
      </view>
    </view>
    
    <!-- New Task Start Time Picker -->
    <view v-if="showNewTaskStartTimePicker" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:100000;background:rgba(0,0,0,0.1);backdrop-filter:blur(8rpx);display:flex;align-items:flex-end;justify-content:center;" @click="showNewTaskStartTimePicker = false">
      <view style="width:100%;max-width:750rpx;background:#fdfcf9;border-top:2rpx solid #e5e0d8;border-radius:48rpx 48rpx 0 0;padding:32rpx;box-sizing:border-box;" @click.stop>
        <view style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32rpx;">
          <text style="font-size:32rpx;font-weight:bold;color:#5a5a40;">选择开始时间</text>
          <view @click="showNewTaskStartTimePicker = false" style="padding:16rpx;">
            <X :size="24" />
          </view>
        </view>
        <view style="height:50vh;max-height:500rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:24rpx;margin-bottom:32rpx;box-sizing:border-box;overflow-y:auto;">
          <!-- 日历选择器 -->
          <view style="padding:20rpx;display:flex;flex-direction:column;">
            <view style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24rpx;">
              <view @click="newTaskPrevMonth('start')" style="padding:8rpx;cursor:pointer;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </view>
              <text style="font-size:28rpx;font-weight:bold;">{{ newTaskStartCalendarYear }}年{{ newTaskStartCalendarMonth }}月</text>
              <view @click="newTaskNextMonth('start')" style="padding:8rpx;cursor:pointer;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </view>
            </view>
            <view style="display:grid;grid-template-columns:repeat(7,1fr);gap:8rpx;margin-bottom:16rpx;">
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">日</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">一</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">二</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">三</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">四</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">五</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">六</text>
            </view>
            <view style="display:grid;grid-template-columns:repeat(7,1fr);gap:8rpx;">
              <view v-for="(day, index) in newTaskStartCalendarDays" :key="index" style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;" 
                :class="{
                  'bg-primary text-white': day.isSelected,
                  'text-gray-300': day.isOtherMonth,
                  'text-gray-400 cursor-not-allowed': day.isDisabled,
                  'hover:bg-background': !day.isOtherMonth && !day.isSelected && !day.isDisabled
                }"
                @click="newTaskSelectStartDate(day)"
              >
                <text style="font-size:clamp(16rpx, 3vw, 24rpx);">{{ day.date }}</text>
              </view>
            </view>
          </view>
        </view>
        <view style="display:flex;gap:24rpx;">
          <view @click="showNewTaskStartTimePicker = false" style="flex:1;height:72rpx;background:#f0ede8;border-radius:32rpx;display:flex;align-items:center;justify-content:center;">
            <text style="font-size:clamp(18rpx, 3.5vw, 28rpx);font-weight:500;color:#8c857d;">取消</text>
          </view>
          <view @click="newTaskConfirmStartTime" style="flex:1;height:72rpx;background:#5a5a40;border-radius:32rpx;display:flex;align-items:center;justify-content:center;box-shadow:0 20rpx 30rpx -10rpx rgba(90,90,64,0.3);">
            <text style="font-size:clamp(18rpx, 3.5vw, 28rpx);font-weight:500;color:#fff;">确认</text>
          </view>
        </view>
      </view>
    </view>
    
    <!-- New Task End Time Picker -->
    <view v-if="showNewTaskEndTimePicker" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:100000;background:rgba(0,0,0,0.1);backdrop-filter:blur(8rpx);display:flex;align-items:flex-end;justify-content:center;" @click="showNewTaskEndTimePicker = false">
      <view style="width:100%;max-width:750rpx;background:#fdfcf9;border-top:2rpx solid #e5e0d8;border-radius:48rpx 48rpx 0 0;padding:32rpx;box-sizing:border-box;" @click.stop>
        <view style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32rpx;">
          <text style="font-size:32rpx;font-weight:bold;color:#5a5a40;">选择结束时间</text>
          <view @click="showNewTaskEndTimePicker = false" style="padding:16rpx;">
            <X :size="24" />
          </view>
        </view>
        <view style="height:50vh;max-height:500rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:24rpx;margin-bottom:32rpx;box-sizing:border-box;overflow-y:auto;">
          <!-- 日历选择器 -->
          <view style="padding:20rpx;display:flex;flex-direction:column;">
            <view style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24rpx;">
              <view @click="newTaskPrevMonth('end')" style="padding:8rpx;cursor:pointer;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </view>
              <text style="font-size:28rpx;font-weight:bold;">{{ newTaskEndCalendarYear }}年{{ newTaskEndCalendarMonth }}月</text>
              <view @click="newTaskNextMonth('end')" style="padding:8rpx;cursor:pointer;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </view>
            </view>
            <view style="display:grid;grid-template-columns:repeat(7,1fr);gap:8rpx;margin-bottom:16rpx;">
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">日</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">一</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">二</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">三</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">四</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">五</text>
              <text style="text-align:center;font-size:clamp(16rpx, 3vw, 24rpx);color:#8c857d;">六</text>
            </view>
            <view style="display:grid;grid-template-columns:repeat(7,1fr);gap:8rpx;">
              <view v-for="(day, index) in newTaskEndCalendarDays" :key="index" style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;" 
                :class="{
                  'bg-primary text-white': day.isSelected,
                  'text-gray-300': day.isOtherMonth,
                  'text-gray-400 cursor-not-allowed': day.isDisabled,
                  'hover:bg-background': !day.isOtherMonth && !day.isSelected && !day.isDisabled
                }"
                @click="newTaskSelectEndDate(day)"
              >
                <text style="font-size:clamp(16rpx, 3vw, 24rpx);">{{ day.date }}</text>
              </view>
            </view>
          </view>
        </view>
        <view style="display:flex;gap:24rpx;">
          <view @click="showNewTaskEndTimePicker = false" style="flex:1;height:72rpx;background:#f0ede8;border-radius:32rpx;display:flex;align-items:center;justify-content:center;">
            <text style="font-size:clamp(18rpx, 3.5vw, 28rpx);font-weight:500;color:#8c857d;">取消</text>
          </view>
          <view @click="newTaskConfirmEndTime" style="flex:1;height:72rpx;background:#5a5a40;border-radius:32rpx;display:flex;align-items:center;justify-content:center;box-shadow:0 20rpx 30rpx -10rpx rgba(90,90,64,0.3);">
            <text style="font-size:clamp(18rpx, 3.5vw, 28rpx);font-weight:500;color:#fff;">确认</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 设置弹窗 -->
    <view v-if="showSettingsModal" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:100000;background:rgba(0,0,0,0.3);backdrop-filter:blur(8rpx);display:flex;align-items:center;justify-content:center;padding:32rpx;" @click="showSettingsModal = false">
      <view style="width:100%;max-width:600rpx;background:#fdfcf9;border-radius:32rpx;padding:40rpx;box-sizing:border-box;box-shadow:0 20rpx 60rpx rgba(0,0,0,0.15);" @click.stop>
        <view style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32rpx;">
          <text style="font-size:32rpx;font-weight:bold;color:#5a5a40;">设置</text>
          <view @click="showSettingsModal = false" style="padding:8rpx;cursor:pointer;">
            <X :size="24" />
          </view>
        </view>

        <view style="margin-bottom:32rpx;">
          <text style="font-size:26rpx;font-weight:600;color:#5a5a40;display:block;margin-bottom:16rpx;">DeepSeek API Key</text>
          <text style="font-size:22rpx;color:#8c857d;display:block;margin-bottom:16rpx;">请输入你的 DeepSeek API Key，用于 AI 对话功能。Key 将保存在本地，不会上传到服务器。</text>
          <view style="display:flex;gap:16rpx;">
            <input 
              v-model="deepseekApiKey"
              type="text"
              :password="!showApiKey"
              placeholder="sk-..."
              style="flex:1;height:72rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:16rpx;padding:0 24rpx;font-size:24rpx;color:#5a5a40;box-sizing:border-box;"
            />
            <view 
              @click="showApiKey = !showApiKey"
              style="width:72rpx;height:72rpx;background:#f0ede8;border-radius:16rpx;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;"
            >
              <text style="font-size:32rpx;">{{ showApiKey ? '🙈' : '👁️' }}</text>
            </view>
          </view>
        </view>

        <view style="display:flex;gap:24rpx;">
          <view @click="clearDeepseekKey" style="flex:1;height:72rpx;background:#f0ede8;border-radius:32rpx;display:flex;align-items:center;justify-content:center;cursor:pointer;">
            <text style="font-size:clamp(18rpx, 3.5vw, 28rpx);font-weight:500;color:#8c857d;">清除 Key</text>
          </view>
          <view @click="saveDeepseekKey" style="flex:1;height:72rpx;background:#5a5a40;border-radius:32rpx;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 20rpx 30rpx -10rpx rgba(90,90,64,0.3);">
            <text style="font-size:clamp(18rpx, 3.5vw, 28rpx);font-weight:500;color:#fff;">保存</text>
          </view>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import Crow from '../../components/Crow.vue';
import { Calendar, Image as ImageIcon, MessageSquare, Timer, Coffee, X, CheckCircle2, Clock, Send, Plus, Search, Settings } from 'lucide-vue-next';
import { isLoggedIn, getCurrentUser, logout } from '../../utils/auth';
import { request, API_BASE_URL, getConversationMessages, chatWithDeepSeek, syncScheduleToTasks, syncTaskToSchedule, saveBingoResults, getDDLPool, completeDDLTask, getAchievements, saveAchievements as saveAchievementsToServer } from '../../utils/api';
import * as XLSX from 'xlsx';

// Import components
import Header from '../../components/Header.vue';
import CrowArea from '../../components/CrowArea.vue';
import TipsCard from '../../components/TipsCard.vue';
import TabNavigation from '../../components/TabNavigation.vue';
import CourseTable from '../../components/CourseTable.vue';
import ScheduleTab from '../../components/ScheduleTab.vue';
import DiaryTab from '../../components/DiaryTab.vue';
import ChatSidebar from '../../components/ChatSidebar.vue';
import FloatingCrow from '../../components/FloatingCrow.vue';
import BottomNav from '../../components/BottomNav.vue';
import AddTaskModal from '../../components/AddTaskModal.vue';
import DiaryEditModal from '../../components/DiaryEditModal.vue';
import DatePickerModal from '../../components/DatePickerModal.vue';
import ImageViewerModal from '../../components/ImageViewerModal.vue';
import ConfirmModal from '../../components/ConfirmModal.vue';
import BingoBoard from '../../components/BingoBoard.vue';
import TeamBingo from '../../components/TeamBingo.vue';
import BirdSVG from '../../components/BirdSVG.vue';
import AchievementWall from '../../components/AchievementWall.vue';
import { useBingoTaskMatcher } from '../../composables/useBingoTaskMatcher';

// Utility Functions
const generateId = (content, type = 'task') => {
  const str = `${type}:${JSON.stringify(content)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const mergeData = (localData, serverData) => {
  const merged = [];
  const localMap = new Map();
  
  localData.forEach(item => {
    localMap.set(item.id, item);
  });
  
  serverData.forEach(serverItem => {
    const localItem = localMap.get(serverItem.id);
    if (localItem) {
      const localTime = localItem.updatedAt || 0;
      const serverTime = serverItem.updatedAt || 0;
      if (serverTime > localTime) {
        merged.push(serverItem);
      } else {
        merged.push(localItem);
      }
      localMap.delete(serverItem.id);
    } else {
      merged.push(serverItem);
    }
  });
  
  localMap.forEach(item => {
    merged.push(item);
  });
  
  return merged;
};

// OSS Functions
const ossConfig = {
  region: 'oss-cn-guangzhou',
  bucket: 'shiya-picture',
  endpoint: 'https://shiya-picture.oss-cn-guangzhou.aliyuncs.com'
};

const getOssSignature = async () => {
  try {
    const token = uni.getStorageSync('token');
    if (!token) {
      throw new Error('No token found');
    }

    return new Promise((resolve, reject) => {
      uni.request({
        url: API_BASE_URL + '/oss-signature',
        method: 'GET',
        header: {
          'Authorization': `Bearer ${token}`
        },
        success: (res) => {
          if (res.data && res.data.success && res.data.data) {
            const { policy, signature, accessKeyId } = res.data.data;
            resolve({ policy, signature, accessKeyId });
          } else {
            reject(new Error('Failed to get OSS signature'));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  } catch (error) {
    const policyText = {
      expiration: new Date(Date.now() + 3600000).toISOString(),
      conditions: [
        ['content-length-range', 0, 104857600]
      ]
    };
    
    const policy = btoa(unescape(encodeURIComponent(JSON.stringify(policyText))));
    const signature = 'mock_signature';
    
    return Promise.resolve({ policy, signature, accessKeyId: 'LTAI5tMcZuAtmXMGCizfgqZZ' });
  }
};

// State
const todos = ref([]);
const repeatTasks = ref([]);
const completedTasks = ref([]);
const crowStats = ref({ hunger: 100, mood: 90 });
const foodCount = ref(5);
const lastUpdated = ref(null); // 服务端同步的时间戳，用于衰减计算
  const fedTaskIds = ref([]); // 已投喂过的任务 ID（同一任务不重复 +1）
  const isCrowFainted = computed(() => crowStats.value.hunger <= 0 || crowStats.value.mood <= 0);
const petData = ref({ date: new Date().toLocaleDateString('zh-CN'), count: 0 });
const userPreferences = ref({});
const currentUser = ref(null);
const showUserMenu = ref(false);
const showSettingsModal = ref(false);
const deepseekApiKey = ref('');
const showApiKey = ref(false);
const crowAction = ref('idle');
const isMainCrowVisible = ref(true);
const sittingOnId = ref(null);
const showCrowMenu = ref(false);
const showTimerPicker = ref(false);
const timerDuration = ref(25);
const timeLeft = ref(null);
const isTimerRunning = ref(false);
const dragOverId = ref(null);
let timerInterval = null;

// Sleep timer logic
let sleepTimer = null;
let lastInteractionTime = Date.now();

let saveCrowDataTimer = null;
const debouncedSaveCrowData = () => {
  if (saveCrowDataTimer) {
    clearTimeout(saveCrowDataTimer);
  }
  saveCrowDataTimer = setTimeout(async () => {
    try {
      const token = uni.getStorageSync('token');
      if (token) {
        await uni.request({
          url: API_BASE_URL + '/save-crow-data',
          method: 'POST',
          header: {
            'Authorization': `Bearer ${token}`
          },
          data: {
            crowStats: crowStats.value,
            chatMessages: messages.value,
            foodCount: foodCount.value,
            userPreferences: userPreferences.value
          }
        });
      }
    } catch (error) {
      console.error('同步 Crow 数据到服务器失败:', error);
    }
  }, 1000);
};

// Save/Load Data
const saveData = () => {
  uni.setStorageSync('todos', todos.value);
  uni.setStorageSync('repeatTasks', repeatTasks.value);
  uni.setStorageSync('completedTasks', completedTasks.value);
  uni.setStorageSync('crowStats', crowStats.value);
  uni.setStorageSync('foodCount', foodCount.value);
  uni.setStorageSync('fedTaskIds', fedTaskIds.value);
  uni.setStorageSync('isCrowFainted', isCrowFainted.value);
  uni.setStorageSync('petData', petData.value);
  uni.setStorageSync('diaryEntries', diaryEntries.value);
  uni.setStorageSync('chatMessages', messages.value);
  uni.setStorageSync('userPreferences', userPreferences.value);
  uni.setStorageSync('lastUpdated', lastUpdated.value);
  
  debouncedSaveCrowData();
};

const loadData = () => {
  const storedTodos = uni.getStorageSync('todos');
  if (storedTodos) {
    todos.value = storedTodos;
  } else {
    todos.value = [
      { id: '1', text: '整理今日灵感', completed: false, time: '10:00' },
      { id: '2', text: '给乌鸦喂食 (交互测试)', completed: true, time: '08:30' },
    ];
  }
  
  const storedCrowStats = uni.getStorageSync('crowStats');
  if (storedCrowStats) {
    crowStats.value = storedCrowStats;
  } else {
    crowStats.value = { hunger: 50, mood: 50 };
  }
  
  const storedFoodCount = uni.getStorageSync('foodCount');
  if (storedFoodCount !== null && storedFoodCount !== undefined) {
    foodCount.value = storedFoodCount;
  } else {
    foodCount.value = 1;
  }
  
  const storedFedTaskIds = uni.getStorageSync('fedTaskIds');
  if (storedFedTaskIds) {
    fedTaskIds.value = storedFedTaskIds;
  }
  
  const storedPetData = uni.getStorageSync('petData');
  if (storedPetData) {
    const today = new Date().toLocaleDateString('zh-CN');
    if (storedPetData.date === today) {
      petData.value = storedPetData;
    } else {
      petData.value = { date: today, count: 0 };
    }
  }
  
  const storedDiaryEntries = uni.getStorageSync('diaryEntries');
  if (storedDiaryEntries) {
    diaryEntries.value = storedDiaryEntries;
  } else {
    diaryEntries.value = [
      { id: '1', date: '2026-03-19', content: '今天开始制作拾鸦软件，像素风乌鸦真可爱。', tags: ['开发', '心情'], image: 'https://picsum.photos/seed/crow/400/300' }
    ];
  }
  
  const storedRepeatTasks = uni.getStorageSync('repeatTasks');
  if (storedRepeatTasks) {
    repeatTasks.value = storedRepeatTasks;
  }
  
  const storedCompletedTasks = uni.getStorageSync('completedTasks');
  if (storedCompletedTasks) {
    completedTasks.value = storedCompletedTasks;
  }
  
  const storedChatMessages = uni.getStorageSync('chatMessages');
  if (storedChatMessages) {
    messages.value = storedChatMessages;
  } else {
    messages.value = [
      { role: 'model', text: '嘎！我是你的拾鸦助手，今天有什么想记录的吗？' }
    ];
  }
  
  const storedUserPreferences = uni.getStorageSync('userPreferences');
  if (storedUserPreferences) {
    userPreferences.value = storedUserPreferences;
  }
  
  const storedLastUpdated = uni.getStorageSync('lastUpdated');
  if (storedLastUpdated) {
    lastUpdated.value = storedLastUpdated;
  }
  
  saveData();
};

// 防止重复调用的锁
let isSendingMessage = false;
const confirmableTool = ref(null);
const pendingMessages = ref([]);
const pendingImages = ref([]);

// Task State
const showAddTask = ref(false);
const newTaskText = ref('');
const newTaskTime = ref('');
const newTaskDetails = ref('');
const newTaskStartTime = ref('');
const newTaskEndTime = ref('');
const newTaskIsRepeat = ref(false);
const newTaskPriority = ref('normal');
const newTaskEstimatedTime = ref(0);
const newTaskDifficulty = ref('medium');
const showNewTaskStartTimePicker = ref(false);
const showNewTaskEndTimePicker = ref(false);
const newTaskSelectedStartDate = ref(null);
const newTaskSelectedEndDate = ref(null);
const newTaskStartCalendarYear = ref(new Date().getFullYear());
const newTaskStartCalendarMonth = ref(new Date().getMonth() + 1);
const newTaskStartCalendarDays = ref([]);
const newTaskEndCalendarYear = ref(new Date().getFullYear());
const newTaskEndCalendarMonth = ref(new Date().getMonth() + 1);
const newTaskEndCalendarDays = ref([]);
const editingTodoId = ref(null);
const editTaskText = ref('');
const showDeleteConfirm = ref(false);
const taskToDelete = ref(null);
const showEditTask = ref(false);
// 待确认操作（Agent 删改日程前等待用户确认）
const pendingConfirm = ref(null);
const currentEditingTask = ref(null);
const editTaskDetails = ref('');
const editTaskStartTime = ref('');
const editTaskEndTime = ref('');
const editTaskIsRepeat = ref(false);
const editTaskPriority = ref('normal');
const editTaskEstimatedTime = ref(0);
const editTaskDifficulty = ref('medium');
const showStartTimePicker = ref(false);
const showEndTimePicker = ref(false);

// Calendar State
const startCalendarYear = ref(new Date().getFullYear());
const startCalendarMonth = ref(new Date().getMonth() + 1);
const startCalendarDays = ref([]);
const endCalendarYear = ref(new Date().getFullYear());
const endCalendarMonth = ref(new Date().getMonth() + 1);
const endCalendarDays = ref([]);
const selectedStartDate = ref(null);
const selectedEndDate = ref(null);

// Diary State
const diaryEntries = ref([
  { id: '1', date: '2026-03-19', content: '今天开始制作拾鸦软件，像素风乌鸦真可爱。', tags: ['开发', '心情'], image: 'https://picsum.photos/seed/crow/400/300' }
]);

const showDiaryEdit = ref(false);
const editingDiary = ref(null);
const editDiaryContent = ref('');
const editDiaryTags = ref([]);
const editDiaryImages = ref([]);
const newDiaryTag = ref('');
const showDiaryDeleteConfirm = ref(false);
const diaryToDelete = ref(null);

// Date Picker State
const selectedDate = ref(getLocalDateString());
const showDatePicker = ref(false);
const dateCalendarYear = ref(new Date().getFullYear());
const dateCalendarMonth = ref(new Date().getMonth() + 1);
const dateCalendarDays = ref([]);
const selectedDateValue = ref(selectedDate.value);

// Schedule Date Picker State
const selectedScheduleDate = ref(getLocalDateString());
const showScheduleDatePicker = ref(false);
const scheduleDateCalendarYear = ref(new Date().getFullYear());
const scheduleDateCalendarMonth = ref(new Date().getMonth() + 1);
const scheduleDateCalendarDays = ref([]);
const selectedScheduleDateValue = ref(selectedScheduleDate.value);
const activeTab = ref('schedule');

// Bingo State
const isBingoMode = ref(false);
const bingoMode = ref('single');
const teamMembers = ref([
  { name: '你', color: '#12b7f5', bgColor: '#e6f7ff' },
  { name: 'B', color: '#52c41a', bgColor: '#f6ffed' },
  { name: 'C', color: '#fa8c16', bgColor: '#fff7e6' }
]);
const currentTeamMember = ref({ name: '你', color: '#12b7f5', bgColor: '#e6f7ff' });
const availableMinutes = ref(0);
const showTimeInput = ref(true);
const pendingRefresh = ref(false);
const teamDeadline = ref('');
const teamProjectName = ref('🐾 宠物健康管理系统');
const isExecutingMode = ref(false);
const executionTasks = ref([]);
const teamSelectedTasks = ref([]);
const totalExecutionTime = ref(0);
const remainingExecutionTime = ref(0);
const isExecutionRunning = ref(false);
const currentTaskIndex = ref(0);
let executionTimer = null;

const isLastTask = computed(() => {
  return currentTaskIndex.value === executionTasks.value.length - 1;
});

const crowActionInExecution = ref('idle');
const crowMessageInExecution = ref('点击我互动吧！');
let crowIdleTimer = null;
let crowAutoActionTimer = null;
const crowClickCount = ref(0);

const crowMessages = [
  '嘎！今天也要加油哦！',
  '专心做事中...',
  '🎵 啦啦啦~',
  '呼...有点困了',
  '继续加油！💪',
  '你真棒！🎉',
  '休息一下吧~',
  '时间过得真快！',
];

const crowAutoActions = ['sleep', 'happy', 'idle', 'happy'];

const {
  selectedTasks,
  userAvailableMinutes,
  usedTime,
  getStatistics,
  generateBingoTasks,
  canFlipCard,
  flipCard,
  completeTask,
  claimTask,
  resetBoard,
  refreshBoard,
  checkBingoComplete,
  loadCompletedTasks
} = useBingoTaskMatcher();

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

// DDL库数据池（启动时为空，由 initBingoBoard 自动从服务器加载）
const bingoTaskPool = ref([]);

const isBingoComplete = computed(() => {
  return selectedTasks.value.length === 9 && selectedTasks.value.every(card => card.isCompleted);
});

const achievements = ref([]);

const loadAchievements = async () => {
  try {
    const res = await getAchievements();
    if (res?.success && Array.isArray(res.data)) {
      achievements.value = res.data;
      return;
    }
  } catch (e) {
    console.error('[成就加载] 服务端失败，回退本地:', e);
  }
  // 回退：从本地存储读取
  try {
    const data = uni.getStorageSync('bingo_achievements');
    if (data) {
      achievements.value = JSON.parse(data);
    }
  } catch (e) {
    achievements.value = [];
  }
};

const saveAchievements = () => {
  // 始终同步到服务端
  saveAchievementsToServer(achievements.value).catch(e => {
    console.error('[成就保存] 服务端失败，保存到本地:', e);
    uni.setStorageSync('bingo_achievements', JSON.stringify(achievements.value));
  });
  // 同时存本地作为快速回退
  try {
    uni.setStorageSync('bingo_achievements', JSON.stringify(achievements.value));
  } catch (e) {}
};

const deleteAchievement = (achievement) => {
  uni.showModal({
    title: '删除成就',
    content: `确定要删除「第 ${achievement.boardNumber} 个 Bingo」的记录吗？\n删除后无法恢复。`,
    confirmText: '删除',
    confirmColor: '#ef4444',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        achievements.value = achievements.value.filter(a => a.id !== achievement.id);
        saveAchievements();
        uni.showToast({ title: '已删除', icon: 'success' });
      }
    }
  });
};

const saveBingoBoard = () => {
  const completedCards = selectedTasks.value.filter(card => card.isCompleted);
  const totalMinutes = completedCards.reduce((sum, card) => sum + (card.estimatedMinutes || 5), 0);
  
  const achievement = {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    tasks: completedCards.map(card => ({
      id: card.id,
      title: card.title,
      estimatedMinutes: card.estimatedMinutes
    })),
    totalMinutes,
    boardNumber: achievements.value.length + 1
  };
  
  achievements.value.push(achievement);
  saveAchievements();

  // DDL 联动：保存 Bingo 完成状态到后端 + 更新本地日程
  const agentTaskCards = completedCards.filter(c => typeof c.id === 'string' && c.id.startsWith('agent_'))
  const ddlCards = completedCards.filter(c => typeof c.id === 'string' && c.id.startsWith('ddl_'))
  
  // agent_ 任务回写
  if (agentTaskCards.length > 0) {
    saveBingoResults(agentTaskCards.map(c => ({ id: c.id, title: c.title }))).then(res => {
      if (res?.success) {
        console.log('[DDL联动] Bingo 已完成任务已保存到后端')
      }
    }).catch(e => console.error('[DDL联动] Bingo保存失败:', e))
  }

  // ddl_ 日程回写：通知后端标记对应日程为完成
  if (ddlCards.length > 0) {
    ddlCards.forEach(card => {
      completeDDLTask(card.id).then(res => {
        if (res?.success) {
          console.log('[DDL联动] Bingo完成 → 日程已回写:', card.title)
        }
      }).catch(e => console.error('[DDL联动] 日程回写失败:', e))
    })
  }

  // 更新本地日程：将 Bingo 完成的任务对应的日程标记为已完成
  agentTaskCards.forEach(card => {
    const match = card.id?.match(/^agent_(\d+)$/)
    if (match) {
      const taskId = parseInt(match[1])
      const todo = todos.value.find(t => t.taskId === taskId)
      if (todo && !todo.completed) {
        todo.completed = true
        console.log('[DDL联动] Bingo完成 → 日程已标记完成:', todo.title)
      }
    }
  })
  // ddl_ 日程本地标记
  ddlCards.forEach(card => {
    const originalId = card.originalId || (card.id ? card.id.replace('ddl_', '') : null)
    if (originalId) {
      const todo = todos.value.find(t => String(t.id) === String(originalId))
      if (todo && !todo.completed) {
        todo.completed = true
        console.log('[DDL联动] Bingo完成 → DDL日程已本地标记完成:', card.title)
      }
    }
  })
  if (agentTaskCards.length > 0 || ddlCards.length > 0) {
    saveData()
    syncData()
  }
  
  uni.showModal({
    title: '🎉 Bingo完成！',
    content: `恭喜完成第 ${achievement.boardNumber} 个棋盘！\n共完成 ${completedCards.length} 个任务，累计 ${totalMinutes} 分钟`,
    showCancel: false,
    success: () => {
      doReset();
    }
  });
};

loadAchievements();

const showShareModal = ref(false);
const selectedAchievement = ref(null);
const showTeamShareModal = ref(false);

const openShareModal = (achievement) => {
  selectedAchievement.value = achievement;
  showShareModal.value = true;
};

const closeShareModal = () => {
  showShareModal.value = false;
  selectedAchievement.value = null;
};

const openTeamShareModal = () => {
  showTeamShareModal.value = true;
};

const closeTeamShareModal = () => {
  showTeamShareModal.value = false;
};

const shareTeamToQQ = () => {
  closeTeamShareModal();
  uni.showModal({
    title: '💬 分享到QQ',
    content: '正在打开QQ分享界面...\n\n真实环境下将调用QQ开放平台API分享协同任务',
    showCancel: false
  });
};

const shareTeamToQQZone = () => {
  closeTeamShareModal();
  uni.showModal({
    title: '🌟 分享到QQ空间',
    content: '正在生成协同分享海报...\n\n真实环境下将调用QQ空间开放平台API生成海报并分享',
    showCancel: false
  });
};

const shareTeamToFriend = () => {
  closeTeamShareModal();
  uni.showModal({
    title: '👥 分享给QQ好友',
    content: '正在打开QQ好友选择界面...\n\n真实环境下将调用QQ开放平台API邀请好友加入协作',
    showCancel: false
  });
};

const copyTeamLink = () => {
  let link = `https://ddlbingo.example.com/team/${encodeURIComponent(teamProjectName.value)}`;
  if (teamDeadline.value) {
    link += `?deadline=${encodeURIComponent(teamDeadline.value)}`;
  }
  uni.setClipboardData({
    data: link,
    success: () => {
      uni.showToast({
        title: '链接已复制',
        icon: 'success'
      });
      closeTeamShareModal();
    }
  });
};

const shareToQQ = () => {
  closeShareModal();
  uni.showModal({
    title: '💬 分享到QQ',
    content: '正在打开QQ分享界面...\n\n真实环境下将调用QQ开放平台API',
    showCancel: false
  });
};

const shareToQQZone = () => {
  closeShareModal();
  uni.showModal({
    title: '🌟 分享到QQ空间',
    content: '正在生成分享海报...\n\n真实环境下将调用QQ空间开放平台API生成海报并分享',
    showCancel: false
  });
};

const shareToFriend = () => {
  closeShareModal();
  uni.showModal({
    title: '👥 分享给QQ好友',
    content: '正在打开QQ好友选择界面...\n\n真实环境下将调用QQ开放平台API选择好友并分享',
    showCancel: false
  });
};

const copyLink = () => {
  const link = `https://ddlbingo.example.com/achievement/${selectedAchievement.value.id}`;
  uni.setClipboardData({
    data: link,
    success: () => {
      uni.showToast({
        title: '链接已复制',
        icon: 'success'
      });
      closeShareModal();
    }
  });
};

// 前端兜底微任务（与服务端 CLASSIC_MICRO_TASKS 保持一致，确保不足9张时补齐）
const FALLBACK_MICRO_TASKS = [
  { id: 'fb_hydrate', title: '喝一杯水', estimatedMinutes: 2, difficulty: 'easy', urgency: 0 },
  { id: 'fb_stand', title: '起身走动', estimatedMinutes: 5, difficulty: 'easy', urgency: 0 },
  { id: 'fb_breathe', title: '深呼吸练习', estimatedMinutes: 2, difficulty: 'easy', urgency: 0 },
  { id: 'fb_stretch', title: '全身拉伸', estimatedMinutes: 5, difficulty: 'easy', urgency: 0 },
  { id: 'fb_eyes', title: '眼保健操', estimatedMinutes: 3, difficulty: 'easy', urgency: 0 },
  { id: 'fb_review', title: '快速复盘', estimatedMinutes: 5, difficulty: 'medium', urgency: 0 },
  { id: 'fb_plan', title: '明日计划', estimatedMinutes: 5, difficulty: 'medium', urgency: 0 },
  { id: 'fb_meditate', title: '冥想5分钟', estimatedMinutes: 5, difficulty: 'medium', urgency: 0 },
  { id: 'fb_read', title: '阅读10分钟', estimatedMinutes: 10, difficulty: 'medium', urgency: 0 },
];

const initBingoBoard = async (minutes = 0) => {
  const availMin = minutes || 120; // 不限时间时默认120分钟
  
  try {
    uni.showLoading({ title: '正在加载DDL库...' });
    
    const res = await getDDLPool({ availableMinutes: availMin, count: 9 });
    
    uni.hideLoading();
    
    if (!res.success || !res.data || res.data.length === 0) {
      uni.showToast({ title: '没有可用日程，请先创建一些日程', icon: 'none' });
      return;
    }
    
    // 将DDL任务设置到Bingo棋盘
    let tasks = res.data.map((task, index) => ({
      ...task,
      uniqueId: `${task.id}_${Date.now()}_${index}`,
      position: index,
      isFlipped: false,
      isCompleted: false,
      isClaimed: false,
      claimedBy: null,
      startTime: null,
      elapsedSeconds: 0,
    }));
    
    // 兜底：确保始终填满9张卡片（与服务端 padding 逻辑双重保障）
    while (tasks.length < 9) {
      const fb = FALLBACK_MICRO_TASKS[(tasks.length) % FALLBACK_MICRO_TASKS.length];
      tasks.push({
        ...fb,
        id: `fb_${Date.now()}_${tasks.length}`,
        uniqueId: `fb_${Date.now()}_${tasks.length}`,
        position: tasks.length,
        isFlipped: false,
        isCompleted: false,
        isClaimed: false,
        claimedBy: null,
        startTime: null,
        elapsedSeconds: 0,
        isPadding: true,
      });
    }
    
    selectedTasks.value = tasks;
    userAvailableMinutes.value = minutes > 0 ? availMin : 0; // 不限时间时显示"不限"，有限时显示具体分钟数
    usedTime.value = 0;
    showTimeInput.value = false;
    
    uni.showToast({ 
      title: `已加载${res.stats?.scheduleCount || ''}日程+${res.stats?.microCount || ''}小任务`, 
      icon: 'success' 
    });
  } catch (e) {
    uni.hideLoading();
    console.error('[DDL库] 加载失败:', e);
    uni.showToast({ title: '加载失败，请重试', icon: 'none' });
  }
};

const handleFlipCard = (index) => {
  if (showTimeInput.value) {
    uni.showToast({ title: '请先输入可用时间', icon: 'none' });
    return;
  }
  
  const result = flipCard(index);
  if (!result.success) {
    uni.showToast({ title: result.message, icon: 'none' });
  }
};

const handleCompleteTask = (index) => {
  const result = completeTask(index);
  if (result.success) {
    uni.vibrateLong();
    uni.showToast({ title: '任务完成！', icon: 'success' });
    checkBingoCompletion();
  }
};

const handleClaimTask = (index) => {
  const result = claimTask(index, currentTeamMember.value);
  if (result.success) {
    uni.vibrateShort();
    uni.showToast({ title: result.message, icon: 'none' });
  }
};

const handleTeamFlipCard = (index) => {
  const card = teamSelectedTasks.value[index];
  if (!card || card.isFlipped || card.isCompleted) {
    return;
  }
  card.isFlipped = true;
};

const handleTeamCompleteTask = (index) => {
  const card = teamSelectedTasks.value[index];
  if (!card || !card.isFlipped || card.isCompleted || card.claimedBy !== currentTeamMember.value.name) {
    uni.showToast({ title: '无法完成此任务', icon: 'none' });
    return;
  }
  
  card.isCompleted = true;
  uni.vibrateLong();
  uni.showToast({ title: '任务完成！', icon: 'success' });
};

const handleTeamClaimTask = (index) => {
  const card = teamSelectedTasks.value[index];
  if (!card || !card.isFlipped || card.isCompleted || card.isClaimed) {
    uni.showToast({ title: '无法领取此任务', icon: 'none' });
    return;
  }
  
  card.isClaimed = true;
  card.claimedBy = currentTeamMember.value.name;
  card.claimedByColor = currentTeamMember.value.color;
  card.claimedByBgColor = currentTeamMember.value.bgColor;
  
  uni.vibrateShort();
  uni.showToast({ title: `${currentTeamMember.value.name} 已领取任务`, icon: 'none' });
};

const initTeamBoard = () => {
  if (teamSelectedTasks.value.length === 0) {
    const tasks = [...bingoTaskPool.value];
    const selected = [];
    
    for (let i = 0; i < 9; i++) {
      if (tasks.length > 0 && Math.random() > 0.2) {
        const idx = Math.floor(Math.random() * tasks.length);
        selected.push({ ...tasks.splice(idx, 1)[0] });
      } else {
        const zeroTasks = [
          { id: 'zero_1', title: '喝水', estimatedMinutes: 2, difficulty: 'low', urgency: 1 },
          { id: 'zero_2', title: '起身走动', estimatedMinutes: 2, difficulty: 'low', urgency: 1 },
          { id: 'zero_3', title: '深呼吸', estimatedMinutes: 1, difficulty: 'low', urgency: 1 },
          { id: 'zero_4', title: '整理桌面', estimatedMinutes: 3, difficulty: 'low', urgency: 1 },
        ];
        const idx = Math.floor(Math.random() * zeroTasks.length);
        const zeroTask = { ...zeroTasks[idx] };
        zeroTask.id = `${zeroTask.id}_${Date.now()}_${i}`;
        selected.push(zeroTask);
      }
    }
    
    for (let i = selected.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [selected[i], selected[j]] = [selected[j], selected[i]];
    }
    
    teamSelectedTasks.value = selected.map((task, index) => ({
      ...task,
      uniqueId: `${task.id}_${Date.now()}_${index}`,
      position: index,
      isFlipped: false,
      isCompleted: false,
      isClaimed: false,
      claimedBy: null,
      claimedByColor: null,
      claimedByBgColor: null
    }));
  }
};

const checkBingoCompletion = () => {
  if (checkBingoComplete()) {
    uni.showModal({
      title: '🎉 Bingo！',
      content: '恭喜完成所有任务！',
      showCancel: false
    });
  }
};

const refreshBingoBoard = () => {
  // 刷新前先让用户重新输入可用时间，以更好匹配任务
  const unflipped = selectedTasks.value.filter(card => !card.isFlipped && !card.isCompleted);
  if (unflipped.length === 0) {
    uni.showToast({ title: '所有卡片都已完成或翻开', icon: 'none' });
    return;
  }
  // 进入时间输入模式，等待用户确认后执行 doRefreshBingoBoard
  pendingRefresh.value = true;
  showTimeInput.value = true;
  availableMinutes.value = userAvailableMinutes.value || 0;
};

const doRefreshBingoBoard = async (minutes = 0) => {
  // 实际执行刷新：只替换未翻开且未完成的卡片
  const unflipped = selectedTasks.value.filter(card => !card.isFlipped && !card.isCompleted);
  
  if (unflipped.length === 0) {
    pendingRefresh.value = false;
    showTimeInput.value = false;
    uni.showToast({ title: '所有卡片都已完成或翻开', icon: 'none' });
    return;
  }
  
  const availMin = minutes > 0 ? minutes : 120;
  const replacementCount = unflipped.length;
  
  try {
    uni.showLoading({ title: '刷新未翻开卡片...' });
    
    const res = await getDDLPool({ availableMinutes: availMin, count: replacementCount });
    
    uni.hideLoading();
    
    if (!res.success || !res.data || res.data.length === 0) {
      pendingRefresh.value = false;
      showTimeInput.value = false;
      uni.showToast({ title: '刷新失败，请重试', icon: 'none' });
      return;
    }
    
    // 替换未翻开的卡片，保留已翻开/已完成的
    let newCards = res.data.map((task, i) => ({
      ...task,
      uniqueId: `${task.id}_refresh_${Date.now()}_${i}`,
      position: unflipped[i]?.position || i,
      isFlipped: false,
      isCompleted: false,
      isClaimed: false,
      claimedBy: null,
      startTime: null,
      elapsedSeconds: 0,
    }));
    
    // 兜底：服务端返回不足时用前端微任务补齐
    while (newCards.length < replacementCount) {
      const fb = FALLBACK_MICRO_TASKS[(newCards.length) % FALLBACK_MICRO_TASKS.length];
      newCards.push({
        ...fb,
        id: `fb_refresh_${Date.now()}_${newCards.length}`,
        uniqueId: `fb_refresh_${Date.now()}_${newCards.length}`,
        position: unflipped[newCards.length]?.position || newCards.length,
        isFlipped: false,
        isCompleted: false,
        isClaimed: false,
        claimedBy: null,
        startTime: null,
        elapsedSeconds: 0,
        isPadding: true,
      });
    }
    
    // 重建 selectedTasks：保持已翻开/已完成的位置不变，替换未翻开的
    selectedTasks.value = selectedTasks.value.map(card => {
      if (card.isFlipped || card.isCompleted) return card;
      const replacement = newCards.shift();
      return replacement || card;
    });
    
    // 更新可用时间及已用时间
    userAvailableMinutes.value = minutes > 0 ? availMin : 0;
    usedTime.value = 0;
    
    pendingRefresh.value = false;
    showTimeInput.value = false;
    
    uni.showToast({ title: `已刷新${replacementCount}张未翻开卡片`, icon: 'success' });
  } catch (e) {
    uni.hideLoading();
    pendingRefresh.value = false;
    showTimeInput.value = false;
    console.error('[刷新棋盘] 失败:', e);
    uni.showToast({ title: '刷新失败，请重试', icon: 'none' });
  }
};

const resetBingoBoard = () => {
  // 始终要求二次确认，防止误操作
  uni.showModal({
    title: '⚠️ 确认重置棋盘',
    content: '重置将清空整个棋盘并重新开始，确定要继续吗？',
    confirmText: '确定重置',
    confirmColor: '#d4a373',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        doReset();
      }
    }
  });
};

const doReset = () => {
  resetBoard();
  showTimeInput.value = true;
  availableMinutes.value = 0;
  userAvailableMinutes.value = 0;
  isExecutingMode.value = false;
  executionTasks.value = [];
  uni.showToast({ title: '游戏已重置', icon: 'none' });
};

const startPlanning = () => {
  const flippedTasks = selectedTasks.value.filter(card => card.isFlipped && !card.isCompleted);
  if (flippedTasks.length === 0) {
    uni.showToast({ title: '请先选择未完成的任务', icon: 'none' });
    return;
  }
  
  executionTasks.value = flippedTasks.map((card, index) => ({
    id: card.id,
    title: card.title || '未命名任务',
    description: card.description || '',
    estimatedMinutes: card.estimatedMinutes || 5,
    difficulty: card.difficulty || 'low',
    urgency: card.urgency || 1,
    uniqueId: card.uniqueId,
    completed: false,
    startTime: null,
    elapsedSeconds: 0,
    taskOrder: index + 1
  }));
  
  totalExecutionTime.value = executionTasks.value.reduce((sum, task) => sum + (task.estimatedMinutes || 5), 0) * 60;
  remainingExecutionTime.value = totalExecutionTime.value;
  currentTaskIndex.value = 0;
  crowActionInExecution.value = 'idle';
  crowMessageInExecution.value = '点击我互动吧！';
  crowClickCount.value = 0;
  
  isExecutingMode.value = true;
  startCrowAutoActions();
  
  // 等待DOM更新后滚动到执行模式区域
  nextTick(() => {
    // 使用uni-app的方式滚动到元素
    const query = uni.createSelectorQuery().in(getCurrentPages()[0]);
    query.select('#main-crow-area').boundingClientRect((data) => {
      if (data) {
        uni.pageScrollTo({
          scrollTop: data.top - 20, // 偏移20px，避免遮挡
          duration: 300
        });
      } else {
        // 降级方案：滚动到页面顶部附近
        uni.pageScrollTo({
          scrollTop: 0,
          duration: 300
        });
      }
    }).exec();
  });
};

const startExecution = () => {
  if (remainingExecutionTime.value <= 0) {
    uni.showToast({ title: '没有剩余时间', icon: 'none' });
    return;
  }
  
  isExecutionRunning.value = true;
  
  executionTimer = setInterval(() => {
    if (remainingExecutionTime.value > 0) {
      remainingExecutionTime.value--;
      
      if (executionTasks.value[currentTaskIndex.value]) {
        executionTasks.value[currentTaskIndex.value].elapsedSeconds++;
        
        const currentTask = executionTasks.value[currentTaskIndex.value];
        const taskDuration = (currentTask.estimatedMinutes || 5) * 60;
        
        if (currentTask.elapsedSeconds >= taskDuration) {
          currentTask.completed = true;
          if (currentTaskIndex.value < executionTasks.value.length - 1) {
            currentTaskIndex.value++;
          }
        }
      }
    } else {
      stopExecutionTimer();
      uni.showModal({
        title: '⏰ 时间到！',
        content: '日程执行时间已用完',
        confirmText: '继续执行',
        cancelText: '结束',
        success: (res) => {
          if (res.confirm) {
            addMoreTime();
          } else {
            exitExecution();
          }
        }
      });
    }
  }, 1000);
};

const pauseExecution = () => {
  stopExecutionTimer();
  isExecutionRunning.value = false;
};

const stopExecutionTimer = () => {
  if (executionTimer) {
    clearInterval(executionTimer);
    executionTimer = null;
  }
};

const addMoreTime = () => {
  remainingExecutionTime.value += 15 * 60;
  totalExecutionTime.value += 15 * 60;
  isExecutionRunning.value = true;
  
  executionTimer = setInterval(() => {
    if (remainingExecutionTime.value > 0) {
      remainingExecutionTime.value--;
      
      if (executionTasks.value[currentTaskIndex.value]) {
        executionTasks.value[currentTaskIndex.value].elapsedSeconds++;
        
        const currentTask = executionTasks.value[currentTaskIndex.value];
        const taskDuration = (currentTask.estimatedMinutes || 5) * 60;
        
        if (currentTask.elapsedSeconds >= taskDuration) {
          currentTask.completed = true;
          if (currentTaskIndex.value < executionTasks.value.length - 1) {
            currentTaskIndex.value++;
          }
        }
      }
    } else {
      stopExecutionTimer();
      uni.showModal({
        title: '⏰ 时间到！',
        content: '日程执行时间已用完',
        confirmText: '继续执行',
        cancelText: '结束',
        success: (res) => {
          if (res.confirm) {
            addMoreTime();
          } else {
            exitExecution();
          }
        }
      });
    }
  }, 1000);
  
  uni.showToast({ title: '已添加15分钟', icon: 'success' });
};

const exitExecution = () => {
  stopExecutionTimer();
  stopCrowAutoActions();
  isExecutionRunning.value = false;
  isExecutingMode.value = false;
  
  executionTasks.value.forEach(task => {
    if (task.completed) {
      const cardIndex = selectedTasks.value.findIndex(c => c.uniqueId === task.uniqueId);
      if (cardIndex !== -1) {
        completeTask(cardIndex);
      }
    }
  });
};

const skipToNextTask = () => {
  if (currentTaskIndex.value < executionTasks.value.length - 1) {
    const currentTask = executionTasks.value[currentTaskIndex.value];
    if (!currentTask.completed) {
      currentTask.completed = true;
    }
    currentTaskIndex.value++;
    const nextTask = executionTasks.value[currentTaskIndex.value];
    uni.showToast({ title: `切换到「${nextTask.title}」`, icon: 'none' });
  } else {
    showEndConfirm();
  }
};

const showEndConfirm = () => {
  uni.showModal({
    title: '🏁 确认结束',
    content: '确定要结束当前任务吗？已完成的任务将被记录。',
    confirmText: '确定结束',
    cancelText: '继续执行',
    success: (res) => {
      if (res.confirm) {
        const currentTask = executionTasks.value[currentTaskIndex.value];
        if (!currentTask.completed) {
          currentTask.completed = true;
        }
        exitExecution();
      }
    }
  });
};

const getTaskProgress = (task) => {
  const duration = (task.estimatedMinutes || 5) * 60;
  const progress = (task.elapsedSeconds || 0) / duration * 100;
  return Math.min(100, Math.round(progress));
};

const getTaskRemainingTime = (task) => {
  const duration = (task.estimatedMinutes || 5) * 60;
  const remaining = Math.max(0, duration - (task.elapsedSeconds || 0));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const handleCrowClickInExecution = () => {
  crowClickCount.value++;
  
  if (crowClickCount.value >= 5) {
    crowActionInExecution.value = 'happy';
    crowMessageInExecution.value = '🎉 谢谢你陪我玩！';
    crowClickCount.value = 0;
  } else if (crowClickCount.value === 3) {
    crowActionInExecution.value = 'eat';
    crowMessageInExecution.value = '好吃！谢谢投喂！';
  } else {
    crowActionInExecution.value = 'happy';
    const randomMsg = crowMessages[Math.floor(Math.random() * crowMessages.length)];
    crowMessageInExecution.value = randomMsg;
  }
  
  clearTimeout(crowIdleTimer);
  clearInterval(crowAutoActionTimer);
  
  setTimeout(() => {
    crowActionInExecution.value = 'idle';
    startCrowAutoActions();
  }, 2000);
};

const startCrowAutoActions = () => {
  if (!isExecutingMode.value) return;
  
  crowIdleTimer = setTimeout(() => {
    const randomAction = crowAutoActions[Math.floor(Math.random() * crowAutoActions.length)];
    crowActionInExecution.value = randomAction;
    
    if (randomAction === 'sleep') {
      crowMessageInExecution.value = '💤 困了...打个盹';
    } else if (randomAction === 'happy') {
      crowMessageInExecution.value = '🎵 啦啦啦~ 自娱自乐中';
    } else {
      crowMessageInExecution.value = '点击我互动吧！';
    }
    
    setTimeout(() => {
      if (isExecutingMode.value) {
        crowActionInExecution.value = 'idle';
        crowMessageInExecution.value = '点击我互动吧！';
        startCrowAutoActions();
      }
    }, 3000);
  }, 15000);
};

const stopCrowAutoActions = () => {
  clearTimeout(crowIdleTimer);
  clearInterval(crowAutoActionTimer);
};

loadCompletedTasks();

// Course Table State
const courseView = ref('week');
const showImportModal = ref(false);
const showAddCourseModal = ref(false);
const showTimeSettings = ref(false);
const showCourseDatePicker = ref(false);
const importType = ref('file');
const now = new Date();
const initialDayOfWeek = now.getDay();
const selectedCourseDayIndex = ref(initialDayOfWeek === 0 ? 7 : initialDayOfWeek);
const selectedCourseDay = ref('');
const selectedCourseDate = ref(new Date().toLocaleDateString('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).replace(/\//g, '-'));
const tempSelectedCourseDate = ref(selectedCourseDate.value);
const courseDateCalendarYear = ref(new Date().getFullYear());
const courseDateCalendarMonth = ref(new Date().getMonth() + 1);
const courseDateCalendarDays = ref([]);

const colorOptions = [
  '#4299e1', '#38a169', '#ed8936', '#805ad5',
  '#dd6b20', '#667eea', '#7f9cf5', '#b794f4',
  '#f6ad55', '#fc8181', '#9ae6b4', '#68d391',
  '#f56565', '#48bb78', '#4299e1', '#9f7aea'
];

const courseSchedule = ref({
  courses: [],
  timeSettings: [
    { section: 1, startTime: "08:00", endTime: "08:45" },
    { section: 2, startTime: "08:55", endTime: "09:40" },
    { section: 3, startTime: "10:00", endTime: "10:45" },
    { section: 4, startTime: "10:55", endTime: "11:40" },
    { section: 5, startTime: "14:00", endTime: "14:45" },
    { section: 6, startTime: "14:55", endTime: "15:40" },
    { section: 7, startTime: "16:00", endTime: "16:45" },
    { section: 8, startTime: "16:55", endTime: "17:40" },
    { section: 9, startTime: "19:00", endTime: "19:45" },
    { section: 10, startTime: "19:55", endTime: "20:40" },
    { section: 11, startTime: "20:50", endTime: "21:35" },
    { section: 12, startTime: "21:45", endTime: "22:30" }
  ],
  semesterSettings: {
    startDate: "2026-02-24",
    totalWeeks: 16,
    currentWeek: 7
  }
});

const newCourse = ref({
  id: '',
  courseName: '',
  teacher: '',
  location: '',
  dayOfWeek: 1,
  startSection: 1,
  endSection: 1,
  weeks: '1-16',
  color: '#4299e1',
  credit: 0,
  courseType: '必修'
});

// Chat State
const isChatOpen = ref(false);
const showConvList = ref(false);
const activeSessionId = ref('');
const messages = ref([
  { role: 'model', text: '嘎！我是你的拾鸦助手，今天有什么想记录的吗？' }
]);
const chatInput = ref('');
const uploadedImages = ref([]);
const isTyping = ref(false);
const thinkingSteps = ref([]);
const needsConfirmation = ref(false);
const confirmOptions = ref([]);
const showThinking = ref(true);

// Image Viewer State
const showImageViewer = ref(false);
const viewingImages = ref([]);
const viewingImageIndex = ref(0);

// Mobile Detection
const isMobile = ref(false);

// Refs
const mainCrowRef = ref(null);
const courseTableRef = ref(null);
const scheduleTabRef = ref(null);
const diaryTabRef = ref(null);

// Server Sync Timer
let serverSyncTimer = null;
// Crow Decay Timer（乌鸦健康/心情随时间衰减）
let decayTimer = null;

// Course Table Functions
const initCourseSchedule = () => {
  const saved = uni.getStorageSync('courseSchedule');
  if (saved) {
    courseSchedule.value = saved;
  }
  updateSelectedCourseDay();
  generateCourseDateCalendar();
  startDateAutoRefresh();
};

const startDateAutoRefresh = () => {
  checkAndUpdateDate();
  setInterval(checkAndUpdateDate, 60000);
};

// ============== 乌鸦状态衰减定时器 ==============
// 心情条：满条 6h 降为 0；食物条：满条 12h 降为 0
const startCrowDecayTimer = () => {
  stopCrowDecayTimer();
  const TICK_INTERVAL = 10000; // 每 10 秒更新一次
  const MOOD_DECAY_PER_TICK = 100 / (6 * 360);   // 100% / 6h = 100/(6*360*10s)
  const HUNGER_DECAY_PER_TICK = 100 / (12 * 360); // 100% / 12h = 100/(12*360*10s)
  
  decayTimer = setInterval(() => {
    if (crowStats.value.hunger > 0) {
      crowStats.value.hunger = Math.max(0, +(crowStats.value.hunger - HUNGER_DECAY_PER_TICK).toFixed(2));
    }
    if (crowStats.value.mood > 0) {
      crowStats.value.mood = Math.max(0, +(crowStats.value.mood - MOOD_DECAY_PER_TICK).toFixed(2));
    }
  }, TICK_INTERVAL);
};

const stopCrowDecayTimer = () => {
  if (decayTimer) {
    clearInterval(decayTimer);
    decayTimer = null;
  }
};

const startServerSyncTimer = () => {
  serverSyncTimer = setInterval(async () => {
    try {
      const token = uni.getStorageSync('token');
      if (!token) return;
      
      uni.request({
        url: API_BASE_URL + '/get-data',
        method: 'GET',
        header: {
          'Authorization': `Bearer ${token}`
        },
        success: (res) => {
          const result = res.data;
          if (result.success && result.data) {
            if (result.data.todos !== undefined) {
              todos.value = result.data.todos;
              uni.setStorageSync('todos', result.data.todos);
            }
            
            if (result.data.diaryEntries !== undefined) {
              diaryEntries.value = result.data.diaryEntries;
              uni.setStorageSync('diaryEntries', result.data.diaryEntries);
            }
            
            if (result.data.repeatTasks !== undefined) {
              repeatTasks.value = result.data.repeatTasks;
              uni.setStorageSync('repeatTasks', result.data.repeatTasks);
            }
            
            if (result.data.completedTasks !== undefined) {
              completedTasks.value = result.data.completedTasks;
              uni.setStorageSync('completedTasks', result.data.completedTasks);
            }
            
            if (result.data.userPreferences !== undefined) {
              userPreferences.value = result.data.userPreferences;
              uni.setStorageSync('userPreferences', result.data.userPreferences);
            }
            
            // 同步乌鸦状态（服务端已计算衰减）
            if (result.data.crowStats !== undefined) {
              crowStats.value = result.data.crowStats;
              uni.setStorageSync('crowStats', result.data.crowStats);
            }
            if (result.data.foodCount !== undefined) {
              foodCount.value = result.data.foodCount;
              uni.setStorageSync('foodCount', result.data.foodCount);
            }
            if (result.data.crowLastUpdated !== undefined) {
              lastUpdated.value = result.data.crowLastUpdated;
            }
          }
        }
      });
    } catch (e) {
      console.log('定时拉取数据异常:', e);
    }
  }, 30000);
};

const stopServerSyncTimer = () => {
  if (serverSyncTimer) {
    clearInterval(serverSyncTimer);
    serverSyncTimer = null;
  }
};

const checkAndUpdateDate = () => {
  const now = new Date();
  const currentDate = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');
  
  if (currentDate !== selectedCourseDate.value) {
    selectedCourseDate.value = currentDate;
    const dayOfWeek = now.getDay();
    selectedCourseDayIndex.value = dayOfWeek === 0 ? 7 : dayOfWeek;
    updateSelectedCourseDay();
    courseDateCalendarYear.value = now.getFullYear();
    courseDateCalendarMonth.value = now.getMonth() + 1;
    generateCourseDateCalendar();
  }
};

const updateSelectedCourseDay = () => {
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  selectedCourseDay.value = days[selectedCourseDayIndex.value - 1];
};

const prevCourseDay = () => {
  const currentDate = new Date(selectedCourseDate.value);
  currentDate.setDate(currentDate.getDate() - 1);
  selectedCourseDate.value = currentDate.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');
  const dayOfWeek = currentDate.getDay();
  selectedCourseDayIndex.value = dayOfWeek === 0 ? 7 : dayOfWeek;
  updateSelectedCourseDay();
};

const nextCourseDay = () => {
  const currentDate = new Date(selectedCourseDate.value);
  currentDate.setDate(currentDate.getDate() + 1);
  selectedCourseDate.value = currentDate.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');
  const dayOfWeek = currentDate.getDay();
  selectedCourseDayIndex.value = dayOfWeek === 0 ? 7 : dayOfWeek;
  updateSelectedCourseDay();
};

const generateCourseDateCalendar = () => {
  const year = courseDateCalendarYear.value;
  const month = courseDateCalendarMonth.value - 1;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  
  const days = [];
  for (let i = 0; i < 42; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    const isOtherMonth = currentDate.getMonth() !== month;
    const localDateStr = currentDate.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-');
    const isSelected = localDateStr === tempSelectedCourseDate.value;
    
    days.push({
      date: currentDate.getDate(),
      isOtherMonth,
      isSelected,
      fullDate: localDateStr
    });
  }
  
  courseDateCalendarDays.value = days;
};

const prevCourseDateMonth = () => {
  if (courseDateCalendarMonth.value === 1) {
    courseDateCalendarMonth.value = 12;
    courseDateCalendarYear.value--;
  } else {
    courseDateCalendarMonth.value--;
  }
  generateCourseDateCalendar();
};

const nextCourseDateMonth = () => {
  if (courseDateCalendarMonth.value === 12) {
    courseDateCalendarMonth.value = 1;
    courseDateCalendarYear.value++;
  } else {
    courseDateCalendarMonth.value++;
  }
  generateCourseDateCalendar();
};

const selectCourseDate = (day) => {
  tempSelectedCourseDate.value = day.fullDate;
  generateCourseDateCalendar();
};

const confirmCourseDate = () => {
  selectedCourseDate.value = tempSelectedCourseDate.value;
  const selectedDate = new Date(tempSelectedCourseDate.value);
  const dayOfWeek = selectedDate.getDay();
  selectedCourseDayIndex.value = dayOfWeek === 0 ? 7 : dayOfWeek;
  updateSelectedCourseDay();
  showCourseDatePicker.value = false;
};

const parseWeeks = (weeksStr) => {
  const weeks = [];
  if (!weeksStr) return weeks;
  
  const parts = weeksStr.split(',');
  parts.forEach(part => {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          weeks.push(i);
        }
      }
    } else {
      const week = Number(part);
      if (!isNaN(week)) {
        weeks.push(week);
      }
    }
  });
  return weeks;
};

const isCourseInWeek = (course, week) => {
  if (!course.weeks) return true;
  const courseWeeks = parseWeeks(course.weeks);
  return courseWeeks.includes(week);
};

const getWeekForDate = (dateStr) => {
  const startDate = courseSchedule.value.semesterSettings.startDate;
  if (!startDate) return 1;

  const start = new Date(startDate);
  const current = new Date(dateStr);

  const diffMs = current - start;
  const weekNum = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));

  return Math.max(1, weekNum);
};

const getCoursesForSection = (day, section) => {
  const currentWeek = courseSchedule.value.semesterSettings.currentWeek;
  return courseSchedule.value.courses.filter(course => {
    if (course.dayOfWeek !== day) return false;
    if (section < course.startSection || section > course.endSection) return false;
    if (!isCourseInWeek(course, currentWeek)) return false;
    return true;
  });
};

const getCoursesForDayAndSection = (day, section) => {
  const selectedWeek = getWeekForDate(selectedCourseDate.value);
  return courseSchedule.value.courses.filter(course => {
    if (course.dayOfWeek !== day) return false;
    if (section < course.startSection || section > course.endSection) return false;
    if (!isCourseInWeek(course, selectedWeek)) return false;
    return true;
  });
};

const handleImport = () => {
  showImportModal.value = false;
  if (importType.value === 'manual') {
    showAddCourseModal.value = true;
  } else if (importType.value === 'file') {
    uni.chooseFile({
      count: 1,
      extension: ['.xlsx', '.csv'],
      success: (res) => {
        parseExcelFile(res.tempFilePaths[0]);
      }
    });
  } else if (importType.value === 'image') {
    uni.chooseImage({
      count: 1,
      success: (res) => {
        uploadImageForAnalysis(res.tempFilePaths[0]);
      }
    });
  }
};

const parseExcelFile = (filePath) => {
  uni.showLoading({ title: '解析文件中...' });
  
  uni.readFile({
    filePath: filePath,
    success: (res) => {
      try {
        const workbook = XLSX.read(res.data, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const courses = jsonData.map((row, index) => {
          return {
            id: 'course_' + Date.now() + '_' + index,
            courseName: row['课程名'] || row['课程名称'] || row['course'] || '',
            teacher: row['教师'] || row['老师'] || row['teacher'] || '',
            location: row['地点'] || row['教室'] || row['location'] || '',
            dayOfWeek: parseInt(row['星期'] || row['周'] || row['day']) || 1,
            startSection: parseInt(row['开始节'] || row['start'] || row['startSection']) || 1,
            endSection: parseInt(row['结束节'] || row['end'] || row['endSection']) || 1,
            weeks: row['出现周'] || row['周次'] || row['weeks'] || '1-16',
            color: row['颜色'] || row['color'] || getRandomColor(),
            credit: parseFloat(row['学分'] || row['credit']) || 0,
            courseType: row['类型'] || row['courseType'] || '必修'
          };
        }).filter(course => course.courseName);
        
        if (courses.length > 0) {
          courseSchedule.value.courses = [...courseSchedule.value.courses, ...courses];
          saveCourseSchedule();
          uni.hideLoading();
          uni.showToast({ title: '导入成功', icon: 'success' });
        }
      } catch (error) {
        console.error('解析Excel失败:', error);
        uni.hideLoading();
        uni.showToast({ title: '解析失败', icon: 'error' });
      }
    },
    fail: (error) => {
      console.error('读取文件失败:', error);
      uni.hideLoading();
      uni.showToast({ title: '读取文件失败', icon: 'error' });
    }
  });
};

const getRandomColor = () => {
  const colors = [
    '#4299e1', '#38a169', '#ed8936', '#805ad5',
    '#dd6b20', '#667eea', '#7f9cf5', '#b794f4',
    '#f6ad55', '#fc8181', '#9ae6b4', '#68d391'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

const updateCourse = (course) => {
  const index = courseSchedule.value.courses.findIndex(c => c.id === course.id);
  if (index !== -1) {
    courseSchedule.value.courses[index] = course;
  }
};

const addCourse = () => {
  if (newCourse.value.id) {
    updateCourse(newCourse.value);
  } else {
    const course = {
      ...newCourse.value,
      id: 'course_' + Date.now()
    };
    courseSchedule.value.courses.push(course);
  }
  saveCourseSchedule();
  showAddCourseModal.value = false;
  resetNewCourseForm();
};

const deleteCourse = () => {
  if (newCourse.value.id) {
    courseSchedule.value.courses = courseSchedule.value.courses.filter(course => course.id !== newCourse.value.id);
    saveCourseSchedule();
    showAddCourseModal.value = false;
    resetNewCourseForm();
  }
};

const resetNewCourseForm = () => {
  newCourse.value = {
    id: '',
    courseName: '',
    teacher: '',
    location: '',
    dayOfWeek: 1,
    startSection: 1,
    endSection: 1,
    weeks: '1-16',
    color: '#4299e1',
    credit: 0,
    courseType: '必修'
  };
};

const saveTimeSettings = () => {
  saveCourseSchedule();
  showTimeSettings.value = false;
};

const saveCourseSchedule = () => {
  uni.setStorageSync('courseSchedule', courseSchedule.value);
};

const updateCurrentWeek = () => {
  const startDate = courseSchedule.value.semesterSettings.startDate;
  if (!startDate) return;
  
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now - start;
  const weekNum = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
  
  courseSchedule.value.semesterSettings.currentWeek = Math.max(1, weekNum);
  saveCourseSchedule();
};

const prevWeek = () => {
  if (courseSchedule.value.semesterSettings.currentWeek > 1) {
    courseSchedule.value.semesterSettings.currentWeek--;
    saveCourseSchedule();
  }
};

const nextWeek = () => {
  if (courseSchedule.value.semesterSettings.currentWeek < 20) {
    courseSchedule.value.semesterSettings.currentWeek++;
    saveCourseSchedule();
  }
};

const resetToCurrentWeek = () => {
  updateCurrentWeek();
};

const clearAllCourses = () => {
  uni.showModal({
    title: '确认清空',
    content: '确定要清空所有课程吗？此操作不可恢复！',
    success: function (res) {
      if (res.confirm) {
        courseSchedule.value.courses = [];
        saveCourseSchedule();
        uni.showToast({ title: '课表已清空', icon: 'success' });
      }
    }
  });
};

const uploadImageForAnalysis = (imagePath) => {
  uni.showLoading({ title: '上传图片中...' });
  uni.showToast({ title: 'AI分析功能开发中', icon: 'none' });
  uni.hideLoading();
};

// Crow Functions
const handleCrowClick = () => {
  if (!isCrowFainted.value) {
    const today = new Date().toLocaleDateString('zh-CN');
    if (petData.value.date !== today) {
      petData.value = { date: today, count: 0 };
    }
    
    crowAction.value = 'happy';
    
    if (petData.value.count < 5) {
      crowStats.value = { ...crowStats.value, mood: Math.min(100, crowStats.value.mood + 1) };
      petData.value.count += 1;
      saveData();
      syncData();
    }
    
    resetSleepTimer();
    setTimeout(() => crowAction.value = 'idle', 1000);
  }
};

const resetSleepTimer = () => {
  lastInteractionTime = Date.now();
  if (sleepTimer) {
    clearTimeout(sleepTimer);
    sleepTimer = null;
  }
  
  if (sittingOnId.value && !isTimerRunning.value) {
    sleepTimer = setTimeout(() => {
      const now = Date.now();
      if (now - lastInteractionTime >= 30000 && sittingOnId.value && !isTimerRunning.value) {
        crowAction.value = 'sleep';
      }
    }, 30000);
  }
};

const handleFeed = () => {
  if (foodCount.value > 0) {
    sittingOnId.value = null;
    crowAction.value = 'peck';
    foodCount.value -= 1;
    crowStats.value = {
      hunger: Math.min(100, crowStats.value.hunger + 10),
      mood: Math.min(100, crowStats.value.mood + 15)
    };
    setTimeout(() => {
      crowAction.value = 'happy';
      setTimeout(() => crowAction.value = 'idle', 1000);
    }, 1000);
    saveData();
    syncData();
  } else {
    uni.showToast({ title: '没有食物了！', icon: 'none' });
  }
};

const handleDragStart = () => {
  sittingOnId.value = null;
  crowAction.value = 'flap';
};

const handleDrag = (event) => {
  const x = event.x || event.clientX || (event.touches && event.touches[0].clientX);
  const y = event.y || event.clientY || (event.touches && event.touches[0].clientY);
  
  if (!x || !y) return;

  const elements = document.elementsFromPoint(x, y);
  let foundId = null;
  
  for (const el of elements) {
    const target = el.closest('[data-todo-id]');
    if (target) {
      foundId = target.getAttribute('data-todo-id');
      break;
    }
  }
  
  if (!foundId) {
    const todos = document.querySelectorAll('[data-todo-id]');
    let closestTodo = null;
    let closestDistance = Infinity;
    
    todos.forEach(todo => {
      const rect = todo.getBoundingClientRect();
      const distanceX = Math.max(rect.left - x, 0, x - rect.right);
      const distanceY = Math.max(rect.top - y, 0, y - rect.bottom);
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
      
      if (distance < closestDistance && distance < 80) {
        closestDistance = distance;
        closestTodo = todo;
      }
    });
    
    if (closestTodo) {
      foundId = closestTodo.getAttribute('data-todo-id');
    }
  }
  
  dragOverId.value = foundId;
};

const handleDragEnd = (event) => {
  const x = event.x || event.clientX || (event.changedTouches && event.changedTouches[0].clientX);
  const y = event.y || event.clientY || (event.changedTouches && event.changedTouches[0].clientY);
  
  if (!x || !y) {
    return;
  }

  const elements = document.elementsFromPoint(x, y);
  let todoId = null;
  
  for (const el of elements) {
    const target = el.closest('[data-todo-id]');
    if (target) {
      todoId = target.getAttribute('data-todo-id');
      break;
    }
  }
  
  if (!todoId) {
    const todos = document.querySelectorAll('[data-todo-id]');
    let closestTodo = null;
    let closestDistance = Infinity;
    
    todos.forEach(todo => {
      const rect = todo.getBoundingClientRect();
      const distanceX = Math.max(rect.left - x, 0, x - rect.right);
      const distanceY = Math.max(rect.top - y, 0, y - rect.bottom);
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
      
      if (distance < closestDistance && distance < 80) {
        closestDistance = distance;
        closestTodo = todo;
      }
    });
    
    if (closestTodo) {
      todoId = closestTodo.getAttribute('data-todo-id');
    }
  }
  
  finalizeDrop(todoId);
};

const finalizeDrop = (todoId) => {
  dragOverId.value = null;
  if (todoId) {
    sittingOnId.value = todoId;
    crowAction.value = 'sitting';
    crowStats.value = { ...crowStats.value, mood: Math.min(100, crowStats.value.mood + 20) };
    showCrowMenu.value = false;
  } else {
    sittingOnId.value = null;
    crowAction.value = 'flap';
    setTimeout(() => crowAction.value = 'idle', 1000);
    isTimerRunning.value = false;
    timeLeft.value = null;
  }
};

const handleSittingCrowClick = (e) => {
  if (e && e.stopPropagation) {
    e.stopPropagation();
  }
  if (!showCrowMenu.value) {
    if (crowAction.value === 'sleep') {
      crowAction.value = 'alert';
      setTimeout(() => {
        crowAction.value = 'sitting';
      }, 1000);
    }
  }
};

const handleFlapAway = () => {
  sittingOnId.value = null;
  crowAction.value = 'flap';
  setTimeout(() => {
    crowAction.value = 'idle';
  }, 1500);
  isTimerRunning.value = false;
  timeLeft.value = null;
};

const findCrow = () => {
  if (sittingOnId.value) {
    const taskElement = document.querySelector(`[data-todo-id="${sittingOnId.value}"]`);
    if (taskElement) {
      taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
};

const setShowCrowMenu = (value) => {
  showCrowMenu.value = value;
};

const setShowTimerPicker = (value) => {
  showTimerPicker.value = value;
};

const startTimer = () => {
  if (isTimerRunning.value) {
    isTimerRunning.value = false;
    timeLeft.value = null;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    return;
  }
  
  isTimerRunning.value = true;
  timeLeft.value = timerDuration.value * 60;
  crowAction.value = 'sitting';
  
  timerInterval = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--;
    } else {
      clearInterval(timerInterval);
      timerInterval = null;
      isTimerRunning.value = false;
      crowAction.value = 'alert';
      uni.vibrateLong();
      uni.showToast({ title: '时间到啦！', icon: 'none' });
      
      setTimeout(() => {
        crowAction.value = 'idle';
      }, 5000);
    }
  }, 1000);
  
  showTimerPicker.value = false;
};

// Task Functions
const filteredTodos = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const regularTodos = todos.value.filter(todo => {
    const getDatePart = (dateStr) => {
      if (!dateStr) return '';
      return dateStr.split(' ')[0];
    };
    
    if (!todo.completed) {
      const taskDateStr = todo.startTime || todo.endTime;
      if (taskDateStr) {
        const taskDate = new Date(taskDateStr);
        taskDate.setHours(23, 59, 59, 999);
        if (taskDate < today) {
          const selectedDate = new Date(selectedScheduleDate.value);
          return selectedDate >= today;
        }
      }
    }
    
    if (todo.startTime && todo.endTime) {
      const todoStartDate = getDatePart(todo.startTime);
      const todoEndDate = getDatePart(todo.endTime);
      return selectedScheduleDate.value >= todoStartDate && selectedScheduleDate.value <= todoEndDate;
    } 
    else if (todo.startTime) {
      const todoDate = getDatePart(todo.startTime);
      return todoDate === selectedScheduleDate.value;
    }
    return selectedScheduleDate.value === getLocalDateString();
  });
  
  const todayRepeatTodos = repeatTasks.value.map(task => {
    const isCompleted = completedTasks.value.some(completed => 
      completed.repeatTaskId === task.id && completed.date === selectedScheduleDate.value
    );
    
    return {
      id: `${task.id}_${selectedScheduleDate.value}`,
      text: task.text,
      completed: isCompleted,
      time: task.time,
      details: task.details,
      startTime: selectedScheduleDate.value,
      endTime: selectedScheduleDate.value,
      isRepeat: true,
      repeatTaskId: task.id
    };
  });
  
  const allTodos = [...regularTodos, ...todayRepeatTodos];
  
  allTodos.sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
    if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
    
    if (a.isRepeat && !b.isRepeat) return -1;
    if (!a.isRepeat && b.isRepeat) return 1;
    
    if (a.priority === 'urgent' && b.priority === 'urgent') {
      const todayStr = getLocalDateString();
      const aIsToday = a.endTime === todayStr;
      const bIsToday = b.endTime === todayStr;
      if (aIsToday && !bIsToday) return -1;
      if (!aIsToday && bIsToday) return 1;
    }
    
    return 0;
  });
  
  return allTodos;
});

const getTaskBorderColor = (todo) => {
  if (String(sittingOnId.value) === String(todo.id)) return '#a3b18a';
  if (String(dragOverId.value) === String(todo.id)) return '#facc15';
  if (todo.completed) return '#d1d5db';
  // 兼容数字和字符串 priority：P4-5 或 'urgent' → 暖粉边框
  if (todo.priority === 'urgent' || (typeof todo.priority === 'number' && todo.priority >= 4)) return '#D89982';
  if (todo.isRepeat) return '#DFB199';
  return '#99B6B4';
};

const getTaskBackgroundColor = (todo) => {
  if (String(sittingOnId.value) === String(todo.id)) return '#f5f5f0';
  if (String(dragOverId.value) === String(todo.id)) return '#fffbeb';
  if (todo.completed) return '#f9fafb';
  // 兼容数字和字符串 priority：P4-5 或 'urgent' → 暖粉背景
  if (todo.priority === 'urgent' || (typeof todo.priority === 'number' && todo.priority >= 4)) return '#F8F0F0';
  if (todo.isRepeat) return '#FFF8F0';
  return '#F0F5F5';
};

const toggleTodo = (id) => {
  // 检查是否是重复任务
  const idStr = String(id);
  const isRepeatTask = idStr.includes('_');
  
  if (isRepeatTask) {
    // 从重复任务ID中提取原始任务ID和日期
    const [repeatTaskId, date] = idStr.split('_');
    
    // 检查该任务在当天是否已完成
    const isCurrentlyCompleted = completedTasks.value.some(completed => 
      completed.repeatTaskId === repeatTaskId && completed.date === date
    );
    
    if (!isCurrentlyCompleted) {
      // 标记为完成
      completedTasks.value.push({
        repeatTaskId,
        date
      });
      
      // 显示动画效果
      if (!isCrowFainted.value) {
        crowAction.value = 'happy';
        crowStats.value = { ...crowStats.value, mood: Math.min(100, crowStats.value.mood + 2) };
        setTimeout(() => crowAction.value = 'idle', 1500);
      }
      
      // 同一任务只投喂一次
      if (!fedTaskIds.value.includes(repeatTaskId) && foodCount.value < 15) {
        foodCount.value += 1;
        fedTaskIds.value.push(repeatTaskId);
      }
    } else {
      // 取消完成
      completedTasks.value = completedTasks.value.filter(completed =>
        !(completed.repeatTaskId === repeatTaskId && completed.date === date)
      );
    }
    saveData();
  } else {
    // 普通任务的处理逻辑
    const todo = todos.value.find(t => t.id === id);
    if (todo) {
      const idStr = String(todo.id);
      if (!todo.completed && !fedTaskIds.value.includes(idStr) && foodCount.value < 15) {
        foodCount.value += 1;
        fedTaskIds.value.push(idStr);
      }
      
      // 标记任务为完成或未完成
      const updatedTodo = { ...todo, completed: !todo.completed };
      todos.value = todos.value.map(t => t.id === id ? updatedTodo : t);
      
      // 排序：未完成任务在前，已完成任务在后
      todos.value.sort((a, b) => {
        if (a.completed && !b.completed) return 1;
        if (!a.completed && b.completed) return -1;
        return 0;
      });
      
      saveData();

      // DDL 联动：日程完成/取消 → 同步 agent_tasks 状态
      if (todo.taskId && !isRepeatTask) {
        syncTaskToSchedule(todo.taskId, updatedTodo.completed).catch(e =>
          console.error('[DDL联动-完成] 同步失败:', e))
      }
      // 同步完成状态到服务器
      syncTodoToggleToServer(todo.id, updatedTodo.completed);

      if (!isCrowFainted.value) {
        crowAction.value = 'happy';
        crowStats.value = { ...crowStats.value, mood: Math.min(100, crowStats.value.mood + 2) };
        setTimeout(() => crowAction.value = 'idle', 1500);
      }
    }
  }
};

// ===== 通用服务器同步函数（手动/AI 操作共用） =====
// 同步单条日程到服务器（创建或更新）
const syncTodoToServer = (todo) => {
  const token = uni.getStorageSync('token');
  if (!token || !todo || !todo.id) return;
  const payload = {
    id: todo.id,
    text: todo.text || todo.title || '',
    title: todo.text || todo.title || '',
    details: todo.details || '',
    startTime: todo.startTime || '',
    endTime: todo.endTime || '',
    startDate: todo.startDate || (todo.startTime ? todo.startTime.split(' ')[0] : ''),
    endDate: todo.endDate || (todo.endTime ? todo.endTime.split(' ')[0] : ''),
    time: todo.time || '',
    priority: todo.priority || 'normal',
    estimatedTime: todo.estimatedTime || todo.estimatedMinutes || 0,
    estimatedMinutes: todo.estimatedTime || todo.estimatedMinutes || 0,
    difficulty: todo.difficulty || 'medium',
    completed: !!todo.completed,
    isRepeat: !!todo.isRepeat,
    taskId: todo.taskId || null,
    createdAt: todo.createdAt || new Date().toISOString(),
    updatedAt: Date.now()
  };
  uni.request({
    url: API_BASE_URL + '/save-todo',
    method: 'POST',
    header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    data: { todo: payload },
    success: (res) => {
      if (res.data?.success) {
        console.log('[同步] save-todo 成功:', res.data.message);
      }
    },
    fail: (err) => { console.error('[同步] save-todo 失败:', err); }
  });
};

// 同步完成状态到服务器
const syncTodoToggleToServer = (targetId, completed) => {
  const token = uni.getStorageSync('token');
  if (!token || !targetId) return;
  uni.request({
    url: API_BASE_URL + '/toggle-todo',
    method: 'POST',
    header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    data: { targetId, completed },
    success: (res) => {
      if (res.data?.success) {
        console.log('[同步] toggle-todo 成功:', res.data.message);
      }
    },
    fail: (err) => { console.error('[同步] toggle-todo 失败:', err); }
  });
};
// ===== 通用服务器同步函数结束 =====

const deleteTask = (id) => {
  // 兼容数字和字符串 ID（AI 创建的日程 ID 是数字）
  const idStr = typeof id === 'string' ? id : String(id);
  const realId = idStr.split('_')[0];
  // 使用宽松比较处理新旧格式 ID 类型混用
  const todo = todos.value.find(t => String(t.id) === String(realId));
  
  if (todo) {
    taskToDelete.value = todo;
    showDeleteConfirm.value = true;
  } else {
    repeatTasks.value = repeatTasks.value.filter(t => String(t.id) !== String(realId));
    saveData();
  }
};

const confirmDeleteTask = () => {
  if (taskToDelete.value) {
    const deletedTodo = taskToDelete.value
    todos.value = todos.value.filter(t => String(t.id) !== String(deletedTodo.id));
    saveData();
    
    // 通知服务器同步删除
    const token = uni.getStorageSync('token');
    if (token && deletedTodo.id) {
      uni.request({
        url: API_BASE_URL + '/delete-todo',
        method: 'POST',
        header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        data: { targetId: deletedTodo.id },
        success: (res) => {
          if (res.data && res.data.success) {
            console.log('[手动删除] 服务器同步成功:', res.data.message);
          } else {
            console.warn('[手动删除] 服务器同步失败:', res.data?.message);
          }
        },
        fail: (err) => {
          console.error('[手动删除] 网络请求失败:', err);
        }
      });
    }
    
    // DDL 联动：删除日程 → 标记对应的 agent_task 为已完成（从 Bingo 池移除）
    if (deletedTodo.taskId) {
      syncTaskToSchedule(deletedTodo.taskId, true).catch(e =>
        console.error('[DDL联动-删除] 同步失败:', e))
    }
    
    taskToDelete.value = null;
  }
  showDeleteConfirm.value = false;
};

const cancelDeleteTask = () => {
  showDeleteConfirm.value = false;
};

// 批量删除处理函数（手动多选 + AI 批量删除共用）
const handleBatchDelete = (targetIds) => {
  if (!targetIds || targetIds.length === 0) return;
  
  const idSet = new Set(targetIds.map(String));
  const deletedTodos = todos.value.filter(t => idSet.has(String(t.id)));
  
  // 立即本地删除
  todos.value = todos.value.filter(t => !idSet.has(String(t.id)));
  saveData();
  
  // 同步到服务器
  const token = uni.getStorageSync('token');
  if (token) {
    uni.request({
      url: API_BASE_URL + '/delete-todos',
      method: 'POST',
      header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      data: { targetIds },
      success: (res) => {
        if (res.data?.success) {
          console.log('[批量删除] 服务器同步成功:', res.data.message);
          uni.showToast({ title: res.data.message, icon: 'success' });
        } else {
          console.warn('[批量删除] 服务器同步失败:', res.data?.message);
        }
      },
      fail: (err) => {
        console.error('[批量删除] 网络请求失败:', err);
      }
    });
  }
  
  // DDL 联动：批量删除后同步 agent_tasks
  deletedTodos.forEach(todo => {
    if (todo.taskId) {
      syncTaskToSchedule(todo.taskId, true).catch(e =>
        console.error('[DDL联动-批量删除] 同步失败:', e));
    }
  });
};

const startEditTask = (todo) => {
  editingTodoId.value = todo.id;
  editTaskText.value = todo.text;
  currentEditingTask.value = todo;
  editTaskDetails.value = todo.details || '';
  editTaskStartTime.value = todo.startTime || '';
  editTaskEndTime.value = todo.endTime || '';
  editTaskIsRepeat.value = todo.isRepeat || false;
  // 兼容数字/字符串 priority：4-5 → 'urgent'，1-3 或字符串 → 'normal'
  const rawPriority = todo.priority;
  if (typeof rawPriority === 'number') {
    editTaskPriority.value = rawPriority >= 4 ? 'urgent' : 'normal';
  } else {
    editTaskPriority.value = rawPriority || 'normal';
  }
  editTaskEstimatedTime.value = todo.estimatedTime || todo.estimatedMinutes || 0;
  editTaskDifficulty.value = todo.difficulty || 'medium';
  showEditTask.value = true;
};

const handleEditTask = () => {
  if (currentEditingTask.value && editTaskText.value.trim()) {
    // 验证时间顺序
    if (editTaskStartTime.value && editTaskEndTime.value) {
      if (new Date(editTaskStartTime.value) > new Date(editTaskEndTime.value)) {
        // 显示错误提示
        uni.showToast({
          title: '开始时间不能晚于结束时间',
          icon: 'none'
        });
        return;
      }
    }

    // 检查是否是重复任务
    const isRepeatTask = String(currentEditingTask.value.id).includes('_');

    if (isRepeatTask) {
      // 从重复任务ID中提取原始任务ID
      const repeatTaskId = currentEditingTask.value.repeatTaskId;
      // 更新重复任务模板
      repeatTasks.value = repeatTasks.value.map(task => {
        if (task.id === repeatTaskId) {
          return {
            ...task,
            text: editTaskText.value.trim(),
            details: editTaskDetails.value.trim(),
            time: editTaskStartTime.value || currentEditingTask.value.time,
            startTime: editTaskStartTime.value,
            endTime: editTaskEndTime.value,
            startDate: editTaskStartTime.value ? editTaskStartTime.value.split(' ')[0] : task.startDate,
            endDate: editTaskEndTime.value ? editTaskEndTime.value.split(' ')[0] : task.endDate,
            priority: editTaskPriority.value,
            estimatedTime: editTaskEstimatedTime.value,
            estimatedMinutes: editTaskEstimatedTime.value,
            difficulty: editTaskDifficulty.value,
            updatedAt: Date.now()
          };
        }
        return task;
      });
    } else {
      // 普通任务的处理逻辑
      const updatedTask = {
        ...currentEditingTask.value,
        text: editTaskText.value.trim(),
        details: editTaskDetails.value.trim(),
        startTime: editTaskStartTime.value,
        endTime: editTaskEndTime.value,
        startDate: editTaskStartTime.value ? editTaskStartTime.value.split(' ')[0] : currentEditingTask.value.startDate,
        endDate: editTaskEndTime.value ? editTaskEndTime.value.split(' ')[0] : currentEditingTask.value.endDate,
        time: editTaskStartTime.value || currentEditingTask.value.time,
        isRepeat: editTaskIsRepeat.value,
        priority: editTaskPriority.value,
        estimatedTime: editTaskEstimatedTime.value,
        estimatedMinutes: editTaskEstimatedTime.value,
        difficulty: editTaskDifficulty.value,
        updatedAt: Date.now()
      };
      
      // 更新任务
      todos.value = todos.value.map(todo => {
        if (todo.id === currentEditingTask.value.id) {
          return updatedTask;
        }
        return todo;
      });
      syncTodoToServer(updatedTask);  // 同步到服务器
    }
    
    saveData();
    syncData();
    
    // DDL 联动：编辑后同步到 agent_tasks
    const editedTodo = isRepeatTask
      ? repeatTasks.value.find(t => t.repeatTaskId === repeatTaskId || t.id === repeatTaskId)
      : todos.value.find(t => t.id === currentEditingTask.value.id)
    if (editedTodo) {
      syncScheduleToTasks(editedTodo, uni.getStorageSync('shiya_session_id')).catch(e =>
        console.error('[DDL联动-编辑] 同步失败:', e))
    }
    
    // 更新乌鸦状态
    crowAction.value = 'happy';
    setTimeout(() => crowAction.value = 'idle', 1000);
  }
  closeEditTask();
};

const closeEditTask = () => {
  showEditTask.value = false;
  currentEditingTask.value = null;
  editTaskText.value = '';
  editTaskDetails.value = '';
  editTaskStartTime.value = '';
  editTaskEndTime.value = '';
  editTaskIsRepeat.value = false;
  editTaskPriority.value = 'normal';
  editTaskEstimatedTime.value = 0;
  editTaskDifficulty.value = 'medium';
  showStartTimePicker.value = false;
  showEndTimePicker.value = false;
};

const toggleStartTimePicker = () => {
  showStartTimePicker.value = !showStartTimePicker.value;
  showEndTimePicker.value = false;
  if (showStartTimePicker.value) {
    generateStartCalendar();
  }
};

const toggleEndTimePicker = () => {
  showEndTimePicker.value = !showEndTimePicker.value;
  showStartTimePicker.value = false;
  if (showEndTimePicker.value) {
    generateEndCalendar();
  }
};

// 生成开始日历数据
const generateStartCalendar = () => {
  const year = startCalendarYear.value;
  const month = startCalendarMonth.value;
  const days = [];
  
  // 获取当月第一天是星期几
  const firstDay = new Date(year, month - 1, 1).getDay();
  
  // 获取当月的天数
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // 获取上个月的天数
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
  
  // 添加上个月的日期
  for (let i = firstDay - 1; i >= 0; i--) {
    const dateStr = `${year}-${(month - 1).toString().padStart(2, '0')}-${(daysInPrevMonth - i).toString().padStart(2, '0')}`;
    days.push({
      date: daysInPrevMonth - i,
      isOtherMonth: true,
      isSelected: false,
      isDisabled: selectedEndDate.value && new Date(dateStr) > new Date(selectedEndDate.value)
    });
  }
  
  // 添加当月的日期
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
    days.push({
      date: i,
      isOtherMonth: false,
      isSelected: selectedStartDate.value === dateStr,
      isDisabled: selectedEndDate.value && new Date(dateStr) > new Date(selectedEndDate.value),
      fullDate: dateStr
    });
  }
  
  // 添加下个月的日期，补满42个格子（6行7列）
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
    days.push({
      date: i,
      isOtherMonth: true,
      isSelected: false,
      isDisabled: selectedEndDate.value && new Date(dateStr) > new Date(selectedEndDate.value)
    });
  }
  
  startCalendarDays.value = days;
};

// 生成结束日历数据
const generateEndCalendar = () => {
  const year = endCalendarYear.value;
  const month = endCalendarMonth.value;
  const days = [];
  
  // 获取当月第一天是星期几
  const firstDay = new Date(year, month - 1, 1).getDay();
  
  // 获取当月的天数
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // 获取上个月的天数
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
  
  // 添加上个月的日期
  for (let i = firstDay - 1; i >= 0; i--) {
    const dateStr = `${year}-${(month - 1).toString().padStart(2, '0')}-${(daysInPrevMonth - i).toString().padStart(2, '0')}`;
    days.push({
      date: daysInPrevMonth - i,
      isOtherMonth: true,
      isSelected: false,
      isDisabled: selectedStartDate.value && new Date(dateStr) < new Date(selectedStartDate.value)
    });
  }
  
  // 添加当月的日期
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
    days.push({
      date: i,
      isOtherMonth: false,
      isSelected: selectedEndDate.value === dateStr,
      isDisabled: selectedStartDate.value && new Date(dateStr) < new Date(selectedStartDate.value),
      fullDate: dateStr
    });
  }
  
  // 添加下个月的日期，补满42个格子（6行7列）
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
    days.push({
      date: i,
      isOtherMonth: true,
      isSelected: false,
      isDisabled: selectedStartDate.value && new Date(dateStr) < new Date(selectedStartDate.value)
    });
  }
  
  endCalendarDays.value = days;
};

// 切换月份
const prevMonth = (type) => {
  if (type === 'start') {
    if (startCalendarMonth.value === 1) {
      startCalendarMonth.value = 12;
      startCalendarYear.value--;
    } else {
      startCalendarMonth.value--;
    }
    generateStartCalendar();
  } else {
    if (endCalendarMonth.value === 1) {
      endCalendarMonth.value = 12;
      endCalendarYear.value--;
    } else {
      endCalendarMonth.value--;
    }
    generateEndCalendar();
  }
};

const nextMonth = (type) => {
  if (type === 'start') {
    if (startCalendarMonth.value === 12) {
      startCalendarMonth.value = 1;
      startCalendarYear.value++;
    } else {
      startCalendarMonth.value++;
    }
    generateStartCalendar();
  } else {
    if (endCalendarMonth.value === 12) {
      endCalendarMonth.value = 1;
      endCalendarYear.value++;
    } else {
      endCalendarMonth.value++;
    }
    generateEndCalendar();
  }
};

// 选择开始日期
const selectStartDate = (day) => {
  if (day.isOtherMonth || day.isDisabled) return;
  selectedStartDate.value = day.fullDate;
  generateStartCalendar();
  // 重新生成结束日历，更新禁用状态
  if (showEndTimePicker.value) {
    generateEndCalendar();
  }
};

// 选择结束日期
const selectEndDate = (day) => {
  if (day.isOtherMonth || day.isDisabled) return;
  selectedEndDate.value = day.fullDate;
  generateEndCalendar();
  // 重新生成开始日历，更新禁用状态
  if (showStartTimePicker.value) {
    generateStartCalendar();
  }
};

// 确认开始时间
const confirmStartTime = () => {
  if (selectedStartDate.value) {
    editTaskStartTime.value = selectedStartDate.value;
  }
  showStartTimePicker.value = false;
};

// 确认结束时间
const confirmEndTime = () => {
  if (selectedEndDate.value) {
    editTaskEndTime.value = selectedEndDate.value;
  }
  showEndTimePicker.value = false;
};

// 新任务时间选择相关方法
const toggleNewTaskStartTimePicker = () => {
  showNewTaskStartTimePicker.value = !showNewTaskStartTimePicker.value;
  showNewTaskEndTimePicker.value = false;
  if (showNewTaskStartTimePicker.value) {
    generateNewTaskStartCalendar();
  }
};

const toggleNewTaskEndTimePicker = () => {
  showNewTaskEndTimePicker.value = !showNewTaskEndTimePicker.value;
  showNewTaskStartTimePicker.value = false;
  if (showNewTaskEndTimePicker.value) {
    generateNewTaskEndCalendar();
  }
};

// 生成新任务开始日历数据
const generateNewTaskStartCalendar = () => {
  const year = newTaskStartCalendarYear.value;
  const month = newTaskStartCalendarMonth.value;
  const days = [];
  
  // 获取当月第一天是星期几
  const firstDay = new Date(year, month - 1, 1).getDay();
  
  // 获取当月的天数
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // 获取上个月的天数
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
  
  // 添加上个月的日期
  for (let i = firstDay - 1; i >= 0; i--) {
    const dateStr = `${year}-${(month - 1).toString().padStart(2, '0')}-${(daysInPrevMonth - i).toString().padStart(2, '0')}`;
    days.push({
      date: daysInPrevMonth - i,
      isOtherMonth: true,
      isSelected: false,
      isDisabled: newTaskSelectedEndDate.value && new Date(dateStr) > new Date(newTaskSelectedEndDate.value)
    });
  }
  
  // 添加当月的日期
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
    days.push({
      date: i,
      isOtherMonth: false,
      isSelected: newTaskSelectedStartDate.value === dateStr,
      isDisabled: newTaskSelectedEndDate.value && new Date(dateStr) > new Date(newTaskSelectedEndDate.value),
      fullDate: dateStr
    });
  }
  
  // 添加下个月的日期，补满42个格子（6行7列）
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
    days.push({
      date: i,
      isOtherMonth: true,
      isSelected: false,
      isDisabled: newTaskSelectedEndDate.value && new Date(dateStr) > new Date(newTaskSelectedEndDate.value)
    });
  }
  
  newTaskStartCalendarDays.value = days;
};

// 生成新任务结束日历数据
const generateNewTaskEndCalendar = () => {
  const year = newTaskEndCalendarYear.value;
  const month = newTaskEndCalendarMonth.value;
  const days = [];
  
  // 获取当月第一天是星期几
  const firstDay = new Date(year, month - 1, 1).getDay();
  
  // 获取当月的天数
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // 获取上个月的天数
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
  
  // 添加上个月的日期
  for (let i = firstDay - 1; i >= 0; i--) {
    const dateStr = `${year}-${(month - 1).toString().padStart(2, '0')}-${(daysInPrevMonth - i).toString().padStart(2, '0')}`;
    days.push({
      date: daysInPrevMonth - i,
      isOtherMonth: true,
      isSelected: false,
      isDisabled: newTaskSelectedStartDate.value && new Date(dateStr) < new Date(newTaskSelectedStartDate.value)
    });
  }
  
  // 添加当月的日期
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
    days.push({
      date: i,
      isOtherMonth: false,
      isSelected: newTaskSelectedEndDate.value === dateStr,
      isDisabled: newTaskSelectedStartDate.value && new Date(dateStr) < new Date(newTaskSelectedStartDate.value),
      fullDate: dateStr
    });
  }
  
  // 添加下个月的日期，补满42个格子（6行7列）
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
    days.push({
      date: i,
      isOtherMonth: true,
      isSelected: false,
      isDisabled: newTaskSelectedStartDate.value && new Date(dateStr) < new Date(newTaskSelectedStartDate.value)
    });
  }
  
  newTaskEndCalendarDays.value = days;
};

// 新任务切换月份
const newTaskPrevMonth = (type) => {
  if (type === 'start') {
    if (newTaskStartCalendarMonth.value === 1) {
      newTaskStartCalendarMonth.value = 12;
      newTaskStartCalendarYear.value--;
    } else {
      newTaskStartCalendarMonth.value--;
    }
    generateNewTaskStartCalendar();
  } else {
    if (newTaskEndCalendarMonth.value === 1) {
      newTaskEndCalendarMonth.value = 12;
      newTaskEndCalendarYear.value--;
    } else {
      newTaskEndCalendarMonth.value--;
    }
    generateNewTaskEndCalendar();
  }
};

const newTaskNextMonth = (type) => {
  if (type === 'start') {
    if (newTaskStartCalendarMonth.value === 12) {
      newTaskStartCalendarMonth.value = 1;
      newTaskStartCalendarYear.value++;
    } else {
      newTaskStartCalendarMonth.value++;
    }
    generateNewTaskStartCalendar();
  } else {
    if (newTaskEndCalendarMonth.value === 12) {
      newTaskEndCalendarMonth.value = 1;
      newTaskEndCalendarYear.value++;
    } else {
      newTaskEndCalendarMonth.value++;
    }
    generateNewTaskEndCalendar();
  }
};

// 新任务选择开始日期
const newTaskSelectStartDate = (day) => {
  if (day.isOtherMonth || day.isDisabled) return;
  newTaskSelectedStartDate.value = day.fullDate;
  generateNewTaskStartCalendar();
  // 重新生成结束日历，更新禁用状态
  if (showNewTaskEndTimePicker.value) {
    generateNewTaskEndCalendar();
  }
};

// 新任务选择结束日期
const newTaskSelectEndDate = (day) => {
  if (day.isOtherMonth || day.isDisabled) return;
  newTaskSelectedEndDate.value = day.fullDate;
  generateNewTaskEndCalendar();
  // 重新生成开始日历，更新禁用状态
  if (showNewTaskStartTimePicker.value) {
    generateNewTaskStartCalendar();
  }
};

// 新任务确认开始时间
const newTaskConfirmStartTime = () => {
  if (newTaskSelectedStartDate.value) {
    newTaskStartTime.value = newTaskSelectedStartDate.value;
  }
  showNewTaskStartTimePicker.value = false;
};

// 新任务确认结束时间
const newTaskConfirmEndTime = () => {
  if (newTaskSelectedEndDate.value) {
    newTaskEndTime.value = newTaskSelectedEndDate.value;
  }
  showNewTaskEndTimePicker.value = false;
};

const handleAddTask = ({ text, details, startTime, endTime, isRepeat, priority, estimatedTime, difficulty }) => {
  if (isRepeat) {
    const newRepeatTask = {
      id: generateId({ text, time: startTime || new Date().toISOString() }, 'repeat'),
      text,
      details,
      time: startTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      startTime,
      endTime,
      startDate: startTime ? startTime.split(' ')[0] : '',
      endDate: endTime ? endTime.split(' ')[0] : '',
      priority,
      estimatedTime,
      estimatedMinutes: estimatedTime,
      difficulty,
      createdAt: new Date().toISOString()
    };
    repeatTasks.value.push(newRepeatTask);
  } else {
    const newTodo = {
      id: generateId({ text, time: startTime || new Date().toISOString() }, 'todo'),
      text,
      details,
      time: startTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      startTime,
      endTime,
      startDate: startTime ? startTime.split(' ')[0] : '',
      endDate: endTime ? endTime.split(' ')[0] : '',
      isRepeat: false,
      priority,
      estimatedTime,
      estimatedMinutes: estimatedTime,
      difficulty,
      completed: false,
      createdAt: new Date().toISOString()
    };
    todos.value.unshift(newTodo);
    syncTodoToServer(newTodo);  // 同步到服务器
  }
  
  saveData();
  syncData();
  
  // DDL 联动：同步到 agent_tasks 表
  const todoToSync = isRepeat ? repeatTasks.value[repeatTasks.value.length - 1] : todos.value[0]
  if (todoToSync) {
    syncScheduleToTasks(todoToSync, uni.getStorageSync('shiya_session_id')).then(res => {
      if (res?.taskId) {
        // 将 taskId 回填到日程对象
        if (isRepeat) {
          repeatTasks.value[repeatTasks.value.length - 1].taskId = res.taskId
        } else {
          todos.value[0].taskId = res.taskId
        }
        saveData()
        console.log('[DDL联动] 日程已同步 taskId=', res.taskId)
      }
    }).catch(e => console.error('[DDL联动] 同步失败:', e))
  }
  
  // 更新乌鸦状态
  crowAction.value = 'flap';
  setTimeout(() => crowAction.value = 'idle', 1000);
  
  setShowAddTask(false);
};

const setShowAddTask = (value) => {
  showAddTask.value = value;
  if (!value) {
    newTaskText.value = '';
    newTaskDetails.value = '';
    newTaskStartTime.value = '';
    newTaskEndTime.value = '';
    newTaskIsRepeat.value = false;
    newTaskPriority.value = 'normal';
    newTaskEstimatedTime.value = 0;
    newTaskDifficulty.value = 'medium';
    newTaskSelectedStartDate.value = null;
    newTaskSelectedEndDate.value = null;
    showNewTaskStartTimePicker.value = false;
    showNewTaskEndTimePicker.value = false;
  }
};

// Date Picker Functions
const generateDateCalendar = (year, month, selectedValue, daysArray) => {
  const days = [];
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
  
  for (let i = firstDay - 1; i >= 0; i--) {
    const dateStr = `${year}-${(month - 1).toString().padStart(2, '0')}-${(daysInPrevMonth - i).toString().padStart(2, '0')}`;
    days.push({
      date: daysInPrevMonth - i,
      isOtherMonth: true,
      isSelected: false,
      fullDate: dateStr
    });
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
    days.push({
      date: i,
      isOtherMonth: false,
      isSelected: selectedValue === dateStr,
      fullDate: dateStr
    });
  }
  
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
    days.push({
      date: i,
      isOtherMonth: true,
      isSelected: false,
      fullDate: dateStr
    });
  }
  
  return days;
};

const prevDateMonth = () => {
  if (dateCalendarMonth.value === 1) {
    dateCalendarMonth.value = 12;
    dateCalendarYear.value--;
  } else {
    dateCalendarMonth.value--;
  }
  dateCalendarDays.value = generateDateCalendar(
    dateCalendarYear.value,
    dateCalendarMonth.value,
    selectedDateValue.value,
    dateCalendarDays.value
  );
};

const nextDateMonth = () => {
  if (dateCalendarMonth.value === 12) {
    dateCalendarMonth.value = 1;
    dateCalendarYear.value++;
  } else {
    dateCalendarMonth.value++;
  }
  dateCalendarDays.value = generateDateCalendar(
    dateCalendarYear.value,
    dateCalendarMonth.value,
    selectedDateValue.value,
    dateCalendarDays.value
  );
};

const selectDate = (day) => {
  if (day.isOtherMonth) return;
  selectedDateValue.value = day.fullDate;
  dateCalendarDays.value = generateDateCalendar(
    dateCalendarYear.value,
    dateCalendarMonth.value,
    selectedDateValue.value,
    dateCalendarDays.value
  );
};

const confirmDate = () => {
  selectedDate.value = selectedDateValue.value;
  showDatePicker.value = false;
};

const closeDatePicker = () => {
  showDatePicker.value = false;
};

const openDiaryDatePicker = () => {
  selectedDateValue.value = selectedDate.value;
  dateCalendarDays.value = generateDateCalendar(
    dateCalendarYear.value,
    dateCalendarMonth.value,
    selectedDateValue.value,
    dateCalendarDays.value
  );
  showDatePicker.value = true;
};

const openScheduleDatePicker = () => {
  selectedScheduleDateValue.value = selectedScheduleDate.value;
  scheduleDateCalendarDays.value = generateDateCalendar(
    scheduleDateCalendarYear.value,
    scheduleDateCalendarMonth.value,
    selectedScheduleDateValue.value,
    scheduleDateCalendarDays.value
  );
  showScheduleDatePicker.value = true;
};

const prevScheduleDateMonth = () => {
  if (scheduleDateCalendarMonth.value === 1) {
    scheduleDateCalendarMonth.value = 12;
    scheduleDateCalendarYear.value--;
  } else {
    scheduleDateCalendarMonth.value--;
  }
  scheduleDateCalendarDays.value = generateDateCalendar(
    scheduleDateCalendarYear.value,
    scheduleDateCalendarMonth.value,
    selectedScheduleDateValue.value,
    scheduleDateCalendarDays.value
  );
};

const nextScheduleDateMonth = () => {
  if (scheduleDateCalendarMonth.value === 12) {
    scheduleDateCalendarMonth.value = 1;
    scheduleDateCalendarYear.value++;
  } else {
    scheduleDateCalendarMonth.value++;
  }
  scheduleDateCalendarDays.value = generateDateCalendar(
    scheduleDateCalendarYear.value,
    scheduleDateCalendarMonth.value,
    selectedScheduleDateValue.value,
    scheduleDateCalendarDays.value
  );
};

const selectScheduleDate = (day) => {
  if (day.isOtherMonth) return;
  selectedScheduleDateValue.value = day.fullDate;
  scheduleDateCalendarDays.value = generateDateCalendar(
    scheduleDateCalendarYear.value,
    scheduleDateCalendarMonth.value,
    selectedScheduleDateValue.value,
    scheduleDateCalendarDays.value
  );
};

const confirmScheduleDate = () => {
  selectedScheduleDate.value = selectedScheduleDateValue.value;
  showScheduleDatePicker.value = false;
};

const closeScheduleDatePicker = () => {
  showScheduleDatePicker.value = false;
};

// Diary Functions
const openDiaryEdit = (diary = null) => {
  if (diary) {
    editingDiary.value = diary;
  } else {
    editingDiary.value = null;
  }
  showDiaryEdit.value = true;
};

const closeDiaryEdit = () => {
  showDiaryEdit.value = false;
  editingDiary.value = null;
  editDiaryContent.value = '';
  editDiaryTags.value = [];
  editDiaryImages.value = [];
};

const handleSaveDiary = ({ id, date, content, tags, images }) => {
  if (id) {
    const diary = diaryEntries.value.find(d => d.id === id);
    if (diary) {
      diary.date = date;
      diary.content = content;
      diary.tags = tags;
      diary.images = images;
    }
  } else {
    const newDiary = {
      id: generateId({ content, date }, 'diary'),
      date,
      content,
      tags,
      images
    };
    diaryEntries.value.push(newDiary);
  }
  
  saveData();
  closeDiaryEdit();
};

const deleteDiary = (id) => {
  diaryToDelete.value = diaryEntries.value.find(d => d.id === id);
  showDiaryDeleteConfirm.value = true;
};

const confirmDeleteDiary = () => {
  if (diaryToDelete.value) {
    diaryEntries.value = diaryEntries.value.filter(d => d.id !== diaryToDelete.value.id);
    saveData();
    diaryToDelete.value = null;
  }
  showDiaryDeleteConfirm.value = false;
};

const openImageViewer = (images, index) => {
  viewingImages.value = images;
  viewingImageIndex.value = index;
  showImageViewer.value = true;
};

const closeImageViewer = () => {
  showImageViewer.value = false;
};

const prevImage = () => {
  if (viewingImageIndex.value > 0) {
    viewingImageIndex.value--;
  }
};

const nextImage = () => {
  if (viewingImageIndex.value < viewingImages.value.length - 1) {
    viewingImageIndex.value++;
  }
};

// Chat Functions
const syncData = async () => {
  try {
    const token = uni.getStorageSync('token');
    if (!token) {
      console.warn('未登录，跳过同步');
      return;
    }
    
    // 同步日程和日记
    await new Promise((resolve, reject) => {
      uni.request({
        url: API_BASE_URL + '/save-data',
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: {
          // todos 不再上传：服务器为权威数据源，本地仅缓存
          // 日程增删改均通过 SSE 事件（schedule/schedule_updated/schedule_deleted）或 confirm-action API 执行
          repeatTasks: repeatTasks.value,
          completedTasks: completedTasks.value,
          diaryEntries: diaryEntries.value.filter(d => d && d.content && d.content.trim())
        },
        success: (res) => {
          if (res.data && res.data.success) {
            console.log('数据同步成功');
            resolve();
          } else {
            console.error('日程/日记同步失败:', res.data?.message || '未知错误');
            reject(new Error('日程/日记同步失败'));
          }
        },
        fail: (err) => {
          console.error('日程/日记同步失败:', err);
          reject(err);
        }
      });
    });

    // 同步乌鸦数据（包括聊天记录）
    await new Promise((resolve, reject) => {
      uni.request({
        url: API_BASE_URL + '/save-crow-data',
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: {
          crowStats: crowStats.value,
          chatMessages: messages.value,
          foodCount: foodCount.value
        },
        success: (res) => {
          if (res.data && res.data.success) {
            console.log('乌鸦数据同步成功');
            resolve();
          } else {
            console.error('乌鸦数据同步失败:', res.data?.message || '未知错误');
            reject(new Error('乌鸦数据同步失败'));
          }
        },
        fail: (err) => {
          console.error('乌鸦数据同步失败:', err);
          reject(err);
        }
      });
    });
  } catch (error) {
    console.error('数据同步失败:', error);
  }
};

// 同步数据到后端（不等待，不阻塞）
const syncDataWithoutImages = async () => {
  try {
    const token = uni.getStorageSync('token');
    if (token) {
      // 检查数据大小，避免413错误
      const syncData = {
        // todos 不再上传：服务器为权威数据源，日程增删改均通过专用 API/SSE 执行
        repeatTasks: repeatTasks.value,
        completedTasks: completedTasks.value,
        diaryEntries: diaryEntries.value
      };
      
      const dataString = JSON.stringify(syncData);
      const dataSize = dataString.length;
      
      console.log(`同步数据大小: ${(dataSize / 1024).toFixed(2)} KB`);
      
      // 如果数据大小超过1MB，可能会导致413错误
      if (dataSize > 1024 * 1024) {
        console.warn('数据大小超过1MB，可能会导致同步失败');
        return;
      }
      
      // 同步日程和日记 - 使用uni.request代替fetch，确保在APP环境中也能正常访问
      uni.request({
        url: API_BASE_URL + '/save-data',
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: syncData,
        success: (res) => {
          if (res.data && res.data.success) {
            console.log('数据同步成功');
          }
        },
        fail: (err) => {
          console.error('日程/日记同步失败:', err);
        }
      });

      // 同步乌鸦数据（包括聊天记录）- 不等待结果
      uni.request({
        url: API_BASE_URL + '/save-crow-data',
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: {
          crowStats: crowStats.value,
          chatMessages: messages.value,
          foodCount: foodCount.value
        },
        success: (res) => {
          if (res.data && res.data.success) {
            console.log('乌鸦数据同步成功');
          }
        },
        fail: (err) => {
          console.error('乌鸦数据同步失败:', err);
        }
      });
    }
  } catch (error) {
    console.error('数据同步失败:', error);
  }
};

const loadDataFromServer = async () => {
  try {
    const token = uni.getStorageSync('token');
    if (!token) return;
    
    // 包装为 Promise 确保 await 真正等待请求完成
    await new Promise((resolve, reject) => {
      uni.request({
        url: API_BASE_URL + '/get-data',
        method: 'GET',
        header: {
          'Authorization': `Bearer ${token}`
        },
        success: (res) => {
          if (res.data && res.data.success && res.data.data) {
            if (res.data.data.todos) {
              // 服务器为唯一数据源，直接替换本地缓存
              console.log('[数据同步] 从服务器加载日程:', res.data.data.todos.length, '条');
              todos.value = res.data.data.todos;
            }
            if (res.data.data.diaryEntries) {
              diaryEntries.value = mergeData(diaryEntries.value, res.data.data.diaryEntries);
            }
            saveData();
          }
          resolve();
        },
        fail: (err) => {
          console.error('[数据同步] 从服务器加载失败:', err);
          reject(err);
        }
      });
    });
  } catch (e) {
    console.error('从服务器加载数据失败:', e);
  }
};

const processAiResponse = (data, images = []) => {
  console.log('[调试] processAiResponse 收到 data =', JSON.stringify(data, null, 2));
  
  const difyData = data.dify;
  const toolResult = data.toolResult;
  console.log('[调试] processAiResponse 中 toolResult =', toolResult);
  
  let modelText = '';
  
  const cleanText = (text) => {
    if (!text) return text;
    let cleaned = text;
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<\/?think>/gi, '');
    return cleaned.trim();
  };
  
  if (data.needsConfirmation && data.confirmOptions) {
    needsConfirmation.value = true;
    confirmableTool.value = data.confirmableTool;
    confirmOptions.value = data.confirmOptions;
    pendingMessages.value = [...messages.value];
    pendingImages.value = [...images];
  } else {
    needsConfirmation.value = false;
    confirmableTool.value = null;
    confirmOptions.value = [];
  }
  
  if (difyData) {
    if (difyData.thinkingProcess) {
      console.log('[Dify思考过程]', difyData.thinkingProcess);
    }
    
    if (data.needsConfirmation) {
      modelText = cleanText(data.choices?.[0]?.message?.content || "要帮你记录吗？嘎～");
    } else {
      modelText = cleanText(difyData.response || data.choices?.[0]?.message?.content || "嘎？我没听清楚，能再说一遍吗？");
    }
  } else {
    modelText = cleanText(data.choices?.[0]?.message?.content || "嘎？我没听清楚，能再说一遍吗？");
  }

  if (toolResult && toolResult.success) {
    console.log('[工具执行结果]', toolResult);
    
    if (toolResult.action === 'create') {
      if (toolResult.data.date && toolResult.data.text) {
        console.log('[调度] 添加日程:', toolResult.data);
        todos.value.unshift(toolResult.data);
      } else if (toolResult.data.content) {
        console.log('[调度] 添加日记:', toolResult.data);
        if (images.length > 0) {
          toolResult.data.images = images;
          toolResult.data.image = images[0];
        }
        diaryEntries.value.unshift(toolResult.data);
      }
    } else if (toolResult.action === 'update' && toolResult.data.id) {
      const index = todos.value.findIndex(t => t.id === toolResult.data.id);
      if (index !== -1) {
        todos.value[index] = { ...todos.value[index], ...toolResult.data };
      }
    } else if (toolResult.action === 'delete' && toolResult.data.id) {
      todos.value = todos.value.filter(t => t.id !== toolResult.data.id);
    }
  }
  else if (data.pendingActions && data.pendingActions.length > 0) {
    data.pendingActions.forEach(action => {
      if (action.type === 'schedule') {
        todos.value.unshift(action.data);
      } else if (action.type === 'diary') {
        if (images.length > 0) {
          action.data.images = images;
          action.data.image = images[0];
        }
        diaryEntries.value.unshift(action.data);
      }
    });
  }

  const newMessage = { 
    role: 'model', 
    text: modelText,
    thinkingSteps: [...thinkingSteps.value],
    showThinking: true
  };
  
  messages.value.push(newMessage);
  syncData();
  crowAction.value = 'happy';
};

const processNormalChat = async (userMsg, images) => {
  try {
    // 控制消息（确认/取消）不需要同步：同步可能覆盖服务器上待执行操作的数据
    const controlMessages = ['确认', '是', '是的', '好的', '好', '行', '可以', '取消', '算了', '不要', '别', '对',
      '确定', '没错', '确认删除', '就这样', '没问题', '就这么办'];
    const isControlMsg = controlMessages.some(c => userMsg.trim() === c || userMsg.trim().startsWith(c));
    console.log('[确认流程] processNormalChat 收到消息:', userMsg, 'isControlMsg:', isControlMsg, 'pendingConfirm:', pendingConfirm.value);
    
    // 如果存在待确认操作且用户发了确认类消息，直接用 API 执行，不走聊天流程
    if (pendingConfirm.value && isControlMsg) {
      if (userMsg.includes('取消') || userMsg.includes('算了') || userMsg.includes('不要') || userMsg.includes('别')) {
        handleCancelConfirmationApi();
      } else {
        await handleConfirmActionApi();
      }
      return;
    }
    
    if (!isControlMsg) {
      await syncData();
    }
    
    // 重置思考步骤
    thinkingSteps.value = [];
    showThinking.value = true;

    // === 使用 DeepSeek 统一 AI 引擎 ===
    let lastThinkingIndex = -1; // 跟踪最后一个 thinking step，用于标记 status

    await chatWithDeepSeek(
      { content: userMsg },
      (eventType, data) => {
        if (eventType === 'thinking') {
          // 收到新 thinking step：上一个标记为 completed，新标记为 running
          if (lastThinkingIndex >= 0) {
            thinkingSteps.value[lastThinkingIndex].status = 'completed';
          }
          lastThinkingIndex = thinkingSteps.value.length;
          thinkingSteps.value.push({
            text: data.text,
            icon: data.icon || '•',
            status: 'running',
          });
          scrollChatToBottom();
        } else if (eventType === 'message') {
          // 流式追加 AI 回复文本
          const lastMsg = messages.value[messages.value.length - 1];
          if (lastMsg && lastMsg.role === 'model') {
            lastMsg.text += data.content;
          } else {
            messages.value.push({ role: 'model', text: data.content });
          }
          scrollChatToBottom();
        } else if (eventType === 'task_split') {
          // 任务拆解：子任务直接加入日程列表
          if (data.subTasks && Array.isArray(data.subTasks)) {
            const inferDifficulty = (p) => p >= 4 ? 'hard' : p >= 3 ? 'medium' : 'easy';
            const newTodos = data.subTasks.map(sub => {
              const prio = sub.priority || 3;
              const estMin = sub.estimatedMinutes || 30;
              return {
                id: Date.now() + Math.random() * 1000 | 0,
                text: sub.title,
                title: sub.title,
                description: sub.description || '',
                details: sub.description || '',
                date: sub.startDate || sub.deadline || '',
                startDate: sub.startDate || '',
                endDate: sub.deadline || '',
                startTime: sub.startDate || '',
                endTime: sub.deadline || '',
                time: '',
                completed: false,
                priority: prio,
                estimatedMinutes: estMin,
                estimatedTime: estMin,
                difficulty: sub.difficulty || inferDifficulty(prio),
                updatedAt: Date.now(),
                createdAt: new Date().toISOString(),
              };
            });
            todos.value = [...newTodos, ...todos.value];
            syncData();
            newTodos.forEach(t => syncTodoToServer(t));  // AI 拆解的子任务也同步到服务器

            // 工具调用卡片：显示拆解结果
            if (lastThinkingIndex >= 0) {
              thinkingSteps.value[lastThinkingIndex].status = 'completed';
            }
            const taskList = data.subTasks.slice(0, 4).map(s => `・${s.title}`).join('\n');
            const moreText = data.subTasks.length > 4 ? `\n  ...等共${data.subTasks.length}项` : '';
            thinkingSteps.value.push({
              text: `生成 ${data.subTasks.length} 个子任务`,
              icon: '📋',
              status: 'completed',
              toolCall: {
                name: '任务拆解',
                icon: '📋',
                status: 'completed',
                detail: `${data.mainTask?.title || '任务'} →\n${taskList}${moreText}`,
              },
            });
            lastThinkingIndex = thinkingSteps.value.length - 1;
          }
          // 同时保存到消息元数据，供 TaskSplitCard 使用
          const lastMsg = messages.value[messages.value.length - 1];
          if (lastMsg && lastMsg.role === 'model') {
            lastMsg.taskSplit = data;
          }
        } else if (eventType === 'schedule') {
          if (data.action === 'create' && data.data && data.data.title) {
            const sData = data.data;
            const prio = sData.priority || 3;
            const estMin = sData.estimatedMinutes || 60;
            const inferDifficulty = (p) => p >= 4 ? 'hard' : p >= 3 ? 'medium' : 'easy';
            // 组合 startDate + startTime 为完整日期时间串，兼容编辑表单
            const fullStartTime = sData.startDate
              ? (sData.startDate + (sData.startTime ? ' ' + sData.startTime : ''))
              : (sData.startTime || sData.date || '');
            const fullEndTime = sData.endDate
              ? (sData.endDate + (sData.endTime ? ' ' + sData.endTime : ''))
              : (sData.endTime || sData.date || '');
            todos.value.unshift({
              id: Date.now(),
              text: sData.title,
              title: sData.title,
              description: sData.description || '',
              details: sData.description || '',
              date: sData.startDate || sData.date || '',
              startDate: sData.startDate || sData.date || '',
              endDate: sData.endDate || sData.date || '',
              time: sData.startTime || sData.time || '',
              startTime: fullStartTime,
              endTime: fullEndTime,
              completed: false,
              priority: prio,
              estimatedMinutes: estMin,
              estimatedTime: estMin,
              difficulty: sData.difficulty || inferDifficulty(prio),
              repeatInterval: sData.repeatInterval || 'none',
              updatedAt: Date.now(),
              createdAt: new Date().toISOString(),
            });
            syncData();
            syncTodoToServer(todos.value[0]);  // AI 创建也同步到服务器

            // 工具调用卡片
            if (lastThinkingIndex >= 0) {
              thinkingSteps.value[lastThinkingIndex].status = 'completed';
            }
            const dateLabel = data.data.startDate && data.data.startDate !== data.data.date
              ? `${data.data.startDate}~${data.data.endDate || data.data.startDate}`
              : data.data.date || data.data.startDate || '';
            thinkingSteps.value.push({
              text: `创建日程「${data.data.title}」`,
              icon: '📅',
              status: 'completed',
              toolCall: {
                name: '创建日程',
                icon: '📅',
                status: 'completed',
                detail: `📌 ${data.data.title}\n📅 ${dateLabel}${data.data.time ? ' ⏰ ' + data.data.time : ''}${data.data.estimatedMinutes ? '\n⏱ ' + data.data.estimatedMinutes + '分钟' : ''}${data.data.priority ? '\n🔥 优先级 P' + data.data.priority : ''}`,
              },
            });
            lastThinkingIndex = thinkingSteps.value.length - 1;
          }
        } else if (eventType === 'diary') {
          if (data.action === 'create' && data.data && data.data.content) {
            diaryEntries.value.unshift({
              id: Date.now(),
              date: data.data.date || '',
              content: data.data.content,
              mood: data.data.mood || '😊',
            });
            syncData();
          }
        } else if (eventType === 'action_confirm') {
          // 显示确认卡片（删除/修改/批量删除日程）
          console.log('[SSE] 收到 action_confirm:', JSON.stringify(data));
          pendingConfirm.value = {
            action: data.action,
            title: data.title || data.titles || '',
            detail: data.detail,
            targetId: data.targetId,
            targetIds: data.targetIds || [],
            count: data.count || 0,
          };
          // 在消息中附加确认标记
          const lastMsg = messages.value[messages.value.length - 1];
          if (lastMsg && lastMsg.role === 'model') {
            lastMsg.pendingConfirm = { ...pendingConfirm.value };
          }
        } else if (eventType === 'schedule_list') {
          // 查询结果：作为消息展示
          const listText = data.todos && data.todos.length > 0
            ? data.todos.map((t, i) => `${i + 1}. ${t.text || t.title}（${t.startDate || ''}${t.priority ? ' P' + t.priority : ''}）`).join('\n')
            : '没有找到匹配的日程';
          // 查询结果追加到当前消息
          const lastMsg2 = messages.value[messages.value.length - 1];
          if (lastMsg2 && lastMsg2.role === 'model') {
            lastMsg2.scheduleList = { keyword: data.keyword, todos: data.todos };
          }
        } else if (eventType === 'schedule_updated') {
          // 本地更新日程（服务器已更新，本地仅做缓存同步）
          const idx = todos.value.findIndex(t => String(t.id) === String(data.id));
          if (idx !== -1 && data.todo) {
            todos.value[idx] = { ...todos.value[idx], ...data.todo };
          }
          pendingConfirm.value = null;
        } else if (eventType === 'schedule_deleted') {
          // 本地删除日程（服务器已删除，本地仅做缓存同步）
          console.log('[确认流程] 收到 schedule_deleted:', data.id, '当前 todos 数量:', todos.value.length);
          todos.value = todos.value.filter(t => String(t.id) !== String(data.id));
          console.log('[确认流程] 删除后 todos 数量:', todos.value.length);
          pendingConfirm.value = null;
        } else if (eventType === 'schedule_batch_deleted') {
          // 本地批量删除（服务器已删除，本地仅同步）
          const idSet = new Set((data.targetIds || []).map(String));
          todos.value = todos.value.filter(t => !idSet.has(String(t.id)));
          pendingConfirm.value = null;
        } else if (eventType === 'done') {
          // 所有 thinking step 标记为完成
          if (lastThinkingIndex >= 0) {
            thinkingSteps.value[lastThinkingIndex].status = 'completed';
          }
          const lastMsg = messages.value[messages.value.length - 1];
          if (lastMsg && lastMsg.role === 'model' && thinkingSteps.value.length > 0) {
            lastMsg.thinkingSteps = [...thinkingSteps.value];
            lastMsg.showThinking = true;
          }
        }
      }
    );
    
    isTyping.value = false;
    thinkingSteps.value = [];
    // 保留 pendingConfirm：让用户有时间点击确认/取消按钮
    // 清除时机：handleCancelConfirmation 或 新 action_confirm 覆盖
    
    await loadDataFromServer();
  } catch (error) {
    console.error("AI Error:", error);
    let errorMessage = "嘎... 网络好像有点问题。";
    
    if (error.message) {
      errorMessage = "嘎... " + error.message;
    }
    messages.value.push({ role: 'model', text: errorMessage });
    isTyping.value = false;
    thinkingSteps.value = [];
  } finally {
    setTimeout(() => crowAction.value = 'idle', 2000);
  }
};

const setIsChatOpen = (value) => {
  isChatOpen.value = value;
};

// ===== 会话管理处理函数 =====

const toggleConvList = () => {
  showConvList.value = !showConvList.value;
};

const handleNewChat = () => {
  // 清空当前会话，创建新的
  activeSessionId.value = '';
  uni.removeStorageSync('shiya_session_id');
  messages.value = [
    { role: 'model', text: '嘎！我是你的拾鸦助手，今天有什么想记录的吗？' }
  ];
};

const handleSwitchConversation = async (conv) => {
  if (conv.id === activeSessionId.value) return;

  // 保存当前 sessionId 并加载历史消息
  activeSessionId.value = conv.id;
  uni.setStorageSync('shiya_session_id', conv.id);

  // 加载该会话的消息
  const msgs = [
    { role: 'model', text: '嘎！已加载历史对话。' }
  ];
  try {
    const res = await getConversationMessages(conv.id);
    if (res.success && res.data?.length > 0) {
      const formatted = res.data.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        text: m.content,
      }));
      msgs.splice(0, 0, ...formatted);
    }
  } catch (e) {
    console.error('加载历史消息失败:', e);
  }

  messages.value = msgs;
};

const clearChatHistory = () => {
  uni.showModal({
    title: '确认清除',
    content: '确定要清除所有聊天记录吗？',
    success: function (res) {
      if (res.confirm) {
        messages.value = [
          { role: 'model', text: '嘎！我是你的拾鸦助手，今天有什么想记录的吗？' }
        ];
        activeSessionId.value = '';
        uni.removeStorageSync('shiya_session_id');
        saveData();
      }
    }
  });
};

const handleSendMessage = async ({ text, images }) => {
  console.log('[index.vue] handleSendMessage 被调用！');
  console.log('[index.vue] text:', text);
  console.log('[index.vue] images:', images);
  console.log('[index.vue] isTyping.value:', isTyping.value);
  console.log('[index.vue] isSendingMessage:', isSendingMessage);
  
  if ((!text.trim() && images.length === 0) || isTyping.value || isSendingMessage) {
    console.log('[index.vue] 条件不满足，return');
    return;
  }

  // 上锁
  isSendingMessage = true;

  try {
    const userMsg = text.trim();
    const imagesList = [...images];
    
    // 清空输入框和已上传图片
    if (imagesList.length > 0) {
      uploadedImages.value = [];
    }
    
    // 构建消息内容
    const messageContent = {
      role: 'user',
      text: userMsg
    };
    
    if (imagesList.length > 0) {
      messageContent.images = imagesList;
    }
    
    messages.value.push(messageContent);
    isTyping.value = true;
    crowAction.value = 'think';

    // 自由模式：直接调用主脑进行自然语言聊天
    await processNormalChat(userMsg, imagesList);
  } finally {
    // 解锁
    isSendingMessage = false;
  }
};

const handleConfirm = async (tool) => {
  console.log('✅ 用户确认操作，选择工具:', tool);
  
  needsConfirmation.value = false;
  
  // 显示思考状态
  isTyping.value = true;
  thinkingSteps.value = [];
  showThinking.value = true;
  crowAction.value = 'think';
  
  try {
    // 同步数据到后端
    await syncData();
    
    const token = uni.getStorageSync('token');
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 构建请求
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        messages: pendingMessages.value.map(msg => {
          // 转换消息格式为后端需要的格式
          if (msg.role === 'user' && msg.images && msg.images.length > 0) {
            const content = [];
            if (msg.text) {
              content.push({ type: 'text', text: msg.text });
            }
            for (const imageUrl of msg.images) {
              const parts = imageUrl.split(',');
              const mimeMatch = imageUrl.match(/^data:(image\/\w+);base64,/);
              const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
              const base64Image = parts[1];
              content.push({
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              });
            }
            return { role: 'user', content };
          }
          return { role: msg.role, content: msg.text || '' };
        }),
        action: 'confirm',
        confirmedTool: tool,
        context: {
          crowStats: crowStats.value,
          todos: todos.value,
          diaryEntries: diaryEntries.value
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API response error: ${response.status}`);
    }

    // 处理SSE响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalData = null;
    let serverError = null;
    let hasReceivedReply = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      
      for (const event of events) {
        if (!event.trim()) continue;
        
        let eventType = '';
        let dataStr = '';
        const lines = event.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.substring('event: '.length).trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.substring('data: '.length);
          }
        }
        
        if (eventType && dataStr) {
          try {
            const data = JSON.parse(dataStr);
            
            if (eventType === 'thinking') {
              thinkingSteps.value.push(data);
              scrollChatToBottom();
            } else if (eventType === 'reply') {
              hasReceivedReply = true;
              const lastMsg = messages.value[messages.value.length - 1];
              if (lastMsg && lastMsg.role === 'model') {
                lastMsg.text += data.content;
              } else {
                messages.value.push({ role: 'model', text: data.content });
              }
              scrollChatToBottom();
            } else if (eventType === 'complete') {
              finalData = data;
            } else if (eventType === 'error') {
              serverError = new Error(data.message || '未知错误');
            }
          } catch (e) {
            console.error('[错误] 解析JSON失败:', e, 'dataStr=', dataStr);
          }
        }
      }
    }

    if (serverError) {
      throw serverError;
    }

    if (finalData) {
      if (!hasReceivedReply) {
        processAiResponse(finalData, pendingImages.value);
      } else {
        if (finalData.pendingActions && finalData.pendingActions.length > 0) {
          for (const action of finalData.pendingActions) {
            if (action.type === 'schedule' && action.data) {
              todos.value.unshift(action.data);
            } else if (action.type === 'diary' && action.data) {
              if (pendingImages.value.length > 0) {
                action.data.images = pendingImages.value;
                action.data.image = pendingImages.value[0];
              }
              diaryEntries.value.unshift(action.data);
            }
          }
          syncData();
        }

        const lastMsg = messages.value[messages.value.length - 1];
        if (lastMsg && lastMsg.role === 'model' && thinkingSteps.value.length > 0) {
          lastMsg.thinkingSteps = [...thinkingSteps.value];
          lastMsg.showThinking = true;
        }
      }
    }
    
    isTyping.value = false;
    thinkingSteps.value = [];
    
    await loadDataFromServer();
  } catch (error) {
    console.error("AI Error:", error);
    let errorMessage = "嘎... 网络好像有点问题。";
    
    if (error.message && error.message !== 'No final data received' && error.message !== 'Failed to fetch' && !error.message.includes('fetch')) {
      errorMessage = "嘎... " + error.message;
    } else if (error.name === 'AbortError') {
      errorMessage = pendingImages.value.length > 0 ? "嘎... 图片太大了，服务器处理超时了。" : "嘎... 请求超时了，请稍后再试。";
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = "嘎... 无法连接到服务器，请检查网络设置。";
    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      errorMessage = "嘎... 网络连接失败，请稍后再试。";
    } else if (pendingImages.value.length > 0) {
      errorMessage = "嘎... 图片太大了，服务器处理不过来。";
    }
    messages.value.push({ role: 'model', text: errorMessage });
    isTyping.value = false;
    thinkingSteps.value = [];
  } finally {
    setTimeout(() => crowAction.value = 'idle', 2000);
  }
};

const handleCancelConfirmation = () => {
  needsConfirmation.value = false;
  confirmOptions.value = [];
  pendingConfirm.value = null;
};

// CRUD 确认：通过专用 API 直接执行，不走聊天 SSE 流程
const handleConfirmActionApi = async () => {
  const token = uni.getStorageSync('token');
  const sessionId = uni.getStorageSync('shiya_session_id');
  if (!token || !sessionId) {
    console.error('[确认API] 缺少 token 或 sessionId');
    return;
  }

  console.log('[确认API] 发送确认请求, sessionId:', sessionId);
  pendingConfirm.value = null; // 立即隐藏确认卡片

  uni.request({
    url: API_BASE_URL + '/confirm-action',
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    data: { sessionId },
    success: (res) => {
      console.log('[确认API] 响应:', res.data);
      if (res.data && res.data.success) {
        if (res.data.action === 'delete') {
          // 本地移除日程
          todos.value = todos.value.filter(t => String(t.id) !== String(res.data.targetId));
          console.log('[确认API] 本地删除成功，剩余日程:', todos.value.length);
        } else if (res.data.action === 'update' && res.data.todo) {
          // 本地更新日程
          const idx = todos.value.findIndex(t => String(t.id) === String(res.data.targetId));
          if (idx !== -1) {
            todos.value[idx] = { ...todos.value[idx], ...res.data.todo };
          }
          console.log('[确认API] 本地更新成功');
        } else if (res.data.action === 'batchDelete' && res.data.targetIds) {
          // 本地批量删除日程
          const idSet = new Set((res.data.targetIds || []).map(String));
          todos.value = todos.value.filter(t => !idSet.has(String(t.id)));
          console.log('[确认API] 本地批量删除成功，删除:', res.data.count, '项');
        }
        saveData();
        // 从服务器拉取最新数据做验证
        loadDataFromServer();
        // 追加简短的 AI 确认消息
        messages.value.push({ role: 'model', text: `✅ ${res.data.message}` });
      } else {
        console.error('[确认API] 失败:', res.data);
        messages.value.push({ role: 'model', text: `⚠️ 操作失败：${res.data?.message || '未知错误'}` });
      }
    },
    fail: (err) => {
      console.error('[确认API] 请求失败:', err);
      messages.value.push({ role: 'model', text: '⚠️ 网络异常，操作未完成，请稍后重试' });
    }
  });
};

// CRUD 取消：通过专用 API 取消待确认操作
const handleCancelActionApi = () => {
  const token = uni.getStorageSync('token');
  const sessionId = uni.getStorageSync('shiya_session_id');
  if (!token || !sessionId) {
    console.error('[取消API] 缺少 token 或 sessionId');
    pendingConfirm.value = null;
    return;
  }

  console.log('[取消API] 发送取消请求, sessionId:', sessionId);
  pendingConfirm.value = null; // 立即隐藏确认卡片

  uni.request({
    url: API_BASE_URL + '/cancel-action',
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    data: { sessionId },
    success: (res) => {
      console.log('[取消API] 响应:', res.data);
      messages.value.push({ role: 'model', text: '好的，已取消操作~' });
    },
    fail: (err) => {
      console.error('[取消API] 请求失败:', err);
    }
  });
};

const scrollChatToBottom = () => {
  nextTick(() => {
    const container = document.querySelector('.chat-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  });
};

const scrollChatToTop = () => {
  nextTick(() => {
    const container = document.querySelector('.chat-container');
    if (container) {
      container.scrollTop = 0;
    }
  });
};

// Header Functions
const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value;
};

const restoreDataFromServer = async () => {
  try {
    const token = uni.getStorageSync('token');
    if (!token) return;
    
    uni.request({
      url: API_BASE_URL + '/get-data',
      method: 'GET',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        if (res.data.success && res.data.data) {
          if (res.data.data.todos) {
            // 服务器为权威数据源，直接替换，不使用 mergeData（避免反弹已删数据）
            todos.value = res.data.data.todos;
          }
          if (res.data.data.diaryEntries) {
            diaryEntries.value = mergeData(diaryEntries.value, res.data.data.diaryEntries);
          }
          saveData();
          uni.showToast({ title: '数据已恢复', icon: 'success' });
        }
      }
    });
  } catch (e) {
    uni.showToast({ title: '恢复失败', icon: 'error' });
  }
  
  showUserMenu.value = false;
};

const handleLogout = () => {
  uni.clearStorageSync();
  uni.reLaunch({
    url: '/pages/login/login'
  });
};

// Settings Functions
const loadDeepseekKey = () => {
  try {
    const saved = uni.getStorageSync('deepseek_api_key');
    if (saved) {
      deepseekApiKey.value = saved;
    }
  } catch (e) { /* ignore */ }
};

const saveDeepseekKey = () => {
  const key = deepseekApiKey.value.trim();
  if (!key) {
    uni.showToast({ title: '请输入 API Key', icon: 'none' });
    return;
  }
  if (!key.startsWith('sk-')) {
    uni.showToast({ title: 'Key 格式可能不正确（通常以 sk- 开头）', icon: 'none' });
  }
  try {
    uni.setStorageSync('deepseek_api_key', key);
    uni.showToast({ title: 'API Key 已保存', icon: 'success' });
    showSettingsModal.value = false;
  } catch (e) {
    uni.showToast({ title: '保存失败，请重试', icon: 'error' });
  }
};

const clearDeepseekKey = () => {
  deepseekApiKey.value = '';
  try {
    uni.removeStorageSync('deepseek_api_key');
    uni.showToast({ title: 'API Key 已清除', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: '清除失败', icon: 'error' });
  }
};

// Tab Functions
const setActiveTab = (tab) => {
  activeTab.value = tab;
};

// Crow Message
const getCrowMessage = () => {
  if (isCrowFainted.value) {
    return '我需要食物...';
  }
  
  if (crowAction.value === 'happy') {
    return '我很开心嘎！';
  }
  
  if (crowAction.value === 'eat') {
    return '好吃！谢谢喂食！';
  }
  
  if (crowAction.value === 'sleep') {
    return '让我休息一下...';
  }
  
  if (foodCount.value === 0) {
    return '肚子饿了...';
  }
  
  const mood = crowStats.value.mood;
  if (mood < 30) {
    return '有点无聊...';
  } else if (mood < 60) {
    return '今天怎么样？';
  } else {
    const messages = [
      '今天想做什么呢？',
      '完成任务会让我开心的！',
      '记得经常来看我哦！',
      '有什么新鲜事吗？'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
};

// Lifecycle
const handleScroll = () => {
  if (typeof window !== 'undefined' && window.pageYOffset !== undefined) {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    isMainCrowVisible.value = scrollTop < 200;
  } else if (typeof uni !== 'undefined') {
    isMainCrowVisible.value = true;
  }
};

onMounted(() => {
  isMobile.value = uni.getSystemInfoSync().windowWidth < 768;
  
  loadData();
  loadDeepseekKey();
  initCourseSchedule();
  startServerSyncTimer();
  startCrowDecayTimer();
  
  dateCalendarDays.value = generateDateCalendar(
    dateCalendarYear.value,
    dateCalendarMonth.value,
    selectedDateValue.value,
    dateCalendarDays.value
  );
  
  scheduleDateCalendarDays.value = generateDateCalendar(
    scheduleDateCalendarYear.value,
    scheduleDateCalendarMonth.value,
    selectedScheduleDateValue.value,
    scheduleDateCalendarDays.value
  );
  
  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', handleScroll);
    handleScroll();
  }
});

watch([sittingOnId, isTimerRunning, crowAction], ([newSittingOnId, newIsTimerRunning, newCrowAction]) => {
  if (newSittingOnId && !newIsTimerRunning) {
    resetSleepTimer();
  } else if (!newSittingOnId || newIsTimerRunning) {
    if (sleepTimer) {
      clearTimeout(sleepTimer);
      sleepTimer = null;
    }
    if (newCrowAction === 'sleep') {
      crowAction.value = 'idle';
    }
  } else if (newCrowAction === 'alert') {
    resetSleepTimer();
  }
}, { deep: true });

watch(() => crowAction.value, (newAction) => {
  if (newAction === 'happy' || newAction === 'alert') {
    resetSleepTimer();
  }
});

// Bingo Functions
const openBingo = () => {
  isBingoMode.value = true;
};

const closeBingo = () => {
  isBingoMode.value = false;
};

const switchBingoMode = (mode) => {
  const prevMode = bingoMode.value;
  bingoMode.value = mode;
  
  if (mode === 'team') {
    initTeamBoard();
  }
  
  if (prevMode === 'team' && mode === 'single') {
    const youCompletedTasks = teamSelectedTasks.value.filter(
      card => card.isCompleted && card.claimedBy === '你'
    );
    
    youCompletedTasks.forEach(card => {
      const existingIndex = selectedTasks.value.findIndex(t => t.id === card.id);
      if (existingIndex !== -1) {
        selectedTasks.value[existingIndex].isCompleted = true;
        selectedTasks.value[existingIndex].isFlipped = true;
      }
    });
    
    if (youCompletedTasks.length > 0) {
      uni.showToast({ 
        title: `已同步 ${youCompletedTasks.length} 个任务`, 
        icon: 'success' 
      });
    }
  }
};

const createBingoTask = () => {
  setShowAddTask(true);
};

const handleBingoComplete = (task) => {
  console.log('[DDL联动] Bingo 单卡完成:', task.text || task.title)
  // 单卡完成时：如果是从 agent_tasks 加载的任务，更新对应日程
  if (task.id && typeof task.id === 'string' && task.id.startsWith('agent_')) {
    const match = task.id.match(/^agent_(\d+)$/)
    if (match) {
      const taskId = parseInt(match[1])
      const todo = todos.value.find(t => t.taskId === taskId)
      if (todo && !todo.completed) {
        todo.completed = true
        saveData()
        syncData()
        console.log('[DDL联动] Bingo单卡 → 日程已标记完成:', todo.title)
      }
    }
  }
  // DDL库任务完成：回写日程完成状态
  if (task.id && typeof task.id === 'string' && task.id.startsWith('ddl_')) {
    const originalId = task.id.replace('ddl_', '')
    // 本地标记
    const todo = todos.value.find(t => String(t.id) === originalId)
    if (todo && !todo.completed) {
      todo.completed = true
      saveData()
      syncData()
      console.log('[DDL库联动] Bingo单卡 → 日程已标记完成:', todo.text || todo.title)
    }
    // 通知服务器
    completeDDLTask(task.id).then(res => {
      console.log('[DDL库联动] 完成回写结果:', res)
    }).catch(e => {
      console.error('[DDL库联动] 回写失败:', e)
    })
  }
};

const handleCreateTeamTask = (taskData) => {
  console.log('创建小组任务:', taskData);
};

const resetTeamBoard = () => {
  uni.showToast({ title: '小组棋盘已重置', icon: 'none' });
};

onUnmounted(() => {
  stopServerSyncTimer();
  stopCrowDecayTimer();
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  if (sleepTimer) {
    clearTimeout(sleepTimer);
    sleepTimer = null;
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', handleScroll);
  }
});
</script>
