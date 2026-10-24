import type { Messages } from '../fr'

export const mail: Messages['mail'] = {
  hello: (name: string) => `Hi ${name}`,
  linkSeparator: ': ',
  buttonFallback: 'If the button doesn’t work, copy this link: ',
  invitation: {
    subject: 'Commander League — your invitation',
    intro: 'you’re invited to join the Commander League. Here’s your link to create your account (valid for 7 days)',
    button: 'Create my account',
    outro: 'If you weren’t expecting this invitation, just ignore this email.',
  },
  adminReset: {
    subject: 'Commander League — new password',
    intro: 'the admin sent you a link to choose a new password (valid for 7 days)',
    button: 'Choose my password',
    outro: 'If you didn’t ask for anything, just ignore this email.',
  },
  forgot: {
    subject: 'Commander League — new password',
    intro: 'here’s your link to choose a new password (valid for 1 hour)',
    button: 'Choose my password',
    outro: 'If you didn’t ask for anything, just ignore this email.',
  },
  emailChanged: {
    subject: 'Commander League — email address changed',
    intro: 'the email address of your account was just changed or removed from your profile. To sign in',
    button: 'Sign in',
    outro: 'If it wasn’t you, sign in and change your password right away, then put your address back in your profile.',
  },
}
