import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' && body.email.trim()
      ? body.email.trim().toLowerCase()
      : null
    const password = typeof body.password === 'string' ? body.password : null

    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
    }

    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null
    const image = typeof body.image === 'string' && body.image.trim() ? body.image.trim() : null
    const provider = typeof body.provider === 'string' && body.provider.trim() ? body.provider.trim() : 'credentials'

    // Check if user already exists
    const existingUser = await db.user.findUnique({ where: { email } })

    if (existingUser) {
      // Existing user: verify password
      if (!existingUser.password) {
        // User registered via Google or demo without password
        return NextResponse.json({ error: 'Email ini terdaftar via Google. Silakan login dengan Google.' }, { status: 400 })
      }
      const valid = await bcrypt.compare(password, existingUser.password)
      if (!valid) {
        return NextResponse.json({ error: 'Password salah' }, { status: 401 })
      }
      // Update name/image if provided
      if (name || image) {
        await db.user.update({
          where: { id: existingUser.id },
          data: { ...(name ? { name } : {}), ...(image ? { image } : {}) },
        })
      }
      await createSession(existingUser.id)
      const { password: _, ...safeUser } = existingUser
      return NextResponse.json({ user: safeUser })
    }

    // New user: hash password and create
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await db.user.create({
      data: {
        email,
        name: name ?? email.split('@')[0],
        image: image ?? null,
        provider,
        password: hashedPassword,
      },
    })

    await createSession(user.id)
    const { password: _, ...safeNewUser } = user
    return NextResponse.json({ user: safeNewUser })
  } catch (e) {
    console.error('[auth/login]', e)
    return NextResponse.json({ error: 'Gagal masuk' }, { status: 500 })
  }
}
