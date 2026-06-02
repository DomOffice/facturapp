// src/app/api/logo/route.ts
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo', 'logo.png')
    if (!fs.existsSync(logoPath)) {
      return NextResponse.json({ error: 'Logo non trouvé' }, { status: 404 })
    }
    const logoBuffer = fs.readFileSync(logoPath)
    const logoBase64 = logoBuffer.toString('base64')
    return NextResponse.json({ dataUrl: `data:image/png;base64,${logoBase64}` })
  } catch {
    return NextResponse.json({ error: 'Erreur lecture logo' }, { status: 500 })
  }
}
