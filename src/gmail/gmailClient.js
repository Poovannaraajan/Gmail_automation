const { google } = require('googleapis');

/**
 * Fetches recent unread emails that match the query
 */
async function fetchRecentEmails(auth, query = 'newer_than:1d', maxResults = 10) {
  const gmail = google.gmail({ version: 'v1', auth });

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: maxResults,
  });

  const messages = response.data.messages;
  if (!messages || messages.length === 0) {
    return [];
  }

  const detailedMessages = [];

  for (const message of messages) {
    const msgData = await gmail.users.messages.get({
      userId: 'me',
      id: message.id,
      format: 'full',
    });

    const parsedEmail = parseMessage(msgData.data);
    detailedMessages.push(parsedEmail);
  }

  return detailedMessages;
}

function parseMessage(message) {
  const headers = message.payload.headers;
  const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject');
  const senderHeader = headers.find(h => h.name.toLowerCase() === 'from');

  const subject = subjectHeader ? subjectHeader.value : '';
  const sender = senderHeader ? senderHeader.value : '';

  let body = '';
  let attachments = [];

  function parseParts(parts) {
    if (!parts) return;
    for (const part of parts) {
      if (part.mimeType === 'text/plain') {
        if (part.body && part.body.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      } else if (part.mimeType === 'text/html' && !body) {
        // Fallback to HTML if no plain text
        if (part.body && part.body.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      } else if (part.filename && part.filename.length > 0) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          attachmentId: part.body.attachmentId,
        });
      }

      if (part.parts) {
        parseParts(part.parts);
      }
    }
  }

  if (message.payload.parts) {
    parseParts(message.payload.parts);
  } else if (message.payload.body && message.payload.body.data) {
    body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  }

  return {
    messageId: message.id,
    threadId: message.threadId,
    subject,
    sender,
    body: body.trim(),
    attachments,
  };
}

async function fetchEmailById(auth, id) {
  const gmail = google.gmail({ version: 'v1', auth });
  try {
    const msgData = await gmail.users.messages.get({
      userId: 'me',
      id: id,
      format: 'full',
    });
    return parseMessage(msgData.data);
  } catch (err) {
    console.error(`Error fetching email ${id}: ${err.message}`);
    return null;
  }
}

module.exports = {
  fetchRecentEmails,
  fetchEmailById,
};
