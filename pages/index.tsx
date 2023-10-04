import {useRef, useState, useEffect} from 'react';
import Layout from '@/components/layout';
import styles from '@/styles/Home.module.css';
import {Message} from '@/types/chat';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';
import {Document} from 'langchain/document';
import Path from 'path';
import {randomUUID} from "crypto"; // Add this import
import { v4 as uuidv4 } from 'uuid';


import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

export default function Home() {
    const [query, setQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [messageState, setMessageState] = useState<{
        messages: Message[];
        pending?: string;
        history: [string, string][];
        pendingSourceDocs?: Document[];
    }>({
        messages: [
            {
                message: 'Hi, what would you like to learn about CASMO nuclear code?',
                type: 'apiMessage',
            },
        ],
        history: [],
    });

    const {messages, history} = messageState;

    const messageListRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const [feedbackState, setFeedbackState] = useState<{ [key: number]: 'like' | 'dislike' | null }>({});
    const [questionId, setQuestionId] = useState<string | null>(null);

    useEffect(() => {
        textAreaRef.current?.focus();
    }, []);


    //handle form submission
    async function handleSubmit(e: any) {
        e.preventDefault();

        setError(null);

        if (!query) {
            alert('Please input a question');
            return;
        }

        const generatedQuestionId = uuidv4(); // Generate questionId here
        setQuestionId(generatedQuestionId);
        const question = query.trim();

        setMessageState((state) => ({
            ...state,
            messages: [
                ...state.messages,
                {
                    type: 'userMessage',
                    message: question,
                },
            ],
        }));

        setLoading(true);
        setQuery('');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question,
                    history,
                    questionId: generatedQuestionId, // Send questionId to the server
                }),
            });
            const data = await response.json();
            console.log('data', data);

            if (data.error) {
                setError(data.error);
            } else {
                setMessageState((state) => ({
                    ...state,
                    messages: [
                        ...state.messages,
                        {
                            type: 'apiMessage',
                            message: data.text,
                            sourceDocs: data.sourceDocuments,
                        },
                    ],
                    history: [...state.history, [question, data.text]],
                }));
            }
            console.log('messageState', messageState);

            setLoading(false);

            //scroll to bottom
            messageListRef.current?.scrollTo(0, messageListRef.current.scrollHeight);
        } catch (error) {
            setLoading(false);
            setError('An error occurred while fetching the data. Please try again.');
            console.log('error', error);
        }
    }

    async function handleFeedback(type: 'like' | 'dislike', messageIndex: number) {
        console.log(`User gave a ${type} feedback`);
        setFeedbackState(prev => ({ ...prev, [messageIndex]: type }));

        try {
            await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    feedback: type,
                    questionId // Send questionId during feedback
                })
            });
        } catch (error) {
            console.error('Error sending feedback:', error);
        }
        // You can expand upon this to send this feedback to a server or record it in some other way
    }

    //prevent empty submissions
    const handleEnter = (e: any) => {
        if (e.key === 'Enter' && query) {
            handleSubmit(e);
        } else if (e.key == 'Enter') {
            e.preventDefault();
        }
    };

    return (
        <>
            <Layout>
                <div className="mx-auto flex flex-col gap-4">
                    <h1 className="text-2xl font-bold leading-[1.1] tracking-tighter text-center">
                        CASMO interactive guide
                    </h1>
                    <main className={styles.main}>
                        <div className={styles.cloud}>
                            <div ref={messageListRef} className={styles.messagelist}>
                                {messages.map((message, index) => {
                                    let icon;
                                    let className;
                                    if (message.type === 'apiMessage') {
                                        icon = (
                                            <Image
                                                key={index}
                                                src="/bot-image.png"
                                                alt="AI"
                                                width="40"
                                                height="40"
                                                className={styles.boticon}
                                                priority
                                            />
                                        );
                                        className = styles.apimessage;
                                    } else {
                                        icon = (
                                            <Image
                                                key={index}
                                                src="/usericon.png"
                                                alt="Me"
                                                width="30"
                                                height="30"
                                                className={styles.usericon}
                                                priority
                                            />
                                        );
                                        // The latest message sent by the user will be animated while waiting for a response
                                        className =
                                            loading && index === messages.length - 1
                                                ? styles.usermessagewaiting
                                                : styles.usermessage;
                                    }
                                    return (
                                        <>
                                            <div key={`chatMessage-${index}`} className={className}>
                                                {icon}
                                                <div className={styles.markdownanswer}>
                                                    <ReactMarkdown linkTarget="_blank">
                                                        {message.message}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                            {message.sourceDocs && (
                                                <div
                                                    className="p-5"
                                                    key={`sourceDocsAccordion-${index}`}
                                                >
                                                    <Accordion
                                                        type="single"
                                                        collapsible
                                                        className="flex-col"
                                                    >
                                                        {message.sourceDocs.map((doc, index) => (
                                                            <div key={`messageSourceDocs-${index}`}>
                                                                <AccordionItem value={`item-${index}`}>
                                                                    <AccordionTrigger>
                                                                        <h3>Source {index + 1}</h3>
                                                                    </AccordionTrigger>
                                                                    <AccordionContent>
                                                                        <ReactMarkdown linkTarget="_blank">
                                                                            {doc.pageContent}
                                                                        </ReactMarkdown>
                                                                        <p className="mt-2">
                                                                            <b>Source:</b> {doc.metadata.source.split('\\').reverse()[0]}
                                                                        </p>
                                                                        <p className="mt-2">
                                                                            <b>Page</b> {doc.metadata["loc.pageNumber"]}
                                                                        </p>
                                                                        <p className="mt-2"><b>Lines
                                                                            from:</b> {doc.metadata["loc.lines.from"]}
                                                                        </p>
                                                                        <p className="mt-2"><b>Lines
                                                                            to: </b>{doc.metadata["loc.lines.to"]}
                                                                        </p>
                                                                    </AccordionContent>
                                                                </AccordionItem>
                                                            </div>
                                                        ))}
                                                    </Accordion>
                                                    <div className="my-2">
                                                        <button
                                                            className={`mr-3 px-4 py-2 rounded ${feedbackState[index] === 'like' ? 'bg-green-700' : 'bg-green-500'} text-white`}
                                                            onClick={() => handleFeedback('like', index)}>
                                                            👍 Like
                                                        </button>
                                                        <button
                                                            className={`px-4 py-2 rounded ${feedbackState[index] === 'dislike' ? 'bg-red-700' : 'bg-red-500'} text-white`}
                                                            onClick={() => handleFeedback('dislike',index)}>
                                                            👎 Dislike
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })}
                            </div>
                        </div>
                        <div className={styles.center}>
                            <div className={styles.cloudform}>
                                <form onSubmit={handleSubmit}>
                  <textarea
                      disabled={loading}
                      onKeyDown={handleEnter}
                      ref={textAreaRef}
                      autoFocus={false}
                      rows={1}
                      maxLength={512}
                      id="userInput"
                      name="userInput"
                      placeholder={
                          loading
                              ? 'Waiting for response...'
                              : ''
                      }
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className={styles.textarea}
                  />
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className={styles.generatebutton}
                                    >
                                        {loading ? (
                                            <div className={styles.loadingwheel}>
                                                <LoadingDots color="#000"/>
                                            </div>
                                        ) : (
                                            // Send icon SVG in input field
                                            <svg
                                                viewBox="0 0 20 20"
                                                className={styles.svgicon}
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                                            </svg>
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>
                        {error && (
                            <div className="border border-red-400 rounded-md p-4">
                                <p className="text-red-500">{error}</p>
                            </div>
                        )}
                    </main>
                </div>
                <footer className="m-auto p-4">
                    <a href="https://twitter.com/mayowaoshin">
                        Powered by LangChainAI. Demo built by Mayo (Twitter: @mayowaoshin).
                    </a>
                </footer>
            </Layout>
        </>
    );
}
