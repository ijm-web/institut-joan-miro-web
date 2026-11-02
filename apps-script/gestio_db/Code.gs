/**
 * GESTIO · pont entre Netlify (web de l'institut) i els fulls de càlcul ijm_nucli_db i ijm_alumnat_db
 *
 * On va aquest codi: al full ijm_nucli_db › Extensions › Apps Script (fitxer Code.gs).
 * Aquest fitxer és una còpia de referència: si el canvies aquí, enganxa'l també a l'editor
 * i torna a desplegar (Desplega › Gestiona els desplegaments › ✏️ › Versió nova › Desplega).
 *
 * Seguretat: només respon si la petició porta el secret correcte (propietat de l'script GESTIO_SECRET),
 * que coneixen només aquest script i Netlify (variable GESTIO_SCRIPT_SECRET). Netlify comprova la sessió
 * amb Google i envia el correu de qui fa la petició; AQUEST script decideix què pot fer cada correu
 * (equips → permisos per mòdul). Ningú no entra directament als fulls.
 *
 * Fitxers:
 *   ijm_nucli_db   (on viu aquest script): professorat, equips, permisos, camps i historial de tots els mòduls.
 *   ijm_alumnat_db (fitxer a part, amb els seus permisos de Drive): pestanya «alumnes». L'obre aquest mateix
 *                  script amb l'ID que hi ha a config › db_alumnat. No necessita cap Apps Script propi.
 *
 * Pestanyes de ijm_nucli_db (es creen soles amb «configura»; les columnes es llegeixen pel nom de la capçalera):
 *   config      : clau | valor | descripcio          (admins d'emergència, estat, curs, fitxers i fonts d'importació)
 *   professorat : id_professor | <un camp per columna, definits a «camps»; els calculats no es desen> | data | desat_per
 *   pas         : id_pas | <camps del mòdul PAS> | data | desat_per        (PAS 28: personal d'administració i serveis)
 *   equips      : id_equip | nom | tipus (gestio/docent) | descripcio | actiu
 *   membres     : id_equip | id_membre (PRO-… o PAS-…) | carrec
 *   moduls      : id_modul | nom | descripcio | ordre | actiu
 *   permisos    : id_equip | id_modul (o *) | nivell (consulta/edicio/admin)
 *   camps       : modul | clau | nom | tipus | valors | obligatori | unic | visible_des_de | origen | ordre | actiu
 *   historial   : data | usuari | accio | taula | id | detall
 * Pestanya de ijm_alumnat_db:
 *   alumnes     : id_alumne | <camps del mòdul alumnat> | data | desat_per
 *   copia_<curs>_<data> : còpia de seguretat que fa el tancament de curs abans de canviar res (PAS 28)
 *
 * Nivells (cadascun inclou l'anterior):
 *   consulta : veure, filtrar i exportar (només els camps «visible_des_de = consulta»)
 *   edicio   : alta, baixa i modificació de files
 *   admin    : a més, camps (columnes) del mòdul · permisos del mòdul: pot donar «consulta» i «edicio» (PAS 26: només admin)
 *   admin global (equip amb permís «*» admin, o correu a config › admins): tots els mòduls, equips i nivell admin
 */

const FULL = { conf: 'config', prof: 'professorat', pas: 'pas', eq: 'equips', memb: 'membres', mod: 'moduls', perm: 'permisos',
  camps: 'camps', hist: 'historial', alu: 'alumnes', bat: 'alumnes_bat', ent: 'entrades' };
const CAP = {
  equips: ['id_equip', 'nom', 'tipus', 'descripcio', 'actiu'],
  membres: ['id_equip', 'id_membre', 'carrec'],
  moduls: ['id_modul', 'nom', 'descripcio', 'ordre', 'actiu'],
  permisos: ['id_equip', 'id_modul', 'nivell'],
  camps: ['modul', 'clau', 'nom', 'tipus', 'valors', 'obligatori', 'unic', 'visible_des_de', 'origen', 'ordre', 'actiu'],
  historial: ['data', 'usuari', 'accio', 'taula', 'id', 'detall'],
};
const ESQUEMA = 29;   // versió de l'estructura dels fulls (la desa «configura» a config › esquema)
const CONFIG_PER_DEFECTE = [
  ['admins', '', 'Accés d\'emergència: correus (separats per comes) que sempre entren com a admin global, encara que els permisos tinguin un error. Només es canvia aquí.'],
  ['estat', 'obert', 'obert o tancat. Si és tancat, només els admins globals poden desar.'],
  ['curs', '2026-2027', 'Curs actual (aaaa-aaaa). El tancament de curs de l\'alumnat el fa avançar i canvia els títols dels grups (Grup-Classe 25-26 / 26-27).'],
  ['font_professorat', '', 'Per a importaProfessorat: ID (o URL) del full amb les dades actuals del professorat.'],
  ['font_professorat_pestanya', '', 'Per a importaProfessorat: nom de la pestanya (en blanc = la primera).'],
  ['db_alumnat', '', 'ID (o URL) del full ijm_alumnat_db, on es desen les dades del mòdul Alumnat.'],
  ['font_alumnat', '', 'Per a importaAlumnat: URL dels fulls de registre (1r ESO, 2n ESO…), separats per comes.'],
  ['font_alumnat_pestanya', 'Dades', 'Per a importaAlumnat: nom de la pestanya amb les dades de cada full de registre.'],
  ['esquema', '', 'Versió de l\'estructura dels fulls. La posa «configura»: no la canvieu.'],
  ['copia_tancament', '', 'La posa el tancament de curs de l\'ESO: pestanya d\'ijm_alumnat_db amb la còpia d\'abans del darrer tancament (per a desfesTancament).'],
  ['curs_batxillerat', '', 'Curs actual del mòdul Alumnat Batxillerat (aaaa-aaaa; en blanc = el mateix que «curs»). El fa avançar el tancament de curs del batxillerat.'],
  ['font_control_entrada', '', 'Per a importaControlEntrada: URL del full amb el registre d\'entrades amb retard que es feia fins ara.'],
  ['copia_tancament_batxillerat', '', 'La posa el tancament de curs del batxillerat (per a desfesTancamentBatxillerat).'],
];
const MODULS_PER_DEFECTE = [
  ['professorat', 'Professorat', 'Dades administratives de cada docent: graella amb filtres, alta, baixa i modificació.', 1, 'si'],
  ['alumnat', 'Alumnat ESO', 'Dades acadèmiques de l\'alumnat d\'ESO (1r a 4t): grups, optatives, itinerari, diversitat i autoritzacions.', 2, 'si'],
  ['batxillerat', 'Alumnat Batxillerat', 'Dades acadèmiques de l\'alumnat de batxillerat: grups, itinerari, matèries, pendents i autoritzacions.', 3, 'si'],
  ['pas', 'PAS', 'Personal d\'administració i serveis: administració, consergeria… Graella amb filtres, alta, baixa i modificació.', 4, 'si'],
  ['nou_professor', 'Nou professor/a', 'Formulari d\'alta d\'un docent nou (secretaria): dades, validació i PDF per signar.', 5, 'si'],
  ['control_entrada', 'Control d\'entrada', 'Registre de les entrades amb retard de l\'alumnat (ESO i batxillerat) i anàlisi per alumne.', 6, 'si'],
  ['equips', 'Equips i permisos', 'Equips de gestió i docents, i quins mòduls hi té accés cada equip. Només direcció.', 99, 'si'],
];
// Camps inicials (els admins del mòdul en poden afegir, canviar i arxivar des del web)
// [clau, nom, tipus, valors, obligatori, unic, visible_des_de, origen]
const CAMPS_PROFESSORAT = [
  ['nom', 'Nom', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['cognom1', '1r cognom', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['cognom2', '2n cognom', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['estat', 'Estat', 'llista', 'actiu|baixa laboral|permís|substitut|baixa', 'si', 'no', 'edicio', 'gestio'],
  ['nif', 'NIF', 'nif', '', 'no', 'si', 'edicio', 'gestio'],
  ['especialitat', 'Especialitat', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['email_xtec', 'Correu XTEC', 'correu', '@xtec.cat', 'no', 'si', 'consulta', 'gestio'],
  ['email', 'Correu institutjoanmiro', 'correu', '@institutjoanmiro.cat', 'si', 'si', 'consulta', 'gestio'],
  ['jornada', 'Jornada', 'llista', 'Sencera|1/2|⅔', 'no', 'no', 'edicio', 'gestio'],
  ['situacio', 'Situació laboral', 'llista', 'Definitiu|Comissió de serveis|Provisional|Interí|Substitut', 'no', 'no', 'edicio', 'gestio'],
  ['anys', 'Anys', 'numero', '', 'no', 'no', 'edicio', 'gestio'],
  ['catala', 'Català', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['carrec', 'Càrrec', 'text', '', 'no', 'no', 'consulta', 'gestio'],
];
// PAS 28: personal d'administració i serveis (es gestiona com el professorat; poques persones, alta a mà)
const CAMPS_PAS = [
  ['nom', 'Nom', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['cognom1', '1r cognom', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['cognom2', '2n cognom', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['estat', 'Estat', 'llista', 'actiu|baixa laboral|substitut|baixa', 'si', 'no', 'edicio', 'gestio'],
  ['categoria', 'Àmbit', 'llista', 'Administració|Consergeria|Altres', 'si', 'no', 'consulta', 'gestio'],
  ['nif', 'NIF', 'nif', '', 'no', 'si', 'edicio', 'gestio'],
  ['email', 'Correu institutjoanmiro', 'correu', '@institutjoanmiro.cat', 'no', 'si', 'consulta', 'gestio'],
  ['telefon', 'Telèfon', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['jornada', 'Jornada', 'llista', 'Sencera|1/2|⅔', 'no', 'no', 'edicio', 'gestio'],
  ['horari', 'Horari', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['carrec', 'Càrrec', 'text', '', 'no', 'no', 'consulta', 'gestio'],
];
// PAS 24: el nivell consulta del professorat només veu aquests camps (la resta passen a «des d'edició»)
const PROFESSORAT_CONSULTA = ['nom', 'cognom1', 'cognom2', 'especialitat', 'email_xtec', 'email', 'carrec'];
const GRUPS_1R = ['1r ESO A', '1r ESO B', '1r ESO C', '1r ESO D', '1r ESO GR'];
const GRUPS_2N = ['2n ESO A', '2n ESO B', '2n ESO C', '2n ESO D', '2n ESO GR'];
const OPTATIVES_1R = ['Alemany', 'Francès', 'Italià', 'Anglès', 'Tècniques d\'estudi', 'Esports de raqueta', 'Taller de matemàtiques', 'Taller d\'expressió'];
const OPTATIVES_2N = ['Alemany', 'Francès', 'Italià', 'Anglès', 'Taller d\'expressió', 'Expressió artística', 'Esports de raqueta'];
// PAS 29: 3r i 4t d'ESO (amb els grups UEC) i batxillerat
const GRUPS_3R = ['3r ESO A', '3r ESO B', '3r ESO C', '3r ESO D', '3r ESO E', '3r ESO GR', '3r ESO UEC'];
const GRUPS_4T = ['4t ESO A', '4t ESO B', '4t ESO C', '4t ESO D', '4t ESO E', '4t ESO GR', '4t ESO UEC'];
const GRUPS_ESO = GRUPS_1R.concat(GRUPS_2N, GRUPS_3R, GRUPS_4T);
const GRUPS_1BAT = ['1r BAT A', '1r BAT B', '1r BAT C'];
const GRUPS_2BAT = ['2n BAT A', '2n BAT B', '2n BAT C'];
const OPTATIVES_3R = ['Alemany', 'Francès', 'Italià', 'Anglès', 'Teatre', 'Esports de raqueta', 'Cultura científica'];
const ITINERARIS_4T = ['Tecnològic', 'Científic', 'Social', 'Humanístic', 'Artístic'];
const ITINERARIS_BAT = ['Tecnològic', 'Científic', 'Social', 'Humanístic'];
// Matèries de cada franja de 4t (canvien cada curs: l'admin del mòdul les pot editar a «Gestió camps»)
const FRANJA1_4T = ['Física-Química-Tec', 'Física-Química-Cien-G1', 'Física-Química-Cien-G2', 'Biologia-G1', 'Informàtica-Soc-G1', 'Economia-G2', 'Filosofia', 'EVIP'];
const FRANJA2_4T = ['Informàtica-Tec', 'Física-Química-Cien-G1', 'Biologia-G2', 'Informàtica-Soc-G2', 'Economia-G1', 'Llatí', 'Música'];
const FRANJA3_4T = ['Francès', 'Alemany', 'Italià', 'Emprenedoria-G1', 'Emprenedoria-G2', 'Tecnologia'];
const ESTATS_ALUMNAT = ['promociona', 'repeteix 1r', 'repeteix 2n', 'repeteix 3r', 'repeteix 4t', 'alumne extern', 'baixa'];
const ESTATS_BAT = ['promociona', 'repeteix 1r BAT', 'repeteix 2n BAT', 'alumne extern', 'baixa'];
// PAS 28: nivells d'ESO en ordre (el tancament de curs fa avançar «promociona» al següent) i decisió de final de curs
const NIVELLS_ESO = ['1r ESO', '2n ESO', '3r ESO', '4t ESO'];
const NIVELLS_ALUMNAT = NIVELLS_ESO;
const NIVELLS_BAT = ['1r BAT', '2n BAT'];
const DECISIONS = ['promociona', 'repeteix', 'baixa'];
// Etapes: nivells en ordre i com es diu «repeteix» a cada nivell. A 1r d'ESO no hi ha «promociona» (vénen de primària).
const ETAPES = {
  alumnat: { nivells: NIVELLS_ESO, repeteix: (n) => 'repeteix ' + String(n).split(' ')[0], primerSensePromocio: true },
  batxillerat: { nivells: NIVELLS_BAT, repeteix: (n) => 'repeteix ' + n, primerSensePromocio: false },
};
// Camps que només s'omplen en alguns nivells (la resta, a tots). n = 1, 2, 3, 4 dins de l'etapa.
const QUART_ESO = ['itinerari', 'franja1', 'franja2', 'franja3', 'mates_orientacio', 'mates_pares', 'catala_4t', 'castella_4t'];
function aplica_(modul, clau, n) {
  if (!n) return true;
  if (modul === 'alumnat') {
    if (clau === 'optativa_2n') return n >= 2;
    if (clau === 'optativa_3r') return n >= 3;
    if (QUART_ESO.indexOf(clau) >= 0) return n === 4;
  }
  if (modul === 'batxillerat') {
    if (/^m1_/.test(clau)) return n === 1;
    if (/^m2_/.test(clau) || clau === 'materies_soltes') return n === 2;
  }
  return true;
}
const restringit_ = (modul, clau) => !!ETAPES[modul] && ETAPES[modul].nivells.some((x, i) => !aplica_(modul, clau, i + 1));
const CAMPS_ALUMNAT = [
  ['nom', 'Nom', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['cognom1', '1r cognom', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['cognom2', '2n cognom', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['nivell', 'Nivell', 'llista', NIVELLS_ALUMNAT.join('|'), 'si', 'no', 'consulta', 'gestio'],
  ['grup_anterior', 'Grup-Classe 25-26', 'llista', GRUPS_ESO.join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['grup_actual', 'Grup-Classe 26-27', 'llista', GRUPS_ESO.join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['estat', 'Estat', 'llista', ESTATS_ALUMNAT.join('|'), 'si', 'no', 'consulta', 'gestio'],
  ['decisio_final', 'Decisió final', 'llista', DECISIONS.join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['pendents', 'Pendents', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['optativa_1r', 'Optativa 1r', 'llista', OPTATIVES_1R.join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['optativa_2n', 'Optativa 2n', 'llista', OPTATIVES_2N.join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['optativa_3r', 'Optativa 3r', 'llista', OPTATIVES_3R.join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['itinerari', 'Itinerari 4t', 'llista', ITINERARIS_4T.join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['franja1', 'Franja 1', 'llista', FRANJA1_4T.join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['franja2', 'Franja 2', 'llista', FRANJA2_4T.join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['franja3', 'Franja 3', 'llista', FRANJA3_4T.join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['mates_orientacio', 'Orientació mates', 'llista', 'A|B|DIV', 'no', 'no', 'consulta', 'gestio'],
  ['mates_pares', 'Mates (pares)', 'llista', 'A|B|DIV', 'no', 'no', 'consulta', 'gestio'],
  ['catala_4t', 'Català 4t', 'llista', 'A|B|DIV', 'no', 'no', 'consulta', 'gestio'],
  ['castella_4t', 'Castellà 4t', 'llista', 'A|B|DIV', 'no', 'no', 'consulta', 'gestio'],
  ['div_mates', 'Div. mates', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['div_catala', 'Div. català', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['div_castella', 'Div. castellà', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['nouvingut', 'Nouvingut', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['data_arribada', 'Data arribada', 'data', '', 'no', 'no', 'consulta', 'gestio'],
  ['pi_psp', 'PI/PSP', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['nese_a', 'NESE-A', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['nese_b', 'NESE-B', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['nee', 'NEE', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['aut_imatge', 'Aut. imatge', 'llista', 'sí|no', 'no', 'no', 'consulta', 'gestio'],
  ['aut_dies_especials', 'Aut. dies especials', 'llista', 'sí|no', 'no', 'no', 'consulta', 'gestio'],
  ['aut_medicaments', 'Aut. medicaments', 'llista', 'sí|no', 'no', 'no', 'consulta', 'gestio'],
  ['aut_sortida_metge', 'Aut. sortida metge', 'llista', 'sí|no', 'no', 'no', 'consulta', 'gestio'],
  ['aut_sortida_1a_6a', 'Aut. sortida 1a/6a', 'llista', 'sí|no', 'no', 'no', 'consulta', 'gestio'],
  ['observacions', 'Observacions', 'text', '', 'no', 'no', 'consulta', 'gestio'],
];
// PAS 29 · matèries de batxillerat: una columna sí/no per matèria (i per grup quan n'hi ha més d'un: G1, G2…).
// [clau, nom, capçaleres del full de registre que s'hi importen]. m1_ = 1r BAT, m2_ = 2n BAT.
const MATERIES_1BAT = [
  ['m1_mates_tec', 'Matemàtiques (tec.)', ['mates-tec']], ['m1_mates_cient', 'Matemàtiques (cient.)', ['mates-cient']],
  ['m1_mates_soc_g1', 'Mat. aplicades CS G1', ['mates socials-g1']], ['m1_mates_soc_g2', 'Mat. aplicades CS G2', ['mates socials-g2']],
  ['m1_llati', 'Llatí', ['llatí']], ['m1_grec', 'Grec', ['grec']],
  ['m1_tecno', 'Tecnologia i enginyeria', ['tecnologia i enginyeria']], ['m1_dibuix', 'Dibuix tècnic', ['d. tècnic']],
  ['m1_biogeo', 'Biologia i geologia', ['biologiageo']],
  ['m1_fq_tec', 'Física i química (tec.)', ['físicaquímica- tec']], ['m1_fq_cient', 'Física i química (cient.)', ['físicaquímica- cient']],
  ['m1_economia_g1', 'Economia G1', ['economia-g1']], ['m1_economia_g2', 'Economia G2', ['economia-g2']],
  ['m1_hc_g1', 'Hist. món contemporani G1', ['h.comtemp-g1', 'h.contemp-g1']], ['m1_hc_g2', 'Hist. món contemporani G2', ['h.comtemp-g2', 'h.contemp-g2']],
  ['m1_amp_fis_tec', 'Ampliació física (tec.)', ['ampliacio fisica- tec']], ['m1_amp_fis_cient', 'Ampliació física (cient.)', ['ampliacio fisica-cient']],
  ['m1_amp_qui_tec', 'Ampliació química (tec.)', ['ampliació química tec']], ['m1_amp_qui_cient', 'Ampliació química (cient.)', ['ampliació química cient']],
  ['m1_robotica', 'Robòtica', ['robòtica']], ['m1_biomedicina', 'Biomedicina', ['biomedicina']], ['m1_programacio', 'Programació', ['programació']],
  ['m1_amp_bio', 'Ampliació biologia', ['ampliació bio']], ['m1_amp_geo', 'Ampliació geologia', ['ampliació geo']],
  ['m1_prob_socials', 'Problemàtiques socials', ['prob. socials']], ['m1_creacio_lit', 'Creació literària', ['cr. literaria']],
  ['m1_func_empresa', 'Funcionament de l\'empresa', ['func. empresa']], ['m1_mon_classic', 'Món clàssic', ['món clàssic']],
  ['m1_ciutadania', 'Ciutadania, política i dret', ['ciu. pol. i dret']], ['m1_fopp', 'FOPP', ['fopp']], ['m1_psicologia', 'Psicologia', ['psicologia']],
  ['m1_lit_universal', 'Literatura universal', ['lit. universal']],
  ['m1_frances', 'Francès', ['francès']], ['m1_alemany', 'Alemany', ['alemany']], ['m1_italia', 'Italià', ['italià']],
];
const MATERIES_2BAT = [
  ['m2_mates_tec', 'Matemàtiques II (tec.)', ['mates tec']], ['m2_mates_cient', 'Matemàtiques II (cient.)', ['mates cient']],
  ['m2_mates_soc', 'Mat. aplicades CS II', ['mates (social)']], ['m2_llati', 'Llatí II', ['llatí']], ['m2_grec', 'Grec II', ['grec']],
  ['m2_tecno', 'Tecnologia i enginyeria II', ['t.industrial']], ['m2_dibuix', 'Dibuix tècnic II', ['d. tècnic']],
  ['m2_biologia', 'Biologia', ['biologia']], ['m2_quimica', 'Química', ['química']],
  ['m2_fisica_g1', 'Física G1', ['fisica g1']], ['m2_fisica_g2', 'Física G2', ['fisica g2']],
  ['m2_empresa', 'Empresa i disseny de models de negoci', ['empresa']], ['m2_geografia', 'Geografia', ['geografia']],
  ['m2_hart', 'Història de l\'art', ['h. art']], ['m2_lit_catalana', 'Literatura catalana', ['lit. catalana']],
  ['m2_lit_castellana', 'Literatura castellana', ['lit. castellana']], ['m2_cc_ambientals', 'Ciències ambientals', ['c. ambientals']],
  ['m2_frances', 'Francès II', ['francès']], ['m2_alemany', 'Alemany II', ['alemany']], ['m2_italia', 'Italià II', ['italià']],
];
const CAMPS_BATXILLERAT = [
  ['nom', 'Nom', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['cognom1', '1r cognom', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['cognom2', '2n cognom', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['nivell', 'Nivell', 'llista', NIVELLS_BAT.join('|'), 'si', 'no', 'consulta', 'gestio'],
  ['grup_anterior', 'Grup-Classe 25-26', 'llista', GRUPS_4T.concat(GRUPS_1BAT, GRUPS_2BAT).join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['grup_actual', 'Grup-Classe 26-27', 'llista', GRUPS_1BAT.concat(GRUPS_2BAT).join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['estat', 'Estat', 'llista', ESTATS_BAT.join('|'), 'si', 'no', 'consulta', 'gestio'],
  ['decisio_final', 'Decisió final', 'llista', DECISIONS.join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['itinerari', 'Itinerari', 'llista', ITINERARIS_BAT.join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['pendents', 'Pendents', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['materies_soltes', 'Matèries soltes', 'text', '', 'no', 'no', 'consulta', 'gestio'],
].concat(MATERIES_1BAT.concat(MATERIES_2BAT).map((m) => [m[0], m[1], 'si_no', '', 'no', 'no', 'consulta', 'gestio']), [
  ['pi_psp', 'PI', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['aut_imatge', 'Aut. imatge', 'llista', 'sí|no', 'no', 'no', 'consulta', 'gestio'],
  ['aut_dies_especials', 'Aut. dies especials', 'llista', 'sí|no', 'no', 'no', 'consulta', 'gestio'],
  ['aut_medicaments', 'Aut. medicaments', 'llista', 'sí|no', 'no', 'no', 'consulta', 'gestio'],
  ['aut_sortida_metge', 'Aut. sortida metge', 'llista', 'sí|no', 'no', 'no', 'consulta', 'gestio'],
  ['aut_sortida_1a_6a', 'Aut. sortida 1a/6a', 'llista', 'sí|no', 'no', 'no', 'consulta', 'gestio'],
  ['observacions', 'Observacions', 'text', '', 'no', 'no', 'consulta', 'gestio'],
]);
// PAS 29: CONTROL D'ENTRADA · una fila per entrada amb retard (es registra des del web: «Nova entrada»)
const CAMPS_CONTROL = [
  ['alumne', 'Alumne', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['nivell', 'Nivell', 'llista', NIVELLS_ESO.concat(NIVELLS_BAT).join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['grup', 'Grup-Classe', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['data', 'Data', 'data', '', 'si', 'no', 'consulta', 'gestio'],
  ['hora', 'Hora', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['id_alumne', 'Codi alumne', 'text', '', 'no', 'no', 'admin', 'gestio'],
];
// Capçaleres del full actual de professorat → clau del camp (per a importaProfessorat)
const IMPORTACIO_PROFESSORAT = {
  'nom': 'nom', '1r cognom': 'cognom1', '2n cognom': 'cognom2', 'nif': 'nif', 'especialitat': 'especialitat',
  'email xtec': 'email_xtec', 'email institutjoanmiro': 'email', 'jornada': 'jornada',
  'anys': 'anys', 'català': 'catala', 'catala': 'catala', 'càrrec': 'carrec', 'carrec': 'carrec',
};
// Capçaleres dels fulls de registre d'alumnat → clau del camp (per a importaAlumnat)
// (Les columnes «Grup-Classe aa-bb» es reconeixen a part: la de l'any més alt és el grup actual i l'altra, l'anterior.)
// Capçaleres dels fulls de registre → clau del camp (es comparen normalitzades: minúscules, sense accents ni signes).
// Les que comencen per «_» es tracten a part (imatge). PAS 29: 3r, 4t i batxillerat.
const IMPORTACIO_ALUMNAT = {
  'optativa 1r': 'optativa_1r', 'optativa 2n': 'optativa_2n', 'optativa 3r': 'optativa_3r', 'pendents': 'pendents', 'pendents 1r bat': 'pendents',
  'mat. soltes': 'materies_soltes', 'itinerari': 'itinerari', 'batxillerat': 'itinerari',
  'franja1': 'franja1', 'franja2': 'franja2', 'franja3': 'franja3', 'orientació mates': 'mates_orientacio', 'mates pares': 'mates_pares',
  'català 4t': 'catala_4t', 'castellà 4t': 'castella_4t',
  'div mates': 'div_mates', 'div català': 'div_catala', 'div castellà': 'div_castella',
  'nouvingut': 'nouvingut', 'data arribada': 'data_arribada', 'pi/psp': 'pi_psp', 'pi': 'pi_psp', 'nese-a': 'nese_a', 'nese-b': 'nese_b', 'nee': 'nee',
  'aut. imatge': 'aut_imatge', 'dies especials': 'aut_dies_especials', 'aut. dies especials': 'aut_dies_especials',
  'medicaments': 'aut_medicaments', 'aut. medicaments': 'aut_medicaments', 'medicament?': 'aut_medicaments',
  'sort metge': 'aut_sortida_metge', 'sortida metge': 'aut_sortida_metge', '1a/6a hora': 'aut_sortida_1a_6a',
  'no aut. imatge': '_no_imatge', 'drets imatge': '_drets_imatge',
};
// Capçaleres que no s'importen (decisions del PAS 29): preferències, dades temporals, ANS, RALC, núm. de matrícula…
const IMPORTACIO_IGNORA = ['num', 'num.', 'núm.', 'cognoms i nom', 'cognoms, nom', 'observacions', 'repetidor', 'ans', 'num. matrícula', 'núm. matrícula',
  'consell orientador', 'repetidor/soltes', 'pendents extraordinària', 'número ralc'];
const normCap_ = (k) => String(k == null ? '' : k).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9/?]+/g, ' ').trim();
// Noms d'optatives als fulls antics → nom de la llista
const OPTATIVA_ALIES = { 'c.científic': 'Taller de matemàtiques', 'c. científic': 'Taller de matemàtiques', 'construïm coneixement científic': 'Taller de matemàtiques',
  'esports raquetes': 'Esports de raqueta', 'raquetes': 'Esports de raqueta', 'iniciació als esports de raqueta': 'Esports de raqueta',
  'tecnificació en esports de raqueta': 'Esports de raqueta', 'anglès (reforç)': 'Anglès', 'opt. anglès': 'Anglès',
  'cons_mates': 'Taller de matemàtiques', 'cons mates': 'Taller de matemàtiques', 'cons. mates': 'Taller de matemàtiques' };
// Observacions dels fulls de registre → estat
const ESTAT_ALIES = { 'nou alumne': 'alumne extern', 'alumne nou': 'alumne extern', 'extern': 'alumne extern', 'alumne extern': 'alumne extern',
  'repetidor 1r': 'repeteix 1r', 'repetidor 2n': 'repeteix 2n', 'repetidor 3r': 'repeteix 3r', 'repetidor 4t': 'repeteix 4t',
  'repeteix 1r bat': 'repeteix 1r BAT', 'repeteix 2n bat': 'repeteix 2n BAT', 'repeteix 2n bat-soltes': 'repeteix 2n BAT', 'baixa': 'baixa' };
// Situació laboral: al full original són quatre columnes excloents (amb una X); a GESTIO és un sol camp
const SITUACIONS = { 'definitiu': 'Definitiu', 'comissió serveis': 'Comissió de serveis', 'comissio serveis': 'Comissió de serveis',
  'comissió de serveis': 'Comissió de serveis', 'provisional': 'Provisional', 'interí': 'Interí', 'interi': 'Interí' };
const CLAUS_SITUACIO_ANTIGUES = ['definitiu', 'comissio_serveis', 'provisional', 'interi'];
// Estat de cada docent (camp obligatori i de sistema: no es pot arxivar ni canviar de tipus)
//   actiu · baixa laboral · substitut : formen part del claustre d'aquest curs
//   baixa                             : ja no hi forma part (no pot entrar a GESTIO; es pot reactivar)
// Estat de l'alumnat: promociona · repeteix 1r · repeteix 2n · alumne extern · baixa (baixa = s'amaga per defecte)
const deBaixa_ = (r) => norm_(r.estat) === 'baixa';
const TIPUS = ['text', 'numero', 'data', 'llista', 'si_no', 'correu', 'nif', 'calculat'];
// PAS 23: aquests camps calculats ja no formen part del mòdul (el nom complet es compon on cal)
const CALCULATS_RETIRATS = ['nom_cognom', 'nom_complet', 'nom_cognoms'];
// Valors antics de jornada → valors de la llista
const JORNADA_ALIES = { 'completa': 'Sencera', 'sencera': 'Sencera', 'complet': 'Sencera', '1': 'Sencera', '1/1': 'Sencera',
  '1/2': '1/2', 'mitja': '1/2', 'mitja jornada': '1/2', '0,5': '1/2', '0.5': '1/2', '2/3': '⅔', '⅔': '⅔' };
const NIVELLS = ['consulta', 'edicio', 'admin'];
const MAX_TEXT = 2000;

// Mòduls amb graella de dades: on es desen i com són els codis interns
const MODULS = {
  professorat: { full: FULL.prof, id: 'id_professor', prefix: 'PRO-', xifres: 4, equips: true, nom: 'docent', ss: () => SpreadsheetApp.getActive() },
  pas: { full: FULL.pas, id: 'id_pas', prefix: 'PAS-', xifres: 3, equips: true, nom: 'persona', ss: () => SpreadsheetApp.getActive() },
  alumnat: { full: FULL.alu, id: 'id_alumne', prefix: 'ALU-', xifres: 5, equips: false, nom: 'alumne', ss: () => ssAlumnat_() },
  // PAS 29: el batxillerat, a la seva pestanya; els codis ALU- són únics entre les dues (un alumne el conserva)
  batxillerat: { full: FULL.bat, id: 'id_alumne', prefix: 'ALU-', xifres: 5, equips: false, nom: 'alumne', ss: () => ssAlumnat_() },
  // PAS 29: registre d'entrades amb retard (a ijm_alumnat_db: són dades d'alumnes). La data de registre és «registrat».
  control_entrada: { full: FULL.ent, id: 'id_entrada', prefix: 'ENT-', xifres: 6, equips: false, nom: 'entrada', registre: true, ss: () => ssAlumnat_() },
};
function ssAlumnat_() {
  const id = (String(llegeixConfig_().db_alumnat || '').match(/[-\w]{25,}/) || [''])[0];
  if (!id) throw new Error('db_alumnat_no_configurat');
  return SpreadsheetApp.openById(id);
}
// Nivell d'un alumne: 1 (1r ESO) … 4 (4t ESO); el camp «nivell» i, si és buit, el grup actual
const nivellAlumne_ = (v) => nivellIdx_('alumnat', v);
// Posició del nivell dins de l'etapa del mòdul (1…); 0 si no se sap. Camp «nivell» i, si és buit, el grup actual.
const nivellIdx_ = (modul, v) => { const E = ETAPES[modul]; if (!E) return 0; const g = String(v.nivell || v.grup_actual || ''); return E.nivells.findIndex((n) => g.indexOf(n) === 0) + 1; };
// Nivell d'un grup qualsevol (ESO o batxillerat), p. ex. «4t ESO C» → «4t ESO»; «1r Bat B» → «1r BAT»
const TOTS_NIVELLS = NIVELLS_ESO.concat(NIVELLS_BAT);
const nivellDeGrup_ = (g) => { const x = String(g || '').toUpperCase(); return TOTS_NIVELLS.filter((n) => x.indexOf(n.toUpperCase()) === 0)[0] || ''; };
// Curs de cada mòdul d'alumnat (el batxillerat es pot tancar en un altre moment que l'ESO)
const clauCurs_ = (modul) => (modul === 'batxillerat' ? 'curs_batxillerat' : 'curs');
const clauCopia_ = (modul) => (modul === 'batxillerat' ? 'copia_tancament_batxillerat' : 'copia_tancament');
const cursDe_ = (cfg, modul) => String(cfg[clauCurs_(modul)] || cfg.curs || '').trim();
// El codi ALU- següent, comptant les dues pestanyes d'alumnat
function maxAlumne_() {
  let max = 0;
  [MODULS.alumnat, MODULS.batxillerat].forEach((M) => {
    const sh = M.ss().getSheetByName(M.full);
    if (!sh || sh.getLastRow() < 2) return;
    const cap = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_);
    const j = cap.indexOf(M.id); if (j < 0) return;
    sh.getRange(2, j + 1, sh.getLastRow() - 1, 1).getDisplayValues().forEach((r) => { const n = Number(String(r[0]).replace(/\D/g, '')) || 0; if (n > max) max = n; });
  });
  return max;
}
const ordinal_ = (nivell) => String(nivell || '').split(' ')[0];   // «2n ESO» → «2n»
// Títols dels grups a partir del curs (2026-2027 → «Grup-Classe 25-26» i «Grup-Classe 26-27»)
function titolsGrups_(curs) {
  const a = Number(String(curs || '').slice(0, 4)) || 2026;
  const yy = (n) => String(n).slice(2);
  return { grup_anterior: 'Grup-Classe ' + yy(a - 1) + '-' + yy(a), grup_actual: 'Grup-Classe ' + yy(a) + '-' + yy(a + 1) };
}
// Regles entre camps (a més de la validació de cada camp). Retornen null o { error, camp }.
// canviats: en una modificació, la regla només es comprova si ha canviat algun dels camps que hi intervenen.
// PAS 29: les mateixes regles per a l'ESO i el batxillerat (ETAPES i aplica_)
function reglaAlumnat_(modul) {
  const E = ETAPES[modul];
  return (v, canviats) => {
    if (canviats && !canviats.some((k) => ['nivell', 'grup_anterior', 'grup_actual', 'estat'].indexOf(k) >= 0 || restringit_(modul, k))) return null;
    const n = nivellIdx_(modul, v), niv = E.nivells[n - 1] || '';
    // El grup actual ha de ser del nivell (p. ex. 2n ESO → 2n ESO A…); buit = per assignar (després del tancament)
    if (v.nivell && String(v.grup_actual || '').trim() && String(v.grup_actual).indexOf(v.nivell) !== 0) return { error: 'grup_nivell', camp: 'grup_actual' };
    // Camps que no s'omplen en aquest nivell (optatives de cursos superiors, 4t, matèries de l'altre curs de batxillerat…)
    const fora = Object.keys(v).filter((k) => String(v[k] == null ? '' : v[k]).trim() && !aplica_(modul, k, n))[0];
    if (fora) return { error: 'no_aplica_nivell', camp: fora };
    // A 1r d'ESO només té grup anterior qui repeteix 1r (els altres vénen de primària)
    if (E.primerSensePromocio && n === 1 && String(v.grup_anterior || '').trim() && v.estat !== E.repeteix(niv)) return { error: 'no_aplica_1r', camp: 'grup_anterior' };
    if (v.estat && niv) {
      if (/^repeteix /.test(v.estat) && v.estat !== E.repeteix(niv)) return { error: 'estat_nivell', camp: 'estat' };
      if (E.primerSensePromocio && n === 1 && v.estat === 'promociona') return { error: 'estat_nivell', camp: 'estat' };
    }
    return null;
  };
}
const REGLES = { alumnat: reglaAlumnat_('alumnat'), batxillerat: reglaAlumnat_('batxillerat') };

// ---------------------------------------------------------------------------------------------
function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'peticio_invalida' }); }
  const secret = PropertiesService.getScriptProperties().getProperty('GESTIO_SECRET');
  if (!secret || req.secret !== secret) return json_({ ok: false, error: 'no_autoritzat' });
  try {
    const email = String(req.email || '').trim().toLowerCase();
    if (req.action === 'ping') return json_({ ok: true, missatge: 'Connexió correcta amb ijm_nucli_db' });
    if (!email) return json_({ ok: false, error: 'peticio_invalida' });
    const ctx = context_(email);
    switch (req.action) {
      case 'inici':        return json_(inici_(ctx));
      case 'dades':        return json_(dades_(ctx, req.modul));
      case 'desa':         return json_(desa_(ctx, req));
      case 'esborra':      return json_(esborra_(ctx, req));
      case 'camps_desa':   return json_(campsDesa_(ctx, req));
      case 'permisos':     return json_(permisos_(ctx, req.modul));
      case 'permisos_desa':return json_(permisosDesa_(ctx, req));
      case 'equips':       return json_(equips_(ctx));
      case 'equips_desa':  return json_(equipsDesa_(ctx, req));
      case 'membres_desa': return json_(membresDesa_(ctx, req));
      case 'permisos_matriu_desa': return json_(permisosMatriuDesa_(ctx, req));
      case 'tanca_curs':   return json_(tancaCurs_(ctx, req));
      case 'versio':       return json_(MODULS[req.modul] && pot_(ctx, req.modul, 'consulta') ? { ok: true, versio: versio_(req.modul) } : { ok: false, error: 'sense_permis' });
      case 'nou_professor':  return json_(nouProfessor_(ctx));
      case 'entrada_alumnes': return json_(entradaAlumnes_(ctx));
      case 'entrada_nova':   return json_(entradaNova_(ctx, req));
      case 'alta_professor': return json_(altaProfessor_(ctx, req));
      default:             return json_({ ok: false, error: 'accio_desconeguda' });
    }
  } catch (err) {
    const m = String(err && err.message || err);
    if (m === 'db_alumnat_no_configurat') return json_({ ok: false, error: m });
    return json_({ ok: false, error: 'error_script', detall: m });
  }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ------------------------------------------------------------------ qui és i què pot fer
function context_(email) {
  const cfg = llegeixConfig_();
  const admins = String(cfg.admins || '').toLowerCase().split(/[,;\s]+/).filter(Boolean);
  // PAS 28: qui entra pot ser del professorat o del PAS (el mateix correu no hauria de ser a tots dos)
  const persones = llegeix_(FULL.prof).map((x) => Object.assign({ id: x.id_professor }, x))
    .concat(llegeix_(FULL.pas).map((x) => Object.assign({ id: x.id_pas }, x)));
  const p = persones.filter((x) => String(x.email || '').toLowerCase() === email && !deBaixa_(x))[0] || null;
  const meus = p ? llegeix_(FULL.memb).filter((m) => m.id_membre === p.id).map((m) => m.id_equip) : [];
  const equipsActius = llegeix_(FULL.eq).filter((q) => norm_(q.actiu) !== 'no').map((q) => q.id_equip);
  const eqs = meus.filter((id) => equipsActius.indexOf(id) >= 0);
  const perms = llegeix_(FULL.perm).filter((r) => eqs.indexOf(r.id_equip) >= 0);
  const global = admins.indexOf(email) >= 0 || perms.some((r) => r.id_modul === '*' && norm_(r.nivell) === 'admin');
  const nivell = (modul) => {
    if (global) return 'admin';
    if (modul === 'equips') return '';   // equips i permisos: només admins globals
    let n = -1;
    perms.forEach((r) => { if (r.id_modul === modul || r.id_modul === '*') n = Math.max(n, NIVELLS.indexOf(norm_(r.nivell))); });
    return n >= 0 ? NIVELLS[n] : '';
  };
  return { email: email, persona: p, equips: eqs, global: global, nivell: nivell, cfg: cfg };
}
const pot_ = (ctx, modul, nivell) => NIVELLS.indexOf(ctx.nivell(modul)) >= NIVELLS.indexOf(nivell);
const obert_ = (ctx) => norm_(ctx.cfg.estat || 'obert') === 'obert' || ctx.global;

function inici_(ctx) {
  const moduls = llegeix_(FULL.mod).filter((m) => norm_(m.actiu) !== 'no')
    .map((m) => ({ id: m.id_modul, nom: m.nom, descripcio: m.descripcio, ordre: Number(m.ordre) || 50, nivell: ctx.nivell(m.id_modul) }))
    .filter((m) => m.nivell)
    .sort((a, b) => a.ordre - b.ordre);
  if (!moduls.length) return { ok: false, error: 'sense_acces' };
  const p = ctx.persona;
  return { ok: true, email: ctx.email, nom: p ? [p.nom, p.cognom1].filter(Boolean).join(' ') : '', id_persona: p ? p.id : '',
    admin_global: ctx.global, moduls: moduls, estat: norm_(ctx.cfg.estat || 'obert') };
}

// ------------------------------------------------------------------ dades d'un mòdul (graella)
function campsDe_(modul, totes) {
  return llegeix_(FULL.camps).filter((c) => c.modul === modul && (totes || norm_(c.actiu) !== 'no'))
    .map((c) => ({ clau: c.clau, nom: c.nom || c.clau, tipus: TIPUS.indexOf(c.tipus) >= 0 ? c.tipus : 'text', valors: c.valors || '',
      obligatori: norm_(c.obligatori) === 'si', unic: norm_(c.unic) === 'si', visible_des_de: NIVELLS.indexOf(c.visible_des_de) >= 0 ? c.visible_des_de : 'consulta',
      origen: c.origen === 'clickedu' ? 'clickedu' : 'gestio', ordre: Number(c.ordre) || 0, actiu: norm_(c.actiu) !== 'no' }))
    .sort((a, b) => a.ordre - b.ordre);
}
const visibles_ = (ctx, modul, camps) => camps.filter((c) => NIVELLS.indexOf(ctx.nivell(modul)) >= NIVELLS.indexOf(c.visible_des_de));

function dades_(ctx, modul) {
  const M = MODULS[modul];
  if (!M) return { ok: false, error: 'modul_desconegut' };
  if (!pot_(ctx, modul, 'consulta')) return { ok: false, error: 'sense_permis' };
  const tots = campsDe_(modul, true);
  const camps = visibles_(ctx, modul, tots.filter((c) => c.actiu));
  const veuEstat = camps.some((c) => c.clau === 'estat');
  const ambEquips = M.equips && pot_(ctx, modul, 'edicio');
  const membres = ambEquips ? llegeix_(FULL.memb) : [];
  const files = llegeixFull_(fullModul_(M, tots))
    // Qui no pot veure l'estat (p. ex. consulta del professorat) només veu les files que no són de baixa
    .filter((r) => veuEstat || !deBaixa_(r))
    .map((r) => {
      const o = { id: r[M.id], data: r.data || '', desat_per: r.desat_per || '' };
      camps.forEach((c) => { o[c.clau] = c.tipus === 'calculat' ? calcula_(c, r) : (r[c.clau] == null ? '' : r[c.clau]); });
      if (ambEquips) o.equips = membres.filter((m) => m.id_membre === r[M.id]).map((m) => m.id_equip);
      return o;
    });
  const equips = ambEquips ? llegeix_(FULL.eq).filter((q) => norm_(q.actiu) !== 'no').map((q) => ({ id: q.id_equip, nom: q.nom, tipus: q.tipus })) : [];
  const nivell = ctx.nivell(modul);
  return { ok: true, modul: modul, nivell: nivell, obert: obert_(ctx), admin_global: ctx.global, amb_equips: ambEquips, nom_fila: M.nom,
    curs: ETAPES[modul] ? cursDe_(ctx.cfg, modul) : (ctx.cfg.curs || ''), nivells: ETAPES[modul] ? ETAPES[modul].nivells : undefined,
    versio: versio_(modul),
    camps: camps, camps_tots: nivell === 'admin' ? tots : undefined, files: files, equips: equips };
}

// ------------------------------------------------------------------ desar canvis (alta, modificació, baixa)
function calcula_(c, v) {
  // valors = «nom cognom1 cognom2» o «cognom1 cognom2, nom»: claus separades per espais; la coma es manté
  return String(c.valors || '').replace(/[a-z_0-9]+/g, (k) => String(v[k] == null ? '' : v[k]).trim())
    .replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').trim();
}
// DNI (8 xifres + lletra) o NIE (X/Y/Z + 7 xifres + lletra), amb la lletra de control
function nifValid_(x) {
  const m = /^([XYZ]?)(\d{7,8})([A-Z])$/.exec(x);
  if (!m || (m[1] && m[2].length !== 7) || (!m[1] && m[2].length !== 8)) return false;
  const n = Number(({ X: '0', Y: '1', Z: '2' }[m[1]] || '') + m[2]);
  return 'TRWAGMYFPDXBNJZSQVHLCKE'.charAt(n % 23) === m[3];
}
// Data aaaa-mm-dd que existeix (no 2026-02-30)
function dataValida_(x) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
// canviats: si es passa, el format només es comprova als camps que han canviat (les dades antigues que no
// compleixen el format no impedeixen desar una altra columna de la mateixa fila); l'obligatori, sempre.
function valida_(camps, v, canviats) {
  for (const c of camps) {
    const x = String(v[c.clau] == null ? '' : v[c.clau]).trim();
    if (c.tipus === 'calculat') continue;
    if (c.obligatori && !x) return { error: 'obligatori', camp: c.nom };
    if (!x) continue;
    if (canviats && canviats.indexOf(c.clau) < 0) continue;
    if (c.tipus === 'nif' && !nifValid_(x)) return { error: 'nif_invalid', camp: c.nom };
    if (x.length > MAX_TEXT) return { error: 'massa_llarg', camp: c.nom };
    if (c.tipus === 'numero' && isNaN(Number(x.replace(',', '.')))) return { error: 'numero_invalid', camp: c.nom };
    if (c.tipus === 'data' && !dataValida_(x)) return { error: 'data_invalida', camp: c.nom };
    if (c.tipus === 'si_no' && ['si', 'sí', 'no'].indexOf(x.toLowerCase()) < 0) return { error: 'si_no_invalid', camp: c.nom };
    if (c.tipus === 'correu') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)) return { error: 'correu_invalid', camp: c.nom };
      if (c.valors && c.valors.charAt(0) === '@' && !x.toLowerCase().endsWith(c.valors.toLowerCase())) return { error: 'correu_domini', camp: c.nom, domini: c.valors };
    }
    if (c.tipus === 'llista' && c.valors) {
      const ops = c.valors.split('|').map((s) => s.trim());
      if (ops.indexOf(x) < 0) return { error: 'valor_no_permes', camp: c.nom };
    }
  }
  return null;
}

function desa_(ctx, req) {
  const modul = String(req.modul || ''), M = MODULS[modul];
  if (!M) return { ok: false, error: 'modul_desconegut' };
  if (!pot_(ctx, modul, M.registre ? 'admin' : 'edicio')) return { ok: false, error: 'sense_permis' };
  if (!obert_(ctx)) return { ok: false, error: 'tancat' };
  const canvis = Array.isArray(req.canvis) ? req.canvis : [], altes = Array.isArray(req.altes) ? req.altes : [];
  if (canvis.length + altes.length > 500) return { ok: false, error: 'massa_canvis' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const totsCamps = campsDe_(modul, true);
    const sh = fullModul_(M, totsCamps);
    const editables = visibles_(ctx, modul, totsCamps.filter((c) => c.actiu && c.origen !== 'clickedu' && c.tipus !== 'calculat'));
    // Les regles retornen la clau del camp; a l'error hi va el nom (com a la validació de cada camp)
    const reglaClau = REGLES[modul] || (() => null);
    const regla = (v, ch) => { const e = reglaClau(v, ch); if (!e) return null; const c = totsCamps.filter((x) => x.clau === e.camp)[0]; return Object.assign({}, e, { camp: c ? c.nom : e.camp }); };
    const vals = sh.getDataRange().getDisplayValues();
    const cap = vals[0].map(norm_);
    const col = (k) => cap.indexOf(k);
    const files = vals.slice(1).map((r, i) => ({ fila: i + 2, r: r }));
    const perId = {};
    files.forEach((f) => { const id = String(f.r[col(M.id)]).trim(); if (id) perId[id] = f; });
    const ara = ara_();
    const conflictes = [], errors = [];
    const resultat = [];
    // 1) Modificacions (inclosa la baixa: valors.estat = 'baixa' / reactivació: un altre estat)
    const plans = [];
    canvis.forEach((c) => {
      const f = perId[String(c.id)];
      if (!f) { errors.push({ id: c.id, error: 'no_existeix' }); return; }
      const dataFila = String(f.r[col('data')] || '');
      if (!req.forca && !M.registre && String(c.data_anterior || '') !== dataFila) conflictes.push({ id: c.id, desat_per: f.r[col('desat_per')], data: dataFila });
      const actual = {}; cap.forEach((k, j) => { if (k) actual[k] = f.r[j]; });
      const nou = Object.assign({}, actual);
      const v = c.valors || {};
      editables.forEach((cm) => { if (Object.prototype.hasOwnProperty.call(v, cm.clau)) nou[cm.clau] = net_(v[cm.clau], cm); });
      const err = valida_(editables, nou, Object.keys(v)) || regla(nou, Object.keys(v));
      if (err) errors.push(Object.assign({ id: c.id }, err));
      plans.push({ f: f, abans: actual, nou: nou, equips: M.equips && Array.isArray(v.equips) ? v.equips : null });
    });
    // 2) Altes
    const altesPlans = [];
    let seguent = 1 + Object.keys(perId).reduce((m, id) => { const n = Number(String(id).replace(/\D/g, '')); return n > m ? n : m; }, 0);
    if (M.prefix === 'ALU-' && altes.length) seguent = Math.max(seguent, 1 + maxAlumne_());
    altes.forEach((a, k) => {
      const v = a.valors || {}, nou = {};
      editables.forEach((cm) => { nou[cm.clau] = net_(v[cm.clau], cm); });
      if ((modul === 'professorat' || modul === 'pas') && totsCamps.some((cm) => cm.clau === 'estat') && !nou.estat) nou.estat = 'actiu';
      // Alumnat (també l'alta massiva per fitxer): sense nivell, el del grup; sense estat, «alumne extern»
      if (ETAPES[modul]) {
        if (!nou.nivell && nou.grup_actual) nou.nivell = ETAPES[modul].nivells.filter((x) => String(nou.grup_actual).indexOf(x) === 0)[0] || '';
        if (!nou.estat && editables.some((cm) => cm.clau === 'estat')) nou.estat = 'alumne extern';
      }
      const err = valida_(editables, nou) || regla(nou);
      nou[M.id] = codi_(M, seguent++);
      if (err) errors.push(Object.assign({ id: a.tmp || ('alta-' + (k + 1)) }, err));
      altesPlans.push({ tmp: a.tmp, nou: nou, equips: M.equips && Array.isArray(v.equips) ? v.equips : null });
    });
    // 3) Valors únics (entre totes les files, tenint en compte els canvis)
    const unics = totsCamps.filter((c) => c.unic);
    const tmpDe = {}; altesPlans.forEach((p, k) => { tmpDe[p.nou[M.id]] = p.tmp || ('alta-' + (k + 1)); });
    if (unics.length) {
      const finals = {};
      files.forEach((f) => { const id = String(f.r[col(M.id)]); const o = {}; cap.forEach((k, j) => { o[k] = f.r[j]; }); finals[id] = o; });
      plans.forEach((p) => { finals[String(p.abans[M.id])] = p.nou; });
      altesPlans.forEach((p) => { finals[p.nou[M.id]] = p.nou; });
      unics.forEach((u) => {
        const vist = {};
        Object.keys(finals).forEach((id) => {
          const x = String(finals[id][u.clau] || '').trim().toLowerCase();
          if (!x) return;
          if (vist[x]) errors.push({ id: tmpDe[id] || id, error: 'repetit', camp: u.nom });
          vist[x] = id;
        });
      });
    }
    if (errors.length) return { ok: false, error: 'validacio', errors: errors };
    if (conflictes.length) return { ok: false, error: 'conflicte', conflictes: conflictes };
    // 4) Equips: només els admins globals canvien qui és a cada equip
    const vol = plans.some((p) => p.equips) || altesPlans.some((p) => p.equips);
    if (vol && !ctx.global) return { ok: false, error: 'equips_no_permes' };
    // 5) Escriure
    const usuari = ctx.email;
    plans.forEach((p) => {
      if (!M.registre) p.nou.data = ara;   // al control d'entrada «data» és la data de l'entrada, no la de desat
      p.nou.desat_per = usuari;
      const fila = cap.map((k) => (k && p.nou[k] !== undefined ? p.nou[k] : ''));
      sh.getRange(p.f.fila, 1, 1, cap.length).setValues([fila]);
      const eraBaixa = deBaixa_(p.abans), esBaixa = deBaixa_(p.nou);
      historial_(usuari, esBaixa && !eraBaixa ? 'baixa' : (!esBaixa && eraBaixa ? 'reactivacio' : 'modificacio'), M.full, p.abans[M.id], difer_(p.abans, p.nou));
      resultat.push(p.nou);
    });
    altesPlans.forEach((p) => {
      if (!M.registre) p.nou.data = ara;
      p.nou.desat_per = usuari;
      sh.appendRow(cap.map((k) => (k && p.nou[k] !== undefined ? p.nou[k] : '')));
      historial_(usuari, 'alta', M.full, p.nou[M.id], '');
      resultat.push(Object.assign({ tmp: p.tmp }, p.nou));
    });
    if (vol) {
      const canviEquips = plans.filter((p) => p.equips).map((p) => ({ id: String(p.abans[M.id]), equips: p.equips }))
        .concat(altesPlans.filter((p) => p.equips).map((p) => ({ id: p.nou[M.id], equips: p.equips })));
      desaMembres_(canviEquips, usuari);
    }
    marcaVersio_(modul, usuari);
    const ambEquips = M.equips && pot_(ctx, modul, 'edicio');
    const membres = ambEquips ? llegeix_(FULL.memb) : [];
    return { ok: true, data: ara, versio: versio_(modul), files: resultat.map((r) => ({ tmp: r.tmp, id: r[M.id], data: r.data,
      equips: ambEquips ? membres.filter((m) => m.id_membre === r[M.id]).map((m) => m.id_equip) : undefined,
      valors: visibles_(ctx, modul, totsCamps).reduce((o, c) => { o[c.clau] = c.tipus === 'calculat' ? calcula_(c, r) : (r[c.clau] == null ? '' : r[c.clau]); return o; }, {}) })) };
  } finally { lock.releaseLock(); }
}
const codi_ = (M, n) => M.prefix + ('00000000' + n).slice(-M.xifres);
const apostrof_ = (s) => String(s == null ? '' : s).replace(/[’´`]/g, '\'');
function net_(x, c) {
  let s = apostrof_(x).trim();
  const l = s.toLowerCase();
  if (c.tipus === 'si_no') s = ['si', 'sí', 'x', 'true', '1', 'verdadero', 'cert'].indexOf(l) >= 0 ? 'sí' : (['no', 'false', '0', 'falso', 'fals', 'n'].indexOf(l) >= 0 || !s ? '' : s);
  if (c.tipus === 'correu') s = s.toLowerCase();
  if (c.tipus === 'numero') s = s.replace(',', '.');
  if (c.tipus === 'nif') s = s.toUpperCase().replace(/[\s.\-]/g, '');
  if (c.tipus === 'data' && ['false', 'true', 'fals', 'cert', '-'].indexOf(l) >= 0) s = '';
  if (c.tipus === 'data') { const m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s); if (m) s = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
  if (c.clau === 'jornada' && JORNADA_ALIES[l]) s = JORNADA_ALIES[l];
  if (c.clau.indexOf('optativa') === 0 && OPTATIVA_ALIES[l]) s = OPTATIVA_ALIES[l];
  if (c.tipus === 'llista' && s && c.valors) {
    const ops = c.valors.split('|').map((o) => o.trim());
    if (ops.indexOf('sí') >= 0 && ['si', 'x', 'true'].indexOf(l) >= 0) s = 'sí';
    const op = ops.filter((o) => o.toLowerCase() === s.toLowerCase())[0];   // majúscules/minúscules com a la llista
    if (op) s = op;
  }
  return s;
}
function difer_(a, b) {
  const d = {};
  Object.keys(b).forEach((k) => { if (k !== 'data' && k !== 'desat_per' && String(a[k] == null ? '' : a[k]) !== String(b[k] == null ? '' : b[k])) d[k] = [a[k], b[k]]; });
  return JSON.stringify(d).slice(0, 45000);
}
function desaMembres_(canvis, usuari) {
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.memb);
  const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
  const ci = cap.indexOf('id_membre'), ce = cap.indexOf('id_equip');
  const ids = canvis.map((c) => c.id);
  const queden = vals.slice(1).filter((r) => ids.indexOf(String(r[ci])) < 0 && r.join('') !== '');
  canvis.forEach((c) => c.equips.forEach((e) => { const r = cap.map(() => ''); r[ci] = c.id; r[ce] = e; queden.push(r); }));
  if (vals.length > 1) sh.getRange(2, 1, vals.length - 1, cap.length).clearContent();
  if (queden.length) sh.getRange(2, 1, queden.length, cap.length).setValues(queden);
  canvis.forEach((c) => historial_(usuari, 'equips', FULL.memb, c.id, JSON.stringify(c.equips)));
}

// Esborrar del tot (només per a errors d'alta): admin del mòdul
function esborra_(ctx, req) {
  const modul = String(req.modul || ''), M = MODULS[modul];
  if (!M) return { ok: false, error: 'modul_desconegut' };
  if (!pot_(ctx, modul, M.registre ? 'edicio' : 'admin')) return { ok: false, error: 'sense_permis' };
  const ids = (req.ids || []).map(String);
  if (!ids.length) return { ok: false, error: 'peticio_invalida' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = fullModul_(M, campsDe_(modul, true));
    const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_), ci = cap.indexOf(M.id);
    const esborrades = [];
    for (let i = vals.length - 1; i >= 1; i--) {
      if (ids.indexOf(String(vals[i][ci])) >= 0) {
        const o = {}; cap.forEach((k, j) => { o[k] = vals[i][j]; });
        historial_(ctx.email, 'esborra', M.full, String(vals[i][ci]), JSON.stringify(o).slice(0, 45000));
        sh.deleteRow(i + 1); esborrades.push(String(vals[i][ci]));
      }
    }
    if (M.equips) desaMembres_(esborrades.map((id) => ({ id: id, equips: [] })), ctx.email);
    marcaVersio_(modul, ctx.email);
    return { ok: true, esborrades: esborrades };
  } finally { lock.releaseLock(); }
}

// ------------------------------------------------------------------ camps (columnes) d'un mòdul: admin
function campsDesa_(ctx, req) {
  const modul = String(req.modul || ''), M = MODULS[modul];
  if (!M) return { ok: false, error: 'modul_desconegut' };
  if (!pot_(ctx, modul, 'admin')) return { ok: false, error: 'sense_permis' };
  const nous = Array.isArray(req.camps) ? req.camps : [];
  const existents = campsDe_(modul, true);
  const claus = {};
  const files = [];
  for (let i = 0; i < nous.length; i++) {
    const c = nous[i];
    const clau = String(c.clau || '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(clau) || [M.id, 'id_persona', 'actiu', 'data', 'desat_per', 'equips', 'id'].indexOf(clau) >= 0) return { ok: false, error: 'clau_invalida', camp: clau || '(buida)' };
    if (claus[clau]) return { ok: false, error: 'clau_repetida', camp: clau };
    claus[clau] = 1;
    let tipus = TIPUS.indexOf(c.tipus) >= 0 ? c.tipus : 'text';
    if (!String(c.nom || '').trim()) return { ok: false, error: 'nom_buit', camp: clau };
    let valors = String(c.valors || '').slice(0, 1000), obligatori = !!c.obligatori, actiu = c.actiu !== false, origen = c.origen === 'clickedu' ? 'clickedu' : 'gestio';
    if (clau === 'estat') {
      // Camp de sistema: sempre llista obligatòria i activa, amb «baixa» (i al professorat, «actiu») com a valors
      tipus = 'llista'; obligatori = true; actiu = true; origen = 'gestio';
      const ops = valors.split('|').map((x) => x.trim()).filter(Boolean);
      (modul === 'professorat' || modul === 'pas' ? ['actiu', 'baixa'] : ['baixa']).forEach((x) => { if (ops.indexOf(x) < 0) ops.push(x); });
      valors = ops.join('|');
    }
    files.push([modul, clau, String(c.nom).trim().slice(0, 80), tipus, valors, obligatori ? 'si' : 'no', c.unic ? 'si' : 'no',
      NIVELLS.indexOf(c.visible_des_de) >= 0 ? c.visible_des_de : 'consulta', origen, i + 1, actiu ? 'si' : 'no']);
  }
  // Un camp existent no es pot fer desaparèixer: s'arxiva (actiu = no) perquè les dades es conservin
  const perduts = existents.filter((e) => !claus[e.clau]).map((e) => e.clau);
  if (perduts.length) return { ok: false, error: 'camp_no_es_pot_treure', camps: perduts };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(FULL.camps);
    const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_), cm = cap.indexOf('modul');
    const altres = vals.slice(1).filter((r) => String(r[cm]) !== modul && r.join('') !== '');
    const totes = altres.concat(files.map((f) => CAP.camps.map((k) => f[CAP.camps.indexOf(k)])));
    if (vals.length > 1) sh.getRange(2, 1, vals.length - 1, cap.length).clearContent();
    if (totes.length) sh.getRange(2, 1, totes.length, CAP.camps.length).setValues(totes);
    fullModul_(M, campsDe_(modul, true));
    historial_(ctx.email, 'camps', FULL.camps, modul, JSON.stringify(files.map((f) => f.slice(1, 5))).slice(0, 45000));
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// ------------------------------------------------------------------ permisos d'un mòdul
// Es donen a equips. PAS 27: només els administradors globals (equips amb admin a «Tots els mòduls», p. ex. EQ-DIR)
// els gestionen, des del mòdul «Equips i permisos» (matriu: permisosMatriuDesa_). Dins dels mòduls ja no hi ha
// botó Permisos; aquestes dues accions es mantenen per compatibilitat, però també només per a admins globals.
function assignables_(ctx, modul) {
  return ctx.global ? NIVELLS.slice() : [];
}
function permisos_(ctx, modul) {
  if (!modul || !ctx.global) return { ok: false, error: 'sense_permis' };
  const perms = llegeix_(FULL.perm);
  const eqs = llegeix_(FULL.eq).filter((q) => norm_(q.actiu) !== 'no');
  const llista = eqs.map((q) => {
    const r = perms.filter((p) => p.id_equip === q.id_equip && p.id_modul === modul)[0];
    const total = perms.filter((p) => p.id_equip === q.id_equip && p.id_modul === '*')[0];
    return { id_equip: q.id_equip, nom: q.nom, tipus: q.tipus, nivell: r ? norm_(r.nivell) : '', tots_moduls: total ? norm_(total.nivell) : '' };
  });
  return { ok: true, modul: modul, equips: llista, assignables: assignables_(ctx, modul), nivell: ctx.nivell(modul) };
}
function permisosDesa_(ctx, req) {
  const modul = String(req.modul || '');
  if (!modul || modul === '*') return { ok: false, error: 'peticio_invalida' };
  const pots = assignables_(ctx, modul);
  if (!pots.length) return { ok: false, error: 'sense_permis' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(FULL.perm);
    const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
    const ce = cap.indexOf('id_equip'), cm = cap.indexOf('id_modul'), cn = cap.indexOf('nivell');
    let files = vals.slice(1).filter((r) => r.join('') !== '');
    const canvis = Array.isArray(req.canvis) ? req.canvis : [];
    for (const c of canvis) {
      const eq = String(c.id_equip || ''), nou = norm_(c.nivell || '');
      const actual = files.filter((r) => String(r[ce]) === eq && String(r[cm]) === modul)[0];
      const nivellActual = actual ? norm_(actual[cn]) : '';
      // Només es toca un equip que tingui un nivell que es pugui donar (no es pot rebaixar un igual o superior)
      if (nivellActual && pots.indexOf(nivellActual) < 0) return { ok: false, error: 'nivell_no_permes', id_equip: eq };
      if (nou && pots.indexOf(nou) < 0) return { ok: false, error: 'nivell_no_permes', id_equip: eq };
      files = files.filter((r) => !(String(r[ce]) === eq && String(r[cm]) === modul));
      if (nou) { const r = cap.map(() => ''); r[ce] = eq; r[cm] = modul; r[cn] = nou; files.push(r); }
      historial_(ctx.email, 'permisos', FULL.perm, eq + ' · ' + modul, nivellActual + ' → ' + (nou || '(cap)'));
    }
    if (vals.length > 1) sh.getRange(2, 1, vals.length - 1, cap.length).clearContent();
    if (files.length) sh.getRange(2, 1, files.length, cap.length).setValues(files);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// Matriu de permisos (mòdul Equips i permisos, només admins globals): canvis [{ id_equip, id_modul (o *), nivell ('' = cap) }]
function permisosMatriuDesa_(ctx, req) {
  if (!ctx.global) return { ok: false, error: 'sense_permis' };
  const canvis = Array.isArray(req.canvis) ? req.canvis : [];
  const equips = llegeix_(FULL.eq).map((q) => q.id_equip), moduls = llegeix_(FULL.mod).map((m) => m.id_modul).concat(['*']);
  for (const c of canvis) {
    if (equips.indexOf(String(c.id_equip)) < 0) return { ok: false, error: 'id_equip_invalid', id_equip: c.id_equip };
    if (moduls.indexOf(String(c.id_modul)) < 0 || c.id_modul === 'equips') return { ok: false, error: 'peticio_invalida' };
    if (c.nivell && NIVELLS.indexOf(norm_(c.nivell)) < 0) return { ok: false, error: 'nivell_no_permes', id_equip: c.id_equip };
  }
  // Salvaguarda: l'equip directiu no es pot quedar sense «*» admin des del web (es canvia directament al full)
  if (canvis.some((c) => c.id_equip === 'EQ-DIR' && c.id_modul === '*' && norm_(c.nivell) !== 'admin')) return { ok: false, error: 'eq_dir_protegit' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(FULL.perm);
    const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
    const ce = cap.indexOf('id_equip'), cm = cap.indexOf('id_modul'), cn = cap.indexOf('nivell');
    let files = vals.slice(1).filter((r) => r.join('') !== '');
    canvis.forEach((c) => {
      const eq = String(c.id_equip), mod = String(c.id_modul), nou = norm_(c.nivell || '');
      const abans = (files.filter((r) => String(r[ce]) === eq && String(r[cm]) === mod)[0] || [])[cn] || '';
      files = files.filter((r) => !(String(r[ce]) === eq && String(r[cm]) === mod));
      if (nou) { const r = cap.map(() => ''); r[ce] = eq; r[cm] = mod; r[cn] = nou; files.push(r); }
      if (norm_(abans) !== nou) historial_(ctx.email, 'permisos', FULL.perm, eq + ' · ' + mod, norm_(abans) + ' → ' + (nou || '(cap)'));
    });
    if (vals.length > 1) sh.getRange(2, 1, vals.length - 1, cap.length).clearContent();
    if (files.length) sh.getRange(2, 1, files.length, cap.length).setValues(files);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// ------------------------------------------------------------------ equips (només admins globals)
function equips_(ctx) {
  if (!ctx.global) return { ok: false, error: 'sense_permis' };
  const membres = llegeix_(FULL.memb);
  const perms = llegeix_(FULL.perm);
  // Persones que poden ser membres d'un equip: professorat i PAS (PAS 28)
  const pers = llegeix_(FULL.prof).map((p) => ({ id: p.id_professor, p: p, detall: p.especialitat || '' }))
    .concat(llegeix_(FULL.pas).map((p) => ({ id: p.id_pas, p: p, detall: 'PAS' + (p.categoria ? ' · ' + p.categoria : '') })));
  const nomDe = (id) => { const x = pers.filter((y) => y.id === id)[0]; return x ? [x.p.nom, x.p.cognom1, x.p.cognom2].filter(Boolean).join(' ') : id; };
  return { ok: true, equips: llegeix_(FULL.eq).map((q) => ({ id_equip: q.id_equip, nom: q.nom, tipus: q.tipus || 'gestio', descripcio: q.descripcio || '',
    actiu: norm_(q.actiu) === 'no' ? 'no' : 'si',
    membres: membres.filter((m) => m.id_equip === q.id_equip).map((m) => nomDe(m.id_membre)),
    membres_ids: membres.filter((m) => m.id_equip === q.id_equip).map((m) => m.id_membre),
    permisos: perms.filter((p) => p.id_equip === q.id_equip).map((p) => ({ modul: p.id_modul, nivell: p.nivell })) })),
    moduls: llegeix_(FULL.mod).map((m) => ({ id: m.id_modul, nom: m.nom })),
    // Per triar membres: professorat i PAS que no són de baixa (els de baixa que ja hi són també surten)
    persones: pers.filter((x) => !deBaixa_(x.p) || membres.some((m) => m.id_membre === x.id))
      .map((x) => ({ id: x.id, nom: [x.p.nom, x.p.cognom1, x.p.cognom2].filter(Boolean).join(' '), especialitat: x.detall, baixa: deBaixa_(x.p) }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'ca')) };
}
function equipsDesa_(ctx, req) {
  if (!ctx.global) return { ok: false, error: 'sense_permis' };
  const llista = Array.isArray(req.equips) ? req.equips : [];
  const vist = {};
  for (const q of llista) {
    const id = String(q.id_equip || '').trim().toUpperCase();
    if (!/^EQ-[A-Z0-9-]{1,20}$/.test(id)) return { ok: false, error: 'id_equip_invalid', id_equip: id || '(buit)' };
    if (vist[id]) return { ok: false, error: 'id_equip_repetit', id_equip: id };
    if (!String(q.nom || '').trim()) return { ok: false, error: 'nom_buit', camp: id };
    vist[id] = 1;
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(FULL.eq);
    const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
    const antics = vals.slice(1).map((r) => String(r[cap.indexOf('id_equip')])).filter(Boolean);
    const treuen = antics.filter((id) => !vist[id]);
    if (treuen.length) return { ok: false, error: 'equip_no_es_pot_treure', equips: treuen };
    const files = llista.map((q) => cap.map((k) => ({ id_equip: String(q.id_equip).trim().toUpperCase(), nom: String(q.nom).trim(),
      tipus: q.tipus === 'docent' ? 'docent' : 'gestio', descripcio: String(q.descripcio || '').slice(0, 500), actiu: q.actiu === 'no' ? 'no' : 'si' })[k] || ''));
    if (vals.length > 1) sh.getRange(2, 1, vals.length - 1, cap.length).clearContent();
    if (files.length) sh.getRange(2, 1, files.length, cap.length).setValues(files);
    historial_(ctx.email, 'equips', FULL.eq, '', JSON.stringify(llista.map((q) => q.id_equip + ':' + q.nom)).slice(0, 45000));
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// Membres d'un equip (des del mòdul Equips): substitueix la llista de membres d'aquell equip. Només admins globals.
function membresDesa_(ctx, req) {
  if (!ctx.global) return { ok: false, error: 'sense_permis' };
  const eq = String(req.id_equip || '');
  if (!llegeix_(FULL.eq).some((q) => q.id_equip === eq)) return { ok: false, error: 'id_equip_invalid', id_equip: eq };
  const ids = (Array.isArray(req.membres) ? req.membres.map(String) : []).filter((id, i, t) => t.indexOf(id) === i);
  const existents = llegeix_(FULL.prof).map((p) => p.id_professor).concat(llegeix_(FULL.pas).map((p) => p.id_pas));
  const dolents = ids.filter((id) => existents.indexOf(id) < 0);
  if (dolents.length) return { ok: false, error: 'no_existeix', ids: dolents };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(FULL.memb);
    const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
    const ci = cap.indexOf('id_membre'), ce = cap.indexOf('id_equip'), cc = cap.indexOf('carrec');
    const antics = vals.slice(1).filter((r) => String(r[ce]) === eq);
    const queden = vals.slice(1).filter((r) => String(r[ce]) !== eq && r.join('') !== '');
    ids.forEach((id) => {
      const vell = antics.filter((r) => String(r[ci]) === id)[0];   // es conserva el càrrec dins l'equip
      const r = cap.map(() => ''); r[ce] = eq; r[ci] = id; if (vell && cc >= 0) r[cc] = vell[cc]; queden.push(r);
    });
    if (vals.length > 1) sh.getRange(2, 1, vals.length - 1, cap.length).clearContent();
    if (queden.length) sh.getRange(2, 1, queden.length, cap.length).setValues(queden);
    const abans = antics.map((r) => String(r[ci]));
    const entren = ids.filter((id) => abans.indexOf(id) < 0), surten = abans.filter((id) => ids.indexOf(id) < 0);
    historial_(ctx.email, 'membres', FULL.memb, eq, JSON.stringify({ entren: entren, surten: surten }));
    return { ok: true, entren: entren.length, surten: surten.length };
  } finally { lock.releaseLock(); }
}

// ------------------------------------------------------------------ utilitats de fulls
// Claus que tenen columna a la pestanya de dades (els calculats es generen en llegir: no ocupen espai)
function desats_(camps) { return camps.filter((c) => c.tipus !== 'calculat').map((c) => c.clau); }
function norm_(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
function ara_() { return Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd HH:mm:ss'); }
function llegeixFull_(full) {
  if (!full || full.getLastRow() < 2) return [];
  const vals = full.getDataRange().getDisplayValues();
  const cap = vals[0].map(norm_);
  return vals.slice(1).filter((r) => r.join('') !== '').map((r) => {
    const o = {};
    cap.forEach((k, i) => { if (k) o[k] = String(r[i] == null ? '' : r[i]).trim(); });
    return o;
  });
}
function llegeix_(nom) { return llegeixFull_(SpreadsheetApp.getActive().getSheetByName(nom)); }
function llegeixConfig_() {
  const cfg = {};
  CONFIG_PER_DEFECTE.forEach((c) => { cfg[c[0]] = c[1]; });
  llegeix_(FULL.conf).forEach((r) => { if (r.clau) cfg[r.clau] = r.valor; });
  return cfg;
}
function historial_(usuari, accio, taula, id, detall) {
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.hist);
  if (sh) sh.appendRow([ara_(), usuari, accio, taula, id, detall || '']);
}
/** Pestanya de dades d'un mòdul (al seu fitxer): la crea si no hi és i hi afegeix les columnes que falten */
function fullModul_(M, camps) {
  const ss = M.ss();
  const cap = [M.id].concat(desats_(camps), M.registre ? ['desat_per'] : ['data', 'desat_per']);
  let sh = ss.getSheetByName(M.full);
  if (!sh) {
    sh = ss.insertSheet(M.full);
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat('@');   // text pla: dates i codis no es transformen
    sh.getRange(1, 1, 1, cap.length).setValues([cap]).setFontWeight('bold'); sh.setFrozenRows(1);
    return sh;
  }
  const actual = sh.getLastColumn() > 0 ? sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_) : [];
  const falten = cap.filter((k) => actual.indexOf(k) < 0);
  if (falten.length) {
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat('@');
    sh.getRange(1, actual.length + 1, 1, falten.length).setValues([falten]).setFontWeight('bold');
  }
  return sh;
}
/** Pestanya del nucli (config, equips…): la crea si no hi és i hi afegeix al final les columnes que falten */
function assegura_(nom) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(nom);
  const cap = (CAP[nom] || []).slice();
  if (!sh) {
    sh = ss.insertSheet(nom);
    if (cap.length) { sh.getRange(1, 1, 1, cap.length).setValues([cap]).setFontWeight('bold'); sh.setFrozenRows(1); }
    return sh;
  }
  if (!cap.length) return sh;
  const actual = sh.getLastColumn() > 0 ? sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_) : [];
  const falten = cap.filter((k) => actual.indexOf(k) < 0);
  if (falten.length) sh.getRange(1, actual.length + 1, 1, falten.length).setValues([falten]).setFontWeight('bold');
  return sh;
}

// ---------------------------------------------------------------------------------------------
// Execució manual des de l'editor: crea les pestanyes, la configuració, els mòduls, els camps inicials,
// l'equip de direcció amb el permís admin a tots els mòduls i, si config › db_alumnat ja hi és, la pestanya
// «alumnes» d'ijm_alumnat_db. Adapta els fulls de versions anteriors. No esborra dades.
function configura() {
  const ss = SpreadsheetApp.getActive();
  canviaNomsPAS24_();
  canviaMembresPAS28_();   // abans d'assegura_: si no, afegiria una columna id_membre buida
  [FULL.conf, FULL.eq, FULL.memb, FULL.mod, FULL.perm, FULL.camps, FULL.hist].forEach((n) => assegura_(n));
  const conf = ss.getSheetByName(FULL.conf);
  if (conf.getLastRow() < 1) conf.getRange(1, 1, 1, 3).setValues([['clau', 'valor', 'descripcio']]).setFontWeight('bold');
  const claus = llegeix_(FULL.conf).map((r) => r.clau);
  CONFIG_PER_DEFECTE.forEach((c) => { if (claus.indexOf(c[0]) < 0) conf.appendRow(c); });
  const mods = llegeix_(FULL.mod).map((m) => m.id_modul);
  MODULS_PER_DEFECTE.forEach((m) => { if (mods.indexOf(m[0]) < 0) ss.getSheetByName(FULL.mod).appendRow(m); });
  const esquema = Number(llegeixConfig_().esquema) || 0;
  const profNou = !llegeix_(FULL.camps).some((c) => c.modul === 'professorat');
  canviaModulsPAS29_();
  if (llegeix_(FULL.camps).some((c) => c.modul === 'alumnat')) { canviaCampsAlumnatPAS28_(); sincronitzaCamps_('alumnat', CAMPS_ALUMNAT, ['nivell', 'grup_anterior', 'grup_actual', 'estat']); }
  if (llegeix_(FULL.camps).some((c) => c.modul === 'batxillerat')) sincronitzaCamps_('batxillerat', CAMPS_BATXILLERAT, ['nivell', 'grup_anterior', 'grup_actual', 'estat']);
  if (llegeix_(FULL.camps).some((c) => c.modul === 'professorat')) sincronitzaCamps_('professorat', CAMPS_PROFESSORAT, ['estat', 'situacio']);
  [['professorat', CAMPS_PROFESSORAT], ['alumnat', CAMPS_ALUMNAT], ['batxillerat', CAMPS_BATXILLERAT], ['pas', CAMPS_PAS], ['control_entrada', CAMPS_CONTROL]].forEach((x) => {
    if (!llegeix_(FULL.camps).some((c) => c.modul === x[0])) {
      const sh = ss.getSheetByName(FULL.camps);
      const t = ETAPES[x[0]] ? titolsGrups_(cursDe_(llegeixConfig_(), x[0])) : {};
      sh.getRange(sh.getLastRow() + 1, 1, x[1].length, 11).setValues(x[1].map((c, i) => [x[0], c[0], t[c[0]] || c[1], c[2], c[3], c[4], c[5], c[6], c[7], i + 1, 'si']));
    }
  });
  actualitzaProfessorat_();
  if (esquema < 24 && !profNou) visibilitatConsultaPAS24_();
  canviaCodisPAS25_();
  fullModul_(MODULS.professorat, campsDe_('professorat', true));
  fullModul_(MODULS.pas, campsDe_('pas', true));
  if (String(llegeixConfig_().db_alumnat || '').trim()) {
    canviaAlumnesPAS28_();
    fullModul_(MODULS.alumnat, campsDe_('alumnat', true));
    fullModul_(MODULS.batxillerat, campsDe_('batxillerat', true));
    fullModul_(MODULS.control_entrada, campsDe_('control_entrada', true));
    ompleNivellPAS28_();
    Logger.log('ijm_alumnat_db: pestanyes «alumnes» (ESO), «alumnes_bat» (batxillerat) i «entrades» (control d\'entrada) a punt.');
  } else Logger.log('Encara no hi ha config › db_alumnat: el mòdul Alumnat no funcionarà fins que hi poseu l\'URL d\'ijm_alumnat_db.');
  if (!llegeix_(FULL.eq).some((q) => q.id_equip === 'EQ-DIR')) ss.getSheetByName(FULL.eq).appendRow(['EQ-DIR', 'Equip directiu', 'gestio', 'Administració de GESTIO', 'si']);
  if (!llegeix_(FULL.perm).some((p) => p.id_equip === 'EQ-DIR' && p.id_modul === '*')) ss.getSheetByName(FULL.perm).appendRow(['EQ-DIR', '*', 'admin']);
  posaConfig_('esquema', String(ESQUEMA));
  ['Full 1', 'Full1', 'Sheet1', 'Hoja 1'].forEach((n) => { const f = ss.getSheetByName(n); if (f && f.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(f); });
  Logger.log('Fet. Pestanyes: ' + ss.getSheets().map((s) => s.getName()).join(', '));
}
function posaConfig_(clau, valor) {
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.conf);
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) if (String(vals[i][0]).trim() === clau) { sh.getRange(i + 1, 2).setValues([[valor]]); return; }
  sh.appendRow([clau, valor, '']);
}

// PAS 24: «persones» → «professorat» i «id_persona» → «id_professor» (pestanya de dades i membres)
function canviaNomsPAS24_() {
  const ss = SpreadsheetApp.getActive();
  const antiga = ss.getSheetByName('persones');
  if (antiga && !ss.getSheetByName(FULL.prof)) { antiga.setName(FULL.prof); Logger.log('Pestanya «persones» → «professorat».'); }
  [FULL.prof, FULL.memb].forEach((n) => {
    const sh = ss.getSheetByName(n);
    if (!sh || sh.getLastColumn() < 1) return;
    const cap = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
    const j = cap.map(norm_).indexOf('id_persona');
    if (j >= 0) { sh.getRange(1, j + 1, 1, 1).setValues([['id_professor']]); Logger.log(n + ': id_persona → id_professor.'); }
  });
}
// PAS 25: els codis del professorat passen de PER-0001 a PRO-0001 (pestanyes professorat i membres).
// L'historial antic es deixa tal com era. Es pot repetir: si ja no hi ha cap PER-, no fa res.
function canviaCodisPAS25_() {
  const ss = SpreadsheetApp.getActive();
  let n = 0;
  [FULL.prof, FULL.memb].forEach((nom) => {
    const sh = ss.getSheetByName(nom);
    if (!sh || sh.getLastRow() < 2) return;
    const cap = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_);
    const j = cap.indexOf('id_professor') >= 0 ? cap.indexOf('id_professor') : cap.indexOf('id_membre');
    if (j < 0) return;
    const rg = sh.getRange(2, j + 1, sh.getLastRow() - 1, 1), vals = rg.getDisplayValues();
    let canvi = false;
    const nous = vals.map((r) => { const v = String(r[0]); if (/^PER-\d+$/.test(v)) { canvi = true; n++; return ['PRO-' + v.slice(4)]; } return [v]; });
    if (canvi) rg.setValues(nous);
  });
  if (n) { historial_('configura', 'actualitzacio', FULL.prof, '', 'codis PER- → PRO- (' + n + ' cel·les)'); Logger.log('Codis del professorat: PER- → PRO- (' + n + ' cel·les).'); }
}
// PAS 28 · membres: la columna id_professor passa a id_membre (hi poden anar codis PRO-… i PAS-…). Es pot repetir.
function canviaMembresPAS28_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.memb);
  if (!sh || sh.getLastColumn() < 1) return;
  const cap = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_);
  const j = cap.indexOf('id_professor');
  if (j >= 0 && cap.indexOf('id_membre') < 0) { sh.getRange(1, j + 1, 1, 1).setValues([['id_membre']]); Logger.log('membres: id_professor → id_membre.'); }
}
// PAS 28 · camps de l'alumnat: grup_2526 → grup_anterior, grup_2627 → grup_actual (ja no obligatori: després del
// tancament queda per assignar), i dos camps nous: «nivell» (obligatori, després dels cognoms) i «decisio_final»
// (després de l'estat). Els títols dels grups surten de config › curs. Es pot repetir.
function canviaCampsAlumnatPAS28_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.camps);
  const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
  const iC = (k) => cap.indexOf(k);
  const propis = vals.slice(1).filter((r) => String(r[iC('modul')]) === 'alumnat')
    .sort((a, b) => (Number(a[iC('ordre')]) || 0) - (Number(b[iC('ordre')]) || 0));
  const altres = vals.slice(1).filter((r) => String(r[iC('modul')]) !== 'alumnat' && r.join('') !== '');
  const claus = propis.map((r) => String(r[iC('clau')]));
  if (claus.indexOf('grup_2526') < 0 && claus.indexOf('grup_2627') < 0 && claus.indexOf('nivell') >= 0 && claus.indexOf('decisio_final') >= 0) return;
  const titols = titolsGrups_(llegeixConfig_().curs);
  const def = (clau) => { const c = CAMPS_ALUMNAT.filter((x) => x[0] === clau)[0]; const r = cap.map(() => '');
    [['modul', 'alumnat'], ['clau', c[0]], ['nom', c[1]], ['tipus', c[2]], ['valors', c[3]], ['obligatori', c[4]], ['unic', c[5]],
      ['visible_des_de', c[6]], ['origen', c[7]], ['actiu', 'si']].forEach((kv) => { if (iC(kv[0]) >= 0) r[iC(kv[0])] = kv[1]; });
    return r; };
  const nous = [];
  propis.forEach((r) => {
    const k = String(r[iC('clau')]);
    if (k === 'grup_2526') { r[iC('clau')] = 'grup_anterior'; r[iC('nom')] = titols.grup_anterior; }
    if (k === 'grup_2627') { r[iC('clau')] = 'grup_actual'; r[iC('nom')] = titols.grup_actual; r[iC('obligatori')] = 'no'; }
    if (k === 'grup_2526' && claus.indexOf('nivell') < 0) nous.push(def('nivell'));
    nous.push(r);
    if (k === 'estat' && claus.indexOf('decisio_final') < 0) nous.push(def('decisio_final'));
  });
  if (!nous.some((r) => String(r[iC('clau')]) === 'nivell')) nous.splice(Math.min(3, nous.length), 0, def('nivell'));
  if (!nous.some((r) => String(r[iC('clau')]) === 'decisio_final')) nous.push(def('decisio_final'));
  nous.forEach((r, i) => { r[iC('ordre')] = i + 1; });
  const totes = altres.concat(nous);
  if (vals.length > 1) sh.getRange(2, 1, vals.length - 1, cap.length).clearContent();
  sh.getRange(2, 1, totes.length, cap.length).setValues(totes);
  historial_('configura', 'actualitzacio', FULL.camps, 'alumnat', 'grup_2526 → grup_anterior, grup_2627 → grup_actual, + nivell, + decisio_final');
  Logger.log('Camps de l\'alumnat: grups renomenats, nivell i decisió final afegits.');
}
// PAS 28 · pestanya alumnes: les capçaleres grup_2526 / grup_2627 passen a grup_anterior / grup_actual. Es pot repetir.
function canviaAlumnesPAS28_() {
  const sh = ssAlumnat_().getSheetByName(FULL.alu);
  if (!sh || sh.getLastColumn() < 1) return;
  const cap = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  let canvi = false;
  const nou = cap.map((k) => { const n = norm_(k); if (n === 'grup_2526') { canvi = true; return 'grup_anterior'; } if (n === 'grup_2627') { canvi = true; return 'grup_actual'; } return k; });
  if (canvi) { sh.getRange(1, 1, 1, nou.length).setValues([nou]); Logger.log('alumnes: grup_2526/grup_2627 → grup_anterior/grup_actual.'); }
}
// PAS 28 · omple el nivell (buit) a partir del grup actual: «2n ESO B» → «2n ESO»
function ompleNivellPAS28_() {
  const sh = ssAlumnat_().getSheetByName(FULL.alu);
  if (!sh || sh.getLastRow() < 2) return;
  const cap = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_);
  const jn = cap.indexOf('nivell'), jg = cap.indexOf('grup_actual');
  if (jn < 0 || jg < 0) return;
  const n = sh.getLastRow() - 1;
  const niv = sh.getRange(2, jn + 1, n, 1).getDisplayValues(), grp = sh.getRange(2, jg + 1, n, 1).getDisplayValues();
  let omplerts = 0;
  const nous = niv.map((r, i) => { if (String(r[0]).trim()) return [r[0]]; const g = String(grp[i][0]); const v = NIVELLS_ESO.filter((x) => g.indexOf(x) === 0)[0] || ''; if (v) omplerts++; return [v]; });
  if (omplerts) { sh.getRange(2, jn + 1, n, 1).setValues(nous); historial_('configura', 'actualitzacio', FULL.alu, '', 'nivell omplert a ' + omplerts + ' files'); Logger.log('alumnes: nivell omplert a ' + omplerts + ' files.'); }
}

// ------------------------------------------------------------------ tancament de curs (ALUMNAT ESO i BATXILLERAT) · PAS 28-29
// Qui té edició del mòdul (coordinacions de nivell). Totes les files que no són de baixa han de tenir «Decisió final».
//   promociona → nivell següent, estat «promociona»   · repeteix → mateix nivell, estat «repeteix 1r/2n…» («repeteix 1r BAT»…)
//   baixa      → estat «baixa»                         · a totes: grup actual → grup anterior, grup actual buit (per assignar)
//   L'últim nivell de l'etapa (4t ESO, 2n BAT) que promociona acaba l'etapa: estat «baixa». L'alumnat que passa de 4t a
//   1r de batxillerat s'hi dona d'alta amb la importació de la matrícula (Importa fitxer).
// Abans de canviar res es copia la pestanya (copia_<curs>_<data>); després el curs del mòdul avança i els títols dels grups canvien.
function tancaCurs_(ctx, req) {
  const modul = String(req.modul || 'alumnat'), M = MODULS[modul], E = ETAPES[modul];
  if (!M || !E) return { ok: false, error: 'peticio_invalida' };
  if (!pot_(ctx, modul, 'edicio')) return { ok: false, error: 'sense_permis' };
  if (!obert_(ctx)) return { ok: false, error: 'tancat' };
  const curs = cursDe_(ctx.cfg, modul);
  if (!/^\d{4}-\d{4}$/.test(curs)) return { ok: false, error: 'curs_invalid' };
  if (String(req.curs || '') !== curs) return { ok: false, error: 'curs_canviat', curs: curs };   // ja l'ha tancat algú altre
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const camps = campsDe_(modul, true);
    const valorsNivell = ((camps.filter((c) => c.clau === 'nivell')[0] || {}).valors || '').split('|').map((x) => x.trim()).filter(Boolean);
    const sh = fullModul_(M, camps);
    const vals = sh.getDataRange().getDisplayValues(), cap = vals[0].map(norm_);
    const col = (k) => cap.indexOf(k);
    ['nivell', 'grup_anterior', 'grup_actual', 'estat', 'decisio_final'].forEach((k) => { if (col(k) < 0) throw new Error('falta_columna_' + k); });
    const files = vals.slice(1).map((r, i) => ({ fila: i + 2, r: r })).filter((f) => f.r.join('') !== '');
    const pendents = [], sensNivell = [], falta = {};
    files.forEach((f) => {
      const o = {}; cap.forEach((k, j) => { if (k) o[k] = String(f.r[j] || '').trim(); });
      f.o = o;
      if (deBaixa_(o)) return;
      const d = norm_(o.decisio_final);
      if (DECISIONS.indexOf(d) < 0) { pendents.push({ id: o[M.id], nom: [o.nom, o.cognom1, o.cognom2].filter(Boolean).join(' '), nivell: o.nivell, grup: o.grup_actual }); return; }
      const i = E.nivells.indexOf(o.nivell);
      if (i < 0 && d !== 'baixa') { sensNivell.push(o[M.id]); return; }
      if (d === 'promociona') { const seg = E.nivells[i + 1]; if (seg && valorsNivell.indexOf(seg) < 0) falta[seg] = (falta[seg] || 0) + 1; }
    });
    if (pendents.length) return { ok: false, error: 'pendents', pendents: pendents.slice(0, 300), total: pendents.length };
    if (sensNivell.length) return { ok: false, error: 'sense_nivell', ids: sensNivell.slice(0, 100) };
    if (Object.keys(falta).length) return { ok: false, error: 'nivell_no_existeix', nivells: Object.keys(falta).map((k) => ({ nivell: k, alumnes: falta[k] })) };
    // 1) Còpia de seguretat
    const ss = ssAlumnat_();
    const nomCopia = 'copia_' + (modul === 'batxillerat' ? 'bat_' : '') + curs + '_' + Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyyMMdd-HHmm');
    sh.copyTo(ss).setName(nomCopia);
    // 2) Canvis
    const ara = ara_(), comptes = {};
    const compta = (k) => { comptes[k] = (comptes[k] || 0) + 1; };
    const nous = files.map((f) => {
      const o = Object.assign({}, f.o);
      const d = norm_(o.decisio_final);
      if (!deBaixa_(o)) {
        const i = E.nivells.indexOf(o.nivell);
        if (d === 'promociona') {
          const seg = E.nivells[i + 1];
          if (seg) {
            o.nivell = seg; o.estat = 'promociona'; compta(f.o.nivell + ' → ' + seg);
            // Els camps que no són del nivell nou es buiden (p. ex. les matèries de 1r BAT en passar a 2n); la còpia els conserva
            cap.forEach((k) => { if (k && !aplica_(modul, k, i + 2)) o[k] = ''; });
          }
          else { o.estat = 'baixa'; compta(f.o.nivell + ' → acaba l\'etapa'); }
        } else if (d === 'repeteix') { o.estat = E.repeteix(o.nivell); compta(o.nivell + ' · repeteix'); }
        else if (d === 'baixa') { o.estat = 'baixa'; compta('baixa'); }
        o.grup_anterior = f.o.grup_actual; o.grup_actual = '';
        o.data = ara; o.desat_per = ctx.email;
      }
      o.decisio_final = '';
      return cap.map((k) => (k && o[k] !== undefined ? o[k] : ''));
    });
    if (nous.length) sh.getRange(2, 1, nous.length, cap.length).setValues(nous);
    // 3) El curs del mòdul avança i els títols dels grups canvien
    const a = Number(curs.slice(0, 4)), cursNou = (a + 1) + '-' + (a + 2);
    posaConfig_(clauCurs_(modul), cursNou); posaConfig_(clauCopia_(modul), nomCopia + '|' + curs);
    reanomenaGrups_(cursNou, modul);
    historial_(ctx.email, 'tancament', M.full, curs + ' → ' + cursNou, JSON.stringify({ copia: nomCopia, resum: comptes }));
    marcaVersio_(modul, ctx.email);
    return { ok: true, curs: cursNou, copia: nomCopia, resum: comptes };
  } finally { lock.releaseLock(); }
}
function reanomenaGrups_(curs, modul) {
  modul = modul || 'alumnat';
  const t = titolsGrups_(curs);
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.camps);
  const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
  for (let i = 1; i < vals.length; i++) {
    const k = String(vals[i][cap.indexOf('clau')]);
    if (String(vals[i][cap.indexOf('modul')]) === modul && t[k]) sh.getRange(i + 1, cap.indexOf('nom') + 1).setValues([[t[k]]]);
  }
}
// Execució manual (des de l'editor), si el tancament s'ha fet per error: torna a posar la pestanya tal com era abans del
// darrer tancament (config › copia_tancament…), el curs anterior i els títols dels grups. Els canvis fets després del
// tancament es perden (la pestanya actual es conserva com a «desfet_<data>»).
function desfesTancament() { desfes_('alumnat'); }
function desfesTancamentBatxillerat() { desfes_('batxillerat'); }
function desfes_(modul) {
  const M = MODULS[modul];
  const cfg = llegeixConfig_();
  const parts = String(cfg[clauCopia_(modul)] || '').split('|');
  if (!parts[0]) throw new Error('No hi ha cap tancament per desfer (config › ' + clauCopia_(modul) + ' és buit).');
  const ss = ssAlumnat_();
  const copia = ss.getSheetByName(parts[0]);
  if (!copia) throw new Error('No trobo la pestanya de còpia «' + parts[0] + '».');
  const actual = ss.getSheetByName(M.full);
  if (actual) actual.setName('desfet_' + (modul === 'batxillerat' ? 'bat_' : '') + Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyyMMdd-HHmm'));
  copia.copyTo(ss).setName(M.full);
  posaConfig_(clauCurs_(modul), parts[1]); posaConfig_(clauCopia_(modul), '');
  reanomenaGrups_(parts[1], modul);
  historial_('desfesTancament', 'tancament_desfet', M.full, parts[1], parts[0]);
  marcaVersio_(modul, 'desfesTancament');
  Logger.log('Desfet: ' + M.full + ' torna a ser com a «' + parts[0] + '» i el curs torna a ser ' + parts[1] + '.');
}

// ------------------------------------------------------------------ mòdul NOU PROFESSOR/A (PAS 29)
// Formulari d'alta d'un docent nou per a secretaria. Qui hi té edició pot donar d'alta un docent al professorat
// sense tenir accés a la graella del professorat. Els camps i la validació són els del mòdul Professorat.
function nouProfessor_(ctx) {
  if (!pot_(ctx, 'nou_professor', 'edicio')) return { ok: false, error: 'sense_permis' };
  const camps = campsDe_('professorat', true).filter((c) => c.actiu && c.tipus !== 'calculat' && c.origen !== 'clickedu' && NIVELLS.indexOf(c.visible_des_de) <= NIVELLS.indexOf('edicio'));
  return { ok: true, camps: camps, obert: obert_(ctx), curs: ctx.cfg.curs || '' };
}
function altaProfessor_(ctx, req) {
  if (!pot_(ctx, 'nou_professor', 'edicio')) return { ok: false, error: 'sense_permis' };
  const v = req.valors && typeof req.valors === 'object' ? req.valors : {};
  delete v.equips;
  // Mateix desat que la graella del professorat, amb nivell d'edició només per a aquesta alta
  const ctxAlta = Object.assign({}, ctx, { nivell: (m) => (m === 'professorat' ? 'edicio' : ctx.nivell(m)) });
  const r = desa_(ctxAlta, { modul: 'professorat', canvis: [], altes: [{ tmp: 'nou', valors: v }] });
  if (!r.ok) return r;
  const f = (r.files || [])[0] || {};
  historial_(ctx.email, 'alta_nou_professor', FULL.prof, f.id || '', 'des del formulari Nou professor/a');
  return { ok: true, id: f.id, data: f.data, valors: f.valors };
}

// ------------------------------------------------------------------ CONTROL D'ENTRADA (PAS 29)
// Llista de l'alumnat (ESO i batxillerat, sense baixes) per triar a «Nova entrada», ordenada per 1r i 2n cognom.
function alumnesTots_() {
  const tots = [];
  ['alumnat', 'batxillerat'].forEach((modul) => {
    const M = MODULS[modul], sh = M.ss().getSheetByName(M.full);
    if (!sh) return;
    llegeixFull_(sh).forEach((r) => {
      if (deBaixa_(r) || !r[M.id]) return;
      tots.push({ id: r[M.id], nom: [String(r.cognom1 || '').trim(), String(r.cognom2 || '').trim()].filter(Boolean).join(' ') + ', ' + String(r.nom || '').trim(),
        nivell: r.nivell || nivellDeGrup_(r.grup_actual), grup: r.grup_actual || '', n: String(r.nom || ''), c1: String(r.cognom1 || ''), c2: String(r.cognom2 || '') });
    });
  });
  const k = (a) => normNom_([a.c1, a.c2, a.n].join(' '));
  return tots.sort((a, b) => k(a).localeCompare(k(b), 'ca'));
}
function entradaAlumnes_(ctx) {
  if (!pot_(ctx, 'control_entrada', 'edicio')) return { ok: false, error: 'sense_permis' };
  return { ok: true, alumnes: alumnesTots_().map((a) => ({ id: a.id, nom: a.nom, nivell: a.nivell, grup: a.grup })) };
}
// Registra l'entrada ara (data i hora de Madrid) amb el nom, el nivell i el grup que té l'alumne en aquest moment
function entradaNova_(ctx, req) {
  if (!pot_(ctx, 'control_entrada', 'edicio')) return { ok: false, error: 'sense_permis' };
  if (!obert_(ctx)) return { ok: false, error: 'tancat' };
  const a = alumnesTots_().filter((x) => x.id === String(req.id_alumne || ''))[0];
  if (!a) return { ok: false, error: 'no_existeix' };
  const M = MODULS.control_entrada;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = fullModul_(M, campsDe_('control_entrada', true));
    const cap = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_);
    const ids = sh.getLastRow() > 1 ? sh.getRange(2, cap.indexOf(M.id) + 1, sh.getLastRow() - 1, 1).getDisplayValues().map((r) => Number(String(r[0]).replace(/\D/g, '')) || 0) : [];
    const ara = ara_();
    const o = { alumne: a.nom, nivell: a.nivell, grup: a.grup, data: ara.slice(0, 10), hora: ara.slice(11, 16), id_alumne: a.id, desat_per: ctx.email };
    o[M.id] = codi_(M, 1 + ids.reduce((m, n) => Math.max(m, n), 0));
    sh.appendRow(cap.map((k) => (o[k] !== undefined ? o[k] : '')));
    historial_(ctx.email, 'entrada', M.full, o[M.id], a.id);
    marcaVersio_('control_entrada', ctx.email);
    return { ok: true, fila: Object.assign({ id: o[M.id] }, o) };
  } finally { lock.releaseLock(); }
}
// Execució manual: importa el registre que es feia fins ara (config › font_control_entrada). Reconeix les columnes pel
// nom (marca de temps o data i hora; alumne o nom i cognoms; grup; nivell) i busca cada alumne a l'alumnat per posar-hi
// el codi, el nivell i el grup. Si es torna a executar, salta les entrades que ja hi són (mateix alumne, data i hora).
function importaControlEntrada() {
  const cfg = llegeixConfig_();
  const id = (String(cfg.font_control_entrada || '').match(/[-\w]{25,}/) || [''])[0];
  if (!id) throw new Error('Cal posar l\'URL del full a config › font_control_entrada.');
  const M = MODULS.control_entrada, sh = fullModul_(M, campsDe_('control_entrada', true));
  const capA = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_);
  const vistes = {}; llegeixFull_(sh).forEach((r) => { vistes[normNom_(r.alumne) + '|' + r.data + '|' + r.hora] = 1; });
  // Alumnat: per nom «Cognoms, Nom» i per «Nom Cognoms»
  const alumnes = alumnesTots_(), perNom = {};
  alumnes.forEach((a) => { perNom[normNom_(a.nom)] = a; perNom[normNom_(a.n + ' ' + a.c1 + ' ' + a.c2)] = a; perNom[normNom_(a.c1 + ' ' + a.c2 + ' ' + a.n)] = a; });
  const origen = SpreadsheetApp.openById(id);
  let n = 0, saltades = 0, sense = 0, files = 0;
  const noves = [], noTrobats = {};
  let seguent = 1 + llegeixFull_(sh).reduce((m, r) => Math.max(m, Number(String(r[M.id]).replace(/\D/g, '')) || 0), 0);
  origen.getSheets().forEach((pest) => {
    const vals = pest.getDataRange().getDisplayValues();
    const fc = vals.findIndex((r) => r.some((k) => /^(alumne|alumna|nom i cognoms|nom complet|cognoms i nom|cognoms nom|nom de l alumne)$/.test(normCap_(k))));
    if (fc < 0) return;
    const cap = vals[fc].map(normCap_), ci = (re) => cap.findIndex((k) => re.test(k));
    const cTemps = ci(/^(marca de temps|timestamp|marca temporal)$/), cData = ci(/^(data|dia|fecha)$/), cHora = ci(/^(hora|hora d entrada|hora entrada)$/);
    const cAlu = ci(/^(alumne|alumna|nom i cognoms|nom complet|cognoms i nom|cognoms nom|nom de l alumne)$/), cGrup = ci(/^(grup|grup classe|curs|classe)$/), cNiv = ci(/^nivell$/);
    Logger.log(origen.getName() + ' › ' + pest.getName() + ': columnes ' + [cTemps >= 0 ? 'marca de temps' : '', cData >= 0 ? 'data' : '', cHora >= 0 ? 'hora' : '', 'alumne', cGrup >= 0 ? 'grup' : '', cNiv >= 0 ? 'nivell' : ''].filter(Boolean).join(', '));
    vals.slice(fc + 1).forEach((r) => {
      const nom = String(r[cAlu] || '').trim();
      if (!nom) return;
      files++;
      // Data i hora: «dd/mm/aaaa hh:mm(:ss)» (marca de temps), «dd/mm/aaaa» o «aaaa-mm-dd»
      const brut = cTemps >= 0 ? String(r[cTemps]) : String(r[cData] || '') + ' ' + String(r[cHora] || '');
      let m = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(brut), data = '';
      if (m) data = (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
      else if ((m = /(\d{4})-(\d{2})-(\d{2})/.exec(brut))) data = m[0];
      const h = /(\d{1,2}):(\d{2})/.exec(brut);
      const hora = h ? ('0' + h[1]).slice(-2) + ':' + h[2] : '';
      if (!data) { sense++; return; }
      const a = perNom[normNom_(nom)];
      if (!a) noTrobats[nom] = (noTrobats[nom] || 0) + 1;
      const o = { alumne: a ? a.nom : nom, nivell: a ? a.nivell : (cNiv >= 0 ? String(r[cNiv] || '') : nivellDeGrup_(cGrup >= 0 ? r[cGrup] : '')),
        grup: a ? a.grup : (cGrup >= 0 ? String(r[cGrup] || '') : ''), data: data, hora: hora, id_alumne: a ? a.id : '', desat_per: 'importació' };
      const clau = normNom_(o.alumne) + '|' + o.data + '|' + o.hora;
      if (vistes[clau]) { saltades++; return; }
      vistes[clau] = 1;
      o[M.id] = codi_(M, seguent++);
      noves.push(capA.map((k) => (o[k] !== undefined ? o[k] : '')));
      n++;
    });
  });
  if (noves.length) sh.getRange(sh.getLastRow() + 1, 1, noves.length, capA.length).setValues(noves);
  historial_('importació', 'importacio', M.full, '', noves.length + ' entrades');
  marcaVersio_('control_entrada', 'importació');
  const nt = Object.keys(noTrobats);
  Logger.log('Control d\'entrada: ' + files + ' files llegides · ' + n + ' entrades importades · ' + saltades + ' ja hi eren · ' + sense + ' sense data (no s\'importen).');
  if (nt.length) Logger.log('No trobats a l\'alumnat (' + nt.length + '; s\'importen amb el nom tal com era i sense codi d\'alumne): ' + nt.slice(0, 100).join('; '));
}

// ------------------------------------------------------------------ versió de cada mòdul (PAS 29)
// Cada desada deixa «quan i qui» a les propietats de l'script. La pàgina ho pregunta cada minut (acció «versio»):
// si algú altre ha desat el mateix mòdul, ho avisa (els canvis propis sense desar no es perden).
function marcaVersio_(modul, email) {
  try { PropertiesService.getScriptProperties().setProperty('versio_' + modul, ara_() + '|' + email); } catch (e) { /* no és essencial */ }
}
function versio_(modul) {
  try { const v = String(PropertiesService.getScriptProperties().getProperty('versio_' + modul) || ''); const p = v.split('|'); return { data: p[0] || '', per: p[1] || '' }; }
  catch (e) { return { data: '', per: '' }; }
}

// ------------------------------------------------------------------ PAS 29 · camps d'un mòdul: afegeix els que falten
// Insereix els camps de «def» que no hi són (darrere del camp que els precedeix a la definició) i amplia els valors de
// les llistes indicades (afegeix els que falten, conserva els que hi ha). No toca noms, visibilitats ni camps propis.
function sincronitzaCamps_(modul, def, ampliar) {
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.camps);
  const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
  const iC = (k) => cap.indexOf(k);
  const propis = vals.slice(1).filter((r) => String(r[iC('modul')]) === modul)
    .sort((a, b) => (Number(a[iC('ordre')]) || 0) - (Number(b[iC('ordre')]) || 0));
  if (!propis.length) return;
  const altres = vals.slice(1).filter((r) => String(r[iC('modul')]) !== modul && r.join('') !== '');
  const claus = propis.map((r) => String(r[iC('clau')]));
  const fila = (c) => { const r = cap.map(() => '');
    [['modul', modul], ['clau', c[0]], ['nom', c[1]], ['tipus', c[2]], ['valors', c[3]], ['obligatori', c[4]], ['unic', c[5]],
      ['visible_des_de', c[6]], ['origen', c[7]], ['actiu', 'si']].forEach((kv) => { if (iC(kv[0]) >= 0) r[iC(kv[0])] = kv[1]; });
    return r; };
  const nous = propis.slice(), afegits = [], ampliats = [];
  def.forEach((c, k) => {
    if (claus.indexOf(c[0]) >= 0) return;
    // darrere del camp de la definició més proper que ja hi sigui
    let pos = nous.length;
    for (let q = k - 1; q >= 0; q--) { const j = nous.findIndex((r) => String(r[iC('clau')]) === def[q][0]); if (j >= 0) { pos = j + 1; break; } }
    nous.splice(pos, 0, fila(c)); claus.push(c[0]); afegits.push(c[0]);
  });
  (ampliar || []).forEach((k) => {
    const d = def.filter((c) => c[0] === k)[0], r = nous.filter((x) => String(x[iC('clau')]) === k)[0];
    if (!d || !r) return;
    const ara = String(r[iC('valors')] || '').split('|').map((x) => x.trim()).filter(Boolean);
    const falten = d[3].split('|').filter((x) => ara.indexOf(x) < 0);
    if (falten.length) { r[iC('valors')] = ara.concat(falten).join('|'); ampliats.push(k); }
  });
  if (!afegits.length && !ampliats.length) return;
  nous.forEach((r, i) => { r[iC('ordre')] = i + 1; });
  const totes = altres.concat(nous);
  if (vals.length > 1) sh.getRange(2, 1, vals.length - 1, cap.length).clearContent();
  sh.getRange(2, 1, totes.length, cap.length).setValues(totes);
  historial_('configura', 'actualitzacio', FULL.camps, modul, 'afegits: ' + afegits.join(', ') + (ampliats.length ? ' · llistes ampliades: ' + ampliats.join(', ') : ''));
  Logger.log('Camps de ' + modul + ': afegits ' + (afegits.join(', ') || '—') + (ampliats.length ? '; llistes ampliades: ' + ampliats.join(', ') : '') + '.');
}
// PAS 29 · el mòdul «Alumnat» passa a dir-se «Alumnat ESO» (si encara té el nom i la descripció de sempre)
function canviaModulsPAS29_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.mod);
  const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
  const def = MODULS_PER_DEFECTE.filter((m) => m[0] === 'alumnat')[0];
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][cap.indexOf('id_modul')]) !== 'alumnat') continue;
    if (String(vals[i][cap.indexOf('nom')]) === 'Alumnat') sh.getRange(i + 1, cap.indexOf('nom') + 1).setValues([[def[1]]]);
    if (/1r i 2n d'ESO/.test(String(vals[i][cap.indexOf('descripcio')]))) sh.getRange(i + 1, cap.indexOf('descripcio') + 1).setValues([[def[2]]]);
  }
}

// PAS 24: el nivell consulta del professorat només veu nom, cognoms, especialitat, correus i càrrec.
// Només s'aplica una vegada (config › esquema < 24): si després l'admin en torna a fer visible algun, es respecta.
function visibilitatConsultaPAS24_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.camps);
  const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
  const im = cap.indexOf('modul'), ik = cap.indexOf('clau'), iv = cap.indexOf('visible_des_de');
  const canviats = [];
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][im]) !== 'professorat') continue;
    const k = String(vals[i][ik]);
    if (PROFESSORAT_CONSULTA.indexOf(k) < 0 && norm_(vals[i][iv]) === 'consulta') { sh.getRange(i + 1, iv + 1).setValues([['edicio']]); canviats.push(k); }
  }
  if (canviats.length) { historial_('configura', 'actualitzacio', FULL.camps, 'professorat', 'visibles des d\'edició: ' + canviats.join(', ')); Logger.log('Professorat · ara només des d\'edició: ' + canviats.join(', ')); }
}

// Execució manual: importa el professorat del full indicat a config › font_professorat (una vegada).
// Les capçaleres es reconeixen pel nom (vegeu IMPORTACIO_PROFESSORAT); les altres columnes no s'importen.
// No duplica: si el correu institutjoanmiro ja hi és, la persona se salta.
// Definitiu / Comissió serveis / Provisional / Interí (una X) → camp únic «situacio». Tothom entra amb estat «actiu».
function importaProfessorat() {
  const cfg = llegeixConfig_();
  const font = String(cfg.font_professorat || '').trim();
  if (!font) throw new Error('Cal posar l\'ID o l\'URL del full a config › font_professorat.');
  const idFont = (font.match(/[-\w]{25,}/) || [font])[0];
  const origen = SpreadsheetApp.openById(idFont);
  const pest = cfg.font_professorat_pestanya ? origen.getSheetByName(cfg.font_professorat_pestanya) : origen.getSheets()[0];
  if (!pest) throw new Error('No trobo la pestanya ' + cfg.font_professorat_pestanya);
  const vals = pest.getDataRange().getDisplayValues();
  // La capçalera pot no ser a la primera fila: es busca la fila que té «Nom» i «1r Cognom»
  const fc = vals.findIndex((r) => r.map(norm_).indexOf('nom') >= 0 && r.map(norm_).indexOf('1r cognom') >= 0);
  if (fc < 0) throw new Error('No trobo la fila de capçaleres (cal «Nom» i «1r Cognom»).');
  const cap = vals[fc].map(norm_);
  const mapa = cap.map((k) => IMPORTACIO_PROFESSORAT[k] || (SITUACIONS[k] ? 'situacio:' + SITUACIONS[k] : ''));
  Logger.log('Columnes reconegudes: ' + cap.filter((k, i) => mapa[i]).join(', '));
  Logger.log('Columnes que no s\'importen: ' + cap.filter((k, i) => k && !mapa[i]).join(', '));
  const M = MODULS.professorat;
  const camps = campsDe_('professorat', true);
  const sh = fullModul_(M, camps);
  const capP = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_);
  const existents = llegeixFull_(sh);
  const correus = existents.map((p) => norm_(p.email));
  let seguent = 1 + existents.reduce((m, p) => Math.max(m, Number(String(p[M.id]).replace(/\D/g, '')) || 0), 0);
  const ara = ara_(), noves = [];
  let saltades = 0;
  vals.slice(fc + 1).forEach((r) => {
    if (!r.join('').trim()) return;
    const o = { estat: 'actiu' };
    mapa.forEach((k, i) => {
      if (!k) return;
      if (k.indexOf('situacio:') === 0) { if (marcat_(r[i])) o.situacio = k.slice(9); return; }
      const c = camps.filter((x) => x.clau === k)[0]; o[k] = c ? net_(r[i], c) : String(r[i]).trim();
    });
    if (!o.nom && !o.cognom1) return;
    if (o.email && correus.indexOf(norm_(o.email)) >= 0) { saltades++; return; }
    o[M.id] = codi_(M, seguent++);
    o.data = ara; o.desat_per = 'importació';
    correus.push(norm_(o.email));
    noves.push(capP.map((k) => (o[k] !== undefined ? o[k] : '')));
  });
  if (noves.length) sh.getRange(sh.getLastRow() + 1, 1, noves.length, capP.length).setValues(noves);
  historial_('importació', 'importacio', M.full, '', noves.length + ' files');
  Logger.log('Importades: ' + noves.length + ' persones. Saltades (correu repetit): ' + saltades + '.');
}

// Execució manual: importa l'alumnat dels fulls de registre de config › font_alumnat (un URL per nivell).
// - Pestanya config › font_alumnat_pestanya (per defecte «Dades»); la capçalera és la fila que té «Cognoms i nom».
// - «Cognoms i nom» («Cognom1 Cognom2, Nom») se separa amb la pestanya «Noms» del mateix full si hi és
//   (nom | 1r cognom | 2n cognom), i si no, per la coma i els espais (partícules com de, del, de la… van amb el cognom).
// - Observacions → estat; si és buit: 1r → repeteix 1r (columna Repetidor) o alumne extern;
//   2n → repeteix 2n (Repetidor), promociona (grup 25-26 de 1r) o alumne extern.
// - Al full de 1r, la columna «Optativa» és l'optativa de 1r.
// - No duplica: si ja hi ha un alumne amb el mateix nom i cognoms, se salta. Tot el que no s'entén queda al registre.
// PAS 24-29 · importa els fulls de registre de config › font_alumnat (1r a 4t d'ESO i 1r i 2n de batxillerat).
// Cada alumne va al mòdul del seu nivell (ESO → pestanya alumnes; batxillerat → alumnes_bat). Si es torna a executar,
// salta els alumnes que ja hi són (mateix nom i cognoms dins del mòdul). Valors que no són a les llistes: es conserven
// i surten a «Cal revisar». Observacions que no són un estat: es desen a «Observacions».
function importaAlumnat() {
  const cfg = llegeixConfig_();
  const fonts = String(cfg.font_alumnat || '').split(/[\s,;]+/).map((s) => (s.match(/[-\w]{25,}/) || [''])[0]).filter(Boolean);
  if (!fonts.length) throw new Error('Cal posar els URL dels fulls de registre a config › font_alumnat.');
  const ALIES = {}; Object.keys(IMPORTACIO_ALUMNAT).forEach((k) => { ALIES[normCap_(k)] = IMPORTACIO_ALUMNAT[k]; });
  const IGNORA = IMPORTACIO_IGNORA.map(normCap_);
  const ESTATS = {}; Object.keys(ESTAT_ALIES).forEach((k) => { ESTATS[normCap_(k)] = ESTAT_ALIES[k]; });
  const materies = (llista) => { const o = {}; llista.forEach((m) => m[2].forEach((a) => { o[normCap_(a)] = m[0]; })); return o; };
  const MAT = { '1r BAT': materies(MATERIES_1BAT), '2n BAT': materies(MATERIES_2BAT) };
  const clauNom = (o) => normNom_([o.cognom1, o.cognom2, o.nom].join(' '));
  const mods = {};
  const prepara = (modul) => {
    if (mods[modul]) return mods[modul];
    const M = MODULS[modul], camps = campsDe_(modul, true), perClau = {};
    camps.forEach((c) => { perClau[c.clau] = c; });
    const sh = fullModul_(M, camps);
    const capA = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_);
    return (mods[modul] = { M: M, camps: camps, perClau: perClau, sh: sh, capA: capA, vistos: llegeixFull_(sh).map(clauNom), noves: [], saltades: 0 });
  };
  let seguent = 1 + maxAlumne_();
  const ara = ara_(), avisos = [];
  fonts.forEach((id) => {
    const origen = SpreadsheetApp.openById(id);
    const pest = origen.getSheetByName(cfg.font_alumnat_pestanya || 'Dades') || origen.getSheets()[0];
    const vals = pest.getDataRange().getDisplayValues();
    // La capçalera és la fila amb «Cognoms i nom» (o «Cognoms, Nom»): pot ser la primera o la segona
    const fc = vals.findIndex((r) => r.some((k) => ['cognoms i nom', 'cognoms nom'].indexOf(normCap_(k)) >= 0));
    if (fc < 0) { Logger.log(origen.getName() + ': no trobo la fila «Cognoms i nom»; se salta.'); return; }
    const cap = vals[fc].map(normCap_);
    const iNom = cap.findIndex((k) => k === 'cognoms i nom' || k === 'cognoms nom');
    const nivellFull = ((/(1r|2n|3r|4t)\s*(ESO|BAT)/i.exec(origen.getName()) || [])[0] || '').replace(/\s+/, ' ').replace(/bat$/i, 'BAT').replace(/eso$/i, 'ESO');
    // Noms separats (pestanya «Noms»: A nom, B 1r cognom, C 2n cognom, H «Cognoms, nom»)
    const noms = {};
    const pn = origen.getSheetByName('Noms');
    if (pn) pn.getDataRange().getDisplayValues().forEach((r) => {
      if (r[0] && r[1]) noms[normNom_(r[7] || (r[1] + ' ' + r[2] + ', ' + r[0]))] = { nom: String(r[0]).trim(), cognom1: String(r[1]).trim(), cognom2: String(r[2] || '').trim() };
    });
    const ci = (k) => cap.indexOf(normCap_(k));
    const esPrimer = cap.indexOf('optativa 2n') < 0 && cap.indexOf('optativa 1r') < 0 && cap.indexOf('optativa 3r') < 0;
    // «Grup-Classe aa-bb»: la de l'any més alt és el grup actual; l'altra, l'anterior
    const anysGrup = cap.map((k) => { const m = /^grup classe (\d{2}) (\d{2})$/.exec(k); return m ? Number(m[1]) : -1; });
    const maxAny = Math.max.apply(null, anysGrup);
    const esBat = /BAT/.test(nivellFull) || vals.slice(fc + 1, fc + 30).some((r) => anysGrup.some((a, i) => a === maxAny && /bat/i.test(r[i])));
    const mapa = cap.map((k, i) => {
      if (anysGrup[i] >= 0) return anysGrup[i] === maxAny ? 'grup_actual' : 'grup_anterior';
      if (esBat && MAT[nivellFull] && MAT[nivellFull][k]) return MAT[nivellFull][k];
      if (esBat && MAT[nivellFull] && /^fisica g[12]/.test(k) && MAT[nivellFull][k.slice(0, 9)]) return MAT[nivellFull][k.slice(0, 9)];
      return ALIES[k] || (k === 'optativa' && esPrimer ? 'optativa_1r' : '');
    });
    Logger.log(origen.getName() + ' (' + (esBat ? 'batxillerat' : 'ESO') + (nivellFull ? ', ' + nivellFull : '') + ') · columnes reconegudes: ' +
      vals[fc].filter((k, i) => mapa[i]).join(', ') + ' · no s\'importen: ' + vals[fc].filter((k, i) => k && !mapa[i] && IGNORA.indexOf(cap[i]) < 0).join(', '));
    const comptes = {};
    let separats = 0;
    vals.slice(fc + 1).forEach((r) => {
      const complet = String(r[iNom] || '').trim();
      if (!complet || !/[a-zà-ÿ]/i.test(complet)) return;   // files buides i de totals
      // Files de títol dins del full (p. ex. «REPETIDORS DE 1r»): sense coma i començant per una paraula en majúscules
      if (complet.indexOf(',') < 0 && /^[A-ZÀ-ÚÇ]{4,}(\s|$)/.test(complet)) { avisos.push('Fila saltada (no sembla un alumne): «' + complet + '»'); return; }
      const brut = {};
      mapa.forEach((k, i) => { if (k) brut[k] = r[i]; });
      // Nivell i mòdul: el del grup actual; si no n'hi ha, el del nom del full
      const nivell = nivellDeGrup_(brut.grup_actual) || nivellFull;
      const modul = /BAT/.test(nivell) || (!nivell && esBat) ? 'batxillerat' : 'alumnat';
      const X = prepara(modul), E = ETAPES[modul];
      const trobat = noms[normNom_(complet)];
      if (!trobat) separats++;
      const o = Object.assign({}, trobat || separaNom_(complet));
      Object.keys(brut).forEach((k) => {
        const c = X.perClau[k]; if (!c) return;
        let x = brut[k];
        if (k.indexOf('aut_') === 0 && ['false', 'fals'].indexOf(norm_(x)) >= 0) x = 'no';   // casella desmarcada
        o[k] = net_(x, c);
      });
      // Imatge: «NO aut. imatge» marcat → no; si no, «Drets imatge»; si la casella «NO» és desmarcada → sí
      if (X.perClau.aut_imatge && (brut._no_imatge !== undefined || brut._drets_imatge !== undefined)) {
        if (marcat_(brut._no_imatge)) o.aut_imatge = 'no';
        else if (String(brut._drets_imatge || '').trim() && ['false', 'fals'].indexOf(norm_(brut._drets_imatge)) < 0) o.aut_imatge = net_(brut._drets_imatge, X.perClau.aut_imatge);
        else if (['false', 'fals'].indexOf(norm_(brut._no_imatge)) >= 0) o.aut_imatge = 'sí';
      }
      o.nivell = E.nivells.indexOf(nivell) >= 0 ? nivell : (nivellDeGrup_(o.grup_actual) || '');
      const n = nivellIdx_(modul, o);
      // Observacions → estat (o grup UEC); el que no és un estat del nivell es desa a «Observacions»
      const obsOri = ci('observacions') >= 0 ? String(r[ci('observacions')] || '').trim() : '';
      const obs = normCap_(obsOri), rep = ci('repetidor') >= 0 && marcat_(r[ci('repetidor')]);
      let estat = '';
      if (obs === 'uec' && modul === 'alumnat' && n >= 3) { o.grup_actual = o.nivell + ' UEC'; }
      else if (obs) {
        const e = ESTATS[obs] || ((modul === 'alumnat' ? ESTATS_ALUMNAT : ESTATS_BAT).filter((x) => normCap_(x) === obs)[0] || '');
        if (e && (!/^repeteix /.test(e) || e === E.repeteix(o.nivell))) estat = e;
        if (!estat || obs.indexOf('soltes') >= 0) o.observacions = obsOri;   // p. ex. «Repetidor 2n» a 3r (història), «Tecnològic», «Soltes»
      }
      if (!estat) {
        const nivAnt = nivellDeGrup_(o.grup_anterior), iAnt = TOTS_NIVELLS.indexOf(nivAnt), iAra = TOTS_NIVELLS.indexOf(o.nivell);
        if (E.primerSensePromocio && n === 1) estat = rep ? E.repeteix(o.nivell) : 'alumne extern';
        else if (rep || (iAnt >= 0 && iAnt === iAra)) estat = E.repeteix(o.nivell);
        else if (iAnt >= 0 && iAnt === iAra - 1) estat = 'promociona';
        else estat = 'alumne extern';
      }
      o.estat = estat;
      // A 1r d'ESO només hi ha grup anterior si repeteix; els camps que no són del nivell es buiden
      if (E.primerSensePromocio && n === 1 && estat !== E.repeteix(o.nivell)) o.grup_anterior = '';
      Object.keys(o).forEach((k) => { if (!aplica_(modul, k, n)) o[k] = ''; });
      // Valors que no són a les llistes: es conserven, però s'avisa
      X.camps.forEach((c) => { if (!o[c.clau]) return; const err = valida_([c], o); if (err) avisos.push(complet + ': ' + c.nom + ' «' + o[c.clau] + '» (' + err.error + ')'); });
      if (X.vistos.indexOf(clauNom(o)) >= 0) { X.saltades++; return; }
      X.vistos.push(clauNom(o));
      o[X.M.id] = codi_(X.M, seguent++); o.data = ara; o.desat_per = 'importació';
      X.noves.push(X.capA.map((k) => (o[k] !== undefined ? o[k] : '')));
      comptes[o.nivell || '?'] = (comptes[o.nivell || '?'] || 0) + 1;
    });
    Logger.log(origen.getName() + ': ' + (Object.keys(comptes).map((k) => comptes[k] + ' de ' + k).join(', ') || 'cap alumne nou') +
      (separats ? ' (' + separats + ' noms separats automàticament: reviseu els cognoms compostos)' : '') + '.');
  });
  Object.keys(mods).forEach((modul) => {
    const X = mods[modul];
    if (X.noves.length) X.sh.getRange(X.sh.getLastRow() + 1, 1, X.noves.length, X.capA.length).setValues(X.noves);
    historial_('importació', 'importacio', X.M.full, '', X.noves.length + ' files');
    marcaVersio_(modul, 'importació');
    Logger.log((modul === 'batxillerat' ? 'Batxillerat' : 'ESO') + ': importats ' + X.noves.length + ' alumnes. Saltats (ja hi eren): ' + X.saltades + '.');
  });
  if (avisos.length) Logger.log('Cal revisar (' + avisos.length + '):\n' + avisos.slice(0, 300).join('\n'));
}
const normNom_ = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim();
// «Cognom1 Cognom2, Nom» → { nom, cognom1, cognom2 }. Partícules (de, del, de la, de los, van, el…) van amb el cognom següent.
function separaNom_(s) {
  const p = String(s).split(',');
  const nom = (p.slice(1).join(',') || '').trim();
  const mots = p[0].trim().split(/\s+/).filter(Boolean);
  const particules = ['de', 'del', 'la', 'las', 'los', 'el', 'van', 'von', 'da', 'di', 'dos', 'das'];
  const cognoms = [];
  let actual = [];
  mots.forEach((m) => { actual.push(m); if (particules.indexOf(m.toLowerCase()) < 0) { cognoms.push(actual.join(' ')); actual = []; } });
  if (actual.length) cognoms.push(actual.join(' '));
  return { nom: nom, cognom1: cognoms[0] || '', cognom2: cognoms.slice(1).join(' ') };
}

function normalitzaJornada_(sh, cap) {
  const j = cap.indexOf('jornada');
  if (j < 0 || sh.getLastRow() < 2) return;
  const rg = sh.getRange(2, j + 1, sh.getLastRow() - 1, 1), vals = rg.getDisplayValues();
  let canvis = 0; const estranys = {};
  const nous = vals.map((r) => { const v = String(r[0]).trim(), n = JORNADA_ALIES[v.toLowerCase()];
    if (n && n !== v) { canvis++; return [n]; }
    if (v && !n) estranys[v] = 1;
    return [v]; });
  if (canvis) { rg.setValues(nous); historial_('configura', 'actualitzacio', FULL.prof, '', 'jornada: ' + canvis + ' valors adaptats'); }
  if (Object.keys(estranys).length) Logger.log('Jornada amb valors que no són a la llista (cal revisar-los a mà): ' + Object.keys(estranys).join(', '));
}
const marcat_ = (x) => ['x', 'si', 'sí', 'true', '1', 'verdadero', 'cert'].indexOf(norm_(x)) >= 0;

// ---------------------------------------------------------------------------------------------
// PAS 22-23 · s'executa sol amb «configura» (i es pot repetir sense perill):
//  1. Camps: treu Definitiu, Comissió de serveis, Provisional i Interí i hi posa «Situació laboral» (un sol camp);
//     afegeix «Estat» (obligatori) si no hi és; treu els tres calculats de nom; Jornada passa a llista
//     (Sencera | 1/2 | ⅔), NIF a tipus nif i Correu XTEC amb el domini @xtec.cat.
//  2. professorat: omple «situacio» a partir de les quatre columnes antigues i «estat» a partir de l'antiga «actiu»
//     (no → baixa; si → actiu); després treu les columnes antigues i les dels camps calculats. Les altres es conserven.
function actualitzaProfessorat_() {
  const ss = SpreadsheetApp.getActive();
  // 1) camps
  const shC = ss.getSheetByName(FULL.camps);
  const valsC = shC.getDataRange().getValues(), capC = valsC[0].map(norm_);
  const iC = (k) => capC.indexOf(k);
  const propis = valsC.slice(1).filter((r) => String(r[iC('modul')]) === 'professorat');
  const altres = valsC.slice(1).filter((r) => String(r[iC('modul')]) !== 'professorat' && r.join('') !== '');
  const def = (clau) => { const c = CAMPS_PROFESSORAT.filter((x) => x[0] === clau)[0]; const r = capC.map(() => '');
    [['modul', 'professorat'], ['clau', c[0]], ['nom', c[1]], ['tipus', c[2]], ['valors', c[3]], ['obligatori', c[4]], ['unic', c[5]],
      ['visible_des_de', c[6]], ['origen', c[7]], ['actiu', 'si']].forEach((kv) => { if (iC(kv[0]) >= 0) r[iC(kv[0])] = kv[1]; });
    return r; };
  const clausC = propis.map((r) => String(r[iC('clau')]));
  let canviCamps = false;
  const nous = [];
  propis.sort((a, b) => (Number(a[iC('ordre')]) || 0) - (Number(b[iC('ordre')]) || 0)).forEach((r) => {
    const k = String(r[iC('clau')]);
    if (CALCULATS_RETIRATS.indexOf(k) >= 0) {
      canviCamps = true;
      if (k === 'nom_cognoms' && clausC.indexOf('estat') < 0) nous.push(def('estat'));
      return;
    }
    const posa = (col, val) => { if (iC(col) >= 0 && String(r[iC(col)]) !== val) { r[iC(col)] = val; canviCamps = true; } };
    if (k === 'jornada' && norm_(r[iC('tipus')]) === 'text') { posa('tipus', 'llista'); posa('valors', 'Sencera|1/2|⅔'); }
    if (k === 'nif' && norm_(r[iC('tipus')]) === 'text') posa('tipus', 'nif');
    if (k === 'email_xtec' && !String(r[iC('valors')]).trim()) posa('valors', '@xtec.cat');
    if (CLAUS_SITUACIO_ANTIGUES.indexOf(k) >= 0) {
      if (clausC.indexOf('situacio') < 0 && !nous.some((x) => String(x[iC('clau')]) === 'situacio')) nous.push(def('situacio'));
      canviCamps = true; return;
    }
    nous.push(r);
  });
  if (propis.length && !nous.some((x) => String(x[iC('clau')]) === 'estat')) { nous.splice(Math.min(3, nous.length), 0, def('estat')); canviCamps = true; }
  if (canviCamps) {
    nous.forEach((r, i) => { r[iC('ordre')] = i + 1; });
    const totes = altres.concat(nous);
    if (valsC.length > 1) shC.getRange(2, 1, valsC.length - 1, capC.length).clearContent();
    if (totes.length) shC.getRange(2, 1, totes.length, capC.length).setValues(totes);
  }
  // 2) professorat
  const shP = ss.getSheetByName(FULL.prof);
  if (!shP || shP.getLastColumn() < 1) return;
  const vals = shP.getDataRange().getDisplayValues(), cap = vals[0].map(norm_);
  const camps = campsDe_('professorat', true);
  const calcs = camps.filter((c) => c.tipus === 'calculat').map((c) => c.clau).concat(CALCULATS_RETIRATS);
  const treure = CLAUS_SITUACIO_ANTIGUES.concat(calcs, ['actiu']).filter((k) => cap.indexOf(k) >= 0);
  const falten = ['estat', 'situacio'].filter((k) => cap.indexOf(k) < 0 && camps.some((c) => c.clau === k));
  if (!treure.length && !falten.length) { normalitzaJornada_(shP, cap); return; }
  const desats = desats_(camps);
  const extres = cap.filter((k) => k && treure.indexOf(k) < 0 && desats.indexOf(k) < 0 && ['id_professor', 'data', 'desat_per'].indexOf(k) < 0);
  const nouCap = ['id_professor'].concat(desats, extres, ['data', 'desat_per']);
  const files = vals.slice(1).filter((r) => r.join('') !== '').map((r) => {
    const o = {}; cap.forEach((k, j) => { if (k) o[k] = r[j]; });
    if (!o.situacio) {
      const n = { definitiu: 'Definitiu', comissio_serveis: 'Comissió de serveis', provisional: 'Provisional', interi: 'Interí' };
      CLAUS_SITUACIO_ANTIGUES.forEach((k) => { if (!o.situacio && marcat_(o[k])) o.situacio = n[k]; });
    }
    if (!o.estat) o.estat = norm_(o.actiu) === 'no' ? 'baixa' : 'actiu';
    return nouCap.map((k) => (o[k] == null ? '' : o[k]));
  });
  shP.clearContents();
  shP.getRange(1, 1, shP.getMaxRows(), shP.getMaxColumns()).setNumberFormat('@');
  shP.getRange(1, 1, 1, nouCap.length).setValues([nouCap]).setFontWeight('bold');
  if (files.length) shP.getRange(2, 1, files.length, nouCap.length).setValues(files);
  if (shP.getMaxColumns() > nouCap.length) shP.deleteColumns(nouCap.length + 1, shP.getMaxColumns() - nouCap.length);
  normalitzaJornada_(shP, nouCap);
  historial_('configura', 'actualitzacio', FULL.prof, '', 'treu ' + treure.join(', ') + (falten.length ? ' · afegeix ' + falten.join(', ') : ''));
  Logger.log('professorat actualitzat: treu ' + treure.join(', ') + '; columnes: ' + nouCap.join(', '));
}
