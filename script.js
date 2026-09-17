/* =============================================================
 * Formulaire d'inscription
 *
 * Le code est organisé en couches, chacune avec une seule responsabilité :
 *   1. Règles de validation : fonctions pures, sans accès au DOM
 *   2. Formatage            : mise en forme des valeurs affichées
 *   3. Schéma               : description déclarative des champs
 *   4. Logique métier       : normalisation, validation, récapitulatif
 *   5. Vue                  : seule couche qui lit et modifie le DOM
 *   6. Contrôleur           : relie la vue et la logique métier
 *
 * Tout est encapsulé dans une IIFE pour ne rien exposer dans le scope global.
 * ============================================================= */

(() => {
    "use strict";

    /* ---------- 1. Règles de validation ---------- */

    const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    /**
     * Chaque fabrique renvoie une règle : (valeur, valeurs) => message | null.
     * `valeurs` contient tout le formulaire, pour les règles qui comparent deux champs.
     */
    const Regles = Object.freeze({
        obligatoire: () => (valeur) =>
            valeur === "" ? "Ce champ est obligatoire." : null,

        email: () => (valeur) =>
            REGEX_EMAIL.test(valeur) ? null : "Adresse email invalide (ex. : nom@domaine.fr).",

        identiqueA: (nomAutreChamp, message) => (valeur, valeurs) =>
            valeur === valeurs[nomAutreChamp] ? null : message,
    });


    /* ---------- 2. Formatage ---------- */

    /** Convertit une date ISO "AAAA-MM-JJ" en "JJ/MM/AAAA". */
    function formaterDate(dateIso) {
        const [annee, mois, jour] = dateIso.split("-");
        return `${jour}/${mois}/${annee}`;
    }


    /* ---------- 3. Schéma du formulaire ---------- */

    /**
     * nom          : attribut `name` du champ HTML
     * libelle      : texte utilisé dans les messages et le récapitulatif
     * regles       : règles appliquées dans l'ordre, la première erreur l'emporte
     * confidentiel : valeur ni nettoyée ni affichée dans le récapitulatif
     * formater     : mise en forme de la valeur dans le récapitulatif
     */
    const SCHEMA_INSCRIPTION = Object.freeze([
        { nom: "login", libelle: "Login", regles: [Regles.obligatoire()] },
        { nom: "motdepasse", libelle: "Mot de passe", regles: [Regles.obligatoire()], confidentiel: true },
        {
            nom: "confirmation",
            libelle: "Confirmation du mot de passe",
            regles: [
                Regles.obligatoire(),
                Regles.identiqueA("motdepasse", "Les mots de passe ne correspondent pas."),
            ],
            confidentiel: true,
        },
        { nom: "nom", libelle: "Nom", regles: [Regles.obligatoire()] },
        { nom: "prenom", libelle: "Prénom", regles: [Regles.obligatoire()] },
        { nom: "adresse", libelle: "Adresse", regles: [Regles.obligatoire()] },
        { nom: "email", libelle: "Email", regles: [Regles.obligatoire(), Regles.email()] },
        { nom: "telephone", libelle: "Téléphone", regles: [Regles.obligatoire()] },
        { nom: "naissance", libelle: "Date de naissance", regles: [Regles.obligatoire()], formater: formaterDate },
    ]);


    /* ---------- 4. Logique métier ---------- */

    /** Supprime les espaces superflus, sauf pour les champs confidentiels. */
    function normaliserValeurs(valeursBrutes, schema) {
        return Object.fromEntries(
            schema.map(({ nom, confidentiel }) => {
                const valeur = valeursBrutes[nom] ?? "";
                return [nom, confidentiel ? valeur : valeur.trim()];
            })
        );
    }

    /** Renvoie la liste des erreurs [{ nom, libelle, message }], vide si tout est valide. */
    function validerValeurs(valeurs, schema) {
        const erreurs = [];

        for (const { nom, libelle, regles } of schema) {
            for (const regle of regles) {
                const message = regle(valeurs[nom], valeurs);
                if (message) {
                    erreurs.push({ nom, libelle, message });
                    break;
                }
            }
        }

        return erreurs;
    }

    /** Prépare les lignes du récapitulatif [{ libelle, valeur }], sans les champs confidentiels. */
    function construireRecap(valeurs, schema) {
        return schema
            .filter(({ confidentiel }) => !confidentiel)
            .map(({ nom, libelle, formater }) => ({
                libelle,
                valeur: formater ? formater(valeurs[nom]) : valeurs[nom],
            }));
    }


    /* ---------- 5. Vue ---------- */

    function creerVueInscription(racine = document) {
        const elements = {
            vueFormulaire: racine.getElementById("vue-formulaire"),
            formulaire: racine.getElementById("formulaire-inscription"),
            alerte: racine.getElementById("alerte-formulaire"),
            alerteTitre: racine.getElementById("alerte-titre"),
            alerteListe: racine.getElementById("alerte-liste"),
            vueRecap: racine.getElementById("vue-recap"),
            titreRecap: racine.getElementById("titre-recap"),
            listeRecap: racine.getElementById("liste-recap"),
            modeleLigneRecap: racine.getElementById("modele-ligne-recap"),
            boutonModifier: racine.getElementById("bouton-modifier"),
        };

        const saisie = (nom) => elements.formulaire.elements.namedItem(nom);

        // La zone d'erreur est retrouvée via aria-describedby : aucune convention d'id cachée
        const zoneErreur = (nom) => racine.getElementById(saisie(nom).getAttribute("aria-describedby"));

        function marquerChamp(nom, message) {
            const champ = saisie(nom);
            if (message) {
                champ.setAttribute("aria-invalid", "true");
            } else {
                champ.removeAttribute("aria-invalid");
            }
            zoneErreur(nom).textContent = message ?? "";
        }

        function masquerAlerte() {
            elements.alerte.hidden = true;
            elements.alerteListe.replaceChildren();
        }

        function mettreAJourTitreAlerte() {
            const nombre = elements.alerteListe.children.length;
            elements.alerteTitre.textContent = nombre === 1
                ? "1 champ est à corriger :"
                : `${nombre} champs sont à corriger :`;
        }

        function creerLigneRecap({ libelle, valeur }) {
            const ligne = elements.modeleLigneRecap.content.firstElementChild.cloneNode(true);
            ligne.querySelector("dt").textContent = libelle;
            ligne.querySelector("dd").textContent = valeur;
            return ligne;
        }

        function basculerVers(vueAffichee, vueMasquee) {
            vueMasquee.hidden = true;
            vueAffichee.hidden = false;
            window.scrollTo({ top: 0 });
        }

        return {
            lireValeurs() {
                return Object.fromEntries(new FormData(elements.formulaire));
            },

            afficherErreurs(erreurs) {
                erreurs.forEach(({ nom, message }) => marquerChamp(nom, message));

                elements.alerteListe.replaceChildren(
                    ...erreurs.map(({ nom, libelle, message }) => {
                        const item = document.createElement("li");
                        item.dataset.champ = nom;
                        item.textContent = `${libelle} : ${message}`;
                        return item;
                    })
                );

                mettreAJourTitreAlerte();
                elements.alerte.hidden = false;
                saisie(erreurs[0].nom).focus();
            },

            effacerErreurs() {
                for (const champ of elements.formulaire.elements) {
                    if (champ.name) marquerChamp(champ.name, null);
                }
                masquerAlerte();
            },

            effacerErreurChamp(nom) {
                marquerChamp(nom, null);
                elements.alerteListe.querySelector(`[data-champ="${nom}"]`)?.remove();

                if (elements.alerteListe.children.length === 0) {
                    masquerAlerte();
                } else {
                    mettreAJourTitreAlerte();
                }
            },

            afficherRecap(prenom, lignes) {
                elements.titreRecap.textContent = `Bienvenue, ${prenom} !`;
                elements.listeRecap.replaceChildren(...lignes.map(creerLigneRecap));
                basculerVers(elements.vueRecap, elements.vueFormulaire);
                elements.titreRecap.focus();
            },

            afficherFormulaire() {
                basculerVers(elements.vueFormulaire, elements.vueRecap);
                saisie(SCHEMA_INSCRIPTION[0].nom).focus();
            },

            quandSoumis(gestionnaire) {
                elements.formulaire.addEventListener("submit", (evenement) => {
                    evenement.preventDefault(); // pas de rechargement de la page
                    gestionnaire();
                });
            },

            quandChampModifie(gestionnaire) {
                elements.formulaire.addEventListener("input", (evenement) => {
                    if (evenement.target.name) gestionnaire(evenement.target.name);
                });
            },

            quandModificationDemandee(gestionnaire) {
                elements.boutonModifier.addEventListener("click", gestionnaire);
            },
        };
    }


    /* ---------- 6. Contrôleur ---------- */

    function initialiserInscription() {
        const vue = creerVueInscription();

        vue.quandSoumis(() => {
            const valeurs = normaliserValeurs(vue.lireValeurs(), SCHEMA_INSCRIPTION);
            const erreurs = validerValeurs(valeurs, SCHEMA_INSCRIPTION);

            vue.effacerErreurs();

            if (erreurs.length > 0) {
                vue.afficherErreurs(erreurs);
                return;
            }

            vue.afficherRecap(valeurs.prenom, construireRecap(valeurs, SCHEMA_INSCRIPTION));
        });

        vue.quandChampModifie((nom) => vue.effacerErreurChamp(nom));
        vue.quandModificationDemandee(() => vue.afficherFormulaire());
    }

    document.addEventListener("DOMContentLoaded", initialiserInscription);
})();
