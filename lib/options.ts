/** Shared form options so onboarding, profile editing and preferences stay in sync. */

export const COUNTRIES = [
  ["PT", "Portugal", 38.72, -9.14],
  ["ES", "Spain", 40.42, -3.7],
  ["GB", "United Kingdom", 51.51, -0.13],
  ["DE", "Germany", 52.52, 13.4],
  ["FR", "France", 48.86, 2.35],
  ["SE", "Sweden", 59.33, 18.07],
  ["NO", "Norway", 59.91, 10.75],
  ["IS", "Iceland", 64.15, -21.94],
  ["US", "United States", 40.71, -74.01],
  ["CA", "Canada", 43.65, -79.38],
  ["MX", "Mexico", 19.43, -99.13],
  ["BR", "Brazil", -23.55, -46.63],
  ["AR", "Argentina", -34.6, -58.38],
  ["PE", "Peru", -12.05, -77.04],
  ["KE", "Kenya", -1.29, 36.82],
  ["MA", "Morocco", 33.57, -7.59],
  ["ZA", "South Africa", -26.2, 28.05],
  ["IN", "India", 19.08, 72.88],
  ["TR", "Turkey", 41.01, 28.98],
  ["IR", "Iran", 35.69, 51.39],
  ["AE", "UAE", 25.2, 55.27],
  ["TH", "Thailand", 13.76, 100.5],
  ["VN", "Vietnam", 10.82, 106.63],
  ["ID", "Indonesia", -6.21, 106.85],
  ["JP", "Japan", 35.68, 139.69],
  ["KR", "South Korea", 37.57, 126.98],
  ["PH", "Philippines", 14.6, 120.98],
  ["CN", "China", 31.23, 121.47],
  ["AU", "Australia", -33.87, 151.21],
  ["NZ", "New Zealand", -36.85, 174.76],
] as const;

export const LANGS = [
  "English", "Spanish", "Portuguese", "French", "German", "Italian", "Japanese",
  "Korean", "Mandarin", "Hindi", "Arabic", "Turkish", "Russian", "Swahili",
  "Dutch", "Polish", "Thai", "Vietnamese", "Indonesian", "Hebrew", "Greek",
];

export const LOOKING = [
  ["friendship", "Friendship", "Long-term pals and people to hang out with"],
  ["networking", "Networking", "Meet people in my field of work"],
  ["language_exchange", "Language exchange", "Practise a language together"],
  ["travel_buddy", "Travel buddy", "Someone to explore with"],
  ["any", "Open to anything", "Surprise me"],
] as const;

export const GENDERS = [
  ["female", "Woman"],
  ["male", "Man"],
  ["non_binary", "Non-binary"],
  ["other", "Other"],
  ["undisclosed", "Prefer not to say"],
] as const;

export const inputCls =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none transition focus:border-brand";