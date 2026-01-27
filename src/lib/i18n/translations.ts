export type Language = 'en' | 'zh';

export const translations = {
  en: {
    common: {
      save: 'Save Changes',
      saving: 'Saving...',
      saved: 'Settings saved successfully!',
    },
    sidebar: {
      workshop: 'Workshop',
      history: 'History',
      questions: 'Questions',
      improvement: 'Improvement',
      settings: 'Settings',
      title: 'IELTS Writing Lab',
      signout: 'Sign Out',
    },
    settings: {
      title: 'Settings',
      targetScore: 'Target Score',
      targetScoreDesc: 'Set your target IELTS band score (0-9).',
      band: 'Band',
      language: 'Language Preference',
      languageDesc: 'Choose your preferred language for interface.',
    }
  },
  zh: {
    common: {
      save: '保存更改',
      saving: '保存中...',
      saved: '设置保存成功！',
    },
    sidebar: {
      workshop: '写作练习',
      history: '历史记录',
      questions: '题库',
      improvement: '提升建议',
      settings: '设置',
      title: '雅思写作实验室',
      signout: '退出登录',
    },
    settings: {
      title: '设置',
      targetScore: '目标分数',
      targetScoreDesc: '设置你的雅思目标分数 (0-9)。',
      band: '分',
      language: '语言偏好',
      languageDesc: '选择界面语言。',
    }
  }
};
