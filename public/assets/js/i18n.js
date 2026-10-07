(function () {
  var root = document.documentElement;
  var keep = new Map();
  var each = function (selector, run) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), run);
  };
  var swap = function (lang) {
    var pt = lang === 'pt';
    each('[data-pt]', function (el) {
      if (!keep.has(el)) keep.set(el, el.textContent);
      el.textContent = pt ? el.getAttribute('data-pt') : keep.get(el);
    });
    each('[data-pt-html]', function (el) {
      if (!keep.has(el)) keep.set(el, el.innerHTML);
      el.innerHTML = pt ? el.getAttribute('data-pt-html') : keep.get(el);
    });
    each('[data-i18n-attr]', function (el) {
      el.getAttribute('data-i18n-attr')
        .split(' ')
        .forEach(function (name) {
          var original = 'data-en-' + name;
          if (!el.hasAttribute(original)) el.setAttribute(original, el.getAttribute(name) || '');
          el.setAttribute(name, pt ? el.getAttribute('data-pt-' + name) : el.getAttribute(original));
        });
    });
    each('[data-set-lang]', function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-set-lang') === lang));
    });
    root.lang = pt ? 'pt-BR' : 'en';
    root.setAttribute('data-lang', lang);
  };
  var line = function (id, n) {
    var el = document.querySelector('#lines [data-id="' + id + '"]');
    return el ? el.textContent.replace('{n}', n === undefined ? '' : n) : '';
  };
  window.RPGED = {
    lang: root.getAttribute('data-lang') || 'en',
    line: line,
    setLang: function (lang) {
      this.lang = lang;
      swap(lang);
      try {
        localStorage.setItem('rpged.lang', lang);
      } catch (error) {}
      document.dispatchEvent(new CustomEvent('rpged:lang', { detail: lang }));
    },
  };
  swap(window.RPGED.lang);
  root.classList.remove('i18n-wait');
  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-set-lang]');
    if (button) window.RPGED.setLang(button.getAttribute('data-set-lang'));
  });
})();
