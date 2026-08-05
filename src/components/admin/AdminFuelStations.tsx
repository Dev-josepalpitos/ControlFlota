import { useEffect, useState, FormEvent } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { FuelStation } from '@/types/database'

export default function AdminFuelStations() {
  const [stations, setStations] = useState<FuelStation[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('fuel_stations').select('*').order('name')
    if (!error && data) setStations(data as FuelStation[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return

    setAdding(true)
    const { error } = await supabase.from('fuel_stations').insert({ name: newName.trim() })
    setAdding(false)

    if (error) {
      toast.error('No se pudo agregar', { description: error.message })
      return
    }

    toast.success('Estación agregada')
    setNewName('')
    load()
  }

  function startEdit(s: FuelStation) {
    setEditingId(s.id)
    setEditingName(s.name)
  }

  async function saveEdit(id: string) {
    if (!editingName.trim()) return
    const { error } = await supabase.from('fuel_stations').update({ name: editingName.trim() }).eq('id', id)
    if (error) {
      toast.error('No se pudo editar', { description: error.message })
      return
    }
    setEditingId(null)
    load()
  }

  async function toggleActive(s: FuelStation) {
    const { error } = await supabase.from('fuel_stations').update({ is_active: !s.is_active }).eq('id', s.id)
    if (error) {
      toast.error('No se pudo actualizar', { description: error.message })
      return
    }
    load()
  }

  async function remove(s: FuelStation) {
    const { error } = await supabase.from('fuel_stations').delete().eq('id', s.id)
    if (error) {
      toast.error('No se pudo borrar (puede tener cargas asociadas)', { description: error.message })
      return
    }
    toast.success('Estación eliminada')
    load()
  }

  if (loading) {
    return (
      <div className="space-y-2 max-w-md">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-md space-y-4">
      <p className="text-sm text-muted-foreground">
        Estas son las opciones que van a aparecer en el desplegable al registrar una carga de combustible.
      </p>

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre de la estación" />
        <Button type="submit" loading={adding} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> Agregar
        </Button>
      </form>

      <div className="space-y-2">
        {stations.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
            {editingId === s.id ? (
              <div className="flex items-center gap-2 flex-1">
                <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="h-8" autoFocus />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(s.id)}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className={!s.is_active ? 'text-muted-foreground line-through' : ''}>{s.name}</span>
                  {!s.is_active && <Badge variant="outline">Inactiva</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(s)} className="text-xs h-8">
                    {s.is_active ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(s)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
        {stations.length === 0 && <p className="text-sm text-muted-foreground">No hay estaciones cargadas.</p>}
      </div>
    </div>
  )
}
