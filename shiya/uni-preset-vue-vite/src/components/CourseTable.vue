<template>
  <view class="space-y-4">
    <view class="flex flex-col gap-4 mb-6">
      <view class="flex items-center justify-between">
        <view class="text-2xl font-serif italic text-primary">
          课程表
        </view>
        <view class="flex gap-2">
          <button 
            @click="showImportModal = true"
            class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-2xl hover:bg-[#4a4a35] transition-all shadow-sm"
          >
            导入
          </button>
          <button 
            @click="openAddCourseModal()"
            class="px-4 py-2 bg-white border border-border text-[#5a5a40] text-sm font-medium rounded-2xl hover:bg-surface transition-all shadow-sm"
          >
            添加课程
          </button>
        </view>
      </view>
      
      <view class="flex flex-col gap-4">
        <view class="flex items-center gap-2">
          <text class="text-sm text-muted">学期开始:</text>
          <input
            v-model="courseSchedule.semesterSettings.startDate"
            type="date"
            class="px-3 py-1 border border-border rounded-lg text-sm"
            @change="updateCurrentWeek"
            @confirm="updateCurrentWeek"
          />
        </view>
        <view class="flex items-center gap-4">
          <text class="text-sm text-muted">当前周:</text>
          <input 
            v-model.number="courseSchedule.semesterSettings.currentWeek"
            type="number"
            min="1"
            max="20"
            class="px-3 py-1 border border-border rounded-lg text-sm w-16"
          />
          <view class="flex gap-2">
            <button 
              @click="prevWeek"
              class="px-3 py-1 bg-white border border-border rounded-lg text-sm hover:bg-surface transition-all"
            >
              上一周
            </button>
            <button 
              @click="nextWeek"
              class="px-3 py-1 bg-white border border-border rounded-lg text-sm hover:bg-surface transition-all"
            >
              下一周
            </button>
            <button 
              @click="resetToCurrentWeek"
              class="px-3 py-1 bg-primary text-white rounded-lg text-sm hover:bg-[#4a4a35] transition-all"
            >
              当前周
            </button>
            <button
              @click="clearAllCourses"
              class="px-3 py-1 bg-red-50 border border-red-200 text-red-500 rounded-lg text-sm hover:bg-red-100 transition-all"
            >
              清空课表
            </button>
          </view>
        </view>
      </view>
    </view>
    
    <view class="flex gap-2 mb-4">
      <button 
        @click="courseView = 'week'"
        :class="courseView === 'week' ? 'bg-primary text-white' : 'bg-white border border-border text-[#5a5a40]'"
        class="px-4 py-2 text-sm font-medium rounded-2xl hover:bg-surface transition-all"
      >
        周视图
      </button>
      <button 
        @click="courseView = 'day'"
        :class="courseView === 'day' ? 'bg-primary text-white' : 'bg-white border border-border text-[#5a5a40]'"
        class="px-4 py-2 text-sm font-medium rounded-2xl hover:bg-surface transition-all"
      >
        日视图
      </button>
      <button 
        @click="showTimeSettings = true"
        class="px-4 py-2 bg-white border border-border text-[#5a5a40] text-sm font-medium rounded-2xl hover:bg-surface transition-all"
      >
        时间设置
      </button>
    </view>
    
    <view v-if="courseView === 'week'" class="border border-border rounded-2xl overflow-hidden">
      <div class="grid grid-cols-8 bg-surface border-b border-border">
        <div class="p-2 text-center text-sm font-medium border-r border-border">时间</div>
        <div class="p-2 text-center text-sm font-medium border-r border-border">周一</div>
        <div class="p-2 text-center text-sm font-medium border-r border-border">周二</div>
        <div class="p-2 text-center text-sm font-medium border-r border-border">周三</div>
        <div class="p-2 text-center text-sm font-medium border-r border-border">周四</div>
        <div class="p-2 text-center text-sm font-medium border-r border-border">周五</div>
        <div class="p-2 text-center text-sm font-medium border-r border-border">周六</div>
        <div class="p-2 text-center text-sm font-medium">周日</div>
      </div>
      
      <div v-for="section in 12" :key="section" class="grid grid-cols-8 border-b border-border last:border-b-0">
        <div class="p-2 text-center text-xs text-muted border-r border-border bg-surface">
          {{ section }}<br>
          {{ courseSchedule.timeSettings[section-1]?.startTime }}<br>
          {{ courseSchedule.timeSettings[section-1]?.endTime }}
        </div>
        <div v-for="day in 7" :key="day" class="p-1 border-r border-border last:border-r-0">
          <div 
            v-for="course in getCoursesForSection(day, section)" 
            :key="course.id"
            :style="{ backgroundColor: course.color + '20', borderLeft: `4px solid ${course.color}` }"
            class="p-2 rounded-lg mb-1 text-xs cursor-pointer hover:shadow-md transition-all"
            @click="editCourse(course)"
          >
            <div class="font-medium">{{ course.courseName }}</div>
            <div class="text-[10px] text-muted">{{ course.teacher }}</div>
            <div class="text-[10px] text-muted">{{ course.location }}</div>
          </div>
          <div 
            v-if="getCoursesForSection(day, section).length === 0"
            @click="addCourseAt(day, section)"
            class="p-2 rounded-lg mb-1 text-xs text-muted border border-dashed border-gray-300 hover:bg-gray-50 cursor-pointer transition-all"
          >
            + 添加课程
          </div>
        </div>
      </div>
    </view>
    
    <view v-if="courseView === 'day'" class="border border-border rounded-2xl overflow-hidden">
      <div class="p-4 bg-surface border-b border-border">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h3 class="text-lg font-semibold">{{ selectedCourseDay }}</h3>
            <text class="text-sm text-muted">{{ selectedCourseDate }}</text>
          </div>
          <div class="flex gap-2">
            <button 
              @click="showCourseDatePicker = true"
              class="p-2 hover:bg-background rounded-full"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </button>
            <button @click="prevCourseDay" class="p-2 hover:bg-background rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button @click="nextCourseDay" class="p-2 hover:bg-background rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div class="p-4">
        <div v-for="section in 12" :key="section" class="mb-4">
          <div class="flex items-center gap-4 mb-2">
            <div class="w-20 text-sm text-muted">
              {{ section }}. {{ courseSchedule.timeSettings[section-1]?.startTime }} - {{ courseSchedule.timeSettings[section-1]?.endTime }}
            </div>
            <div class="flex-1">
              <div 
                v-for="course in getCoursesForDayAndSection(selectedCourseDayIndex, section)" 
                :key="course.id"
                :style="{ backgroundColor: course.color + '20', borderLeft: `4px solid ${course.color}` }"
                class="p-3 rounded-lg text-sm cursor-pointer hover:shadow-md transition-all"
                @click="editCourse(course)"
              >
                <div class="font-medium">{{ course.courseName }}</div>
                <div class="text-xs text-muted flex gap-4">
                  <span>{{ course.teacher }}</span>
                  <span>{{ course.location }}</span>
                </div>
              </div>
              <div 
                v-if="getCoursesForDayAndSection(selectedCourseDayIndex, section).length === 0"
                @click="addCourseAt(selectedCourseDayIndex, section)"
                class="p-3 rounded-lg text-sm text-muted border border-dashed border-gray-300 hover:bg-gray-50 cursor-pointer transition-all"
              >
                + 添加课程
              </div>
            </div>
          </div>
        </div>
      </div>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import * as XLSX from 'xlsx';

const props = defineProps({
  courseSchedule: {
    type: Object,
    required: true
  }
});

const emit = defineEmits([
  'update:courseSchedule',
  'addCourse',
  'editCourse',
  'deleteCourse',
  'saveCourseSchedule'
]);

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
  const startDate = props.courseSchedule.semesterSettings.startDate;
  if (!startDate) return 1;

  const start = new Date(startDate);
  const current = new Date(dateStr);

  const diffMs = current - start;
  const weekNum = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));

  return Math.max(1, weekNum);
};

const getCoursesForSection = (day, section) => {
  const currentWeek = props.courseSchedule.semesterSettings.currentWeek;
  return props.courseSchedule.courses.filter(course => {
    if (course.dayOfWeek !== day) return false;
    if (section < course.startSection || section > course.endSection) return false;
    if (!isCourseInWeek(course, currentWeek)) return false;
    return true;
  });
};

const getCoursesForDayAndSection = (day, section) => {
  const selectedWeek = getWeekForDate(selectedCourseDate.value);
  return props.courseSchedule.courses.filter(course => {
    if (course.dayOfWeek !== day) return false;
    if (section < course.startSection || section > course.endSection) return false;
    if (!isCourseInWeek(course, selectedWeek)) return false;
    return true;
  });
};

const handleImport = () => {
  showImportModal.value = false;
  if (importType.value === 'manual') {
    openAddCourseModal();
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
          const newSchedule = { ...props.courseSchedule };
          newSchedule.courses = [...newSchedule.courses, ...courses];
          emit('update:courseSchedule', newSchedule);
          emit('saveCourseSchedule');
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

const openAddCourseModal = () => {
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
  showAddCourseModal.value = true;
};

const addCourse = () => {
  if (newCourse.value.id) {
    const index = props.courseSchedule.courses.findIndex(c => c.id === newCourse.value.id);
    if (index !== -1) {
      const newSchedule = { ...props.courseSchedule };
      newSchedule.courses[index] = { ...newCourse.value };
      emit('update:courseSchedule', newSchedule);
    }
  } else {
    const course = {
      ...newCourse.value,
      id: 'course_' + Date.now()
    };
    const newSchedule = { ...props.courseSchedule };
    newSchedule.courses.push(course);
    emit('update:courseSchedule', newSchedule);
  }
  emit('saveCourseSchedule');
  showAddCourseModal.value = false;
  resetNewCourseForm();
};

const deleteCourse = () => {
  if (newCourse.value.id) {
    const newSchedule = { ...props.courseSchedule };
    newSchedule.courses = newSchedule.courses.filter(course => course.id !== newCourse.value.id);
    emit('update:courseSchedule', newSchedule);
    emit('saveCourseSchedule');
    showAddCourseModal.value = false;
    resetNewCourseForm();
  }
};

const editCourse = (course) => {
  newCourse.value = {
    id: course.id,
    courseName: course.courseName,
    teacher: course.teacher,
    location: course.location,
    dayOfWeek: course.dayOfWeek,
    startSection: course.startSection,
    endSection: course.endSection,
    weeks: course.weeks || '1-16',
    color: course.color,
    credit: course.credit || 0,
    courseType: course.courseType || '必修'
  };
  showAddCourseModal.value = true;
};

const addCourseAt = (day, section) => {
  newCourse.value = {
    id: '',
    courseName: '',
    teacher: '',
    location: '',
    dayOfWeek: day,
    startSection: section,
    endSection: section,
    weeks: '1-16',
    color: '#4299e1',
    credit: 0,
    courseType: '必修'
  };
  showAddCourseModal.value = true;
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
  emit('saveCourseSchedule');
  showTimeSettings.value = false;
};

const updateCurrentWeek = () => {
  const startDate = props.courseSchedule.semesterSettings.startDate;
  if (!startDate) return;
  
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now - start;
  const weekNum = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
  
  const newSchedule = { ...props.courseSchedule };
  newSchedule.semesterSettings.currentWeek = Math.max(1, weekNum);
  emit('update:courseSchedule', newSchedule);
  emit('saveCourseSchedule');
};

const prevWeek = () => {
  if (props.courseSchedule.semesterSettings.currentWeek > 1) {
    const newSchedule = { ...props.courseSchedule };
    newSchedule.semesterSettings.currentWeek--;
    emit('update:courseSchedule', newSchedule);
    emit('saveCourseSchedule');
  }
};

const nextWeek = () => {
  if (props.courseSchedule.semesterSettings.currentWeek < 20) {
    const newSchedule = { ...props.courseSchedule };
    newSchedule.semesterSettings.currentWeek++;
    emit('update:courseSchedule', newSchedule);
    emit('saveCourseSchedule');
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
        const newSchedule = { ...props.courseSchedule };
        newSchedule.courses = [];
        emit('update:courseSchedule', newSchedule);
        emit('saveCourseSchedule');
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

generateCourseDateCalendar();
updateSelectedCourseDay();

defineExpose({
  showAddCourseModal,
  showImportModal,
  showTimeSettings,
  showCourseDatePicker,
  importType,
  newCourse,
  colorOptions,
  handleImport,
  addCourse,
  deleteCourse,
  saveTimeSettings,
  courseDateCalendarYear,
  courseDateCalendarMonth,
  courseDateCalendarDays,
  prevCourseDateMonth,
  nextCourseDateMonth,
  selectCourseDate,
  confirmCourseDate,
  tempSelectedCourseDate
});
</script>
