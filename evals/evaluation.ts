import axios from 'axios';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import * as json2csv from 'json2csv';

// Load environment variables from .env file
dotenv.config();

// Load API key and model from environment variables or configuration file
const apiKey = process.env.OPENAI_API_KEY;
const evalModel = process.env.EvalModel as string;
const questionsReferenceFile = process.env.fileQuestions as string;
const questionsGeneratedFile = process.env.fileAnswers as string;
const evalResFileJson = process.env.evalResFileJson as string;
const evalResFileCsv = process.env.evalResFileCsv as string;
const openaiApiUrl = 'https://api.openai.com/v1/chat/completions'; // Updated endpoint for chat models

const EVAL_PROMPT = 'Please compare the generated answer to the reference answer. Provide your evaluation in the following strict format:\n' +
    '\n' +
    'Score: X\n' +
    '\n' +
    'Explanation: ...\n' +
    '\n' +
    'Evaluation Criteria:\n' +
    'Accuracy: How well does the generated answer match the reference answer in terms of factual correctness and completeness?\n' +
    'Relevance: How relevant is the generated answer to the prompt or question asked?\n' +
    'Clarity: How clear and understandable is the generated answer compared to the reference answer?\n' +
    'Conciseness: Does the generated answer provide the necessary information without unnecessary verbosity?\n' +
    'Coherence: Is the generated answer logically structured and does it flow well?\n' +
    'Style: How well does the generated answer match the tone and style of the reference answer, if applicable?\n' +
    'Scoring Guide:\n' +
    'Score: 10: The generated answer is almost identical to the reference answer in all aspects.\n' +
    'Score: 8-9: The generated answer is very close to the reference answer, with minor differences that do not affect the overall quality.\n' +
    'Score: 6-7: The generated answer matches the reference answer in most aspects but has some noticeable differences.\n' +
    'Score: 4-5: The generated answer has several differences from the reference answer and only partially matches it.\n' +
    'Score: 2-3: The generated answer has significant differences and only matches the reference answer in a few aspects.\n' +
    'Score: 0-1: The generated answer does not match the reference answer in most aspects and has major differences.\n' +
    'Make sure to write the score exactly in the format "Score: X", without any additional characters or variations. The maximum possible score is 10.'

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

// Function to get the request body based on the model
const getRequestBody = (model: string, prompt: string, referenceAnswer: string, generatedAnswer: string) => {
    const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: `Q: ${prompt}` },
        { role: 'assistant', content: `Reference Answer: ${referenceAnswer}` },
        { role: 'user', content: `Generated Answer: ${generatedAnswer}\n\n${EVAL_PROMPT}` }
    ];

    return {
        model: model,
        messages: messages,
        max_tokens: 150,
        temperature: 0.0
    };
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

        const requestBody = getRequestBody(evalModel, prompt, referenceAnswer, generatedAnswer);

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
    await fsPromises.writeFile(evalResFileJson, JSON.stringify(results, null, 2));
    console.log(`Evaluation results saved to ${evalResFileJson}`);

    // Convert JSON to CSV
    try {
        const jsonArray = results;

        // Define the fields for the CSV
        const fields = ['prompt', 'referenceAnswer', 'generatedAnswer', 'score', 'explanation'];
        const opts = { fields };

        // Convert JSON to CSV
        const csv = json2csv.parse(jsonArray, opts);

        // Write the CSV file
        await fsPromises.writeFile(evalResFileCsv, csv);
        console.log(`CSV file saved to ${evalResFileCsv}`);
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
