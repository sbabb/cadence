import { useMemo, useState } from 'react'
import { buildReportCard } from '../utils/reportCard.js'
import { exportReportCard } from '../utils/fileTransfer.js'

// A period's report card, opened from the period itself.
//
// The end-of-period recap used to be a single moment: shown once as a period
// closed, then gone. This is the same content, reachable for any period
// whenever you want it - and saveable as an image, which is the part the
// recap could never do.
//
// Opened from the period screen rather than from Trends or Settings, because
// both of those would have to answer "which period?" with a picker. Standing
// inside the period answers it for free.
export default function ReportCard({ period, reconciled, onBack }) {
  const card = useMemo(() => buildReportCard(period, reconciled), [period, reconciled])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setNote('')
    const result = await exportReportCard(card)
    setSaving(false)
    if (result === 'failed') setNote('Could not save the image.')
    else if (result === 'shared') setNote('Report card sent.')
    else if (result === 'downloaded') setNote('Saved to your downloads.')
    // 'cancelled' means the share sheet was dismissed, which is not a failure
    // and does not need to be announced.
  }

  return (
    <div className="screen report-card-screen">
      <h1 className="screen-title">{card.title}</h1>
      <p className="summary-range">{card.range}</p>

      <div className="summary-stat-list">
        {card.rows.map((row) => (
          <div className="summary-stat-row" key={row.label}>
            <span className="summary-stat-label">{row.label}</span>
            <span className="summary-stat-value">{row.value}</span>
          </div>
        ))}
      </div>

      <div className={`summary-assessment assessment-${card.assessment.tone}`}>
        {card.assessment.text}
      </div>

      <button type="button" className="primary-button" onClick={handleSave} disabled={saving}>
        {saving ? 'SAVING...' : 'SAVE AS IMAGE'}
      </button>
      {note && <p className="settings-saved-text">{note}</p>}

      <button className="cancel-button" onClick={onBack}>
        ‹ BACK
      </button>
    </div>
  )
}
