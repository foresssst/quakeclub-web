import { getTranslations } from "next-intl/server"
import Link from "next/link"

export default async function NotFound() {
  const t = await getTranslations("notFound")

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="text-center animate-fade-up">
        <p className="text-[120px] sm:text-[160px] font-tiktok font-black leading-none tracking-tighter text-foreground/[0.06] select-none">
          404
        </p>
        <h1 className="text-lg font-tiktok font-bold uppercase tracking-wider text-muted-foreground -mt-6 sm:-mt-8">
          {t("message")}
        </h1>
        <Link
          href="/"
          className="inline-flex items-center gap-2 mt-6 px-6 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-xl hover:opacity-90 transition-opacity duration-200"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
