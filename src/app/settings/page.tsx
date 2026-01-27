'use client';

import { Settings as SettingsIcon, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Language } from '@/lib/i18n/translations';

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SettingsPage() {
  const [targetScore, setTargetScore] = useState<number>(7.0);
  const [saving, setSaving] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    // Load from localStorage on mount
    const savedScore = localStorage.getItem('ielts_target_score');
    if (savedScore) {
      setTargetScore(parseFloat(savedScore));
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    // Save to localStorage
    localStorage.setItem('ielts_target_score', targetScore.toString());
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setSaving(false);
    // Optional: Show toast notification
    alert(t('common.saved'));
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-6 flex items-center gap-3">
        <SettingsIcon className="w-8 h-8 text-blue-600" />
        {t('settings.title')}
      </h1>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="space-y-6">
          {/* Target Score Section */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div>
              <h3 className="font-medium text-slate-900">{t('settings.targetScore')}</h3>
              <p className="text-sm text-slate-500">{t('settings.targetScoreDesc')}</p>
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="number" 
                min="0" 
                max="9" 
                step="0.5"
                value={targetScore}
                onChange={(e) => setTargetScore(parseFloat(e.target.value))}
                className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-center font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-sm text-slate-400 font-medium">{t('settings.band')}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div>
              <h3 className="font-medium text-slate-900">{t('settings.language')}</h3>
              <p className="text-sm text-slate-500">{t('settings.languageDesc')}</p>
            </div>
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
