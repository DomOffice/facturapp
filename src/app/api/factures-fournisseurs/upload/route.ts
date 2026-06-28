    // src/app/api/factures-fournisseurs/upload/route.ts
    
    import type { NextRequest } from 'next/server'
    import { NextResponse } from 'next/server'
    import { auth } from '@/lib/auth/auth'
    import { writeFile, mkdir } from 'fs/promises'
    import { existsSync } from 'fs'
    import path from 'path'
    import { randomUUID } from 'crypto'
    // 添加 getToken 导入
    import { getToken } from 'next-auth/jwt'
    
    export const dynamic = 'force-dynamic'
    
    const UPLOAD_DIR = process.env.UPLOAD_DIR || 'C:\Users\Berrada\Documents\facturapp_uploads'
    const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 Mo
    const MIME_AUTORISES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    const EXT_AUTORISEES: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
    }
    
    export async function POST(req: NextRequest) {
      try {
        // ── Authentification & permissions ──────────────────────────────
        // 使用 getToken 替换 auth 函数（如果需要的话）
        // const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        
        // 或者继续使用现有的 auth 函数
        const session = await auth()
        if (!session?.user) {
          return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
        }
        // Added null check to prevent accessing role property on undefined
        const userRole = (session.user as { role?: string }).role;
        if (!userRole || !['ADMIN', 'SAISIE'].includes(userRole)) {
          return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
        }
    
        // ── Lecture du FormData ──────────────────────────────────────────
        const formData = await req.formData()
        const fichier = formData.get('fichier') as File | null
    
        if (!fichier) {
          return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 })
        }
    
        // ── Validation MIME ──────────────────────────────────────────────
        if (!MIME_AUTORISES.includes(fichier.type)) {
          return NextResponse.json(
            { error: 'Format non autorisé. Formats acceptés : PDF, JPEG, PNG' },
            { status: 400 }
          )
        }
    
        // ── Validation taille ────────────────────────────────────────────
        if (fichier.size > MAX_SIZE_BYTES) {
          return NextResponse.json(
            { error: 'Fichier trop volumineux. Taille maximale : 10 Mo' },
            { status: 400 }
          )
        }
    
        // ── Préparation du dossier de destination ────────────────────────
        const aujourdhui = new Date()
        const sousRep = path.join(
          UPLOAD_DIR,
          String(aujourdhui.getFullYear()),
          String(aujourdhui.getMonth() + 1).padStart(2, '0')
        )
    
        if (!existsSync(sousRep)) {
          await mkdir(sousRep, { recursive: true })
        }
    
        // ── Génération du nom de fichier sécurisé ────────────────────────
        const extension = EXT_AUTORISEES[fichier.type]
        const nomStocke = `${randomUUID()}${extension}`
        const cheminComplet = path.join(sousRep, nomStocke)
    
        // ── Écriture sur disque ──────────────────────────────────────────
        const buffer = Buffer.from(await fichier.arrayBuffer())
        await writeFile(cheminComplet, buffer)
    
        // ── Réponse ──────────────────────────────────────────────────────
        return NextResponse.json({
          success: true,
          fichier: {
            nomOriginal: fichier.name,
            nomStocke,
            chemin: cheminComplet,
            typeMime: fichier.type,
            taille: fichier.size,
          },
        })
      } catch (error) {
        console.error('[UPLOAD] Erreur:', error)
        return NextResponse.json(
          { error: 'Erreur serveur lors de l\'upload' },
          { status: 500 }
        )
      }
    }