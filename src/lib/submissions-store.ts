import { commitFile, getFileContent } from '@/lib/storage'
import {
  SUBMISSION_LABELS,
  SubmissionIssue,
} from '@/types/submission'

export type SubmissionStore = {
  nextNumber: number
  submissions: SubmissionIssue[]
}

const SUBMISSIONS_PATH = 'src/navsphere/content/submissions.json'

export function createSubmissionLabel(name: string) {
  const colorMap: Record<string, string> = {
    [SUBMISSION_LABELS.SUBMISSION]: '0366d6',
    [SUBMISSION_LABELS.PENDING]: 'fbca04',
    [SUBMISSION_LABELS.APPROVED]: '2ea44f',
    [SUBMISSION_LABELS.REJECTED]: 'd73a49',
  }

  return {
    name,
    color: colorMap[name] || '6a737d',
  }
}

export async function getSubmissionStore(): Promise<SubmissionStore> {
  const data = await getFileContent(SUBMISSIONS_PATH) as Partial<SubmissionStore>

  if (!Array.isArray(data.submissions)) {
    return {
      nextNumber: 1,
      submissions: [],
    }
  }

  return {
    nextNumber: typeof data.nextNumber === 'number' ? data.nextNumber : data.submissions.length + 1,
    submissions: data.submissions,
  }
}

export async function saveSubmissionStore(store: SubmissionStore) {
  await commitFile(
    SUBMISSIONS_PATH,
    JSON.stringify(store, null, 2),
    'Update submissions'
  )
}

export function getSubmissionStatus(issue: SubmissionIssue) {
  const labels = issue.labels.map(label => label.name)

  if (labels.includes(SUBMISSION_LABELS.APPROVED)) return 'approved'
  if (labels.includes(SUBMISSION_LABELS.REJECTED)) return 'rejected'

  return 'pending'
}

export function setSubmissionStatus(issue: SubmissionIssue, status: 'pending' | 'approved' | 'rejected') {
  const statusLabel = status === 'approved'
    ? SUBMISSION_LABELS.APPROVED
    : status === 'rejected'
      ? SUBMISSION_LABELS.REJECTED
      : SUBMISSION_LABELS.PENDING

  issue.labels = [
    createSubmissionLabel(SUBMISSION_LABELS.SUBMISSION),
    createSubmissionLabel(statusLabel),
  ]
  issue.state = status === 'pending' ? 'open' : 'closed'
  issue.updated_at = new Date().toISOString()
}
