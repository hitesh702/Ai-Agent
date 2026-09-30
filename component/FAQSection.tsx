"use client";
import "./FAQSection.css";


import { useState } from "react";
import "./FAQSection.css";

const FAQS = [
  {
    question: "What is CallAI?",
    answer:
      "CallAI is an AI voice calling platform that helps businesses call leads, have natural conversations, qualify enquiries, and organize follow-ups.",
  },
  {
    question: "Can CallAI speak Hindi and Hinglish?",
    answer:
      "Yes. CallAI is designed to support Hindi, Hinglish, and English conversations so businesses can communicate with customers naturally.",
  },
  {
    question: "Can I use CallAI for my coaching institute?",
    answer:
      "Yes. Coaching institutes can use CallAI to contact new enquiries, understand course requirements, identify interested students, and manage follow-ups.",
  },
  {
    question: "Will I get a transcript after the call?",
    answer:
      "Yes. Call conversations can be converted into transcripts so your team can review what was discussed with each lead.",
  },
  {
    question: "Can CallAI automatically qualify leads?",
    answer:
      "Yes. Based on the conversation, leads can be classified into outcomes such as interested, not interested, or follow-up.",
  },
  {
    question: "Do I need a technical team to use CallAI?",
    answer:
      "No. CallAI is designed as a business-focused platform so teams can configure their AI agent and manage leads without building the calling system themselves.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="faq-section" id="faq">
      <div className="faq-container">

        <div className="faq-heading">
          <p className="faq-label">FAQ</p>

          <h2>
            Frequently asked
            <span> questions.</span>
          </h2>

          <p>
            Everything you need to know about using CallAI for your
            business.
          </p>
        </div>

        <div className="faq-list">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                className={`faq-item ${isOpen ? "faq-open" : ""}`}
                key={faq.question}
              >
                <button
                  type="button"
                  className="faq-question"
                  onClick={() => toggleFAQ(index)}
                  aria-expanded={isOpen}
                >
                  <span>{faq.question}</span>

                  <span className="faq-icon">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                {isOpen && (
                  <div className="faq-answer">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}

