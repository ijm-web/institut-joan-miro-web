"""Descripcions de les optatives (1r-3r) i de les matèries d'opció de 4t d'ESO, un PDF per nivell.
No s'hi inclouen les matèries comunes.

Editeu els textos aquí i executeu:  python3 lib/formularis/genera.py
Cada entrada: (nom, hores setmanals, etiqueta, descripció).
Les matèries de 4t d'opció segueixen la presentació «Les matèries dels itineraris de 4t d'ESO 26-27».
"""

# ---------------------------------------------------------------- optatives 1r
OPT_ALE = ("Primer contacte amb la llengua alemanya: comunicació oral i escrita bàsica en situacions de la vida "
           "quotidiana, vocabulari i expressions habituals i cultura dels països de parla alemanya. És una "
           "matèria de continuïtat fins a 4t i prepara per als exàmens oficials del Goethe-Institut.")
OPT_FRA = ("Iniciació al francès des de la comunicació: presentar-se, parlar de l'entorn proper, entendre textos "
           "senzills i conèixer la cultura francòfona. És una matèria de continuïtat fins a 4t i obre la porta "
           "als exàmens oficials de llengua francesa.")
OPT_ITA = ("Aprenentatge de l'italià a partir de situacions comunicatives reals, aprofitant la proximitat amb el català i el "
           "castellà. Es treballa el nivell A1 del Marc Europeu de Referència per a les Llengües (MERC) i inclou aspectes de la "
           "cultura italiana. És una matèria de continuïtat fins a 4t i prepara per als exàmens.")
ITA_2N = ("Continuïtat de la segona llengua estrangera iniciada a 1r d'ESO: ampliació de vocabulari, estructures gramaticals i "
          "comunicació tant oral com escrita, adaptades al nivell de 2n d'ESO. En aquest curs es treballa el nivell A2 del Marc "
          "Europeu de Referència per a les Llengües (MERC) i es prepara l'alumnat per als exàmens oficials.")
ITA_3R = ("Continuïtat de la segona llengua estrangera iniciada a 1r d'ESO: ampliació de vocabulari, estructures gramaticals i "
          "comunicació tant oral com escrita, adaptades al nivell de 3r d'ESO. En aquest curs es comença a treballar el nivell B1 "
          "del Marc Europeu de Referència per a les Llengües (MERC) i es prepara l'alumnat per a les proves i exàmens oficials.")
ITA_4T = ("Continuïtat de la segona llengua estrangera iniciada a 1r d'ESO: ampliació de vocabulari, estructures gramaticals i "
          "comunicació tant oral com escrita, adaptades al nivell de 4t d'ESO. En aquest curs es finalitza la preparació del nivell "
          "B1 del Marc Europeu de Referència per a les Llengües (MERC) i es presenta l'alumnat a la prova oficial de B1 del CELI, "
          "preparant-lo per als exàmens oficials.")


def lle(nivell):
    return ("Continuïtat de la segona llengua estrangera iniciada a 1r: més vocabulari, estructures i "
            f"comunicació oral i escrita, al nivell de {nivell}. Prepara per als exàmens oficials.")


NIVELLS = {
    "1r": {
        "titol": "Optatives de 1r d'ESO",
        "fitxer": "optatives-1r-eso.pdf",
        "intro": ("A 1r d'ESO l'alumnat cursa una optativa de 3 hores setmanals. Alemany, francès i italià són matèries de continuïtat fins a 4t."),
        "seccions": [
            ("Optatives (se'n tria una)", [
                ("Alemany", 3, "Llengua estrangera", OPT_ALE),
                ("Francès", 3, "Llengua estrangera", OPT_FRA),
                ("Italià", 3, "Llengua estrangera", OPT_ITA),
                ("Anglès (reforç)", 3, "Reforç", "Consolidació de les bases de l'anglès (vocabulari, estructures gramaticals, comprensió i expressió) perquè l'alumnat pugui seguir amb seguretat la matèria comuna d'anglès."),
                ("Tècniques d'estudi", 3, "Reforç", "Eines per aprendre a aprendre: organitzar el temps i el material, planificar les tasques, fer resums, esquemes i mapes conceptuals, millorar la comprensió lectora i preparar els exàmens."),
                ("Iniciació als esports de raqueta", 3, "Esport i salut", "Introducció a diversos esports de raqueta: tècnica bàsica, regles del joc, joc en parella i en equip, joc net i hàbits de vida saludables."),
                ("Taller de matemàtiques", 3, "Matemàtiques", "Matèria de matemàtiques on es consoliden els conceptes bàsics mitjançant metodologies molt actives: manipulació, reptes, jocs i resolució de problemes en grup."),
            ]),
        ],
    },
    "2n": {
        "titol": "Optatives de 2n d'ESO",
        "fitxer": "optatives-2n-eso.pdf",
        "intro": ("A 2n d'ESO l'alumnat cursa una optativa de 3 hores setmanals. L'alumnat que fa alemany, francès o italià hi dona continuïtat."),
        "seccions": [
            ("Optatives (se'n tria una)", [
                ("Alemany", 3, "Llengua estrangera", lle("2n d'ESO")),
                ("Francès", 3, "Llengua estrangera", lle("2n d'ESO")),
                ("Italià", 3, "Llengua estrangera", ITA_2N),
                ("Anglès", 3, "Llengua estrangera", "Hores addicionals d'anglès per reforçar les habilitats comunicatives, sobretot l'expressió oral i escrita, amb activitats pràctiques i projectes."),
                ("Taller d'expressió", 3, "Llengua", "Escriptura creativa, expressió oral i dramatització: l'alumnat experimenta amb la paraula, la veu i el cos per comunicar-se amb més confiança."),
                ("Expressió artística", 3, "Arts", "Projectes plàstics amb tècniques diverses (dibuix, pintura, volum, collage, imatge digital) per desenvolupar la creativitat i la mirada crítica."),
                ("Tecnificació en esports de raqueta", 3, "Esport i salut", "Perfeccionament de la tècnica i la tàctica dels esports de raqueta treballats a 1r, amb partits, petits tornejos i valors esportius."),
            ]),
        ],
    },
    "3r": {
        "titol": "Optatives de 3r d'ESO",
        "fitxer": "optatives-3r-eso.pdf",
        "intro": ("A 3r d'ESO l'alumnat cursa una optativa de 3 hores setmanals. L'alumnat que fa alemany, francès o italià hi dona continuïtat. A final de curs, es tria l'itinerari de 4t."),
        "seccions": [
            ("Optatives (se'n tria una)", [
                ("Alemany", 3, "Llengua estrangera", lle("3r d'ESO")),
                ("Francès", 3, "Llengua estrangera", lle("3r d'ESO")),
                ("Italià", 3, "Llengua estrangera", ITA_3R),
                ("Anglès", 3, "Llengua estrangera", "Hores addicionals d'anglès centrades en la comunicació oral i escrita, amb projectes i activitats a partir de temes d'actualitat."),
                ("Esports de raqueta", 3, "Esport i salut", "Pràctica d'esports de raqueta amb més exigència tècnica i tàctica, organització d'activitats i arbitratge."),
                ("Teatre", 3, "Arts", "Tècniques d'interpretació, improvisació, veu i moviment, i preparació d'una obra o d'escenes per representar-les davant d'un públic."),
            ]),
        ],
    },
    "4t": {
        "titol": "Matèries d'opció de 4t d'ESO",
        "fitxer": "materies-opcio-4t-eso.pdf",
        "intro": ("A 4t d'ESO l'alumnat tria una matèria de cada franja (3 hores setmanals cadascuna) segons l'itinerari: tecnològic, científic, social, humanístic i artístic. Els continguts són els de la presentació del curs 2026-2027."),
        "seccions": [
            ("Matèries d'opció (franges 1, 2 i 3)", [
                ("Física i química", 3, "Franges 1 i 2", "Estudi del moviment; estàtica de fluids, forces i equilibri, i dinàmica; l'àtom i la taula periòdica, formulació inorgànica i reaccions químiques."),
                ("Biologia i geologia", 3, "Franges 1 i 2", "Geosfera: la Terra i l'univers, dinàmica terrestre i relleu. Biologia: la cèl·lula i el cicle cel·lular, genètica molecular, herència biològica, origen i evolució dels éssers vius, i ecologia."),
                ("Digitalització", 3, "Franges 1 i 2", "Entorn personal d'aprenentatge (cerca crítica d'informació, aplicacions i programació web) i creació de continguts digitals i audiovisuals amb tecnologies emergents (IA, IoT). A l'itinerari tecnològic s'imparteix en anglès i inclou programació amb Scratch i microcontroladors (ESP32 Steam)."),
                ("Economia", 3, "Franges 1 i 2", "Introducció a l'economia, la producció i els agents econòmics, planificació financera (ingressos, despeses, estalvi i sistema financer), intermediaris financers i impostos, i finances públiques i política fiscal."),
                ("Educació visual i plàstica", 3, "Franja 1", "Expressió plàstica (tècniques, materials i lectura d'imatges de diferents períodes), dibuix tècnic (sistema cònic) i fonaments del disseny (forma i funció, branques del disseny, projectes). Adreçada a l'alumnat que es planteja continuar els estudis en un batxillerat artístic o en cicles formatius de grau mitjà d'Arts Plàstiques i Disseny o de Formació Professional d'ensenyaments artístics."),
                ("Filosofia", 3, "Franja 1", "Pensar, comprendre i argumentar: la reflexió filosòfica i l'anàlisi d'arguments; la dimensió personal de l'ésser humà (autoconeixement, dignitat, felicitat) i la dimensió social (pluralisme, amistat, comunitat política i responsabilitat ecològica)."),
                ("Llatí", 3, "Franja 2", "Llengües indoeuropees i romàniques, l'abecedari, la declinació i la sintaxi llatines i l'evolució al català i al castellà; història i vida quotidiana de Roma, i mitologia clàssica."),
                ("Música", 3, "Franja 2", "Interpretació de diferents peces musicals de diferents èpoques històriques amb el teclat i amb la flauta. Els grans compositors de la història de la música. La música folklòrica espanyola i d'arreu del món, la música de cinema i de videojocs. La música i les noves tecnologies."),
                ("Alemany", 3, "Franja 3", lle("4t d'ESO")),
                ("Francès", 3, "Franja 3", lle("4t d'ESO") + " Es treballa el nivell DELF B1."),
                ("Italià", 3, "Franja 3", ITA_4T),
                ("Emprenedoria", 3, "Franja 3", "Autoconeixement i itinerari formatiu, la cerca de feina i els drets i deures laborals, el sistema econòmic i el mercat, i la creativitat per desenvolupar idees i projectes."),
                ("Tecnologia", 3, "Franja 3", "L'habitatge i les seves instal·lacions (aigua, gas, electricitat, climatització, comunicació i domòtica), electrònica analògica i digital, pneumàtica i hidràulica, i control i robòtica."),
            ]),
        ],
    },
}
