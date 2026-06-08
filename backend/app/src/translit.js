// Bilingual name search helpers.
// Players register in either Russian or English (Казбек / Kazbek), so search
// must match across both alphabets. We generate transliterated variants of the
// query and match each against the stored names.

const CYR_TO_LAT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

// Latin → Cyrillic: longest digraphs first so "zh"/"sh" win over single chars.
const LAT_TO_CYR = [
  ["sch", "щ"], ["zh", "ж"], ["kh", "х"], ["ts", "ц"], ["ch", "ч"],
  ["sh", "ш"], ["yu", "ю"], ["ya", "я"], ["yo", "ё"],
  ["a", "а"], ["b", "б"], ["v", "в"], ["g", "г"], ["d", "д"],
  ["e", "е"], ["z", "з"], ["i", "и"], ["j", "й"], ["k", "к"],
  ["l", "л"], ["m", "м"], ["n", "н"], ["o", "о"], ["p", "п"],
  ["r", "р"], ["s", "с"], ["t", "т"], ["u", "у"], ["f", "ф"],
  ["h", "х"], ["c", "к"], ["y", "ы"], ["w", "в"], ["x", "кс"],
  ["q", "к"],
];

export function cyrToLat(str) {
  return String(str || "")
    .toLowerCase()
    .split("")
    .map((ch) => (ch in CYR_TO_LAT ? CYR_TO_LAT[ch] : ch))
    .join("");
}

export function latToCyr(str) {
  let s = String(str || "").toLowerCase();
  let out = "";
  while (s.length) {
    let matched = false;
    for (const [lat, cyr] of LAT_TO_CYR) {
      if (s.startsWith(lat)) {
        out += cyr;
        s = s.slice(lat.length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += s[0];
      s = s.slice(1);
    }
  }
  return out;
}

// Distinct search variants of a query across both alphabets.
export function searchVariants(q) {
  const base = String(q || "").trim().toLowerCase();
  if (!base) return [];
  return [...new Set([base, cyrToLat(base), latToCyr(base)])].filter(Boolean);
}
