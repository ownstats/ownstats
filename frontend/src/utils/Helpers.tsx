export type CountryCodeMapping = {
  [country: string]: string;
}

export type CodeCountryMapping = {
  [code: string]: string;
}

export const countryToCodeMapping: CountryCodeMapping = {
  "United States": "us",
  "Mexico": "mx",
  "Canada": "ca",
  "Germany": "de",
  "France": "fr",
  "Italy": "it",
  "Netherlands": "nl",
  "UK": "gb",
  "Ireland": "ie",
  "Austria": "at",
  "Sweden": "se",
  "Denmark": "dk",
  "Finland": "fi",
  "Greece": "gr",
  "Belgium": "be",
  "Hungary": "hu",
  "Portugal": "pt",
  "Norway": "no",
  "Romania": "ro",
  "Czech Republic": "cz",
  "Bulgaria": "bg",
  "Poland": "pl",
  "Croatia": "hr",
  "Switzerland": "ch",
  "Spain": "es",
  "India": "in",
  "Singapore": "sg",
  "Japan": "jp",
  "Taiwan": "tw",
  "Korea": "kr",
  "Thailand": "th",
  "Indonesia": "id",
  "Malaysia": "my",
  "Philippines": "ph",
  "Vietnam": "vn",
  "Australia": "au",
  "New Zealand": "nz",
  "Brazil": "br",
  "Colombia": "co",
  "Argentina": "ar",
  "Chile": "cl",
  "Peru": "pe",
  "Israel": "il",
  "Bahrain": "bh",
  "UAE": "ae",
  "Oman": "om",
  "South Africa": "za",
  "Kenya": "ke",
  "Nigeria": "ng",
  "China": "cn"
}

export const codeToCountryMapping: CodeCountryMapping = Object.fromEntries(
  Object.entries(countryToCodeMapping).map(([key, value]) => [value, key])
);
  