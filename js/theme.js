/*
 * Copia Segura
 * Copyright (C) 2026 Fabio Britez
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * theme.js - Light and dark mode. Loaded from <head>, before the body is
 * painted, so the chosen theme applies without a flash of the wrong colours.
 *
 * STORAGE: the only thing this application ever stores is one key,
 * 'copia-segura:theme', holding either "light" or "dark". No images, no
 * document data, no identifiers. If the user never touches the toggle nothing
 * is stored at all and the site follows the system preference.
 */

(function () {
  var KEY = 'copia-segura:theme';
  var root = document.documentElement;

  function readStored() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : null;
    } catch (e) {
      // Storage blocked: the preference just will not survive the visit.
      return null;
    }
  }

  function systemPreference() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    // Tints the mobile browser bar so it matches the theme.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#f4f7fb');
  }

  applyTheme(readStored() || systemPreference());

  // With no explicit choice, follow system changes live.
  if (window.matchMedia) {
    var query = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () {
      if (!readStored()) applyTheme(systemPreference());
    };
    if (query.addEventListener) query.addEventListener('change', onChange);
    else if (query.addListener) query.addListener(onChange);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.getElementById('btnTheme');
    if (!button) return;

    function refreshLabel() {
      var dark = root.dataset.theme === 'dark';
      button.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
      button.setAttribute('title', dark ? 'Modo claro' : 'Modo oscuro');
    }

    button.addEventListener('click', function () {
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(KEY, next);
      } catch (e) {
        /* no storage: the change holds for this session only */
      }
      refreshLabel();
    });

    refreshLabel();
  });
})();
