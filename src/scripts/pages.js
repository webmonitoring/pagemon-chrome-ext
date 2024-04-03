class PagesService {
  DB

  constructor() {
    this.DB = new SQLiteDatabaseService()
  }

  isPageMonitored = async (url, callback) => {
    const [page] = await this.getPage(url);

    let count = page ? 1 : 0;

    console.assert(1 >= count);
    callback(1 == count);
  }

  getAllPages = async () => {
    const { result } = await this.DB.executeSql("SELECT * FROM pages", [], function () { });

    return result.resultRows;
  }

  getAllPageURLs = async () => {
    const pages = await this.getAllPages();

    return pages.map(page => page.url);
  }

  getPage = async (url) => {
    const { result } = await this.DB.executeSql("SELECT * FROM pages WHERE url = ?", [url], function () { });

    return result.resultRows;
  }

  addPage = (value) => {
    return this.DB.executeSql("REPLACE INTO pages(url, name, mode, regex, selector, check_interval, html, crc, updated, last_check, last_changed) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        value.url,
        value.name || chrome.i18n.getMessage("untitled", value.url),
        value.mode || "text",
        value.regex || null,
        value.selector || null,
        value.check_interval || null,
        value.html || "",
        value.crc || 0,
        value.updated ? 1 : 0,
        Date.now(),
        value.last_changed || null,
      ])
  }

  getAllUpdatedPages = async () => {
    const { result } = await this.DB.executeSql("SELECT * FROM pages WHERE updated = ?", [1], () => { })

    return result.resultRows;
  }
}

const PAGES = new PagesService()