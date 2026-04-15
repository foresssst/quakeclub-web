"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"
import { TitleLibraryManager } from "@/components/title-library-manager"
import { BadgeLibraryManager } from "@/components/badge-library-manager"
import { AwardTitleForm } from "@/components/award-title-form"
import { AwardBadgeForm } from "@/components/award-badge-form"
import { ManagePlayerTitles } from "@/components/manage-player-titles"
import { ManagePlayerBadges } from "@/components/manage-player-badges"

type MainTab = "library" | "assign" | "manage"
type SubTab = "titles" | "badges"

export default function AdminTitlesAndBadgesPage() {
    const [activeTab, setActiveTab] = useState<MainTab>("library")
    const [activeSubTab, setActiveSubTab] = useState<SubTab>("titles")

    const router = useRouter()

    const { data: authData } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const res = await fetch("/api/auth/me")
            if (!res.ok) {
                router.push("/login?returnTo=/admin/titles-badges")
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
    })

    const user = authData?.user

    if (!user?.isAdmin) return null

    const mainTabs: { value: MainTab; label: string }[] = [
        { value: "library", label: "Biblioteca" },
        { value: "assign", label: "Otorgar" },
        { value: "manage", label: "Gestionar" },
    ]

    return (
        <AdminLayout title="Titulos y Medallas" subtitle="Gestionar biblioteca de titulos y badges">
            {/* Main Tabs */}
                            <div className="flex gap-2 mb-6">
                                {mainTabs.map((tab) => (
                                    <button
                                        key={tab.value}
                                        onClick={() => setActiveTab(tab.value)}
                                        className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all font-tiktok rounded-lg ${activeTab === tab.value
                                            ? "bg-foreground text-white"
                                            : "bg-foreground/[0.02] border border-foreground/[0.04] text-foreground/50 hover:text-foreground hover:border-black/[0.1]"
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Sub Tabs */}
                            <div className="flex gap-2 mb-6">
                                <button
                                    onClick={() => setActiveSubTab("titles")}
                                    className={`px-4 py-2 text-[10px] font-medium uppercase tracking-wider transition-all rounded ${activeSubTab === "titles"
                                        ? "bg-foreground/10 text-foreground border border-foreground/20"
                                        : "bg-foreground/[0.02] border border-foreground/[0.04] text-foreground/40 hover:text-foreground/60"
                                        }`}
                                >
                                    Títulos
                                </button>
                                <button
                                    onClick={() => setActiveSubTab("badges")}
                                    className={`px-4 py-2 text-[10px] font-medium uppercase tracking-wider transition-all rounded ${activeSubTab === "badges"
                                        ? "bg-foreground/10 text-foreground border border-foreground/20"
                                        : "bg-foreground/[0.02] border border-foreground/[0.04] text-foreground/40 hover:text-foreground/60"
                                        }`}
                                >
                                    Badges
                                </button>
                            </div>

                            {/* Content */}
                            <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-5">
                                {activeTab === "library" && activeSubTab === "titles" && <TitleLibraryManager />}
                                {activeTab === "library" && activeSubTab === "badges" && <BadgeLibraryManager />}
                                {activeTab === "assign" && activeSubTab === "titles" && <AwardTitleForm />}
                                {activeTab === "assign" && activeSubTab === "badges" && <AwardBadgeForm />}
                                {activeTab === "manage" && activeSubTab === "titles" && <ManagePlayerTitles />}
                                {activeTab === "manage" && activeSubTab === "badges" && <ManagePlayerBadges />}
                            </div>
        </AdminLayout>
    )
}
