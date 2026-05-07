import {
  Download,
  AlertTriangle,
  Chrome,
  Wallet,
  Smartphone,
} from 'lucide-react'
import type { ReactNode } from 'react'
import Modal from './shared/Modal'
import { useT } from '../i18n'

interface Props {
  open: boolean
  onClose: () => void
}

function StepSection({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3 pt-1">
        <div className="shrink-0 w-8 h-8 rounded-full bg-accent text-white text-sm font-semibold flex items-center justify-center">
          {number}
        </div>
        <h3 className="text-base font-semibold text-text break-words">{title}</h3>
      </div>
      <div className="pl-0 sm:pl-11 space-y-3 text-sm text-text leading-relaxed">
        {children}
      </div>
    </section>
  )
}

function Ordered({ children }: { children: ReactNode }) {
  return (
    <ol className="list-decimal list-outside pl-5 space-y-2 marker:text-dim marker:font-medium">
      {children}
    </ol>
  )
}

function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
      <div className="min-w-0 break-words leading-relaxed">{children}</div>
    </div>
  )
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-card border border-border text-[0.85em] break-all">
      {children}
    </code>
  )
}

export default function HelpModal({ open, onClose }: Props) {
  const t = useT()
  return (
    <Modal open={open} title={t('helpModal.title')} onClose={onClose} size="2xl">
      <div className="space-y-7">
        <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3">
          <Chrome size={18} className="shrink-0 mt-0.5 text-accent" />
          <div className="text-sm text-text leading-relaxed break-words">
            <div className="font-semibold">{t('helpModal.prereqTitle')}</div>
            <p className="text-xs text-dim mt-0.5">{t('helpModal.prereqBody')}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <Wallet size={18} className="shrink-0 mt-0.5 text-amber-600" />
          <div className="text-sm text-text leading-relaxed break-words space-y-1">
            <div className="font-semibold">{t('helpModal.billingTitle')}</div>
            <p className="text-xs text-dim">{t('helpModal.billingBody')}</p>
            <ul className="list-disc list-outside pl-5 text-xs text-dim space-y-0.5 marker:text-dim">
              <li>{t('helpModal.billingBullet1')}</li>
              <li>
                {t('helpModal.billingBullet2Pre')}
                <Code>hituchenguang</Code>
                {t('helpModal.billingBullet2Post')}
              </li>
              <li>{t('helpModal.billingBullet3')}</li>
            </ul>
          </div>
        </div>

        <StepSection number={1} title={t('helpModal.step1Title')}>
          <Ordered>
            <li>
              {t('helpModal.step1Item1')}
              <div className="mt-2">
                <a
                  href="/extensions.7z"
                  download
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90"
                >
                  <Download size={14} /> {t('helpModal.step1Download')}
                </a>
              </div>
            </li>
            <li>
              {t('helpModal.step1Item2Pre')}
              <span className="text-text">7-Zip</span>、
              <span className="text-text">WinRAR</span>、
              <span className="text-text">Bandizip</span>
              {t('helpModal.step1Item2Post')}{' '}
              <Code>ac-online</Code> &nbsp;<Code>moodle</Code>
            </li>
            <li>
              {t('helpModal.step1Item3')}
              <ul className="list-disc list-outside pl-5 mt-1.5 space-y-1 marker:text-dim">
                <li>
                  {t('helpModal.step1EdgeAddr')} <Code>edge://extensions</Code>
                </li>
                <li>
                  {t('helpModal.step1ChromeAddr')} <Code>chrome://extensions</Code>
                </li>
              </ul>
            </li>
            <li>{t('helpModal.step1Item4')}</li>
            <li>{t('helpModal.step1Item5')}</li>
            <li>
              {t('helpModal.step1Item6Pre')}
              <Code>ac-online</Code>
              {t('helpModal.step1Item6Mid')}
              <Code>moodle</Code>
              {t('helpModal.step1Item6Post')}
            </li>
            <li>{t('helpModal.step1Item7')}</li>
          </Ordered>
        </StepSection>

        <StepSection number={2} title={t('helpModal.step2Title')}>
          <Ordered>
            <li>
              {t('helpModal.step2Item1Pre')}
              <Code>ac.xmu.edu.my</Code>
              {t('helpModal.step2Item1Post')}
            </li>
            <li>{t('helpModal.step2Item2')}</li>
            <li>
              {t('helpModal.step2Item3Pre')}
              <Code>2026/04</Code>
              {t('helpModal.step2Item3Post')}
            </li>
            <li>{t('helpModal.step2Item4')}</li>
            <li>{t('helpModal.step2Item5')}</li>
            <li>{t('helpModal.step2Item6')}</li>
            <li>{t('helpModal.step2Item7')}</li>
          </Ordered>
        </StepSection>

        <StepSection number={3} title={t('helpModal.step3Title')}>
          <Ordered>
            <li>
              {t('helpModal.step3Item1Pre')}
              <Code>l.xmu.edu.my</Code>
              {t('helpModal.step3Item1Post')}
            </li>
            <li>{t('helpModal.step3Item2')}</li>
            <li>{t('helpModal.step3Item3')}</li>
            <li>{t('helpModal.step3Item4')}</li>
            <li>{t('helpModal.step3Item5')}</li>
            <li>
              {t('helpModal.step3Item6Pre')}
              <Code>Assignment</Code>、<Code>Quiz</Code>、<Code>Exam</Code>、
              <Code>Syllabus</Code>、<Code>Course Plan</Code>、<Code>Overview</Code>
              {t('helpModal.step3Item6Post')}
              <div className="mt-2">
                <Warn>{t('helpModal.step3Warn1')}</Warn>
              </div>
            </li>
            <li>{t('helpModal.step3Item7')}</li>
            <li>{t('helpModal.step3Item8')}</li>
            <li>
              {t('helpModal.step3Item9')}
              <div className="mt-2 space-y-2">
                <Warn>{t('helpModal.step3Warn2')}</Warn>
                <ul className="list-disc list-outside pl-5 space-y-1 marker:text-dim text-xs text-dim">
                  <li>{t('helpModal.step3Note1')}</li>
                  <li>{t('helpModal.step3Note2')}</li>
                </ul>
              </div>
            </li>
            <li>{t('helpModal.step3Item10')}</li>
          </Ordered>
        </StepSection>

        <StepSection number={4} title={t('helpModal.step4Title')}>
          <p className="text-sm text-text leading-relaxed break-words">
            {t('helpModal.step4Body')}
          </p>
          <p className="text-xs text-dim leading-relaxed break-words">
            {t('helpModal.step4Note')}
          </p>
        </StepSection>

        <div className="flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
          <Smartphone size={18} className="shrink-0 mt-0.5 text-sky-600" />
          <div className="min-w-0 text-sm text-text leading-relaxed break-words space-y-2">
            <div className="font-semibold">{t('helpModal.pwaTitle')}</div>
            <p className="text-xs text-dim">
              {t('helpModal.pwaBodyPre')}
              <Code>calendar.tuchenguang.com</Code>
              {t('helpModal.pwaBodyPost')}
            </p>

            <div className="space-y-2 text-xs">
              <div>
                <div className="text-text font-medium mb-0.5">
                  {t('helpModal.pwaIosTitle')}
                </div>
                <ol className="list-decimal list-outside pl-5 space-y-0.5 marker:text-dim text-dim">
                  <li>{t('helpModal.pwaIos1')}</li>
                  <li>{t('helpModal.pwaIos2')}</li>
                  <li>{t('helpModal.pwaIos3')}</li>
                </ol>
              </div>

              <div>
                <div className="text-text font-medium mb-0.5">
                  {t('helpModal.pwaAndroidChromeTitle')}
                </div>
                <ol className="list-decimal list-outside pl-5 space-y-0.5 marker:text-dim text-dim">
                  <li>{t('helpModal.pwaAndroidChrome1')}</li>
                  <li>{t('helpModal.pwaAndroidChrome2')}</li>
                  <li>{t('helpModal.pwaAndroidChrome3')}</li>
                </ol>
              </div>

              <div>
                <div className="text-text font-medium mb-0.5">
                  {t('helpModal.pwaAndroidEdgeTitle')}
                </div>
                <ol className="list-decimal list-outside pl-5 space-y-0.5 marker:text-dim text-dim">
                  <li>{t('helpModal.pwaAndroidEdge1')}</li>
                  <li>{t('helpModal.pwaAndroidEdge2')}</li>
                  <li>{t('helpModal.pwaAndroidEdge3')}</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
