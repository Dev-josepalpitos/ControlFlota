import { useEffect, useState, FormEvent } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Profile } from '@/types/database'

const emptyForm = { email: '', password: '', full_name: '', role: 'driver' as 'driver' | 'admin' }

export default function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').order('full_name')
    if (!error && data) setUsers(data as Profile[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleRole(user: Profile) {
    const newRole = user.role === 'admin' ? 'driver' : 'admin'
    setUpdatingId(user.id)
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id)
    setUpdatingId(null)

    if (error) {
      toast.error('No se pudo actualizar el rol', { description: error.message })
      return
    }
    toast.success(`${user.full_name} ahora es ${newRole === 'admin' ? 'administrador' : 'conductor'}`)
    load()
  }

  async function toggleActive(user: Profile) {
    const newActive = !user.is_active
    setUpdatingId(user.id)
    const { error } = await supabase.from('profiles').update({ is_active: newActive }).eq('id', user.id)
    setUpdatingId(null)

    if (error) {
      toast.error('No se pudo actualizar el acceso', { description: error.message })
      return
    }
    toast.success(newActive ? `${user.full_name} habilitado` : `${user.full_name} deshabilitado`, {
      description: newActive ? 'Ya puede iniciar sesión.' : 'Se cerró su sesión y no puede volver a entrar.',
    })
    load()
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!form.email || !form.password || !form.full_name) {
      toast.error('Completá email, contraseña y nombre.')
      return
    }
    if (form.password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setCreating(true)
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: form,
    })
    setCreating(false)

    if (error || data?.error) {
      toast.error('No se pudo crear el usuario', { description: data?.error ?? error?.message })
      return
    }

    toast.success(`Usuario ${form.full_name} creado`, {
      description: `Ya puede iniciar sesión con ${form.email}`,
    })
    setModalOpen(false)
    setForm(emptyForm)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Creá usuarios nuevos y asigná su perfil (conductor o administrador). Un conductor solo puede cargar
          combustible en el vehículo del que tiene la llave retirada en ese momento.
        </p>
        <Button onClick={() => setModalOpen(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Nuevo Usuario
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className={`flex items-center justify-between rounded-lg border p-4 ${!u.is_active ? 'opacity-60' : ''}`}>
              <div>
                <p className="font-medium">{u.full_name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant={u.role === 'admin' ? 'default' : 'outline'} className="capitalize">
                    {u.role}
                  </Badge>
                  {!u.is_active && <Badge variant="destructive">Deshabilitado</Badge>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" loading={updatingId === u.id} onClick={() => toggleRole(u)}>
                  {u.role === 'admin' ? 'Quitar Admin' : 'Hacer Admin'}
                </Button>
                <Button
                  size="sm"
                  variant={u.is_active ? 'outline' : 'default'}
                  loading={updatingId === u.id}
                  onClick={() => toggleActive(u)}
                >
                  {u.is_active ? 'Deshabilitar' : 'Habilitar'}
                </Button>
              </div>
            </div>
          ))}
          {users.length === 0 && <p className="text-muted-foreground">No hay usuarios todavía.</p>}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
            <DialogDescription>Se crea con acceso inmediato (no necesita confirmar email).</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre completo</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Juan Pérez" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="juan@flota.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Contraseña</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil</Label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as 'driver' | 'admin' })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="driver">Conductor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={creating}>
                Crear Usuario
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
