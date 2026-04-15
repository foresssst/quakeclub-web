interface StructuredDataProps {
  id?: string
  data: Record<string, unknown> | Array<Record<string, unknown>>
}

export function StructuredData({ id = "structured-data", data }: StructuredDataProps) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
