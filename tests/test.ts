import { promises as fs } from 'fs';
import axios from 'axios';
import { v4 as uuidv4 } from "uuid";

interface ApiResponse {
  text: string;
  sourceDocuments: any[];
}

const questionId = uuidv4();
const fileName = 'generated_answers.txt';
const fileQuestions = 'questions_comprehensive.txt';

// Read questions from the file
async function readQuestionsFromFile(filePath: string): Promise<string[]> {
  const data = await fs.readFile(filePath, 'utf-8');
  const questions = data.match(/Q: .*/g)?.map(q => q.replace('Q: ', '')) || [];
  return questions;
}

// Send HTTP requests and log responses
async function processQuestions(questions: string[]) {
  for (const question of questions) {
    try {
      const requestData = {
        question: question,
        history: [],
        questionId: questionId,
        maxTokens: 150
      };

      const response = await axios.post<ApiResponse>('http://localhost:3000/api/chat', requestData);
      const responseBody = response.data;
      const logMessage = `Q: ${question}\nA: ${responseBody.text}\n`;

      console.log(logMessage);

      // Append log to a file
      await fs.appendFile(fileName, logMessage, { flag: 'a' });
    } catch (error) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = (error as any).message;
      }

      console.error("Error: ", errorMessage);
      await fs.appendFile(fileName, `Error: ${errorMessage}\n`, { flag: 'a' });
    }
  }
}

// Main function to execute the process
async function main() {
  // Clear the contents of the file before every run
  await fs.writeFile(fileName, '');

  const questions = await readQuestionsFromFile(fileQuestions);
  await processQuestions(questions);
}

main().catch(console.error);