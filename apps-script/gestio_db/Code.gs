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
 *   equips      : id_equip | nom | tipus (gestio/docent) | descripcio | actiu | grups (PAS 30: grups-classe als quals es limita la consulta)
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
  camps: 'camps', hist: 'historial', alu: 'alumnes', bat: 'alumnes_bat', ent: 'entrades', amo: 'amonestacions' };
const CAP = {
  equips: ['id_equip', 'nom', 'tipus', 'descripcio', 'actiu', 'grups'],
  membres: ['id_equip', 'id_membre', 'carrec'],
  moduls: ['id_modul', 'nom', 'descripcio', 'ordre', 'actiu'],
  permisos: ['id_equip', 'id_modul', 'nivell'],
  camps: ['modul', 'clau', 'nom', 'tipus', 'valors', 'obligatori', 'unic', 'visible_des_de', 'origen', 'ordre', 'actiu'],
  historial: ['data', 'usuari', 'accio', 'taula', 'id', 'detall'],
};
const ESQUEMA = 37;   // versió de l'estructura dels fulls (la desa «configura» a config › esquema)
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
  ['font_dades_professorat', '', 'Per a importaDadesProfessorat: URL del llistat del professorat de Clickedu (CSV pujat a Drive o full de càlcul) amb DNI, data de naixement, nacionalitat, adreça i telèfon.'],
  ['font_pas', '', 'Per a importaPAS: URL del llistat del PAS de Clickedu (CSV pujat a Drive o full de càlcul).'],
  ['retards_quantitat', '5', 'Control d\'entrada: nombre de retards (de 3 a 20) que activa l\'avís, dins del període de retards_periode.'],
  ['retards_periode', '1 mes', 'Control d\'entrada: període de l\'avís de retards (1 setmana, 2 setmanes, 3 setmanes o 1 mes).'],
  ['carpeta_copies', '', 'Per a copiaSeguretat: URL de la carpeta de Drive on es desen les còpies (en blanc = es crea «GESTIO · còpies de seguretat»).'],
  ['font_control_entrada', '', 'Per a importaControlEntrada: URL del full amb el registre d\'entrades amb retard que es feia fins ara.'],
  ['font_amonestacions', 'https://docs.google.com/spreadsheets/d/1hMJhDk_W1BwmwhwPd1u6jlw7jg8vZi715p95zwwtE6Q/edit', 'Per a importaAmonestacions: URL del full de respostes del formulari d\'amonestacions que es feia servir fins ara.'],
  ['carpeta_amonestacions', 'https://drive.google.com/drive/folders/1vas-tQlX2zA1iLub1_zxbFfqZ1LMGDaE', 'Amonestacions: carpeta de Drive on es desa el PDF de cada amonestació nova (es pot canviar des del web: Configuració).'],
  ['amonestacions_avis_eso', '5', 'Amonestacions: nombre d\'amonestacions (ESO) que activa l\'avís (NOFC 5.3.2: cinc a l\'ESO).'],
  ['amonestacions_avis_bat', '2', 'Amonestacions: nombre d\'amonestacions (batxillerat) que activa l\'avís (NOFC 5.3.2: dues al batxillerat).'],
  ['amonestacions_periode', 'tot el curs', 'Amonestacions: període de l\'avís (1 setmana, 2 setmanes, 3 setmanes, 1 mes, 2 mesos, 3 mesos o tot el curs).'],
  ['logo_pdf', 'https://institutjoanmiro.netlify.app/assets/programacions/logo-ijm.png', 'Logo que surt als PDF que fa l\'Apps Script (amonestacions).'],
  ['copia_tancament_batxillerat', '', 'La posa el tancament de curs del batxillerat (per a desfesTancamentBatxillerat).'],
];
const MODULS_PER_DEFECTE = [
  ['professorat', 'Professorat', 'Dades administratives de cada docent: graella amb filtres, alta, baixa i modificació.', 1, 'si'],
  ['pas', 'PAS', 'Personal d\'administració i serveis: administració, consergeria… Graella amb filtres, alta, baixa i modificació.', 2, 'si'],
  ['alumnat', 'Alumnat ESO', 'Dades acadèmiques de l\'alumnat d\'ESO (1r a 4t): grups, optatives, itinerari, diversitat i autoritzacions.', 3, 'si'],
  ['batxillerat', 'Alumnat Batxillerat', 'Dades acadèmiques de l\'alumnat de batxillerat: grups, itinerari, matèries, pendents i autoritzacions.', 4, 'si'],
  ['nou_professor', 'Nou professor/a', 'Formulari d\'alta d\'un docent nou (secretaria): dades, validació i PDF per signar.', 5, 'si'],
  ['control_entrada', 'Control d\'entrada', 'Registre de les entrades amb retard de l\'alumnat (ESO i batxillerat) i anàlisi per alumne.', 6, 'si'],
  ['amonestacions', 'Amonestacions', 'Amonestacions lleus (NOFC 5.3): les redacta qualsevol docent; registre, PDF per a la família, avisos i anàlisi.', 7, 'si'],
  ['equips', 'Equips i permisos', 'Equips de gestió i docents, i quins mòduls hi té accés cada equip. Només direcció.', 99, 'si'],
];
// Camps inicials (els admins del mòdul en poden afegir, canviar i arxivar des del web)
// [clau, nom, tipus, valors, obligatori, unic, visible_des_de, origen]
// PAS 30: especialitats (desplegable) i dades personals (des d'edició; les omple importaDadesProfessorat)
const ESPECIALITATS = ['Català', 'Castellà', 'Matemàtiques', 'Anglès', 'Francès', 'Alemany', 'Italià', 'Història', 'Orientació', 'Economia',
  'Educació Física', 'Física i Química', 'Biologia', 'Dibuix', 'Música', 'Religió', 'Clàssiques', 'Filosofia', 'Tecnologia'];
const ESPECIALITAT_ALIES = { 'llengua catalana': 'Català', 'catala': 'Català', 'llengua castellana': 'Castellà', 'castella': 'Castellà', 'llengua i literatura catalana': 'Català',
  'llengua i literatura castellana': 'Castellà', 'matematiques': 'Matemàtiques', 'angles': 'Anglès', 'frances': 'Francès', 'italia': 'Italià', 'geografia i historia': 'Història',
  'historia': 'Història', 'socials': 'Història', 'ciencies socials': 'Història', 'orientacio educativa': 'Orientació', 'psicologia i pedagogia': 'Orientació',
  'educacio fisica': 'Educació Física', 'fisica i quimica': 'Física i Química', 'biologia i geologia': 'Biologia', 'dibuix': 'Dibuix', 'visual i plastica': 'Dibuix',
  'educacio visual i plastica': 'Dibuix', 'musica': 'Música', 'religio': 'Religió', 'llati': 'Clàssiques', 'grec': 'Clàssiques', 'cultura classica': 'Clàssiques',
  'classiques': 'Clàssiques', 'filosofia': 'Filosofia', 'tecnologia': 'Tecnologia', 'economia': 'Economia', 'alemany': 'Alemany' };
const CAMPS_PROFESSORAT = [
  ['nom', 'Nom', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['cognom1', '1r cognom', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['cognom2', '2n cognom', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['estat', 'Estat', 'llista', 'actiu|baixa laboral|permís|substitut|baixa', 'si', 'no', 'edicio', 'gestio'],
  ['nif', 'NIF', 'nif', '', 'no', 'si', 'edicio', 'gestio'],
  ['data_naixement', 'Data naixement', 'data', '', 'no', 'no', 'edicio', 'gestio'],
  ['nacionalitat', 'Nacionalitat', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['telefon', 'Telèfon', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['adreca', 'Adreça (carrer i número)', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['poblacio', 'Població', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['codi_postal', 'Codi postal', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['provincia', 'Província', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['especialitat', 'Especialitat', 'llista', ESPECIALITATS.join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['email_xtec', 'Correu XTEC', 'correu', '@xtec.cat', 'no', 'si', 'consulta', 'gestio'],
  ['email', 'Correu institutjoanmiro', 'correu', '@institutjoanmiro.cat', 'si', 'si', 'consulta', 'gestio'],
  ['jornada', 'Jornada', 'llista', 'Sencera|1/2|⅔', 'no', 'no', 'edicio', 'gestio'],
  ['situacio', 'Situació laboral', 'llista', 'Definitiu|Comissió de serveis|Provisional|Interí|Substitut', 'no', 'no', 'edicio', 'gestio'],
  ['substitueix', 'Substitueix a', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['anys', 'Anys docència', 'numero', '', 'no', 'no', 'edicio', 'gestio'],
  ['catala', 'Català', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['carrec', 'Càrrec', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['data_arribada_centre', 'Data arribada al centre', 'data', '', 'no', 'no', 'edicio', 'gestio'],
  ['prova', 'Fitxa de prova', 'si_no', '', 'no', 'no', 'edicio', 'gestio'],
];
// PAS 30: al formulari Nou professor/a són obligatoris aquests camps (a la graella no, per no bloquejar les fitxes antigues)
const NOU_OBLIGATORIS = ['nom', 'cognom1', 'estat', 'nif', 'especialitat', 'data_naixement', 'nacionalitat', 'email', 'telefon', 'adreca', 'poblacio', 'codi_postal',
  'provincia', 'jornada', 'situacio'];
// Província a partir de les dues primeres xifres del codi postal
const PROVINCIES = { '01': 'Àlaba', '02': 'Albacete', '03': 'Alacant', '04': 'Almeria', '05': 'Àvila', '06': 'Badajoz', '07': 'Illes Balears', '08': 'Barcelona', '09': 'Burgos',
  '10': 'Càceres', '11': 'Cadis', '12': 'Castelló', '13': 'Ciudad Real', '14': 'Còrdova', '15': 'La Corunya', '16': 'Conca', '17': 'Girona', '18': 'Granada', '19': 'Guadalajara',
  '20': 'Guipúscoa', '21': 'Huelva', '22': 'Osca', '23': 'Jaén', '24': 'Lleó', '25': 'Lleida', '26': 'La Rioja', '27': 'Lugo', '28': 'Madrid', '29': 'Màlaga', '30': 'Múrcia',
  '31': 'Navarra', '32': 'Ourense', '33': 'Astúries', '34': 'Palència', '35': 'Las Palmas', '36': 'Pontevedra', '37': 'Salamanca', '38': 'Santa Cruz de Tenerife', '39': 'Cantàbria',
  '40': 'Segòvia', '41': 'Sevilla', '42': 'Sòria', '43': 'Tarragona', '44': 'Terol', '45': 'Toledo', '46': 'València', '47': 'Valladolid', '48': 'Biscaia', '49': 'Zamora',
  '50': 'Saragossa', '51': 'Ceuta', '52': 'Melilla' };
// PAS 28: personal d'administració i serveis (es gestiona com el professorat; poques persones, alta a mà)
// PAS 30: fora àmbit, horari i càrrec (s'arxiven: les dades es conserven); dades personals, situació i data d'arribada
const CAMPS_PAS = [
  ['nom', 'Nom', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['cognom1', '1r cognom', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['cognom2', '2n cognom', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['estat', 'Estat', 'llista', 'actiu|baixa laboral|permís|substitut|baixa', 'si', 'no', 'edicio', 'gestio'],
  ['nif', 'NIF', 'nif', '', 'no', 'si', 'edicio', 'gestio'],
  ['data_naixement', 'Data naixement', 'data', '', 'no', 'no', 'edicio', 'gestio'],
  ['nacionalitat', 'Nacionalitat', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['email', 'Correu institutjoanmiro', 'correu', '@institutjoanmiro.cat', 'no', 'si', 'consulta', 'gestio'],
  ['telefon', 'Telèfon', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['adreca', 'Adreça (carrer i número)', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['poblacio', 'Població', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['codi_postal', 'Codi postal', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['provincia', 'Província', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['jornada', 'Jornada', 'llista', 'Sencera|1/2|⅔', 'no', 'no', 'edicio', 'gestio'],
  ['situacio', 'Situació laboral', 'llista', 'Definitiu|Comissió de serveis|Provisional|Interí|Substitut', 'no', 'no', 'edicio', 'gestio'],
  ['data_arribada_centre', 'Data arribada al centre', 'data', '', 'no', 'no', 'edicio', 'gestio'],
  ['prova', 'Fitxa de prova', 'si_no', '', 'no', 'no', 'edicio', 'gestio'],
];
// PAS 33: camps que han d'estar plens a cada fitxa (avís de dades incompletes a la graella)
const COMPLETESA = {
  professorat: ['nom', 'cognom1', 'estat', 'nif', 'especialitat', 'data_naixement', 'nacionalitat', 'email', 'telefon', 'adreca', 'poblacio', 'codi_postal', 'provincia', 'jornada', 'situacio'],
  pas: ['nom', 'cognom1', 'estat', 'nif', 'data_naixement', 'nacionalitat', 'email', 'telefon', 'adreca', 'poblacio', 'codi_postal', 'provincia', 'jornada', 'situacio']
};
const PERIODES_RETARDS = { '1 setmana': 7, '2 setmanes': 14, '3 setmanes': 21, '1 mes': 30 };
const esProva_ = (r) => norm_(r.prova) === 'sí' || norm_(r.prova) === 'si';
const PAS_ARXIVATS = ['categoria', 'horari', 'carrec'];
// PAS 30: equips docents de cada grup-classe (document «Equips docents 26-27»): [nom, 1r cognom, 2n cognom] o el nom tal com era
// si no s'ha trobat al llistat del professorat. creaEquipsDocents() en fa un equip per grup (EQ-1ESOA…) amb els membres.
const EQUIPS_DOCENTS = {"1r ESO A":[["Nora","Manchado","Safont"],["Asunción","Muñoz","Cantueso"],["Josep","De Nicolás","Roman"],["Gemma","Montero","Carpio"],["Adria","Boix","Argemi"],["Laura","León","García"],["Cristina","Mora","Lobato"],["Gonzalo","Flox","Chillarón"],["Daniel","Álvarez","Gorgojo"],["Anna","Nos","Ripollés"],["Deborah","Silvestre","Terron"],["Patricia","Gelis","Doblado"],["Begoña","Balaña","Alonso"],["Noelia","Torrego","Solana"],["Romà","Mendoza","Niella"],["Marco","Albano",""],["Xavier","Garcia","Ros"],["Carla","Sancho",""],["Archi","Montañés","Sales"],["Tania","Biscarri","Israel"],["Ferran","Adam","Chavarría"]],"1r ESO B":[["Noelia","Torrego","Solana"],["Elisabet","Armengol","Gimeno"],["Josep","De Nicolás","Roman"],["Nora","Manchado","Safont"],["Adria","Boix","Argemi"],["Josep","Fas","Coma"],["Genis","Prats","Pueyo"],["Gonzalo","Flox","Chillarón"],["Daniel","Álvarez","Gorgojo"],["Anna","Nos","Ripollés"],["Patricia","Gelis","Doblado"],["Ana Isabel","Ridruejo","Millán"],["Silke","Fresno","Moreno"],["Marco","Albano",""],["Xavier","Garcia","Ros"],["Carla","Sancho",""],["Archi","Montañés","Sales"],["Tania","Biscarri","Israel"],["Ferran","Adam","Chavarría"],["Cristina","Mora","Lobato"]],"1r ESO C":[["Gemma","Montero","Carpio"],["Nora","Manchado","Safont"],["Josep","De Nicolás","Roman"],["Adria","Boix","Argemi"],["Laura","León","García"],["Cristina","Mora","Lobato"],["Carlos","Carrasco","Córdoba"],["Daniel","Álvarez","Gorgojo"],["Anna","Nos","Ripollés"],["Patricia","Gelis","Doblado"],["Begoña","Balaña","Alonso"],["Noelia","Torrego","Solana"],["Silke","Fresno","Moreno"],["Marco","Albano",""],["Xavier","Garcia","Ros"],["Carla","Sancho",""],["Archi","Montañés","Sales"],["Tania","Biscarri","Israel"],["Ferran","Adam","Chavarría"]],"1r ESO D":[["Josep","Fas","Coma"],["Dolors","Mateo","García"],["Josep","De Nicolás","Roman"],["Sergi","Batlle","Ferrer"],["Adria","Boix","Argemi"],["Genis","Prats","Pueyo"],["Carlos","Carrasco","Córdoba"],["Daniel","Álvarez","Gorgojo"],["Anna","Nos","Ripollés"],["Patricia","Gelis","Doblado"],["Ana Isabel","Ridruejo","Millán"],["Josep","Sunyer","Monfort"],["Silke","Fresno","Moreno"],["Marco","Albano",""],["Xavier","Garcia","Ros"],["Carla","Sancho",""],["Archi","Montañés","Sales"],["Tania","Biscarri","Israel"],["Ferran","Adam","Chavarría"],["Cristina","Mora","Lobato"]],"2n ESO A":[["Vanesa","García","Rovira"],["Elisabet","Armengol","Gimeno"],["Dolors","Mateo","García"],["Montse","Díaz","Gutiérrez"],["Nora","Manchado","Safont"],["José Maria","Navero","Cazorla"],["Gonzalo","Flox","Chillarón"],["José Luís","Blanco","Martínez"],["Patricia","Gelis","Doblado"],["Laura","García","Salgado"],["Miquel","de los Cobos","Ruiz"],["Xavier","Figueredo","Rodríguez"],["Marco","Albano",""],["Archi","Montañés","Sales"],["Carla","Sancho",""],["Montse","Roquet","Pugès"],["Josep","De Nicolás","Roman"],["Raquel","Vilda","Andrés"]],"2n ESO B":[["Arnau","Baldoví","Fletes"],["Dolors","Mateo","García"],["Eva","Carretero","Ordoñez"],["Nora","Manchado","Safont"],["Mireia","Burguès","Vela"],["Beatriz","Martínez","Pascual"],["Gonzalo","Flox","Chillarón"],["José Luís","Blanco","Martínez"],["Patricia","Gelis","Doblado"],["Antonia","Salido","Porcel"],["Joan","Florit","Llorens"],["Ernesto","Prieto","Merino"],["Marco","Albano",""],["Archi","Montañés","Sales"],["Carla","Sancho",""],["Montse","Roquet","Pugès"],["Josep","De Nicolás","Roman"],["Raquel","Vilda","Andrés"]],"2n ESO C":[["Ernesto","Prieto","Merino"],["Tania","Biscarri","Israel"],["Elisabet","Armengol","Gimeno"],["Arnau","Baldoví","Fletes"],["Gemma","Munné","Esteban"],["Montse","Díaz","Gutiérrez"],["Gemma","Montero","Carpio"],["Deborah","Silvestre","Terron"],["José Maria","Navero","Cazorla"],["Vanesa","García","Rovira"],["Gonzalo","Flox","Chillarón"],["Eugenia","Colell","Sort"],["Esther","Saranga",""],["Asunción","Muñoz","Cantueso"],["José Luís","Blanco","Martínez"],["Patricia","Gelis","Doblado"],["Laura","García","Salgado"],["Miquel","de los Cobos","Ruiz"],["Ana Isabel","Ridruejo","Millán"],["Marco","Albano",""],["Archi","Montañés","Sales"],["Carla","Sancho",""],["Montse","Roquet","Pugès"],["Josep","De Nicolás","Roman"],["Raquel","Vilda","Andrés"]],"2n ESO D":[["Miquel","de los Cobos","Ruiz"],["Balbi","Iglesias","Ferrer"],["Arnau","Baldoví","Fletes"],["Gemma","Munné","Esteban"],["Eva","Carretero","Ordoñez"],["Gemma","Montero","Carpio"],["Deborah","Silvestre","Terron"],["Josep","Fas","Coma"],["Beatriz","Martínez","Pascual"],["Gonzalo","Flox","Chillarón"],["Eugenia","Colell","Sort"],["Esther","Saranga",""],["Asunción","Muñoz","Cantueso"],["José Luís","Blanco","Martínez"],["Patricia","Gelis","Doblado"],["Antonia","Salido","Porcel"],["Ernesto","Prieto","Merino"],["Marco","Albano",""],["Archi","Montañés","Sales"],["Carla","Sancho",""],["Montse","Roquet","Pugès"],["Josep","De Nicolás","Roman"],["Raquel","Vilda","Andrés"]],"3r ESO A":[["Joan","Florit","Llorens"],["Balbi","Iglesias","Ferrer"],["Elisabet","Armengol","Gimeno"],["Sergi","Batlle","Ferrer"],["Montse","Díaz","Gutiérrez"],["Josep","Fas","Coma"],["Eugenia","Colell","Sort"],["Carlos","Carrasco","Córdoba"],["Daniel","Álvarez","Gorgojo"],["Gemma","Gamarra","Rúbio"],["Xavier","Figueredo","Rodríguez"],["Sergi","Rodríguez","Toha"],["Raquel","Vilda","Andrés"],["Arnau","Baldoví","Fletes"],["Marco","Albano",""],["Archi","Montañés","Sales"],["Carla","Sancho",""],["Xavier","Garcia","Ros"],["Eva","Carretero","Ordoñez"]],"3r ESO B":[["Genis","Prats","Pueyo"],["Dolors","Mateo","García"],["Elisabet","Armengol","Gimeno"],["Adria","Boix","Argemi"],["Montse","Díaz","Gutiérrez"],["Laura","León","García"],["Carlos","Carrasco","Córdoba"],["Xavier","Garcia","Ros"],["Silke","Fresno","Moreno"],["Lluis","Marías","Barber"],["Mar","Martín","Navarro"],["Raquel","Vilda","Andrés"],["Marco","Albano",""],["Archi","Montañés","Sales"],["Carla","Sancho",""],["Eva","Carretero","Ordoñez"]],"3r ESO C":[["Ferran","Adam","Chavarría"],["Nora","Manchado","Safont"],["Elisabet","Armengol","Gimeno"],["Sergi","Batlle","Ferrer"],["Montse","Díaz","Gutiérrez"],["José Maria","Navero","Cazorla"],["Eugenia","Colell","Sort"],["Carlos","Carrasco","Córdoba"],["Daniel","Álvarez","Gorgojo"],["Xavier","Garcia","Ros"],["Sergi","Rodríguez","Toha"],["Raquel","Vilda","Andrés"],["Arnau","Baldoví","Fletes"],["Marco","Albano",""],["Archi","Montañés","Sales"],["Carla","Sancho",""],["Eva","Carretero","Ordoñez"]],"3r ESO D":[["Raquel","Vilda","Andrés"],["Dolors","Mateo","García"],["Elisabet","Armengol","Gimeno"],["Adria","Boix","Argemi"],["Montse","Díaz","Gutiérrez"],["Laura","León","García"],["Genis","Prats","Pueyo"],["Carlos","Carrasco","Córdoba"],["Xavier","Garcia","Ros"],["Silke","Fresno","Moreno"],["Joan","Florit","Llorens"],["Mar","Martín","Navarro"],["Arnau","Baldoví","Fletes"],["Marco","Albano",""],["Archi","Montañés","Sales"],["Carla","Sancho",""],["Eva","Carretero","Ordoñez"]],"4t ESO A":[["Pere","Rios","Marin"],["Josep","De Nicolás","Roman"],["Arnau","Baldoví","Fletes"],["Balbi","Iglesias","Ferrer"],["Sergi","Batlle","Ferrer"],["Gemma","Montero","Carpio"],["Adria","Boix","Argemi"],["Genis","Prats","Pueyo"],["Cristina","González","Simón"],["Beatriz","Martínez","Pascual"],["José Luís","Blanco","Martínez"],["Laura","García","Salgado"],["Antonia","Salido","Porcel"],["Gemma","Munné","Esteban"],["Noelia","Torrego","Solana"],["Lluis","Marías","Barber"],["Xavier","Figueredo","Rodríguez"],["Esther","Saranga",""],["Ferran","Adam","Chavarría"],["Anna","Nos","Ripollés"],["Marc","Monereo","Cuscó"],["Mar","Martín","Navarro"],["Oscar","Rescalvo","Palomares"],["Romà","Mendoza","Niella"],["Patricia","Gelis","Doblado"],["Archi","Montañés","Sales"],["Carla","Sancho",""],["Marco","Albano",""],["Gonzalo","Flox","Chillarón"],["Ernesto","Prieto","Merino"]],"4t ESO B":[["Cristina","González","Simón"],["Josep","De Nicolás","Roman"],["Arnau","Baldoví","Fletes"],["Balbi","Iglesias","Ferrer"],["Sergi","Batlle","Ferrer"],["Gemma","Montero","Carpio"],["Adria","Boix","Argemi"],["Mireia","Burguès","Vela"],["Genis","Prats","Pueyo"],["Beatriz","Martínez","Pascual"],["José Luís","Blanco","Martínez"],["Antonia","Salido","Porcel"],["Laura","García","Salgado"],["Gemma","Munné","Esteban"],["Noelia","Torrego","Solana"],["Lluis","Marías","Barber"],["Xavier","Figueredo","Rodríguez"],["Esther","Saranga",""],["Ferran","Adam","Chavarría"],["Anna","Nos","Ripollés"],["Marc","Monereo","Cuscó"],["Mar","Martín","Navarro"],["Oscar","Rescalvo","Palomares"],["Romà","Mendoza","Niella"],["Patricia","Gelis","Doblado"],["Archi","Montañés","Sales"],["Carla","Sancho",""],["Marco","Albano",""],["Gonzalo","Flox","Chillarón"],["Ernesto","Prieto","Merino"]],"4t ESO C":[["Laura","García","Salgado"],["Josep","De Nicolás","Roman"],["Arnau","Baldoví","Fletes"],["Balbi","Iglesias","Ferrer"],["Sergi","Batlle","Ferrer"],["Gemma","Montero","Carpio"],["Adria","Boix","Argemi"],["Eva","Carretero","Ordoñez"],["Pere","Rios","Marin"],["Cristina","González","Simón"],["Gonzalo","Flox","Chillarón"],["Eugenia","Colell","Sort"],["Beatriz","Martínez","Pascual"],["José Luís","Blanco","Martínez"],["Antonia","Salido","Porcel"],["Gemma","Munné","Esteban"],["Noelia","Torrego","Solana"],["Lluis","Marías","Barber"],["Xavier","Figueredo","Rodríguez"],["Esther","Saranga",""],["Ferran","Adam","Chavarría"],["Anna","Nos","Ripollés"],["Marc","Monereo","Cuscó"],["Mar","Martín","Navarro"],["Oscar","Rescalvo","Palomares"],["Romà","Mendoza","Niella"],["Patricia","Gelis","Doblado"],["Archi","Montañés","Sales"],["Carla","Sancho",""],["Marco","Albano",""],["Ernesto","Prieto","Merino"]],"4t ESO D":[["Gonzalo","Flox","Chillarón"],["Josep","De Nicolás","Roman"],["Arnau","Baldoví","Fletes"],["Balbi","Iglesias","Ferrer"],["Sergi","Batlle","Ferrer"],["Gemma","Montero","Carpio"],["Adria","Boix","Argemi"],["Eva","Carretero","Ordoñez"],["Mireia","Burguès","Vela"],["Cristina","González","Simón"],["Eugenia","Colell","Sort"],["Beatriz","Martínez","Pascual"],["Antonia","Salido","Porcel"],["Laura","García","Salgado"],["Gemma","Munné","Esteban"],["Noelia","Torrego","Solana"],["Lluis","Marías","Barber"],["Xavier","Figueredo","Rodríguez"],["Esther","Saranga",""],["Ferran","Adam","Chavarría"],["Anna","Nos","Ripollés"],["Marc","Monereo","Cuscó"],["Mar","Martín","Navarro"],["Oscar","Rescalvo","Palomares"],["Romà","Mendoza","Niella"],["Patricia","Gelis","Doblado"],["Archi","Montañés","Sales"],["Carla","Sancho",""],["Marco","Albano",""],["Ernesto","Prieto","Merino"]],"1r ESO GR":[["Asunción","Muñoz","Cantueso"],["Deborah","Silvestre","Terron"],["Sergi","Rofes","Barceló"],["Anna","Nos","Ripollés"],["Gemma","Munné","Esteban"],["Josep","De Nicolás","Roman"],["Adria","Boix","Argemi"],["Gonzalo","Flox","Chillarón"],["Daniel","Álvarez","Gorgojo"],["Nora","Manchado","Safont"]],"2n ESO GR":[["Asunción","Muñoz","Cantueso"],["Deborah","Silvestre","Terron"],["Sergi","Rofes","Barceló"],["Anna","Nos","Ripollés"],["Gemma","Munné","Esteban"],["Arnau","Baldoví","Fletes"],["Gemma","Montero","Carpio"],["Gonzalo","Flox","Chillarón"],["Eugenia","Colell","Sort"],["Esther","Saranga",""],["Patricia","Gelis","Doblado"],["Tania","Biscarri","Israel"],["José Luís","Blanco","Martínez"],["Ernesto","Prieto","Merino"]],"1r BAT A":[["Adria","Boix","Argemi"],["Balbi","Iglesias","Ferrer"],["Montse","Roquet","Pugès"],["Daniel","Álvarez","Gorgojo"],["Marc","Monereo","Cuscó"],["Beatriz","Martínez","Pascual"],["Ferran","Adam","Chavarría"],["Romà","Mendoza","Niella"],["Anna","Nos","Ripollés"],["Miquel","de los Cobos","Ruiz"],["Asunción","Muñoz","Cantueso"],["Archi","Montañés","Sales"],["Marco","Albano",""],["Lluis","Marías","Barber"],["Joan","Florit","Llorens"],["Mireia","Burguès","Vela"]],"1r BAT B":[["Sergi","Rofes","Barceló"],["Balbi","Iglesias","Ferrer"],["Sergi","Batlle","Ferrer"],["Ana Isabel","Ridruejo","Millán"],["Daniel","Álvarez","Gorgojo"],["Marc","Monereo","Cuscó"],["Cristina","Mora","Lobato"],["Oscar","Rescalvo","Palomares"],["Mar","Martín","Navarro"],["Sergi","Rodríguez","Toha"],["Pere","Rios","Marin"],["Gemma","Munné","Esteban"],["Esther","Saranga",""],["Asunción","Muñoz","Cantueso"],["Archi","Montañés","Sales"],["Marco","Albano",""],["Lluis","Marías","Barber"],["Joan","Florit","Llorens"],["Mireia","Burguès","Vela"]],"1r BAT C":[["Laura","León","García"],["Balbi","Iglesias","Ferrer"],["Sergi","Batlle","Ferrer"],["Ana Isabel","Ridruejo","Millán"],["Daniel","Álvarez","Gorgojo"],["Marc","Monereo","Cuscó"],["Cristina","González","Simón"],["Eugenia","Colell","Sort"],["Esther","Saranga",""],["Olga","Garcia","Chacón"],["Pere","Rios","Marin"],["Gemma","Munné","Esteban"],["Asunción","Muñoz","Cantueso"],["Archi","Montañés","Sales"],["Marco","Albano",""],["Lluis","Marías","Barber"],["Joan","Florit","Llorens"],["Mireia","Burguès","Vela"]],"2n BAT A":[["Eugenia","Colell","Sort"],["Dolors","Mateo","García"],["Eva","Carretero","Ordoñez"],["Montse","Roquet","Pugès"],["Marc","Monereo","Cuscó"],["José Maria","Navero","Cazorla"],["Xavier","Figueredo","Rodríguez"],["Raquel","Vilda","Andrés"],["Sergi","Rofes","Barceló"],["Lluis","Marías","Barber"],["Sergi","Rodríguez","Toha"],["Marco","Albano",""],["Carla","Sancho",""],["Mireia","Burguès","Vela"]],"2n BAT B":[["Dolors","Mateo","García"],["Eva","Carretero","Ordoñez"],["Montse","Roquet","Pugès"],["Marc","Monereo","Cuscó"],["Josep","Fas","Coma"],["Cristina","Mora","Lobato"],["Oscar","Rescalvo","Palomares"],["Josep","Sunyer","Monfort"],["Sergi","Rofes","Barceló"],["Elisabet","Armengol","Gimeno"],["Joan","Florit","Llorens"],["Sergi","Rodríguez","Toha"],["Archi","Montañés","Sales"],["Marco","Albano",""],["Carla","Sancho",""],["Mireia","Burguès","Vela"],["Montse","Díaz","Gutiérrez"]],"2n BAT C":[["Montse","Díaz","Gutiérrez"],["Josep","De Nicolás","Roman"],["Montse","Roquet","Pugès"],["Marc","Monereo","Cuscó"],["José Maria","Navero","Cazorla"],["Cristina","González","Simón"],["Oscar","Rescalvo","Palomares"],["Olga","Garcia","Chacón"],["Pere","Rios","Marin"],["Elisabet","Armengol","Gimeno"],["Archi","Montañés","Sales"],["Mireia","Burguès","Vela"]]};
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
// PAS 35: amonestacions (pestanya «amonestacions» d'ijm_alumnat_db). Els fets no surten a la graella: es veuen amb la icona.
const CAMPS_AMONESTACIONS = [
  ['data_fets', 'Data dels fets', 'data', '', 'si', 'no', 'consulta', 'gestio'],
  ['alumne', 'Alumne/a', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['nivell', 'Nivell', 'llista', ['1r ESO', '2n ESO', '3r ESO', '4t ESO', '1r BAT', '2n BAT'].join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['grup', 'Grup-Classe', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['professor', 'Professor/a', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['fets', 'Fets i circumstàncies', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['pdf', 'PDF', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['curs', 'Curs', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['redactat_el', 'Redactada el', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['id_alumne', 'Codi alumne', 'text', '', 'no', 'no', 'admin', 'gestio'],
  ['id_professor', 'Codi professor', 'text', '', 'no', 'no', 'admin', 'gestio'],
];
const PERIODES_AMON = { '1 setmana': 7, '2 setmanes': 14, '3 setmanes': 21, '1 mes': 30, '2 mesos': 61, '3 mesos': 92, 'tot el curs': 0 };
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
  amonestacions: { full: FULL.amo, id: 'id_amonestacio', prefix: 'AMO-', xifres: 5, equips: false, nom: 'amonestació', registre: true, ss: () => ssAlumnat_() },
};
// PAS 37: el fitxer s'obre una sola vegada per petició (abans, cada lectura d'alumnat el tornava a obrir)
const SS_OBERTS_ = {};
function ssAlumnat_() {
  const id = (String(llegeixConfig_().db_alumnat || '').match(/[-\w]{25,}/) || [''])[0];
  if (!id) throw new Error('db_alumnat_no_configurat');
  return SS_OBERTS_[id] || (SS_OBERTS_[id] = SpreadsheetApp.openById(id));
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
const REGLES = { alumnat: reglaAlumnat_('alumnat'), batxillerat: reglaAlumnat_('batxillerat'),
  // PAS 30: si la situació laboral és «Substitut», cal dir a qui substitueix (només es comprova quan es canvia algun dels dos camps)
  professorat: (v, canviats) => {
    if (canviats && !canviats.some((k) => k === 'situacio' || k === 'substitueix')) return null;
    if (v.situacio === 'Substitut' && !String(v.substitueix || '').trim() && Object.prototype.hasOwnProperty.call(v, 'substitueix')) return { error: 'obligatori', camp: 'substitueix' };
    return null;
  } };

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
      case 'equip_esborra': return json_(equipEsborra_(ctx, req));
      case 'amonestacio_form': return json_(amonestacioForm_(ctx));
      case 'amonestacio_nova': return json_(amonestacioNova_(ctx, req));
      case 'amonestacio_pdf': return json_(amonestacioPdf_(ctx, req));
      case 'amonestacions_config': return json_(amonestacionsConfig_(ctx, req));
      case 'permisos_matriu_desa': return json_(permisosMatriuDesa_(ctx, req));
      case 'tanca_curs':   return json_(tancaCurs_(ctx, req));
      case 'versio':       return json_(MODULS[req.modul] && pot_(ctx, req.modul, 'consulta') ? { ok: true, versio: versio_(req.modul) } : { ok: false, error: 'sense_permis' });
      case 'nou_professor':  return json_(nouProfessor_(ctx));
      case 'entrada_alumnes': return json_(entradaAlumnes_(ctx));
      case 'entrada_nova':   return json_(entradaNova_(ctx, req));
      case 'alta_professor': return json_(altaProfessor_(ctx, req));
      case 'historial_fila': return json_(historialFila_(ctx, req));
      case 'retards_desa':   return json_(retardsDesa_(ctx, req));
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
const llistaGrups_ = (x) => (Array.isArray(x) ? x : String(x || '').split(/[,;|]/)).map((g) => String(g).trim()).filter(Boolean);
const campGrup_ = (modul) => (ETAPES[modul] ? 'grup_actual' : (modul === 'control_entrada' || modul === 'amonestacions' ? 'grup' : ''));
const dinsAbast_ = (ab, grup) => !ab || ab.indexOf(String(grup || '').trim()) >= 0;
function context_(email) {
  const cfg = llegeixConfig_();
  const admins = String(cfg.admins || '').toLowerCase().split(/[,;\s]+/).filter(Boolean);
  // PAS 28: qui entra pot ser del professorat o del PAS (el mateix correu no hauria de ser a tots dos)
  const persones = llegeix_(FULL.prof).map((x) => Object.assign({ id: x.id_professor }, x))
    .concat(llegeix_(FULL.pas).map((x) => Object.assign({ id: x.id_pas }, x)));
  const p = persones.filter((x) => String(x.email || '').toLowerCase() === email && !deBaixa_(x))[0] || null;
  const meus = p ? llegeix_(FULL.memb).filter((m) => m.id_membre === p.id).map((m) => m.id_equip) : [];
  const totsEquips = llegeix_(FULL.eq);
  const equipsActius = totsEquips.filter((q) => norm_(q.actiu) !== 'no').map((q) => q.id_equip);
  const grupsEq = {}; totsEquips.forEach((q) => { grupsEq[q.id_equip] = llistaGrups_(q.grups); });
  const eqs = meus.filter((id) => equipsActius.indexOf(id) >= 0);
  const perms = llegeix_(FULL.perm).filter((r) => eqs.indexOf(r.id_equip) >= 0);
  const global = admins.indexOf(email) >= 0 || perms.some((r) => r.id_modul === '*' && norm_(r.nivell) === 'admin');
  const nivell = (modul) => {
    if (global) return 'admin';
    if (modul === 'equips') return '';   // equips i permisos: només admins globals
    let n = -1;
    perms.forEach((r) => { if (r.id_modul === modul || r.id_modul === '*') n = Math.max(n, NIVELLS.indexOf(norm_(r.nivell))); });
    // PAS 35: tot el professorat pot redactar amonestacions, encara que el seu equip no hi tingui permís (només veu les seves)
    if (n < 0 && modul === 'amonestacions' && p && /^PRO-/.test(String(p.id))) return 'consulta';
    return n >= 0 ? NIVELLS[n] : '';
  };
  // Amonestacions (PAS 36): amb nivell consulta (el de tot el professorat) només es veuen les pròpies; des d'edició
  // (coordinació) i administració, totes
  const nomesPropies = (modul) => modul === 'amonestacions' && NIVELLS.indexOf(nivell(modul)) < NIVELLS.indexOf('edicio');
  // PAS 30: si tots els permisos d'un mòdul venen d'equips amb «grups» (p. ex. l'equip docent de 1r ESO A), la persona
  // només veu les files d'aquests grups. Qui té algun permís sense grups (coordinació, direcció) ho veu tot.
  const abast = (modul) => {
    if (global) return null;
    const rel = perms.filter((r) => r.id_modul === modul || r.id_modul === '*');
    if (!rel.length || rel.some((r) => !(grupsEq[r.id_equip] || []).length)) return null;
    const g = {}; rel.forEach((r) => grupsEq[r.id_equip].forEach((x) => { g[x] = 1; }));
    return Object.keys(g);
  };
  return { email: email, persona: p, equips: eqs, global: global, nivell: nivell, abast: abast, nomesPropies: nomesPropies, cfg: cfg };
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
  const ab = ctx.abast ? ctx.abast(modul) : null, cg = campGrup_(modul);
  const files = llegeixFull_(fullModul_(M, tots))
    // Qui no pot veure l'estat (p. ex. consulta del professorat) només veu les files que no són de baixa
    .filter((r) => veuEstat || !deBaixa_(r))
    // PAS 30: equips docents → només els seus grups (a les amonestacions, també les pròpies)
    .filter((r) => !ab || !cg || dinsAbast_(ab, r[cg]) || propiaAmon_(ctx, modul, r))
    // PAS 35: amonestacions amb el nivell implícit del professorat → només les que ha redactat
    .filter((r) => !(ctx.nomesPropies && ctx.nomesPropies(modul)) || propiaAmon_(ctx, modul, r))
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
    abast: ab && cg ? ab : undefined,
    versio: versio_(modul),
    completesa: COMPLETESA[modul] ? COMPLETESA[modul].filter((k) => camps.some((c) => c.clau === k)) : undefined,
    // PAS 37: l'alumnat de «Nova entrada» arriba amb les dades (obrir la finestra no fa cap altra crida)
    alumnes_entrada: modul === 'control_entrada' && pot_(ctx, modul, 'edicio') ? entradaAlumnes_(ctx).alumnes : undefined,
    retards: modul === 'control_entrada' ? Object.assign(retardsCfg_(ctx.cfg), { pot_canviar: pot_(ctx, modul, 'admin') }) : undefined,
    avis_amon: modul === 'amonestacions' ? Object.assign(avisAmonCfg_(ctx.cfg), { pot_canviar: pot_(ctx, modul, 'admin') }) : undefined,
    nomes_propies: ctx.nomesPropies ? ctx.nomesPropies(modul) : false,
    pot_crear: modul === 'amonestacions' ? potRedactar_(ctx) : undefined,
    // PAS 36: el formulari de «Nova amonestació» arriba amb les dades: obrir-lo no fa cap altra crida
    form: modul === 'amonestacions' && potRedactar_(ctx) ? amonestacioForm_(ctx) : undefined,
    pot_historial: !M.registre && pot_(ctx, modul, 'edicio'),
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
      // PAS 30: data d'arribada al centre = el dia que es dona d'alta (si no s'ha escrit)
      if ((modul === 'professorat' || modul === 'pas') && totsCamps.some((cm) => cm.clau === 'data_arribada_centre' && cm.actiu) && !nou.data_arribada_centre) nou.data_arribada_centre = ara.slice(0, 10);
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
    const ab = ctx.abast ? ctx.abast(modul) : null, cg = campGrup_(modul);
    if (ab && cg && (plans.some((p) => !dinsAbast_(ab, p.abans[cg]) || !dinsAbast_(ab, p.nou[cg])) || altesPlans.some((p) => !dinsAbast_(ab, p.nou[cg])))) return { ok: false, error: 'fora_abast' };
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
    // PAS 31: qui passa a estat «baixa» surt de tots els equips (i, per tant, perd tots els permisos)
    if (M.equips) {
      const baixes = plans.filter((p) => deBaixa_(p.nou) && !deBaixa_(p.abans)).map((p) => String(p.abans[M.id]))
        .concat(altesPlans.filter((p) => deBaixa_(p.nou)).map((p) => p.nou[M.id]));
      const amb = baixes.filter((id) => llegeix_(FULL.memb).some((m) => m.id_membre === id));
      if (amb.length) desaMembres_(amb.map((id) => ({ id: id, equips: [] })), usuari);
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
// PAS 33: les fitxes de prova («Test, Profe», «Test, Tutor», «Test, Coord») es marquen com a prova una sola vegada (no s'esborren:
// ho fa Romà). Les fitxes de prova no surten al Llistat, a l'avís de dades incompletes ni a «Substitueix a».
function marcaFitxesProva_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('PAS33_PROVA')) return;
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.prof);
  if (!sh || sh.getLastRow() < 2) return;
  const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_), jp = cap.indexOf('prova'), jn = cap.indexOf('nom'), jc = cap.indexOf('cognom1');
  if (jp < 0) return;
  const fetes = [];
  for (let i = 1; i < vals.length; i++) {
    if (norm_(vals[i][jc]) === 'test' && ['profe', 'tutor', 'coord'].indexOf(norm_(vals[i][jn])) >= 0 && !String(vals[i][jp]).trim()) { sh.getRange(i + 1, jp + 1).setValues([['sí']]); fetes.push(vals[i][jc] + ', ' + vals[i][jn]); }
  }
  props.setProperty('PAS33_PROVA', '1');
  if (fetes.length) { historial_('configura', 'actualitzacio', FULL.prof, '', 'fitxes de prova: ' + fetes.join('; ')); Logger.log('Fitxes marcades com a prova: ' + fetes.join('; ')); }
}

// PAS 33 · Historial d'una fila: qui ha canviat què i quan (pestanya historial), del més recent al més antic
function historialFila_(ctx, req) {
  const modul = String(req.modul || ''), M = MODULS[modul], id = String(req.id || '');
  if (!M || M.registre) return { ok: false, error: 'modul_desconegut' };
  if (!pot_(ctx, modul, 'edicio')) return { ok: false, error: 'sense_permis' };
  const noms = {}; campsDe_(modul, true).forEach((c) => { noms[c.clau] = c.nom; });
  // Només els camps que la persona pot veure
  const veu = {}; visibles_(ctx, modul, campsDe_(modul, true)).forEach((c) => { veu[c.clau] = 1; });
  const files = llegeix_(FULL.hist).filter((h) => String(h.id) === id && (h.taula === M.full || (M.equips && h.taula === FULL.memb)))
    .map((h) => {
      let canvis = null;
      if (/^(modificacio|baixa|reactivacio)$/.test(h.accio)) {
        try { const d = JSON.parse(h.detall || '{}'); canvis = Object.keys(d).filter((k) => veu[k]).map((k) => ({ camp: noms[k] || k, abans: d[k][0] == null ? '' : String(d[k][0]), ara: d[k][1] == null ? '' : String(d[k][1]) })); } catch (e) { canvis = []; }
      }
      return { data: h.data, usuari: h.usuari, accio: h.accio, canvis: canvis, detall: canvis ? '' : (h.accio === 'equips' ? 'Equips: ' + (function () { try { return JSON.parse(h.detall).join(', ') || '(cap)'; } catch (e) { return h.detall; } })() : String(h.detall || '').slice(0, 300)) };
    })
    .filter((h) => !h.canvis || h.canvis.length || h.accio !== 'modificacio')
    .reverse().slice(0, 200);
  return { ok: true, id: id, files: files };
}

// ------------------------------------------------------------------ PAS 35 · AMONESTACIONS
// Qui pot redactar: tot el professorat (actiu) i qui té edició al mòdul. Qui té edició pot triar el professor/a; la resta, ell mateix.
const propiaAmon_ = (ctx, modul, r) => modul === 'amonestacions' && ((ctx.persona && String(r.id_professor) === String(ctx.persona.id)) || String(r.desat_per).toLowerCase() === ctx.email);
// PAS 36: tot el professorat pot redactar, sigui quin sigui el seu nivell al mòdul
function potRedactar_(ctx) {
  if (pot_(ctx, 'amonestacions', 'edicio')) return true;
  return !!(ctx.persona && /^PRO-/.test(String(ctx.persona.id)));
}
const cursDeData_ = (iso) => { const m = /^(\d{4})-(\d{2})/.exec(String(iso || '')); if (!m) return ''; const y = Number(m[1]); return Number(m[2]) >= 9 ? y + '-' + (y + 1) : (y - 1) + '-' + y; };
function avisAmonCfg_(cfg) {
  const n = (v, d) => Math.max(1, Math.min(20, Number(v) || d));
  const p = PERIODES_AMON[String(cfg.amonestacions_periode || '').trim()] !== undefined ? String(cfg.amonestacions_periode).trim() : 'tot el curs';
  return { eso: n(cfg.amonestacions_avis_eso, 5), bat: n(cfg.amonestacions_avis_bat, 2), periode: p, periodes: Object.keys(PERIODES_AMON), curs: cfg.curs || '',
    carpeta: String(cfg.carpeta_amonestacions || '') };
}
// Formulari: alumnat (ESO i batxillerat, sense baixes), professorat actiu (sense fitxes de prova) i qui redacta
function amonestacioForm_(ctx) {
  if (!potRedactar_(ctx)) return { ok: false, error: 'sense_permis' };
  const ab = ctx.abast ? ctx.abast('amonestacions') : null;
  const alumnes = alumnesTots_().map((a) => ({ id: a.id, nom: a.nom, nivell: a.nivell, grup: a.grup }));
  // PAS 37: qui redacta sempre hi surt, encara que sigui una fitxa de prova (abans, «Test, Profe» es quedava sense professor/a)
  const jo = ctx.persona && /^PRO-/.test(String(ctx.persona.id)) ? String(ctx.persona.id) : '';
  const prof = llegeix_(FULL.prof).filter((p) => !deBaixa_(p) && p.nom && (!esProva_(p) || String(p.id_professor) === jo))
    .map((p) => ({ id: p.id_professor, nom: [p.cognom1, p.cognom2].filter(Boolean).join(' ') + ', ' + p.nom }))
    .sort((a, b) => normNom_(a.nom).localeCompare(normNom_(b.nom), 'ca'));
  // PAS 37: el professor/a és qui ha entrat a GESTIO; només l'administració del mòdul en pot triar un altre
  const triar = pot_(ctx, 'amonestacions', 'admin');
  return { ok: true, alumnes: alumnes, professorat: triar ? prof : prof.filter((p) => ctx.persona && p.id === ctx.persona.id),
    jo: jo, triar_professor: triar, curs: ctx.cfg.curs || '', avui: ara_().slice(0, 10), abast: ab || undefined };
}
// Validació del text dels fets: entre 20 i 3.000 caràcters, sense caràcters de control, amb lletres
function netejaFets_(t) {
  const x = String(t == null ? '' : t).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (x.length < 20) return { error: 'fets_curts' };
  if (x.length > 3000) return { error: 'fets_llargs' };
  if (!/[A-Za-zÀ-ÿ]{3,}/.test(x)) return { error: 'fets_invalids' };
  return { valor: x };
}
function amonestacioNova_(ctx, req) {
  if (!potRedactar_(ctx)) return { ok: false, error: 'sense_permis' };
  if (!obert_(ctx)) return { ok: false, error: 'tancat' };
  const a = alumnesTots_().filter((x) => x.id === String(req.id_alumne || ''))[0];
  if (!a) return { ok: false, error: 'alumne_invalid' };
  // Qualsevol docent pot amonestar qualsevol alumne (també fora dels grups que veu a la graella)
  const triar = pot_(ctx, 'amonestacions', 'admin');
  const idProf = triar ? String(req.id_professor || '') : (ctx.persona ? String(ctx.persona.id) : '');
  const p = llegeix_(FULL.prof).filter((x) => x.id_professor === idProf && !deBaixa_(x))[0];
  if (!p) return { ok: false, error: 'professor_invalid' };
  const avui = ara_().slice(0, 10), data = String(req.data_fets || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || isNaN(new Date(data + 'T12:00:00').getTime())) return { ok: false, error: 'data_invalida' };
  if (data > avui) return { ok: false, error: 'data_futura' };
  if (cursDeData_(data) !== String(ctx.cfg.curs || cursDeData_(avui))) return { ok: false, error: 'data_fora_curs' };
  const f = netejaFets_(req.fets);
  if (f.error) return { ok: false, error: f.error };
  const M = MODULS.amonestacions, lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let o;
  try {
    const sh = fullModul_(M, campsDe_('amonestacions', true));
    const cap = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_);
    const ids = sh.getLastRow() > 1 ? sh.getRange(2, cap.indexOf(M.id) + 1, sh.getLastRow() - 1, 1).getDisplayValues().map((r) => Number(String(r[0]).replace(/\D/g, '')) || 0) : [];
    const ara = ara_();
    // Doble clic: la mateixa amonestació (alumne, professor, data i fets) en els darrers 2 minuts no es duplica
    const files = llegeixFull_(sh);
    const previ = files.filter((r) => r.id_alumne === a.id && r.id_professor === p.id_professor && r.data_fets === data && r.fets === f.valor && String(r.redactat_el) >= ara.slice(0, 14))[0];
    if (previ) return { ok: true, repetida: true, fila: Object.assign({ id: previ[M.id] }, previ) };
    o = { data_fets: data, alumne: a.nom, nivell: a.nivell, grup: a.grup, professor: [p.cognom1, p.cognom2].filter(Boolean).join(' ') + ', ' + p.nom, fets: f.valor,
      pdf: '', curs: ctx.cfg.curs || cursDeData_(data), redactat_el: ara, id_alumne: a.id, id_professor: p.id_professor, desat_per: ctx.email };
    o[M.id] = codi_(M, 1 + ids.reduce((m, n) => Math.max(m, n), 0));
    sh.appendRow(cap.map((k) => (o[k] !== undefined ? o[k] : '')));
    historial_(ctx.email, 'amonestacio', M.full, o[M.id], a.id + ' · ' + data);
    marcaVersio_('amonestacions', ctx.email);
  } finally { lock.releaseLock(); }
  // PAS 36: el web demana el PDF a part (pdf_despres), en segon pla, perquè desar sigui immediat
  if (req.pdf_despres) return { ok: true, fila: Object.assign({ id: o[M.id] }, o), pdf_pendent: true };
  // El PDF es fa després de desar: si no es pot fer (carpeta sense accés…), l'amonestació queda desada igualment
  let errPdf = '';
  try { o.pdf = creaPdfAmonestacio_(o, ctx.cfg); posaCampAmon_(o[M.id], 'pdf', o.pdf); } catch (e) { errPdf = String(e && e.message || e); Logger.log('PDF amonestació ' + o[M.id] + ': ' + errPdf); }
  return { ok: true, fila: Object.assign({ id: o[M.id] }, o), error_pdf: errPdf || undefined };
}
function posaCampAmon_(id, clau, valor) {
  const M = MODULS.amonestacions, sh = fullModul_(M, campsDe_('amonestacions', true));
  const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_), ci = cap.indexOf(M.id), cj = cap.indexOf(clau);
  for (let i = 1; i < vals.length; i++) if (String(vals[i][ci]) === id) { sh.getRange(i + 1, cj + 1).setValues([[valor]]); return true; }
  return false;
}
// Torna a fer el PDF d'una amonestació que no en té (o el refà, des d'edició)
function amonestacioPdf_(ctx, req) {
  const M = MODULS.amonestacions, id = String(req.id || '');
  const r = llegeixFull_(fullModul_(M, campsDe_('amonestacions', true))).filter((x) => String(x[M.id]) === id)[0];
  if (!r) return { ok: false, error: 'no_existeix' };
  const propia = ctx.persona && String(r.id_professor) === String(ctx.persona.id);
  if (!pot_(ctx, 'amonestacions', 'edicio') && !(propia && potRedactar_(ctx))) return { ok: false, error: 'sense_permis' };
  if (r.pdf && !req.refes) return { ok: true, pdf: r.pdf };
  try { const url = creaPdfAmonestacio_(r, ctx.cfg); posaCampAmon_(id, 'pdf', url); marcaVersio_('amonestacions', ctx.email); return { ok: true, pdf: url }; }
  catch (e) { return { ok: false, error: 'pdf_error', detall: String(e && e.message || e).slice(0, 200) }; }
}
// PAS 36 · Execució manual (o activador cada hora amb activaPdfsPendents): fa el PDF de les amonestacions que no en tenen
// (p. ex. si es va tancar la pàgina abans que s'acabés de fer en segon pla). Com a màxim 25 per execució.
function fesPdfsPendents() {
  const cfg = llegeixConfig_(), M = MODULS.amonestacions;
  const pendents = llegeixFull_(fullModul_(M, campsDe_('amonestacions', true))).filter((r) => !r.pdf && r.id_alumne && r.desat_per !== 'importació').slice(0, 25);
  let fets = 0;
  pendents.forEach((r) => { try { posaCampAmon_(String(r[M.id]), 'pdf', creaPdfAmonestacio_(r, cfg)); fets++; } catch (e) { Logger.log('PDF ' + r[M.id] + ': ' + (e && e.message || e)); } });
  if (fets) marcaVersio_('amonestacions', 'pdf automàtic');
  Logger.log('PDF pendents: ' + pendents.length + ' · fets: ' + fets);
}
function activaPdfsPendents() {
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'fesPdfsPendents').forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('fesPdfsPendents').timeBased().everyHours(1).create();
  Logger.log('Activador creat: fesPdfsPendents cada hora.');
}
// Configuració (admin del mòdul): carpeta dels PDF i avís
function amonestacionsConfig_(ctx, req) {
  if (!pot_(ctx, 'amonestacions', 'admin')) return { ok: false, error: 'sense_permis' };
  const eso = Number(req.eso), bat = Number(req.bat), per = String(req.periode || ''), carpeta = String(req.carpeta || '').trim();
  if (!(eso >= 1 && eso <= 20 && bat >= 1 && bat <= 20) || PERIODES_AMON[per] === undefined) return { ok: false, error: 'peticio_invalida' };
  const idC = (carpeta.match(/[-\w]{25,}/) || [''])[0];
  if (!idC) return { ok: false, error: 'carpeta_invalida' };
  try { DriveApp.getFolderById(idC).getName(); } catch (e) { return { ok: false, error: 'carpeta_sense_acces' }; }
  [['amonestacions_avis_eso', String(Math.round(eso))], ['amonestacions_avis_bat', String(Math.round(bat))], ['amonestacions_periode', per], ['carpeta_amonestacions', carpeta]].forEach((kv) => posaConfig_(kv[0], kv[1]));
  historial_(ctx.email, 'config', FULL.conf, 'amonestacions', JSON.stringify({ eso: eso, bat: bat, periode: per, carpeta: carpeta }));
  return { ok: true, avis_amon: Object.assign(avisAmonCfg_(llegeixConfig_()), { pot_canviar: true }) };
}
// PDF de l'amonestació (HTML → PDF amb l'Apps Script), amb el logo del centre, a la carpeta de config › carpeta_amonestacions
const escH_ = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const dataCat_ = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso || ''); };
function logoPdf_(cfg) {
  try { const r = UrlFetchApp.fetch(String(cfg.logo_pdf || ''), { muteHttpExceptions: true }); if (r.getResponseCode() === 200) return 'data:image/png;base64,' + Utilities.base64Encode(r.getContent()); } catch (e) { /* sense logo */ }
  return '';
}
function creaPdfAmonestacio_(o, cfg) {
  const idC = (String(cfg.carpeta_amonestacions || '').match(/[-\w]{25,}/) || [''])[0];
  if (!idC) throw new Error('Falta config › carpeta_amonestacions');
  const carpeta = DriveApp.getFolderById(idC);
  const bat = /BAT/.test(String(o.nivell || o.grup));
  const logo = logoPdf_(cfg);
  const fets = escH_(o.fets).replace(/\n/g, '<br>');
  const html = '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#1e1e2a;margin:0 8mm}' +
    '.cap{display:table;width:100%;border-bottom:2px solid #1c0cbc;padding-bottom:6px;margin-bottom:14px}.cap div{display:table-cell;vertical-align:middle}' +
    '.adr{text-align:right;font-size:8pt;color:#5a6070;line-height:1.4}h1{font-size:17pt;color:#1c0cbc;font-weight:normal;margin:6px 0 2px}' +
    '.tipus{font-size:9pt;font-weight:bold;color:#e8600c;letter-spacing:1px;margin:0 0 12px}table.d{border-collapse:collapse;width:100%;margin:10px 0}' +
    'table.d td{border:1px solid #d6dae6;padding:5px 8px;font-size:10.5pt}table.d td.e{width:32%;background:#f6f7fc;color:#1c0cbc;font-weight:bold}' +
    '.fets{border:1px solid #d6dae6;border-radius:4px;padding:8px 10px;min-height:60px;margin:4px 0 12px;line-height:1.45}p{line-height:1.45;margin:6px 0}' +
    '.peu{margin-top:18px;font-size:10.5pt}.signa{margin-top:26px;display:table;width:100%}.signa div{display:table-cell;width:50%;font-size:9pt;color:#5a6070}' +
    '</style></head><body>' +
    '<div class="cap"><div>' + (logo ? '<img src="' + logo + '" style="height:46px">' : '<b>Institut Joan Miró</b>') + '</div>' +
    '<div class="adr">Av. Verge de Montserrat, 53 · 08940 Cornellà de Llobregat<br>93 377 51 66 · www.institutjoanmiro.cat · a8033900@xtec.cat</div></div>' +
    '<h1>Amonestació lleu</h1><p class="tipus">FALTA PERJUDICIAL PER A LA CONVIVÈNCIA EN EL CENTRE (FALTA LLEU)</p>' +
    '<p>Benvolguda família,</p>' +
    '<p>D\'acord amb les Normes d\'Organització i Funcionament del Centre (NOFC) de l\'Institut Joan Miró, apartat 5.3 «Convivència de l\'alumnat al centre», ' +
    'i amb la Llei 12/2009, del 10 de juliol, d\'educació, us comuniquem que el vostre fill o filla ha tingut una conducta contrària a les normes de convivència del centre, ' +
    'que queda registrada en aquesta amonestació lleu (NOFC 5.3.3, Protocol d\'amonestació lleu).</p>' +
    '<table class="d"><tr><td class="e">Alumne/a</td><td>' + escH_(o.alumne) + '</td></tr><tr><td class="e">Grup-classe</td><td>' + escH_(o.grup) + '</td></tr>' +
    '<tr><td class="e">Data dels fets</td><td>' + escH_(dataCat_(o.data_fets)) + '</td></tr><tr><td class="e">Professor/a</td><td>' + escH_(o.professor) + '</td></tr></table>' +
    '<p><b>Fets i circumstàncies:</b></p><div class="fets">' + fets + '</div>' +
    '<p>D\'acord amb l\'apartat 5.3.2 de les NOFC, l\'acumulació de ' + (bat ? 'dues amonestacions lleus (batxillerat)' : 'cinc amonestacions lleus (ESO)') +
    ' pot comportar mesures correctores i sancionadores, que poden anar des de la realització d\'activitats acadèmiques individuals al centre fins a la no assistència al centre o a determinades classes, ' +
    'o la suspensió del dret de participar en sortides i activitats complementàries.</p>' +
    '<p>La Comissió de Convivència valorarà l\'evolució de l\'alumne/a i els fets ocorreguts, i determinarà, si escau, les mesures correctores i/o sancionadores.</p>' +
    '<p>Desitgem que aquesta amonestació tingui un efecte positiu i ajudi a millorar l\'actitud del vostre fill o filla.</p>' +
    '<p class="peu">Cornellà de Llobregat, ' + escH_(dataCat_(o.redactat_el || ara_())) + '</p>' +
    '<div class="signa"><div>Professor/a: ' + escH_(o.professor) + '</div><div>Direcció de l\'Institut Joan Miró</div></div>' +
    '</body></html>';
  const nom = ('Amonestació_lleu_' + o.grup + '_' + o.alumne + '_' + dataCat_(o.data_fets).replace(/\//g, '-') + '_' + o.professor).replace(/[\/\\:*?"<>|]/g, '-') + '.pdf';
  const pdf = Utilities.newBlob(html, 'text/html', 'amonestacio.html').getAs('application/pdf').setName(nom);
  return carpeta.createFile(pdf).getUrl();
}
// Execució manual: importa les amonestacions del formulari que es feia servir (config › font_amonestacions). Si es torna a
// executar, salta les que ja hi són (mateix alumne, data, professor i inici dels fets). Les dades del full no es toquen.
function importaAmonestacions() {
  const cfg = llegeixConfig_();
  const id = (String(cfg.font_amonestacions || '').match(/[-\w]{25,}/) || [''])[0];
  if (!id) throw new Error('Cal posar l\'URL del full a config › font_amonestacions.');
  const M = MODULS.amonestacions, sh = fullModul_(M, campsDe_('amonestacions', true));
  const capA = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_);
  const clau = (al, d, pr, f) => [normNom_(al), d, normNom_(pr), normNom_(String(f || '').slice(0, 40))].join('|');
  const existents = llegeixFull_(sh), vistes = {};
  existents.forEach((r) => { vistes[clau(r.alumne, r.data_fets, r.professor, r.fets)] = 1; });
  const alumnes = alumnesTots_(), perNom = {};
  alumnes.forEach((a) => { perNom[normNom_(a.nom)] = a; perNom[normNom_(a.n + ' ' + a.c1 + ' ' + a.c2)] = a; });
  const prof = llegeix_(FULL.prof), perProf = {};
  prof.forEach((p) => { perProf[normNom_([p.cognom1, p.cognom2].filter(Boolean).join(' ') + ', ' + p.nom)] = p; perProf[normNom_(p.cognom1 + ', ' + p.nom)] = p; if (p.email) perProf[String(p.email).toLowerCase()] = p; if (p.email_xtec) perProf[String(p.email_xtec).toLowerCase()] = p; });
  const iso = (x) => { const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(x || '')); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : ''; };
  const hora = (x) => { const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(x || '')); return m ? ('0' + m[1]).slice(-2) + ':' + m[2] + ':' + (m[3] || '00') : '00:00:00'; };
  let seguent = 1 + existents.reduce((m, r) => Math.max(m, Number(String(r[M.id]).replace(/\D/g, '')) || 0), 0);
  const noves = [], noAlu = {}, noProf = {};
  let llegides = 0, saltades = 0, dolentes = 0;
  SpreadsheetApp.openById(id).getSheets().forEach((pest) => {
    const vals = pest.getDataRange().getDisplayValues();
    const fc = vals.findIndex((r) => r.some((k) => /^nom complet alumne/.test(normCap_(k))));
    if (fc < 0) return;
    const cap = vals[fc].map(normCap_), ci = (re) => cap.findIndex((k) => re.test(k));
    const cT = ci(/^marca de temps|^timestamp/), cA = ci(/^nom complet alumne/), cF = ci(/^fets/), cP = ci(/^professor/), cD = ci(/^data$/), cG = ci(/^grup/), cE = ci(/^adreca electronica|^correu/), cU = ci(/^merged doc url/);
    vals.slice(fc + 1).forEach((r) => {
      const al = String(r[cA] || '').trim(); if (!al) return;
      llegides++;
      const data = iso(r[cD]) || iso(r[cT]), fets = String(r[cF] || '').trim(), profNom = String(r[cP] || '').trim();
      if (!data || !fets) { dolentes++; return; }
      const k = clau(al, data, profNom, fets);
      if (vistes[k]) { saltades++; return; }
      vistes[k] = 1;
      const a = perNom[normNom_(al)], p = perProf[normNom_(profNom)] || (cE >= 0 ? perProf[String(r[cE] || '').toLowerCase()] : null);
      if (!a) noAlu[al] = 1;
      if (!p) noProf[profNom] = 1;
      const grup = String(r[cG] || '').trim().replace(/\bbat\b/i, 'BAT').replace(/\beso\b/i, 'ESO');
      const o = { data_fets: data, alumne: a ? a.nom : al, nivell: nivellDeGrup_(grup), grup: grup, professor: p ? [p.cognom1, p.cognom2].filter(Boolean).join(' ') + ', ' + p.nom : profNom,
        fets: fets, pdf: cU >= 0 ? String(r[cU] || '') : '', curs: cursDeData_(data), redactat_el: (iso(r[cT]) || data) + ' ' + hora(r[cT]),
        id_alumne: a ? a.id : '', id_professor: p ? p.id_professor : '', desat_per: 'importació' };
      o[M.id] = codi_(M, seguent++);
      noves.push(capA.map((c) => (o[c] !== undefined ? o[c] : '')));
    });
  });
  if (noves.length) sh.getRange(sh.getLastRow() + 1, 1, noves.length, capA.length).setValues(noves);
  historial_('importació', 'importacio', M.full, '', noves.length + ' amonestacions');
  marcaVersio_('amonestacions', 'importació');
  Logger.log('Amonestacions: ' + llegides + ' files llegides · ' + noves.length + ' importades · ' + saltades + ' ja hi eren · ' + dolentes + ' sense data o sense fets (no s\'importen).');
  const na = Object.keys(noAlu), np = Object.keys(noProf);
  if (na.length) Logger.log('Alumnes no trobats a l\'alumnat d\'ara (' + na.length + '; s\'importen amb el nom i el grup del formulari): ' + na.slice(0, 80).join('; '));
  if (np.length) Logger.log('Professorat no trobat (' + np.length + '; s\'importa amb el nom del formulari): ' + np.join('; '));
}

// PAS 33 · Avís de retards (control d'entrada): quantitat (3–20) i període
function retardsCfg_(cfg) {
  const q = Math.max(3, Math.min(20, Number(cfg.retards_quantitat) || 5));
  const p = PERIODES_RETARDS[String(cfg.retards_periode || '').trim()] ? String(cfg.retards_periode).trim() : '1 mes';
  return { quantitat: q, periode: p, dies: PERIODES_RETARDS[p], periodes: Object.keys(PERIODES_RETARDS), pot_canviar: false };
}
function retardsDesa_(ctx, req) {
  if (!pot_(ctx, 'control_entrada', 'admin')) return { ok: false, error: 'sense_permis' };
  const q = Number(req.quantitat), p = String(req.periode || '');
  if (!(q >= 3 && q <= 20 && Math.round(q) === q) || !PERIODES_RETARDS[p]) return { ok: false, error: 'peticio_invalida' };
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.conf), vals = sh.getDataRange().getValues();
  [['retards_quantitat', String(q)], ['retards_periode', p]].forEach((kv) => {
    const i = vals.findIndex((r) => r[0] === kv[0]);
    if (i >= 1) sh.getRange(i + 1, 2).setValues([[kv[1]]]); else sh.appendRow([kv[0], kv[1], '']);
  });
  historial_(ctx.email, 'config', FULL.conf, 'retards', q + ' en ' + p);
  return { ok: true, retards: retardsCfg_({ retards_quantitat: q, retards_periode: p }) };
}

// PAS 33 · Còpia de seguretat de ijm_nucli_db i ijm_alumnat_db a una carpeta de Drive (es guarden les 8 darreres de cada)
function copiaSeguretat() {
  const cfg = llegeixConfig_();
  let carpeta;
  const idC = (String(cfg.carpeta_copies || '').match(/[-\w]{25,}/) || [''])[0];
  if (idC) carpeta = DriveApp.getFolderById(idC);
  else {
    const it = DriveApp.getFoldersByName('GESTIO · còpies de seguretat');
    carpeta = it.hasNext() ? it.next() : DriveApp.createFolder('GESTIO · còpies de seguretat');
    const sh = SpreadsheetApp.getActive().getSheetByName(FULL.conf), vals = sh.getDataRange().getValues(), i = vals.findIndex((r) => r[0] === 'carpeta_copies');
    if (i >= 1) sh.getRange(i + 1, 2).setValues([[carpeta.getUrl()]]);
  }
  const avui = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd HH.mm');
  const fitxers = [SpreadsheetApp.getActive().getId()];
  const idA = (String(cfg.db_alumnat || '').match(/[-\w]{25,}/) || [''])[0];
  if (idA) fitxers.push(idA);
  const fetes = [];
  fitxers.forEach((id) => {
    const f = DriveApp.getFileById(id), base = f.getName();
    f.makeCopy(base + ' · còpia ' + avui, carpeta); fetes.push(base);
    // Només les 8 darreres còpies d'aquest fitxer
    const copies = [], it = carpeta.getFiles();
    while (it.hasNext()) { const c = it.next(); if (c.getName().indexOf(base + ' · còpia ') === 0) copies.push(c); }
    copies.sort((a, b) => b.getName().localeCompare(a.getName())).slice(8).forEach((c) => c.setTrashed(true));
  });
  historial_('copiaSeguretat', 'copia', '', '', fetes.join(', ') + ' → ' + carpeta.getName());
  Logger.log('Còpia de seguretat feta (' + fetes.join(', ') + ') a la carpeta «' + carpeta.getName() + '»: ' + carpeta.getUrl());
}
// Execució manual, una sola vegada: programa copiaSeguretat cada dilluns a les 3 de la matinada
function activaCopiaSetmanal() {
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'copiaSeguretat').forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('copiaSeguretat').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(3).inTimezone('Europe/Madrid').create();
  Logger.log('Còpia setmanal activada: cada dilluns cap a les 3 h. Ara se\'n fa una per comprovar que funciona.');
  copiaSeguretat();
}

// PAS 31: neteja (a configura) les persones de baixa que encara eren membres d'algun equip
function treuMembresDeBaixa_() {
  const baixa = {};
  llegeix_(FULL.prof).forEach((p) => { if (deBaixa_(p)) baixa[p.id_professor] = 1; });
  llegeix_(FULL.pas).forEach((p) => { if (deBaixa_(p)) baixa[p.id_pas] = 1; });
  const ids = {}; llegeix_(FULL.memb).forEach((m) => { if (baixa[m.id_membre]) ids[m.id_membre] = 1; });
  const llista = Object.keys(ids);
  if (!llista.length) return;
  desaMembres_(llista.map((id) => ({ id: id, equips: [] })), 'configura');
  Logger.log('Persones de baixa que s\'han tret dels equips: ' + llista.join(', '));
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
  // PAS 35: l'alumnat (ESO i batxillerat) també es pot esborrar des d'edició (coordinacions), dins dels seus grups
  if (!pot_(ctx, modul, M.registre || ETAPES[modul] ? 'edicio' : 'admin')) return { ok: false, error: 'sense_permis' };
  const ids = (req.ids || []).map(String);
  if (!ids.length) return { ok: false, error: 'peticio_invalida' };
  const abE = ctx.abast ? ctx.abast(modul) : null, cgE = campGrup_(modul);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = fullModul_(M, campsDe_(modul, true));
    const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_), ci = cap.indexOf(M.id);
    const esborrades = [];
    for (let i = vals.length - 1; i >= 1; i--) {
      if (ids.indexOf(String(vals[i][ci])) >= 0) {
        const o = {}; cap.forEach((k, j) => { o[k] = vals[i][j]; });
        if (abE && cgE && !dinsAbast_(abE, o[cgE])) continue;
        // Amonestacions: el PDF va a la paperera de Drive (s'hi pot recuperar durant 30 dies)
        if (modul === 'amonestacions' && o.pdf) { try { DriveApp.getFileById((String(o.pdf).match(/[-\w]{25,}/) || [''])[0]).setTrashed(true); } catch (e) { /* sense accés o ja esborrat */ } }
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
    .concat(llegeix_(FULL.pas).map((p) => ({ id: p.id_pas, p: p, detall: 'PAS' })));
  const nomDe = (id) => { const x = pers.filter((y) => y.id === id)[0]; return x ? [x.p.nom, x.p.cognom1, x.p.cognom2].filter(Boolean).join(' ') : id; };
  return { ok: true, equips: llegeix_(FULL.eq).map((q) => ({ id_equip: q.id_equip, nom: q.nom, tipus: q.tipus || 'gestio', descripcio: q.descripcio || '',
    actiu: norm_(q.actiu) === 'no' ? 'no' : 'si', grups: llistaGrups_(q.grups),
    membres: membres.filter((m) => m.id_equip === q.id_equip).map((m) => nomDe(m.id_membre)),
    membres_ids: membres.filter((m) => m.id_equip === q.id_equip).map((m) => m.id_membre),
    permisos: perms.filter((p) => p.id_equip === q.id_equip).map((p) => ({ modul: p.id_modul, nivell: p.nivell })) })),
    moduls: llegeix_(FULL.mod).map((m) => ({ id: m.id_modul, nom: m.nom })), grups: GRUPS_ESO.concat(GRUPS_1BAT, GRUPS_2BAT),
    // Per triar membres: professorat i PAS que no són de baixa (els de baixa que ja hi són també surten)
    persones: pers.filter((x) => !deBaixa_(x.p) || membres.some((m) => m.id_membre === x.id))
      // PAS 32: «Cognoms, Nom», per ordre alfabètic del 1r cognom
      .map((x) => ({ id: x.id, nom: [x.p.cognom1, x.p.cognom2].filter(Boolean).join(' ') + (x.p.nom ? ', ' + x.p.nom : ''), especialitat: x.detall, baixa: deBaixa_(x.p),
        ordre: normNom_([x.p.cognom1, x.p.cognom2, x.p.nom].join(' ')) }))
      .sort((a, b) => a.ordre.localeCompare(b.ordre, 'ca')) };
}
function equipsDesa_(ctx, req) {
  if (!ctx.global) return { ok: false, error: 'sense_permis' };
  const llista = Array.isArray(req.equips) ? req.equips : [];
  const vist = {};
  for (const q of llista) {
    // PAS 34: el codi es normalitza (majúscules, sense accents ni espais) abans de comprovar-lo
    q.id_equip = codiEquip_(q.id_equip);
    const id = q.id_equip;
    if (!/^EQ-[A-Z0-9-]{1,20}$/.test(id)) return { ok: false, error: 'id_equip_invalid', id_equip: id || '(buit)' };
    if (vist[id]) return { ok: false, error: 'id_equip_repetit', id_equip: id };
    if (!String(q.nom || '').trim()) return { ok: false, error: 'nom_buit', camp: id };
    const tots = GRUPS_ESO.concat(GRUPS_1BAT, GRUPS_2BAT), dolent = llistaGrups_(q.grups).filter((g) => tots.indexOf(g) < 0)[0];
    if (dolent) return { ok: false, error: 'grup_desconegut', id_equip: id, grup: dolent };
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
      tipus: q.tipus === 'docent' ? 'docent' : 'gestio', descripcio: String(q.descripcio || '').slice(0, 500), actiu: q.actiu === 'no' ? 'no' : 'si',
      grups: llistaGrups_(q.grups).join(', ') })[k] || ''));
    if (vals.length > 1) sh.getRange(2, 1, vals.length - 1, cap.length).clearContent();
    if (files.length) sh.getRange(2, 1, files.length, cap.length).setValues(files);
    historial_(ctx.email, 'equips', FULL.eq, '', JSON.stringify(llista.map((q) => q.id_equip + ':' + q.nom)).slice(0, 45000));
    return { ok: true };
  } finally { lock.releaseLock(); }
}

const codiEquip_ = (x) => {
  let c = String(x || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_.·]+/g, '-').replace(/[^A-Z0-9-]/g, '').replace(/-+/g, '-').replace(/-$/, '');
  if (c && !/^EQ-/.test(c)) c = 'EQ-' + c.replace(/^EQ/, '');
  return c;
};
// PAS 34 · Esborrar un equip (només admins globals; mai l'equip directiu): treu l'equip, els seus membres i els seus permisos
function equipEsborra_(ctx, req) {
  if (!ctx.global) return { ok: false, error: 'sense_permis' };
  const id = String(req.id_equip || '');
  if (id === 'EQ-DIR') return { ok: false, error: 'eq_dir_protegit' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActive();
    const treu = (nom) => {
      const sh = ss.getSheetByName(nom); if (!sh || sh.getLastRow() < 2) return 0;
      const vals = sh.getDataRange().getValues(), j = vals[0].map(norm_).indexOf('id_equip');
      const queden = vals.slice(1).filter((r) => String(r[j]) !== id && r.join('') !== ''), n = vals.length - 1 - queden.length;
      if (n) { sh.getRange(2, 1, vals.length - 1, vals[0].length).clearContent(); if (queden.length) sh.getRange(2, 1, queden.length, vals[0].length).setValues(queden); }
      return n;
    };
    if (!llegeix_(FULL.eq).some((q) => q.id_equip === id)) return { ok: false, error: 'id_equip_invalid', id_equip: id };
    const membres = treu(FULL.memb), permisos = treu(FULL.perm);
    treu(FULL.eq);
    historial_(ctx.email, 'esborra_equip', FULL.eq, id, JSON.stringify({ membres: membres, permisos: permisos }));
    return { ok: true, id_equip: id, membres: membres, permisos: permisos };
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
  canviaOrdreModulsPAS30_();
  treuMembresDeBaixa_();
  marcaFitxesProva_();
  if (llegeix_(FULL.camps).some((c) => c.modul === 'professorat')) { sincronitzaCamps_('professorat', CAMPS_PROFESSORAT, ['estat', 'situacio']); canviaCampsProfessoratPAS30_(); }
  if (llegeix_(FULL.camps).some((c) => c.modul === 'pas')) { sincronitzaCamps_('pas', CAMPS_PAS, ['estat']); arxivaCamps_('pas', PAS_ARXIVATS); }
  [['professorat', CAMPS_PROFESSORAT], ['alumnat', CAMPS_ALUMNAT], ['batxillerat', CAMPS_BATXILLERAT], ['pas', CAMPS_PAS], ['control_entrada', CAMPS_CONTROL], ['amonestacions', CAMPS_AMONESTACIONS]].forEach((x) => {
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
    fullModul_(MODULS.amonestacions, campsDe_('amonestacions', true));
    ompleNivellPAS28_();
    Logger.log('ijm_alumnat_db: pestanyes «alumnes» (ESO), «alumnes_bat» (batxillerat), «entrades» (control d\'entrada) i «amonestacions» a punt.');
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
  if (!pot_(ctx, modul, 'edicio') || (ctx.abast && ctx.abast(modul))) return { ok: false, error: 'sense_permis' };
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
  const camps = campsNou_();
  // Per a «Substitueix a»: el professorat que no és de baixa, amb el càrrec (en triar-lo, el càrrec del substitut s'omple sol)
  const professorat = llegeix_(FULL.prof).filter((p) => !deBaixa_(p) && !esProva_(p) && p.nom)
    .map((p) => ({ id: p.id_professor, nom: [p.cognom1, p.cognom2].filter(Boolean).join(' ') + ', ' + p.nom, carrec: p.carrec || '' }))
    .sort((a, b) => normNom_(a.nom).localeCompare(normNom_(b.nom), 'ca'));
  return { ok: true, camps: camps, obert: obert_(ctx), curs: ctx.cfg.curs || '', professorat: professorat, provincies: PROVINCIES };
}
// Camps del formulari: els del professorat que es veuen des d'edició; obligatoris, els de NOU_OBLIGATORIS (PAS 30)
function campsNou_() {
  return campsDe_('professorat', true).filter((c) => c.actiu && c.tipus !== 'calculat' && c.origen !== 'clickedu' && c.clau !== 'prova' && NIVELLS.indexOf(c.visible_des_de) <= NIVELLS.indexOf('edicio'))
    .map((c) => Object.assign({}, c, { obligatori: c.obligatori || NOU_OBLIGATORIS.indexOf(c.clau) >= 0 }));
}
function altaProfessor_(ctx, req) {
  if (!pot_(ctx, 'nou_professor', 'edicio')) return { ok: false, error: 'sense_permis' };
  const v = req.valors && typeof req.valors === 'object' ? req.valors : {};
  delete v.equips;
  // PAS 30: obligatoris del formulari, «Substitueix a» si és substitut, codi postal i telèfon
  const camps = campsNou_(), errs = [];
  camps.forEach((c) => { if (c.obligatori && c.clau !== 'data_arribada_centre' && !String(v[c.clau] == null ? '' : v[c.clau]).trim()) errs.push({ id: 'nou', error: 'obligatori', camp: c.nom }); });
  const nomDe = (k) => (camps.filter((c) => c.clau === k)[0] || { nom: k }).nom;
  if (v.situacio === 'Substitut' && !String(v.substitueix || '').trim()) errs.push({ id: 'nou', error: 'obligatori', camp: nomDe('substitueix') });
  if (String(v.codi_postal || '').trim() && !/^\d{5}$/.test(String(v.codi_postal).trim())) errs.push({ id: 'nou', error: 'cp_invalid', camp: nomDe('codi_postal') });
  if (String(v.telefon || '').trim() && String(v.telefon).replace(/\D/g, '').length < 9) errs.push({ id: 'nou', error: 'telefon_invalid', camp: nomDe('telefon') });
  if (errs.length) return { ok: false, error: 'validacio', errors: errs };
  if (v.situacio !== 'Substitut') v.substitueix = '';
  // El càrrec del substitut: el de la persona a qui substitueix (si no se n'ha escrit cap)
  if (v.substitueix && !String(v.carrec || '').trim()) {
    const s = llegeix_(FULL.prof).filter((p) => normNom_([p.cognom1, p.cognom2].filter(Boolean).join(' ') + ', ' + p.nom) === normNom_(v.substitueix))[0];
    if (s) v.carrec = s.carrec || '';
  }
  delete v.data_arribada_centre;   // la posa el servidor: el dia que es desa
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
// PAS 37 · Un sol alumne pel codi (ESO o batxillerat, sense baixes): cerca la cel·la del codi i llegeix només aquella fila
function alumnePerId_(id) {
  if (!id) return null;
  for (const modul of ['alumnat', 'batxillerat']) {
    const M = MODULS[modul], sh = M.ss().getSheetByName(M.full);
    if (!sh || sh.getLastRow() < 2) continue;
    const cap = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_), ci = cap.indexOf(M.id);
    if (ci < 0) continue;
    let fila = 0;
    const col = sh.getRange(2, ci + 1, sh.getLastRow() - 1, 1);
    if (typeof col.createTextFinder === 'function') { const c = col.createTextFinder(id).matchEntireCell(true).findNext(); if (c) fila = c.getRow(); }
    else { const v = col.getDisplayValues(); const i = v.findIndex((r) => String(r[0]).trim() === id); if (i >= 0) fila = i + 2; }
    if (!fila) continue;
    const vals = sh.getRange(fila, 1, 1, cap.length).getDisplayValues()[0], r = {};
    cap.forEach((k, j) => { if (k) r[k] = String(vals[j] == null ? '' : vals[j]).trim(); });
    if (deBaixa_(r)) return null;
    return { id: r[M.id], nom: [String(r.cognom1 || '').trim(), String(r.cognom2 || '').trim()].filter(Boolean).join(' ') + ', ' + String(r.nom || '').trim(),
      nivell: r.nivell || nivellDeGrup_(r.grup_actual), grup: r.grup_actual || '' };
  }
  return null;
}
function entradaAlumnes_(ctx) {
  if (!pot_(ctx, 'control_entrada', 'edicio')) return { ok: false, error: 'sense_permis' };
  const ab = ctx.abast ? ctx.abast('control_entrada') : null;
  return { ok: true, alumnes: alumnesTots_().filter((a) => dinsAbast_(ab, a.grup)).map((a) => ({ id: a.id, nom: a.nom, nivell: a.nivell, grup: a.grup })) };
}
// Registra l'entrada ara (data i hora de Madrid) amb el nom, el nivell i el grup que té l'alumne en aquest moment
function entradaNova_(ctx, req) {
  if (!pot_(ctx, 'control_entrada', 'edicio')) return { ok: false, error: 'sense_permis' };
  if (!obert_(ctx)) return { ok: false, error: 'tancat' };
  // PAS 37: es busca només aquest alumne (abans es llegia tot l'alumnat d'ESO i de batxillerat)
  const a = alumnePerId_(String(req.id_alumne || ''));
  if (!a) return { ok: false, error: 'no_existeix' };
  if (!dinsAbast_(ctx.abast ? ctx.abast('control_entrada') : null, a.grup)) return { ok: false, error: 'fora_abast' };
  const M = MODULS.control_entrada;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // PAS 37: la pestanya ja existeix (configura): no cal llegir els camps ni revisar-ne les columnes a cada entrada
    const sh = M.ss().getSheetByName(M.full) || fullModul_(M, campsDe_('control_entrada', true));
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
// PAS 30 · Execució manual: esborra les entrades que es van importar (desat_per = importació) i torna a importar el full.
// Les entrades fetes des del web («Nova entrada») no es toquen.
function reimportaControlEntrada() {
  const M = MODULS.control_entrada, sh = fullModul_(M, campsDe_('control_entrada', true));
  const vals = sh.getDataRange().getDisplayValues(), cap = vals[0].map(norm_), j = cap.indexOf('desat_per');
  const queden = vals.slice(1).filter((r) => String(r[j]) !== 'importació'), n = vals.length - 1 - queden.length;
  if (n) {
    sh.getRange(2, 1, vals.length - 1, cap.length).clearContent();
    if (queden.length) sh.getRange(2, 1, queden.length, cap.length).setValues(queden);
  }
  Logger.log('Control d\'entrada: ' + n + ' entrades importades abans s\'han esborrat. Ara es tornen a importar.');
  importaControlEntrada();
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
    // PAS 30: la capçalera és la primera fila amb una columna de data («Marca de temps», «Data»…). L'alumne i el grup es
    // reconeixen pel nom de la columna o, si es diuen «Columna 1», «Columna 2»…, pel contingut («Cognoms, Nom» i «2n ESO A»).
    const reTemps = /^(marca de temps|timestamp|marca temporal)$/, reData = /^(data|dia|fecha|data i hora)$/;
    const fc = vals.findIndex((r) => r.some((k) => reTemps.test(normCap_(k)) || reData.test(normCap_(k))));
    if (fc < 0) { Logger.log(origen.getName() + ' › ' + pest.getName() + ': sense columna de data; es salta.'); return; }
    const cap = vals[fc].map(normCap_), ci = (re) => cap.findIndex((k) => re.test(k));
    const cTemps = ci(reTemps), cData = ci(reData), cHora = ci(/^(hora|hora d entrada|hora entrada)$/), cNiv = ci(/^nivell$/);
    const mostra = vals.slice(fc + 1).filter((r) => r.join('').trim()).slice(0, 200);
    const perContingut = (re) => cap.findIndex((k, j) => j !== cTemps && j !== cData && mostra.length && mostra.filter((r) => String(r[j] || '').trim()).length > 0 &&
      mostra.filter((r) => re.test(String(r[j] || '').trim())).length >= 0.7 * mostra.filter((r) => String(r[j] || '').trim()).length);
    let cAlu = ci(/^(alumne|alumna|nom i cognoms|nom complet|cognoms i nom|cognoms nom|nom de l alumne)$/), cGrup = ci(/^(grup|grup classe|curs|classe)$/);
    if (cGrup < 0) cGrup = perContingut(/^(1r|2n|3r|4t)\s*(eso|bat)/i);
    if (cAlu < 0) cAlu = perContingut(/^[^,\d]+,\s*[^,\d]+$/);
    if (cAlu < 0) { Logger.log(origen.getName() + ' › ' + pest.getName() + ': no trobo la columna de l\'alumne; es salta.'); return; }
    Logger.log(origen.getName() + ' › ' + pest.getName() + ': columnes ' + [cTemps >= 0 ? 'marca de temps' : '', cData >= 0 ? 'data' : '', cHora >= 0 ? 'hora' : '', 'alumne', cGrup >= 0 ? 'grup' : '', cNiv >= 0 ? 'nivell' : ''].filter(Boolean).join(', '));
    vals.slice(fc + 1).forEach((r) => {
      const nom = String(r[cAlu] || '').trim();
      if (!nom) return;
      files++;
      // Data i hora: «dd/mm/aaaa hh:mm(:ss)» (marca de temps), «dd/mm/aaaa» o «aaaa-mm-dd»
      const brut = cTemps >= 0 ? String(r[cTemps]) : String(r[cData] || '') + ' ' + String(cHora >= 0 ? r[cHora] || '' : '');
      let m = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(brut), data = '';
      if (m) data = (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
      else if ((m = /(\d{4})-(\d{2})-(\d{2})/.exec(brut))) data = m[0];
      const h = /(\d{1,2}):(\d{2})/.exec(brut);
      const hora = h ? ('0' + h[1]).slice(-2) + ':' + h[2] : '';
      if (!data) { sense++; return; }
      const a = perNom[normNom_(nom)];
      if (!a) noTrobats[nom] = (noTrobats[nom] || 0) + 1;
      const o = { alumne: a ? a.nom : nom, nivell: a ? a.nivell : (cNiv >= 0 ? String(r[cNiv] || '') : nivellDeGrup_(cGrup >= 0 ? r[cGrup] : '')),
        grup: a ? a.grup : (cGrup >= 0 ? String(r[cGrup] || '').trim().replace(/\bbat\b/i, 'BAT') : ''), data: data, hora: hora, id_alumne: a ? a.id : '', desat_per: 'importació' };
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

// ------------------------------------------------------------------ PAS 30 · equips docents per grup-classe
// Execució manual: crea (o completa) un equip per grup-classe a partir d'EQUIPS_DOCENTS (EQ-1ESOA «Equip docent 1r ESO A»,
// tipus docent, columna grups) amb el professorat que hi fa classe, i li dona consulta al mòdul d'alumnat del grup (ESO o
// batxillerat), limitada al grup. No treu res: si es torna a executar, només afegeix el que falti.
function creaEquipsDocents() {
  const ss = SpreadsheetApp.getActive();
  assegura_(FULL.eq);
  const prof = llegeix_(FULL.prof);
  const perNom = {}, perNomC1 = {};
  prof.forEach((p) => { perNom[normNom_([p.nom, p.cognom1, p.cognom2].join(' '))] = p; const k = normNom_(p.nom + ' ' + p.cognom1); perNomC1[k] = perNomC1[k] ? 'repetit' : p; });
  const troba = (t) => {
    if (!Array.isArray(t)) return null;
    return perNom[normNom_(t.join(' '))] || (perNomC1[normNom_(t[0] + ' ' + t[1])] !== 'repetit' ? perNomC1[normNom_(t[0] + ' ' + t[1])] : null) ||
      prof.filter((p) => normNom_(p.cognom1 + ' ' + p.cognom2) === normNom_(t[1] + ' ' + t[2]))[0] || null;
  };
  const shE = ss.getSheetByName(FULL.eq), capE = shE.getRange(1, 1, 1, shE.getLastColumn()).getDisplayValues()[0].map(norm_);
  const equips = llegeix_(FULL.eq), membres = llegeix_(FULL.memb), perms = llegeix_(FULL.perm);
  let nousEq = 0, nousM = 0, nousP = 0;
  const noTrobats = {};
  Object.keys(EQUIPS_DOCENTS).forEach((grup) => {
    const id = 'EQ-' + grup.replace(/^(\d)(r|n|t)\s+/, '$1').replace(/\s+/g, '').toUpperCase();
    if (!equips.some((q) => q.id_equip === id)) {
      const o = { id_equip: id, nom: 'Equip docent ' + grup, tipus: 'docent', descripcio: 'Professorat que fa classe al grup ' + grup + ' (consulta de l\'alumnat del grup)', actiu: 'si', grups: grup };
      shE.appendRow(capE.map((k) => o[k] || '')); nousEq++;
    }
    EQUIPS_DOCENTS[grup].forEach((t) => {
      const p = troba(t);
      if (!p) { noTrobats[Array.isArray(t) ? t[0] + ' ' + t[1] : t] = 1; return; }
      if (!membres.some((m) => m.id_equip === id && m.id_membre === p.id_professor)) { ss.getSheetByName(FULL.memb).appendRow([id, p.id_professor, '']); membres.push({ id_equip: id, id_membre: p.id_professor }); nousM++; }
    });
    const modul = /BAT/.test(grup) ? 'batxillerat' : 'alumnat';
    if (!perms.some((r) => r.id_equip === id && r.id_modul === modul)) { ss.getSheetByName(FULL.perm).appendRow([id, modul, 'consulta']); perms.push({ id_equip: id, id_modul: modul }); nousP++; }
  });
  historial_('creaEquipsDocents', 'equips', FULL.eq, '', JSON.stringify({ equips: nousEq, membres: nousM, permisos: nousP }));
  Logger.log('Equips docents: ' + nousEq + ' equips nous, ' + nousM + ' membres afegits, ' + nousP + ' permisos de consulta (limitats al grup).');
  const nt = Object.keys(noTrobats);
  if (nt.length) Logger.log('No trobats al professorat (afegiu-los a mà a Equips i permisos › Membres): ' + nt.join(', '));
}

// ------------------------------------------------------------------ PAS 30 · importacions de llistats de Clickedu
// Font: un CSV pujat a Drive (separat per ; i en la codificació de Windows, com els exporta Clickedu) o un full de càlcul.
function llegeixFont_(ref) {
  const id = (String(ref || '').match(/[-\w]{25,}/) || [''])[0];
  if (!id) throw new Error('Falta l\'URL del fitxer a config.');
  // Només s'obre com a full de càlcul si ho és (si no, Apps Script anota un error encara que després es llegeixi bé com a CSV)
  const fitxer = DriveApp.getFileById(id);
  if (fitxer.getMimeType() === MimeType.GOOGLE_SHEETS) return SpreadsheetApp.openById(id).getSheets()[0].getDataRange().getDisplayValues();
  const blob = fitxer.getBlob();
  let text = blob.getDataAsString('UTF-8');
  if (text.indexOf('�') >= 0) text = blob.getDataAsString('windows-1252');
  const primera = text.split(/\r?\n/)[0];
  return Utilities.parseCsv(text, (primera.match(/;/g) || []).length >= (primera.match(/,/g) || []).length ? ';' : ',');
}
// Una fila del llistat de Clickedu → camps de GESTIO (dates a aaaa-mm-dd, telèfon sense «34-», província pel codi postal)
function dadesPersona_(cap, r) {
  const g = (k) => { const j = cap.indexOf(normCap_(k)); return j >= 0 ? String(r[j] == null ? '' : r[j]).trim() : ''; };
  const iso = (x) => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(x); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : ''; };
  const pais = g('País').split(',').map((x) => x.trim()).filter(Boolean);
  let cp = g('Codi postal').replace(/\D/g, '');
  if (!cp && /^\d{4,5}$/.test(pais[0] || '')) cp = pais[0];
  if (cp.length === 4) cp = '0' + cp;
  const poblacio = /^\d/.test(pais[0] || '') ? (pais[1] || '') : (pais[0] || '');
  return { nom: g('Nom'), cognom1: g('Primer cognom'), cognom2: g('Segon cognom'), nif: g('DNI/NIF/NIE').toUpperCase().replace(/[\s.\-]/g, ''),
    data_naixement: iso(g('Data de naixement')), nacionalitat: g('Nacionalitat'), adreca: g('Adreça'), poblacio: poblacio, codi_postal: cp,
    provincia: PROVINCIES[cp.slice(0, 2)] || '', telefon: g('Telèfon mòbil').replace(/^\+?34[-\s]?/, '').replace(/[^\d+]/g, ''), data_arribada_centre: iso(g('Data d\'alta')) };
}
// Omple (sense esborrar res) les dades personals de les persones d'un full (professorat o PAS); crea les que no hi són si es demana
function importaPersones_(modul, ref, camps, crea) {
  const M = MODULS[modul], files = llegeixFont_(ref);
  const fc = files.findIndex((r) => r.some((k) => normCap_(k) === 'primer cognom'));
  if (fc < 0) throw new Error('El fitxer no té la capçalera de Clickedu («Primer cognom», «Nom»…).');
  const cap = files[fc].map(normCap_);
  const sh = fullModul_(M, campsDe_(modul, true));
  const vals = sh.getDataRange().getDisplayValues(), capA = vals[0].map(norm_);
  const col = (k) => capA.indexOf(k);
  const persones = vals.slice(1).map((r, i) => ({ i: i + 1, r: r }));
  const perNif = {}, perNom = {}, perCognoms = {};
  persones.forEach((x) => {
    const nif = String(x.r[col('nif')] || '').toUpperCase(); if (nif) perNif[nif] = x;
    perNom[normNom_([x.r[col('nom')], x.r[col('cognom1')], x.r[col('cognom2')]].join(' '))] = x;
    // Si el nom de pila no coincideix (Ernest/Ernesto, Assumpta/Asunción), els dos cognoms, si només els té una persona
    if (String(x.r[col('cognom2')] || '').trim()) { const k = normNom_(x.r[col('cognom1')] + ' ' + x.r[col('cognom2')]); perCognoms[k] = perCognoms[k] ? 'repetit' : x; }
  });
  const perCog = (d) => { const x = d.cognom2 ? perCognoms[normNom_(d.cognom1 + ' ' + d.cognom2)] : null; return x && x !== 'repetit' ? x : null; };
  const ara = ara_(), noTrobats = [], fets = {}, noves = [];
  let omplerts = 0;
  let seguent = 1 + persones.reduce((m, x) => Math.max(m, Number(String(x.r[col(M.id)]).replace(/\D/g, '')) || 0), 0);
  files.slice(fc + 1).forEach((r) => {
    const d = dadesPersona_(cap, r);
    if (!d.cognom1 && !d.nom) return;
    const x = (d.nif && perNif[d.nif]) || perNom[normNom_([d.nom, d.cognom1, d.cognom2].join(' '))] || perCog(d);
    if (!x) {
      if (!crea) { noTrobats.push([d.cognom1, d.cognom2].filter(Boolean).join(' ') + ', ' + d.nom); return; }
      const o = Object.assign({ estat: 'actiu' }, d); o[M.id] = codi_(M, seguent++); o.data = ara; o.desat_per = 'importació';
      noves.push(capA.map((k) => (k && o[k] !== undefined ? o[k] : ''))); return;
    }
    fets[x.i] = 1;
    camps.forEach((k) => { if (col(k) >= 0 && d[k] && !String(x.r[col(k)] || '').trim()) { x.r[col(k)] = d[k]; omplerts++; x.canvi = 1; } });
    if (x.canvi) { x.r[col('data')] = ara; x.r[col('desat_per')] = 'importació'; }
  });
  const canviades = persones.filter((x) => x.canvi);
  canviades.forEach((x) => sh.getRange(x.i + 1, 1, 1, capA.length).setValues([x.r]));
  if (noves.length) sh.getRange(sh.getLastRow() + 1, 1, noves.length, capA.length).setValues(noves);
  // Qui encara té dades personals buides (persones que no són de baixa)
  const faltes = vals.slice(1).concat(noves).filter((r) => !deBaixa_({ estat: r[col('estat')] }) && !esProva_({ prova: col('prova') >= 0 ? r[col('prova')] : '' }) && r[col('nom')]).map((r) => {
    const f = camps.filter((k) => col(k) >= 0 && !String(r[col(k)] || '').trim());
    return f.length ? [r[col('cognom1')], r[col('cognom2')]].filter(Boolean).join(' ') + ', ' + r[col('nom')] + ' (falta: ' + f.join(', ') + ')' : '';
  }).filter(Boolean);
  historial_('importació', 'dades_personals', M.full, '', JSON.stringify({ persones: canviades.length, camps: omplerts, noves: noves.length }));
  marcaVersio_(modul, 'importació');
  Logger.log(M.full + ': ' + canviades.length + ' persones completades (' + omplerts + ' dades)' + (noves.length ? ', ' + noves.length + ' persones noves' : '') + '.');
  if (noTrobats.length) Logger.log('Al llistat però no a GESTIO (' + noTrobats.length + '): ' + noTrobats.join('; '));
  if (faltes.length) Logger.log('Encara falten dades (' + faltes.length + '): ' + faltes.join('; '));
}
const DADES_PERSONALS = ['nif', 'data_naixement', 'nacionalitat', 'telefon', 'adreca', 'poblacio', 'codi_postal', 'provincia'];
function importaDadesProfessorat() { importaPersones_('professorat', llegeixConfig_().font_dades_professorat, DADES_PERSONALS, false); }
function importaPAS() { importaPersones_('pas', llegeixConfig_().font_pas, DADES_PERSONALS.concat(['data_arribada_centre']), true); }

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
// PAS 30 · ordre de les targetes: Professorat, PAS, Alumnat ESO, Alumnat Batxillerat, Nou professor/a, Control d'entrada
function canviaOrdreModulsPAS30_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.mod);
  const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
  const ordre = {}; MODULS_PER_DEFECTE.forEach((m) => { ordre[m[0]] = m[3]; });
  if (vals.slice(1).some((r) => String(r[cap.indexOf('id_modul')]) === 'pas' && Number(r[cap.indexOf('ordre')]) === 2)) return;   // ja fet
  for (let i = 1; i < vals.length; i++) { const id = String(vals[i][cap.indexOf('id_modul')]); if (ordre[id] !== undefined) sh.getRange(i + 1, cap.indexOf('ordre') + 1).setValues([[ordre[id]]]); }
  Logger.log('Mòduls reordenats: Professorat, PAS, Alumnat ESO, Alumnat Batxillerat…');
}
// PAS 30 · professorat: especialitat passa a desplegable (els valors d'ara s'hi adapten si són clars) i «Anys» → «Anys docència»
function canviaCampsProfessoratPAS30_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.camps);
  const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
  const iC = (k) => cap.indexOf(k);
  let canvi = false;
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][iC('modul')]) !== 'professorat') continue;
    const k = String(vals[i][iC('clau')]);
    if (k === 'especialitat' && norm_(vals[i][iC('tipus')]) === 'text') { sh.getRange(i + 1, iC('tipus') + 1).setValues([['llista']]); sh.getRange(i + 1, iC('valors') + 1).setValues([[ESPECIALITATS.join('|')]]); canvi = true; }
    if (k === 'anys' && String(vals[i][iC('nom')]) === 'Anys') { sh.getRange(i + 1, iC('nom') + 1).setValues([['Anys docència']]); canvi = true; }
  }
  if (!canvi) return;
  // Dades: especialitat d'ara → valor de la llista (les que no s'entenen es conserven i surten al registre)
  const shP = SpreadsheetApp.getActive().getSheetByName(FULL.prof);
  if (shP && shP.getLastRow() > 1) {
    const c = shP.getRange(1, 1, 1, shP.getLastColumn()).getDisplayValues()[0].map(norm_), j = c.indexOf('especialitat');
    if (j >= 0) {
      const col = shP.getRange(2, j + 1, shP.getLastRow() - 1, 1).getDisplayValues(), dubtes = [];
      const nou = col.map((r) => { const v = String(r[0]).trim(); if (!v || ESPECIALITATS.indexOf(v) >= 0) return [v]; const k = normCap_(v);
        const e = ESPECIALITATS.filter((x) => normCap_(x) === k)[0] || ESPECIALITAT_ALIES[k]; if (!e) dubtes.push(v); return [e || v]; });
      shP.getRange(2, j + 1, nou.length, 1).setValues(nou);
      if (dubtes.length) Logger.log('Especialitats que no són a la llista (es conserven; corregiu-les des del web): ' + dubtes.join(', '));
    }
  }
  historial_('configura', 'actualitzacio', FULL.camps, 'professorat', 'especialitat → llista; Anys → Anys docència');
  Logger.log('Professorat: Especialitat és un desplegable i «Anys» passa a «Anys docència».');
}
// Arxiva camps (actiu = no, no obligatoris): les dades es conserven a la pestanya
function arxivaCamps_(modul, claus) {
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.camps);
  const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
  const fets = [];
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][cap.indexOf('modul')]) !== modul || claus.indexOf(String(vals[i][cap.indexOf('clau')])) < 0 || norm_(vals[i][cap.indexOf('actiu')]) === 'no') continue;
    sh.getRange(i + 1, cap.indexOf('actiu') + 1).setValues([['no']]); sh.getRange(i + 1, cap.indexOf('obligatori') + 1).setValues([['no']]);
    fets.push(String(vals[i][cap.indexOf('clau')]));
  }
  if (fets.length) { historial_('configura', 'actualitzacio', FULL.camps, modul, 'arxivats: ' + fets.join(', ')); Logger.log('Camps arxivats a ' + modul + ': ' + fets.join(', ') + ' (les dades es conserven).'); }
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
