/* =====================================================================
   Barra de progrés per a les càrregues de dades (Programacions; també al web de llibres).
   Els Apps Script no informen de l'avanç real: la barra avança sola fins al 90 % mentre
   s'espera la resposta i arriba al 100 % quan acaba. Les tasques amb passos coneguts
   (p. ex. el PDF) poden fixar el percentatge amb Progres.posa().

     Progres.inici('Carregant les dades…');   // mostra la barra
     Progres.posa(0.5, 'Generant el PDF…');    // opcional: percentatge i text
     Progres.fi();                             // 100 % i s'amaga
     Progres.fi(true);                         // s'amaga en vermell (error)
     Progres.amb(promesa, 'Desant…')           // inici + fi automàtics; retorna la promesa
   ===================================================================== */
(function (global) {
  'use strict';
  var el, barra, text, pct, valor = 0, timer = null, comptador = 0;

  function crea() {
    if (el) return;
    var css = document.createElement('style');
    css.textContent =
      '.progres{position:fixed;left:0;right:0;top:0;z-index:4000;pointer-events:none;opacity:0;transition:opacity .25s ease}' +
      '.progres.is-on{opacity:1}' +
      '.progres__pista{height:4px;background:rgba(28,12,188,.12)}' +
      '.progres__barra{height:100%;width:0;background:linear-gradient(90deg,#1C0CBC,#E8600C);transition:width .25s ease}' +
      '.progres.is-error .progres__barra{background:#B42318}' +
      '.progres__caixa{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;' +
      'min-width:240px;max-width:calc(100% - 32px);padding:12px 16px;background:#fff;border:1px solid #E6EBF2;border-radius:12px;' +
      'box-shadow:0 10px 30px rgba(20,20,60,.15);font:600 14px/1.3 Montserrat,system-ui,sans-serif;color:#1E1E2A;box-sizing:border-box}' +
      '.progres__text{flex:1 1 auto;min-width:0}' +
      '.progres__mini{display:block;height:6px;margin-top:8px;border-radius:999px;background:#EEF0F6;overflow:hidden}' +
      '.progres__mini i{display:block;height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#1C0CBC,#E8600C);transition:width .25s ease}' +
      '.progres__pct{flex:0 0 auto;font-variant-numeric:tabular-nums;color:#1C0CBC}' +
      '@media (prefers-reduced-motion:reduce){.progres__barra,.progres__mini i{transition:none}}';
    document.head.appendChild(css);
    el = document.createElement('div');
    el.className = 'progres';
    el.setAttribute('role', 'progressbar');
    el.setAttribute('aria-valuemin', '0');
    el.setAttribute('aria-valuemax', '100');
    el.innerHTML = '<div class="progres__pista"><div class="progres__barra"></div></div>' +
      '<div class="progres__caixa"><span class="progres__text"><span></span><span class="progres__mini"><i></i></span></span><span class="progres__pct">0 %</span></div>';
    document.body.appendChild(el);
    barra = el.querySelector('.progres__barra');
    text = el.querySelector('.progres__text > span');
    pct = el.querySelector('.progres__pct');
  }

  function pinta() {
    var p = Math.round(valor * 100);
    barra.style.width = p + '%';
    el.querySelector('.progres__mini i').style.width = p + '%';
    pct.textContent = p + ' %';
    el.setAttribute('aria-valuenow', String(p));
  }

  function avanca() {
    // S'acosta al 90 % cada cop més a poc a poc (no arriba mai al 100 % tot sol)
    valor += (0.9 - valor) * 0.06;
    pinta();
  }

  var Progres = {
    inici: function (missatge) {
      crea();
      comptador++;
      clearTimeout(Progres._amaga);
      el.classList.remove('is-error');
      if (comptador === 1) valor = 0.04;
      text.textContent = missatge || 'Carregant…';
      el.setAttribute('aria-label', text.textContent);
      el.classList.add('is-on');
      pinta();
      clearInterval(timer);
      timer = setInterval(avanca, 180);
    },
    posa: function (fraccio, missatge) {
      crea();
      valor = Math.max(valor, Math.min(fraccio, 0.99));
      if (missatge) { text.textContent = missatge; el.setAttribute('aria-label', missatge); }
      pinta();
    },
    fi: function (error) {
      if (!el) return;
      comptador = Math.max(0, comptador - 1);
      if (comptador > 0 && !error) return;
      comptador = 0;
      clearInterval(timer);
      valor = 1;
      if (error) el.classList.add('is-error');
      pinta();
      Progres._amaga = setTimeout(function () { el.classList.remove('is-on'); valor = 0; }, error ? 900 : 450);
    },
    amb: function (promesa, missatge) {
      Progres.inici(missatge);
      return Promise.resolve(promesa).then(function (r) {
        Progres.fi(r && r.ok === false);
        return r;
      }, function (e) { Progres.fi(true); throw e; });
    }
  };
  global.Progres = Progres;
})(window);
