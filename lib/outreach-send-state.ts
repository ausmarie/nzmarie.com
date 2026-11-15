export function currentSentPredicate(propertyAlias: string, sendLogExists: string) {
  const hasCurrentSendMetadata = `(
    ${propertyAlias}.status = 'sent'
    OR COALESCE(${propertyAlias}.total_send_count, 0) > 0
    OR ${propertyAlias}.last_sent_at IS NOT NULL
    OR ${propertyAlias}.sent_at IS NOT NULL
  )`;

  return `(${hasCurrentSendMetadata} OR (${sendLogExists} AND ${propertyAlias}.status <> 'pending'))`;
}

export function currentUnsentPredicate(propertyAlias: string, sendLogExists: string) {
  return `(
    ${propertyAlias}.status <> 'sent'
    AND COALESCE(${propertyAlias}.total_send_count, 0) = 0
    AND ${propertyAlias}.last_sent_at IS NULL
    AND ${propertyAlias}.sent_at IS NULL
    AND (NOT (${sendLogExists}) OR ${propertyAlias}.status = 'pending')
  )`;
}
