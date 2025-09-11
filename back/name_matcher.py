# uz_name_matcher.py

from typing import List, Dict, Any
import unicodedata, re

# ---------------- Matcher class ----------------
class UzNameMatcher:
    _APOS = "'`ʻ’‘"
    _APOS_TABLE = str.maketrans({c: "'" for c in _APOS})

    _CYR_MAP = str.maketrans({
        "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"j","з":"z","и":"i","й":"y",
        "к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f",
        "х":"x","ц":"s","ч":"ch","ш":"sh","ъ":"","ь":"","э":"e","ю":"yu","я":"ya",
        "қ":"q","ғ":"g'","ҳ":"h","ў":"o'",
        "А":"a","Б":"b","В":"v","Г":"g","Д":"d","Е":"e","Ё":"yo","Ж":"j","З":"z","И":"i","Й":"y",
        "К":"k","Л":"l","М":"m","Н":"n","О":"o","П":"p","Р":"r","С":"s","Т":"t","У":"u","Ф":"f",
        "Х":"x","Ц":"s","Ч":"ch","Ш":"sh","Ъ":"","Ь":"","Э":"e","Ю":"yu","Я":"ya",
        "Қ":"q","Ғ":"g'","Ҳ":"h","Ў":"o'",
    })

    _COMMON_SUFFIXES = ["jon","bek","xon","hon","iddin","uddin","ulloh","quli","qul"]

    def __init__(self, use_phonetic: bool = True):
        self._use_phonetic = use_phonetic

    # --- Public ---
    def score(self, query: str, full_name: str) -> float:
        return self._score_candidate(query, full_name)

    # --- Helpers ---
    @staticmethod
    def _cyr_to_lat(s: str) -> str:
        return s.translate(UzNameMatcher._CYR_MAP)

    @staticmethod
    def _collapse_elongations(s: str) -> str:
        s = re.sub(r"(.)\1{2,}", r"\1\1", s)
        s = re.sub(r"([aeiou])\1+", r"\1", s)
        return s

    @staticmethod
    def _normalize_uz(s: str) -> str:
        s = UzNameMatcher._cyr_to_lat(s.strip())
        s = unicodedata.normalize("NFD", s)
        s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
        s = unicodedata.normalize("NFC", s)
        s = s.translate(UzNameMatcher._APOS_TABLE)
        s = s.replace("o’", "o'").replace("g’", "g'")
        s = s.lower()
        s = "".join(ch for ch in s if ch.isalnum() or ch in " '-")
        s = " ".join(s.split())
        s = UzNameMatcher._collapse_elongations(s)
        return s

    @staticmethod
    def _phonetic(s: str) -> str:
        s = s.replace("sh", "š").replace("ch", "č").replace("ng", "ŋ").replace("kh", "x")
        s = s.replace("g'", "g").replace("o'", "o")
        return s

    @staticmethod
    def _tokenize(fullname: str) -> List[str]:
        toks: List[str] = []
        for part in fullname.split():
            toks.extend([t for t in part.split("-") if t])
        return toks

    @staticmethod
    def _dl(a: str, b: str) -> int:
        if a == b: return 0
        la, lb = len(a), len(b)
        dp = [[0]*(lb+1) for _ in range(la+1)]
        for i in range(la+1): dp[i][0] = i
        for j in range(lb+1): dp[0][j] = j
        for i in range(1, la+1):
            for j in range(1, lb+1):
                cost = 0 if a[i-1]==b[j-1] else 1
                dp[i][j] = min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost)
                if i>1 and j>1 and a[i-1]==b[j-2] and a[i-2]==b[j-1]:
                    dp[i][j] = min(dp[i][j], dp[i-2][j-2]+1)
        return dp[la][lb]

    def _tier_similarity(self, x: str, y: str) -> float:
        if not x or not y: return 0.0
        if x == y: return 1.0
        d = self._dl(x, y)
        if d == 1: return 0.85
        if d == 2: return 0.70
        if len(x) >= 3 and y.startswith(x): return 0.75
        if len(x) >= 4 and x in y: return 0.55
        return 0.0

    @classmethod
    def _strip_suffix(cls, s: str) -> str:
        for suf in sorted(cls._COMMON_SUFFIXES, key=len, reverse=True):
            if s.endswith(suf) and len(s) > len(suf)+1:
                return s[:-len(suf)]
        return s

    @classmethod
    def _query_variants(cls, q: str) -> List[str]:
        v1 = cls._strip_suffix(q)
        v2 = cls._strip_suffix(v1) if v1 != q else v1
        return list(dict.fromkeys([q, v1, v2]))  # dedup preserve order

    def _score_candidate(self, query: str, full_name: str) -> float:
        qn = self._normalize_uz(query)
        fn = self._normalize_uz(full_name)
        toks = self._tokenize(fn)
        if not toks: return 0.0
        given, surname = toks[0], toks[-1] if len(toks) > 1 else ""
        combined = " ".join(toks)
        use_combined = len(qn) >= 6

        best = 0.0
        for qv in self._query_variants(qn):
            if self._use_phonetic:
                qv = self._phonetic(qv); given_p = self._phonetic(given); surname_p = self._phonetic(surname); comb_p = self._phonetic(combined)
                best = max(best,
                           self._tier_similarity(qv, given_p),
                           self._tier_similarity(qv, surname_p),
                           self._tier_similarity(qv, comb_p) if use_combined else 0)
            else:
                best = max(best,
                           self._tier_similarity(qv, given),
                           self._tier_similarity(qv, surname),
                           self._tier_similarity(qv, combined) if use_combined else 0)
        return best


# ---------------- Filter function ----------------
def filter_objects_by_holder(
    query: str,
    items: List[Dict[str, Any]],
    *,
    min_score: float = 0.60,
    holder_key: str = "holder",
    use_phonetic: bool = True,
    include_score: bool = False,
) -> List[Dict[str, Any]]:
    matcher = UzNameMatcher(use_phonetic=use_phonetic)
    scored = []
    for obj in items:
        holder = obj.get(holder_key)
        if not isinstance(holder, str): continue
        score = matcher.score(query, holder)
        if score >= min_score:
            out = dict(obj)
            if include_score:
                out["match_score"] = round(score, 3)
            scored.append((out, score))
    scored.sort(key=lambda x: x[1], reverse=True)
    return [o for o, _ in scored]
