"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { AdminLayout } from "@/components/admin-layout"
import { systemConfirm } from "@/components/ui/system-modal"
import { Switch } from "@/components/ui/switch"

interface ZmqServerRow {
  id: string
  name: string
  ip: string
  port: number
  gamePort: number | null
  password: string
  status: "CONNECTED" | "DISCONNECTED"
  enabled: boolean
  lastSeen: string | null
  addedBy: string | null
  notes: string | null
  serverType: "public" | "competitive"
  createdAt: string
  updatedAt: string
  liveConnected: boolean
  liveActive: boolean
  lastMessageType: string | null
}

interface FormState {
  name: string
  ip: string
  port: string
  gamePort: string
  password: string
  serverType: "public" | "competitive"
  enabled: boolean
  notes: string
}

const DEFAULT_IP = process.env.NEXT_PUBLIC_QLDS_DEFAULT_IP ?? ""

const panelCls = "rounded-lg border border-foreground/[0.06] bg-foreground/[0.02]"
const inputCls =
  "h-9 w-full rounded-lg border border-foreground/[0.06] bg-foreground/[0.03] px-3 text-xs text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/30"
const primaryButtonCls =
  "inline-flex items-center justify-center rounded-lg bg-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-background transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
const secondaryButtonCls =
  "inline-flex items-center justify-center rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-foreground/60 transition-all hover:bg-foreground/[0.06] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"

function createEmptyForm(ip = DEFAULT_IP): FormState {
  return {
    name: "",
    ip,
    port: "",
    gamePort: "",
    password: "",
    serverType: "public",
    enabled: true,
    notes: "",
  }
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Sin tráfico aún"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sin fecha"

  return date.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getStatusMeta(server: ZmqServerRow) {
  if (!server.enabled) {
    return {
      label: "Deshabilitado",
      className: "border-foreground/10 bg-foreground/[0.05] text-foreground/45",
      detail: "No se cargará al recargar el listener",
    }
  }

  if (server.liveActive) {
    return {
      label: "Activo",
      className: "border-green-500/30 bg-green-500/10 text-green-600",
      detail: server.lastMessageType || "Recibiendo eventos del match",
    }
  }

  if (server.liveConnected || server.status === "CONNECTED") {
    return {
      label: "Conectado",
      className: "border-sky-500/30 bg-sky-500/10 text-sky-600",
      detail: server.lastMessageType || "Socket enlazado",
    }
  }

  return {
    label: "Desconectado",
    className: "border-red-500/25 bg-red-500/10 text-red-500",
    detail: "Sin mensajes recientes",
  }
}

function getTypeMeta(serverType: ZmqServerRow["serverType"]) {
  if (serverType === "competitive") {
    return {
      label: "Competitivo",
      className: "border-foreground/12 bg-foreground/[0.06] text-foreground/70",
    }
  }

  return {
    label: "Publico",
    className: "border-foreground/[0.08] bg-foreground/[0.04] text-foreground/50",
  }
}

async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    return data?.error || fallback
  } catch {
    return fallback
  }
}

export default function AdminZmqPage() {
  const router = useRouter()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => createEmptyForm())
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "public" | "competitive">("all")
  const [submitting, setSubmitting] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [rowBusyId, setRowBusyId] = useState<string | null>(null)

  const { data: authData } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me")
      if (!res.ok) {
        router.push("/login?returnTo=/admin/zmq")
        throw new Error("Not authenticated")
      }

      const data = await res.json()
      if (!data.user.isAdmin) {
        router.push("/")
        throw new Error("Not admin")
      }

      return data
    },
    staleTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  const {
    data: serversData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["admin", "zmq"],
    queryFn: async () => {
      const res = await fetch("/api/admin/zmq")
      if (!res.ok) throw new Error("Failed to fetch ZMQ servers")
      return res.json() as Promise<{ servers: ZmqServerRow[] }>
    },
    enabled: !!authData?.user?.isAdmin,
    refetchInterval: 15000,
    staleTime: 10 * 1000,
    placeholderData: (previousData) => previousData,
  })

  const servers = serversData?.servers || []
  const visibleServers = servers.filter((server) => {
    const normalizedSearch = search.trim().toLowerCase()
    const matchesFilter = typeFilter === "all" || server.serverType === typeFilter

    if (!normalizedSearch) return matchesFilter

    return (
      matchesFilter &&
      `${server.name} ${server.ip} ${server.port} ${server.gamePort || ""} ${server.notes || ""}`
        .toLowerCase()
        .includes(normalizedSearch)
    )
  })

  const enabledServers = servers.filter((server) => server.enabled).length
  const connectedServers = servers.filter(
    (server) => server.enabled && (server.liveConnected || server.status === "CONNECTED"),
  ).length
  const activeServers = servers.filter((server) => server.liveActive).length
  const user = authData?.user

  function resetForm() {
    setEditingId(null)
    setForm(createEmptyForm(servers[0]?.ip || DEFAULT_IP))
  }

  function startEditing(server: ZmqServerRow) {
    setEditingId(server.id)
    setForm({
      name: server.name,
      ip: server.ip,
      port: String(server.port),
      gamePort: server.gamePort ? String(server.gamePort) : "",
      password: "",
      serverType: server.serverType,
      enabled: server.enabled,
      notes: server.notes || "",
    })

    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function reloadListener(showSuccessToast = true) {
    setReloading(true)
    try {
      const res = await fetch("/api/admin/zmq/reload", {
        method: "POST",
      })

      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "No se pudo recargar el listener ZMQ"))
      }

      if (showSuccessToast) {
        toast.success("Listener ZMQ recargado")
      }

      await refetch()
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo recargar el listener ZMQ"
      if (showSuccessToast) {
        toast.error(message)
      }
      return false
    } finally {
      setReloading(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedIp = form.ip.trim()
    const trimmedPort = form.port.trim()
    const trimmedPassword = form.password.trim()

    if (!trimmedIp || !trimmedPort) {
      toast.warning("Ingresa al menos IP y puerto ZMQ")
      return
    }

    if (!editingId && !trimmedPassword) {
      toast.warning("La contraseña es obligatoria al crear un servidor")
      return
    }

    const body: Record<string, unknown> = {
      ip: trimmedIp,
      port: trimmedPort,
      serverType: form.serverType,
      enabled: form.enabled,
      notes: form.notes.trim(),
      gamePort: form.gamePort.trim() || null,
    }

    if (form.name.trim()) body.name = form.name.trim()
    if (trimmedPassword) body.password = trimmedPassword

    setSubmitting(true)
    try {
      const res = await fetch(editingId ? `/api/admin/zmq/${editingId}` : "/api/admin/zmq", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "No se pudo guardar el servidor"))
      }

      await refetch()
      const reloaded = await reloadListener(false)

      if (editingId) {
        toast.success(reloaded ? "Servidor actualizado y listener recargado" : "Servidor actualizado")
      } else {
        toast.success(reloaded ? "Servidor agregado y listener recargado" : "Servidor agregado")
      }

      if (!reloaded) {
        toast.warning("El cambio quedó guardado, pero conviene recargar el listener manualmente")
      }

      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el servidor")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(server: ZmqServerRow) {
    const confirmed = await systemConfirm(
      `¿Eliminar "${server.name}" de la lista ZMQ?\n\nEsta acción lo quitará del receiver después de recargar el listener.`,
      "Eliminar servidor ZMQ",
    )

    if (!confirmed) return

    setRowBusyId(server.id)
    try {
      const res = await fetch(`/api/admin/zmq/${server.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "No se pudo eliminar el servidor"))
      }

      await refetch()
      const reloaded = await reloadListener(false)
      toast.success(reloaded ? "Servidor eliminado y listener recargado" : "Servidor eliminado")

      if (!reloaded) {
        toast.warning("El servidor fue eliminado, pero el listener necesita recarga manual")
      }

      if (editingId === server.id) {
        resetForm()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el servidor")
    } finally {
      setRowBusyId(null)
    }
  }

  async function handleToggleEnabled(server: ZmqServerRow, enabled: boolean) {
    setRowBusyId(server.id)
    try {
      const res = await fetch(`/api/admin/zmq/${server.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      })

      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "No se pudo actualizar el servidor"))
      }

      await refetch()
      const reloaded = await reloadListener(false)
      toast.success(
        reloaded
          ? `Servidor ${enabled ? "habilitado" : "deshabilitado"} y listener recargado`
          : `Servidor ${enabled ? "habilitado" : "deshabilitado"}`,
      )

      if (!reloaded) {
        toast.warning("El cambio quedó guardado, pero el listener necesita recarga manual")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el servidor")
      await refetch()
    } finally {
      setRowBusyId(null)
    }
  }

  if (!user?.isAdmin) {
    return null
  }

  return (
    <AdminLayout
      title="ZMQ Receiver"
      subtitle="Lista, agrega y administra los servidores que alimentan el receiver web"
    >
      <div className="space-y-6">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className={panelCls}>
            <div className="flex flex-col gap-2 border-b border-foreground/[0.06] px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                  {editingId ? "Editar servidor" : "Nuevo servidor"}
                </h2>
                <p className="mt-1 text-[10px] text-foreground/30">
                  Alta y edición manual de endpoints ZMQ. Los cambios se guardan en la base de datos.
                </p>
              </div>
              {editingId && (
                <span className="inline-flex rounded border border-foreground/[0.08] bg-foreground/[0.04] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground/55">
                  Edición activa
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-foreground/35">
                  Nombre visible
                </label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className={inputCls}
                  placeholder="www.quakeclub.com | Clan Arena #4"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="xl:col-span-2">
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-foreground/35">
                    IP
                  </label>
                  <input
                    value={form.ip}
                    onChange={(event) => setForm((current) => ({ ...current, ip: event.target.value }))}
                    className={inputCls}
                    placeholder={DEFAULT_IP}
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-foreground/35">
                    Puerto ZMQ
                  </label>
                  <input
                    value={form.port}
                    onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))}
                    className={inputCls}
                    inputMode="numeric"
                    placeholder="28976"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-foreground/35">
                    Puerto juego
                  </label>
                  <input
                    value={form.gamePort}
                    onChange={(event) => setForm((current) => ({ ...current, gamePort: event.target.value }))}
                    className={inputCls}
                    inputMode="numeric"
                    placeholder="27976"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-foreground/35">
                    Password ZMQ
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    className={inputCls}
                    placeholder={editingId ? "Dejar vacío para conservar la actual" : "quakeclub.com@stats"}
                  />
                  <p className="mt-1 text-[10px] text-foreground/25">
                    {editingId ? "Si no la cambias, se mantiene la actual." : "Obligatoria al crear el servidor."}
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-foreground/35">
                    Tipo
                  </label>
                  <select
                    value={form.serverType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        serverType: event.target.value === "competitive" ? "competitive" : "public",
                      }))
                    }
                    className={inputCls}
                  >
                    <option value="public">Publico</option>
                    <option value="competitive">Competitivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-foreground/35">
                  Notas
                </label>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className={`${inputCls} min-h-[110px] resize-y py-2`}
                  placeholder="Contexto interno para el equipo de administración."
                />
              </div>

              <div className="flex flex-col gap-4 border-t border-foreground/[0.06] pt-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center justify-between rounded-lg border border-foreground/[0.06] bg-foreground/[0.03] px-3 py-2.5 lg:min-w-[280px]">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">Habilitado</p>
                    <p className="mt-0.5 text-[10px] text-foreground/30">
                      Se cargará al recargar el listener.
                    </p>
                  </div>
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: checked }))}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={submitting} className={primaryButtonCls}>
                    {submitting ? "Guardando..." : editingId ? "Guardar cambios" : "Agregar servidor"}
                  </button>

                  {editingId && (
                    <button type="button" onClick={resetForm} className={secondaryButtonCls}>
                      Cancelar edición
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <div className={panelCls}>
              <div className="flex items-start justify-between gap-3 border-b border-foreground/[0.06] px-4 py-3">
                <div>
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Estado del receiver
                  </h2>
                  <p className="mt-1 text-[10px] text-foreground/30">
                    Estado del proceso web actual.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void reloadListener(true)}
                  disabled={reloading}
                  className={secondaryButtonCls}
                >
                  {reloading ? "Recargando..." : "Recargar listener"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 px-4 py-4">
                <StatTile label="Total" value={servers.length} />
                <StatTile label="Habilitados" value={enabledServers} />
                <StatTile label="Conectados" value={connectedServers} />
                <StatTile label="Activos" value={activeServers} tone="positive" />
              </div>
            </div>
          </div>
        </section>

        <section className={panelCls}>
          <div className="flex flex-col gap-4 border-b border-foreground/[0.06] px-4 py-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                Servidores configurados
              </h2>
              <p className="mt-1 text-[10px] text-foreground/30">
                Búsqueda por nombre, IP, puertos o notas. La tabla se refresca automáticamente.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row xl:min-w-[420px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={inputCls}
                placeholder="Buscar por nombre, IP o puerto"
              />

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(
                    event.target.value === "public" || event.target.value === "competitive"
                      ? event.target.value
                      : "all",
                  )
                }
                className={`${inputCls} sm:max-w-[180px]`}
              >
                <option value="all">Todos los tipos</option>
                <option value="public">Publico</option>
                <option value="competitive">Competitivo</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-foreground/[0.06] px-4 py-2 text-[10px] uppercase tracking-wider text-foreground/30">
            <span>
              Mostrando {visibleServers.length} de {servers.length}
            </span>
            <span>Actualización cada 15 segundos</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b border-foreground/[0.06] bg-foreground/[0.025]">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/35">Servidor</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/35">ZMQ</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/35">Juego</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/35">Tipo</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/35">Estado</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/35">Último tráfico</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/35">Habilitado</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/35">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="inline-flex items-center gap-3 text-xs text-foreground/40">
                        <span className="h-4 w-4 rounded-full border-2 border-foreground/20 border-t-foreground/60 animate-spin" />
                        Cargando servidores ZMQ...
                      </div>
                    </td>
                  </tr>
                ) : visibleServers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-xs text-foreground/30">
                      No hay servidores que coincidan con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  visibleServers.map((server) => {
                    const statusMeta = getStatusMeta(server)
                    const typeMeta = getTypeMeta(server.serverType)
                    const isBusy = rowBusyId === server.id

                    return (
                      <tr
                        key={server.id}
                        className={`border-b border-foreground/[0.06] align-top transition-colors ${
                          editingId === server.id ? "bg-foreground/[0.035]" : "hover:bg-foreground/[0.02]"
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <div className="min-w-[280px]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{server.name}</span>
                              {editingId === server.id && (
                                <span className="inline-flex rounded border border-foreground/[0.08] bg-foreground/[0.05] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-foreground/45">
                                  Editando
                                </span>
                              )}
                            </div>

                            <div className="mt-1 text-[10px] uppercase tracking-wider text-foreground/30">
                              {server.ip} · alta por {server.addedBy || "admin"}
                            </div>

                            {server.notes && (
                              <p className="mt-2 max-w-[420px] text-[11px] leading-relaxed text-foreground/55">
                                {server.notes}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="text-xs font-medium text-foreground">:{server.port}</span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="text-xs text-foreground/65">
                            {server.gamePort ? `:${server.gamePort}` : "—"}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${typeMeta.className}`}
                          >
                            {typeMeta.label}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="min-w-[150px] space-y-1">
                            <span
                              className={`inline-flex rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${statusMeta.className}`}
                            >
                              {statusMeta.label}
                            </span>
                            <p className="text-[10px] text-foreground/30">{statusMeta.detail}</p>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="min-w-[170px] text-[11px] text-foreground/55">
                            <div>{formatTimestamp(server.lastSeen)}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-wider text-foreground/25">
                              {server.lastMessageType || "Sin mensaje"}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={server.enabled}
                              disabled={isBusy}
                              onCheckedChange={(checked) => {
                                void handleToggleEnabled(server, checked)
                              }}
                            />
                            <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/45">
                              {server.enabled ? "Si" : "No"}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => startEditing(server)}
                              disabled={isBusy}
                              className={secondaryButtonCls}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(server)}
                              disabled={isBusy}
                              className="inline-flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-red-500 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "positive"
}) {
  return (
    <div className="rounded-lg border border-foreground/[0.06] bg-foreground/[0.03] px-4 py-3">
      <div className={`text-2xl font-bold ${tone === "positive" ? "text-green-600" : "text-foreground"}`}>
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-foreground/30">{label}</div>
    </div>
  )
}
