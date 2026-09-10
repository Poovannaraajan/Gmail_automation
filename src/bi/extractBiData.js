const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Groq = require('groq-sdk');
require('dotenv').config();

const INTERNSHIPS_DIR = path.join(process.cwd(), process.env.INTERNSHIP_FOLDER || 'Internships');
const BI_DATA_PATH = path.join(process.cwd(), 'frontend', 'public', 'bi_data.json');
const DASHBOARD_HTML_PATH = path.join(process.cwd(), 'dashboard.html');

async function loadBiData() {
  try {
    const data = await fs.readFile(BI_DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

async function saveBiData(data) {
  await fs.writeFile(BI_DATA_PATH, JSON.stringify(data, null, 2));
}

async function extractFromDocumentText(text) {
  const { GROQ_API_KEY } = process.env;
  if (!GROQ_API_KEY) throw new Error('Missing GROQ_API_KEY');
  
  const groq = new Groq({ apiKey: GROQ_API_KEY });
  
  const prompt = `
You are a data extraction assistant.
Extract the Company Name, Job Role, and Required Skills from the following document text.
Return ONLY valid JSON in this format:
{
  "company_name": "Extracted company name (or null)",
  "role": "Extracted role title (or null)",
  "skills": ["skill1", "skill2"]
}

Document Text:
${text.substring(0, 3500)}
  `;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You return only valid JSON." },
        { role: "user", content: prompt }
      ],
      model: "openai/gpt-oss-120b",
      temperature: 0
    });
    
    let content = chatCompletion.choices[0]?.message?.content;
    let jsonString = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) jsonString = jsonMatch[1];
    else {
      const braceMatch = content.match(/\{[\s\S]*\}/);
      if (braceMatch) jsonString = braceMatch[0];
    }
    
    return JSON.parse(jsonString);
  } catch (err) {
    console.error("LLM Extraction failed:", err.message);
    return { company_name: null, role: null, skills: [] };
  }
}

async function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.txt') {
    const content = await fs.readFile(filePath, 'utf-8');
    let company = null, role = null, skills = [];
    
    const companyMatch = content.match(/Company:\s*(.*)/);
    if (companyMatch) company = companyMatch[1].trim();
    
    const roleMatch = content.match(/Role:\s*(.*)/);
    if (roleMatch) role = roleMatch[1].trim();
    
    const skillsMatch = content.match(/Skills:\s*(.*)/);
    if (skillsMatch) {
       const s = skillsMatch[1].trim();
       if (s && s !== 'N/A') {
         skills = s.split(',').map(x => x.trim());
       }
    }
    return { company_name: company, role: role, skills: skills };
  } 
  
  if (ext === '.pdf') {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return await extractFromDocumentText(data.text);
  }
  
  if (ext === '.docx' || ext === '.doc') {
    const result = await mammoth.extractRawText({ path: filePath });
    return await extractFromDocumentText(result.value);
  }
  
  return null;
}



async function main() {
  console.log("Starting BI Dashboard Generation...");
  
  try { await fs.access(INTERNSHIPS_DIR); } 
  catch { 
      console.log("No Internships directory found."); 
      return; 
  }

  const biData = await loadBiData();
  const files = await fs.readdir(INTERNSHIPS_DIR);
  
  let processedCount = 0;
  
  for (const file of files) {
    if (biData[file]) {
      continue;
    }
    
    console.log(`Processing new file: ${file}`);
    const filePath = path.join(INTERNSHIPS_DIR, file);
    const data = await processFile(filePath);
    
    if (data) {
      biData[file] = data;
      processedCount++;
    }
  }
  
  if (processedCount > 0) {
    console.log(`Successfully processed ${processedCount} new files.`);
    await saveBiData(biData);
  } else {
    console.log("No new files to process. Cache is up to date.");
  }
  
  console.log("Extraction complete.");
}

main();
