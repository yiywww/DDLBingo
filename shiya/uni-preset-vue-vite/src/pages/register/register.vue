<template>
  <view style="min-height: 100vh; background: linear-gradient(135deg, #f5f5f0 0%, #e8e4dc 100%); display: flex; align-items: center; justify-content: center; padding: 48rpx;">
    <view style="width: 100%; max-width: 720rpx;">
      <view style="text-align: center; margin-bottom: 80rpx;">
        <view style="width: 160rpx; height: 160rpx; background: linear-gradient(145deg, #1a1a1a 0%, #2d2d2d 100%); border-radius: 32rpx; display: flex; align-items: center; justify-content: center; margin: 0 auto 40rpx; box-shadow: 0 16rpx 48rpx rgba(0,0,0,0.15);">
          <text style="color: white; font-weight: bold; font-size: 64rpx;">拾</text>
        </view>
        <h1 style="font-size: 56rpx; font-weight: 700; letter-spacing: -1px; color: #1a1a1a; margin-bottom: 16rpx;">拾鸦</h1>
        <text style="font-size: 28rpx; color: #8c857d; letter-spacing: 4rpx;">Shi Ya</text>
        <text style="font-size: 30rpx; color: #6b6560; margin-top: 24rpx; display: block;">创建一个新账号，开始你的旅程</text>
      </view>

      <view style="background-color: white; border-radius: 48rpx; box-shadow: 0 24rpx 64rpx rgba(0,0,0,0.08); padding: 64rpx;">
        <form>
          <view style="margin-bottom: 36rpx;">
            <text style="display: block; font-size: 26rpx; font-weight: 600; color: #4a4540; margin-bottom: 16rpx; letter-spacing: 1rpx;">用户名</text>
            <input
              type="text"
              v-model="form.username"
              placeholder="请输入用户名（至少3个字符）"
              style="width: 100%; height: 100rpx; padding: 0 32rpx; background-color: #fafaf8; border: 2rpx solid #e8e4dc; border-radius: 24rpx; font-size: 30rpx; outline: none; -webkit-appearance: none; appearance: none; box-sizing: border-box; transition: all 0.3s;"
              :style="errors.username ? 'border-color: #ef4444; background-color: #fef2f2;' : (isFocused.username ? 'border-color: #5a5a40; background-color: white;' : '')"
              @focus="onFocus('username')"
              @blur="onBlur('username')"
            />
            <text v-if="errors.username" style="font-size: 24rpx; color: #ef4444; margin-top: 12rpx; margin-left: 8rpx; display: block;">{{ errors.username }}</text>
          </view>

          <view style="margin-bottom: 36rpx;">
            <text style="display: block; font-size: 26rpx; font-weight: 600; color: #4a4540; margin-bottom: 16rpx; letter-spacing: 1rpx;">邮箱</text>
            <input
              type="email"
              v-model="form.email"
              placeholder="请输入邮箱地址"
              style="width: 100%; height: 100rpx; padding: 0 32rpx; background-color: #fafaf8; border: 2rpx solid #e8e4dc; border-radius: 24rpx; font-size: 30rpx; outline: none; -webkit-appearance: none; appearance: none; box-sizing: border-box; transition: all 0.3s;"
              :style="errors.email ? 'border-color: #ef4444; background-color: #fef2f2;' : (isFocused.email ? 'border-color: #5a5a40; background-color: white;' : '')"
              @focus="onFocus('email')"
              @blur="onBlur('email')"
            />
            <text v-if="errors.email" style="font-size: 24rpx; color: #ef4444; margin-top: 12rpx; margin-left: 8rpx; display: block;">{{ errors.email }}</text>
          </view>

          <view style="margin-bottom: 36rpx;">
            <text style="display: block; font-size: 26rpx; font-weight: 600; color: #4a4540; margin-bottom: 16rpx; letter-spacing: 1rpx;">密码</text>
            <input
              type="password"
              v-model="form.password"
              placeholder="请输入密码（至少6位）"
              style="width: 100%; height: 100rpx; padding: 0 32rpx; background-color: #fafaf8; border: 2rpx solid #e8e4dc; border-radius: 24rpx; font-size: 30rpx; outline: none; -webkit-appearance: none; appearance: none; box-sizing: border-box; transition: all 0.3s;"
              :style="errors.password ? 'border-color: #ef4444; background-color: #fef2f2;' : (isFocused.password ? 'border-color: #5a5a40; background-color: white;' : '')"
              @focus="onFocus('password')"
              @blur="onBlur('password')"
            />
            <text v-if="errors.password" style="font-size: 24rpx; color: #ef4444; margin-top: 12rpx; margin-left: 8rpx; display: block;">{{ errors.password }}</text>
          </view>

          <view style="margin-bottom: 48rpx;">
            <text style="display: block; font-size: 26rpx; font-weight: 600; color: #4a4540; margin-bottom: 16rpx; letter-spacing: 1rpx;">确认密码</text>
            <input
              type="password"
              v-model="form.confirmPassword"
              placeholder="请再次输入密码"
              style="width: 100%; height: 100rpx; padding: 0 32rpx; background-color: #fafaf8; border: 2rpx solid #e8e4dc; border-radius: 24rpx; font-size: 30rpx; outline: none; -webkit-appearance: none; appearance: none; box-sizing: border-box; transition: all 0.3s;"
              :style="errors.confirmPassword ? 'border-color: #ef4444; background-color: #fef2f2;' : (isFocused.confirmPassword ? 'border-color: #5a5a40; background-color: white;' : '')"
              @focus="onFocus('confirmPassword')"
              @blur="onBlur('confirmPassword')"
            />
            <text v-if="errors.confirmPassword" style="font-size: 24rpx; color: #ef4444; margin-top: 12rpx; margin-left: 8rpx; display: block;">{{ errors.confirmPassword }}</text>
          </view>

          <button
            type="button"
            :disabled="isLoading"
            style="width: 100%; height: 100rpx; background: linear-gradient(135deg, #5a5a40 0%, #6b6b4a 100%); color: white; font-size: 32rpx; font-weight: 600; border-radius: 24rpx; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 24rpx rgba(90,90,64,0.3); transition: all 0.3s;"
            :style="isLoading ? 'opacity: 0.7; transform: scale(0.98);' : buttonPressed ? 'transform: scale(0.95); box-shadow: 0 4rpx 12rpx rgba(90,90,64,0.3);' : 'transform: scale(1);'"
            @touchstart="buttonPressed = true"
            @touchend="buttonPressed = false"
            @click="handleRegister"
          >
            <text v-if="isLoading" style="display: flex; align-items: center; gap: 16rpx;">
              <text style="font-size: 32rpx;">...</text> 注册中
            </text>
            <text v-else>注 册</text>
          </button>
        </form>

        <view style="text-align: center; margin-top: 56rpx; padding-top: 40rpx; border-top: 1rpx solid #e8e4dc;">
          <text style="font-size: 28rpx; color: #8c857d;">已有账号？</text>
          <text @click="handleLogin" style="font-size: 28rpx; color: #5a5a40; font-weight: 600; margin-left: 12rpx; cursor: pointer;">立即登录</text>
        </view>
      </view>

      <view style="text-align: center; margin-top: 64rpx;">
        <text style="font-size: 24rpx; color: #a8a299;">© 2026 拾鸦 Shi Ya. 保留所有权利。</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { register as apiRegister } from '../../utils/api';

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
});

const errors = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
});

const isLoading = ref(false);
const isFocused = reactive({
  username: false,
  email: false,
  password: false,
  confirmPassword: false
});
const buttonPressed = ref(false);

const onFocus = (field) => {
  isFocused[field] = true;
};

const onBlur = (field) => {
  isFocused[field] = false;
};

const validateForm = () => {
  let isValid = true;

  errors.username = '';
  errors.email = '';
  errors.password = '';
  errors.confirmPassword = '';

  if (!form.username.trim()) {
    errors.username = '请输入用户名';
    isValid = false;
  } else if (form.username.length < 3) {
    errors.username = '用户名至少3个字符';
    isValid = false;
  }

  if (!form.email.trim()) {
    errors.email = '请输入邮箱';
    isValid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = '请输入有效的邮箱地址';
    isValid = false;
  }

  if (!form.password) {
    errors.password = '请输入密码';
    isValid = false;
  } else if (form.password.length < 6) {
    errors.password = '密码至少6个字符';
    isValid = false;
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = '请确认密码';
    isValid = false;
  } else if (form.confirmPassword !== form.password) {
    errors.confirmPassword = '两次输入的密码不一致';
    isValid = false;
  }

  return isValid;
};

const handleRegister = async () => {
  console.log('Register button clicked');
  
  if (!validateForm()) {
    console.log('Form validation failed');
    // 检查是否有错误信息，如果有则显示提示
    if (errors.username || errors.email || errors.password || errors.confirmPassword) {
      // 显示第一个错误信息
      const errorMessage = errors.username || errors.email || errors.password || errors.confirmPassword;
      uni.showToast({ 
        title: errorMessage, 
        icon: 'none',
        duration: 2000
      });
    }
    return;
  }

  console.log('Form validation passed, starting register process');
  isLoading.value = true;

  try {
    console.log('Sending register request');
    const data = await apiRegister({
      username: form.username,
      email: form.email,
      password: form.password
    });

    console.log('Register response data:', data);

    if (data.success) {
      console.log('Register successful');
      uni.showToast({ title: '注册成功，请登录', icon: 'success' });
      setTimeout(() => {
        uni.redirectTo({ 
          url: '/pages/login/login',
          success: (res) => {
            console.log('Navigation successful:', res);
          },
          fail: (err) => {
            console.error('Navigation failed:', err);
            uni.showToast({ title: '跳转失败，请重试', icon: 'none' });
          }
        });
      }, 1500);
    } else {
      console.log('Register failed:', data.error);
      if (data.error === 'user_exists') {
        errors.email = '该邮箱已被注册';
        uni.showToast({ title: '该邮箱已被注册', icon: 'none', duration: 2000 });
      } else if (data.error === 'username_exists') {
        errors.username = '该用户名已被使用';
        uni.showToast({ title: '该用户名已被使用', icon: 'none', duration: 2000 });
      } else {
        uni.showToast({ title: '注册失败，请重试', icon: 'none', duration: 2000 });
      }
    }
  } catch (error) {
    console.error('Register error:', error);
    uni.showToast({ title: '网络错误，请检查网络连接', icon: 'none', duration: 2000 });
  } finally {
    isLoading.value = false;
    console.log('Register process completed');
  }
};

const handleLogin = () => {
  uni.navigateTo({
    url: '/pages/login/login'
  });
};
</script>

<style scoped>
/* Additional styles if needed */
</style>
