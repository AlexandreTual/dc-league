// Relais d'envoi des mails de Commander League depuis ta Gmail (docs/mails.md).
// À coller tel quel dans script.google.com, puis à déployer en « Web app ».
// Remplace seulement le mot de passe ci-dessous : le même que GOOGLE_SCRIPT_SECRET dans Cloudflare.
const SECRET = 'REMPLACE-MOI'

function doPost(e) {
  let data
  try {
    data = JSON.parse(e.postData.contents)
  } catch {
    return reply({ ok: false, error: 'requete' })
  }
  if (SECRET === 'REMPLACE-MOI' || SECRET.length < 16 || data.secret !== SECRET) {
    return reply({ ok: false, error: 'secret' })
  }
  try {
    MailApp.sendEmail({ to: data.to, subject: data.subject, body: data.text, htmlBody: data.html, name: data.name })
  } catch {
    return reply({ ok: false, error: MailApp.getRemainingDailyQuota() < 1 ? 'quota' : 'envoi' })
  }
  return reply({ ok: true })
}

function reply(result) {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON)
}

// À lancer une fois depuis l'éditeur (bouton « Run ») : autorise l'envoi et t'envoie un mail d'essai.
function essai() {
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Commander League — essai', 'Le relais de mails fonctionne.')
}
