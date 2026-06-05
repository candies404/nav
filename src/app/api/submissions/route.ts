import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
    SubmissionData,
    SubmissionIssue,
    SUBMISSION_LABELS,
    generateIssueBody,
    parseSubmissionFromIssueBody
} from '@/types/submission'
import {
    createSubmissionLabel,
    getSubmissionStatus,
    getSubmissionStore,
    saveSubmissionStore,
} from '@/lib/submissions-store'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
    try {
        const data: SubmissionData = await request.json()

        if (!data.title || !data.url || !data.description || !data.category) {
            return NextResponse.json(
                { success: false, message: '请填写完整的投稿信息' },
                { status: 400 }
            )
        }

        try {
            new URL(data.url)
        } catch {
            return NextResponse.json(
                { success: false, message: '请输入有效的网站地址' },
                { status: 400 }
            )
        }

        const store = await getSubmissionStore()
        const now = new Date().toISOString()
        const issue: SubmissionIssue = {
            id: Date.now(),
            number: store.nextNumber,
            title: `[投稿] ${data.title}`,
            body: generateIssueBody(data),
            state: 'open',
            labels: [
                createSubmissionLabel(SUBMISSION_LABELS.SUBMISSION),
                createSubmissionLabel(SUBMISSION_LABELS.PENDING),
            ],
            created_at: now,
            updated_at: now,
            html_url: '',
            submissionData: data,
        }

        store.submissions.unshift(issue)
        store.nextNumber += 1
        await saveSubmissionStore(store)

        return NextResponse.json({
            success: true,
            message: '投稿成功！我们会尽快审核您的投稿',
            issueNumber: issue.number,
            issueUrl: issue.html_url
        })

    } catch (error) {
        console.error('Submission error:', error)
        return NextResponse.json(
            { success: false, message: '服务器错误，请稍后重试' },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json(
                { success: false, message: '请先登录' },
                { status: 401 }
            )
        }

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status') || 'pending'
        const store = await getSubmissionStore()

        const submissions = store.submissions
            .filter(issue => status === 'all' || getSubmissionStatus(issue) === status)
            .map((issue): SubmissionIssue => ({
                ...issue,
                submissionData: issue.submissionData || parseSubmissionFromIssueBody(issue.body) || undefined,
            }))

        return NextResponse.json({ success: true, submissions })

    } catch (error) {
        console.error('Get submissions error:', error)
        return NextResponse.json(
            { success: false, message: '获取投稿列表失败' },
            { status: 500 }
        )
    }
}
