type Props = {
  confiance?: number
}

export default function ConfidenceBadge({ confiance = 0 }: Props) {
  const couleur =
    confiance > 95
      ? 'text-green-700 bg-green-50 border-green-200'
      : confiance >= 70
        ? 'text-orange-700 bg-orange-50 border-orange-200'
        : 'text-red-700 bg-red-50 border-red-200'

  const icone = confiance > 95 ? '🟢' : confiance >= 70 ? '🟠' : '🔴'

  return (
    <span className={`inline-flex items-center gap-1 border rounded-full px-2 py-1 text-xs ${couleur}`}>
      {icone} {confiance}%
    </span>
  )
}