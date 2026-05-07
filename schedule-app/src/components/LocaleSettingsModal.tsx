import { Languages, RotateCcw } from 'lucide-react'
import Modal from './shared/Modal'
import { useLocale, useT } from '../i18n'
import type { Locale, Section, SectionLocale, TKey } from '../i18n'

interface Props {
  open: boolean
  onClose: () => void
}

const MAIN_OPTIONS: { value: Locale; labelKey: TKey }[] = [
  { value: 'zh', labelKey: 'localeSettings.optionZh' },
  { value: 'en', labelKey: 'localeSettings.optionEn' },
]

const SECTION_OPTIONS: { value: SectionLocale; labelKey: TKey }[] = [
  { value: 'auto', labelKey: 'localeSettings.optionAuto' },
  { value: 'zh', labelKey: 'localeSettings.optionZh' },
  { value: 'en', labelKey: 'localeSettings.optionEn' },
]

const SECTION_ROWS: { key: Section; labelKey: TKey; hintKey: TKey }[] = [
  {
    key: 'types',
    labelKey: 'localeSettings.sectionTypes',
    hintKey: 'localeSettings.sectionTypesHint',
  },
  {
    key: 'nav',
    labelKey: 'localeSettings.sectionNav',
    hintKey: 'localeSettings.sectionNavHint',
  },
  {
    key: 'actions',
    labelKey: 'localeSettings.sectionActions',
    hintKey: 'localeSettings.sectionActionsHint',
  },
]

export default function LocaleSettingsModal({ open, onClose }: Props) {
  const t = useT()
  const {
    locale,
    setLocale,
    sectionOverrides,
    setSectionOverride,
    resetSectionOverrides,
  } = useLocale()

  return (
    <Modal
      open={open}
      title={t('localeSettings.title')}
      onClose={onClose}
      size="md"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={resetSectionOverrides}
            className="px-3 py-2.5 rounded-lg bg-card border border-border text-dim hover:text-text hover:bg-hover text-sm font-medium flex items-center gap-1.5"
          >
            <RotateCcw size={14} /> {t('localeSettings.reset')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-medium"
          >
            {t('localeSettings.close')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="text-xs text-dim leading-relaxed flex gap-2 items-start">
          <Languages size={14} className="shrink-0 mt-0.5 text-accent" />
          <span>{t('localeSettings.intro')}</span>
        </div>

        <div>
          <div className="text-xs font-semibold tracking-wider text-muted uppercase mb-2">
            {t('localeSettings.mainLocale')}
          </div>
          <Segment
            value={locale}
            options={MAIN_OPTIONS.map((o) => ({
              value: o.value,
              label: t(o.labelKey),
            }))}
            onChange={(v) => setLocale(v as Locale)}
          />
        </div>

        <div className="border-t border-border" />

        <div className="space-y-4">
          {SECTION_ROWS.map((row) => (
            <div key={row.key}>
              <div className="text-sm text-text font-medium mb-0.5">
                {t(row.labelKey)}
              </div>
              <div className="text-[11px] text-dim mb-2 leading-relaxed">
                {t(row.hintKey)}
              </div>
              <Segment
                value={sectionOverrides[row.key]}
                options={SECTION_OPTIONS.map((o) => ({
                  value: o.value,
                  label: t(o.labelKey),
                }))}
                onChange={(v) => setSectionOverride(row.key, v as SectionLocale)}
              />
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

interface SegmentProps {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}

function Segment({ value, options, onChange }: SegmentProps) {
  return (
    <div
      role="radiogroup"
      className="inline-flex rounded-lg bg-hover p-0.5 w-full"
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active
                ? 'bg-main text-text shadow-xs'
                : 'text-dim hover:text-text'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
