import { Setting } from '../models/Setting.js'
import { revealSecret } from './secrets.service.js'

async function getFromHeader(): Promise<{ fromName: string; fromAddress: string }> {
  const [nameSetting, addressSetting] = await Promise.all([
    Setting.findOne({ slug: 'email.from_name' }).lean(),
    Setting.findOne({ slug: 'email.from_address' }).lean(),
  ])
  return {
    fromName:    (nameSetting?.value    as string) || 'Support',
    fromAddress: (addressSetting?.value as string) || '',
  }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const { fromName, fromAddress } = await getFromHeader()
  if (!fromAddress) return

  // Try SendGrid first
  try {
    const apiKey = await revealSecret('sendgrid.api_key')
    const sgMail = (await import('@sendgrid/mail')).default
    sgMail.setApiKey(apiKey)
    await sgMail.send({ to, from: { name: fromName, email: fromAddress }, subject, html })
    return
  } catch {
    // fall through to SMTP
  }

  // Fall back to SMTP
  try {
    const [hostSetting, portSetting, smtpPass] = await Promise.all([
      Setting.findOne({ slug: 'third_party.smtp_host' }).lean(),
      Setting.findOne({ slug: 'third_party.smtp_port' }).lean(),
      revealSecret('smtp.password').catch(() => ''),
    ])
    const host = hostSetting?.value as string
    if (!host) return

    const { createTransport } = await import('nodemailer')
    const transporter = createTransport({
      host,
      port:   Number(portSetting?.value) || 587,
      secure: Number(portSetting?.value) === 465,
      auth:   smtpPass ? { user: fromAddress, pass: smtpPass } : undefined,
    })
    await transporter.sendMail({
      from:    `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      html,
    })
  } catch {
    // email sending failed silently — caller uses fire-and-forget
  }
}
