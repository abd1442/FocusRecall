import type { AppLanguage } from './localization'

const timing: Record<AppLanguage, string> = {
  en: 'Study timing is paused because screen-lock status cannot be verified. Keep this window open and check your desktop session. History and Learn remain available.',
  ar: 'تم إيقاف توقيت الدراسة مؤقتًا لتعذّر التحقق من حالة قفل الشاشة. أبقِ هذه النافذة مفتوحة وتحقق من جلسة سطح المكتب. يظل السجل وقسم التعلّم متاحين.',
  es: 'El tiempo de estudio está pausado porque no se puede verificar el bloqueo de pantalla. Mantén esta ventana abierta y comprueba la sesión del escritorio. El historial y Aprender siguen disponibles.',
  fr: 'Le suivi du temps est en pause car le verrouillage de l’écran ne peut pas être vérifié. Gardez cette fenêtre ouverte et vérifiez votre session. L’historique et Apprendre restent disponibles.',
  de: 'Die Lernzeiterfassung pausiert, weil der Sperrstatus nicht geprüft werden kann. Lass dieses Fenster geöffnet und prüfe die Desktopsitzung. Verlauf und Lernen bleiben verfügbar.',
  'pt-BR': 'A contagem de estudo está pausada porque não é possível verificar o bloqueio da tela. Mantenha esta janela aberta e verifique a sessão da área de trabalho. Histórico e Aprender continuam disponíveis.',
  'zh-Hans': '无法确认屏幕锁定状态，学习计时已暂停。请保持此窗口打开并检查桌面会话。历史记录和学习页面仍可使用。'
}
export const timingUnavailable = (language: AppLanguage): string => timing[language]
