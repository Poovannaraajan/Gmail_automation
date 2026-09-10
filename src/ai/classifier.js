const Groq = require('groq-sdk');

async function classifyEmail(subject, body) {
  const { GROQ_API_KEY } = process.env;

  if (!GROQ_API_KEY) {
    throw new Error('Missing GROQ_API_KEY in environment variables.');
  }

  const groq = new Groq({ apiKey: GROQ_API_KEY });

  const prompt = `
You are an email classifier for a college internship automation system.

Analyze the following college placement email.

Determine:
1. Is this email related to an internship registration/recruitment opportunity?
2. Is B.Tech Computer Science / CSE eligible?
   (Note: CSE, Computer Science, IT, and general B.Tech are considered eligible. Mechanical/Civil only are not).
No M.Techs only or No MCA only
if there is a mail with both btech and ( mtech or mca or both) that mail is eligible. 
Return ONLY valid JSON in this format:
{
  "is_internship": true,
  "is_cs_eligible": true,
  "company_name": "Extracted company name (or null)",
  "role": "Extracted role title (or null)",
  "skills": ["skill1", "skill2", "skill3"],
  "jd_summary": "Extracted short JD summary (max 3 sentences, or null)"
}

Do not include markdown or additional explanation.

Subject:
${subject}

Body:
${body}
  `;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that returns only valid JSON objects."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "openai/gpt-oss-120b",
      temperature: 0
    });

    const content = chatCompletion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from Groq API");
    }

    let jsonString = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1];
    } else {
      const braceMatch = content.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        jsonString = braceMatch[0];
      }
    }

    const result = JSON.parse(jsonString);

    // Validate output
    if (typeof result.is_internship !== "boolean" || typeof result.is_cs_eligible !== "boolean") {
      throw new Error("Invalid classifier response format");
    }

    return result;
  } catch (error) {
    console.error("Error calling Groq API:", error);
    // On error, default to false to avoid processing junk
    return {
      is_internship: false,
      is_cs_eligible: false,
      iserror: true
    };
  }
}

module.exports = {
  classifyEmail,
};
