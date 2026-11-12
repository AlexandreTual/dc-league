// Mails envoyés par le site (français, la référence).
export const mail = {
  hello: (name: string) => `Bonjour ${name}`,
  /** Entre la phrase et le lien, dans le texte brut. */
  linkSeparator: ' : ',
  buttonFallback: 'Si le bouton ne marche pas, copie ce lien : ',
  invitation: {
    subject: 'Commander League — ton invitation',
    intro: 'tu es invité à rejoindre la Commander League. Voici ton lien pour créer ton compte (valable 7 jours)',
    button: 'Créer mon compte',
    outro: "Si tu ne t'attendais pas à cette invitation, ignore ce mail.",
  },
  adminReset: {
    subject: 'Commander League — nouveau mot de passe',
    intro: "l'admin t'a envoyé un lien pour choisir un nouveau mot de passe (valable 7 jours)",
    button: 'Choisir mon mot de passe',
    outro: "Si tu n'as rien demandé, ignore ce mail.",
  },
  forgot: {
    subject: 'Commander League — nouveau mot de passe',
    intro: 'voici ton lien pour choisir un nouveau mot de passe (valable 1 heure)',
    button: 'Choisir mon mot de passe',
    outro: "Si tu n'as rien demandé, ignore ce mail.",
  },
  emailChanged: {
    subject: 'Commander League — adresse mail modifiée',
    intro: "l'adresse mail de ton compte vient d'être modifiée ou effacée depuis ton profil. Pour te connecter",
    button: 'Me connecter',
    outro: "Si ce n'est pas toi, connecte-toi et change ton mot de passe tout de suite, puis remets ton adresse dans ton profil.",
  },
}
