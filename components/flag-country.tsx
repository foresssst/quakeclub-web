import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

// Mapa de códigos de país a nombres en español
const countryNames: Record<string, string> = {
  CL: "Chile",
  AR: "Argentina",
  BR: "Brasil",
  PE: "Perú",
  CO: "Colombia",
  MX: "México",
  VE: "Venezuela",
  EC: "Ecuador",
  UY: "Uruguay",
  PY: "Paraguay",
  BO: "Bolivia",
  CR: "Costa Rica",
  PA: "Panamá",
  GT: "Guatemala",
  HN: "Honduras",
  SV: "El Salvador",
  NI: "Nicaragua",
  DO: "República Dominicana",
  CU: "Cuba",
  PR: "Puerto Rico",
  ES: "España",
  US: "Estados Unidos",
  CA: "Canadá",
  GB: "Reino Unido",
  DE: "Alemania",
  FR: "Francia",
  IT: "Italia",
  PT: "Portugal",
  RU: "Rusia",
  CN: "China",
  JP: "Japón",
  KR: "Corea del Sur",
  AU: "Australia",
  NZ: "Nueva Zelanda",
  SE: "Suecia",
  NO: "Noruega",
  FI: "Finlandia",
  DK: "Dinamarca",
  NL: "Países Bajos",
  BE: "Bélgica",
  PL: "Polonia",
  UA: "Ucrania",
  CZ: "República Checa",
  AT: "Austria",
  CH: "Suiza",
  IE: "Irlanda",
  ZA: "Sudáfrica",
  IN: "India",
  PH: "Filipinas",
  TH: "Tailandia",
  MY: "Malasia",
  SG: "Singapur",
  ID: "Indonesia",
  VN: "Vietnam",
  TR: "Turquía",
  IL: "Israel",
  SA: "Arabia Saudita",
  AE: "Emiratos Árabes",
  EG: "Egipto",
}

interface Props {
  countryCode: string
  countryName?: string
  className?: string
  showTooltip?: boolean
  size?: "xs" | "sm" | "md" | "lg"
}

const sizeStyles = {
  xs: "14px",
  sm: "16px",
  md: "18px",
  lg: "22px",
}

export function FlagCountry({ countryCode, countryName, className = "", showTooltip = true, size = "sm" }: Props) {
  if (!countryCode) return null

  const code = countryCode.toLowerCase()
  const displayName = countryNames[countryCode.toUpperCase()] || countryName || countryCode

  const flagElement = (
    <span
      className={`flag-country ${className}`}
      style={{
        backgroundImage: `url('https://flagcdn.com/${code}.svg')`,
        ["--height" as string]: sizeStyles[size],
      }}
      aria-label={displayName}
    />
  )

  if (!showTooltip) {
    return flagElement
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{flagElement}</TooltipTrigger>
        <TooltipContent>
          <span className="font-semibold text-foreground">{displayName}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
