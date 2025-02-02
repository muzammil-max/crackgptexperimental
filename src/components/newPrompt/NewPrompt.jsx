import { useEffect, useRef, useState } from "react";
import "./newPrompt.css";
import Upload from "../upload/Upload";
import { IKImage } from "imagekitio-react";
import React from "react";
import model from "../../lib/gemini";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { motion } from "framer-motion";

const chunkSize = 100; // number of characters per chunk
const chunkInterval = 50; // milliseconds between chunks

const MarkdownRenderer = ({ content }) => {
  return (
    <div className="markdown-container">
      <Markdown
        children={content}
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Code blocks with copy button
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
              <div className="code-block-container">
                <SyntaxHighlighter
                  style={atomDark}
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
                <button
                  className="copy-button"
                  onClick={() =>
                    navigator.clipboard.writeText(String(children))
                  }
                >
                  Copy
                </button>
              </div>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // Center math blocks and other divs if possible.
          div({ node, className, children, ...props }) {
            if (className?.includes("math")) {
              return (
                <div
                  className="math-container"
                  style={{ textAlign: "center" }}
                  {...props}
                >
                  {children}
                </div>
              );
            }
            return <div {...props}>{children}</div>;
          },
          img({ node, ...props }) {
            return (
              <img
                {...props}
                style={{ margin: "0 auto", display: "block" }}
                alt=""
              />
            );
          },
          blockquote({ node, children, ...props }) {
            return (
              <blockquote className="styled-blockquote" {...props}>
                {children}
              </blockquote>
            );
          },
        }}
      />
    </div>
  );
};

const NewPrompt = () => {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [img, setImg] = useState({
    isLoading: false,
    error: "",
    dbData: {},
    aiData: {},
  });
  const [isTyping, setIsTyping] = useState(false);

  // A ref for the chat container so we can detect manual scrolling.
  const chatContainerRef = useRef(null);
  const endRef = useRef(null);

  // Only auto-scroll if the user is at the bottom.
  useEffect(() => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      const isAtBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        50;
      // Auto-scroll only if already near the bottom.
      if (isAtBottom) {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages, isTyping]);

  // Handle scrolling manually. If the user scrolls up, we don’t force auto scroll.
  const handleScroll = () => {
    const container = chatContainerRef.current;
    if (container) {
      const isAtBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        50;
      // If not at bottom, do not auto scroll.
      if (!isAtBottom) {
        // Do nothing (or you could set some state if needed)
      }
    }
  };

  const addMessage = async (text) => {
    // Add the user message.
    const userMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setIsTyping(true);

    // Show "Thinking..." before the chatbot starts typing
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Thinking..." },
    ]);

    try {
      // Generate the assistant response.
      const result = await model.generateContent(
        Object.entries(img.aiData).length ? [img.aiData, text] : [text]
      );
      const response = await result.response;
      let fullAnswer = await response.text();
      fullAnswer = fullAnswer.replace(/\\/g, "");

      // Remove "Thinking..." and add an empty assistant message
      setMessages((prev) => prev.slice(0, -1));
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      let index = 0;
      const interval = setInterval(() => {
        if (index < fullAnswer.length) {
          const chunk = fullAnswer.slice(index, index + chunkSize);
          index += chunkSize;
          // Update the last message in the messages array.
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            newMessages[newMessages.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + chunk,
            };
            return newMessages;
          });
        } else {
          clearInterval(interval);
          setIsTyping(false);
        }
      }, chunkInterval);
    } catch (error) {
      console.error("Error generating content:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "CrackGPT is overloaded, please try again later.",
        },
      ]);
      setIsTyping(false);
    }
  };

  // Modified handleSubmit to be directly callable from the textarea’s onKeyDown.
  const handleSubmit = (e) => {
    e.preventDefault();
    const form = e.target.closest("form");
    const textArea = form?.querySelector("textarea[name='text']");
    const text = textArea?.value;
    if (!text || !text.trim()) return;
    addMessage(text);
    // Clear textarea after submission.
    textArea.value = "";
  };

  return (
    <>
      <div className="move">
        <div className="image">
          {img.isLoading && <div>Loading...</div>}
          {img.dbData?.filePath && (
            <IKImage
              className="myImg"
              urlEndpoint="https://ik.imagekit.io/ay7uluo9u"
              path={img.dbData?.filePath}
              width="300"
              transformation={[{ width: 300 }]}
            />
          )}
        </div>
      </div>
      <div
        className="chat-container"
        ref={chatContainerRef}
        onScroll={handleScroll}
      >
        {messages.map((message, index) => (
          <motion.div
            key={index}
            className={`message ${
              message.role === "user" ? "user" : "assistant"
            }`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {message.role === "assistant" && (
              <div className="logo-container">
                <img
                  src="/logo.png"
                  alt="CrackGPT Logo"
                  className="chat-logo"
                />
              </div>
            )}
            <MarkdownRenderer content={message.content} />
          </motion.div>
        ))}
        {isTyping && (
          <div className="message assistant typing-fade">
            <div className="logo-container">
              <img src="/logo.png" alt="CrackGPT Logo" className="chat-logo" />
            </div>
            {/* While streaming, the last assistant message is updated so we do not need a separate placeholder */}
          </div>
        )}
        <div className="endChat" ref={endRef} />
      </div>
      <form className="newForm" autoComplete="off" onSubmit={handleSubmit}>
        <Upload setImg={setImg} />
        <textarea
          name="text"
          placeholder="Ask CrackGPT"
          rows="4"
          fontFamily="Arial"
          className="text"
          style={{
            resize: "none",
            fontFamily: "Inter, Arial, sans-serif",
            fontSize: "15px",
            marginBottom: "0px",
            margintop: "0px",
            height: "55px",
            color: "white",
            overflowY: "scroll",
            scrollbarColor: "auto",
          }}
          onKeyDown={(e) => {
            // If Enter is pressed without Shift, submit the form.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        ></textarea>
        <button type="submit">
          <img src="/send2.png" alt="Send" />
        </button>
      </form>
    </>
  );
};

export default NewPrompt;
