// ==UserScript==
// @name        Furk.net download helper
// @description Adds 'Add to Furk.net' button on some torrent websites.
// @namespace   tithen-firion.github.io
// @include     https://thepiratebay.org/*
// @include     https://rarbg.to/*
// @include     https://rutracker.org/*
// @include     https://1337x.to/*
// @version     1.0.0
// @grant       GM_xmlhttpRequest
// @grant       GM_registerMenuCommand
// ==/UserScript==

var base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAMCAMAAABRJ730AAAAElBMVEUAAAAAAABJnt6t8kfqS6H////DxMXeAAAAAXRSTlMAQObYZgAAADhJREFUeAFtzFEKgAAMw9DM9v5n1qE/agL7eYwC+YXqerSH57pjM/58z3azj6StjfT1HWEJXM3hBIY9AtdPDU62AAAAAElFTkSuQmCC';
var host = document.location.hostname;
var furkHost = 'https://www.furk.net';
var apiEndpoint = furkHost + '/api/';

(async () => {



var siteDict = {
  /*'example.com': {
    isSingle: () => {},               // true if single-torrent page, false otherwise
    extractInfoSingle: () => {},      // extract info from single-torrent page; must contain magnet/torrent
    entriesSelector: '',              // if isSingle returns false, this selector is used to find all torrent entries

    loadEntries: false,               // if true, loads all entries and extracts info with extractInfoSingle
    findID: url => {},                // extract ID from Location object (document.location or <a> tag), ignored when loadEntries is set to false
    singleTorrentUrlSelector: '',     // used to find a link to single-torrent page (uses entry as parent), ignored when loadEntries is set to false
    extractInfo: entry => {},         // extract info from entry, ignored when loadEntries is set to true

    buttonsSingle: {                  // determines where buttons should be inserted
      where: '',                      // 'after' or 'before'
      selector: ''                    // CSS selector
    },
    buttonsMulti: {...}
  },*/
  'thepiratebay.org': {
    entriesSelector: '#searchResult>tbody>tr'
  },
  'rarbg.to': {
    entriesSelector: '.lista2',
    singleTorrentUrlSelector: 'a[title]',
    loadEntries: true,
    buttonsMulti: {
      where: 'before',
      selector: 'span[class^="ncontenticon"]'
    }
  },
  'rutracker.org': {
    isSingle: () => {
      var path = document.location.pathname.split('/');
      return path.length > 2 && path[2] == 'viewtopic.php';
    },
    findID: url => {
      return url.search.split('=')[1];
    },
    entriesSelector: 'tr.hl-tr',
    extractInfo: entry => {
      if(typeof entry === 'undefined')
        entry = document;
      let download = entry.querySelector('a[href^="dl.php"]');
      return download ? download.href : null;
    },
    buttonsMulti: {
      where: 'after',
      selector: 'a[href^="dl.php"]'
    }
  },
  '1337x.to': {
    entriesSelector: 'tbody>tr:not(.blank)',
    singleTorrentUrlSelector: 'a[href^="/torrent/"]',
    loadEntries: true,
    buttonsMulti: {
      where: 'after',
      selector: 'a[href^="/torrent/"]'
    }
  }
};

siteDict['rutracker.org'].extractInfoSingle = siteDict['rutracker.org'].extractInfo;

/* common functions and settings */

this.isSingle = () => {
  var path = document.location.pathname.split('/');
  return path.length > 1 && path[1] == 'torrent';
};

this.findID = url => {
  return url.pathname.split('/')[2];
};

this.extractInfo = this.extractInfoSingle = el => {
  /* get magnet from element or current document */
  if(typeof el === 'undefined')
    el = document;
  var a = el.querySelector('a[href^="magnet:"]');
  return a ? a.href : '';
};

this.loadEntries = false;

(self => {
  ['Single', 'Multi'].forEach(k => {
    this['buttons'+k] = {
      where: 'after',
      selector: 'a[href^="magnet:"]'
    };
  });
})(this);

/* add/replace site-specific functions and variables */

(self => {
  var site = siteDict[host];
  for(let f in site) {
    if(site.hasOwnProperty(f)) {
      self[f] = site[f];
    }
  }
})(this);

/* common functions that can't be replaced */

var asyncGmXhr = async (method, url, type, data) => new Promise(resolve => {
  let info = {
    method: method,
    responseType: type ? type : 'text',
    url: url,
    onload: res => {
      resolve(res);
    }
  };
  if(typeof data !== 'undefined')
    info.data = data;
  GM_xmlhttpRequest(info);
});

var asyncGet = async (url, type) => new Promise(resolve => {
  var xhr = new XMLHttpRequest();
  xhr.open('get', url);
  xhr.responseType = type ? type : 'text';
  xhr.onload = res => {
    resolve(res.target);
  };
  xhr.send();
});

var findLocation = entry => {
  if(typeof entry === 'undefined')
    return document.location;
  else
    return entry.querySelector(singleTorrentUrlSelector);
};

var insertSpace = (p, c) => {
  p.insertBefore(document.createTextNode(' '), c);
}

var insert = (el, relatedEl, where) => {
  let before = where == 'after' ? relatedEl.nextSibling : relatedEl;
  let parentElement = relatedEl.parentNode;
  insertSpace(parentElement, before);
  parentElement.insertBefore(el, before);
  insertSpace(parentElement, before);
};

var addToFurk = async e => {
  var target = e.target;
  var download = target.getAttribute('data-download');
  var torrent = download.indexOf('magnet:') != 0;
  var url = apiEndpoint + 'dl/add';
  var FD = new FormData();
  if(torrent) {
    let data = await asyncGet(download, 'blob');
    let f = new File([data.response], '_.torrent');
    FD.set('file', f);
  }
  else {
    if(download.length > 500)
      download = download.substr(0, 500);
    FD.set('url', download);
  }
  var data = await asyncGmXhr('post', url, 'json', FD);
  var res = data.response;
  if(res.status == 'error') {
    if(res.error == 'access denied')
      alert('Log into Furk.net first');
    else {
      console.log(data);
      alert(res.error);
    }
  }
  else if(res.status == 'ok') {
    if(res.torrent.dl_status == 'finished') {
      if(window.confirm('Torrent already cached! Click ok to open download page.'))
        window.open(furkHost + res.files[0].url_page);
    }
    else
      alert('Torrent added to the queue.');
  }
  else
    console.log(data);
};

var addButtons = (info, entry) => {
  var img = document.createElement('img');
  img.style.cursor = 'pointer';
  img.setAttribute('data-download', info);
  img.src = base64Image;
  img.title = 'Add to Furk.net';
  img.addEventListener('click', addToFurk);
  var buttonsInfo;
  if(entry)
    buttonsInfo = buttonsMulti;
  else {
    entry = document;
    buttonsInfo = buttonsSingle;
  }
  var element = entry.querySelector(buttonsInfo.selector);
  insert(img, element, buttonsInfo.where);
};

/* main logic */

var siteInfo = sessionStorage.getItem('FurkHelperSiteInfo'); // get site info for host
siteInfo = siteInfo ? JSON.parse(siteInfo) : {};

if(isSingle()) {
  let info = extractInfoSingle();
  addButtons(info);
}
else {
  let entries = document.querySelectorAll(entriesSelector);
  for(let i=0, l=entries.length; i<l; ++i) {
    let entry = entries[i];
    let info;
    if(loadEntries) {
      let url = findLocation(entry);
      let id = findID(url);
      if(!(id in siteInfo)) {
        let data = await asyncGet(url.href, 'document');
        info = extractInfoSingle(data.response);
        siteInfo[id] = info;
      }
      else
        info = siteInfo[id];
      sessionStorage.setItem('FurkHelperSiteInfo', JSON.stringify(siteInfo)); // set site info for host
    }
    else
      info = extractInfo(entry);
    if(info)
      addButtons(info, entry);
  }
}



})();
