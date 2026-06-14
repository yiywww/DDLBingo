import { ref, computed } from 'vue';

const ZERO_EFFORT_TASKS = [
  { id: 'zero_hydrate', title: '喝水', estimatedMinutes: 2, difficulty: 'low', urgency: 1, description: '喝一杯水，补充水分' },
  { id: 'zero_walk', title: '起身走动', estimatedMinutes: 5, difficulty: 'low', urgency: 1, description: '站起来活动一下身体' },
  { id: 'zero_breathe', title: '深呼吸1分钟', estimatedMinutes: 1, difficulty: 'low', urgency: 1, description: '做几次深呼吸放松' },
  { id: 'zero_clean', title: '整理桌面', estimatedMinutes: 3, difficulty: 'low', urgency: 1, description: '整理一下工作区域' },
  { id: 'zero_stretch', title: '伸懒腰', estimatedMinutes: 2, difficulty: 'low', urgency: 1, description: '伸展一下身体' },
];

export function useBingoTaskMatcher() {
  const completedTaskIds = ref([]);
  const userAvailableMinutes = ref(0);
  const selectedTasks = ref([]);
  const usedTime = ref(0);

  const loadCompletedTasks = () => {
    try {
      const stored = uni.getStorageSync('bingoCompletedIds');
      if (stored) {
        completedTaskIds.value = JSON.parse(stored);
      }
    } catch (e) {
      completedTaskIds.value = [];
    }
  };

  const saveCompletedTasks = () => {
    try {
      uni.setStorageSync('bingoCompletedIds', JSON.stringify(completedTaskIds.value));
    } catch (e) {
      console.error('Failed to save completed tasks:', e);
    }
  };

  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const generateBingoTasks = (taskPool, availableMinutes) => {
    userAvailableMinutes.value = availableMinutes;
    usedTime.value = 0;

    loadCompletedTasks();

    let availableTasks = taskPool.filter(task => !completedTaskIds.value.includes(task.id));

    if (availableMinutes > 0) {
      availableTasks = availableTasks.filter(task => (task.estimatedMinutes || 5) <= availableMinutes);
    }

    const highUrgencyTasks = availableTasks.filter(t => t.urgency && t.urgency >= 7);
    const normalTasks = availableTasks.filter(t => !t.urgency || t.urgency < 7);

    const requiredHighUrgencyCount = Math.min(6, highUrgencyTasks.length);
    const requiredLowDifficultyCount = { min: 2, max: 4 };

    const result = [];

    const shuffledHighUrgency = shuffleArray(highUrgencyTasks);
    const shuffledNormal = shuffleArray(normalTasks);
    const shuffledZeroEffort = shuffleArray(ZERO_EFFORT_TASKS);

    let highUrgencyIndex = 0;
    let normalIndex = 0;
    let zeroEffortIndex = 0;

    for (let i = 0; i < 9; i++) {
      if (i < requiredHighUrgencyCount && highUrgencyIndex < shuffledHighUrgency.length) {
        const task = shuffledHighUrgency[highUrgencyIndex++];
        result.push({ ...task, uniqueId: `${task.id}_${Date.now()}_${i}` });
      } else if (normalIndex < shuffledNormal.length) {
        const task = shuffledNormal[normalIndex++];
        result.push({ ...task, uniqueId: `${task.id}_${Date.now()}_${i}` });
      } else {
        const task = ZERO_EFFORT_TASKS[i % ZERO_EFFORT_TASKS.length];
        result.push({ ...task, uniqueId: `${task.id}_${Date.now()}_${i}_reuse_${Math.floor(i / ZERO_EFFORT_TASKS.length)}` });
      }
    }

    let lowDifficultyCount = result.filter(t => t.difficulty === 'low').length;
    
    while (lowDifficultyCount < requiredLowDifficultyCount.min) {
      const nonLowTasks = result
        .map((task, idx) => ({ task, idx }))
        .filter(({ task }) => task.difficulty !== 'low');
      
      if (nonLowTasks.length === 0) break;
      
      const { idx } = nonLowTasks[Math.floor(Math.random() * nonLowTasks.length)];
      
      if (zeroEffortIndex < shuffledZeroEffort.length) {
        const replacement = shuffledZeroEffort[zeroEffortIndex++];
        result[idx] = { ...replacement, uniqueId: `${replacement.id}_${Date.now()}_replace_${idx}` };
        lowDifficultyCount++;
      } else if (zeroEffortIndex < ZERO_EFFORT_TASKS.length) {
        const replacement = ZERO_EFFORT_TASKS[zeroEffortIndex++];
        result[idx] = { ...replacement, uniqueId: `${replacement.id}_${Date.now()}_replace_${idx}` };
        lowDifficultyCount++;
      } else {
        break;
      }
    }

    while (lowDifficultyCount > requiredLowDifficultyCount.max) {
      const lowTasks = result
        .map((task, idx) => ({ task, idx }))
        .filter(({ task }) => task.difficulty === 'low' && !ZERO_EFFORT_TASKS.some(z => z.id === task.id));
      
      if (lowTasks.length === 0) break;
      
      const { idx } = lowTasks[Math.floor(Math.random() * lowTasks.length)];
      
      if (normalIndex < shuffledNormal.length) {
        const replacement = shuffledNormal[normalIndex++];
        result[idx] = { ...replacement, uniqueId: `${replacement.id}_${Date.now()}_swap_${idx}` };
        lowDifficultyCount--;
      } else if (highUrgencyIndex < shuffledHighUrgency.length) {
        const replacement = shuffledHighUrgency[highUrgencyIndex++];
        result[idx] = { ...replacement, uniqueId: `${replacement.id}_${Date.now()}_swap_${idx}` };
        lowDifficultyCount--;
      } else {
        break;
      }
    }

    const finalShuffled = shuffleArray(result);
    selectedTasks.value = finalShuffled.map((task, index) => ({
      ...task,
      uniqueId: `${task.id}_${Date.now()}_${index}`,
      position: index,
      isFlipped: false,
      isCompleted: false,
      isClaimed: false,
      claimedBy: null,
      startTime: null,
      elapsedSeconds: 0
    }));

    return selectedTasks.value;
  };

  const canFlipCard = (cardIndex) => {
    const card = selectedTasks.value[cardIndex];
    if (!card || card.isFlipped || card.isCompleted) return false;
    
    if (userAvailableMinutes.value <= 0) return true;
    
    const currentUsed = usedTime.value;
    const taskTime = card.estimatedMinutes || 5;
    
    return currentUsed + taskTime <= userAvailableMinutes.value;
  };

  const flipCard = (cardIndex) => {
    if (!canFlipCard(cardIndex)) {
      return { success: false, message: '超过可用时间限制，无法翻开此任务' };
    }
    
    const card = selectedTasks.value[cardIndex];
    if (!card || card.isFlipped) {
      return { success: false, message: '卡片已翻开或不存在' };
    }
    
    card.isFlipped = true;
    
    if (userAvailableMinutes.value > 0) {
      usedTime.value += card.estimatedMinutes || 5;
    }
    
    return { success: true, message: '翻开成功', task: card };
  };

  const completeTask = (cardIndex) => {
    const card = selectedTasks.value[cardIndex];
    if (!card || !card.isFlipped || card.isCompleted) {
      return { success: false, message: '任务未翻开或已完成' };
    }
    
    card.isCompleted = true;
    
    if (!completedTaskIds.value.includes(card.id)) {
      completedTaskIds.value.push(card.id);
      saveCompletedTasks();
    }
    
    return { success: true, message: '任务完成', task: card };
  };

  const claimTask = (cardIndex, member) => {
    const card = selectedTasks.value[cardIndex];
    if (!card || !card.isFlipped || card.isCompleted || card.isClaimed) {
      return { success: false, message: '无法领取此任务' };
    }
    
    card.isClaimed = true;
    card.claimedBy = member.name;
    card.claimedByColor = member.color;
    card.claimedByBgColor = member.bgColor;
    
    return { success: true, message: `${member.name} 已领取任务`, task: card };
  };

  const resetBoard = () => {
    selectedTasks.value = [];
    usedTime.value = 0;
  };

  const refreshBoard = (taskPool, availableMinutes = 0) => {
    userAvailableMinutes.value = availableMinutes;
    
    const completedCards = selectedTasks.value.filter(card => card.isCompleted);
    const completedIds = completedCards.map(c => c.id);
    
    let availableTasks = taskPool.filter(task => !completedTaskIds.value.includes(task.id) && !completedIds.includes(task.id));
    
    if (availableMinutes > 0) {
      availableTasks = availableTasks.filter(task => (task.estimatedMinutes || 5) <= availableMinutes);
    }
    
    const highUrgencyTasks = availableTasks.filter(t => t.urgency && t.urgency >= 7);
    const normalTasks = availableTasks.filter(t => !t.urgency || t.urgency < 7);
    
    const neededCount = 9 - completedCards.length;
    
    const newCards = [];
    
    const shuffledHighUrgency = shuffleArray(highUrgencyTasks);
    const shuffledNormal = shuffleArray(normalTasks);
    
    let highUrgencyIndex = 0;
    let normalIndex = 0;
    
    for (let i = 0; i < neededCount; i++) {
      if (highUrgencyIndex < shuffledHighUrgency.length && i < Math.ceil(neededCount * 0.7)) {
        const task = shuffledHighUrgency[highUrgencyIndex++];
        newCards.push({
          ...task,
          uniqueId: `${task.id}_${Date.now()}_${i}`,
          position: i,
          isFlipped: false,
          isCompleted: false,
          isClaimed: false,
          claimedBy: null,
          startTime: null,
          elapsedSeconds: 0
        });
      } else if (normalIndex < shuffledNormal.length) {
        const task = shuffledNormal[normalIndex++];
        newCards.push({
          ...task,
          uniqueId: `${task.id}_${Date.now()}_${i}`,
          position: i,
          isFlipped: false,
          isCompleted: false,
          isClaimed: false,
          claimedBy: null,
          startTime: null,
          elapsedSeconds: 0
        });
      } else {
        const task = ZERO_EFFORT_TASKS[i % ZERO_EFFORT_TASKS.length];
        newCards.push({
          ...task,
          uniqueId: `${task.id}_${Date.now()}_${i}_reuse_${Math.floor(i / ZERO_EFFORT_TASKS.length)}`,
          position: i,
          isFlipped: false,
          isCompleted: false,
          isClaimed: false,
          claimedBy: null,
          startTime: null,
          elapsedSeconds: 0
        });
      }
    }
    
    const shuffledNewCards = shuffleArray(newCards);
    
    const result = new Array(9);
    
    completedCards.forEach(card => {
      result[card.position] = { ...card };
    });
    
    let newCardIndex = 0;
    for (let i = 0; i < 9; i++) {
      if (!result[i]) {
        result[i] = { ...shuffledNewCards[newCardIndex++], position: i };
      }
    }
    
    selectedTasks.value = result;
    
    return selectedTasks.value;
  };

  const checkBingoComplete = () => {
    return selectedTasks.value.every(card => card.isCompleted);
  };

  const getStatistics = computed(() => {
    const total = selectedTasks.value.length;
    const completed = selectedTasks.value.filter(c => c.isCompleted).length;
    const flipped = selectedTasks.value.filter(c => c.isFlipped).length;
    const claimed = selectedTasks.value.filter(c => c.isClaimed).length;
    
    const urgencyStats = {
      high: selectedTasks.value.filter(t => t.urgency && t.urgency >= 7).length,
      normal: selectedTasks.value.filter(t => !t.urgency || t.urgency < 7).length
    };
    
    const difficultyStats = {
      low: selectedTasks.value.filter(t => t.difficulty === 'low').length,
      mid: selectedTasks.value.filter(t => t.difficulty === 'mid').length,
      high: selectedTasks.value.filter(t => t.difficulty === 'high').length
    };
    
    return {
      total,
      completed,
      flipped,
      claimed,
      urgencyStats,
      difficultyStats,
      usedTime: usedTime.value,
      remainingTime: Math.max(0, userAvailableMinutes.value - usedTime.value)
    };
  });

  return {
    selectedTasks,
    completedTaskIds,
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
    loadCompletedTasks,
    saveCompletedTasks
  };
}
