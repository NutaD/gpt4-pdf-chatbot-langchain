import axios from 'axios';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import * as json2csv from 'json2csv';

// Load environment variables from .env file
dotenv.config();

// Load API key from environment variable or configuration file
const apiKey = process.env.OPENAI_API_KEY;
const questionsReferenceFile = 'questions_comprehensive.txt';
const questionsGeneratedFile = 'generated_answers.txt';
const evalResFile = 'eval_results.json';
const csvFile = 'eval_results.csv';
const openaiApiUrl = 'https://api.openai.com/v1/chat/completions'; // Updated endpoint for chat models

if (!apiKey) {
    console.error('OpenAI API key is not set. Please check your .env file.');
    process.exit(1);
}

// Helper function to read file lines into an array
const readLines = (filePath: string): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        const lines: string[] = [];
        const rl = readline.createInterface({
            input: fs.createReadStream(filePath),
            output: process.stdout,
            terminal: false,
        });

        rl.on('line', (line) => {
            lines.push(line);
        });

        rl.on('close', () => {
            resolve(lines);
        });

        rl.on('error', (err) => {
            reject(err);
        });
    });
};

// Helper function to parse Q&A from file
const parseQA = (lines: string[]): { question: string, answer: string }[] => {
    const qaList: { question: string, answer: string }[] = [];
    let question = '';
    let answer = '';
    for (const line of lines) {
        if (line.startsWith('Q:')) {
            if (question && answer) {
                qaList.push({ question, answer });
            }
            question = line.replace('Q: ', '').trim();
            answer = '';
        } else if (line.startsWith('A:')) {
            answer = line.replace('A: ', '').trim();
        } else if (line.trim()) {
            answer += ' ' + line.trim();
        }
    }
    if (question && answer) {
        qaList.push({ question, answer });
    }
    return qaList;
};

// Function to evaluate answers
const evaluateAnswers = async () => {
    // Read questions and answers
    const questionsReferenceLines = await readLines(questionsReferenceFile);
    const generatedAnswersLines = await readLines(questionsGeneratedFile);

    const questionsReference = parseQA(questionsReferenceLines);
    const generatedAnswers = parseQA(generatedAnswersLines);

    const evalData = questionsReference.map((item, index) => ({
        prompt: item.question,
        referenceAnswer: item.answer,
        generatedAnswer: generatedAnswers[index]?.answer || '',
    }));

    const results: any[] = [];

    for (const item of evalData) {
        const { prompt, referenceAnswer, generatedAnswer } = item;

        const requestBody = {
            model: 'gpt-3.5-turbo', // Updated to a valid chat model
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: `Q: ${prompt}` },
                { role: 'assistant', content: `Reference Answer: ${referenceAnswer}` },
                { role: 'user', content: `Generated Answer: ${generatedAnswer}\n\nPlease provide your evaluation in the following strict format:\nScore: X\nExplanation: ...\nMake sure to write the score exactly in the format "Score: X", without any additional characters or variations. The maximum possible score is 10.` }
            ],
            max_tokens: 150,
            temperature: 0.0,
        };

        try {
            console.log(`Using API Key: ${apiKey ? '***' : 'not set'}`); // Debugging line to check API key presence
            const response = await axios.post(openaiApiUrl, requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
            });

            const responseText = response.data.choices[0].message.content.trim();
            const scoreMatch = responseText.match(/Score: (\d{1,2})/);
            const score = scoreMatch ? scoreMatch[1] : 'N/A';
            const explanation = responseText.replace(/Score: \d{1,2}\s*Explanation:\s*/, '').trim();

            results.push({
                prompt: prompt,
                referenceAnswer: referenceAnswer,
                generatedAnswer: generatedAnswer,
                score: score,
                explanation: explanation,
            });
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                console.error('Axios error:', error.message);
                if (error.response) {
                    console.error('Response data:', error.response.data);
                }
            } else if (error instanceof Error) {
                console.error('Error:', error.message);
            } else {
                console.error('Unknown error:', error);
            }
        }
    }

    // Save the results to a JSON file
    await fsPromises.writeFile(evalResFile, JSON.stringify(results, null, 2));
    console.log(`Evaluation results saved to ${evalResFile}`);

    // Convert JSON to CSV
    try {
        const jsonArray = results;

        // Define the fields for the CSV
        const fields = ['prompt', 'referenceAnswer', 'generatedAnswer', 'score', 'explanation'];
        const opts = { fields };

        // Convert JSON to CSV
        const csv = json2csv.parse(jsonArray, opts);

        // Write the CSV file
        await fsPromises.writeFile(csvFile, csv);
        console.log(`CSV file saved to ${csvFile}`);
    } catch (error) {
        console.error('Error converting JSON to CSV:', error);
    }
};

// Execute the evaluation and conversion
evaluateAnswers().catch((err: unknown) => {
    if (err instanceof Error) {
        console.error('Error during evaluation:', err.message);
    } else {
        console.error('Unknown error during evaluation:', err);
    }
});
