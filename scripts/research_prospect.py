import json
import sys

import httpx
from bs4 import BeautifulSoup


def main(url: str) -> int:
    response = httpx.get(url, follow_redirects=True, timeout=20)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    text = " ".join(soup.stripped_strings)
    print(json.dumps({
        "url": url,
        "title": title,
        "text": text[:20_000],
        "source": "public-web",
    }, indent=2))
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/research_prospect.py <public-url>")
        raise SystemExit(2)
    raise SystemExit(main(sys.argv[1]))
