const fs = require('fs-path');
const url = require('querystring');
const file = require('fs');
const puppeteer = require('puppeteer');
let fileContent = file.readFileSync('./mangas.csv', {encoding: 'utf8'});
const start = `https://mangadex.org/quick_search/`;
const cookies = [{
  value: '1',
  name: 'mangadex_filter_langs'
}];
let mangas = [];
fileContent.split('\r\n').forEach(item => {
  if (!(/^\s*$/.test(item))) {
    mangas.push(item);
  }
});

(async () => {
  const browser = await puppeteer.launch();
  for (manga of mangas) {
    console.log('Manga: ' + manga);
    const searchPage = await browser.newPage();
    await searchPage.goto(encodeURI(`${start}${manga}`));
    await searchPage.setCookie(...cookies);
    const link = await searchPage.evaluate((manga) => { return document.querySelector(`a[title="${manga}"]`).href }, manga);
    await searchPage.goto(link)
    const pages = await searchPage.evaluate(() => { return document.querySelector('.pagination').children.length - 2 });
    for (let page = 1; page <= pages; page++) {
      const contentPage = await browser.newPage();
      await contentPage.goto(encodeURI(`${link}/chapters/${page}`))
      console.log(encodeURI(`${link}/chapters/${page}`));
      const links = await contentPage.evaluate(() => {
        const trs = Array.from(document.querySelector('.tab-content .table-responsive table tbody').querySelectorAll('tr'));
        const ass = [];
        for (tr of trs) {
          const selectedChapter = tr.children[1].firstElementChild
          ass.push({
            link: selectedChapter.href,
            chapter: selectedChapter.getAttribute('data-chapter-num')
          })
        }
        return ass
      });
      for (let chapterLink of await links) {
        const chapterPage = await browser.newPage();
        await chapterPage.goto(chapterLink.link);
        const scanPages = await chapterPage.evaluate(() => { return document.querySelector('#jump_page').children.length });
        for (let j = 1; j <= scanPages; j++) {
          const pagePage = await browser.newPage();
          await contentPage.goto(encodeURI(`${chapterLink.link}/${j}`));
          const imageLink = await contentPage.evaluate(() => { return document.querySelector('#current_page').src });
          const imagePage = await browser.newPage()
          const view = await imagePage.goto(imageLink)
          fs.writeFile(`./mangas/${manga}/chapter${chapterLink.chapter}/image${j}.png`, await view.buffer(), err => {
            if (err) {
              console.log(err);
            } else {
              console.log(`page ${j}, du chapitre ${chapterLink.chapter}, du manga: ${manga}, sauvegardée`);
            }
          });
        }
      }
    }
  }
})();
