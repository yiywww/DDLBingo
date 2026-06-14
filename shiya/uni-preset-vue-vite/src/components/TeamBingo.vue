<template>
  <view class="team-bingo-container">
    <view class="team-header">
      <text class="team-title">👥 小组协作</text>
      <text class="team-subtitle">与队友一起完成挑战！</text>
    </view>

    <view class="member-selector">
      <text class="selector-label">当前模拟成员</text>
      <view class="members-list">
        <view 
          v-for="member in members" 
          :key="member.id"
          class="member-item"
          :class="{ active: currentMember.id === member.id }"
          @click="selectMember(member)"
        >
          <view class="member-avatar">{{ member.avatar }}</view>
          <text class="member-name">{{ member.name }}</text>
        </view>
      </view>
    </view>

    <view class="invite-section">
      <view class="invite-card">
        <view class="invite-info">
          <text class="invite-title">邀请链接</text>
          <view class="link-box">
            <text class="link-text">{{ inviteLink }}</text>
            <view class="copy-btn" @click="copyLink">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </view>
          </view>
        </view>
        <view class="invite-actions">
          <view class="invite-btn qq" @click="shareToQQGroup">
            <text>分享到QQ群</text>
          </view>
        </view>
      </view>
    </view>

    <view class="team-board-header">
      <text class="board-title">🎯 共享棋盘</text>
      <view class="team-progress">
        <text class="progress-text">{{ completedCount }} / 9</text>
      </view>
    </view>

    <view class="team-grid">
      <view 
        v-for="(card, index) in cards" 
        :key="index" 
        class="team-grid-item"
      >
        <view 
          class="team-card"
          :class="{
            'claimed': card.claimedBy,
            'completed': card.isCompleted,
            'unclaimed': !card.claimedBy && !card.isCompleted,
            'current-member': card.claimedBy === currentMember.id
          }"
          @click="handleCardClick(index)"
        >
          <view v-if="card.isCompleted" class="card-completed">
            <view class="check-icon">✓</view>
            <text class="completed-by">{{ getMemberName(card.claimedBy) }} 已完成</text>
          </view>
          <view v-else-if="card.claimedBy" class="card-claimed">
            <view class="claimed-avatar">{{ getMemberAvatar(card.claimedBy) }}</view>
            <text class="claimed-text">{{ getMemberName(card.claimedBy) }} 领取中</text>
            <text class="claimed-task">{{ card.task?.text }}</text>
          </view>
          <view v-else class="card-unclaimed">
            <text class="unclaimed-icon">?</text>
            <text class="unclaimed-text">点击领取</text>
          </view>
        </view>
      </view>
    </view>

    <view class="team-actions">
      <view class="action-btn secondary" @click="createTeamTask">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        <text>创建小组任务</text>
      </view>
      <view class="action-btn primary" @click="resetTeamBoard">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
        <text>重置棋盘</text>
      </view>
    </view>

    <view v-if="showCreateTaskModal" class="modal-overlay" @click="closeCreateTaskModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">创建小组任务</text>
          <view class="modal-close" @click="closeCreateTaskModal">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </view>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <text class="form-label">总任务描述</text>
            <textarea 
              v-model="newTeamTask.description" 
              placeholder="输入小组需要完成的总任务..."
              class="form-textarea"
            ></textarea>
          </view>
          <view class="form-item">
            <text class="form-label">截止时间</text>
            <view class="date-picker" @click="pickDeadline">
              <text>{{ newTeamTask.deadline || '选择截止日期' }}</text>
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <view class="modal-btn cancel" @click="closeCreateTaskModal">取消</view>
          <view class="modal-btn confirm" @click="submitTeamTask">创建任务</view>
        </view>
      </view>
    </view>

    <TeamAchievementPoster 
      v-if="showTeamPoster"
      :members="members"
      :completedTasks="completedTasks"
      @close="showTeamPoster = false"
    />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import TeamAchievementPoster from './TeamAchievementPoster.vue';

const props = defineProps({
  taskPool: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['createTask', 'reset']);

const members = ref([
  { id: 'member_a', name: '成员A', avatar: 'A', color: '#3b82f6' },
  { id: 'member_b', name: '成员B', avatar: 'B', color: '#10b981' },
  { id: 'member_c', name: '成员C', avatar: 'C', color: '#f59e0b' },
  { id: 'member_d', name: '成员D', avatar: 'D', color: '#ef4444' }
]);

const currentMember = ref(members.value[0]);
const cards = ref([]);
const inviteLink = ref('https://shiya.crow/team/abc123');
const showCreateTaskModal = ref(false);
const showTeamPoster = ref(false);

const newTeamTask = ref({
  description: '',
  deadline: ''
});

const teamTasks = [
  { id: 'team_1', text: '需求分析文档', description: '撰写宠物健康管理系统需求规格说明书', estimatedTime: 60, difficulty: 'high', priority: 'high' },
  { id: 'team_2', text: '数据库设计', description: '设计宠物信息、健康记录等数据表结构', estimatedTime: 45, difficulty: 'high', priority: 'high' },
  { id: 'team_3', text: 'API接口设计', description: '设计前后端交互的RESTful API接口', estimatedTime: 40, difficulty: 'mid', priority: 'high' },
  { id: 'team_4', text: '前端首页开发', description: '实现系统首页和宠物列表展示', estimatedTime: 50, difficulty: 'mid', priority: 'medium' },
  { id: 'team_5', text: '用户认证模块', description: '实现登录、注册、权限验证功能', estimatedTime: 35, difficulty: 'high', priority: 'high' },
  { id: 'team_6', text: '宠物档案管理', description: '开发宠物信息录入和管理功能', estimatedTime: 30, difficulty: 'mid', priority: 'medium' },
  { id: 'team_7', text: '健康记录模块', description: '实现宠物健康检查记录功能', estimatedTime: 35, difficulty: 'mid', priority: 'medium' },
  { id: 'team_8', text: '疫苗提醒功能', description: '开发疫苗接种时间提醒功能', estimatedTime: 25, difficulty: 'low', priority: 'low' },
  { id: 'team_9', text: '前端UI优化', description: '优化页面样式和交互体验', estimatedTime: 30, difficulty: 'low', priority: 'low' },
  { id: 'team_10', text: '后端接口开发', description: '实现核心业务逻辑的API接口', estimatedTime: 55, difficulty: 'high', priority: 'high' },
  { id: 'team_11', text: '单元测试编写', description: '编写后端接口的单元测试用例', estimatedTime: 40, difficulty: 'mid', priority: 'medium' },
  { id: 'team_12', text: '项目部署文档', description: '编写系统部署和运维说明文档', estimatedTime: 25, difficulty: 'low', priority: 'low' },
];

const zeroEffortTasks = [
  { id: 'zero_1', text: '喝杯水', description: '保持身体水分充足', estimatedTime: 1, difficulty: 'easy', priority: 'low' },
  { id: 'zero_2', text: '起身活动', description: '站起来拉伸一下', estimatedTime: 2, difficulty: 'easy', priority: 'low' },
  { id: 'zero_3', text: '吃补剂', description: '记得补充维生素', estimatedTime: 1, difficulty: 'easy', priority: 'low' },
  { id: 'zero_4', text: '冥想', description: '深呼吸放松身心', estimatedTime: 3, difficulty: 'easy', priority: 'low' },
];

const completedCount = computed(() => {
  return cards.value.filter(c => c.isCompleted).length;
});

const completedTasks = computed(() => {
  return cards.value
    .filter(c => c.isCompleted && c.task)
    .map(c => ({ ...c.task, completedBy: c.claimedBy }));
});

const generateBoard = () => {
  const availableTasks = [...teamTasks];
  const selectedTasks = [];
  
  for (let i = 0; i < 9; i++) {
    if (availableTasks.length > 0 && Math.random() > 0.2) {
      const idx = Math.floor(Math.random() * availableTasks.length);
      selectedTasks.push(availableTasks.splice(idx, 1)[0]);
    } else {
      const idx = Math.floor(Math.random() * zeroEffortTasks.length);
      const zeroTask = { ...zeroEffortTasks[idx] };
      zeroTask.id = `${zeroTask.id}_${Date.now()}_${i}`;
      selectedTasks.push(zeroTask);
    }
  }
  
  cards.value = selectedTasks.map(task => ({
    task,
    claimedBy: null,
    isCompleted: false
  }));
};

const selectMember = (member) => {
  currentMember.value = member;
};

const handleCardClick = (index) => {
  const card = cards.value[index];
  
  if (card.isCompleted) {
    return;
  }
  
  if (!card.claimedBy) {
    card.claimedBy = currentMember.value.id;
    uni.showToast({ 
      title: `${currentMember.value.name} 已领取任务`, 
      icon: 'none' 
    });
  } else if (card.claimedBy === currentMember.value.id) {
    completeCard(index);
  }
};

const completeCard = (index) => {
  const card = cards.value[index];
  if (card.claimedBy === currentMember.value.id) {
    card.isCompleted = true;
    
    if (completedCount.value >= 9) {
      setTimeout(() => {
        showTeamPoster.value = true;
      }, 500);
    }
  }
};

const copyLink = () => {
  uni.setClipboardData({
    data: inviteLink.value,
    success: () => {
      uni.showToast({ title: '链接已复制', icon: 'success' });
    }
  });
};

const shareToQQGroup = () => {
  uni.showToast({ 
    title: '模拟分享到QQ群', 
    icon: 'none',
    duration: 2000
  });
  console.log('真实环境需调用腾讯开放平台分享接口');
};

const createTeamTask = () => {
  showCreateTaskModal.value = true;
};

const closeCreateTaskModal = () => {
  showCreateTaskModal.value = false;
  newTeamTask.value = { description: '', deadline: '' };
};

const pickDeadline = () => {
  const now = new Date();
  const deadline = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate() + 7).padStart(2, '0')}`;
  newTeamTask.value.deadline = deadline;
};

const submitTeamTask = () => {
  if (!newTeamTask.value.description) {
    uni.showToast({ title: '请输入任务描述', icon: 'none' });
    return;
  }
  
  emit('createTask', newTeamTask.value);
  closeCreateTaskModal();
  generateBoard();
  
  uni.showToast({ title: '小组任务已创建', icon: 'success' });
};

const resetTeamBoard = () => {
  cards.value = [];
  generateBoard();
  emit('reset');
};

const getMemberName = (memberId) => {
  const member = members.value.find(m => m.id === memberId);
  return member ? member.name : '未知';
};

const getMemberAvatar = (memberId) => {
  const member = members.value.find(m => m.id === memberId);
  return member ? member.avatar : '?';
};

generateBoard();
</script>

<style scoped>
.team-bingo-container {
  width: 100%;
  max-width: 600rpx;
  margin: 0 auto;
  padding: 20rpx;
}

.team-header {
  margin-bottom: 30rpx;
}

.team-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #1f2937;
  display: block;
}

.team-subtitle {
  font-size: 24rpx;
  color: #6b7280;
  display: block;
  margin-top: 8rpx;
}

.member-selector {
  margin-bottom: 30rpx;
}

.selector-label {
  font-size: 24rpx;
  color: #6b7280;
  display: block;
  margin-bottom: 16rpx;
}

.members-list {
  display: flex;
  gap: 16rpx;
}

.member-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 16rpx;
  background: #f3f4f6;
  border-radius: 16rpx;
  transition: all 0.3s;
}

.member-item.active {
  background: #5a5a40;
}

.member-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: bold;
  color: #374151;
}

.member-item.active .member-avatar {
  background: #fff;
  color: #5a5a40;
}

.member-name {
  font-size: 22rpx;
  color: #6b7280;
}

.member-item.active .member-name {
  color: #fff;
}

.invite-section {
  margin-bottom: 30rpx;
}

.invite-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.invite-info {
  margin-bottom: 20rpx;
}

.invite-title {
  font-size: 24rpx;
  color: #6b7280;
  display: block;
  margin-bottom: 12rpx;
}

.link-box {
  display: flex;
  align-items: center;
  gap: 12rpx;
  background: #f3f4f6;
  padding: 16rpx;
  border-radius: 12rpx;
}

.link-text {
  flex: 1;
  font-size: 22rpx;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-btn {
  width: 48rpx;
  height: 48rpx;
  background: #5a5a40;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.invite-actions {
  display: flex;
}

.invite-btn {
  flex: 1;
  padding: 20rpx;
  border-radius: 16rpx;
  text-align: center;
  font-size: 26rpx;
  font-weight: bold;
}

.invite-btn.qq {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #fff;
}

.team-board-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.board-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #1f2937;
}

.team-progress {
  background: #f3f4f6;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
}

.progress-text {
  font-size: 24rpx;
  font-weight: bold;
  color: #5a5a40;
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-bottom: 30rpx;
}

.team-grid-item {
  aspect-ratio: 1;
}

.team-card {
  width: 100%;
  height: 100%;
  border-radius: 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16rpx;
  box-sizing: border-box;
  transition: all 0.3s;
}

.team-card.unclaimed {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  cursor: pointer;
}

.team-card.claimed {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.team-card.completed {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
}

.team-card.current-member {
  border: 4rpx solid #fff;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.2);
}

.unclaimed-icon {
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 8rpx;
}

.unclaimed-text {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.9);
}

.claimed-avatar {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 8rpx;
}

.claimed-text {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
}

.claimed-task {
  font-size: 18rpx;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  margin-top: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.check-icon {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #fff;
  margin-bottom: 8rpx;
}

.completed-by {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
}

.team-actions {
  display: flex;
  gap: 20rpx;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  font-size: 28rpx;
  font-weight: bold;
  transition: all 0.3s;
}

.action-btn:active {
  transform: scale(0.95);
}

.action-btn.primary {
  background: linear-gradient(135deg, #5a5a40 0%, #3d3d30 100%);
  color: #fff;
}

.action-btn.secondary {
  background: #f3f4f6;
  color: #5a5a40;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 40rpx;
}

.modal-content {
  width: 100%;
  max-width: 600rpx;
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid #e5e7eb;
}

.modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #1f2937;
}

.modal-close {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.modal-body {
  padding: 24rpx;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-label {
  font-size: 24rpx;
  color: #6b7280;
  display: block;
  margin-bottom: 12rpx;
}

.form-textarea {
  width: 100%;
  min-height: 120rpx;
  padding: 16rpx;
  background: #f9fafb;
  border-radius: 16rpx;
  font-size: 28rpx;
  border: 1rpx solid #e5e7eb;
}

.date-picker {
  padding: 20rpx;
  background: #f9fafb;
  border-radius: 16rpx;
  border: 1rpx solid #e5e7eb;
  text-align: center;
  font-size: 28rpx;
  color: #374151;
}

.modal-footer {
  display: flex;
  gap: 20rpx;
  padding: 24rpx;
  border-top: 1rpx solid #e5e7eb;
}

.modal-btn {
  flex: 1;
  padding: 20rpx;
  border-radius: 16rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: bold;
}

.modal-btn.cancel {
  background: #f3f4f6;
  color: #6b7280;
}

.modal-btn.confirm {
  background: #5a5a40;
  color: #fff;
}
</style>