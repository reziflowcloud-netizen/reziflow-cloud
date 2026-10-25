'use client'
import Link from 'next/link'
import { prepareScreenLeave } from '@/lib/screenLeave'
import { metaMessageText } from '@/lib/metaMessageI18n'
export default function MetaUnreadBadge({ lead, lang }: { lead: any; lang: 'ru'|'uk'|'pl' }) {
 if (!lead.metaUnreadCount) return null
 const label = `${metaMessageText[lang].unread}: ${lead.metaUnreadCount}`
 return <Link href={`/leads/${encodeURIComponent(lead.id)}?conversation=1`} onKeyDown={event => event.stopPropagation()} onClick={async event => { event.stopPropagation(); event.preventDefault(); if (await prepareScreenLeave()) window.location.assign(`/leads/${encodeURIComponent(lead.id)}?conversation=1`) }} aria-label={label} title={label} className="meta-unread-badge"><span aria-hidden="true">✉</span> {lead.metaUnreadCount}</Link>
}
