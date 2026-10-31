// JavaScript port of the notebook's feature extraction (must stay identical to the Python version).
(function (root) {
  const LEET = {"@":"a","$":"s","!":"i","0":"o","1":"l","3":"e","4":"a","5":"s","7":"t","8":"b","|":"l","+":"t"};
  const KEYBOARD_ROWS = ["qwertyuiop","asdfghjkl","zxcvbnm","1234567890"];
  const FEATURE_NAMES = ["length","n_lower","n_upper","n_digit","n_symbol","n_classes","shannon_entropy",
    "pool_entropy","unique_ratio","max_repeat","max_sequence","has_keyboard_pattern","is_common","dict_coverage","base_is_common"];
  const LABELS = ["Weak","Medium","Strong"];

  const chars = s => Array.from(s);
  const isLower = c => /^\p{Ll}$/u.test(c);
  const isUpper = c => /^\p{Lu}$/u.test(c);
  const isDigit = c => /^[\p{Nd}\u00b2\u00b3\u00b9]$/u.test(c);
  const isAlnum = c => /^[\p{L}\p{N}]$/u.test(c);

  function normalize(pw) { return chars(pw.toLowerCase()).map(c => LEET[c] ?? c).join(""); }

  function shannonEntropy(cs) {
    if (!cs.length) return 0;
    const counts = new Map(); for (const c of cs) counts.set(c, (counts.get(c) || 0) + 1);
    let h = 0; for (const v of counts.values()) { const p = v / cs.length; h -= p * Math.log2(p); }
    return h;
  }
  function maxRepeatRun(cs) {
    if (!cs.length) return 0; let best = 1, run = 1;
    for (let i = 1; i < cs.length; i++) { run = cs[i] === cs[i-1] ? run + 1 : 1; best = Math.max(best, run); }
    return best;
  }
  function maxSequenceRun(cs) {
    if (cs.length < 2) return cs.length; let best = 1, up = 1, down = 1;
    for (let i = 1; i < cs.length; i++) {
      const d = cs[i].codePointAt(0) - cs[i-1].codePointAt(0);
      up = d === 1 ? up + 1 : 1; down = d === -1 ? down + 1 : 1; best = Math.max(best, up, down);
    }
    return best;
  }
  function hasKeyboardPattern(pw) {
    const low = pw.toLowerCase();
    for (const row of KEYBOARD_ROWS) for (let i = 0; i < row.length - 3; i++) {
      const chunk = row.slice(i, i + 4);
      if (low.includes(chunk) || low.includes(chunk.split("").reverse().join(""))) return 1;
    }
    return 0;
  }

  function createFeatures(COMMON, ENGLISH) {
    function dictionaryFeatures(pw) {
      const raw = pw.toLowerCase(), norm = normalize(pw), nc = chars(norm), n = nc.length;
      const isCommon = (COMMON.has(raw) || COMMON.has(norm)) ? 1 : 0;
      let coverage = 0;
      if (n >= 5) {
        outer: for (let L = n; L >= 5; L--) for (let s = 0; s <= n - L; s++)
          if (ENGLISH.has(nc.slice(s, s + L).join(""))) { coverage = L / n; break outer; }
      }
      return [isCommon, Math.min(coverage, 1)];
    }
    function baseIsCommon(pw) {
      for (const s of [pw.toLowerCase(), normalize(pw)]) {
        const base = s.replace(/^[^a-z]+|[^a-z]+$/g, "");
        if (base.length >= 3 && COMMON.has(base)) return 1;
      }
      return 0;
    }
    function extractFeatures(pw) {
      pw = String(pw); const cs = chars(pw), n = cs.length;
      const nLower = cs.filter(isLower).length, nUpper = cs.filter(isUpper).length, nDigit = cs.filter(isDigit).length;
      const nSymbol = n - nLower - nUpper - nDigit;
      const nClasses = (nLower > 0) + (nUpper > 0) + (nDigit > 0) + (nSymbol > 0);
      const pool = 26 * (nLower > 0) + 26 * (nUpper > 0) + 10 * (nDigit > 0) + 32 * (nSymbol > 0);
      const poolEntropy = pool ? n * Math.log2(pool) : 0;
      const [isCommon, coverage] = dictionaryFeatures(pw);
      return [n, nLower, nUpper, nDigit, nSymbol, nClasses, shannonEntropy(cs), poolEntropy,
        n ? new Set(cs).size / n : 0, maxRepeatRun(cs), maxSequenceRun(cs), hasKeyboardPattern(pw),
        isCommon, coverage, baseIsCommon(pw)];
    }
    return { extractFeatures };
  }

  const api = { createFeatures, normalize, hasKeyboardPattern, FEATURE_NAMES, LABELS };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PW = Object.assign(root.PW || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this);