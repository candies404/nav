import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { commitFile, getFileContent } from '@/lib/storage'
import { parseSubmissionFromIssueBody } from '@/types/submission'
import {
    getSubmissionStore,
    saveSubmissionStore,
    setSubmissionStatus,
} from '@/lib/submissions-store'
import type {
    NavigationCategoryRaw,
    NavigationDataRaw,
    NavigationItemRaw,
    NavigationSubItemRaw,
} from '@/types/navigation'

export const runtime = 'edge'

interface RouteParams {
    params: Promise<{ number: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json(
                { success: false, message: '请先登录' },
                { status: 401 }
            )
        }

        const { number } = await params
        const submissionNumber = Number(number)
        const { action, reason } = await request.json()

        if (!action || !['approve', 'reject'].includes(action)) {
            return NextResponse.json(
                { success: false, message: '无效的操作' },
                { status: 400 }
            )
        }

        const store = await getSubmissionStore()
        const issue = store.submissions.find(item => item.number === submissionNumber)

        if (!issue) {
            return NextResponse.json(
                { success: false, message: '投稿不存在' },
                { status: 404 }
            )
        }

        const submissionData = issue.submissionData || parseSubmissionFromIssueBody(issue.body)
        if (!submissionData) {
            return NextResponse.json(
                { success: false, message: '无法解析投稿数据' },
                { status: 400 }
            )
        }

        if (action === 'approve') {
            const filePath = 'src/navsphere/content/navigation.json'
            const navigationData = await getFileContent(filePath) as NavigationDataRaw

            if (!navigationData || !Array.isArray(navigationData.navigationItems)) {
                return NextResponse.json(
                    { success: false, message: '无法读取导航数据' },
                    { status: 500 }
                )
            }

            const categoryId = submissionData.category
            const subcategoryId = submissionData.subcategory
            let targetCategory = navigationData.navigationItems.find(
                (item: NavigationItemRaw) => item.id === categoryId || item.title === categoryId
            ) as NavigationItemRaw | undefined

            if (!targetCategory) {
                targetCategory = navigationData.navigationItems[0]
            }

            if (!targetCategory) {
                return NextResponse.json(
                    { success: false, message: '导航分类不存在' },
                    { status: 400 }
                )
            }

            const newItem: NavigationSubItemRaw = {
                id: `${Date.now()}`,
                title: submissionData.title,
                href: submissionData.url,
                description: submissionData.description,
                icon: '/assets/images/default-website-icon.png',
                enabled: true
            }

            if (subcategoryId && targetCategory.subCategories) {
                const targetSubCategory = targetCategory.subCategories.find(
                    (sub: NavigationCategoryRaw) => sub.id === subcategoryId || sub.title === subcategoryId
                )
                if (targetSubCategory) {
                    targetSubCategory.items = targetSubCategory.items || []
                    targetSubCategory.items.push(newItem)
                } else {
                    targetCategory.items = targetCategory.items || []
                    targetCategory.items.push(newItem)
                }
            } else {
                targetCategory.items = targetCategory.items || []
                targetCategory.items.push(newItem)
            }

            await commitFile(
                filePath,
                JSON.stringify(navigationData, null, 2),
                `Add submission: ${submissionData.title}`
            )

            setSubmissionStatus(issue, 'approved')
            issue.submissionData = submissionData
            await saveSubmissionStore(store)

            return NextResponse.json({
                success: true,
                message: '投稿已通过，网站已添加到导航列表'
            })
        }

        setSubmissionStatus(issue, 'rejected')
        issue.submissionData = {
            ...submissionData,
            submitterNote: reason
                ? `${submissionData.submitterNote || ''}\n拒绝原因: ${reason}`.trim()
                : submissionData.submitterNote
        }
        await saveSubmissionStore(store)

        return NextResponse.json({
            success: true,
            message: '投稿已拒绝'
        })

    } catch (error) {
        console.error('Review submission error:', error)
        const errorMsg = error instanceof Error ? error.message : String(error)
        return NextResponse.json(
            { success: false, message: `审核失败: ${errorMsg}` },
            { status: 500 }
        )
    }
}
