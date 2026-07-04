"""Shared name normalization + fuzzy matching used by the legacy stats
migration (Phase 2) and salary matching (Phase 3)."""
import re

from rapidfuzz import fuzz
from unidecode import unidecode

SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}

# A handful of well-known nickname/legal-name mismatches between
# basketball-reference and NBA.com that fuzzy matching alone won't bridge.
MANUAL_NAME_OVERRIDES = {
    "metta world peace": "ron artest",
    "metta sandiford artest": "ron artest",
    "world b free": "world free",
}


def normalize_name_strict(name: str) -> str:
    """Accent/case/punctuation normalization WITHOUT stripping generational
    suffixes (Jr./Sr./III). Use this whenever two different real people could
    plausibly share a name — stripping suffixes would conflate e.g. Tim
    Hardaway Sr. and Jr. into the same identity."""
    s = unidecode(name)
    s = s.lower().strip()
    s = MANUAL_NAME_OVERRIDES.get(s, s)
    s = re.sub(r"[^\w\s]", "", s)  # strip punctuation (periods, apostrophes, hyphens)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_name(name: str) -> str:
    """Strict normalization plus suffix stripping. Only safe to use where
    suffix differences are known to be noise, not signal — e.g. matching
    salary-sheet name strings that inconsistently include "Jr."/"III" for
    the same single person, not for disambiguating between two real people."""
    s = normalize_name_strict(name)
    tokens = s.split(" ")
    while len(tokens) > 1 and tokens[-1] in SUFFIXES:
        tokens.pop()
    return " ".join(tokens)


def best_fuzzy_match(name: str, candidates: dict, threshold: float = 90.0):
    """candidates: {normalized_name: [player_id, ...]}. Returns (player_id, score)
    or (None, best_score) if nothing clears the threshold or the best match is
    ambiguous between two different players."""
    best_score = 0.0
    best_key = None
    for cand_name in candidates:
        score = fuzz.ratio(name, cand_name)
        if score > best_score:
            best_score = score
            best_key = cand_name

    if best_key is None or best_score < threshold:
        return None, best_score

    ids = candidates[best_key]
    if len(ids) != 1:
        return None, best_score  # ambiguous — same normalized name, multiple players
    return ids[0], best_score


def top_candidates(name: str, id_to_norm: dict, n: int = 3):
    """id_to_norm: {player_id: normalized_name}. Returns up to n (player_id, score)
    pairs sorted by descending fuzzy score, for manual-review CSV output."""
    scored = [(pid, fuzz.ratio(name, norm)) for pid, norm in id_to_norm.items()]
    scored.sort(key=lambda x: -x[1])
    return scored[:n]
