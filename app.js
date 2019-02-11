const natural = require('natural');
const countWords = require('count-words');
const rp = require('request-promise');
const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();

const express = require('express');
const app = express();
const port = 3000;
const ignore = ['she', 'he', 'not', 'don'];

app.get('/', async function(req, res) {
  console.log('param is: ' + req.query.url);
  if (!req.query.url) {
    res.send('You need to send a URL in the params called url');
  } else {
    let article = await getPocketText(req.query.url);
    if (article && article.isArticle && article.isArticle == 1) {
      let text = cleanText(article.article);
      //console.log(text);
      let sum = summarize(text);
      res.send(sum);
    }
  }
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

const fib = [144, 89, 55, 34, 21, 13, 8, 5, 3, 2];
var curMap = new Map();

const articleOptions = {
  uri: process.env.TEXT_ENDPOINT,
  method: 'POST',
  body: '',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Accept': 'application/json'
  }
};

function stem(text) {
  natural.PorterStemmer.attach();
  return text.tokenizeAndStem();
}

function countOcurrence(stemmedText) {
  for (var i = 0; i < stemmedText.length; i++) {
    let element = stemmedText[i];
    if (!ignore.includes(element)) {
      if (curMap.has(element)) {
        let elem = curMap.get(element);
        curMap.set(element, elem + 1);
      } else {
        curMap.set(element, 1);
      }
    } else {
      console.log('Excluding ' + element);
    }
  }
}

function sortWithIndices(inp, count) {
  var outp = new Array();
  for (var i = 0; i < inp.length; i++) {
    outp.push(i);
    if (outp.length > count) {
      outp.sort(function(a, b) {
        return inp[b] - inp[a];
      });
      outp.pop();
    }
  }
  return outp;
}

function getScoreMap() {
  var newMap = new Map(curMap);
  console.log(newMap);
  return newMap;
}

function summarize(text) {
  //Stem the words
  let stemmedText = stem(text);
  countOcurrence(stemmedText);
  // Sort them by most frequent.
  curMap[Symbol.iterator] = function*() {
    yield* [...this.entries()].sort((a, b) => b[1] - a[1]);
  };

  let scoreMap = getScoreMap();

  tokenizer = new natural.SentenceTokenizer();
  let sentTok = tokenizer.tokenize(text);
  let stemSent = new Array();
  for (var i = 0; i < sentTok.length; i++) {
    stemSent.push(stem(sentTok[i]));
  }

  let scoreArr = new Array();

  //Now we score each sentence and put it into the array.
  for (var k = 0; k < stemSent.length; k++) {
    let sentTotal = 0;
    for (var m = 0; m < stemSent[k].length; m++) {
      let pts = stemSent[k][m];
      let ptsTemp = scoreMap.get(pts);
      if (ptsTemp > 2) {
        sentTotal += scoreMap.get(pts);
      }
    }
    scoreArr[k] = sentTotal;
  }

  //Now sort by the indices so the most popular sentences are first
  //but we don't lose the index of it into original array.
  let sortedIndexes = sortWithIndices(scoreArr, 8);
  sortedIndexes.sort(function(a, b) {
    return a - b;
  });

  let summary = '';
  for (var i = 0; i < sortedIndexes.length; i++) {
    summary = summary.concat(sentTok[sortedIndexes[i]] + '  ');
  }
  console.log('Final summary: ' + summary);
}

async function getPocketText(url) {
  articleOptions.formData = {
    consumer_key: process.env.POCKET_KEY || '',
    url,
    images: '0',
    videos: '0',
    refresh: '0',
    output: 'json',
    showCopyright: '0',
    msg: '0',
    getItem: '1'
  };
  console.log('Getting article from pocket API: ' + url);
  const article = JSON.parse(await rp(articleOptions));
  console.log('Returned article from pocket API: ' + article.title);
  return article;
}

function cleanText(htmlStr) {
  // Remove the HTML marks.
  let strippedHtml = htmlStr.replace(/<[^>]+>/g, ' ');

  // Now replace the quotes and other markups.
  strippedHtml = strippedHtml
    .replace(/&amp;/g, ' and ')
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&mdash;/g, '-')
    .replace(/&ndash;/g, '-')
    .replace(/&nbsp;/g, ' ')
    .replace(/&thinsp;/g, '');

  //This next line turns encoded int'l chars into proper char
  //example: pr&eacute;sid&eacute; ==> présidé à
  strippedHtml = entities.decode(strippedHtml);
  //Clean up any last html codes and diacriticals that
  //contain & so it doesn't choke ssml.
  strippedHtml = strippedHtml.replace(/&[^\s]*/g, '');
  strippedHtml = strippedHtml.replace(/[<>]/g, '');
  return strippedHtml;
}
