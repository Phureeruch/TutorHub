import type { RatedSubject } from '../../api/mockApi'
import type { TeachingLevel } from '../../types/types'
import { formatRate } from '../../utils/format'
import { LEVEL_LABEL } from '../../utils/levels'

export function SubjectLevels({ levels, subjectName }: { levels: TeachingLevel[]; subjectName: string }) {
  if (levels.length === 0) return null
  return (
    <ul className="th-level-list" aria-label={`Levels for ${subjectName}`}>
      {levels.map((level) => (
        <li key={level} className="th-level">
          {LEVEL_LABEL[level]}
        </li>
      ))}
    </ul>
  )
}

/** What a tutor teaches: each subject with its rate, levels and topics, so students can compare. */
export function SubjectList({ subjects }: { subjects: RatedSubject[] }) {
  return (
    <ul className="th-subject-list" aria-label="Subjects and rates">
      {subjects.map((s) => (
        <li key={s.id} className="th-subject">
          <div className="th-subject-head">
            <span className="th-subject-name">{s.name}</span>
            <span className="th-subject-rate">{formatRate(s.hourlyPrice)}</span>
          </div>
          <SubjectLevels levels={s.levels} subjectName={s.name} />
          {s.topics && <p className="th-subject-topics">{s.topics}</p>}
        </li>
      ))}
    </ul>
  )
}
