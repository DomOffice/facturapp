export const motifsNumeroParDefaut: RegExp[] = [
  /(?:BL\s*\/\s*)?FACTURE\s*N[°º�]?\s*:?\s*([A-Z]{1,5}\d{4}[-/]\d{3,8})/i,
  /(?:N[°º�]\s*:?\s*)([A-Z]{1,5}\d{4}[-/]\d{3,8})/i,
  /\b([A-Z]{1,5}\d{4}[-/]\d{3,8})\b/i,
];

export const motifsDateParDefaut: RegExp[] = [
  /(?:date\s*(?:facturation|facture)?\s*:?\s*)(\d{2}\/\d{2}\/\d{4})/i,
];

export const motifsIceFournisseurParDefaut: RegExp[] = [
  /(?:ice|identifiant\s+commun\s+de\s+l['’]?entreprise)\s*:?\s*(\d{15})/i,
];

export const motifsTotalHtParDefaut: RegExp[] = [
  /total\s*ht\s*\n?\s*([\d\s]+[,.]\d{2})/i,
];

export const motifsTotalTvaParDefaut: RegExp[] = [
  /total\s*tva(?:\s*\d+%)?\s*\n?\s*([\d\s]+[,.]\d{2})/i,
];

export const motifsTotalTtcParDefaut: RegExp[] = [
  /total\s*ttc\s*\n?\s*([\d\s]+[,.]\d{2})/i,
];