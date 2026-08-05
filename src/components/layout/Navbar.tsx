import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { LogOut, User, Sun, Moon, Menu } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const NAV_LINKS = [
  { to: '/', label: 'Dashboard', end: true, adminOnly: false },
  { to: '/historial', label: 'Historial', end: false, adminOnly: true },
  { to: '/combustible', label: 'Combustible', end: false, adminOnly: false },
  { to: '/documentacion', label: 'Documentación', end: false, adminOnly: false },
  { to: '/incidencias', label: 'Incidencias', end: false, adminOnly: false },
  { to: '/reportes', label: 'Reportes', end: false, adminOnly: true },
  { to: '/admin', label: 'Admin', end: false, adminOnly: true },
]

export default function Navbar() {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const links = NAV_LINKS.filter((l) => !l.adminOnly || profile?.role === 'admin')

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'text-sm font-medium transition-colors hover:text-primary',
      isActive ? 'text-primary' : 'text-muted-foreground',
    )

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
      isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent',
    )

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6">
        {/* Menú hamburguesa: mobile */}
        <div className="sm:hidden">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent" aria-label="Menú">
                <Menu className="h-5 w-5" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={8}
                className="z-50 min-w-[180px] rounded-md border bg-background p-1 shadow-md"
              >
                {links.map((l) => (
                  <DropdownMenu.Item key={l.to} asChild>
                    <NavLink to={l.to} end={l.end} className={mobileLinkClass}>
                      {l.label}
                    </NavLink>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {/* Nav completa: desktop */}
        <nav className="hidden sm:flex items-center gap-6">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleTheme}
            aria-label="Cambiar tema"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:opacity-80"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:opacity-80">
                <User className="h-4 w-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 min-w-[200px] rounded-md border bg-popover bg-background p-1 shadow-md"
              >
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{profile?.full_name ?? 'Usuario'}</p>
                  <p className="text-xs capitalize text-muted-foreground">{profile?.role}</p>
                </div>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item
                  onSelect={() => setConfirmOpen(true)}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none hover:bg-accent"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar Sesión
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar sesión?</DialogTitle>
            <DialogDescription>Vas a tener que volver a ingresar tu email y contraseña.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => signOut()}>
              Cerrar Sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
