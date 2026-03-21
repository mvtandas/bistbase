import Parser from "rss-parser";

const parser = new Parser();

export async function getKapNews(stockCode: string): Promise<string[]> {
  try {
    const feedUrl = process.env.KAP_RSS_URL;
    if (!feedUrl) return [];

    const feed = await parser.parseURL(feedUrl);
    return feed.items
      .filter((item) =>
        item.title?.toUpperCase().includes(stockCode.toUpperCase())
      )
      .slice(0, 5)
      .map((item) => item.title ?? "");
  } catch (error) {
    console.error("KAP RSS error:", error);
    return [];
  }
}
