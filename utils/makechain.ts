import { ChatOpenAI } from 'langchain/chat_models/openai';
import { ChatPromptTemplate } from 'langchain/prompts';
import { RunnableSequence } from 'langchain/schema/runnable';
import { StringOutputParser } from 'langchain/schema/output_parser';
import type { Document } from 'langchain/document';
import type { VectorStoreRetriever } from 'langchain/vectorstores/base';
import * as dotenv from "dotenv";

const baseModel = process.env.BaseModel

const CONDENSE_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

<chat_history>
  {chat_history}
</chat_history>

Follow Up Input: {question}
Standalone question:`;
//You are an expert researcher. Use the following pieces of context to answer the question at the end. Try to give a detailed answer where possible.
// If you don't know the answer, just say you don't know. DO NOT try to make up an answer. Base your response only on the information provided, do not add anything from yourself.
// If the question is not related to the context or chat history, politely respond that you are tuned to only answer questions that are related to the context.
const QA_TEMPLATE = `

You are an expert researcher. Use the following pieces of context to answer the question at the end. Try to give a detailed answer where possible.
If you don't know the answer, just say you don't know. DO NOT try to make up an answer. Base your response only on the information provided, do not add anything from yourself.
If the question is not related to the context or chat history, politely respond that you are tuned to only answer questions that are related to the context.

<context>
  {context}
</context>

<chat_history>
  {chat_history}
</chat_history>

Question: {question}
Helpful answer in markdown:`;
// const QA_TEMPLATE = `You are an expert researcher. Use only the provided context to answer the question at the end. Ensure your answer is detailed and accurate based on the context. If you don't know the answer or if the context does not provide the information, explicitly state that you don't know. Do not make up any information or add anything beyond what is given in the context.
//
// **Important: Treat each term and phrase as distinct entities, especially when they appear similar but have different meanings in the context. For example, "LOW ACTIVE – LOW LEVEL WASTE" is not the same as "LOW LEVEL WASTE." Ensure these distinctions are clear in your response.**
//
// If the question is unrelated to the provided context, respond with: "I am tuned to only answer questions related to the given context."
//
// <context>
//   {context}
// </context>
//
// <chat_history>
//   {chat_history}
// </chat_history>
//
// Question: {question}
//
// Helpful answer in markdown:`;

const combineDocumentsFn = (docs: Document[], separator = '\n\n') => {
  const serializedDocs = docs.map((doc) => doc.pageContent);
  return serializedDocs.join(separator);
};

export const makeChain = (retriever: VectorStoreRetriever) => {
  const condenseQuestionPrompt =
    ChatPromptTemplate.fromTemplate(CONDENSE_TEMPLATE);
  const answerPrompt = ChatPromptTemplate.fromTemplate(QA_TEMPLATE);

  const model = new ChatOpenAI({
    temperature: 0, // increase temperature to get more creative answers
    modelName: baseModel, //change this to gpt-4 if you have access
  });

  // Rephrase the initial question into a dereferenced standalone question based on
  // the chat history to allow effective vectorstore querying.
  const standaloneQuestionChain = RunnableSequence.from([
    condenseQuestionPrompt,
    model,
    new StringOutputParser(),
  ]);

  // Retrieve documents based on a query, then format them.
  const retrievalChain = retriever.pipe(combineDocumentsFn);

  // Generate an answer to the standalone question based on the chat history
  // and retrieved documents. Additionally, we return the source documents directly.
  const answerChain = RunnableSequence.from([
    {
      context: RunnableSequence.from([
        (input) => input.question,
        retrievalChain,
      ]),
      chat_history: (input) => input.chat_history,
      question: (input) => input.question,
    },
    answerPrompt,
    model,
    new StringOutputParser(),
  ]);

  // First generate a standalone question, then answer it based on
  // chat history and retrieved context documents.
  const conversationalRetrievalQAChain = RunnableSequence.from([
    {
      question: standaloneQuestionChain,
      chat_history: (input) => input.chat_history,
    },
    answerChain,
  ]);

  return conversationalRetrievalQAChain;
};
