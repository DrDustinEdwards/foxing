'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  deletePostFromReport,
  dismissReport,
  warnUser,
} from './actions'

interface Props {
  reportId: string
  postId: string | null
  authorId: string | null
  reason: string
}

export function ReportActions({ reportId, postId, authorId, reason }: Props) {
  const [pending, setPending] = useState<'dismiss' | 'delete' | 'warn' | null>(
    null,
  )

  async function handleDismiss() {
    setPending('dismiss')
    const fd = new FormData()
    fd.set('reportId', reportId)
    await dismissReport(fd)
    setPending(null)
  }

  async function handleDelete() {
    if (!postId) return
    if (!window.confirm('Delete the reported post and resolve the report?'))
      return
    setPending('delete')
    const fd = new FormData()
    fd.set('reportId', reportId)
    fd.set('postId', postId)
    await deletePostFromReport(fd)
    setPending(null)
  }

  async function handleWarn() {
    if (!authorId) return
    setPending('warn')
    const fd = new FormData()
    fd.set('reportId', reportId)
    fd.set('authorId', authorId)
    fd.set('reason', reason)
    await warnUser(fd)
    setPending(null)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDismiss}
        loading={pending === 'dismiss'}
      >
        Dismiss
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleWarn}
        disabled={!authorId}
        loading={pending === 'warn'}
      >
        Warn user
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={handleDelete}
        disabled={!postId}
        loading={pending === 'delete'}
      >
        Delete post
      </Button>
    </>
  )
}
