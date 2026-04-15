"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ReactNode } from "react"

interface AdminLayoutProps {
    children: ReactNode
    title: string
    subtitle?: string
}

export function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
    const pathname = usePathname()
    const router = useRouter()

    const { data: userData } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const res = await fetch("/api/auth/me")
            if (!res.ok) {
                router.push("/login?returnTo=/admin")
                return { user: null }
            }
            const data = await res.json()
            if (!data.user.isAdmin) {
                router.push("/")
                return { user: null }
            }
            return data
        },
        staleTime: 10 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    })

    const { data: requestsData } = useQuery({
        queryKey: ["admin", "join-requests"],
        queryFn: async () => {
            const res = await fetch("/api/admin/join-requests")
            if (!res.ok) return { total: 0 }
            return res.json()
        },
        enabled: !!userData?.user?.isAdmin,
        refetchInterval: 10000,
        staleTime: 5 * 1000,
    })

    const user = userData?.user ?? null
    const pendingCount = requestsData?.total || 0

    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" })
            router.push("/")
        } catch (err) {
            alert("Error al cerrar sesion")
        }
    }

    const menuItems = [
        { href: "/admin", label: "Dashboard", badge: null },
        { href: "/admin/news", label: "Noticias", badge: null },
        { href: "/admin/patchnotes", label: "Patch Notes", badge: null },
        { href: "/admin/users", label: "Usuarios", badge: null },
        { href: "/admin/clans", label: "Clanes", badge: null },
        { href: "/admin/solicitudes", label: "Solicitudes", badge: pendingCount },
        { href: "/admin/esport", label: "E-Sports", badge: null },
        { href: "/admin/pickban", label: "Pick/Ban", badge: null },
        { href: "/admin/linked-accounts", label: "Multi-Cuentas", badge: null },
        { href: "/admin/titles-badges", label: "Titulos", badge: null },
        { href: "/admin/banner", label: "Banner", badge: null },
        { href: "/admin/configs", label: "Configs", badge: null },
        { href: "/admin/server-permissions", label: "Servidores QL", badge: null },
        { href: "/admin/zmq", label: "ZMQ Receiver", badge: null },
        { href: "/admin/forum", label: "Foro", badge: null },
        { href: "/admin/polls", label: "Encuestas", badge: null },
        { href: "/admin/maintenance", label: "Sistema", badge: null },
        { href: "/admin/audit-log", label: "Auditoría", badge: null },
    ]

    const isActive = (href: string) => {
        if (href === "/admin") return pathname === "/admin"
        return pathname?.startsWith(href)
    }

    if (!user?.isAdmin) return null

    return (
        <main className="min-h-screen pt-8 pb-16 px-4">
            <div className="container mx-auto max-w-[1200px]">
                <div className="glass-card-elevated rounded-xl overflow-hidden animate-scale-fade">
                    <div className="flex flex-col lg:flex-row">
                        {/* SIDEBAR - Integrado dentro del card */}
                        <div className="lg:w-52 border-b lg:border-b-0 lg:border-r border-foreground/[0.06] bg-[var(--qc-bg-pure)]/50">
                            {/* Home Link */}
                            <div className="p-3 border-b border-foreground/[0.06]">
                                <Link
                                    href="/"
                                    className="flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-foreground/40 hover:text-foreground hover:bg-foreground/[0.03] transition-all rounded"
                                >
                                    <span>Ir al Home</span>
                                </Link>
                            </div>

                            {/* Navigation */}
                            <nav className="p-2 space-y-0.5 max-h-[calc(100vh-300px)] overflow-y-auto lg:max-h-none">
                                {menuItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center justify-between gap-2 px-3 py-2 text-[10px] font-medium uppercase tracking-wider transition-all rounded ${
                                            isActive(item.href)
                                                ? "bg-foreground/10 border-l-2 border-foreground text-foreground"
                                                : "text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.03] border-l-2 border-transparent"
                                        }`}
                                    >
                                        <span>{item.label}</span>
                                        {item.badge !== null && item.badge > 0 && (
                                            <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] bg-foreground text-white text-[8px] font-bold rounded-full px-1">
                                                {item.badge}
                                            </span>
                                        )}
                                    </Link>
                                ))}
                            </nav>

                            {/* Logout */}
                            <div className="p-2 border-t border-foreground/[0.06]">
                                <button
                                    onClick={handleLogout}
                                    className="w-full px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all rounded text-left"
                                >
                                    Cerrar Sesion
                                </button>
                            </div>
                        </div>

                        {/* MAIN CONTENT */}
                        <div className="flex-1 min-w-0">
                            {/* Header */}
                            <div className="px-6 py-5 border-b border-foreground/[0.06] bg-black/[0.01]">
                                <h1 className="text-lg font-bold uppercase tracking-wider text-foreground">
                                    {title}
                                </h1>
                                {subtitle && (
                                    <p className="text-[10px] text-foreground/30 mt-0.5">{subtitle}</p>
                                )}
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                {children}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}
