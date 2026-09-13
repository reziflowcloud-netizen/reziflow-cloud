import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  buildConferenceDedupeKey,
  cleanConferenceValue,
  type ConferenceAttribution,
  type ConferenceDemoOrigin,
  type ConferenceEventName,
  type ConferenceLanguage,
} from '@/lib/conferenceTrackingCore'

type RecordConferenceEventInput = {
  eventName: ConferenceEventName
  attribution: ConferenceAttribution
  language: ConferenceLanguage
  ctaLocation?: string | null
  demoOrigin?: ConferenceDemoOrigin | null
  metadata?: Prisma.InputJsonValue
  registrationOrganizationId?: string | null
  createdAt?: Date
}

function anonymousRegistrationKey(organizationId: string) {
  return createHash('sha256').update(`conference-registration:${organizationId}`).digest('hex').slice(0, 32)
}

export async function recordConferenceEvent(input: RecordConferenceEventInput) {
  const registrationKey = input.registrationOrganizationId
    ? anonymousRegistrationKey(input.registrationOrganizationId)
    : null
  const dedupeKey = buildConferenceDedupeKey({
    eventName: input.eventName,
    anonymousSessionId: input.attribution.attributionId,
    createdAt: input.createdAt,
    ctaLocation: input.ctaLocation,
    demoOrigin: input.demoOrigin,
    registrationKey,
  })

  try {
    await prisma.conferenceEvent.create({
      data: {
        eventName: input.eventName,
        dedupeKey,
        anonymousSessionId: input.attribution.attributionId,
        utmSource: input.attribution.utmSource,
        utmMedium: input.attribution.utmMedium,
        utmCampaign: input.attribution.utmCampaign,
        utmContent: input.attribution.utmContent,
        utmTerm: input.attribution.utmTerm,
        language: input.language,
        ctaLocation: cleanConferenceValue(input.ctaLocation, 48),
        demoOrigin: input.demoOrigin || null,
        metadata: input.metadata,
        createdAt: input.createdAt,
      },
    })
    return 'created' as const
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return 'duplicate' as const
    }
    throw error
  }
}
