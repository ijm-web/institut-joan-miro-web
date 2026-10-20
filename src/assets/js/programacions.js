/* =====================================================================
   PROGRAMACIONS · àrea privada del professorat (/programacions)
   - Accés amb Google (funcions /api/programacions/login|contingut|sortir).
   - Portada «PROGRAMACIONS» i apartat «Gestió Criteris de Qualificació»
     (/api/programacions/criteris; dades a programacions_db).
   Rutes internes: #  ·  #criteris  ·  #criteris/<id_materia>
   ===================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var API = '/api/programacions/';
  var NIVELLS = ['ESO 1r', 'ESO 2n', 'ESO 3r', 'ESO 4t', 'BAT 1r', 'BAT 2n'];
  var NOM_NIVELL = { 'ESO 1r': '1r d’ESO', 'ESO 2n': '2n d’ESO', 'ESO 3r': '3r d’ESO', 'ESO 4t': '4t d’ESO', 'BAT 1r': '1r de Batxillerat', 'BAT 2n': '2n de Batxillerat' };
  var TRIMESTRES = ['1r', '2n', '3r'];
  var ORDRE_TIPUS = ['comuna', 'modalitat obligatòria', 'modalitat específica', 'itinerari', 'optativa'];

  var MISSATGES = {
    domini_no_permes: 'Cal entrar amb un compte @institutjoanmiro.cat.',
    email_sense_departament: 'Aquest compte no té accés a les programacions. Si creieu que és un error, parleu amb la coordinació pedagògica.',
    sense_acces: 'Aquest compte no té accés a les programacions.',
    acces_google_desactivat: 'L’accés amb Google està desactivat temporalment.',
    google_token_invalid: 'No s’ha pogut validar l’inici de sessió amb Google. Torneu-ho a provar.',
    google_no_configurat: 'L’accés encara no està configurat.',
    error_servidor: 'Hi ha hagut un error. Torneu-ho a provar d’aquí a una estona.',
    sessio_no_valida: 'La sessió ha caducat. Torneu a entrar.',
    materia_no_permesa: 'No podeu modificar aquesta matèria.',
    curs_nomes_lectura: 'Aquest curs és només de consulta: només es pot modificar el curs de gestió.',
    tancat: 'La gestió de criteris està tancada. Podeu consultar, però no desar.',
    percentatge_invalid: 'Hi ha un percentatge que no és vàlid (ha de ser un número entre 0 i 100).',
    codi_repetit: 'Hi ha dues competències amb el mateix codi.',
    trimestre_invalid: 'Hi ha una activitat sense trimestre.',
    peticio_invalida: 'La petició no és vàlida.',
    // Errors de configuració (els veu qui administra el web)
    prog_no_configurat: 'Falten les variables PROG_SCRIPT_URL i PROG_SCRIPT_SECRET a Netlify, o no s’ha tornat a publicar el web després d’afegir-les.',
    prog_url_invalida: 'No es pot connectar amb l’adreça de PROG_SCRIPT_URL. Reviseu-la (ha d’acabar en /exec).',
    prog_resposta_invalida: 'L’Apps Script de programacions_db no respon com a aplicació web. Reviseu el desplegament: tipus «Aplicació web», «Executa com a: Jo», «Qui hi té accés: Qualsevol», i que PROG_SCRIPT_URL sigui l’URL que acaba en /exec.',
    prog_no_autoritzat: 'El secret no coincideix: la variable PROG_SCRIPT_SECRET de Netlify ha de ser exactament igual que la propietat PROG_SECRET de l’Apps Script de programacions_db.',
    prog_accio_desconeguda: 'L’Apps Script de programacions_db no és la versió d’aquest web: enganxeu-hi el Code.gs del repositori i desplegueu una versió nova.',
    prog_error_script: 'Hi ha hagut un error dins de l’Apps Script de programacions_db.',
    prog_curs_invalid: 'El curs no és vàlid.',
    pont_no_configurat: 'Falten les variables APPS_SCRIPT_URL i APPS_SCRIPT_SECRET a Netlify.',
    pont_url_invalida: 'No es pot connectar amb l’adreça de APPS_SCRIPT_URL (pont de joanmiro_db).',
    pont_resposta_invalida: 'El pont de joanmiro_db (APPS_SCRIPT_URL) no respon com a aplicació web.',
    pont_no_autoritzat: 'El secret del pont de joanmiro_db no coincideix (APPS_SCRIPT_SECRET).',
    pont_accio_desconeguda: 'El pont de joanmiro_db no té l’acció «dades»: cal la versió 5 de Code.gs del projecte de llibres.',
    pont_error_script: 'Hi ha hagut un error dins del pont de joanmiro_db.'
  };
  /** Missatge + codi i detall tècnic (per poder-ho diagnosticar) */
  function textError(d) {
    var codi = d && d.error || 'error_servidor';
    var extra = [codi, d && d.detall].filter(Boolean).join(' · ');
    return esc(text(codi)) + '<small class="prog-avis__codi">' + esc(extra) + '</small>';
  }
  var text = function (codi) { return MISSATGES[codi] || MISSATGES.error_servidor; };

  // ------------------------------------------------------------------ utilitats
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v) {
    var s = String(v == null ? '' : v).replace('%', '').replace(',', '.').trim();
    if (s === '') return null;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }
  function fmtNum(n) { return (Math.round(n * 100) / 100).toLocaleString('ca-ES'); }
  function dataCurta(d) {
    var m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/);
    return m ? (Number(m[3]) + '/' + Number(m[2]) + '/' + m[1] + (m[4] ? ' ' + m[4] + ':' + m[5] : '')) : '';
  }
  function nomCurs(c) { return String(c || '').replace('-', '-'); }
  function normalitza(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function ordenaCodis(a, b) {
    var ma = String(a).match(/^([A-Z]+)(\d+)$/), mb = String(b).match(/^([A-Z]+)(\d+)$/);
    if (ma && mb && ma[1] === mb[1]) return Number(ma[2]) - Number(mb[2]);
    return String(a).localeCompare(String(b), 'ca');
  }

  /** Crida a /api/programacions/…; opcions.progres = text de la barra de progrés */
  function api(cami, opcions) {
    opcions = opcions || {};
    var crida = fetch(API + cami, {
      method: opcions.cos ? 'POST' : 'GET',
      headers: opcions.cos ? { 'Content-Type': 'application/json' } : {},
      body: opcions.cos ? JSON.stringify(opcions.cos) : undefined,
      credentials: 'same-origin', cache: 'no-store'
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'error_servidor' }; }).then(function (d) {
        if (r.status === 401) { avisSessio(); }
        d.status = r.status;
        return d;
      });
    });
    return opcions.progres && window.Progres ? Progres.amb(crida, opcions.progres) : crida;
  }

  function toast(missatge, error) {
    var t = $('progToast');
    t.textContent = missatge;
    t.className = 'prog-toast' + (error ? ' prog-toast--error' : '');
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, error ? 6000 : 3000);
  }

  /** Finestra modal pròpia (en lloc de confirm()). botons: [{t, valor, tipus}] → Promise(valor) */
  function pregunta(titol, html, botons) {
    return new Promise(function (resol) {
      $('progModalTitol').textContent = titol;
      $('progModalText').innerHTML = html;
      var caixa = $('progModalBtns');
      caixa.innerHTML = '';
      botons.forEach(function (b) {
        var el = document.createElement('button');
        el.type = 'button';
        el.className = 'prog-btn' + (b.tipus ? ' prog-btn--' + b.tipus : '');
        el.textContent = b.t;
        el.addEventListener('click', function () { $('progModal').hidden = true; document.removeEventListener('keydown', tecla); resol(b.valor); });
        caixa.appendChild(el);
      });
      function tecla(e) { if (e.key === 'Escape') { $('progModal').hidden = true; document.removeEventListener('keydown', tecla); resol(null); } }
      document.addEventListener('keydown', tecla);
      $('progModal').hidden = false;
      var primer = caixa.querySelector('.prog-btn--primary') || caixa.querySelector('button');
      if (primer) primer.focus();
    });
  }

  // ------------------------------------------------------------------ accés
  function missatgeLogin(codi) { var m = $('progMsg'); m.textContent = text(codi); m.hidden = false; }

  function mostraLogin() {
    $('progCarregant').hidden = true;
    $('progAcces').hidden = false;
    $('progApp').hidden = true;
    $('progLogin').hidden = false;
    if (mostraLogin.fet) return;
    mostraLogin.fet = true;
    fetch(API + 'config').then(function (r) { return r.json(); }).then(function (c) {
      if (!c.ok || !c.google_client_id) { missatgeLogin('google_no_configurat'); return; }
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = function () {
        google.accounts.id.initialize({ client_id: c.google_client_id, callback: entra, hd: c.domini, ux_mode: 'popup' });
        google.accounts.id.renderButton($('progGoogle'), { theme: 'outline', size: 'large', text: 'signin_with', locale: 'ca' });
      };
      document.head.appendChild(s);
    }).catch(function () { missatgeLogin('error_servidor'); });
  }

  function entra(resp) {
    $('progMsg').hidden = true;
    Progres.amb(fetch(API + 'login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: resp.credential }), credentials: 'same-origin' })
      .then(function (r) { return r.json(); }), 'Comprovant l’accés…')
      .then(function (d) { if (d.ok) comprova(); else missatgeLogin(d.error); })
      .catch(function () { missatgeLogin('error_servidor'); });
  }

  function comprova() {
    fetch(API + 'contingut', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && d.ok) obreApp(d); else mostraLogin(); })
      .catch(mostraLogin);
  }

  function avisSessio() {
    if (avisSessio.fet) return;
    avisSessio.fet = true;
    pregunta('La sessió ha caducat', '<p>Per seguretat, la sessió dura 8 hores. Torneu a entrar per continuar.</p>' +
      (S.brut ? '<p><strong>Atenció:</strong> els canvis sense desar es perdran.</p>' : ''), [{ t: 'Torna a entrar', valor: 1, tipus: 'primary' }])
      .then(function () { S.brut = false; location.reload(); });
  }

  // ------------------------------------------------------------------ estat
  var S = {
    sessio: null, dades: null, curs: null, dep: '', idx: {}, ed: null, brut: false, carregant: false
  };

  function obreApp(sessio) {
    S.sessio = sessio;
    S.curs = '';   // el primer cop, el servidor obre el curs de gestió (programacions_db › config › curs_gestio)
    $('progAcces').hidden = true;
    $('progApp').hidden = false;
    $('progEmail').textContent = sessio.email + (sessio.admin ? ' · administració' : '');
    encamina();
  }

  $('progSortir').addEventListener('click', function () {
    var surt = function () {
      fetch(API + 'sortir', { method: 'POST', credentials: 'same-origin' }).then(function () {
        if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
        S.brut = false;
        location.hash = '';
        location.reload();
      });
    };
    if (!S.brut) return surt();
    pregunta('Hi ha canvis sense desar', '<p>Si sortiu ara, es perdran.</p>', [
      { t: 'Continua editant', valor: 0, tipus: 'ghost' }, { t: 'Surt igualment', valor: 1, tipus: 'danger' }
    ]).then(function (v) { if (v) surt(); });
  });

  window.addEventListener('beforeunload', function (e) { if (S.brut) { e.preventDefault(); e.returnValue = ''; } });

  // ------------------------------------------------------------------ rutes
  var hashAnterior = location.hash;
  window.addEventListener('hashchange', function () {
    if (!S.sessio) return;
    if (S.brut && S.ed && location.hash !== '#criteris/' + encodeURIComponent(S.ed.id)) {
      var desti = location.hash;
      history.replaceState(null, '', hashAnterior || '#criteris');
      pregunta('Hi ha canvis sense desar', '<p>Voleu sortir de la matèria sense desar els canvis?</p>', [
        { t: 'Continua editant', valor: 0, tipus: 'ghost' }, { t: 'Surt sense desar', valor: 1, tipus: 'danger' }
      ]).then(function (v) { if (v) { S.brut = false; location.hash = desti; } });
      return;
    }
    hashAnterior = location.hash;
    encamina();
  });

  function encamina() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ''));
    hashAnterior = location.hash;
    ['vistaInici', 'vistaCriteris'].forEach(function (v) { $(v).hidden = true; });
    $('progCrumbCrit').hidden = true;
    $('progCrumbMat').hidden = true;
    if (h.indexOf('criteris') === 0) {
      $('vistaCriteris').hidden = false;
      $('progCrumbCrit').hidden = false;
      var id = h.slice('criteris/'.length);
      var mostra = function () { if (h.indexOf('criteris/') === 0 && id) obreEditor(id); else mostraLlista(); };
      if (!S.dades || S.dades.curs !== S.curs) carregaCriteris().then(mostra); else mostra();
    } else {
      $('vistaInici').hidden = false;
    }
    window.scrollTo({ top: $('progApp').offsetTop - 90, behavior: 'smooth' });
  }

  $('progCrumbInici').addEventListener('click', function (e) { e.preventDefault(); location.hash = ''; });

  // ------------------------------------------------------------------ dades
  function carregaCriteris() {
    $('appCarregant').hidden = !window.Progres ? false : true;
    $('critLlista').innerHTML = '';
    return api('criteris' + (S.curs ? '?curs=' + encodeURIComponent(S.curs) : ''), { progres: S.curs ? 'Carregant les dades del curs ' + S.curs + '…' : 'Carregant les dades…' }).then(function (d) {
      $('appCarregant').hidden = true;
      if (!d.ok) { $('critLlista').innerHTML = '<p class="prog-avis prog-avis--error">' + textError(d) + '</p>'; return; }
      S.dades = d;
      S.curs = d.curs;
      indexa();
      pintaFiltres();
    }).catch(function (err) {
      $('appCarregant').hidden = true;
      $('critLlista').innerHTML = '<p class="prog-avis prog-avis--error">' + textError({ error: 'error_servidor', detall: err && err.message }) + '</p>';
    });
  }

  function indexa() {
    var d = S.dades, idx = {};
    d.materies.forEach(function (m) { idx[m.id_materia] = { m: m, criteris: [], competencies: [], info: null }; });
    d.criteris.forEach(function (c) { if (idx[c.id_materia]) idx[c.id_materia].criteris.push(c); });
    d.competencies.forEach(function (c) { if (idx[c.id_materia]) idx[c.id_materia].competencies.push(c); });
    d.info.forEach(function (i) { if (idx[i.id_materia]) idx[i.id_materia].info = i; });
    Object.keys(idx).forEach(function (k) {
      idx[k].criteris.sort(function (a, b) { return TRIMESTRES.indexOf(a.trimestre) - TRIMESTRES.indexOf(b.trimestre) || a.ordre - b.ordre; });
      idx[k].competencies.sort(function (a, b) { return ordenaCodis(a.codi, b.codi); });
    });
    S.idx = idx;
  }

  function pintaFiltres() {
    var d = S.dades;
    $('selCurs').innerHTML = d.cursos.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === d.curs ? ' selected' : '') + '>' + esc(nomCurs(c)) + ([c === d.curs_gestio ? 'en gestió' : '', c === d.curs_publicat ? 'publicat al web' : ''].filter(Boolean).map(function (x) { return ' (' + x + ')'; }).join('')) + '</option>';
    }).join('');
    var deps = d.departaments.filter(function (x) { return d.materies.some(function (m) { return m.departament === x.id; }); });
    if (S.dep && !deps.some(function (x) { return x.id === S.dep; })) S.dep = '';
    if (!S.dep && deps.length === 1) S.dep = deps[0].id;
    $('selDep').innerHTML = (deps.length > 1 ? '<option value="">Tots els departaments</option>' : '') + deps.map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (x.id === S.dep ? ' selected' : '') + '>' + esc(x.nom) + '</option>';
    }).join('');
    $('lblDep').hidden = deps.length < 1;
    var msg = $('critMissatge');
    msg.hidden = !d.missatge;
    msg.textContent = d.missatge || '';
    var lec = $('critLectura');
    if (!d.editable) {
      lec.hidden = false;
      lec.textContent = String(d.estat).toLowerCase() !== 'obert' ? text('tancat') : 'El curs ' + d.curs + ' és només de consulta. Ara es gestiona el curs ' + d.curs_gestio + '.';
    } else lec.hidden = true;
  }

  $('selCurs').addEventListener('change', function () {
    var nou = this.value, sel = this;
    var fes = function () { S.curs = nou; S.brut = false; S.dades = null; location.hash = '#criteris'; if (location.hash === '#criteris') encamina(); };
    if (!S.brut) return fes();
    pregunta('Hi ha canvis sense desar', '<p>Si canvieu de curs, es perdran.</p>', [
      { t: 'Continua editant', valor: 0, tipus: 'ghost' }, { t: 'Canvia de curs', valor: 1, tipus: 'danger' }
    ]).then(function (v) { if (v) fes(); else sel.value = S.curs; });
  });
  $('selDep').addEventListener('change', function () { S.dep = this.value; if (!S.ed) mostraLlista(); });

  function nomDep(id) {
    var d = (S.dades.departaments || []).filter(function (x) { return x.id === id; })[0];
    return d ? d.nom : id;
  }

  function materiesVisibles() {
    return S.dades.materies.filter(function (m) { return !S.dep || m.departament === S.dep; }).sort(function (a, b) {
      var ta = ORDRE_TIPUS.indexOf(String(a.tipus).toLowerCase()), tb = ORDRE_TIPUS.indexOf(String(b.tipus).toLowerCase());
      return NIVELLS.indexOf(a.nivell) - NIVELLS.indexOf(b.nivell) || (ta < 0 ? 9 : ta) - (tb < 0 ? 9 : tb) || a.materia.localeCompare(b.materia, 'ca');
    });
  }

  // ------------------------------------------------------------------ càlculs
  function sumes(criteris) {
    var s = {};
    TRIMESTRES.forEach(function (t) { s[t] = { total: 0, n: 0 }; });
    criteris.forEach(function (c) {
      var t = s[c.trimestre]; if (!t) return;
      t.n++;
      var p = num(c.percentatge);
      if (p !== null && !isNaN(p)) t.total += p;
    });
    return s;
  }
  function estat(e) {
    var s = sumes(e.criteris);
    var trimOk = TRIMESTRES.every(function (t) { return s[t].n && Math.abs(s[t].total - 100) < 0.01; });
    var info = e.info || {};
    var res = !!(e.criteris.length || e.competencies.length || info.criteri_aprovar || info.recuperacio || info.observacions);
    if (!res) return { codi: 'pendent', nom: 'Pendent', s: s };
    var complet = trimOk && e.competencies.length && info.criteri_aprovar && info.recuperacio;
    return { codi: complet ? 'completa' : 'curs', nom: complet ? 'Completa' : 'En curs', s: s };
  }

  // ------------------------------------------------------------------ llista de matèries
  function mostraLlista() {
    S.ed = null;
    $('critEditor').hidden = true;
    $('critLlista').hidden = false;
    if (!S.dades) return;
    var mats = materiesVisibles();
    if (!mats.length) {
      $('critLlista').innerHTML = '<p class="prog-avis">No hi ha matèries del vostre departament per al curs ' + esc(S.dades.curs) + ' a la pestanya «materies» de joanmiro_db.</p>';
      return;
    }
    var compta = { completa: 0, curs: 0, pendent: 0 };
    mats.forEach(function (m) { compta[estat(S.idx[m.id_materia]).codi]++; });
    var h = '<div class="prog-resum">' +
      '<div class="prog-resum__xifres">' +
      '<span><strong>' + mats.length + '</strong> matèries</span>' +
      '<span class="est est--completa"><strong>' + compta.completa + '</strong> completes</span>' +
      '<span class="est est--curs"><strong>' + compta.curs + '</strong> en curs</span>' +
      '<span class="est est--pendent"><strong>' + compta.pendent + '</strong> pendents</span></div>' +
      '<div class="prog-resum__accions">' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="informe">Informe en PDF</button>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="csv">Descarrega CSV</button></div></div>' +
      '<p class="prog-ajuda">Una matèria és <strong>completa</strong> quan cada trimestre suma 100 %, té competències específiques i té el criteri per aprovar i els mecanismes de recuperació.</p>';
    NIVELLS.concat(['']).forEach(function (niv) {
      var grup = mats.filter(function (m) { return niv ? m.nivell === niv : NIVELLS.indexOf(m.nivell) < 0; });
      if (!grup.length) return;
      h += '<section class="prog-nivell"><h3>' + esc(niv ? NOM_NIVELL[niv] : 'Altres') + '</h3><div class="prog-taula" role="table">' +
        '<div class="prog-fila prog-fila--cap" role="row"><span role="columnheader">Matèria</span><span role="columnheader">Trimestres (% assignat)</span><span role="columnheader">Competències</span><span role="columnheader">Textos</span><span role="columnheader">Estat</span></div>';
      grup.forEach(function (m) {
        var e = S.idx[m.id_materia], st = estat(e), info = e.info || {};
        h += '<a class="prog-fila" role="row" href="#criteris/' + encodeURIComponent(m.id_materia) + '">' +
          '<span class="prog-fila__mat" role="cell"><strong>' + esc(m.materia) + '</strong><small>' + esc([m.tipus, S.dep ? '' : nomDep(m.departament)].filter(Boolean).join(' · ')) + '</small></span>' +
          '<span class="prog-fila__trim" role="cell">' + TRIMESTRES.map(function (t) {
            var x = st.s[t], cl = !x.n ? 'buit' : (Math.abs(x.total - 100) < 0.01 ? 'ok' : 'ko');
            return '<span class="trim trim--' + cl + '" title="' + t + ' trimestre: ' + x.n + ' activitats">' + t + ' <b>' + (x.n ? fmtNum(x.total) + '%' : '—') + '</b></span>';
          }).join('') + '</span>' +
          '<span role="cell">' + (e.competencies.length ? e.competencies.length + ' CE' : '<span class="buit">—</span>') + '</span>' +
          '<span class="prog-fila__txt" role="cell"><span class="' + (info.criteri_aprovar ? 'ok' : 'buit') + '" title="Criteri per aprovar">Aprovar</span><span class="' + (info.recuperacio ? 'ok' : 'buit') + '" title="Mecanismes de recuperació">Recuperació</span></span>' +
          '<span role="cell"><span class="est est--' + st.codi + '">' + st.nom + '</span>' + (info.data ? '<small class="prog-fila__data">' + esc(dataCurta(info.data)) + '</small>' : '') + '</span>' +
          '</a>';
      });
      h += '</div></section>';
    });
    $('critLlista').innerHTML = h;
  }

  $('critLlista').addEventListener('click', function (e) {
    var b = e.target.closest('[data-accio]');
    if (!b) return;
    var ids = materiesVisibles().map(function (m) { return m.id_materia; });
    if (b.dataset.accio === 'informe') pdf(ids, S.dep ? nomDep(S.dep) : 'Tots els departaments');
    if (b.dataset.accio === 'csv') csv(ids, 'criteris-' + (S.dep || 'tots') + '-' + S.dades.curs);
  });

  // ------------------------------------------------------------------ editor
  function copiaDades(e) {
    return {
      criteris: e.criteris.map(function (c) {
        return { trimestre: c.trimestre, activitat: c.activitat, percentatge: c.percentatge === null || c.percentatge === undefined ? '' : String(c.percentatge),
          competencies: (c.competencies || []).slice(), competencia_digital: (c.competencia_digital || []).slice() };
      }),
      competencies: e.competencies.map(function (c) { return { codi: c.codi, descripcio: c.descripcio }; }),
      info: { criteri_aprovar: (e.info || {}).criteri_aprovar || '', recuperacio: (e.info || {}).recuperacio || '', observacions: (e.info || {}).observacions || '' }
    };
  }

  function obreEditor(id) {
    var e = S.idx[id];
    if (!e) { toast('Aquesta matèria no és a la llista del curs ' + S.dades.curs + '.', true); location.hash = '#criteris'; return; }
    var dades = copiaDades(e);
    S.ed = { id: id, m: e.m, criteris: dades.criteris, competencies: dades.competencies, info: dades.info, data_anterior: e.info ? e.info.data : '', avisos: '' };
    S.brut = false;
    $('critLlista').hidden = true;
    $('critEditor').hidden = false;
    $('progCrumbMat').hidden = false;
    $('progCrumbMatNom').textContent = e.m.nivell + ' · ' + e.m.materia;
    pintaEditor();
  }

  function editable() { return !!(S.dades && S.dades.editable); }

  function catalegCE() {
    var codis = S.ed.competencies.map(function (c) { return String(c.codi || '').trim().toUpperCase(); }).filter(Boolean);
    return codis.filter(function (c, i) { return codis.indexOf(c) === i; });
  }
  /** Al Batxillerat no es treballa la competència digital: no es mostra ni es desa */
  function senseCD(m) { return /^BAT/.test(String((m && m.nivell) || '')); }
  function catalegCD() { return (S.dades.competencies_digitals || []).map(function (c) { return c.codi; }); }
  function descCE(codi) { var c = S.ed.competencies.filter(function (x) { return String(x.codi).toUpperCase() === codi; })[0]; return c ? c.descripcio : ''; }
  function descCD(codi) { var c = (S.dades.competencies_digitals || []).filter(function (x) { return x.codi === codi; })[0]; return c ? c.descripcio : ''; }

  function pintaEditor() {
    var ed = S.ed, m = ed.m, e = S.idx[ed.id], info = e.info || {}, pot = editable();
    var ro = pot ? '' : ' disabled';
    var h = '<a class="prog-tornar" href="#criteris">← Totes les matèries</a>' +
      '<header class="prog-ed__cap"><div><p class="prog-kicker">' + esc(NOM_NIVELL[m.nivell] || m.nivell) + ' · ' + esc(S.dades.curs) + '</p>' +
      '<h3 class="prog-ed__titol">' + esc(m.materia) + '</h3>' +
      '<p class="prog-ed__meta">' + esc([m.tipus, nomDep(m.departament)].filter(Boolean).join(' · ')) +
      (info.data ? ' · Desat el ' + esc(dataCurta(info.data)) + ' per ' + esc(info.desat_per) : ' · Encara no s’ha desat') + '</p></div>' +
      '<div class="prog-ed__eines">' +
      (pot ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="carrega">Carrega dades…</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="imprimeix">PDF</button>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="csv">CSV</button>' +
      (pot && info.data ? '<button type="button" class="prog-btn prog-btn--ghost prog-btn--perill" data-accio="esborra">Dona de baixa</button>' : '') +
      '</div></header>';

    if (ed.avisos) h += '<div class="prog-avis prog-avis--info"><strong>Dades carregades. Reviseu-les abans de desar:</strong><br>' + esc(ed.avisos).replace(/\n/g, '<br>') + '</div>';

    // 1. Competències específiques
    h += '<section class="prog-bloc"><div class="prog-bloc__cap"><h4><span class="prog-num">1</span> Competències específiques</h4>' +
      '<p>El catàleg de la matèria (codi i descripció). Després les podeu marcar a cada activitat avaluativa.</p></div>' +
      '<div class="prog-ces" id="edCE">';
    ed.competencies.forEach(function (c, i) {
      h += '<div class="prog-ce" data-i="' + i + '">' +
        '<input class="prog-in prog-in--codi" data-camp="codi" value="' + esc(c.codi) + '" aria-label="Codi" placeholder="CE1" maxlength="20"' + ro + '>' +
        '<textarea class="prog-in" data-camp="descripcio" rows="2" aria-label="Descripció" placeholder="Descripció de la competència específica"' + ro + '>' + esc(c.descripcio) + '</textarea>' +
        (pot ? '<button type="button" class="prog-ico" data-accio="treu-ce" title="Elimina la competència" aria-label="Elimina la competència">✕</button>' : '') + '</div>';
    });
    if (!ed.competencies.length) h += '<p class="prog-buit">Encara no hi ha cap competència específica.</p>';
    h += '</div>' + (pot ? '<button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-accio="afegeix-ce">+ Afegeix competència</button>' : '') + '</section>';

    // 2. Criteris per trimestre
    var cat = catalegCE(), cd = catalegCD();
    h += '<section class="prog-bloc"><div class="prog-bloc__cap"><h4><span class="prog-num">2</span> Criteris de qualificació</h4>' +
      '<p>Activitats avaluatives de cada trimestre amb el seu percentatge (ha de sumar 100 %) i ' + (senseCD(ed.m) ? 'les competències específiques que s’hi treballen (al Batxillerat no es treballa la competència digital).' : 'les competències específiques i la competència digital que s’hi treballen.') + '</p></div>' +
      '<div class="prog-trims">';
    TRIMESTRES.forEach(function (t) {
      var files = ed.criteris.map(function (c, i) { return { c: c, i: i }; }).filter(function (x) { return x.c.trimestre === t; });
      var total = files.reduce(function (s, x) { var p = num(x.c.percentatge); return s + (p && !isNaN(p) ? p : 0); }, 0);
      var cl = !files.length ? 'buit' : (Math.abs(total - 100) < 0.01 ? 'ok' : 'ko');
      h += '<div class="prog-trim" data-t="' + t + '"><div class="prog-trim__cap"><h5>' + t + ' trimestre</h5>' +
        '<span class="prog-total prog-total--' + cl + '" data-total="' + t + '">' + (files.length ? 'Total ' + fmtNum(total) + ' %' : 'Sense activitats') + '</span></div>';
      files.forEach(function (x, k) {
        var c = x.c;
        var ces = cat.concat((c.competencies || []).filter(function (v) { return cat.indexOf(v) < 0; }));
        var cds = cd.concat((c.competencia_digital || []).filter(function (v) { return cd.indexOf(v) < 0; }));
        h += '<div class="prog-act" data-i="' + x.i + '">' +
          '<div class="prog-act__linia"><span class="prog-act__n">' + (k + 1) + '</span>' +
          '<input class="prog-in prog-act__nom" data-camp="activitat" value="' + esc(c.activitat) + '" placeholder="Activitat avaluativa" aria-label="Activitat avaluativa"' + ro + '>' +
          '<label class="prog-act__pct"><input class="prog-in" data-camp="percentatge" inputmode="decimal" value="' + esc(c.percentatge) + '" aria-label="Percentatge"' + ro + '><span>%</span></label>' +
          (pot ? '<span class="prog-act__mou"><button type="button" class="prog-ico" data-accio="puja" title="Puja" aria-label="Puja">↑</button><button type="button" class="prog-ico" data-accio="baixa" title="Baixa" aria-label="Baixa">↓</button><button type="button" class="prog-ico" data-accio="treu" title="Elimina l’activitat" aria-label="Elimina l’activitat">✕</button></span>' : '') +
          '</div>' +
          '<div class="prog-chips"><span class="prog-chips__lbl">Competència específica</span>' +
          (ces.length ? ces.map(function (v) {
            var on = (c.competencies || []).indexOf(v) >= 0, fora = cat.indexOf(v) < 0;
            return '<button type="button" class="prog-chip' + (on ? ' is-on' : '') + (fora ? ' is-fora' : '') + '" data-llista="competencies" data-v="' + esc(v) + '" aria-pressed="' + on + '" title="' + esc(fora ? 'No és al catàleg de la matèria' : descCE(v)) + '"' + ro + '>' + esc(v) + '</button>';
          }).join('') : '<span class="prog-chips__buit">Afegiu primer les competències específiques (apartat 1)</span>') + '</div>' +
          (senseCD(ed.m) ? '' : '<div class="prog-chips"><span class="prog-chips__lbl">Competència digital</span>' +
          cds.map(function (v) {
            var on = (c.competencia_digital || []).indexOf(v) >= 0, fora = cd.indexOf(v) < 0;
            return '<button type="button" class="prog-chip prog-chip--cd' + (on ? ' is-on' : '') + (fora ? ' is-fora' : '') + '" data-llista="competencia_digital" data-v="' + esc(v) + '" aria-pressed="' + on + '" title="' + esc(fora ? 'No és al catàleg de competències digitals' : descCD(v)) + '"' + ro + '>' + esc(v) + '</button>';
          }).join('') + '</div>') + '</div>';
      });
      if (pot) {
        h += '<div class="prog-trim__peu"><button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-accio="afegeix" data-t="' + t + '">+ Afegeix activitat</button>';
        var ant = TRIMESTRES[TRIMESTRES.indexOf(t) - 1];
        if (ant && !files.length && ed.criteris.some(function (c) { return c.trimestre === ant; })) {
          h += '<button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-accio="duplica" data-t="' + t + '">Copia les activitats del ' + ant + ' trimestre</button>';
        }
        h += '</div>';
      }
      h += '</div>';
    });
    h += '</div></section>';

    // 3. Textos
    var camps = [
      ['criteri_aprovar', 'Criteri per aprovar la matèria', 'Com s’obté la qualificació final i què cal per superar la matèria (pes dels trimestres, notes mínimes…).'],
      ['recuperacio', 'Mecanismes de recuperació', 'Com es recupera un trimestre no superat, la matèria a final de curs i la matèria pendent de cursos anteriors.'],
      ['observacions', 'Observacions', 'Qualsevol altra informació (ortografia, lliurament de treballs…).']
    ];
    h += '<section class="prog-bloc"><div class="prog-bloc__cap"><h4><span class="prog-num">3</span> Aprovar, recuperar i observacions</h4></div><div class="prog-textos">';
    camps.forEach(function (c) {
      h += '<label class="prog-text"><span class="prog-text__lbl">' + c[1] + '</span><span class="prog-text__ajuda">' + c[2] + '</span>' +
        '<textarea class="prog-in" data-info="' + c[0] + '" rows="5"' + ro + '>' + esc(ed.info[c[0]]) + '</textarea></label>';
    });
    h += '</div></section>';

    if (pot) {
      h += '<div class="prog-desa" id="edBarra"><span class="prog-desa__estat" id="edEstat"></span>' +
        '<button type="button" class="prog-btn prog-btn--ghost" data-accio="descarta">Descarta els canvis</button>' +
        '<button type="button" class="prog-btn prog-btn--primary" data-accio="desa">Desa</button></div>';
    }
    $('critEditor').innerHTML = h;
    marcaBrut(S.brut);
    $('critEditor').querySelectorAll('textarea').forEach(autoalt);
  }

  function autoalt(t) { t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight + 2, 46) + 'px'; }

  function marcaBrut(v) {
    S.brut = v;
    var b = $('edBarra'), st = $('edEstat');
    if (!b) return;
    b.classList.toggle('is-brut', v);
    st.textContent = v ? 'Hi ha canvis sense desar' : 'Tot desat';
  }

  function actualitzaTotals() {
    TRIMESTRES.forEach(function (t) {
      var el = $('critEditor').querySelector('[data-total="' + t + '"]');
      if (!el) return;
      var files = S.ed.criteris.filter(function (c) { return c.trimestre === t; });
      var total = files.reduce(function (s, c) { var p = num(c.percentatge); return s + (p && !isNaN(p) ? p : 0); }, 0);
      el.className = 'prog-total prog-total--' + (!files.length ? 'buit' : (Math.abs(total - 100) < 0.01 ? 'ok' : 'ko'));
      el.textContent = files.length ? 'Total ' + fmtNum(total) + ' %' : 'Sense activitats';
    });
  }

  // Entrades de text: actualitzen l'estat sense tornar a pintar
  $('critEditor').addEventListener('input', function (e) {
    var t = e.target, ed = S.ed;
    if (!ed) return;
    if (t.tagName === 'TEXTAREA') autoalt(t);
    if (t.dataset.info) ed.info[t.dataset.info] = t.value;
    var act = t.closest('.prog-act'), ce = t.closest('.prog-ce');
    if (act && t.dataset.camp) {
      ed.criteris[Number(act.dataset.i)][t.dataset.camp] = t.value;
      if (t.dataset.camp === 'percentatge') { t.classList.toggle('is-error', isNaN(num(t.value)) || num(t.value) < 0 || num(t.value) > 100); actualitzaTotals(); }
    }
    if (ce && t.dataset.camp) ed.competencies[Number(ce.dataset.i)][t.dataset.camp] = t.dataset.camp === 'codi' ? t.value.toUpperCase().replace(/\s+/g, '') : t.value;
    marcaBrut(true);
  });
  // En deixar el codi d'una competència, es tornen a pintar els xips
  $('critEditor').addEventListener('change', function (e) {
    if (e.target.dataset.camp === 'codi') { e.target.value = e.target.value.toUpperCase().replace(/\s+/g, ''); pintaEditorMantenintScroll(); }
  });

  function pintaEditorMantenintScroll() { var y = window.scrollY; pintaEditor(); window.scrollTo(0, y); }

  $('critEditor').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || !S.ed || b.disabled) return;
    var ed = S.ed, act = b.closest('.prog-act'), ce = b.closest('.prog-ce');
    var i = act ? Number(act.dataset.i) : (ce ? Number(ce.dataset.i) : -1);

    if (b.classList.contains('prog-chip')) {
      var ll = ed.criteris[i][b.dataset.llista], v = b.dataset.v, p = ll.indexOf(v);
      if (p >= 0) ll.splice(p, 1); else ll.push(v);
      ll.sort(ordenaCodis);
      b.classList.toggle('is-on', p < 0);
      b.setAttribute('aria-pressed', String(p < 0));
      marcaBrut(true);
      return;
    }
    switch (b.dataset.accio) {
      case 'afegeix-ce': {
        var n = ed.competencies.length + 1;
        while (catalegCE().indexOf('CE' + n) >= 0) n++;
        ed.competencies.push({ codi: 'CE' + n, descripcio: '' });
        marcaBrut(true); pintaEditorMantenintScroll();
        var fi = $('edCE').querySelectorAll('textarea'); if (fi.length) fi[fi.length - 1].focus();
        break;
      }
      case 'treu-ce': ed.competencies.splice(i, 1); marcaBrut(true); pintaEditorMantenintScroll(); break;
      case 'afegeix': {
        var t = b.dataset.t, pos = -1;
        ed.criteris.forEach(function (c, k) { if (TRIMESTRES.indexOf(c.trimestre) <= TRIMESTRES.indexOf(t)) pos = k; });
        ed.criteris.splice(pos + 1, 0, { trimestre: t, activitat: '', percentatge: '', competencies: [], competencia_digital: [] });
        marcaBrut(true); pintaEditorMantenintScroll();
        var nou = $('critEditor').querySelector('.prog-act[data-i="' + (pos + 1) + '"] .prog-act__nom'); if (nou) nou.focus();
        break;
      }
      case 'duplica': {
        var desti = b.dataset.t, orig = TRIMESTRES[TRIMESTRES.indexOf(desti) - 1];
        var copia = ed.criteris.filter(function (c) { return c.trimestre === orig; }).map(function (c) {
          return { trimestre: desti, activitat: c.activitat, percentatge: c.percentatge, competencies: c.competencies.slice(), competencia_digital: c.competencia_digital.slice() };
        });
        var darrer = -1;
        ed.criteris.forEach(function (c, k) { if (TRIMESTRES.indexOf(c.trimestre) <= TRIMESTRES.indexOf(desti)) darrer = k; });
        Array.prototype.splice.apply(ed.criteris, [darrer + 1, 0].concat(copia));
        marcaBrut(true); pintaEditorMantenintScroll();
        break;
      }
      case 'treu': ed.criteris.splice(i, 1); marcaBrut(true); pintaEditorMantenintScroll(); break;
      case 'puja': case 'baixa': {
        var t2 = ed.criteris[i].trimestre, dir = b.dataset.accio === 'puja' ? -1 : 1, j = i + dir;
        while (j >= 0 && j < ed.criteris.length && ed.criteris[j].trimestre !== t2) j += dir;
        if (j < 0 || j >= ed.criteris.length) return;
        var tmp = ed.criteris[i]; ed.criteris[i] = ed.criteris[j]; ed.criteris[j] = tmp;
        marcaBrut(true); pintaEditorMantenintScroll();
        break;
      }
      case 'desa': desa(false); break;
      case 'descarta':
        if (!S.brut) return;
        pregunta('Descartar els canvis', '<p>Es tornarà a l’última versió desada.</p>', [
          { t: 'Continua editant', valor: 0, tipus: 'ghost' }, { t: 'Descarta', valor: 1, tipus: 'danger' }
        ]).then(function (v) { if (v) { S.brut = false; obreEditor(ed.id); } });
        break;
      case 'esborra': donaBaixa(); break;
      case 'imprimeix': pdf([ed.id], null, true); break;
      case 'csv': csv([ed.id], 'criteris-' + normalitza(ed.m.nivell + ' ' + ed.m.materia).replace(/ /g, '-') + '-' + S.dades.curs, true); break;
      case 'carrega': carregaDades(); break;
    }
  });

  // ------------------------------------------------------------------ desar i donar de baixa
  function netejaPerDesar() {
    var ed = S.ed;
    return {
      criteris: ed.criteris.filter(function (c) { return String(c.activitat).trim(); }).map(function (c) {
        var p = num(c.percentatge);
        return { trimestre: c.trimestre, activitat: String(c.activitat).trim(), percentatge: p === null ? '' : p, competencies: c.competencies, competencia_digital: senseCD(ed.m) ? [] : c.competencia_digital };
      }),
      competencies: ed.competencies.filter(function (c) { return String(c.codi).trim() || String(c.descripcio).trim(); })
        .map(function (c) { return { codi: String(c.codi).trim().toUpperCase(), descripcio: String(c.descripcio).trim() }; }),
      info: ed.info
    };
  }

  function desa(forca) {
    var ed = S.ed, dades = netejaPerDesar();
    // Comprovacions que impedeixen desar
    var dolents = dades.criteris.filter(function (c) { return c.percentatge !== '' && (isNaN(c.percentatge) || c.percentatge < 0 || c.percentatge > 100); });
    if (dolents.length) return toast('Percentatge no vàlid a «' + dolents[0].activitat + '»: ha de ser un número entre 0 i 100.', true);
    var sense = dades.competencies.filter(function (c) { return !c.codi; });
    if (sense.length) return toast('Hi ha una competència específica sense codi.', true);
    var codis = dades.competencies.map(function (c) { return c.codi; });
    var rep = codis.filter(function (c, i) { return codis.indexOf(c) !== i; });
    if (rep.length) return toast('El codi ' + rep[0] + ' està repetit a les competències específiques.', true);
    // Avisos que deixen continuar
    var avisos = [];
    var s = sumes(dades.criteris);
    TRIMESTRES.forEach(function (t) {
      if (!s[t].n) avisos.push('El ' + t + ' trimestre no té activitats.');
      else if (Math.abs(s[t].total - 100) > 0.01) avisos.push('Els percentatges del ' + t + ' trimestre sumen ' + fmtNum(s[t].total) + ' %.');
    });
    var foraCE = [], foraCD = [], cd = catalegCD();
    dades.criteris.forEach(function (c) {
      c.competencies.forEach(function (v) { if (codis.indexOf(v) < 0 && foraCE.indexOf(v) < 0) foraCE.push(v); });
      c.competencia_digital.forEach(function (v) { if (cd.indexOf(v) < 0 && foraCD.indexOf(v) < 0) foraCD.push(v); });
    });
    if (foraCE.length) avisos.push('Competències marcades que no són al catàleg de la matèria: ' + foraCE.join(', ') + '.');
    if (foraCD.length) avisos.push('Competències digitals que no són al catàleg: ' + foraCD.join(', ') + '.');
    if (!ed.info.criteri_aprovar.trim()) avisos.push('Falta el criteri per aprovar la matèria.');
    if (!ed.info.recuperacio.trim()) avisos.push('Falten els mecanismes de recuperació.');
    var continua = (avisos.length && !forca) ? pregunta('Abans de desar', '<ul>' + avisos.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul><p>Podeu desar igualment i acabar-ho més endavant.</p>', [
      { t: 'Torna a l’editor', valor: 0, tipus: 'ghost' }, { t: 'Desa igualment', valor: 1, tipus: 'primary' }
    ]) : Promise.resolve(1);
    continua.then(function (v) {
      if (!v) return;
      var boto = $('critEditor').querySelector('[data-accio="desa"]');
      if (boto) { boto.disabled = true; boto.textContent = 'Desant…'; }
      api('criteris', { cos: { accio: 'desa', curs: S.dades.curs, id_materia: ed.id, criteris: dades.criteris, competencies: dades.competencies, info: dades.info, data_anterior: ed.data_anterior, forca: !!forca }, progres: 'Desant ' + ed.m.materia + '…' })
        .then(function (r) {
          if (boto) { boto.disabled = false; boto.textContent = 'Desa'; }
          if (r.ok) {
            var e = S.idx[ed.id];
            e.criteris = dades.criteris.map(function (c, k) { return Object.assign({ id_materia: ed.id, ordre: k + 1 }, c); });
            e.competencies = dades.competencies.map(function (c) { return Object.assign({ id_materia: ed.id }, c); });
            e.info = Object.assign({ id_materia: ed.id, data: r.data, desat_per: r.desat_per }, dades.info);
            S.brut = false;
            ed.avisos = '';
            obreEditor(ed.id);
            toast('Desat correctament.');
            return;
          }
          if (r.error === 'conflicte') {
            pregunta('Algú altre ha desat aquesta matèria', '<p>' + esc(r.desat_per || 'Una altra persona') + ' l’ha desat ' + (r.data ? 'el ' + esc(dataCurta(r.data)) : 'fa poc') +
              ', després que vosaltres l’obríssiu.</p><p>Podeu tornar a carregar-la (perdreu els vostres canvis) o desar la vostra versió (substituirà la seva; l’anterior queda a l’historial).</p>', [
              { t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Torna a carregar', valor: 'recarrega' }, { t: 'Desa la meva versió', valor: 'forca', tipus: 'danger' }
            ]).then(function (v2) {
              if (v2 === 'forca') desa(true);
              if (v2 === 'recarrega') { S.brut = false; S.dades = null; carregaCriteris().then(function () { obreEditor(ed.id); }); }
            });
            return;
          }
          toast(text(r.error) + (MISSATGES[r.error] ? '' : ' (' + r.error + ')'), true);
        }).catch(function () { if (boto) { boto.disabled = false; boto.textContent = 'Desa'; } toast(text('error_servidor'), true); });
    });
  }

  function donaBaixa() {
    var ed = S.ed;
    pregunta('Donar de baixa els criteris', '<p>S’eliminaran tots els criteris, les competències específiques i els textos de <strong>' + esc(ed.m.materia) + '</strong> (' + esc(ed.m.nivell) + ', curs ' + esc(S.dades.curs) + ').</p><p>Queda una còpia a la pestanya «historial» del full.</p>', [
      { t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Dona de baixa', valor: 1, tipus: 'danger' }
    ]).then(function (v) {
      if (!v) return;
      api('criteris', { cos: { accio: 'esborra', curs: S.dades.curs, id_materia: ed.id }, progres: 'Donant de baixa…' }).then(function (r) {
        if (!r.ok) return toast(text(r.error), true);
        var e = S.idx[ed.id];
        e.criteris = []; e.competencies = []; e.info = null;
        S.brut = false;
        toast('S’han donat de baixa els criteris de la matèria.');
        obreEditor(ed.id);
      });
    });
  }

  // ------------------------------------------------------------------ carregar dades (curs anterior o importació 2025-2026)
  function carregaDades() {
    var ed = S.ed, d = S.dades;
    var anterior = (function () { var a = Number(String(d.curs).slice(0, 4)); return (a - 1) + '-' + a; })();
    var origens = (d.origens || []).filter(function (o) { return o.nivell === ed.m.nivell && Number(o.criteris) > 0; });
    var objectiu = normalitza(ed.m.materia);
    var millor = '', punts = 0;
    origens.forEach(function (o) {
      var f = normalitza(String(o.full).replace(/^opt\.?/i, ''));
      var p = 0;
      f.split(' ').forEach(function (w) { if (w.length > 2 && objectiu.indexOf(w.slice(0, 4)) >= 0) p += w.length; });
      if (p > punts) { punts = p; millor = o.origen; }
    });
    var h = '<p>Les dades carregades substitueixen les de l’editor. No es desa res fins que premeu <strong>Desa</strong>.</p>' +
      '<label class="prog-radio"><input type="radio" name="font" value="curs" checked> La mateixa matèria del curs ' + esc(anterior) + '</label>';
    if (origens.length) {
      h += '<label class="prog-radio"><input type="radio" name="font" value="imp"' + (millor ? ' checked' : '') + '> Els fulls de criteris 2025-2026:</label>' +
        '<select class="prog-in" id="selOrigen">' + origens.map(function (o) {
          return '<option value="' + esc(o.origen) + '"' + (o.origen === millor ? ' selected' : '') + '>' + esc(o.full) + ' (' + o.criteris + ' activitats)</option>';
        }).join('') + '</select>';
    }
    pregunta('Carregar dades', h, [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Carrega', valor: 1, tipus: 'primary' }]);
    // Es llegeix la tria abans que es tanqui la finestra
    var botons = $('progModalBtns').querySelectorAll('button');
    botons[botons.length - 1].addEventListener('click', function () {
      var font = ($('progModalText').querySelector('input[name="font"]:checked') || {}).value;
      var origen = $('selOrigen') ? $('selOrigen').value : '';
      var crida = font === 'imp'
        ? api('criteris', { cos: { accio: 'importacio', origen: origen }, progres: 'Carregant ' + origen + '…' })
        : api('criteris', { cos: { accio: 'materia', curs: d.curs, curs_origen: anterior, id_materia: ed.id }, progres: 'Carregant el curs ' + anterior + '…' });
      crida.then(function (r) {
        if (!r.ok) return toast(text(r.error), true);
        if (!r.criteris.length && !r.competencies.length && !(r.info && (r.info.criteri_aprovar || r.info.recuperacio || r.info.observacions))) {
          return toast(font === 'imp' ? 'Aquest full no té dades.' : 'Aquesta matèria no té dades al curs ' + anterior + '.', true);
        }
        var nou = copiaDades({ criteris: r.criteris, competencies: r.competencies, info: r.info || {} });
        ed.criteris = nou.criteris; ed.competencies = nou.competencies; ed.info = nou.info;
        ed.avisos = (font === 'imp' ? 'Origen: ' + origen + ' (curs 2025-2026).' : 'Origen: curs ' + anterior + '.') + (r.info && r.info.avisos ? '\n' + r.info.avisos : '');
        marcaBrut(true);
        pintaEditor();
        toast('Dades carregades. Reviseu-les i deseu.');
      });
    }, { once: true });
  }

  // ------------------------------------------------------------------ informes
  function dadesInforme(id, actual) {
    if (actual && S.ed && S.ed.id === id) {
      var n = netejaPerDesar();
      return { m: S.ed.m, criteris: n.criteris, competencies: n.competencies, info: n.info, data: (S.idx[id].info || {}).data };
    }
    var e = S.idx[id];
    return { m: e.m, criteris: e.criteris, competencies: e.competencies, info: e.info || {}, data: (e.info || {}).data };
  }

  // ------------------------------------------------------------------ PDF (es descarrega directament)
  // El document el construeix /assets/js/criteris-pdf.js (també el fan servir les pàgines d'ESO i Batxillerat).
  function pdf(ids, titolGrup, actual) {
    var d = S.dades;
    var amb = ids.filter(function (id) { var x = dadesInforme(id, actual); return x.criteris.length || x.competencies.length || (x.info && (x.info.criteri_aprovar || x.info.recuperacio || x.info.observacions)); });
    if (!amb.length && !titolGrup) return toast('Aquesta matèria encara no té dades.', true);
    Progres.inici('Generant el PDF…');
    CriterisPdf.prepara(function (f) { Progres.posa(f, f > 0.4 ? 'Carregant la tipografia…' : 'Preparant el PDF…'); }).then(function (R) {
      Progres.posa(0.7, 'Generant el PDF…');
      var portada = null;
      if (titolGrup) {
        var compta = { completa: 0, curs: 0, pendent: 0 };
        ids.forEach(function (id) { compta[estat(S.idx[id]).codi]++; });
        portada = {
          titol: 'Criteris de qualificació', subtitol: titolGrup + ' · Curs ' + d.curs,
          head: [['Nivell', 'Matèria', '1r', '2n', '3r', 'CE', 'Aprovar', 'Recup.', 'Estat']],
          body: ids.map(function (id) {
            var e = S.idx[id], st = estat(e), info = e.info || {};
            return [e.m.nivell, e.m.materia].concat(TRIMESTRES.map(function (t) { return st.s[t].n ? fmtNum(st.s[t].total) + ' %' : '—'; }),
              [String(e.competencies.length), info.criteri_aprovar ? 'Sí' : '—', info.recuperacio ? 'Sí' : '—', st.nom]);
          }),
          columnStyles: { 0: { cellWidth: 17 }, 2: { halign: 'right', cellWidth: 15 }, 3: { halign: 'right', cellWidth: 15 }, 4: { halign: 'right', cellWidth: 15 }, 5: { halign: 'right', cellWidth: 10 }, 6: { cellWidth: 15 }, 7: { cellWidth: 15 }, 8: { cellWidth: 19 } },
          nota: ids.length + ' matèries · ' + compta.completa + ' completes · ' + compta.curs + ' en curs · ' + compta.pendent + ' pendents.'
        };
      }
      var doc = CriterisPdf.genera(R, {
        curs: d.curs, lang: 'ca', capcalera: 'Programacions · Criteris de qualificació', portada: portada,
        competenciesDigitals: d.competencies_digitals,
        materies: amb.map(function (id) {
          var x = dadesInforme(id, actual);
          return { titol: x.m.materia, pagina: x.m.nivell + ' · ' + x.m.materia, criteris: x.criteris, competencies: x.competencies, info: x.info, senseCD: senseCD(x.m),
            subtitol: (NOM_NIVELL[x.m.nivell] || x.m.nivell) + ' · ' + nomDep(x.m.departament) + (x.data ? ' · Actualitzat el ' + dataCurta(x.data).split(' ')[0] : '') };
        })
      });
      var nom = 'criteris-' + (titolGrup ? normalitza(titolGrup) : normalitza(dadesInforme(ids[0], actual).m.nivell + ' ' + dadesInforme(ids[0], actual).m.materia)).replace(/ /g, '-') + '-' + d.curs + '.pdf';
      doc.save(nom);
      Progres.fi();
      toast('S’ha descarregat ' + nom + '.');
    }).catch(function (err) {
      Progres.fi(true);
      toast('No s’ha pogut generar el PDF. Comproveu la connexió i torneu-ho a provar.', true);
      if (window.console) console.error(err);
    });
  }

  function csv(ids, nom, actual) {
    var files = [['Curs', 'Nivell', 'Matèria', 'Departament', 'Trimestre', 'Ordre', 'Activitat avaluativa', 'Percentatge', 'Competència específica', 'Competència digital']];
    ids.forEach(function (id) {
      var x = dadesInforme(id, actual), ordre = {};
      x.criteris.forEach(function (c) {
        ordre[c.trimestre] = (ordre[c.trimestre] || 0) + 1;
        var p = num(c.percentatge);
        files.push([S.dades.curs, x.m.nivell, x.m.materia, nomDep(x.m.departament), c.trimestre, ordre[c.trimestre], c.activitat,
          p !== null && !isNaN(p) ? String(p).replace('.', ',') : '', (c.competencies || []).join(', '), senseCD(x.m) ? '' : (c.competencia_digital || []).join(', ')]);
      });
    });
    if (files.length === 1) return toast('No hi ha criteris per exportar.', true);
    var cos = '﻿' + files.map(function (f) {
      return f.map(function (v) { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';');
    }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([cos], { type: 'text/csv;charset=utf-8' }));
    a.download = nom + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  // ------------------------------------------------------------------ inici
  comprova();
})();
