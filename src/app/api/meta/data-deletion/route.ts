import { NextResponse } from 'next/server'

const instructionsUrl = 'https://legalhubcrm.com/delete-data'
const confirmationCode = 'legalhub-data-deletion-request'

function dataDeletionResponse() {
  return NextResponse.json({
    url: instructionsUrl,
    confirmation_code: confirmationCode,
  })
}

export async function GET() {
  return dataDeletionResponse()
}

export async function POST() {
  return dataDeletionResponse()
}
