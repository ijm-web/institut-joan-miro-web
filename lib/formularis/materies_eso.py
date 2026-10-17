"""Descripcions de les matèries d'ESO per nivell (PDF «Descripció de les matèries de Xr ESO»).

Editeu els textos aquí i executeu:  python3 lib/formularis/genera.py
Cada entrada: (nom, hores setmanals, etiqueta, descripció).
Les matèries de 4t d'opció segueixen la presentació «Les matèries dels itineraris de 4t d'ESO 26-27».
"""

# ---------------------------------------------------------------- textos comuns
CAT = ("Treball de la comprensió i l'expressió oral i escrita en català, la reflexió sobre la llengua i "
       "la lectura i el comentari d'obres literàries. L'objectiu és que l'alumnat es comuniqui amb "
       "correcció i adequació en qualsevol situació.")
CAS = ("Desenvolupament de la comprensió i l'expressió oral i escrita en castellà, coneixement de la "
       "llengua i educació literària a partir de la lectura de textos i obres adequades a l'edat.")
ANG = ("Aprenentatge de l'anglès des de la comunicació: comprensió i producció de textos orals i escrits, "
       "interacció a l'aula i aspectes socioculturals. Dues hores es fan amb el grup sencer i una amb el "
       "grup desdoblat, per afavorir la participació oral.")
EF = ("Condició física i salut, habilitats motrius, jocs i esports, i expressió corporal. Promou hàbits "
      "de vida actius i saludables, el joc net i el treball en equip.")
SOC1 = ("Geografia i història: el medi físic, el planeta i els paisatges, i les societats de la Prehistòria "
        "i l'Antiguitat. Es treballa amb mapes, fonts i recursos digitals per entendre el món d'avui.")
SOC2 = ("Història medieval i moderna, i geografia de la població i de les ciutats. L'alumnat aprèn a "
        "interpretar fonts històriques i a relacionar el passat amb el present.")
SOC3 = ("Geografia econòmica i política, globalització i reptes del món actual (sostenibilitat, "
        "desigualtats, migracions), amb especial atenció a Catalunya, Espanya i Europa.")
SOC4 = ("Història contemporània, des de les revolucions liberals fins al món actual, i educació per a la "
        "ciutadania democràtica: drets humans, memòria democràtica i participació.")
MAT1 = ("Nombres, proporcionalitat, iniciació a l'àlgebra, geometria plana, mesura i estadística. Es posa "
        "l'accent en la resolució de problemes, el raonament i la comunicació matemàtica.")
MAT2 = ("Nombres racionals, proporcionalitat i percentatges, equacions de primer i segon grau, funcions, "
        "geometria i probabilitat, aplicats a situacions reals.")
MAT3 = ("Àlgebra (polinomis, equacions i sistemes), funcions i les seves gràfiques, geometria de l'espai, "
        "estadística i probabilitat. Es consoliden les estratègies de resolució de problemes.")
MAT4 = ("Nombres reals, àlgebra, funcions, trigonometria, geometria analítica, estadística i probabilitat. "
        "Prepara per a les matemàtiques del batxillerat i de la formació professional. Es fa en grups "
        "flexibles.")
LECT = ("Una hora setmanal dedicada a llegir: lectura individual i compartida, tertúlies i estratègies de "
        "comprensió lectora per guanyar hàbit i gust per la lectura.")

# ---------------------------------------------------------------- optatives 1r
OPT_ALE = ("Primer contacte amb la llengua alemanya: comunicació oral i escrita bàsica en situacions de la vida "
           "quotidiana, vocabulari i expressions habituals i cultura dels països de parla alemanya. És una "
           "matèria de continuïtat fins a 4t i prepara per als exàmens oficials del Goethe-Institut.")
OPT_FRA = ("Iniciació al francès des de la comunicació: presentar-se, parlar de l'entorn proper, entendre textos "
           "senzills i conèixer la cultura francòfona. És una matèria de continuïtat fins a 4t i obre la porta "
           "als exàmens oficials de llengua francesa.")
OPT_ITA = ("Aprenentatge de l'italià a partir de situacions comunicatives reals, aprofitant la proximitat amb el "
           "català i el castellà. Inclou aspectes de la cultura italiana. És una matèria de continuïtat fins a "
           "4t i prepara per als exàmens oficials de l'Istituto Italiano di Cultura.")


def lle(nivell):
    return ("Continuïtat de la segona llengua estrangera iniciada a 1r: més vocabulari, estructures i "
            f"comunicació oral i escrita, al nivell de {nivell}. Prepara per als exàmens oficials.")


NIVELLS = {
    "1r": {
        "titol": "Matèries de 1r d'ESO",
        "intro": ("A 1r d'ESO l'alumnat cursa deu matèries comunes i una optativa de 3 hores setmanals. "
                  "Català, castellà i matemàtiques es fan en grups reduïts flexibles."),
        "seccions": [
            ("Matèries comunes", [
                ("Llengua catalana i literatura", 3, "Llengua", CAT),
                ("Llengua castellana i literatura", 3, "Llengua", CAS),
                ("Ciències socials", 3, "Humanitats", SOC1),
                ("Matemàtiques", 3, "Ciències", MAT1),
                ("Educació física", 2, "Esport i salut", EF + " Inclou una hora setmanal de piscina al Poliesportiu PELL."),
                ("Educació visual i plàstica", 2, "Arts", "Elements del llenguatge visual (punt, línia, color, textura), tècniques gràfiques i plàstiques, i iniciació al dibuix geomètric. L'alumnat crea i analitza imatges."),
                ("Música", 2, "Arts", "Llenguatge musical bàsic, audició activa, interpretació vocal i instrumental en grup i coneixement de músiques de diferents estils i cultures."),
                ("Anglès", 3, "Llengua estrangera", ANG),
                ("Ciències experimentals (biologia i geologia)", 3, "Ciències", "La Terra a l'univers, els éssers vius i la seva classificació, la cèl·lula i els ecosistemes, amb treball pràctic al laboratori i a l'entorn."),
                ("Tecnologia", 2, "Tecnologia", "El procés tecnològic, materials, eines, estructures i iniciació a la programació. L'alumnat dissenya i construeix petits projectes al taller."),
            ]),
            ("Optatives (se'n tria una)", [
                ("Alemany", 3, "Llengua estrangera", OPT_ALE),
                ("Francès", 3, "Llengua estrangera", OPT_FRA),
                ("Italià", 3, "Llengua estrangera", OPT_ITA),
                ("Anglès (reforç)", 3, "Reforç", "Consolidació de les bases de l'anglès (vocabulari, estructures gramaticals, comprensió i expressió) perquè l'alumnat pugui seguir amb seguretat la matèria comuna d'anglès."),
                ("Tècniques d'estudi", 3, "Reforç", "Eines per aprendre a aprendre: organitzar el temps i el material, planificar les tasques, fer resums, esquemes i mapes conceptuals, millorar la comprensió lectora i preparar els exàmens."),
                ("Iniciació als esports de raqueta", 3, "Esport i salut", "Introducció a diversos esports de raqueta: tècnica bàsica, regles del joc, joc en parella i en equip, joc net i hàbits de vida saludables."),
                ("Construïm coneixement científic", 3, "Matemàtiques", "Matèria de matemàtiques on es consoliden els conceptes bàsics mitjançant metodologies molt actives: manipulació, reptes, jocs i resolució de problemes en grup."),
            ]),
        ],
    },
    "2n": {
        "titol": "Matèries de 2n d'ESO",
        "intro": ("A 2n d'ESO l'alumnat cursa deu matèries comunes, entre les quals una hora de Lectura, i una "
                  "optativa de 3 hores setmanals."),
        "seccions": [
            ("Matèries comunes", [
                ("Llengua catalana i literatura", 3, "Llengua", CAT),
                ("Llengua castellana i literatura", 3, "Llengua", CAS),
                ("Ciències socials", 3, "Humanitats", SOC2),
                ("Matemàtiques", 3, "Ciències", MAT2),
                ("Educació física", 2, "Esport i salut", EF),
                ("Música", 2, "Arts", "Història i estils de la música, audició crítica, creació i interpretació en grup amb veu i instruments, i usos de la música en la societat i els mitjans."),
                ("Anglès", 3, "Llengua estrangera", ANG),
                ("Ciències experimentals (física i química)", 3, "Ciències", "La matèria i les seves propietats, mescles i dissolucions, canvis químics, forces i moviment, i energia. Es combinen la teoria i les pràctiques de laboratori."),
                ("Tecnologia", 3, "Tecnologia", "Disseny i construcció de projectes, mecanismes, electricitat, programació i robòtica, amb atenció a la sostenibilitat i a la seguretat al taller."),
                ("Lectura", 1, "Llengua", LECT),
            ]),
            ("Optatives (se'n tria una)", [
                ("Alemany", 3, "Llengua estrangera", lle("2n d'ESO")),
                ("Francès", 3, "Llengua estrangera", lle("2n d'ESO")),
                ("Italià", 3, "Llengua estrangera", lle("2n d'ESO")),
                ("Anglès", 3, "Llengua estrangera", "Hores addicionals d'anglès per reforçar les habilitats comunicatives, sobretot l'expressió oral i escrita, amb activitats pràctiques i projectes."),
                ("Taller d'expressió", 3, "Llengua", "Escriptura creativa, expressió oral i dramatització: l'alumnat experimenta amb la paraula, la veu i el cos per comunicar-se amb més confiança."),
                ("Expressió artística", 3, "Arts", "Projectes plàstics amb tècniques diverses (dibuix, pintura, volum, collage, imatge digital) per desenvolupar la creativitat i la mirada crítica."),
                ("Tecnificació en esports de raqueta", 3, "Esport i salut", "Perfeccionament de la tècnica i la tàctica dels esports de raqueta treballats a 1r, amb partits, petits tornejos i valors esportius."),
            ]),
        ],
    },
    "3r": {
        "titol": "Matèries de 3r d'ESO",
        "intro": ("A 3r d'ESO l'alumnat cursa dotze matèries comunes, entre les quals Lectura i Projecte de "
                  "ciències, i una optativa de 3 hores setmanals. A final de curs, tria l'itinerari de 4t."),
        "seccions": [
            ("Matèries comunes", [
                ("Llengua catalana i literatura", 2, "Llengua", CAT),
                ("Llengua castellana i literatura", 2, "Llengua", CAS),
                ("Ciències socials", 3, "Humanitats", SOC3),
                ("Matemàtiques", 3, "Ciències", MAT3),
                ("Educació física", 2, "Esport i salut", EF),
                ("Anglès", 3, "Llengua estrangera", ANG),
                ("Tecnologia", 2, "Tecnologia", "Electricitat i electrònica, sistemes de control, programació i robòtica, i impacte ambiental de la tecnologia, amb projectes de taller."),
                ("Física i química", 2, "Ciències", "Estructura atòmica i taula periòdica, enllaç químic, reaccions químiques, i forces, moviment i energia, amb pràctiques de laboratori."),
                ("Biologia i geologia", 2, "Ciències", "El cos humà i la salut (nutrició, relació i reproducció), hàbits saludables i processos geològics externs."),
                ("Educació visual i plàstica", 2, "Arts", "Comunicació visual, disseny, sistemes de representació i projectes artístics individuals i en grup."),
                ("Lectura", 1, "Llengua", LECT),
                ("Projecte de ciències", 2, "Ciències", "Projecte pràctic que connecta física, química, biologia i geologia: l'alumnat planteja preguntes, experimenta, recull dades i en presenta les conclusions."),
            ]),
            ("Optatives (se'n tria una)", [
                ("Alemany", 3, "Llengua estrangera", lle("3r d'ESO")),
                ("Francès", 3, "Llengua estrangera", lle("3r d'ESO")),
                ("Italià", 3, "Llengua estrangera", lle("3r d'ESO")),
                ("Anglès", 3, "Llengua estrangera", "Hores addicionals d'anglès centrades en la comunicació oral i escrita, amb projectes i activitats a partir de temes d'actualitat."),
                ("Esports de raqueta", 3, "Esport i salut", "Pràctica d'esports de raqueta amb més exigència tècnica i tàctica, organització d'activitats i arbitratge."),
                ("Teatre", 3, "Arts", "Tècniques d'interpretació, improvisació, veu i moviment, i preparació d'una obra o d'escenes per representar-les davant d'un públic."),
            ]),
        ],
    },
    "4t": {
        "titol": "Matèries de 4t d'ESO",
        "intro": ("A 4t d'ESO l'alumnat cursa set matèries comunes i tria una matèria de cada franja (3 hores "
                  "setmanals cadascuna) segons l'itinerari: tecnològic, científic, social, humanístic i "
                  "artístic. Els continguts de les matèries d'opció són els de la presentació del curs "
                  "2026-2027."),
        "seccions": [
            ("Matèries comunes", [
                ("Llengua catalana i literatura", 3, "Llengua", CAT),
                ("Llengua castellana i literatura", 3, "Llengua", CAS),
                ("Ciències socials", 3, "Humanitats", SOC4),
                ("Matemàtiques", 4, "Ciències", MAT4),
                ("Educació física", 2, "Esport i salut", EF),
                ("Anglès", 3, "Llengua estrangera", ANG),
                ("Educació en valors cívics i ètics", 2, "Humanitats", "Reflexió ètica sobre la identitat, la convivència, els drets humans, la igualtat i la sostenibilitat, per formar una ciutadania crítica i responsable."),
            ]),
            ("Matèries d'opció (franges 1, 2 i 3)", [
                ("Física i química", 3, "Franges 1 i 2", "Estudi del moviment; estàtica de fluids, forces i equilibri, i dinàmica; l'àtom i la taula periòdica, formulació inorgànica i reaccions químiques."),
                ("Biologia i geologia", 3, "Franges 1 i 2", "Geosfera: la Terra i l'univers, dinàmica terrestre i relleu. Biologia: la cèl·lula i el cicle cel·lular, genètica molecular, herència biològica, origen i evolució dels éssers vius, i ecologia."),
                ("Digitalització", 3, "Franges 1 i 2", "Entorn personal d'aprenentatge (cerca crítica d'informació, aplicacions i programació web), creació de continguts digitals i audiovisuals amb tecnologies emergents (IA, IoT), i ciutadania digital crítica: notícies falses, fraus i comerç electrònic segur. A l'itinerari tecnològic s'imparteix en anglès i inclou programació amb Scratch i microcontroladors (ESP32 Steam)."),
                ("Economia", 3, "Franges 1 i 2", "Introducció a l'economia, la producció i els agents econòmics, planificació financera (ingressos, despeses, estalvi i sistema financer), intermediaris financers i impostos, i finances públiques i política fiscal."),
                ("Educació visual i plàstica", 3, "Franja 1", "Expressió plàstica (tècniques, materials i lectura d'imatges de diferents períodes), dibuix tècnic (sistema cònic) i fonaments del disseny (forma i funció, branques del disseny, projectes). Recomanada per a qui vulgui fer el batxillerat artístic."),
                ("Filosofia", 3, "Franja 1", "Pensar, comprendre i argumentar: la reflexió filosòfica i l'anàlisi d'arguments; la dimensió personal de l'ésser humà (autoconeixement, dignitat, felicitat) i la dimensió social (pluralisme, amistat, comunitat política i responsabilitat ecològica)."),
                ("Llatí", 3, "Franja 2", "Llengües indoeuropees i romàniques, l'abecedari, la declinació i la sintaxi llatines i l'evolució al català i al castellà; història i vida quotidiana de Roma, i mitologia clàssica."),
                ("Música", 3, "Franja 2", "Història de la música des de l'edat mitjana fins al segle XX, avantguardes, rock, música per al cinema i els videojocs, músiques del món i interpretació d'obres amb teclat o flauta."),
                ("Alemany", 3, "Franja 3", lle("4t d'ESO")),
                ("Francès", 3, "Franja 3", lle("4t d'ESO") + " Es treballa el nivell DELF B1."),
                ("Italià", 3, "Franja 3", lle("4t d'ESO")),
                ("Emprenedoria", 3, "Franja 3", "Autoconeixement i itinerari formatiu, la cerca de feina i els drets i deures laborals, el sistema econòmic i el mercat, i la creativitat per desenvolupar idees i projectes."),
                ("Tecnologia", 3, "Franja 3", "L'habitatge i les seves instal·lacions (aigua, gas, electricitat, climatització, comunicació i domòtica), electrònica analògica i digital, pneumàtica i hidràulica, i control i robòtica."),
            ]),
        ],
    },
}
