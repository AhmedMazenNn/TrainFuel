import React, { useState } from 'react';
import { toast } from 'sonner';
import { ExternalLinkIcon, LockIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { Button } from '../Button';
import { TextField } from '../TextField';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useTraining } from '../../contexts/TrainingContext';
import { isValidUrl } from '../../utils/training';

export function TutorialLinkEditor({ exerciseId }: {exerciseId: string;}) {
  const { t } = usePreferences();
  const { tutorialLinks, setTutorialLink } = useTraining();
  const saved = tutorialLinks[exerciseId];
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();

  const start = () => {
    setValue(saved ?? '');
    setError(undefined);
    setEditing(true);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const url = value.trim();
    if (!isValidUrl(url)) {
      setError(t('exercise.linkError'));
      return;
    }
    setTutorialLink(exerciseId, url);
    setEditing(false);
    toast.success(t('exercise.linkSaved'));
  };

  const remove = () => {
    const previous = saved;
    setTutorialLink(exerciseId, null);
    setEditing(false);
    toast(t('exercise.linkRemoved'), { action: { label: t('entry.undo'), onClick: () => previous && setTutorialLink(exerciseId, previous) } });
  };

  return (
    <div className="rounded-card border border-line bg-canvas/40 p-4">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <LockIcon className="h-3.5 w-3.5 text-primary" aria-hidden />
        {t('exercise.privateLink')}
      </p>
      <p className="mt-0.5 text-xs text-muted">{t('exercise.privateLinkHint')}</p>

      {editing ?
      <form onSubmit={save} noValidate className="mt-3 space-y-3">
          <TextField
          id={`tutorial-${exerciseId}`}
          label={t('exercise.linkUrl')}
          hideLabel
          type="url"
          placeholder="https://"
          value={value}
          onChange={(v) => {
            setValue(v);
            setError(undefined);
          }}
          error={error}
          data-autofocus
          autoFocus />
        
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm">
              {t('exercise.saveLink')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
            {saved &&
          <Button variant="ghost" size="sm" onClick={remove} className="ms-auto text-danger">
                {t('exercise.removeLink')}
              </Button>
          }
          </div>
        </form> :
      saved ?
      <div className="mt-3 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-muted" dir="ltr">
            {saved}
          </p>
          <a
          href={saved}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] bg-elevated px-3 text-[13px] font-semibold text-ink hover:text-primary">
          
            <ExternalLinkIcon className="h-3.5 w-3.5" aria-hidden />
            {t('exercise.openLink')}
          </a>
          <Button variant="ghost" size="icon-sm" icon={PencilIcon} onClick={start} aria-label={t('exercise.editLink')} />
        </div> :

      <Button variant="secondary" size="sm" icon={PlusIcon} onClick={start} className="mt-3">
          {t('exercise.addLink')}
        </Button>
      }
    </div>);

}