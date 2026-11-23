"""
Column mapping: which column of a file is which field of the standard model.

A mapping a person confirms is saved under the file's column signature, so the same ERP export
is never asked about twice. Those saved pairs (column name -> field) are also the examples a
language model can later learn to suggest mappings from.
"""
import hashlib
import re

from .schema import KINDS
from .text import norm_text

_MARKS = re.compile(r'[ً-ٰٟ]')  # Arabic diacritics and the hamza above ه
_SEPARATORS = re.compile(r'[\s_\-.()\[\]/\\:]+')


def header_key(header: str) -> str:
    """A column name with spelling differences removed: "تأمین‌کننده", "تامين كننده" and "تامین_کننده" match."""
    s = norm_text(header).lower().replace('أ', 'ا').replace('إ', 'ا').replace('ۀ', 'ه').replace('ة', 'ه')
    return _SEPARATORS.sub('', _MARKS.sub('', s))


def signature(headers: list[str]) -> str:
    return hashlib.sha1('|'.join(sorted(header_key(h) for h in headers)).encode()).hexdigest()


def suggest(headers: list[str]) -> dict:
    """
    For each kind of file, the best guess of which column is which field, from field names and aliases.
    Returns {'kind', 'complete', 'standard', 'mappings': {kind: {field: column}}}: `kind` is the most
    likely kind; `standard` means every matched column already has the standard field name.
    """
    position = {}
    for i, h in enumerate(headers):
        position.setdefault(header_key(h), i)

    mappings, ranked = {}, []
    for kind in KINDS.values():
        used, mapping, standard = set(), {}, True
        for f in kind.fields:
            for name in (f.name, *f.aliases):
                i = position.get(header_key(name))
                if i is not None and i not in used:
                    used.add(i)
                    mapping[f.name] = headers[i]
                    standard &= header_key(name) == header_key(f.name)
                    break
        complete = all(f.name in mapping for f in kind.fields if f.required)
        mappings[kind.name] = mapping
        ranked.append(((complete, len(mapping)), kind.name, complete, standard))

    best = max(ranked, key=lambda r: r[0])  # ties go to the first kind
    _, kind, complete, standard = best
    return {'kind': kind, 'complete': complete, 'standard': complete and standard, 'mappings': mappings}


def check(kind_name: str, mapping: dict, headers: list[str]) -> dict:
    """A mapping sent by a person, cleaned; raises ValueError with a message for the person."""
    kind = KINDS.get(kind_name)
    if not kind:
        raise ValueError('نوع فایل شناخته نشد.')
    clean = {f: c for f, c in (mapping or {}).items() if c}
    for f, c in clean.items():
        if f not in {x.name for x in kind.fields}:
            raise ValueError(f'ستون «{f}» در مدل داده نیست.')
        if c not in headers:
            raise ValueError(f'ستون «{c}» در فایل نیست.')
    if len(set(clean.values())) < len(clean):
        raise ValueError('یک ستون فایل برای دو مورد انتخاب شده است.')
    missing = [f.label for f in kind.fields if f.required and f.name not in clean]
    if missing:
        raise ValueError(f'این موارد لازم است: {"، ".join(missing)}.')
    return clean
