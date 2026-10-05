import React, { useState } from "react";
import { toast } from "sonner";
import { BellIcon, ImageIcon, PaletteIcon, RotateCcwIcon, SlidersHorizontalIcon, UserIcon, WifiIcon, BoxIcon } from "lucide-react";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { PageHeader } from "../components/PageHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { SelectField } from "../components/SelectField";
import { Switch } from "../components/Switch";
import { TextField } from "../components/TextField";
import { TargetsDialog } from "../components/food/TargetsDialog";
import { useNutrition } from "../contexts/NutritionContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { useProgress } from "../contexts/ProgressContext";
import { useSync } from "../contexts/SyncContext";
import { useTraining } from "../contexts/TrainingContext";
import { useStoredState } from "../hooks/useStoredState";
import { todayKey } from "../utils/dates";
import { NUTRIENT_COLOR, NUTRIENT_KEYS, NUTRIENT_SHORT_KEY, UNIT_KEY } from "../utils/nutrition";
import { Language, Theme } from "../types/preferences";
function Section({
  icon: Icon,
  title,
  children




}: {icon: BoxIcon;title: string;children: React.ReactNode;}) {
  return <section aria-labelledby={`settings-${title}`} className="grid gap-4 border-t border-line py-8 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <h2 id={`settings-${title}`} className="flex items-center gap-2.5 font-display text-lg font-bold text-ink">
        <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-elevated text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        {title}
      </h2>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>;
}
function Row({
  title,
  hint,
  children




}: {title: string;hint?: string;children: React.ReactNode;}) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>;
}
const REMINDER_KEY = {
  food: 'settings.reminder.food',
  exercise: 'settings.reminder.exercise',
  weight: 'settings.reminder.weight',
  photos: 'settings.reminder.photos'
} as const;
const TIMEZONES = ['UTC', 'Europe/London', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Riyadh', 'Africa/Cairo', 'America/New_York', 'America/Los_Angeles'];
export function Settings() {
  const prefs = usePreferences();
  const {
    t,
    num
  } = prefs;
  const sync = useSync();
  const nutrition = useNutrition();
  const training = useTraining();
  const progress = useProgress();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [profile, setProfile] = useStoredState('formlog.profile', {
    timezone: browserTz
  });
  const [reminders, setReminders] = useStoredState('formlog.reminders', {
    food: true,
    exercise: false,
    weight: true,
    photos: false
  });
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [permission, setPermission] = useState<string>(supported ? Notification.permission : 'unsupported');
  const today = todayKey();
  const todayTargets = nutrition.logs[today]?.targets ?? nutrition.defaultTargets;
  const handleReset = async () => {
    setResetting(true);
    await Promise.all([nutrition.resetDemoData(), training.reset(), progress.reset()]);
    setResetting(false);
    setConfirmOpen(false);
    toast.success(t('settings.clearDone'));
  };
  const permissionText: Record<string, string> = {
    granted: t('settings.permGranted'),
    denied: t('settings.permDenied'),
    default: t('settings.permDefault'),
    unsupported: t('settings.permUnsupported')
  };
  return <div className="mx-auto w-full max-w-4xl px-4 pb-28 pt-5 md:px-8 md:pb-14 md:pt-8">
      <PageHeader title={t('settings.title')} subtitle={t('settings.desc')} />

      <div className="mt-8">
        <Section icon={UserIcon} title={t('settings.profile')}>
          <TextField id="profile-name" label={t('settings.name')} value={prefs.displayName} onChange={prefs.setDisplayName} className="max-w-sm" />
          <SelectField id="profile-tz" label={t('settings.timezone')} hint={t('settings.timezoneHint')} className="max-w-sm" value={profile.timezone} onChange={(v) => setProfile((p) => ({
          ...p,
          timezone: v
        }))} options={[...new Set([browserTz, ...TIMEZONES])].map((tz) => ({
          value: tz,
          label: tz
        }))} />
          <Row title={t('settings.units')} hint={t('settings.unitsHint')}>
            <span className="rounded-full bg-elevated px-3 py-1.5 text-[13px] font-semibold text-ink">{t('settings.metric')}</span>
          </Row>
        </Section>

        <Section icon={SlidersHorizontalIcon} title={t('settings.goals')}>
          <p className="text-[13px] text-muted">{t('settings.goalsHint')}</p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {NUTRIENT_KEYS.map((k) => <div key={k} className="rounded-card bg-elevated p-3.5">
                <dt className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${NUTRIENT_COLOR[k].bg}`} />
                  {t(NUTRIENT_SHORT_KEY[k])}
                </dt>
                <dd className="tnum mt-1 font-display text-xl font-extrabold text-ink">
                  {num(todayTargets[k])} <span className="text-xs font-semibold text-muted">{t(UNIT_KEY[k])}</span>
                </dd>
              </div>)}
          </dl>
          <Button variant="secondary" onClick={() => setTargetsOpen(true)}>
            {t('today.editTargets')}
          </Button>
        </Section>

        <Section icon={PaletteIcon} title={t('settings.appearance')}>
          <Row title={t('settings.language')} hint={t('settings.languageHint')}>
            <SegmentedControl<Language> label={t('settings.language')} value={prefs.language} onChange={prefs.setLanguage} options={[{
            value: 'en',
            label: 'English'
          }, {
            value: 'ar',
            label: 'العربية'
          }]} />
          </Row>
          <Row title={t('settings.theme')} hint={t('settings.themeHint')}>
            <SegmentedControl<Theme> label={t('settings.theme')} value={prefs.theme} onChange={prefs.setTheme} options={[{
            value: 'dark',
            label: t('settings.themeDark')
          }, {
            value: 'light',
            label: t('settings.themeLight')
          }, {
            value: 'system',
            label: t('settings.themeSystem')
          }]} />
          </Row>
        </Section>

        <Section icon={BellIcon} title={t('settings.reminders')}>
          <div className="rounded-card border border-line p-4">
            <p className="text-sm font-semibold text-ink">{permissionText[permission] ?? permissionText.default}</p>
            <p className="mt-0.5 text-[13px] text-muted">{t('settings.remindersHonest')}</p>
            {supported && permission === 'default' && <Button variant="secondary" size="sm" className="mt-3" onClick={() => void Notification.requestPermission().then(setPermission)}>
                {t('settings.allow')}
              </Button>}
          </div>
          {(['food', 'exercise', 'weight', 'photos'] as const).map((k) => <Switch key={k} id={`reminder-${k}`} checked={reminders[k]} onChange={(v) => setReminders((r) => ({
          ...r,
          [k]: v
        }))} label={t(REMINDER_KEY[k])} description={k === 'photos' ? t('settings.reminderPhotosHint') : undefined} />)}
        </Section>

        <Section icon={ImageIcon} title={t('settings.privacy')}>
          <Switch id="store-photos" checked={prefs.storePhotosLocally} onChange={prefs.setStorePhotosLocally} label={t('settings.storePhotos')} description={t('settings.storePhotosHint')} />
          <Row title={t('settings.demoData')} hint={t('settings.demoDataHint')}>
            <Button variant="secondary" icon={RotateCcwIcon} onClick={() => setConfirmOpen(true)}>
              {t('settings.clear')}
            </Button>
          </Row>
        </Section>

        <Section icon={WifiIcon} title={t('settings.connectivity')}>
          <p className="text-[13px] text-muted">{t('settings.connectivityHint')}</p>
          <Switch id="settings-offline" checked={sync.simulatedOffline} onChange={sync.setSimulatedOffline} label={t('sync.simulateOffline')} description={t('sync.simulateOfflineHint')} />
          <Button variant="secondary" size="sm" onClick={sync.syncState === 'attention' ? sync.resolveAttention : sync.simulateConflict}>
            {sync.syncState === 'attention' ? t('sync.markResolved') : t('sync.simulateConflict')}
          </Button>
          <p className="text-[13px] text-muted">{t('settings.offlineCache')}</p>
        </Section>
      </div>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('settings.clearTitle')} footer={<div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} data-autofocus>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleReset} disabled={resetting}>
              {t('settings.clearConfirm')}
            </Button>
          </div>}>
        <p className="text-sm text-ink">{t('settings.clearBody')}</p>
      </Dialog>
      <TargetsDialog open={targetsOpen} onClose={() => setTargetsOpen(false)} dateKey={today} targets={todayTargets} onSave={(next, scope) => {
      nutrition.updateTargets(today, next, scope);
      setTargetsOpen(false);
      toast.success(t('targets.saved'));
    }} />
    </div>;
}