<template>
  <view style="min-height: 100vh; background: linear-gradient(135deg, #f5f5f0 0%, #e8e4dc 100%); display: flex; align-items: center; justify-content: center; padding: 48rpx;">
    <view style="width: 100%; max-width: 720rpx;">
      <view style="text-align: center; margin-bottom: 80rpx;">
        <view style="width: 160rpx; height: 160rpx; background: linear-gradient(145deg, #1a1a1a 0%, #2d2d2d 100%); border-radius: 32rpx; display: flex; align-items: center; justify-content: center; margin: 0 auto 40rpx; box-shadow: 0 16rpx 48rpx rgba(0,0,0,0.15);">
          <text style="color: white; font-weight: bold; font-size: 64rpx;">拾</text>
        </view>
        <h1 style="font-size: 56rpx; font-weight: 700; letter-spacing: -1px; color: #1a1a1a; margin-bottom: 16rpx;">拾鸦</h1>
        <text style="font-size: 28rpx; color: #8c857d; letter-spacing: 4rpx;">Shi Ya</text>
        <text style="font-size: 30rpx; color: #6b6560; margin-top: 24rpx; display: block;">欢迎回来，让我们继续你的旅程</text>
      </view>

      <view style="background-color: white; border-radius: 48rpx; box-shadow: 0 24rpx 64rpx rgba(0,0,0,0.08); padding: 64rpx;">
        <form>
          <view style="margin-bottom: 40rpx;">
            <text style="display: block; font-size: 26rpx; font-weight: 600; color: #4a4540; margin-bottom: 16rpx; letter-spacing: 1rpx;">邮箱 / 用户名</text>
            <input
              type="text"
              v-model="form.username"
              placeholder="请输入邮箱或用户名"
              style="width: 100%; height: 100rpx; padding: 0 32rpx; background-color: #fafaf8; border: 2rpx solid #e8e4dc; border-radius: 24rpx; font-size: 30rpx; outline: none; -webkit-appearance: none; appearance: none; box-sizing: border-box; transition: all 0.3s;"
              :style="errors.username ? 'border-color: #ef4444; background-color: #fef2f2;' : (isFocused.username ? 'border-color: #5a5a40; background-color: white;' : '')"
              @focus="onFocus('username')"
              @blur="onBlur('username')"
            />
            <text v-if="errors.username" style="font-size: 24rpx; color: #ef4444; margin-top: 12rpx; margin-left: 8rpx; display: block;">{{ errors.username }}</text>
          </view>

          <view style="margin-bottom: 40rpx;">
            <text style="display: block; font-size: 26rpx; font-weight: 600; color: #4a4540; margin-bottom: 16rpx; letter-spacing: 1rpx;">密码</text>
            <input
              type="password"
              v-model="form.password"
              placeholder="请输入密码"
              style="width: 100%; height: 100rpx; padding: 0 32rpx; background-color: #fafaf8; border: 2rpx solid #e8e4dc; border-radius: 24rpx; font-size: 30rpx; outline: none; -webkit-appearance: none; appearance: none; box-sizing: border-box; transition: all 0.3s;"
              :style="errors.password ? 'border-color: #ef4444; background-color: #fef2f2;' : (isFocused.password ? 'border-color: #5a5a40; background-color: white;' : '')"
              @focus="onFocus('password')"
              @blur="onBlur('password')"
            />
            <text v-if="errors.password" style="font-size: 24rpx; color: #ef4444; margin-top: 12rpx; margin-left: 8rpx; display: block;">{{ errors.password }}</text>
          </view>

          <view style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 48rpx;">
            <view style="display: flex; align-items: center; gap: 16rpx; cursor: pointer;">
              <checkbox value="1" :checked="form.remember" @change="onRememberChange" style="transform: scale(0.85);" />
              <text style="font-size: 28rpx; color: #6b6560;">记住我</text>
            </view>
            <text @click="handleForgotPassword" style="font-size: 28rpx; color: #5a5a40; font-weight: 500; cursor: pointer;">忘记密码？</text>
          </view>

          <button
            type="button"
            :disabled="isLoading"
            style="width: 100%; height: 100rpx; background: linear-gradient(135deg, #5a5a40 0%, #6b6b4a 100%); color: white; font-size: 32rpx; font-weight: 600; border-radius: 24rpx; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 24rpx rgba(90,90,64,0.3); transition: all 0.3s;"
            :style="isLoading ? 'opacity: 0.7; transform: scale(0.98);' : buttonPressed ? 'transform: scale(0.95); box-shadow: 0 4rpx 12rpx rgba(90,90,64,0.3);' : 'transform: scale(1);'"
            @touchstart="buttonPressed = true"
            @touchend="buttonPressed = false"
            @click="handleLogin"
          >
            <text v-if="isLoading" style="display: flex; align-items: center; gap: 16rpx;">
              <text style="font-size: 32rpx;">...</text> 登录中
            </text>
            <text v-else>登 录</text>
          </button>
        </form>

        <view style="text-align: center; margin-top: 56rpx; padding-top: 40rpx; border-top: 1rpx solid #e8e4dc;">
          <text style="font-size: 28rpx; color: #8c857d;">还没有账号？</text>
          <text @click="handleRegister" style="font-size: 28rpx; color: #5a5a40; font-weight: 600; margin-left: 12rpx; cursor: pointer;">立即注册</text>
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
import { login as apiLogin } from '../../utils/api';

const form = reactive({
  username: '',
  password: '',
  remember: false
});

const errors = reactive({
  username: '',
  password: ''
});

const isLoading = ref(false);
const isFocused = reactive({
  username: false,
  password: false
});
const buttonPressed = ref(false);

const onRememberChange = (e) => {
  form.remember = e.detail.value.length > 0;
};

const onFocus = (field) => {
  isFocused[field] = true;
};

const onBlur = (field) => {
  isFocused[field] = false;
};

const validateForm = () => {
  let isValid = true;

  errors.username = '';
  errors.password = '';

  if (!form.username.trim()) {
    errors.username = '请输入邮箱或用户名';
    isValid = false;
  }

  if (!form.password) {
    errors.password = '请输入密码';
    isValid = false;
  }

  return isValid;
};

const handleLogin = async () => {
  console.log('Login button clicked');
  
  if (!validateForm()) {
    console.log('Form validation failed');
    // 检查是否有错误信息，如果有则显示提示
    if (errors.username || errors.password) {
      uni.showToast({ 
        title: errors.username || errors.password, 
        icon: 'none',
        duration: 2000
      });
    }
    return;
  }

  console.log('Form validation passed, starting login process');
  isLoading.value = true;

  try {
    console.log('Sending login request');
    const data = await apiLogin({
      username: form.username,
      password: form.password,
      remember: form.remember
    });

    console.log('Login response data:', data);

    if (data.success) {
      console.log('Login successful');
      if (data.token) {
        uni.setStorageSync('token', data.token);
        uni.setStorageSync('user', JSON.stringify(data.user));
      }
      uni.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        uni.redirectTo({ 
          url: '/pages/index/index',
          success: (res) => {
            console.log('Navigation successful:', res);
          },
          fail: (err) => {
            console.error('Navigation failed:', err);
            uni.showToast({ title: '跳转失败，请重试', icon: 'none' });
          }
        });
      }, 1000);
    } else {
      console.log('Login failed:', data.error);
      if (data.error === 'invalid_credentials') {
        errors.password = '邮箱/用户名或密码错误';
        uni.showToast({ title: '邮箱/用户名或密码错误', icon: 'none', duration: 2000 });
      } else if (data.error === 'user_not_found') {
        errors.username = '用户不存在';
        uni.showToast({ title: '用户不存在', icon: 'none', duration: 2000 });
      } else {
        uni.showToast({ title: '登录失败，请重试', icon: 'none', duration: 2000 });
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    uni.showToast({ title: '网络错误，请检查网络连接', icon: 'none', duration: 2000 });
  } finally {
    isLoading.value = false;
    console.log('Login process completed');
  }
};

const handleForgotPassword = () => {
  uni.showToast({ title: '忘记密码功能正在开发中', icon: 'none' });
};

const handleRegister = () => {
  uni.navigateTo({
    url: '/pages/register/register'
  });
};
</script>

<style scoped>
/* Additional styles if needed */
</style>
