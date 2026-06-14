
&lt;template&gt;
  &lt;view class="qq-docs-integration"&gt;
    &lt;view class="section-header"&gt;
      &lt;text class="section-title"&gt;📄 腾讯文档集成&lt;/text&gt;
      &lt;text class="section-desc"&gt;与腾讯文档深度结合，提升学习效率&lt;/text&gt;
    &lt;/view&gt;

    &lt;!-- 授权状态 --&gt;
    &lt;view v-if="!isAuthorized" class="auth-section"&gt;
      &lt;view class="auth-card"&gt;
        &lt;text class="auth-icon"&gt;🔗&lt;/text&gt;
        &lt;text class="auth-title"&gt;连接腾讯文档&lt;/text&gt;
        &lt;text class="auth-desc"&gt;授权拾鸦访问您的腾讯文档，解锁更多学习功能&lt;/text&gt;
        &lt;button class="auth-btn" @click="goToAuth"&gt;
          立即授权
        &lt;/button&gt;
      &lt;/view&gt;
    &lt;/view&gt;

    &lt;!-- 已授权状态 --&gt;
    &lt;view v-else class="docs-section"&gt;
      &lt;!-- 快捷功能卡片 --&gt;
      &lt;view class="quick-actions"&gt;
        &lt;view class="action-card" @click="createClassNote"&gt;
          &lt;text class="action-icon"&gt;📝&lt;/text&gt;
          &lt;text class="action-title"&gt;创建课堂笔记&lt;/text&gt;
          &lt;text class="action-desc"&gt;智能文档，多人协作&lt;/text&gt;
        &lt;/view&gt;

        &lt;view class="action-card" @click="createErrorBook"&gt;
          &lt;text class="action-icon"&gt;📚&lt;/text&gt;
          &lt;text class="action-title"&gt;创建错题本&lt;/text&gt;
          &lt;text class="action-desc"&gt;智能表格，自动分类&lt;/text&gt;
        &lt;/view&gt;

        &lt;view class="action-card" @click="createStudyPlan"&gt;
          &lt;text class="action-icon"&gt;📅&lt;/text&gt;
          &lt;text class="action-title"&gt;创建学习计划&lt;/text&gt;
          &lt;text class="action-desc"&gt;收集表格，进度打卡&lt;/text&gt;
        &lt;/view&gt;

        &lt;view class="action-card" @click="viewDocumentList"&gt;
          &lt;text class="action-icon"&gt;📁&lt;/text&gt;
          &lt;text class="action-title"&gt;查看文档列表&lt;/text&gt;
          &lt;text class="action-desc"&gt;管理您的学习文档&lt;/text&gt;
        &lt;/view&gt;
      &lt;/view&gt;

      &lt;!-- 最近文档 --&gt;
      &lt;view v-if="recentDocs.length &gt; 0" class="recent-docs"&gt;
        &lt;view class="docs-header"&gt;
          &lt;text class="docs-title"&gt;最近文档&lt;/text&gt;
          &lt;text class="docs-more" @click="viewDocumentList"&gt;查看全部 →&lt;/text&gt;
        &lt;/view&gt;
        &lt;view class="docs-list"&gt;
          &lt;view v-for="doc in recentDocs" :key="doc.file_id" class="doc-item" @click="openDocument(doc)"&gt;
            &lt;text class="doc-icon"&gt;{{ getDocIcon(doc.type) }}&lt;/text&gt;
            &lt;view class="doc-info"&gt;
              &lt;text class="doc-name"&gt;{{ doc.title }}&lt;/text&gt;
              &lt;text class="doc-time"&gt;{{ formatTime(doc.updated_at) }}&lt;/text&gt;
            &lt;/view&gt;
            &lt;text class="doc-arrow"&gt;→&lt;/text&gt;
          &lt;/view&gt;
        &lt;/view&gt;
      &lt;/view&gt;
    &lt;/view&gt;

    &lt;!-- 创建文档弹窗 --&gt;
    &lt;view v-if="showCreateModal" class="modal-overlay" @click="closeCreateModal"&gt;
      &lt;view class="modal-content" @click.stop&gt;
        &lt;view class="modal-header"&gt;
          &lt;text class="modal-title"&gt;{{ createModalTitle }}&lt;/text&gt;
          &lt;text class="modal-close" @click="closeCreateModal"&gt;✕&lt;/text&gt;
        &lt;/view&gt;
        
        &lt;view class="modal-body"&gt;
          &lt;input 
            v-model="createForm.title" 
            class="modal-input" 
            :placeholder="createModalPlaceholder"
          /&gt;
          
          &lt;view v-if="createType === 'errorBook'" class="subject-select"&gt;
            &lt;text class="select-label"&gt;选择学科：&lt;/text&gt;
            &lt;view class="subject-options"&gt;
              &lt;view 
                v-for="subj in subjects" 
                :key="subj"
                class="subject-option"
                :class="{ active: createForm.subject === subj }"
                @click="createForm.subject = subj"
              &gt;
                {{ subj }}
              &lt;/view&gt;
            &lt;/view&gt;
          &lt;/view&gt;
          
          &lt;view v-if="createType === 'classNote'" class="course-select"&gt;
            &lt;text class="select-label"&gt;选择课程：&lt;/text&gt;
            &lt;picker 
              mode="selector" 
              :range="courseList" 
              @change="onCourseChange"
            &gt;
              &lt;view class="picker-input"&gt;
                {{ createForm.course || '请选择课程' }}
              &lt;/view&gt;
            &lt;/picker&gt;
          &lt;/view&gt;
        &lt;/view&gt;
        
        &lt;view class="modal-footer"&gt;
          &lt;button class="modal-btn cancel" @click="closeCreateModal"&gt;取消&lt;/button&gt;
          &lt;button class="modal-btn confirm" @click="confirmCreate" :disabled="loading"&gt;
            {{ loading ? '创建中...' : '创建' }}
          &lt;/button&gt;
        &lt;/view&gt;
      &lt;/view&gt;
    &lt;/view&gt;

    &lt;!-- 文档列表弹窗 --&gt;
    &lt;view v-if="showDocListModal" class="modal-overlay" @click="closeDocListModal"&gt;
      &lt;view class="modal-content doc-list-modal" @click.stop&gt;
        &lt;view class="modal-header"&gt;
          &lt;text class="modal-title"&gt;我的文档&lt;/text&gt;
          &lt;text class="modal-close" @click="closeDocListModal"&gt;✕&lt;/text&gt;
        &lt;/view&gt;
        
        &lt;view class="modal-body"&gt;
          &lt;view v-if="docListLoading" class="loading-state"&gt;
            &lt;text&gt;加载中...&lt;/text&gt;
          &lt;/view&gt;
          
          &lt;view v-else-if="allDocs.length === 0" class="empty-state"&gt;
            &lt;text&gt;暂无文档&lt;/text&gt;
          &lt;/view&gt;
          
          &lt;view v-else class="full-docs-list"&gt;
            &lt;view v-for="doc in allDocs" :key="doc.file_id" class="doc-item" @click="openDocument(doc)"&gt;
              &lt;text class="doc-icon"&gt;{{ getDocIcon(doc.type) }}&lt;/text&gt;
              &lt;view class="doc-info"&gt;
                &lt;text class="doc-name"&gt;{{ doc.title }}&lt;/text&gt;
                &lt;text class="doc-time"&gt;{{ formatTime(doc.updated_at) }}&lt;/text&gt;
              &lt;/view&gt;
              &lt;text class="doc-arrow"&gt;→&lt;/text&gt;
            &lt;/view&gt;
          &lt;/view&gt;
        &lt;/view&gt;
      &lt;/view&gt;
    &lt;/view&gt;

    &lt;!-- 成功提示 --&gt;
    &lt;view v-if="showSuccess" class="success-toast"&gt;
      &lt;text&gt;✅ {{ successMessage }}&lt;/text&gt;
    &lt;/view&gt;
  &lt;/view&gt;
&lt;/template&gt;

&lt;script&gt;
export default {
  name: 'QQDocsIntegration',
  props: {
    courseSchedule: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      isAuthorized: false,
      loading: false,
      docListLoading: false,
      recentDocs: [],
      allDocs: [],
      
      // 弹窗状态
      showCreateModal: false,
      showDocListModal: false,
      createType: '',
      createModalTitle: '',
      createModalPlaceholder: '',
      
      // 创建表单
      createForm: {
        title: '',
        subject: '数学',
        course: ''
      },
      
      // 学科选项
      subjects: ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '政治'],
      
      // 成功提示
      showSuccess: false,
      successMessage: ''
    };
  },
  computed: {
    courseList() {
      if (!this.courseSchedule || !this.courseSchedule.courses) {
        return ['请先添加课程'];
      }
      return this.courseSchedule.courses.map(c =&gt; c.name || c.courseName);
    }
  },
  methods: {
    // 跳转到授权页面
    goToAuth() {
      // 这里应该调用后端API获取授权URL
      uni.showToast({
        title: '即将跳转授权页面',
        icon: 'none'
      });
      
      // 模拟授权成功
      setTimeout(() =&gt; {
        this.isAuthorized = true;
        this.loadRecentDocs();
      }, 1000);
    },
    
    // 加载最近文档
    async loadRecentDocs() {
      try {
        this.loading = true;
        // 调用后端API获取文档列表
        // const res = await this.$api.getQQDocs();
        // this.recentDocs = res.data.slice(0, 4);
        
        // 模拟数据
        this.recentDocs = [
          {
            file_id: 'doc1',
            title: '高等数学 - 课堂笔记',
            type: 'smartdoc',
            updated_at: Date.now() - 3600000
          },
          {
            file_id: 'doc2',
            title: '数学错题本',
            type: 'smartsheet',
            updated_at: Date.now() - 86400000
          }
        ];
      } catch (error) {
        console.error('加载文档失败:', error);
      } finally {
        this.loading = false;
      }
    },
    
    // 创建课堂笔记
    createClassNote() {
      this.createType = 'classNote';
      this.createModalTitle = '创建课堂笔记';
      this.createModalPlaceholder = '请输入笔记标题';
      this.createForm = { title: '', subject: '数学', course: '' };
      this.showCreateModal = true;
    },
    
    // 创建错题本
    createErrorBook() {
      this.createType = 'errorBook';
      this.createModalTitle = '创建错题本';
      this.createModalPlaceholder = '请输入错题本标题';
      this.createForm = { title: '', subject: '数学', course: '' };
      this.showCreateModal = true;
    },
    
    // 创建学习计划
    createStudyPlan() {
      this.createType = 'studyPlan';
      this.createModalTitle = '创建学习计划';
      this.createModalPlaceholder = '请输入计划名称';
      this.createForm = { title: '', subject: '数学', course: '' };
      this.showCreateModal = true;
    },
    
    // 课程选择
    onCourseChange(e) {
      this.createForm.course = this.courseList[e.detail.value];
    },
    
    // 确认创建
    async confirmCreate() {
      if (!this.createForm.title.trim()) {
        uni.showToast({ title: '请输入标题', icon: 'none' });
        return;
      }
      
      this.loading = true;
      try {
        let doc;
        
        // 根据类型调用不同的API
        if (this.createType === 'classNote') {
          // doc = await this.$api.createClassNote(this.createForm);
          // 模拟创建成功
          doc = { url: 'https://docs.qq.com/doc/demo1', title: this.createForm.title };
        } else if (this.createType === 'errorBook') {
          // doc = await this.$api.createErrorBook(this.createForm);
          doc = { url: 'https://docs.qq.com/sheet/demo2', title: this.createForm.title };
        } else if (this.createType === 'studyPlan') {
          // doc = await this.$api.createStudyPlan(this.createForm);
          doc = { url: 'https://docs.qq.com/collect/demo3', title: this.createForm.title };
        }
        
        this.showSuccess = true;
        this.successMessage = '创建成功！';
        
        // 关闭弹窗
        this.closeCreateModal();
        
        // 打开文档
        setTimeout(() =&gt; {
          uni.navigateTo({
            url: `/pages/webview/index?url=${encodeURIComponent(doc.url)}`
          });
        }, 500);
        
        // 重新加载文档列表
        this.loadRecentDocs();
        
      } catch (error) {
        console.error('创建失败:', error);
        uni.showToast({ title: '创建失败', icon: 'none' });
      } finally {
        this.loading = false;
        setTimeout(() =&gt; {
          this.showSuccess = false;
        }, 2000);
      }
    },
    
    // 关闭创建弹窗
    closeCreateModal() {
      this.showCreateModal = false;
      this.createForm = { title: '', subject: '数学', course: '' };
    },
    
    // 查看文档列表
    async viewDocumentList() {
      this.showDocListModal = true;
      this.docListLoading = true;
      
      try {
        // 调用后端API获取完整文档列表
        // const res = await this.$api.getQQDocList();
        // this.allDocs = res.data;
        
        // 模拟数据
        this.allDocs = [
          {
            file_id: 'doc1',
            title: '高等数学 - 课堂笔记',
            type: 'smartdoc',
            updated_at: Date.now() - 3600000
          },
          {
            file_id: 'doc2',
            title: '数学错题本',
            type: 'smartsheet',
            updated_at: Date.now() - 86400000
          },
          {
            file_id: 'doc3',
            title: '期末复习计划',
            type: 'collect',
            updated_at: Date.now() - 172800000
          },
          {
            file_id: 'doc4',
            title: '英语词汇积累',
            type: 'document',
            updated_at: Date.now() - 259200000
          }
        ];
      } catch (error) {
        console.error('加载文档列表失败:', error);
      } finally {
        this.docListLoading = false;
      }
    },
    
    // 关闭文档列表弹窗
    closeDocListModal() {
      this.showDocListModal = false;
    },
    
    // 打开文档
    openDocument(doc) {
      const url = `https://docs.qq.com/${doc.type === 'smartsheet' ? 'sheet' : doc.type === 'collect' ? 'collect' : 'doc'}/${doc.file_id}`;
      uni.navigateTo({
        url: `/pages/webview/index?url=${encodeURIComponent(url)}`
      });
      this.closeDocListModal();
    },
    
    // 获取文档图标
    getDocIcon(type) {
      const icons = {
        document: '📄',
        sheet: '📊',
        slide: '📽️',
        collect: '📋',
        smartdoc: '📝',
        smartsheet: '📚',
        mindmap: '🧠',
        flowchart: '🔀'
      };
      return icons[type] || '📄';
    },
    
    // 格式化时间
    formatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      
      if (diff &lt; 60000) return '刚刚';
      if (diff &lt; 3600000) return `${Math.floor(diff / 60000)}分钟前`;
      if (diff &lt; 86400000) return `${Math.floor(diff / 3600000)}小时前`;
      if (diff &lt; 604800000) return `${Math.floor(diff / 86400000)}天前`;
      
      return date.toLocaleDateString('zh-CN');
    }
  },
  mounted() {
    // 检查授权状态
    // this.checkAuthStatus();
  }
};
&lt;/script&gt;

&lt;style scoped&gt;
.qq-docs-integration {
  padding: 20px;
}

.section-header {
  margin-bottom: 20px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  display: block;
}

.section-desc {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
  display: block;
}

/* 授权区域 */
.auth-section {
  margin-bottom: 20px;
}

.auth-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  padding: 40px 20px;
  text-align: center;
}

.auth-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.auth-title {
  font-size: 20px;
  font-weight: 600;
  color: white;
  display: block;
  margin-bottom: 8px;
}

.auth-desc {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  display: block;
  margin-bottom: 24px;
}

.auth-btn {
  background: white;
  color: #667eea;
  border: none;
  border-radius: 25px;
  padding: 12px 40px;
  font-size: 16px;
  font-weight: 600;
}

/* 快捷操作 */
.quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 24px;
}

.action-card {
  background: #f8f9fa;
  border-radius: 16px;
  padding: 20px;
  text-align: center;
  transition: all 0.3s;
}

.action-card:active {
  transform: scale(0.98);
  background: #e9ecef;
}

.action-icon {
  font-size: 32px;
  display: block;
  margin-bottom: 8px;
}

.action-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  display: block;
  margin-bottom: 4px;
}

.action-desc {
  font-size: 12px;
  color: #666;
  display: block;
}

/* 最近文档 */
.recent-docs {
  background: white;
  border-radius: 16px;
  padding: 16px;
}

.docs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.docs-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}

.docs-more {
  font-size: 14px;
  color: #667eea;
}

.doc-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.doc-item:last-child {
  border-bottom: none;
}

.doc-icon {
  font-size: 24px;
  margin-right: 12px;
}

.doc-info {
  flex: 1;
}

.doc-name {
  font-size: 14px;
  color: #1a1a1a;
  display: block;
  margin-bottom: 4px;
}

.doc-time {
  font-size: 12px;
  color: #999;
  display: block;
}

.doc-arrow {
  font-size: 16px;
  color: #ccc;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 20px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow: hidden;
}

.doc-list-modal {
  max-width: 500px;
  height: 70vh;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.modal-close {
  font-size: 20px;
  color: #999;
  padding: 4px;
}

.modal-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.modal-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  font-size: 16px;
  margin-bottom: 16px;
}

.select-label {
  font-size: 14px;
  color: #666;
  display: block;
  margin-bottom: 8px;
}

.subject-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.subject-option {
  padding: 8px 16px;
  background: #f0f0f0;
  border-radius: 20px;
  font-size: 14px;
  color: #666;
}

.subject-option.active {
  background: #667eea;
  color: white;
}

.picker-input {
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 12px;
  font-size: 16px;
  color: #1a1a1a;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #f0f0f0;
}

.modal-btn {
  flex: 1;
  padding: 12px;
  border-radius: 12px;
  font-size: 16px;
  border: none;
}

.modal-btn.cancel {
  background: #f0f0f0;
  color: #666;
}

.modal-btn.confirm {
  background: #667eea;
  color: white;
}

.modal-btn.confirm:disabled {
  background: #ccc;
}

/* 加载和空状态 */
.loading-state,
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

/* 成功提示 */
.success-toast {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 16px 32px;
  border-radius: 12px;
  font-size: 16px;
  z-index: 2000;
}
&lt;/style&gt;

