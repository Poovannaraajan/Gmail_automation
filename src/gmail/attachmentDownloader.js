const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

/**
 * Downloads a specific attachment to the local folder
 */
async function downloadAttachment(auth, messageId, attachmentId, filename) {
  const gmail = google.gmail({ version: 'v1', auth });

  const { INTERNSHIP_FOLDER } = process.env;
  const folderPath = INTERNSHIP_FOLDER || './Internships';

  // Ensure directory exists
  try {
    await fs.mkdir(folderPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }

  // Clean filename to prevent path traversal or invalid characters
  const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  // Prepend message ID to avoid naming collisions
  const finalFilename = `${messageId}_${safeFilename}`;
  const filePath = path.join(process.cwd(), folderPath, finalFilename);

  console.log(`Downloading attachment ${filename} to ${filePath}...`);

  const response = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId: messageId,
    id: attachmentId,
  });

  if (response.data && response.data.data) {
    const fileData = Buffer.from(response.data.data, 'base64');
    await fs.writeFile(filePath, fileData);
    console.log(`Successfully downloaded ${finalFilename}`);
    return filePath;
  } else {
    throw new Error('Failed to retrieve attachment data');
  }
}

module.exports = {
  downloadAttachment,
};
