// 认证状态管理

// 检查用户是否已登录
export const isLoggedIn = () => {
  return !!uni.getStorageSync('token');
};

// 获取当前用户信息
export const getCurrentUser = () => {
  const userStr = uni.getStorageSync('user');
  return userStr ? JSON.parse(userStr) : null;
};

// 获取认证token
export const getToken = () => {
  return uni.getStorageSync('token');
};

// 登录成功后保存用户信息和token
export const loginSuccess = (user, token) => {
  uni.setStorageSync('user', JSON.stringify(user));
  uni.setStorageSync('token', token);
};

// 退出登录
export const logout = () => {
  uni.removeStorageSync('user');
  uni.removeStorageSync('token');
};

// 检查是否需要认证的路由
export const requireAuth = (to, from, next) => {
  if (!isLoggedIn()) {
    next('/pages/login/login');
  } else {
    next();
  }
};