import type { ProgressDialogUpdateOptions, ProgressSummaryOptions } from '../shared/types'
import { strings } from '../shared/strings'
import { escapeHtml, safeUrl } from '../shared/utils'

export class ProgressDialog {
  private overlay: HTMLElement | null = null
  private cancelled: boolean = false

  public show(options: {
    title: string
    current?: number
    total?: number
    showCancel?: boolean
    onCancel?: () => void
  }): void {
    this.cancelled = false
    this.hide()

    const overlay = document.createElement('div')
    overlay.className = 'bcd-progress-overlay'

    const dialog = document.createElement('div')
    dialog.className = 'bcd-progress-dialog'

    const { current = 0, total = 100, showCancel = true } = options
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0

    dialog.innerHTML = `
      <p class="bcd-progress-title">${escapeHtml(options.title)}</p>
      <p class="bcd-progress-description"></p>
      <div class="bcd-progress-bar-container">
        <div class="bcd-progress-bar" style="width: ${percentage}%"></div>
      </div>
      <p class="bcd-progress-text">${current} / ${total} (${percentage}%)</p>
      ${showCancel ? `<button class="bcd-progress-cancel">${strings.t('common.cancel')}</button>` : ''}
    `

    overlay.appendChild(dialog)
    document.body.appendChild(overlay)
    this.overlay = overlay

    if (showCancel) {
      const cancelBtn = dialog.querySelector('.bcd-progress-cancel')
      cancelBtn?.addEventListener('click', () => {
        this.cancelled = true
        options.onCancel?.()
        this.hide()
      })
    }
  }

  public update(options: ProgressDialogUpdateOptions): void {
    if (!this.overlay) {
      return
    }

    const { current, total, title, description } = options
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0
    const bar = this.overlay.querySelector('.bcd-progress-bar') as HTMLElement
    const text = this.overlay.querySelector('.bcd-progress-text')
    const titleEl = this.overlay.querySelector('.bcd-progress-title')
    const descEl = this.overlay.querySelector('.bcd-progress-description')

    if (bar) {
      bar.style.width = `${percentage}%`
    }
    if (text) {
      text.textContent = `${current} / ${total} (${percentage}%)`
    }
    if (title && titleEl) {
      titleEl.textContent = title
    }
    if (description && descEl) {
      descEl.textContent = description
    }
  }

  public hide(): void {
    if (this.overlay) {
      this.overlay.remove()
      this.overlay = null
    }
  }

  public isCancelled(): boolean {
    return this.cancelled
  }

  public showSummary(options: ProgressSummaryOptions): void {
    if (!this.overlay) {
      return
    }

    const dialog = this.overlay.querySelector('.bcd-progress-dialog')
    if (!dialog) {
      return
    }

    const summaryLines = Array.isArray(options.summary)
      ? options.summary
      : [options.summary]

    const summaryHtml = summaryLines
      .map(line => `<p class="bcd-progress-summary-line">${line}</p>`)
      .join('')

    const releases = options.foundReleases ?? []
    const releasesHtml = releases.length > 0
      ? `<ul class="bcd-progress-found-releases">${
        releases.map(r => `<li><a href="${safeUrl(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.title)} — ${escapeHtml(r.artist)}</a></li>`).join('')
      }</ul>`
      : ''

    dialog.innerHTML = `
      <p class="bcd-progress-title">${escapeHtml(options.title)}</p>
      <div class="bcd-progress-summary">
        ${summaryHtml}
      </div>
      ${releasesHtml}
      <button class="bcd-progress-ok">${strings.t('common.ok')}</button>
    `

    const okBtn = dialog.querySelector('.bcd-progress-ok')
    okBtn?.addEventListener('click', () => {
      options.onClose?.()
      this.hide()
    })
  }
}
