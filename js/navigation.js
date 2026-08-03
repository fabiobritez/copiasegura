/*
 * Copia Segura
 * Copyright (C) 2026 Fabio Britez
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * navigation.js - Reading aids for the long-form pages: progress bar, side
 * index with the active section marked, drop-down index for small screens and
 * a back-to-top button.
 *
 * Everything is built from the sections found in the document, so adding a
 * section to the HTML adds it to the navigation. A hand-maintained duplicate
 * index would eventually fall out of date.
 */

(function () {
  var doc = document.querySelector('.doc');
  if (!doc) return;

  var sections = Array.prototype.slice.call(
    document.querySelectorAll('.section[id]')
  );
  if (sections.length < 3) return; // on short documents it gets in the way

  /* Readable title of a section, without the "Sección 01" of the heading. */
  function titleOf(section) {
    var h2 = section.querySelector('h2');
    if (!h2) return section.id;
    var copy = h2.cloneNode(true);
    var number = copy.querySelector('.number');
    if (number) number.remove();
    var anchor = copy.querySelector('.anchor');
    if (anchor) anchor.remove();
    return copy.textContent.trim();
  }

  var entries = sections.map(function (s) {
    return { id: s.id, title: titleOf(s), element: s };
  });

  /* ---------- progress bar ---------- */

  var progress = document.createElement('div');
  progress.className = 'progress';
  var bar = document.createElement('div');
  bar.className = 'progress-bar';
  progress.appendChild(bar);
  document.body.appendChild(progress);

  /* ---------- side index ---------- */

  var sidebar = document.createElement('nav');
  sidebar.className = 'toc-side';
  sidebar.setAttribute('aria-label', 'Secciones del documento');
  var sidebarList = document.createElement('ol');
  sidebar.appendChild(sidebarList);

  /* ---------- section bar and drop-down index ---------- */

  var sectionBar = document.createElement('div');
  sectionBar.className = 'section-bar';
  sectionBar.innerHTML =
    '<button type="button" class="toc-open" aria-expanded="false">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>' +
    'Secciones</button><span class="current-section"></span>';

  var sheet = document.createElement('div');
  sheet.className = 'toc-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', 'Índice del documento');
  var panel = document.createElement('div');
  panel.className = 'toc-panel';
  var sheetList = document.createElement('ol');
  panel.appendChild(sheetList);
  sheet.appendChild(panel);

  var sidebarLinks = [];
  var sheetLinks = [];

  entries.forEach(function (e) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = '#' + e.id;
    a.textContent = e.title;
    li.appendChild(a);
    sidebarList.appendChild(li);
    sidebarLinks.push(a);

    var li2 = document.createElement('li');
    var a2 = document.createElement('a');
    a2.href = '#' + e.id;
    a2.textContent = e.title;
    a2.addEventListener('click', closeSheet);
    li2.appendChild(a2);
    sheetList.appendChild(li2);
    sheetLinks.push(a2);
  });

  /* The bar goes inside the document, before the first content, so it sticks
     to the top edge while scrolling. */
  doc.insertBefore(sectionBar, doc.firstChild);
  document.body.appendChild(sidebar);
  document.body.appendChild(sheet);

  var indexButton = sectionBar.querySelector('.toc-open');
  var currentLabel = sectionBar.querySelector('.current-section');

  function openSheet() {
    sheet.classList.add('open');
    indexButton.setAttribute('aria-expanded', 'true');
  }

  function closeSheet() {
    sheet.classList.remove('open');
    indexButton.setAttribute('aria-expanded', 'false');
  }

  indexButton.addEventListener('click', function () {
    if (sheet.classList.contains('open')) closeSheet();
    else openSheet();
  });

  sheet.addEventListener('click', function (e) {
    if (e.target === sheet) closeSheet(); // tapping outside the panel closes it
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sheet.classList.contains('open')) closeSheet();
  });

  /* ---------- back to top ---------- */

  var toTop = document.createElement('button');
  toTop.type = 'button';
  toTop.className = 'to-top';
  toTop.setAttribute('aria-label', 'Volver al principio');
  toTop.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 19V5m0 0-6 6m6-6 6 6"/></svg>';
  toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.body.appendChild(toTop);

  /* ---------- permalinks on the headings ---------- */

  entries.forEach(function (e) {
    var h2 = e.element.querySelector('h2');
    if (!h2) return;
    var anchor = document.createElement('a');
    anchor.className = 'anchor';
    anchor.href = '#' + e.id;
    anchor.textContent = '#';
    anchor.setAttribute('aria-label', 'Enlace a esta sección');
    h2.appendChild(anchor);
  });

  /* ---------- reading time ---------- */

  var lede = document.querySelector('.doc-cover .lede');
  if (lede) {
    var words = doc.textContent.trim().split(/\s+/).length;
    var minutes = Math.max(1, Math.round(words / 200));
    var readingTime = document.createElement('span');
    readingTime.className = 'reading-time';
    readingTime.textContent = minutes + ' minutos de lectura · ' + entries.length + ' secciones';
    lede.parentNode.insertBefore(readingTime, lede.nextSibling);
  }

  /* ---------- cover index ----------
   *
   * The index at the top is written in the HTML so it works without JavaScript,
   * but it is regenerated here from the real sections: if someone adds a
   * section and forgets the index, the page fixes itself instead of showing an
   * incomplete list.
   */

  var coverIndex = document.querySelector('.toc ol');
  if (coverIndex) {
    coverIndex.textContent = '';
    entries.forEach(function (e) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + e.id;
      a.textContent = e.title;
      li.appendChild(a);
      coverIndex.appendChild(li);
    });
  }

  /* ---------- position tracking ---------- */

  var current = -1;

  function mark(index) {
    if (index === current) return;
    current = index;
    sidebarLinks.forEach(function (a, i) {
      a.classList.toggle('active', i === index);
      if (i === index) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    sheetLinks.forEach(function (a, i) {
      a.classList.toggle('active', i === index);
    });
    currentLabel.textContent = index >= 0 ? entries[index].title : '';
  }

  function update() {
    var viewportHeight = window.innerHeight;
    var scrolled = window.scrollY || window.pageYOffset;
    var total = document.documentElement.scrollHeight - viewportHeight;
    var ratio = total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;
    bar.style.width = ratio * 100 + '%';

    // The active section is the last one whose start is above a third of the
    // screen, which is where the reader's eye actually is. getBoundingClientRect
    // instead of offsetTop: offsetTop is relative to the nearest positioned
    // ancestor and can change with the layout.
    var threshold = viewportHeight / 3;
    var index = -1;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].element.getBoundingClientRect().top <= threshold) index = i;
      else break;
    }
    mark(index);

    var show = scrolled > viewportHeight * 0.6;
    toTop.classList.toggle('visible', show);
    sectionBar.classList.toggle('visible', show);
  }

  var pending = false;
  function onScroll() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      update();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();
