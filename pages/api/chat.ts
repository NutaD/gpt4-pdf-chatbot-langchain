import fs from 'fs';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Document } from 'langchain/document';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { makeChain } from '@/utils/makechain';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';


// Create write streams for the id register main log and the feedback log
//const fblogStream = fs.createWriteStream('fblog.txt', { flags: 'a' }); // 'a' flag for appending
const idregstream = fs.createWriteStream('idreg.txt', { flags: 'a' }); // 'a' flag for appending
const logstream = fs.createWriteStream('log.txt', {flags: 'a' }); // 'a' flag for appending

let logfb = 'feedback null' + '\n'; //initialises logfb to be used to carry feedback from the feedback handler

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const {question, history, feedback, questionId} = req.body;

  // If feedback is present, log it and end the response, else set variable for feedback to be null
  // this function writes feedback information to both feedback register and the feedback log
  // while also outputting feedback to the console
  if (feedback) {
    console.log('feedback ' + questionId + ' ', JSON.stringify(feedback));

    logfb = 'feedback ' + JSON.stringify(feedback) + '\n';
    //const fblog = questionId + ' feedback ' + JSON.stringify(feedback) + '\n';
    const idreg = questionId + '\n';
    //fblogStream.write(fblog);
    idregstream.write(idreg);
    logstream.write(logfb);
   return res.status(200).json({message: 'Feedback logged successfully'});
  } //else {
   //logfb = 'feedback null' + '\n';
  //}

  console.log('question ' + questionId + ' ', JSON.stringify(question));

  //only accept post requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }
  // OpenAI recommends replacing newlines with spaces for best results
  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  try {
    const index = pinecone.Index(PINECONE_INDEX_NAME);

    /* create vectorstore*/
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({}),
      {
        pineconeIndex: index,
        textKey: 'text',
        namespace: PINECONE_NAME_SPACE, //namespace comes from your config folder
      },
    );

    // Use a callback to get intermediate sources from the middle of the chain
    let resolveWithDocuments: (value: Document[]) => void;
    const documentPromise = new Promise<Document[]>((resolve) => {
      resolveWithDocuments = resolve;
    });
    const retriever = vectorStore.asRetriever({
      callbacks: [
        {
          handleRetrieverEnd(documents) {
            resolveWithDocuments(documents);
          },
        },
      ],
      k:12,
    });

    //create chain
    const chain = makeChain(retriever);

    const pastMessages = history
      .map((message: [string, string]) => {
        return [`Human: ${message[0]}`, `Assistant: ${message[1]}`].join('\n');
      })
      .join('\n');
    console.log(pastMessages);

    //Ask a question using chat history
    const response = await chain.invoke({
      question: sanitizedQuestion,
      chat_history: pastMessages,
    });

    const sourceDocuments = await documentPromise;

//    console.log('response text '  + questionId + ' ', JSON.stringify(response["text"]));
//    response["sourceDocuments"].forEach( (doc: Document) => {
//          console.log('response source doc ' + questionId + ' ', doc.metadata["source"] , doc.metadata["loc.pageNumber"], doc.pageContent.split('\n').join(' '))
//        }
//    )
    // this writes the main log by concatenating on each new line the id, question, answer, and the feedback
  const logs = questionId + '\n' + 'question ' + question + '\n' + 'response ' + response + '\n'
    logstream.write(logs);

//    res.status(200).json(response);
    console.log('response', response);
    res.status(200).json({ text: response, sourceDocuments });
  } catch (error: any) {
    console.log('error', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
