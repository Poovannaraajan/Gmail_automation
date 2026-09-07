require('dotenv').config();
const { authenticate } = require('./gmail/auth');
const { fetchRecentEmails, fetchEmailById } = require('./gmail/gmailClient');
const { classifyEmail } = require('./ai/classifier');
const { downloadAttachment } = require('./gmail/attachmentDownloader');
const fs = require('fs').promises;
const path = require('path');

const PROCESSED_LOG_PATH = path.join(process.cwd(), 'processed_emails.json');
const UNPROCESSED_LOG_PATH = path.join(process.cwd(), 'unprocessed_emails.json');

async function loadEmails(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

async function saveEmails(filePath, list) {
  await fs.writeFile(filePath, JSON.stringify(list, null, 2));
}

async function main() {
  console.log("Starting College Internship Email Automation...");

  try {
    const auth = await authenticate();
    console.log("Successfully authenticated with Gmail.");

    const processedEmails = await loadEmails(PROCESSED_LOG_PATH);
    const unprocessedEmails = await loadEmails(UNPROCESSED_LOG_PATH);

    const emailsToProcess = [];

    // 1. Pull unprocessed emails first
    if (unprocessedEmails.length > 0) {
      console.log(`Fetching ${unprocessedEmails.length} unprocessed emails from the queue...`);
      for (const id of unprocessedEmails) {
        if (!processedEmails.includes(id)) {
          const email = await fetchEmailById(auth, id);
          if (email) {
            emailsToProcess.push(email);
          }
        }
      }
    }

    // 2. Fetch normal recent emails (1-day)
    console.log("Fetching recent emails...");
    const recentEmails = await fetchRecentEmails(auth);
    let newFound = 0;
    
    for (const email of recentEmails) {
      if (!processedEmails.includes(email.messageId) && !emailsToProcess.find(e => e.messageId === email.messageId)) {
        emailsToProcess.push(email);
        newFound++;
      }
    }
    console.log(`Found ${newFound} new recent emails to process. Total in queue: ${emailsToProcess.length}`);

    for (const email of emailsToProcess) {
      console.log(`\n-----------------------------------------`);
      console.log(`Analyzing: ${email.subject}`);

      try {
        const classification = await classifyEmail(email.subject, email.body);
        console.log("Classification result:", classification);
        
        if (classification.iserror) {
          // If error (like rate limit), add to unprocessed if not already there
          if (!unprocessedEmails.includes(email.messageId)) {
            unprocessedEmails.push(email.messageId);
            await saveEmails(UNPROCESSED_LOG_PATH, unprocessedEmails);
            console.log(`Added email to unprocessed queue: ${email.subject}`);
          }
          continue; // skip the rest
        }

        if (classification.is_internship && classification.is_cs_eligible) {
          console.log("Email is a valid CSE internship opportunity!");

          // Find relevant attachments
          const pdfOrDocAttachments = email.attachments.filter(att =>
            att.mimeType === 'application/pdf' ||
            att.filename.toLowerCase().endsWith('.pdf') ||
            att.filename.toLowerCase().endsWith('.doc') ||
            att.filename.toLowerCase().endsWith('.docx')
          );

          if (pdfOrDocAttachments.length > 0) {
            console.log(`Found ${pdfOrDocAttachments.length} relevant attachments.`);
            for (const att of pdfOrDocAttachments) {
              await downloadAttachment(auth, email.messageId, att.attachmentId, att.filename);
            }
          } else {
            console.log("No PDF/DOC attachments found in this email.");
          }
        } else {
          console.log("Email is NOT a valid CSE internship opportunity.");
        }

        // Mark as processed ONLY after successful classification
        processedEmails.push(email.messageId);
        await saveEmails(PROCESSED_LOG_PATH, processedEmails);

        // Remove from unprocessed if it was there
        const unprocIndex = unprocessedEmails.indexOf(email.messageId);
        if (unprocIndex !== -1) {
          unprocessedEmails.splice(unprocIndex, 1);
          await saveEmails(UNPROCESSED_LOG_PATH, unprocessedEmails);
          console.log(`Removed email from unprocessed queue: ${email.subject}`);
        }

      } catch (err) {
        console.error(`Error processing email "${email.subject}":`, err.message);
        
        // Add to unprocessed queue if unhandled error occurs
        if (!unprocessedEmails.includes(email.messageId)) {
          unprocessedEmails.push(email.messageId);
          await saveEmails(UNPROCESSED_LOG_PATH, unprocessedEmails);
          console.log(`Added email to unprocessed queue: ${email.subject}`);
        }
      }
    }

    console.log(`\n-----------------------------------------`);
    console.log("Finished processing emails.");

  } catch (error) {
    console.error("An error occurred during execution:", error);
  }
}

main();
