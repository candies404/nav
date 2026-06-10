import { Metadata } from 'next/types'
import { Container } from '@/components/ui/container'
import { SubmissionForm } from '@/components/submission-form'
import { getFileContent } from '@/lib/storage'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/registry/new-york/ui/button'
import { NavigationData } from '@/types/navigation'

export const metadata: Metadata = {
    title: '网站投稿 - NavSphere',
    description: '向 NavSphere 投稿优质网站，分享好资源'
}

export default async function SubmitPage() {
    const navigationData = await getFileContent('src/navsphere/content/navigation.json') as NavigationData

    return (
        <Container>
            <div className="min-h-screen px-1 py-4 sm:px-4 sm:py-8">
                {/* 返回按钮 */}
                <div className="mx-auto mb-4 max-w-2xl sm:mb-6">
                    <Link href="/">
                        <Button variant="ghost" className="gap-2 hover:bg-muted">
                            <ArrowLeft className="h-4 w-4" />
                            返回首页
                        </Button>
                    </Link>
                </div>

                {/* 投稿表单 */}
                <SubmissionForm navigationData={navigationData as unknown as NavigationData} />

                {/* 投稿说明 */}
                <div className="mx-auto mt-6 max-w-2xl rounded-xl bg-muted/50 p-4 sm:mt-8 sm:p-6">
                    <h3 className="font-semibold mb-3">📋 投稿须知</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex gap-2">
                            <span className="text-primary">•</span>
                            <span>请确保提交的网站内容合法、健康、有价值</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-primary">•</span>
                            <span>网站地址请填写完整的 URL（包含 https://）</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-primary">•</span>
                            <span>网站描述请简洁明了，突出网站的核心功能和特点</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-primary">•</span>
                            <span>投稿提交后将在后台审核列表中管理</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-primary">•</span>
                            <span>我们会尽快审核您的投稿，审核通过后将添加到导航列表</span>
                        </li>
                    </ul>
                </div>
            </div>
        </Container>
    )
}
