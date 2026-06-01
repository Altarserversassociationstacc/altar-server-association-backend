/**
 * @file emailService.js
 * @description Core engine to send email via Google Gmail OAuth2 API
 */
const { google } = require('googleapis');

const sendOAuth2Email = async (to, subject, htmlContent, replyToEmail = null) => {
  const recipient = Array.isArray(to) ? to.join(', ') : to;
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    
    const messageParts = [
      `From: Altar Server Association <${process.env.ASSOCIATION_EMAIL}>`,
      `To: ${recipient}`,
      ...(replyToEmail ? [`Reply-To: ${replyToEmail}`] : []),
      'Content-Type: text/html; charset="UTF-8"',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      htmlContent
    ];
    
    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
    console.log(`[Email Service] Delivered safely to: ${recipient}`);
    return res.data;
  } catch (error) {
    console.error("[Email Service Error]:", error.response?.data || error.message);
    throw error;
  }
};

module.exports = { sendOAuth2Email };