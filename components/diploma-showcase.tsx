"use client"

import { useState } from "react"
import { Cormorant_Garamond } from "next/font/google"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Download, Maximize2, GraduationCap, Award, Calendar } from "lucide-react"
import { getStudyFormLabel } from "@/lib/constants"
import { formatDateCzech } from "@/lib/utils"

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
})

interface DiplomaShowcaseProps {
  study: {
    id: string
    name: string
    type: string
    form: string
    start_year: number
    end_year?: number
    status: string
    diploma_url?: string | null
    diploma_mime_type?: string
    diploma_uploaded_at?: string
  }
  variant?: "ceremonial" | "compact"
}

export function DiplomaShowcase({ study, variant = "ceremonial" }: DiplomaShowcaseProps) {
  const [open, setOpen] = useState(false)

  if (study.status !== "completed" || !study.diploma_url) return null

  const isPdf = study.diploma_mime_type === "application/pdf"
  const isImage = study.diploma_mime_type?.startsWith("image/")
  const conferredYear = study.end_year || (study.diploma_uploaded_at ? new Date(study.diploma_uploaded_at).getFullYear() : null)

  const romanYear = conferredYear ? toRoman(conferredYear) : null

  if (variant === "compact") {
    return (
      <>
        <CompactDiplomaCard
          study={study}
          onOpen={() => setOpen(true)}
        />
        <DiplomaViewer
          open={open}
          onOpenChange={setOpen}
          study={study}
          isPdf={isPdf}
          isImage={!!isImage}
          conferredYear={conferredYear}
        />
      </>
    )
  }

  return (
    <section className={`${cormorant.className} mb-8`}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full overflow-hidden rounded-2xl text-left shadow-[0_25px_50px_-12px_rgba(10,20,50,0.45)] transition-transform duration-500 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
        aria-label="Zobrazit diplom"
      >
        {/* Layered background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 20% 10%, #1f2d5e 0%, #131e45 35%, #09102a 100%)",
          }}
        />
        {/* Parchment grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.08] mix-blend-screen"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,215,130,0.8) 1px, transparent 0)",
            backgroundSize: "3px 3px",
          }}
          aria-hidden
        />
        {/* Gold sheen sweep on hover */}
        <div
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-amber-200/10 to-transparent transition-transform duration-[1400ms] ease-out group-hover:translate-x-full"
          aria-hidden
        />

        {/* Decorative double border */}
        <div className="pointer-events-none absolute inset-4 rounded-xl border border-amber-300/25" aria-hidden />
        <div className="pointer-events-none absolute inset-[22px] rounded-[10px] border border-amber-300/10" aria-hidden />

        {/* Corner flourishes */}
        <CornerFlourish className="absolute top-3 left-3" />
        <CornerFlourish className="absolute top-3 right-3" rotate={90} />
        <CornerFlourish className="absolute bottom-3 right-3" rotate={180} />
        <CornerFlourish className="absolute bottom-3 left-3" rotate={270} />

        {/* Content */}
        <div className="relative flex flex-col items-center gap-4 px-8 py-12 text-center sm:gap-5 sm:py-14 md:gap-6 md:py-16">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.42em] text-amber-300/80 sm:text-xs">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-amber-300/60" />
            <span>Udělený diplom</span>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-amber-300/60" />
          </div>

          {/* Ornamental divider with seal */}
          <div className="relative flex items-center justify-center gap-4">
            <DividerLine side="left" />
            <WaxSeal />
            <DividerLine side="right" />
          </div>

          {/* Study name (now the hero) */}
          <h2
            className="max-w-3xl font-[450] italic leading-[1.05] text-amber-50 drop-shadow-[0_2px_18px_rgba(255,210,120,0.25)]"
            style={{ fontSize: "clamp(1.9rem, 4vw, 3.2rem)", letterSpacing: "0.005em" }}
          >
            {study.name}
          </h2>

          {/* Metadata row */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.3em] text-amber-200/75 sm:text-xs">
            <span>{study.type}</span>
            <span className="text-amber-300/40">◆</span>
            <span>{getStudyFormLabel(study.form)}</span>
            {conferredYear && (
              <>
                <span className="text-amber-300/40">◆</span>
                <span className="font-medium text-amber-100">
                  {conferredYear}
                  {romanYear && (
                    <span className="ml-2 font-normal italic normal-case tracking-normal text-amber-200/50">
                      · {romanYear}
                    </span>
                  )}
                </span>
              </>
            )}
          </div>

          {/* CTA */}
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-200/5 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.26em] text-amber-100 backdrop-blur-sm transition-all duration-300 group-hover:border-amber-200/80 group-hover:bg-amber-200/10 group-hover:text-amber-50 sm:text-xs">
            <Maximize2 className="h-3 w-3" />
            Otevřít diplom
          </div>
        </div>
      </button>

      <DiplomaViewer
        open={open}
        onOpenChange={setOpen}
        study={study}
        isPdf={isPdf}
        isImage={!!isImage}
        conferredYear={conferredYear}
      />
    </section>
  )
}

function CompactDiplomaCard({
  study,
  onOpen,
}: {
  study: DiplomaShowcaseProps["study"]
  onOpen: () => void
}) {
  const conferredDate = study.diploma_uploaded_at
    ? formatDateCzech(study.diploma_uploaded_at)
    : study.end_year
      ? String(study.end_year)
      : null

  return (
    <div className="group relative mb-8 overflow-hidden rounded-xl border border-amber-200/60 bg-gradient-to-r from-amber-50 via-white to-amber-50/60 shadow-sm transition-shadow hover:shadow-md">
      {/* Accent bar */}
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600" />
      {/* Subtle watermark seal */}
      <Award
        className="pointer-events-none absolute -right-4 -top-4 h-32 w-32 text-amber-200/40"
        strokeWidth={1}
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6">
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-amber-300/70 bg-gradient-to-br from-amber-100 to-amber-50 shadow-inner">
            <Award className="h-5 w-5 text-amber-700" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                Diplom
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-800">
                Dokončeno
              </span>
            </div>
            <h3 className="mt-1 truncate text-base font-semibold text-gray-900 sm:text-lg">
              {study.name}
            </h3>
            {conferredDate && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                <Calendar className="h-3 w-3" />
                <span>Nahráno {conferredDate}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
          <a
            href={study.diploma_url!}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-800 shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Stáhnout</span>
          </a>
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-amber-600 to-amber-700 px-3 py-2 text-xs font-medium text-white shadow-sm transition-all hover:from-amber-700 hover:to-amber-800 hover:shadow"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span>Zobrazit</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function DiplomaViewer({
  open,
  onOpenChange,
  study,
  isPdf,
  isImage,
  conferredYear,
}: {
  open: boolean
  onOpenChange: (_v: boolean) => void
  study: DiplomaShowcaseProps["study"]
  isPdf: boolean
  isImage: boolean
  conferredYear: number | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] h-[92vh] p-0 border-0 bg-[#0a1328] overflow-hidden sm:rounded-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Diplom – {study.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Náhled nahraného diplomu ke studiu {study.name}.
        </DialogDescription>

        <div className={`${cormorant.className} relative z-10 flex items-center justify-between gap-4 border-b border-amber-200/10 bg-gradient-to-b from-[#0f1c3e] to-[#0a1328] px-6 py-4`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-amber-300/40 bg-amber-300/10">
              <GraduationCap className="h-4 w-4 text-amber-200" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg italic text-amber-50 sm:text-xl">{study.name}</div>
              <div className="truncate text-[10px] uppercase tracking-[0.28em] text-amber-200/60 sm:text-xs">
                {study.type} · {getStudyFormLabel(study.form)}
                {conferredYear && <> · {conferredYear}</>}
              </div>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <a
              href={study.diploma_url!}
              download
              className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/5 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-amber-100 transition-colors hover:border-amber-200/70 hover:bg-amber-200/10 hover:text-amber-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Stáhnout</span>
            </a>
          </div>
        </div>

        <div className="relative flex-1 overflow-auto bg-[radial-gradient(ellipse_at_center,_#132144_0%,_#070d20_100%)]">
          <div className="flex min-h-full items-center justify-center p-4 sm:p-8">
            {isPdf ? (
              <iframe
                src={`${study.diploma_url}#toolbar=0&navpanes=0&view=FitH`}
                className="h-[80vh] w-full max-w-5xl rounded-lg border border-amber-200/10 bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
                title={`Diplom ${study.name}`}
              />
            ) : isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={study.diploma_url!}
                alt={`Diplom ${study.name}`}
                className="max-h-[80vh] w-auto max-w-full rounded-lg border border-amber-200/10 bg-white object-contain shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
              />
            ) : (
              <div className="text-amber-100/80">Neznámý formát diplomu.</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DividerLine({ side }: { side: "left" | "right" }) {
  return (
    <svg
      width="120"
      height="10"
      viewBox="0 0 120 10"
      className="hidden text-amber-300/60 sm:block"
      aria-hidden
    >
      <defs>
        <linearGradient id={`div-${side}`} x1={side === "left" ? "0" : "1"} x2={side === "left" ? "1" : "0"} y1="0" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.4" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <line x1="0" y1="5" x2="120" y2="5" stroke={`url(#div-${side})`} strokeWidth="1" />
      <circle cx={side === "left" ? "114" : "6"} cy="5" r="1.5" fill="currentColor" />
    </svg>
  )
}

function WaxSeal() {
  return (
    <div className="relative flex h-14 w-14 items-center justify-center">
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full blur-md"
        style={{
          background:
            "radial-gradient(circle, rgba(255,200,100,0.55) 0%, rgba(180,130,50,0.15) 60%, transparent 100%)",
        }}
      />
      {/* Seal disc */}
      <div
        className="relative flex h-12 w-12 items-center justify-center rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.35),inset_0_-2px_5px_rgba(60,30,0,0.5),0_4px_10px_rgba(0,0,0,0.4)]"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, #ffe8a8 0%, #e3b860 35%, #9c741d 80%, #5a3c0a 100%)",
        }}
      >
        {/* Engraved ring */}
        <div className="absolute inset-1 rounded-full border border-amber-900/50" />
        <GraduationCap className="relative h-5 w-5 text-amber-950 drop-shadow-[0_1px_0_rgba(255,230,150,0.6)]" strokeWidth={2.2} />
      </div>
    </div>
  )
}

function CornerFlourish({ className = "", rotate = 0 }: { className?: string; rotate?: number }) {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      className={className}
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden
    >
      <path
        d="M2 2 L14 2 M2 2 L2 14 M2 2 C6 6, 10 8, 14 8 M8 2 C10 4, 11 6, 12 8"
        stroke="rgba(252, 211, 132, 0.55)"
        strokeWidth="0.9"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="14" cy="8" r="1" fill="rgba(252, 211, 132, 0.7)" />
    </svg>
  )
}

function toRoman(num: number): string {
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ]
  let n = num
  let out = ""
  for (const [v, s] of map) {
    while (n >= v) { out += s; n -= v }
  }
  return out
}
