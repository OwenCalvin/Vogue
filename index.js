const fs = require('fs-path');
const url = require('querystring');
const file = require('fs');
const puppeteer = require('puppeteer');
const colors = require('colors')
const fileContent = file.readFileSync('./mangas.csv', {encoding: 'utf8'});
const start = `https://mangadex.org/quick_search/`;
const cookies = [{
  value: '1',
  name: 'mangadex_filter_langs'
}];
const mangas = [];
fileContent.split('\r\n').forEach(item => {
  if (!(/^\s*$/.test(item))) {
    const params = item.split('-');
    let minmax = params[1] ? params[1].split(':') : null;
    if (minmax && minmax.length < 2) {
      minmax = [null, null]
      console.log(colors.red('Erreur de format min:max : ' + params[0]))
    }
    mangas.push({
      min: minmax ? minmax[0] : null,
      max: minmax ? minmax[1] : null,
      name: params[0]
    });
  }
});

(async () => {
  const browser = await puppeteer.launch();
  for (manga of mangas) {
    console.log(colors.blue('\nRecherche de: ' + manga.name));
    const searchPage = await browser.newPage();
    await searchPage.goto(encodeURI(`${start}${manga.name}`));
    console.log(encodeURI(`${start}${manga.name}`));
    await searchPage.setCookie(...cookies);
    const link = await searchPage.evaluate((manga) => {
      const el = document.querySelector(`a[title="${manga}"]`)
      return el ? el.href : null
    }, manga.name);
    if (link) {
      await searchPage.goto(link)
      const pages = await searchPage.evaluate(() => { return document.querySelector('.pagination').children.length - 2 });
      for (let page = 1; page <= pages; page++) {
        const contentPage = await browser.newPage();
        await contentPage.goto(encodeURI(`${link}/chapters/${page}`))
        const links = await contentPage.evaluate(() => {
          const trs = Array.from(document.querySelector('.tab-content .table-responsive table tbody').querySelectorAll('tr'));
          const ass = [];
          for (tr of trs) {
            const selectedChapter = tr.children[1].firstElementChild
            ass.push({
              link: selectedChapter.href,
              chapter: parseInt(selectedChapter.getAttribute('data-chapter-num'))
            })
          }
          return ass
        });
        for (let chapterLink of await links) {
          if ((manga.min <= chapterLink.chapter && chapterLink.chapter <= manga.max) || (!manga.min && !manga.max)) {
            const chapterPage = await browser.newPage();
            await chapterPage.goto(chapterLink.link);
            const scanPages = await chapterPage.evaluate(() => { return document.querySelector('#jump_page').children.length });
            for (let j = 1; j <= scanPages; j++) {
              const pagePage = await browser.newPage();
              await contentPage.goto(encodeURI(`${chapterLink.link}/${j}`));
              const imageLink = await contentPage.evaluate(() => { return document.querySelector('#current_page').src });
              const imagePage = await browser.newPage()
              const view = await imagePage.goto(imageLink)
              fs.writeFile(`./mangas/${manga.name}/chapter${chapterLink.chapter}/image${j}.png`, await view.buffer(), err => {
                if (err) {
                  console.log(colors.red(err));
                } else {
                  console.log(colors.gray(`\n+--------------------------+\nManga: ${manga.name}\nChapitre ${chapterLink.chapter}\nPage: ${j}\nSauvegardée\n+--------------------------+`));
                }
              });
            }
          }
        }
      }
    } else {
      console.log(colors.red('Manga non trouvé'))
    }
  }
})();
