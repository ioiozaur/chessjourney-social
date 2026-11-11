"""Replay a list of SAN moves from the start position and return the board.

Strict on purpose: a move that no piece can legally make raises MoveError,
so a carousel with a wrong diagram fails to render instead of being posted.
Covers everything openings need: captures, disambiguation, castling,
en passant, promotion, and pins (a pinned piece is not a candidate).
"""

FILES = "abcdefgh"


class MoveError(ValueError):
    pass


def start():
    b = {}
    back = "RNBQKBNR"
    for i, f in enumerate(FILES):
        b[f + "1"] = "w" + back[i]
        b[f + "2"] = "wP"
        b[f + "7"] = "bP"
        b[f + "8"] = "b" + back[i]
    return b


def sq(f, r):
    return FILES[f] + str(r + 1) if 0 <= f < 8 and 0 <= r < 8 else None


def fr(s):
    return FILES.index(s[0]), int(s[1]) - 1


def attacks(b, frm, piece):
    """Squares a piece attacks (pawn: diagonal captures only)."""
    f, r = fr(frm)
    c, p = piece[0], piece[1]
    out = []
    if p == "P":
        d = 1 if c == "w" else -1
        for df in (-1, 1):
            s = sq(f + df, r + d)
            if s:
                out.append(s)
        return out
    if p == "N":
        for df, dr in ((1, 2), (2, 1), (2, -1), (1, -2), (-1, -2), (-2, -1), (-2, 1), (-1, 2)):
            s = sq(f + df, r + dr)
            if s:
                out.append(s)
        return out
    if p == "K":
        for df in (-1, 0, 1):
            for dr in (-1, 0, 1):
                if df or dr:
                    s = sq(f + df, r + dr)
                    if s:
                        out.append(s)
        return out
    dirs = []
    if p in "BQ":
        dirs += [(1, 1), (1, -1), (-1, 1), (-1, -1)]
    if p in "RQ":
        dirs += [(1, 0), (-1, 0), (0, 1), (0, -1)]
    for df, dr in dirs:
        ff, rr = f + df, r + dr
        while True:
            s = sq(ff, rr)
            if not s:
                break
            out.append(s)
            if s in b:
                break
            ff, rr = ff + df, rr + dr
    return out


def in_check(b, colour):
    king = next(s for s, p in b.items() if p == colour + "K")
    return any(king in attacks(b, s, p) for s, p in b.items() if p[0] != colour)


class Game:
    def __init__(self):
        self.b = start()
        self.turn = "w"
        self.castle = {"wK", "wQ", "bK", "bQ"}
        self.ep = None
        self.last = None
        self.plies = 0

    def _apply(self, frm, to, promo=None, test=False):
        b = dict(self.b)
        piece = b.pop(frm)
        if piece[1] == "P" and to == self.ep:
            b.pop(to[0] + frm[1], None)
        b[to] = piece[0] + promo if promo else piece
        if piece[1] == "K" and abs(FILES.index(frm[0]) - FILES.index(to[0])) == 2:
            rank = frm[1]
            if to[0] == "g":
                b["f" + rank] = b.pop("h" + rank)
            else:
                b["d" + rank] = b.pop("a" + rank)
        return b

    def push(self, san):
        raw = san
        s = san.rstrip("+#!?")
        c = self.turn
        rank = "1" if c == "w" else "8"
        if s in ("O-O", "0-0", "O-O-O", "0-0-0"):
            long = len(s) > 3
            right = c + ("Q" if long else "K")
            path = ["b", "c", "d"] if long else ["f", "g"]
            if right not in self.castle or self.b.get("e" + rank) != c + "K":
                raise MoveError(f"{raw}: castling not available")
            if any(f + rank in self.b for f in path):
                raise MoveError(f"{raw}: pieces between king and rook")
            through = ["e", "d", "c"] if long else ["e", "f", "g"]
            for f in through:
                t = dict(self.b)
                t.pop("e" + rank)
                t[f + rank] = c + "K"
                if in_check(t, c):
                    raise MoveError(f"{raw}: king passes through check")
            frm, to, promo = "e" + rank, ("c" if long else "g") + rank, None
        else:
            promo = None
            if "=" in s:
                s, promo = s.split("=")
                promo = promo[0]
            piece = s[0] if s[0] in "NBRQK" else "P"
            body = s[1:] if piece != "P" else s
            capture = "x" in body
            body = body.replace("x", "")
            to = body[-2:]
            hint = body[:-2]
            if len(to) != 2 or to[0] not in FILES or to[1] not in "12345678":
                raise MoveError(f"{raw}: can't read the destination square")
            cands = []
            for frm, p in self.b.items():
                if p != c + piece:
                    continue
                if hint and not all(h in frm for h in hint):
                    continue
                if piece == "P":
                    f, r = fr(frm)
                    d = 1 if c == "w" else -1
                    tf, tr = fr(to)
                    if capture:
                        ok = abs(tf - f) == 1 and tr == r + d and (to in self.b and self.b[to][0] != c or to == self.ep)
                    else:
                        ok = tf == f and to not in self.b and (
                            tr == r + d or (tr == r + 2 * d and r == (1 if c == "w" else 6) and sq(f, r + d) not in self.b))
                    if not ok:
                        continue
                else:
                    if to not in attacks(self.b, frm, p):
                        continue
                    if to in self.b and self.b[to][0] == c:
                        continue
                    if capture != (to in self.b):
                        continue
                if in_check(self._apply(frm, to, promo), c):
                    continue
                cands.append(frm)
            if len(cands) != 1:
                raise MoveError(f"{raw}: {'no' if not cands else 'more than one'} {c}{piece} can play this (move {self.plies // 2 + 1})")
            frm = cands[0]
            if piece == "P" and to[1] in "18" and not promo:
                raise MoveError(f"{raw}: pawn reaches the last rank without promoting")
        moved = self.b[frm]
        self.b = self._apply(frm, to, promo)
        # Castling rights and en passant square
        for s_, right in (("e1", "wK"), ("e1", "wQ"), ("h1", "wK"), ("a1", "wQ"), ("e8", "bK"), ("e8", "bQ"), ("h8", "bK"), ("a8", "bQ")):
            if frm == s_ or to == s_:
                self.castle.discard(right)
        self.ep = None
        if moved[1] == "P" and abs(int(to[1]) - int(frm[1])) == 2:
            self.ep = frm[0] + str((int(frm[1]) + int(to[1])) // 2)
        self.last = (frm, to)
        self.turn = "b" if c == "w" else "w"
        self.plies += 1
        return self

    def grid(self):
        """8 rows from rank 8 to rank 1, each 8 strings like 'wN' or ''."""
        return [[self.b.get(f + str(r), "") for f in FILES] for r in range(8, 0, -1)]


def play(moves):
    if isinstance(moves, str):
        moves = [m for m in moves.replace(".", " ").split() if not m.isdigit()]
    g = Game()
    for m in moves:
        g.push(m)
    return g


def numbered(moves):
    """'1.e4 e5 2.Nf3 Nc6' style text for captions under a diagram."""
    out = []
    for i, m in enumerate(moves):
        out.append(f"{i // 2 + 1}.{m}" if i % 2 == 0 else m)
    return " ".join(out)


if __name__ == "__main__":
    import sys
    g = play(sys.argv[1:] or "e4 e5 Nf3 Nc6 Bb5".split())
    for row in g.grid():
        print(" ".join(p[1].lower() if p and p[0] == "b" else (p[1] if p else ".") for p in row))
    print("last move", g.last)
