<template>
  <view v-if="show" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,0.1);backdrop-filter:blur(8rpx);display:flex;align-items:center;justify-content:center;" @click="handleOverlayClick">
    <view style="width:600rpx;max-height:80vh;overflow-y:auto;background:#fdfcf9;border:2rpx solid #e5e0d8;padding:32rpx;border-radius:48rpx;box-shadow:0 50rpx 100rpx -20rpx rgba(0,0,0,0.25);" @click.stop>
      <text style="font-size:36rpx;font-style:italic;color:#5a5a40;margin-bottom:32rpx;display:block;">{{ isEditing ? '编辑日记' : '记录瞬间' }}</text>
      
      <view style="margin-bottom:24rpx;">
        <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">日期</text>
        <view
          @click="$emit('toggleDatePicker')"
          style="width:100%;height:72rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:32rpx;padding:0 40rpx;font-size:28rpx;display:flex;align-items:center;justify-content:space-between;cursor:pointer;"
        >
          <text>{{ localDate }}</text>
          <Calendar :size="24" />
        </view>
      </view>
      
      <view style="margin-bottom:24rpx;">
        <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">内容</text>
        <textarea
          v-model="localContent"
          placeholder="今天发生了什么..."
          style="width:100%;min-height:200rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:32rpx;padding:20rpx 40rpx;font-size:28rpx;outline:none;resize:none;"
        />
      </view>
      
      <view style="margin-bottom:24rpx;">
        <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">标签 (逗号分隔)</text>
        <input
          v-model="localTagsInput"
          placeholder="例如: 开心, 学习, 日常"
          style="width:100%;height:72rpx;background:#fff;border:2rpx solid #e5e0d8;border-radius:32rpx;padding:0 40rpx;font-size:28rpx;outline:none;"
        />
      </view>
      
      <view style="margin-bottom:32rpx;">
        <text style="font-size:20rpx;font-weight:bold;color:#8c857d;text-transform:uppercase;letter-spacing:2rpx;margin-bottom:12rpx;margin-left:20rpx;display:block;">添加图片</text>
        <view style="display:flex;flex-wrap:wrap;gap:16rpx;">
          <view v-for="(img, index) in localImages" :key="index" style="position:relative;width:120rpx;height:120rpx;">
            <image :src="img" style="width:100%;height:100%;object-cover;border-radius:16rpx;" />
            <view 
              @click="removeImage(index)"
              style="position:absolute;top:-10rpx;right:-10rpx;width:36rpx;height:36rpx;background:rgba(0,0,0,0.5);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24rpx;"
            >
              ×
            </view>
          </view>
          <view 
            v-if="localImages.length < 9"
            @click="triggerImageUpload"
            style="width:120rpx;height:120rpx;border:2rpx dashed #d1d5db;border-radius:16rpx;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <text style="font-size:16rpx;color:#8c857d;margin-top:8rpx;">添加</text>
          </view>
        </view>
        <input
          type="file"
          ref="imageInput"
          accept="image/*"
          multiple
          @change="handleImageUpload"
          style="display:none;"
        />
      </view>
      
      <view style="display:flex;gap:24rpx;">
        <view @click="handleCancel" style="flex:1;height:72rpx;background:#f0ede8;border-radius:32rpx;display:flex;align-items:center;justify-content:center;">
          <text style="font-size:28rpx;font-weight:500;color:#8c857d;">取消</text>
        </view>
        <view @click="handleSave" style="flex:1;height:72rpx;background:#5a5a40;border-radius:32rpx;display:flex;align-items:center;justify-content:center;box-shadow:0 20rpx 30rpx -10rpx rgba(90,90,64,0.3);">
          <text style="font-size:28rpx;font-weight:500;color:#fff;">保存</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue';
import { Calendar } from 'lucide-vue-next';

function getLocalDateString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  isEditing: {
    type: Boolean,
    default: false
  },
  diary: {
    type: Object,
    default: null
  }
});

const emit = defineEmits([
  'update:show',
  'save',
  'cancel',
  'toggleDatePicker'
]);

const imageInput = ref(null);
const localDate = ref(getLocalDateString());
const localContent = ref('');
const localTagsInput = ref('');
const localImages = ref([]);

const reset = () => {
  localDate.value = getLocalDateString();
  localContent.value = '';
  localTagsInput.value = '';
  localImages.value = [];
};

watch(() => props.diary, (diary) => {
  if (diary) {
    localDate.value = diary.date || getLocalDateString();
    localContent.value = diary.content || '';
    localTagsInput.value = diary.tags ? diary.tags.join(', ') : '';
    localImages.value = diary.images || [];
  } else {
    reset();
  }
}, { immediate: true });

watch(() => props.show, (val) => {
  if (!val) reset();
});

const handleOverlayClick = () => {
  handleCancel();
};

const handleCancel = () => {
  emit('cancel');
  reset();
};

const handleSave = () => {
  if (!localContent.value.trim()) return;
  
  const tags = localTagsInput.value
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
  
  emit('save', {
    id: props.diary?.id,
    date: localDate.value,
    content: localContent.value,
    tags,
    images: localImages.value
  });
};

const triggerImageUpload = () => {
  imageInput.value?.click();
};

const handleImageUpload = async (event) => {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (localImages.value.length >= 9) break;
    
    try {
      const compressed = await compressImage(file);
      localImages.value.push(compressed);
    } catch (error) {
      const reader = new FileReader();
      reader.onload = (e) => {
        localImages.value.push(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }
  
  event.target.value = '';
};

const compressImage = (file, maxWidth = 1024, maxHeight = 1024, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const isPng = file.type === 'image/png';
        const mimeType = isPng ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);

        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const removeImage = (index) => {
  localImages.value.splice(index, 1);
};

defineExpose({
  localDate
});
</script>
