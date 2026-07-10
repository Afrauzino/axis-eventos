// Desbloqueio por digital (biometria do próprio aparelho — WebAuthn).
// É uma TRAVA LOCAL: a sessão do Supabase já fica salva no aparelho; a digital só
// destrava o app na abertura. Nada é enviado ao servidor (a credencial fica só aqui).

const KEY_CRED = (uid: string) => `axis_bio_cred_${uid}`

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
function fromB64(s: string): Uint8Array {
  const raw = atob(s)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}
function rand(n: number): Uint8Array {
  const a = new Uint8Array(n)
  crypto.getRandomValues(a)
  return a
}

// O aparelho tem leitor de digital/rosto usável no navegador?
export async function biometriaSuportada(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !('PublicKeyCredential' in window)) return false
    return await (window as any).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch { return false }
}

// Este usuário já ativou a digital NESTE aparelho?
export function biometriaAtiva(userId?: string): boolean {
  if (!userId) return false
  try { return !!localStorage.getItem(KEY_CRED(userId)) } catch { return false }
}

// Ativa: registra a digital do aparelho e guarda a credencial localmente.
export async function ativarBiometria(userId: string, nome?: string): Promise<boolean> {
  try {
    if (!userId || !(await biometriaSuportada())) return false
    const userIdBytes = new TextEncoder().encode(userId).slice(0, 64)
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: rand(32) as BufferSource,
        rp: { name: 'AXIS Eventos' },
        user: { id: userIdBytes as BufferSource, name: nome || userId, displayName: nome || 'Usuário AXIS' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000,
        attestation: 'none',
      },
    }) as PublicKeyCredential | null
    if (!cred) return false
    localStorage.setItem(KEY_CRED(userId), b64(cred.rawId))
    return true
  } catch (e) {
    console.warn('biometria: não foi possível ativar', e)
    return false
  }
}

// Pede a digital para destravar. true = confirmou.
export async function verificarBiometria(userId: string): Promise<boolean> {
  try {
    const stored = localStorage.getItem(KEY_CRED(userId))
    if (!stored) return false
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: rand(32) as BufferSource,
        allowCredentials: [{ type: 'public-key', id: fromB64(stored) as BufferSource, transports: ['internal'] as AuthenticatorTransport[] }],
        userVerification: 'required',
        timeout: 60000,
      },
    })
    return !!assertion
  } catch (e) {
    console.warn('biometria: verificação falhou/cancelada', e)
    return false
  }
}

// Desativa (remove a credencial deste aparelho).
export function desativarBiometria(userId: string): void {
  try { localStorage.removeItem(KEY_CRED(userId)) } catch {}
}
