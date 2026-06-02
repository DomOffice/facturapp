// src/app/api/admin/sync-mariadb/route.ts
// API sync bidirectionnelle PostgreSQL ↔ MariaDB

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export async function POST(req: NextRequest) {
  // Vérifier authentification admin
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const role = (session.user as { role?: string }).role
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
  }

  const { direction } = await req.json() as { direction: 'pg-to-maria' | 'maria-to-pg' }

  // Choisir le bon script selon le sens
  const scriptName = direction === 'pg-to-maria'
    ? 'sync-pg-to-mariadb.ts'
    : 'sync-mariadb-to-pg.ts'

  const scriptPath = path.join(process.cwd(), 'prisma', scriptName)
  const startTime = Date.now()

  try {
    // Extraire les credentials depuis DATABASE_URL
      // Format : postgresql://user:password@host:port/database
      const dbUrl = process.env.DATABASE_URL ?? ''
      const dbMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
      const pgUser = dbMatch?.[1] ?? 'postgres'
      const pgPassword = dbMatch?.[2] ?? ''
      const pgHost = dbMatch?.[3] ?? '127.0.0.1'
      const pgPort = dbMatch?.[4] ?? '5432'
      const pgDatabase = dbMatch?.[5] ?? 'facturapp_db'
    const { stdout, stderr } = await execAsync(
      `npx tsx "${scriptPath}"`,
      {
        cwd: process.cwd(),
        timeout: 120000, // 2 minutes max
        

      env: {
        ...process.env,
        PGHOST: pgHost,
        PGPORT: pgPort,
        PGDATABASE: pgDatabase,
        PGUSER: pgUser,
        PGPASSWORD: pgPassword,
        MYSQL_HOST: process.env.MYSQL_HOST ?? '127.0.0.1',
        MYSQL_PORT: process.env.MYSQL_PORT ?? '3306',
        MYSQL_DATABASE: process.env.MYSQL_DATABASE ?? 'erp2026',
        MYSQL_USER: process.env.MYSQL_USER ?? 'root',
        MYSQL_PASSWORD: process.env.MYSQL_PASSWORD ?? '',
      },
      }
    )

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      log: stdout.split('\n').filter(l => l.trim()),
      warnings: stderr ? stderr.split('\n').filter(l => l.trim()) : [],
    })
  } catch (err: unknown) {
    const error = err as { message?: string; stdout?: string; stderr?: string }
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    return NextResponse.json({
      success: false,
      duration: `${duration}s`,
      error: error.message ?? 'Erreur inconnue',
      log: error.stdout?.split('\n').filter(l => l.trim()) ?? [],
    }, { status: 500 })
  }
}
