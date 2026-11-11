# Chess Journey social

TikTok photo carousels for [@chess.journey39](https://www.tiktok.com/@chess.journey39), made daily by an agent and sent to the TikTok inbox as drafts.

- `AGENT.md`: what the daily agent makes and the exact steps it follows
- `config.json`: posts per day, account, suggested posting times
- `content/`: one JSON file per carousel
- `posts/`: rendered 1080 × 1350 slides, served publicly through jsDelivr for the posting service
- `studio/slides.html` + `tools/render.py`: the renderer (brand fonts, chess diagrams from verified moves)
- `tools/chessboard.py`: replays SAN moves and refuses illegal ones
- `log.json`: what has been made, so topics don't repeat

Fonts are under the SIL Open Font License (Bodoni Moda, IBM Plex Mono) and the DejaVu licence; see `fonts/`.
